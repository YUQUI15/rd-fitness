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

  // ---------- Biblioteca de Iconos SVG Profesionales (Cero Emojis Triviales) ----------
  const ICONS = {
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1.5"/><line x1="7" y1="12" x2="17" y2="12"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    cash: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="12" cy="15" r="1.5"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    plans: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="m16 15 2-2 3 3"/>',
    store: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    announcements: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key: '<path d="m21 2-2 2m-1.5 1.5L14 9l-4-4-6 6a3 3 0 0 0 4.24 4.24l6-6 4 4 3.5-3.5"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    snowflake: '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    nfc: '<path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    whatsapp: '<path d="M17.47 14.38c-.3-.15-1.78-.88-2.06-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.95 1.18-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35z"/><path d="M20.52 3.48A11.93 11.93 0 0 0 12.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.17 1.6 5.98L0 24l6.21-1.63a11.94 11.94 0 0 0 5.85 1.52h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-.12-6.22-3.52-8.44z"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    expense: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>'
  };

  RD.icon = (name, cls = '', size = 18) => {
    const body = ICONS[name] || ICONS.check;
    const c = cls ? `class="svg-icon ${cls}"` : 'class="svg-icon"';
    return `<svg ${c} viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  };

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
    while (box.children.length >= 2) {
      box.firstElementChild.remove();
    }
    const t = document.createElement('div');
    t.className = 'toast ' + type;
    t.textContent = msg;
    t.style.cursor = 'pointer';
    t.title = 'Toca para cerrar';
    t.onclick = () => { t.classList.add('out'); setTimeout(() => t.remove(), 200); };
    box.appendChild(t);
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

  // ---------- Sonidos y Alertas Táctiles (Dual-Engine: HTML5 Audio Blob + Web Audio) ----------
  let actx = null;
  const ensureAudio = () => {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx && actx.state === 'suspended') actx.resume().catch(() => {});
    } catch {}
    return actx;
  };

  // Genera un audio WAV PCM puro en memoria (Blob URL) con timbre de campana armónica
  let chimeBlobUrl = null;
  function getChimeBlobUrl() {
    if (chimeBlobUrl) return chimeBlobUrl;
    try {
      const sampleRate = 22050;
      const duration = 0.85;
      const numSamples = Math.floor(sampleRate * duration);
      const wavBytes = new Uint8Array(44 + numSamples * 2);
      const view = new DataView(wavBytes.buffer);

      view.setUint32(0, 0x52494646, false); // "RIFF"
      view.setUint32(4, 36 + numSamples * 2, true);
      view.setUint32(8, 0x57415645, false); // "WAVE"
      view.setUint32(12, 0x666d7420, false); // "fmt "
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      view.setUint32(36, 0x64617461, false); // "data"
      view.setUint32(40, numSamples * 2, true);

      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const decay = Math.exp(-4.2 * t);
        const s = (Math.sin(2 * Math.PI * 880 * t) * 0.5 +
                   Math.sin(2 * Math.PI * 1108.73 * t) * 0.3 +
                   Math.sin(2 * Math.PI * 1318.51 * t) * 0.35 +
                   Math.sin(2 * Math.PI * 1760 * t) * 0.2) * decay;
        const val = Math.max(-1, Math.min(1, s * 0.85));
        view.setInt16(44 + i * 2, val < 0 ? val * 0x8000 : val * 0x7FFF, true);
      }
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      chimeBlobUrl = URL.createObjectURL(blob);
      return chimeBlobUrl;
    } catch {
      return null;
    }
  }

  let chimeAudio = null;
  const getChimeAudio = () => {
    if (!chimeAudio) {
      try {
        const url = getChimeBlobUrl();
        if (url) {
          chimeAudio = new Audio(url);
          chimeAudio.volume = 1.0;
        }
      } catch {}
    }
    return chimeAudio;
  };

  // Desbloqueo activo en móviles en cualquier toque o clic
  let audioUnlocked = false;
  const unlockAudio = () => {
    try {
      ensureAudio();
      const a = getChimeAudio();
      if (a && !audioUnlocked) {
        a.volume = 0.001;
        const p = a.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            a.pause();
            a.currentTime = 0;
            a.volume = 1.0;
            audioUnlocked = true;
          }).catch(() => {});
        }
      }
    } catch {}
  };
  ['click', 'touchstart', 'touchend', 'pointerdown'].forEach(ev => {
    window.addEventListener(ev, unlockAudio, { passive: true });
  });

  RD.beep = (kind) => {
    try {
      const ctx = ensureAudio();
      if (!ctx) return;
      const seq = {
        ok: [[880, .12]],
        warn: [[660, .12], [660, .12]],
        denied: [[220, .35], [180, .45]],
        tick: [[1000, .05]],
        done: [[880, .15], [1175, .25]],
        bell: [[523.25, .15], [659.25, .15], [783.99, .25], [1046.50, .4]]
      }[kind] || [];
      let t = ctx.currentTime;
      seq.forEach(([f, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = kind === 'denied' ? 'sawtooth' : kind === 'bell' ? 'triangle' : 'sine';
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(kind === 'bell' ? 0.7 : 0.4, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + d + 0.02); t += d + 0.05;
      });
      if ((kind === 'denied' || kind === 'bell') && navigator.vibrate) {
        navigator.vibrate(kind === 'bell' ? [300, 150, 300, 150, 450] : [200, 100, 200]);
      }
    } catch { }
  };

  RD.playNotificationAlert = (mode = 'sound') => {
    try {
      if (mode === 'silent') return;
      // 1. Vibración táctil física distintiva
      if (navigator.vibrate) {
        try {
          navigator.vibrate(mode === 'vibrate' ? [350, 150, 350, 150, 450] : [250, 120, 250, 120, 400]);
        } catch {}
      }
      if (mode === 'vibrate') return;

      // 2. Timbre acústico de alta claridad (Motor A: HTML5 Audio)
      try {
        const a = getChimeAudio();
        if (a) {
          a.currentTime = 0;
          a.volume = 1.0;
          const p = a.play();
          if (p && typeof p.then === 'function') {
            p.catch(() => { RD.beep('bell'); });
          }
        } else {
          RD.beep('bell');
        }
      } catch {
        RD.beep('bell');
      }

      // Motor B: Web Audio API Oscillator
      try { RD.beep('bell'); } catch {}
    } catch {}
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
      `\n📲 *Ver Comprobante Digital:* ${location.origin}/#receipt:${r.payment_id}`,
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

  RD.showReceipt = async (paymentId) => {
    try {
      const token = localStorage.getItem('rd_member_token') || localStorage.getItem('rd_staff_token') || localStorage.getItem('rd_token') || localStorage.getItem('rd_user_token');
      const res = await fetch(`/api/payments/${paymentId}/receipt`, {
        headers: token ? { Authorization: 'Bearer ' + token } : {}
      });
      if (!res.ok) {
        let msg = 'No se pudo cargar la boleta';
        try { const j = await res.json(); if (j?.error) msg = j.error; } catch {}
        throw new Error(msg);
      }
      const r = await res.json();
      RD.receiptModal(r);
    } catch (e) {
      RD.toast(e.message || 'No se pudo abrir el comprobante', 'err');
    }
  };

  RD.zoomImage = (src, title) => {
    if (!src) return;
    RD.openModal(title || 'Detalle de Imagen', `
      <div style="text-align:center;padding:8px 0">
        <img src="${RD.esc(src)}" style="max-width:100%;max-height:75vh;border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.45);object-fit:contain" alt="">
      </div>
      <div class="row end mt">
        <a class="btn primary sm" href="${RD.esc(src)}" target="_blank" rel="noopener">🔍 Ver tamaño completo</a>
      </div>
    `, { wide: true });
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
  RD.GROUP_ICON = { Piernas: '🦵', Glúteos: '🍑', Pecho: '💪', Espalda: '🧗', Hombros: '🏋️', Bíceps: '💪', Tríceps: '💪', Antebrazos: '🦾', Trapecio: '🦬', Core: '🔥', Cardio: '🏃', Movilidad: '🧘', Otros: '⭐' };

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
