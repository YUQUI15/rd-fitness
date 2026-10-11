/* RD Fitness Club - utilidades compartidas (panel y app del socio) */
(function () {
  const RD = window.RD = window.RD || {};

  // ---------- Formato ----------
  RD.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  RD.money = n => 'S/ ' + (Number(n) || 0).toFixed(2).replace(/\.00$/, '');
  RD.fmtDate = d => { if (!d) return '—'; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
  RD.fmtTime = iso => new Date(iso).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  RD.fmtDateTime = iso => iso ? `${RD.fmtDate(RD.limaDay(new Date(iso)))} ${RD.fmtTime(iso)}` : '—';
  RD.fmtDur = s => { s = Math.round(s || 0); const m = Math.floor(s / 60), r = s % 60; return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m}:${String(r).padStart(2, '0')}`; };
  RD.ago = iso => {
    if (!iso) return 'nunca';
    const d = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (d < 1) return 'ahora'; if (d < 60) return `hace ${d} min`;
    if (d < 1440) return `hace ${Math.floor(d / 60)} h`;
    const days = Math.floor(d / 1440); return `hace ${days} día${days === 1 ? '' : 's'}`;
  };
  const fmtDayLima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' });
  RD.timeOffset = Number(localStorage.getItem('rd_time_offset') || 0);
  RD.now = () => Date.now() + RD.timeOffset;
  RD.limaDay = (d) => fmtDayLima.format(d || new Date(RD.now()));
  const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  RD.diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000);
  RD.addDays = (s, n) => new Date(toUTC(s) + n * 86400000).toISOString().slice(0, 10);
  RD.waLink = (phone, text) => {
    let p = String(phone || '').replace(/\D/g, '');
    if (p.length === 9) p = '51' + p;
    return p ? `https://wa.me/${p}?text=${encodeURIComponent(text || '')}` : null;
  };
  RD.debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  RD.uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));

  // Estado de acceso (mismo criterio que el servidor)
  RD.accessState = (m, today, cfg = {}) => {
    const warnDays = cfg.warn_days ?? 5, grace = cfg.grace_days ?? 0;
    if (m.status === 'blocked') return { level: 'denied', reason: 'Socio bloqueado', daysLeft: null };
    if (m.status === 'inactive') return { level: 'denied', reason: 'Socio dado de baja', daysLeft: null };
    if (m.frozen) return { level: 'denied', reason: 'Membresía congelada', daysLeft: null };
    if (!m.end) return { level: 'denied', reason: 'Sin membresía', daysLeft: null };
    const left = RD.diffDays(m.end, today);
    if (left >= 0) {
      if (left <= warnDays) return { level: 'warn', reason: left === 0 ? 'Vence HOY' : `Vence en ${left} día${left === 1 ? '' : 's'}`, daysLeft: left };
      return { level: 'ok', reason: 'Membresía vigente', daysLeft: left };
    }
    if (-left <= grace) return { level: 'warn', reason: `Período de gracia (venció hace ${-left} día${-left === 1 ? '' : 's'})`, daysLeft: left };
    return { level: 'denied', reason: `Vencida hace ${-left} día${-left === 1 ? '' : 's'}`, daysLeft: left };
  };

  // ---------- API ----------
  RD.makeApi = (tokenKey, onAuthFail) => {
    const call = async (method, url, body) => {
      const headers = { 'Content-Type': 'application/json' };
      const t = localStorage.getItem(tokenKey);
      if (t) headers.Authorization = 'Bearer ' + t;
      let res;
      try {
        res = await fetch('/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      } catch (e) {
        const err = new Error('Sin conexión con el servidor'); err.offline = true; throw err;
      }
      let data = null;
      try { data = await res.json(); } catch { }
      if (res.status === 401 && onAuthFail && !url.startsWith('/auth/')) { onAuthFail(); }
      if (!res.ok) { const err = new Error((data && data.error) || 'Error ' + res.status); err.status = res.status; err.data = data; throw err; }
      return data;
    };
    return { get: u => call('GET', u), post: (u, b) => call('POST', u, b || {}), put: (u, b) => call('PUT', u, b || {}), del: u => call('DELETE', u) };
  };
  RD.syncTime = async () => {
    try {
      const t0 = Date.now();
      const r = await (await fetch('/api/time', { cache: 'no-store' })).json();
      const t1 = Date.now();
      RD.timeOffset = r.now - (t0 + t1) / 2;
      localStorage.setItem('rd_time_offset', String(RD.timeOffset));
    } catch { }
  };

  // ---------- Interfaz ----------
  RD.toast = (msg, type = 'ok', ms = 3200) => {
    let box = document.getElementById('toasts');
    if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.appendChild(box); }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
  };
  RD.openModal = (title, html, opts = {}) => {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3>${RD.esc(title)}</h3><button class="icon-btn" data-close aria-label="Cerrar">✕</button></div><div class="modal-body">${html}</div></div>`;
    document.body.appendChild(back);
    document.body.classList.add('no-scroll');
    const close = () => { back.remove(); if (!document.querySelector('.modal-back')) document.body.classList.remove('no-scroll'); opts.onClose && opts.onClose(); };
    back.addEventListener('click', e => { if (e.target === back && !opts.sticky) close(); if (e.target.closest('[data-close]')) close(); });
    return { el: back.querySelector('.modal-body'), root: back, close };
  };
  RD.confirm = (title, text, okLabel = 'Confirmar', danger = false) => new Promise(resolve => {
    const m = RD.openModal(title, `<p>${RD.esc(text)}</p><div class="row end gap"><button class="btn ghost" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${RD.esc(okLabel)}</button></div>`, { onClose: () => resolve(false) });
    m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
    m.el.querySelector('[data-yes]').onclick = () => { m.root.remove(); document.body.classList.remove('no-scroll'); resolve(true); };
  });
  RD.prompt = (title, label, placeholder = '') => new Promise(resolve => {
    const m = RD.openModal(title, `<label class="field"><span>${RD.esc(label)}</span><input id="pr-in" placeholder="${RD.esc(placeholder)}" autofocus></label><div class="row end gap"><button class="btn ghost" data-no>Cancelar</button><button class="btn primary" data-yes>Aceptar</button></div>`, { onClose: () => resolve(null) });
    const inp = m.el.querySelector('#pr-in'); inp.focus();
    const done = v => { m.root.remove(); document.body.classList.remove('no-scroll'); resolve(v); };
    m.el.querySelector('[data-no]').onclick = () => done(null);
    m.el.querySelector('[data-yes]').onclick = () => done(inp.value.trim() || null);
    inp.onkeydown = e => { if (e.key === 'Enter') done(inp.value.trim() || null); };
  });
  RD.busy = async (btn, fn) => {
    if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = 'Procesando…'; }
    try { return await fn(); } finally { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; } }
  };

  // ---------- Sonidos ----------
  let actx;
  RD.beep = (kind) => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const seq = { ok: [[880, .12]], warn: [[660, .12], [660, .12]], denied: [[220, .35], [180, .45]], tick: [[1000, .05]], done: [[880, .15], [1175, .25]] }[kind] || [];
      let t = actx.currentTime;
      seq.forEach(([f, d]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.type = kind === 'denied' ? 'sawtooth' : 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.06;
      });
      if (kind === 'denied' && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch { }
  };

  // ---------- QR ----------
  RD.qrSvg = (text, { margin = 2, fg = '#000', bg = '#fff' } = {}) => {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(); let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + margin} ${r + margin}h1v1h-1z`;
    const s = n + margin * 2;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" shape-rendering="crispEdges"><rect width="${s}" height="${s}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
  };

  // Firma HMAC igual que el servidor
  const enc = new TextEncoder();
  const keyCache = new Map();
  RD.hmac = async (key, msg) => {
    let k = keyCache.get(key);
    if (!k) { k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); keyCache.set(key, k); }
    const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
    return Array.from(sig).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  };
  // ---------- Parseo de códigos para lector 2D (Socio, Pase Diario, Código de Barras Tienda) ----------
  RD.parsePayload = text => {
    const s = String(text || '').trim();
    if (!s) return null;
    // Socio formal firmado: RD1.RD-0001.P1.xxxx o RD1.RD-0001.Dxxx.xxxx
    const m = /^RD1\.(RD-\d{1,8})\.([PD])(\d+)\.([0-9a-f]{12})$/.exec(s);
    if (m) return { type: 'member', code: m[1], kind: m[2], n: Number(m[3]), sig: m[4] };

    // Pase diario firmado: RD1.DAY.RD-DAY-xxxx.2026-10-12.xxxx
    const d = /^RD1\.DAY\.(RD-DAY-[A-Za-z0-9\-]+)\.(\d{4}-\d{2}-\d{2})\.([0-9a-f]{12})$/.exec(s);
    if (d) return { type: 'daily', code: d[1], day: d[2], sig: d[3] };

    // Pase diario directo: RD-DAY-xxxx
    if (/^RD-DAY-[A-Za-z0-9\-]+$/i.test(s)) return { type: 'daily_code', code: s.toUpperCase() };

    // Socio directo: RD-0001 o RD0001
    const mc = /^(RD-?\d{1,8})$/i.exec(s);
    if (mc) return { type: 'member_code', code: mc[1].toUpperCase().replace(/^RD(?=\d)/, 'RD-') };

    // Código de barras de producto de la tienda (EAN-13, UPC, Code 128: 4 a 20 caracteres)
    if (/^[0-9A-Za-z\-]{4,20}$/.test(s)) return { type: 'barcode', code: s };

    return null;
  };
  RD.digitalPayload = async (code, key) => {
    const n = Math.floor(RD.now() / 60000);
    return `RD1.${code}.D${n}.${await RD.hmac(key, `${code}|D${n}`)}`;
  };

  // ---------- Generador de Boletas / Tickets (Térmico 58mm/80mm y WhatsApp) ----------
  RD.waReceiptText = (r) => {
    return [
      `🏋️ *${r.gym?.name || 'RD FITNESS CLUB'}*`,
      `📍 ${r.gym?.address || 'Chivay, Colca'}`,
      `📞 Cel: ${r.gym?.phone || '982404043'}`,
      `--------------------------------`,
      `🧾 *COMPROBANTE:* ${r.receipt_no}`,
      `📅 *Fecha:* ${RD.fmtDateTime(r.date || new Date().toISOString())}`,
      `👤 *Cliente:* ${r.client?.name || 'Cliente'}${r.client?.doc ? ` (Doc: ${r.client.doc})` : ''}`,
      `--------------------------------`,
      `*Detalle:*`,
      `• ${r.concept}: ${RD.money(r.amount)}`,
      r.validity ? `  _${r.validity}_` : '',
      `--------------------------------`,
      `💰 *TOTAL PAGADO:* ${RD.money(r.amount)}`,
      `💳 *Método:* ${(r.method || 'Efectivo').toUpperCase()}${r.op_code ? ` (Op: #${r.op_code})` : ''}`,
      r.is_daily_pass ? `\n🎟️ *PASE DIARIO:* Válido para reingreso hoy mostrando este comprobante o su QR en la puerta.` : '',
      `\n💪 _${r.gym?.slogan || 'Disciplina · Constancia · Resultados'}_`,
      `¡Gracias por tu preferencia!`
    ].filter(Boolean).join('\n');
  };

  RD.receiptModal = (r) => {
    const waText = RD.waReceiptText(r);
    const waUrl = RD.waLink(r.client?.phone, waText);
    const qrSvg = r.qr_payload ? RD.qrSvg(r.qr_payload, { margin: 1 }) : null;

    const modal = RD.openModal('🧾 Comprobante de Pago', `
      <div class="receipt-wrap" id="rprint">
        <div class="receipt-ticket">
          <div class="r-center r-bold" style="font-size:1.15rem">${RD.esc(r.gym?.name || 'RD FITNESS CLUB')}</div>
          <div class="r-center r-small muted">${RD.esc(r.gym?.slogan || '')}</div>
          <div class="r-center r-small">${RD.esc(r.gym?.address || '')}</div>
          <div class="r-center r-small">RUC: ${RD.esc(r.gym?.ruc || '10702548911')} · Cel: ${RD.esc(r.gym?.phone || '982404043')}</div>
          <div class="r-line">================================</div>
          <div class="r-row"><span class="r-bold">BOLETA:</span> <span class="r-bold">${RD.esc(r.receipt_no)}</span></div>
          <div class="r-row"><span>FECHA:</span> <span>${RD.fmtDateTime(r.date || new Date().toISOString())}</span></div>
          <div class="r-row"><span>CLIENTE:</span> <span>${RD.esc(r.client?.name || 'Cliente')}</span></div>
          ${r.client?.doc ? `<div class="r-row"><span>DOC / CÓDIGO:</span> <span>${RD.esc(r.client.doc)}</span></div>` : ''}
          <div class="r-line">--------------------------------</div>
          <div class="r-row r-bold"><span>CONCEPTO</span><span>IMPORTE</span></div>
          <div class="r-row"><span>${RD.esc(r.concept)}</span><span>${RD.money(r.amount)}</span></div>
          ${r.validity ? `<div class="r-small muted" style="padding-left:4px">${RD.esc(r.validity)}</div>` : ''}
          <div class="r-line">--------------------------------</div>
          <div class="r-row r-bold" style="font-size:1.1rem"><span>TOTAL:</span><span>${RD.money(r.amount)}</span></div>
          <div class="r-row"><span>FORMA DE PAGO:</span><span class="r-bold">${RD.esc((r.method || 'efectivo').toUpperCase())}</span></div>
          ${r.op_code ? `<div class="r-row"><span>N° OPERACIÓN:</span><span class="r-bold">#${RD.esc(r.op_code)}</span></div>` : ''}
          <div class="r-row r-small muted"><span>ATENDIDO POR:</span><span>${RD.esc(r.user_name || 'Recepción')}</span></div>
          ${qrSvg ? `
            <div class="r-line">--------------------------------</div>
            <div class="r-center r-small r-bold">QR DE ACCESO / REINGRESO HOY:</div>
            <div class="r-center mt mb" style="max-width:140px;margin:8px auto">${qrSvg}</div>
            <div class="r-center r-tiny muted">Presenta este QR en el escáner al entrar</div>
          ` : ''}
          <div class="r-line">================================</div>
          <div class="r-center r-small r-bold">¡DISCIPLINA · CONSTANCIA · RESULTADOS!</div>
          <div class="r-center r-tiny muted">¡Gracias por entrenar con nosotros!</div>
        </div>
      </div>
      <div class="grid g2 mt gap no-print">
        <button class="btn primary" id="btnprint">🖨️ Imprimir Ticket (58mm / 80mm)</button>
        ${waUrl ? `<a class="btn ok" target="_blank" rel="noopener" href="${waUrl}">📲 Enviar por WhatsApp</a>` : `<button class="btn ok" id="btnwa">📲 Enviar por WhatsApp</button>`}
      </div>
    `, { wide: false });

    modal.el.querySelector('#btnprint').onclick = () => {
      window.print();
    };
    const bwa = modal.el.querySelector('#btnwa');
    if (bwa) {
      bwa.onclick = async () => {
        const ph = await RD.prompt('WhatsApp del cliente', 'Número de WhatsApp (9 dígitos)', '9XXXXXXXX');
        if (ph) {
          const u = RD.waLink(ph, waText);
          if (u) window.open(u, '_blank');
        }
      };
    }
  };

  RD.registerSW = () => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { }); };
  RD.GROUP_ICON = { Piernas: '🦵', Glúteos: '🍑', Pecho: '💪', Espalda: '🧗', Hombros: '🏋️', Bíceps: '💪', Tríceps: '💪', Core: '🔥', Cardio: '🏃', Movilidad: '🧘', Otros: '⭐' };
})();
