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

    // Membresía pagada con inicio diferido / programado
    if (m.start && m.start > today) {
      const daysToStart = RD.diffDays(m.start, today);
      return {
        level: 'denied',
        reason: `Inicia el ${RD.fmtDate(m.start)} (en ${daysToStart} d)`,
        daysLeft: RD.diffDays(m.end, today),
        scheduled: true,
        startsIn: daysToStart
      };
    }

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

  RD.downloadAuth = async (url, defaultFilename = 'descarga') => {
    const t = localStorage.getItem('rd_staff_token') || localStorage.getItem('rd_user_token');
    const headers = {};
    if (t) headers.Authorization = 'Bearer ' + t;
    const fetchUrl = url.startsWith('/') ? (url.startsWith('/api') ? url : '/api' + url) : '/api/' + url;
    const res = await fetch(fetchUrl, { headers });
    if (!res.ok) {
      let errText = 'Error ' + res.status;
      try { const j = await res.json(); if (j && j.error) errText = j.error; } catch { }
      throw new Error(errText);
    }
    let filename = defaultFilename;
    const cd = res.headers.get('content-disposition');
    if (cd) {
      const m = cd.match(/filename\*?=['"]?(?:UTF-8'')?([^'";\n]+)['"]?/i);
      if (m && m[1]) filename = decodeURIComponent(m[1].trim());
    }
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(blobUrl); }, 1000);
    return filename;
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

  // ---------- Generador de Payload Interoperable Yape / Plin (BCRP / EMVCo MPM) ----------
  function tlv(id, value) {
    const v = String(value ?? '');
    const len = String(v.length).padStart(2, '0');
    return `${id}${len}${v}`;
  }
  function crc16Ccitt(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= (str.charCodeAt(i) << 8);
      for (let j = 0; j < 8; j++) {
        if ((crc & 0x8000) !== 0) {
          crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
        } else {
          crc = (crc << 1) & 0xFFFF;
        }
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  RD.buildYapeQrPayload = ({ phone = '982404043', amount = 0, merchant = 'RD FITNESS CLUB', city = 'CHIVAY', concept = '' } = {}) => {
    const cleanPhone = String(phone).replace(/\D/g, '');
    const sub26 = tlv('00', 'pe.bcrp.qr') + tlv('01', cleanPhone);
    let payload = '';
    payload += tlv('00', '01');
    payload += tlv('01', amount > 0 ? '12' : '11');
    payload += tlv('26', sub26);
    payload += tlv('52', '7997');
    payload += tlv('53', '604');
    if (amount > 0) {
      payload += tlv('54', Number(amount).toFixed(2));
    }
    payload += tlv('58', 'PE');
    payload += tlv('59', merchant.slice(0, 25).toUpperCase());
    payload += tlv('60', city.slice(0, 15).toUpperCase());
    if (concept) {
      payload += tlv('62', tlv('01', concept.slice(0, 20)));
    }
    payload += '6304';
    return payload + crc16Ccitt(payload);
  };

  // Sincronizar estado con la pantalla del cliente / tablet
  RD.setCustomerDisplay = async (state) => {
    try {
      if (RD.api) await RD.api.post('/screen/state', state);
      else await fetch('/api/screen/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) });
    } catch { }
  };

  // Modal de cobro dinámico Yape / Plin con QR y monto pre-cargado
  RD.yapePaymentModal = ({ amount = 0, concept = 'Pago RD Fitness', phone = '982404043', name = 'RD FITNESS CLUB', onPaid } = {}) => {
    const payload = RD.buildYapeQrPayload({ phone, amount, merchant: name, concept });
    const qrSvg = RD.qrSvg(payload, { margin: 1 });

    // Notificar pantalla del cliente
    RD.setCustomerDisplay({
      mode: 'payment',
      title: concept,
      amount: amount,
      merchant: name,
      phone: phone,
      qr_payload: payload
    }).catch(() => {});

    const modal = RD.openModal('🟣 Cobro Yape / Plin con QR', `
      <div class="center">
        <div style="font-size:0.85rem;color:#c084fc;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
          YAPE · PLIN · INTEROPERABLE
        </div>
        <div style="font-size:2.3rem;font-weight:900;color:var(--gold);line-height:1.1;margin-bottom:4px">
          ${RD.money(amount)}
        </div>
        <div class="small muted mb" style="max-width:320px;margin:0 auto 10px">
          ${RD.esc(concept)}
        </div>

        <div style="background:#fff;border-radius:12px;padding:12px;max-width:230px;margin:0 auto 12px;box-shadow:0 4px 16px rgba(0,0,0,0.2)">
          ${qrSvg}
          <div style="color:#111;font-size:0.75rem;font-weight:700;margin-top:6px;letter-spacing:0.5px">
            MONTO EXACTO: ${RD.money(amount)}
          </div>
        </div>

        <div class="banner ok small mb" style="text-align:left;line-height:1.4">
          📱 <b>Monto pre-cargado:</b> Al escanear este QR con Yape o Plin desde su celular, <b>se cargará automáticamente S/ ${(Number(amount) || 0).toFixed(2)}</b> a nombre de <b>${RD.esc(name)}</b> sin tener que tipear el número ni el monto.
        </div>

        <div class="row center gap wrap mb">
          <span class="badge info" style="font-size:0.82rem">Titular: ${RD.esc(name)}</span>
          <span class="badge" style="font-size:0.82rem;font-family:monospace">Cel: ${phone}</span>
          <button type="button" class="btn sm ghost" id="btncopyphone">📋 Copiar N°</button>
        </div>

        <div class="box" style="background:var(--bg2);padding:10px;border-radius:8px;text-align:left">
          <label class="field" style="margin:0">
            <span style="font-weight:700">N° de Operación Yape/Plin (verificar en celular de caja):</span>
            <input id="modal_op_code" placeholder="Ej. 748291" inputmode="numeric" autofocus style="font-size:1.1rem;font-weight:700;letter-spacing:1px">
          </label>
        </div>

        <div class="grid g2 mt gap">
          <button type="button" class="btn ghost" id="btncan">Cancelar</button>
          <button type="button" class="btn primary" id="btnconfirm">✔ Confirmar Cobro</button>
        </div>
      </div>
    `, { wide: false, sticky: true, onClose: () => {
      RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
    }});

    const copyBtn = modal.el.querySelector('#btncopyphone');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard?.writeText(phone);
        RD.toast('Número copiado: ' + phone);
      };
    }

    const opInp = modal.el.querySelector('#modal_op_code');
    const confirmBtn = modal.el.querySelector('#btnconfirm');
    const cancelBtn = modal.el.querySelector('#btncan');

    cancelBtn.onclick = () => modal.close();

    const doConfirm = () => {
      const op = opInp.value.trim();
      modal.close();
      RD.setCustomerDisplay({
        mode: 'success',
        title: '¡Pago Confirmado!',
        amount: amount,
        concept: concept
      }).catch(() => {});
      setTimeout(() => {
        RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
      }, 5000);
      onPaid && onPaid(op);
    };

    confirmBtn.onclick = doConfirm;
    opInp.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
  };

  // Modal de cobro con tarjeta en terminal POS físico (Izipay / Niubiz)
  RD.cardPaymentModal = ({ amount = 0, concept = 'Pago RD Fitness', onPaid } = {}) => {
    // Notificar pantalla del cliente
    RD.setCustomerDisplay({
      mode: 'card',
      method: 'tarjeta',
      title: concept,
      amount: amount
    }).catch(() => {});

    const modal = RD.openModal('💳 Cobro con Tarjeta (POS Físico)', `
      <div class="center">
        <div style="font-size:0.85rem;color:#38bdf8;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
          IZIPAY · NIUBIZ · VISA · MASTERCARD · CONTACTLESS
        </div>
        <div style="font-size:2.3rem;font-weight:900;color:var(--gold);line-height:1.1;margin-bottom:4px">
          ${RD.money(amount)}
        </div>
        <div class="small muted mb" style="max-width:320px;margin:0 auto 10px">
          ${RD.esc(concept)}
        </div>

        <div class="box mb" style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:14px;text-align:left">
          <div class="small bold" style="color:#38bdf8;margin-bottom:6px">📋 Pasos en recepción:</div>
          <ol class="small" style="margin:0;padding-left:18px;line-height:1.5;color:#e2e8f0">
            <li>Digita <b>${RD.money(amount)}</b> en el teclado de tu máquina POS física.</li>
            <li>Pide al cliente que acerque su tarjeta <b>Contactless</b> o la inserte con chip (y digite su PIN si lo solicita).</li>
            <li>Al aprobarse, el POS imprimirá el voucher. Escribe abajo el <b>N° de Referencia / Operación</b>.</li>
          </ol>
        </div>

        <div class="box" style="background:var(--bg2);padding:10px;border-radius:8px;text-align:left">
          <label class="field" style="margin:0">
            <span style="font-weight:700">N° de Referencia / Voucher del POS (Izipay / Niubiz):</span>
            <input id="modal_card_ref" placeholder="Ej. Ref #041289" autofocus style="font-size:1.1rem;font-weight:700;letter-spacing:1px">
            <small class="muted" style="display:block;margin-top:4px">Aparece en el voucher impreso como "REF", "N° OPE" o "APROBACIÓN".</small>
          </label>
        </div>

        <div class="grid g2 mt gap">
          <button type="button" class="btn ghost" id="btncancard">Cancelar</button>
          <button type="button" class="btn primary" id="btnconfirmcard">✔ Confirmar Cobro POS</button>
        </div>
      </div>
    `, { wide: false, sticky: true, onClose: () => {
      RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
    }});

    const refInp = modal.el.querySelector('#modal_card_ref');
    const confirmBtn = modal.el.querySelector('#btnconfirmcard');
    const cancelBtn = modal.el.querySelector('#btncancard');

    cancelBtn.onclick = () => modal.close();

    const doConfirm = () => {
      const ref = refInp.value.trim() || 'POS-' + Math.floor(Date.now() % 1000000);
      modal.close();
      RD.setCustomerDisplay({
        mode: 'success',
        title: '¡Pago Aprobado!',
        amount: amount,
        concept: concept
      }).catch(() => {});
      setTimeout(() => {
        RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
      }, 5000);
      onPaid && onPaid(ref);
    };

    confirmBtn.onclick = doConfirm;
    refInp.onkeydown = e => { if (e.key === 'Enter') doConfirm(); };
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

  RD.shiftTicketModal = (data) => {
    const s = data.shift || {};
    const t = data.totals || {};
    const settings = data.settings || {};
    const diff = Number(s.diff_cash ?? data.diff_cash ?? 0);
    let diffLabel = '✔ CUADRADO EXACTO (S/ 0.00)';
    let diffClass = 'ok';
    if (diff > 0) {
      diffLabel = `🟢 SOBRANTE EN CAJA: +${RD.money(diff)}`;
      diffClass = 'ok';
    } else if (diff < 0) {
      diffLabel = `🔴 FALTANTE EN CAJA: -${RD.money(Math.abs(diff))}`;
      diffClass = 'bad';
    }

    const modal = RD.openModal('🧾 Acta de Cierre de Turno', `
      <div class="receipt-wrap" id="rprint">
        <div class="receipt-ticket">
          <div class="r-center r-bold" style="font-size:1.15rem">${RD.esc(settings.gym_name || 'RD FITNESS CLUB')}</div>
          <div class="r-center r-small muted">${RD.esc(settings.gym_slogan || 'Disciplina · Constancia · Resultados')}</div>
          <div class="r-center r-small">${RD.esc(settings.gym_address || 'Calle Antonio José de Sucre Lt. 10, Chivay')}</div>
          <div class="r-center r-small">RUC: ${RD.esc(settings.gym_ruc || '10702548911')} · Cel: ${RD.esc(settings.gym_phone || '982404043')}</div>
          <div class="r-line">================================</div>
          <div class="r-center r-bold" style="font-size:1.05rem">ACTA DE CIERRE DE TURNO</div>
          <div class="r-center r-small r-bold">ARQUEO DE CAJA FÍSICA Y DIGITAL</div>
          <div class="r-line">--------------------------------</div>
          <div class="r-row"><span class="r-bold">TURNO:</span> <span>#${s.id} - ${RD.esc(s.shift_name || 'General')}</span></div>
          <div class="r-row"><span>CAJERO(A):</span> <span class="r-bold">${RD.esc(s.user_name || 'Personal')}</span></div>
          <div class="r-row"><span>FECHA:</span> <span>${s.day}</span></div>
          <div class="r-row"><span>APERTURA:</span> <span>${RD.fmtDateTime(s.opened_at)}</span></div>
          <div class="r-row"><span>CIERRE:</span> <span>${RD.fmtDateTime(s.closed_at || new Date().toISOString())}</span></div>
          <div class="r-line">================================</div>
          <div class="r-center r-small r-bold">1. MOVIMIENTO DE EFECTIVO (CAJÓN)</div>
          <div class="r-line">--------------------------------</div>
          <div class="r-row"><span>(+) Fondo inicial (Vuelto):</span> <span>${RD.money(s.initial_cash || 0)}</span></div>
          <div class="r-row"><span>(+) Cobros Gym (Efectivo):</span> <span>${RD.money(t.gymCash || 0)}</span></div>
          <div class="r-row"><span>(+) Cobros Tienda (Efectivo):</span> <span>${RD.money(t.storeCash || 0)}</span></div>
          <div class="r-row"><span>(-) Gastos en Efectivo:</span> <span class="bad">-${RD.money(t.cashExpenses || 0)}</span></div>
          <div class="r-line">--------------------------------</div>
          <div class="r-row r-bold" style="font-size:1.05rem">
            <span>EFECTIVO ESPERADO:</span>
            <span>${RD.money(s.expected_cash || t.expectedCashInDrawer || 0)}</span>
          </div>
          <div class="r-row r-bold" style="font-size:1.05rem">
            <span>EFECTIVO CONTADO:</span>
            <span style="color:#2563eb">${RD.money(s.actual_cash || 0)}</span>
          </div>
          <div class="r-line">--------------------------------</div>
          <div class="r-center r-bold ${diffClass}" style="font-size:1rem;padding:4px 0">${diffLabel}</div>
          <div class="r-line">================================</div>
          <div class="r-center r-small r-bold">2. COBROS DIGITALES (VERIFICAR EN APPS)</div>
          <div class="r-line">--------------------------------</div>
          <div class="r-row"><span>🟣 Yape:</span> <span>${RD.money(t.digitalBreakdown?.yape || 0)}</span></div>
          <div class="r-row"><span>🔵 Plin:</span> <span>${RD.money(t.digitalBreakdown?.plin || 0)}</span></div>
          <div class="r-row"><span>💳 Tarjeta POS (Izipay / Niubiz):</span> <span>${RD.money(t.digitalBreakdown?.card || 0)}</span></div>
          <div class="r-row"><span>🏦 Transferencias Bancarias:</span> <span>${RD.money(t.digitalBreakdown?.transfer || 0)}</span></div>
          <div class="r-line">--------------------------------</div>
          <div class="r-row r-bold"><span>TOTAL DIGITAL ESPERADO:</span> <span>${RD.money(s.expected_digital || t.expectedDigital || 0)}</span></div>
          <div class="r-line">================================</div>
          <div class="r-row"><span>TOTAL INGRESOS TURNO:</span> <span class="r-bold">${RD.money(t.totalIncome || 0)}</span></div>
          <div class="r-row"><span>N° OPERACIONES:</span> <span>${t.paymentsCount || 0} cobros</span></div>
          ${s.notes ? `
          <div class="r-line">--------------------------------</div>
          <div class="r-small"><b>OBSERVACIONES:</b> ${RD.esc(s.notes)}</div>
          ` : ''}
          <div class="r-line">================================</div>
          <br><br>
          <div class="r-center" style="font-size:.75rem">_____________________________<br>FIRMA DEL CAJERO(A)<br>${RD.esc(s.user_name || '')}</div>
          <br><br>
          <div class="r-center" style="font-size:.75rem">_____________________________<br>CONFORMIDAD ADMINISTRACIÓN<br>RD FITNESS CLUB</div>
        </div>
      </div>
      <div class="row end gap mt no-print">
        <button class="btn primary" id="btnprintshift">🖨️ Imprimir Acta / Ticket</button>
      </div>
    `, { wide: false });

    modal.el.querySelector('#btnprintshift').onclick = () => {
      window.print();
    };
  };

  RD.registerSW = () => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { }); };
  RD.GROUP_ICON = { Piernas: '🦵', Glúteos: '🍑', Pecho: '💪', Espalda: '🧗', Hombros: '🏋️', Bíceps: '💪', Tríceps: '💪', Core: '🔥', Cardio: '🏃', Movilidad: '🧘', Otros: '⭐' };

  // ---------- Sistema de Tema (Claro / Oscuro) ----------
  RD.getTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  RD.setTheme = (theme, notify = false) => {
    const isLight = theme === 'light';
    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('rd_theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('rd_theme', 'dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isLight ? '#FAF7FA' : '#0b0b0d');

    document.querySelectorAll('[data-theme-toggle], #themetoggle, #appthemetoggle, .theme-toggle').forEach(btn => {
      btn.innerHTML = isLight ? '🌙' : '☀️';
      btn.title = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro (Pastel)';
    });

    if (notify) {
      RD.toast(isLight ? '☀️ Modo Claro activado (Paleta Pastel)' : '🌙 Modo Oscuro activado');
    }
  };

  RD.toggleTheme = () => {
    const current = RD.getTheme();
    RD.setTheme(current === 'light' ? 'dark' : 'light', true);
  };

  RD.initTheme = () => {
    const saved = localStorage.getItem('rd_theme');
    if (saved === 'light') {
      RD.setTheme('light', false);
    } else {
      RD.setTheme('dark', false);
    }
  };

  RD.initTheme();
})();
