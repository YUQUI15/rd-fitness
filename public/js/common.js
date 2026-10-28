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
    // Navegación & Acceso
    scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><rect x="7" y="7" width="10" height="10" rx="1.5"/><line x1="7" y1="12" x2="17" y2="12"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="3" height="3"/><rect x="18" y="14" width="3" height="3"/><rect x="14" y="18" width="3" height="3"/><rect x="18" y="18" width="3" height="3"/>',
    pass: '<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M6 16a2 2 0 0 1 4 0"/><line x1="14" y1="9" x2="18" y2="9"/><line x1="14" y1="13" x2="17" y2="13"/>',
    idcard: '<rect width="18" height="14" x="3" y="5" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M6 16a2 2 0 0 1 4 0"/><line x1="14" y1="9" x2="18" y2="9"/><line x1="14" y1="13" x2="17" y2="13"/>',
    barcode: '<path d="M3 5v14"/><path d="M8 5v14"/><path d="M12 5v14"/><path d="M17 5v14"/><path d="M21 5v14"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    profile: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',

    // Entrenamiento & Ejercicios
    train: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
    barbell: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="12" r="3"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="3" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="21" y2="12"/>',
    runner: '<circle cx="17" cy="4" r="2"/><path d="m15 8-3.5 3.5 2.5 2.5L18 11"/><path d="m9 11.5 2.5-2.5-3-3L4 9"/><path d="m10 17 3-3-2-2-4 4 1 5 4-1"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    fire: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    award: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    stopwatch: '<circle cx="12" cy="14" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="2" x2="14" y2="2"/>',
    timer: '<circle cx="12" cy="14" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="10" x2="12" y2="14"/><line x1="10" y1="2" x2="14" y2="2"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3"/>',
    pause: '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',

    // Progreso & Métricas
    progress: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    chart: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    ruler: '<path d="m15 5 4 4"/><path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L15.3 21.3a2.41 2.41 0 0 0 3.4 0l2.6-2.6a2.41 2.41 0 0 0 0-3.4L17 11"/><path d="m8 6 2-2"/><path d="m11 9 3-3"/><path d="m14 12 2-2"/>',

    // Herramientas & Calculadoras
    tools: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    calculator: '<rect width="16" height="20" x="4" y="2" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>',
    nutrition: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    apple: '<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
    sparkles: '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>',

    // Pagos, Caja y Tienda
    cash: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><circle cx="12" cy="15" r="1.5"/>',
    card: '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    plans: '<rect width="20" height="14" x="2" y="5" rx="2"/><path d="m16 15 2-2 3 3"/>',
    store: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    expense: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    receipt: '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="13" y2="15"/>',
    reports: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/>',

    // Notificaciones y Comunicación
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    'bell-ring': '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M22 8c0-2.3-.8-4.3-2-6"/><path d="M4 2C2.8 3.7 2 5.7 2 8"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
    announcements: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    party: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    tag: '<path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><circle cx="7" cy="7" r=".5" fill="currentColor"/>',
    wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
    'shield-alert': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',

    // Sistema & Utilidades
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>',
    key: '<path d="m21 2-2 2m-1.5 1.5L14 9l-4-4-6 6a3 3 0 0 0 4.24 4.24l6-6 4 4 3.5-3.5"/>',
    install: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/><path d="m9 10 3 3 3-3"/><path d="M12 6v7"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
    laptop: '<rect width="18" height="12" x="3" y="4" rx="2"/><line x1="2" y1="20" x2="22" y2="20"/>',
    monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
    sheet: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/>',
    printer: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    edit: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
    snowflake: '<path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07l14.14-14.14"/>',
    nfc: '<path d="M6 8.32a7.43 7.43 0 0 1 0 7.36"/><path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58"/><path d="M12.91 4.1a15.91 15.91 0 0 1 0 15.8"/><path d="M16.37 2a20.16 20.16 0 0 1 0 20"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    whatsapp: '<path d="M17.47 14.38c-.3-.15-1.78-.88-2.06-.98-.27-.1-.47-.15-.67.15-.2.3-.77.98-.95 1.18-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.58c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.78-.73 2.03-1.43.25-.7.25-1.3.17-1.43-.07-.12-.27-.2-.57-.35z"/><path d="M20.52 3.48A11.93 11.93 0 0 0 12.06 0C5.46 0 .09 5.37.09 11.97c0 2.11.55 4.17 1.6 5.98L0 24l6.21-1.63a11.94 11.94 0 0 0 5.85 1.52h.01c6.6 0 11.97-5.37 11.97-11.97 0-3.2-.12-6.22-3.52-8.44z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'map-pin': '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    'alert-triangle': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    power: '<path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 4.8 0 0 1 12 8a4.8 4.8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
    droplet: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    water: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>',
    bot: '<rect width="18" height="14" x="3" y="6" rx="2"/><circle cx="9" cy="13" r="1.5"/><circle cx="15" cy="13" r="1.5"/><path d="M12 2v4"/><line x1="2" y1="13" x2="3" y2="13"/><line x1="21" y1="13" x2="22" y2="13"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    pin: '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
    'volume-x': '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
    vibrate: '<path d="m2 8 2 2-2 2 2 2-2 2"/><path d="m22 8-2 2 2 2-2 2 2 2"/><rect width="8" height="14" x="8" y="5" rx="1"/>',
    wifi: '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    bank: '<line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="4" y1="10" x2="4" y2="21"/><line x1="20" y1="10" x2="20" y2="21"/><line x1="8" y1="14" x2="8" y2="17"/><line x1="12" y1="14" x2="12" y2="17"/><line x1="16" y1="14" x2="16" y2="17"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/>',
    cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
    'cloud-upload': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
    'cloud-download': '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/>',
    save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
    mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    door: '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"/><path d="M2 20h20"/><circle cx="14" cy="12" r="1"/>',
    login: '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    'badge-check': '<path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>',
    medal: '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    medical: '<path d="M12 6v12M6 12h12"/><rect width="18" height="18" x="3" y="3" rx="4"/>',
    'first-aid': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>',
    stethoscope: '<path d="M4.5 3v5a3.5 3.5 0 0 0 7 0V3"/><path d="M8 11.5v6.25a2.25 2.25 0 0 0 4.5 0V15"/><circle cx="12.5" cy="14.5" r="2.5"/><circle cx="4.5" cy="3" r="1.5"/><circle cx="11.5" cy="3" r="1.5"/>',
    flashlight: '<path d="M18 6c0 2-2 4-2 4v10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V10s-2-2-2-4 2-4 5-4h2c3 0 5 2 5 4z"/><line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="12" x2="12.01" y2="12"/>',
    'arrow-right': '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    'arrow-left': '<line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>',
    'arrow-up': '<line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>',
    'arrow-down': '<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    cake: '<path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><path d="M2 21h20"/><path d="M7 8v3"/><path d="M12 8v3"/><path d="M17 8v3"/>',
    bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
    hourglass: '<path d="M5 22h14"/><path d="M5 2h14"/><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"/><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/>',
    archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'
  };

  RD.icon = (name, cls = '', size = 18) => {
    const body = ICONS[name] || ICONS.check;
    const c = cls ? `class="svg-icon ${cls}"` : 'class="svg-icon"';
    return `<svg ${c} viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  };

  RD.iconBadge = (iconName, text, cls = '') => {
    return `<span class="badge ${cls}" style="display:inline-flex;align-items:center;gap:5px">${RD.icon(iconName, '', 14)}<span>${RD.esc(text)}</span></span>`;
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

  // ---------- Motor de Contingencia y Persistencia Local en la PC del Dueño (Modo Local / Offline-First) ----------
  const LOCAL_TX_KEY = 'rd_local_tx_queue_v1';
  const LOCAL_FORCE_KEY = 'rd_force_local_mode';
  const LOCAL_SYNC_TS_KEY = 'rd_local_last_sync_at';
  const LOCAL_WRITE_TS_KEY = 'rd_local_last_write_at';
  const LOCAL_SAVE_COUNT_KEY = 'rd_local_save_count';

  let localScreenBus = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      localScreenBus = new BroadcastChannel('rd_local_screen_bus');
    }
  } catch {}

  RD.localEngine = {
    isForced: () => localStorage.getItem(LOCAL_FORCE_KEY) === '1',
    setForced: (on) => {
      if (on) localStorage.setItem(LOCAL_FORCE_KEY, '1');
      else localStorage.removeItem(LOCAL_FORCE_KEY);
      window.dispatchEvent(new CustomEvent('rd:local-state'));
    },
    isLocalActive: () => RD.localEngine.isForced() || !navigator.onLine,
    getTxQueue: () => {
      try { return JSON.parse(localStorage.getItem(LOCAL_TX_KEY) || '[]'); } catch { return []; }
    },
    getStats: () => {
      const snap = (() => { try { return JSON.parse(localStorage.getItem('rd_snapshot') || 'null'); } catch { return null; } })();
      const scanQ = (() => { try { return JSON.parse(localStorage.getItem('rd_scanq') || '[]'); } catch { return []; } })();
      const txQ = RD.localEngine.getTxQueue();
      let storageKB = 0;
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          storageKB += ((k ? k.length : 0) + (localStorage.getItem(k) || '').length) * 2 / 1024;
        }
      } catch {}
      return {
        forced: RD.localEngine.isForced(),
        online: navigator.onLine,
        activeLocal: RD.localEngine.isLocalActive(),
        membersCached: snap?.members?.length || 0,
        pendingScans: scanQ.length,
        pendingTx: txQ.length,
        totalPending: scanQ.length + txQ.length,
        lastSyncAt: Number(localStorage.getItem(LOCAL_SYNC_TS_KEY) || snap?.at || 0),
        lastWriteAt: Number(localStorage.getItem(LOCAL_WRITE_TS_KEY) || 0),
        saveCount: Number(localStorage.getItem(LOCAL_SAVE_COUNT_KEY) || 0),
        storageKB: Math.round(storageKB * 10) / 10
      };
    },
    broadcastScreen: (payload) => {
      try {
        if (localScreenBus) localScreenBus.postMessage(payload);
        localStorage.setItem('rd_local_screen_event', JSON.stringify({ ...payload, _ts: Date.now() }));
      } catch {}
    },
    saveCache: (url, data) => {
      try {
        const cleanKey = 'rd_lcache_' + url.split('?')[0];
        localStorage.setItem(cleanKey, JSON.stringify(data));
        localStorage.setItem(LOCAL_SYNC_TS_KEY, String(Date.now()));
        const cnt = Number(localStorage.getItem(LOCAL_SAVE_COUNT_KEY) || 0) + 1;
        localStorage.setItem(LOCAL_SAVE_COUNT_KEY, String(cnt));
      } catch {}
    },
    readCache: (url) => {
      try {
        const cleanKey = 'rd_lcache_' + url.split('?')[0];
        const raw = localStorage.getItem(cleanKey);
        if (raw) return JSON.parse(raw);
      } catch {}
      // Fallbacks inteligentes si no había caché previo de esa ruta específica
      const base = url.split('?')[0];
      if (base === '/plans') {
        try { return JSON.parse(localStorage.getItem('rd_plans') || '[]'); } catch { return []; }
      }
      if (base === '/sync/members') {
        try { return JSON.parse(localStorage.getItem('rd_snapshot') || '{"members":[],"now":' + Date.now() + '}'); } catch { return { members: [], now: Date.now() }; }
      }
      if (base === '/members') {
        try {
          const snap = JSON.parse(localStorage.getItem('rd_snapshot') || 'null');
          return { members: snap?.members || [], total: (snap?.members || []).length };
        } catch { return { members: [], total: 0 }; }
      }
      if (base === '/cash/current') {
        try { return JSON.parse(localStorage.getItem('rd_lcache_/cash/current') || '{"open":null,"movements":[]}'); } catch { return { open: null, movements: [] }; }
      }
      return {};
    },
    recordLocalWrite: (method, url, body) => {
      const q = RD.localEngine.getTxQueue();
      const label = RD.localEngine.describeTx(method, url, body);
      const item = {
        id: RD.uid(),
        ts: new Date().toISOString(),
        method,
        url,
        body: body || {},
        label
      };
      q.push(item);
      try {
        localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(q));
        localStorage.setItem(LOCAL_WRITE_TS_KEY, String(Date.now()));
        const cnt = Number(localStorage.getItem(LOCAL_SAVE_COUNT_KEY) || 0) + 1;
        localStorage.setItem(LOCAL_SAVE_COUNT_KEY, String(cnt));
      } catch {}

      // Actualizar espejos locales para que la interfaz responda al instante en la PC del dueño
      try {
        if (url.startsWith('/screen/')) {
          RD.localEngine.broadcastScreen(body || {});
        } else if (url === '/cash/open' && method === 'POST') {
          const shift = {
            id: 'local_shift_' + Date.now(),
            opened_at: new Date().toISOString(),
            opening_amount: Number(body?.opening_amount || 0),
            notes: body?.notes || 'Abierto en Modo Local PC',
            opened_by_name: (JSON.parse(localStorage.getItem('rd_staff_user') || '{}').name) || 'Recepción (Modo Local)'
          };
          localStorage.setItem('rd_lcache_/cash/current', JSON.stringify({ open: shift, movements: [] }));
        } else if (url === '/cash/movement' && method === 'POST') {
          const cur = RD.localEngine.readCache('/cash/current') || { open: null, movements: [] };
          cur.movements = cur.movements || [];
          cur.movements.unshift({
            id: 'lmov_' + Date.now(),
            created_at: new Date().toISOString(),
            type: body?.type || 'in',
            category: body?.category || 'Otro',
            amount: Number(body?.amount || 0),
            method: body?.method || 'Efectivo',
            concept: body?.concept || 'Movimiento en Modo Local PC'
          });
          localStorage.setItem('rd_lcache_/cash/current', JSON.stringify(cur));
        } else if (url === '/members' && method === 'POST') {
          const newMem = {
            id: 'lmem_' + Date.now(),
            code: 'RD' + String(Math.floor(1000 + Math.random() * 9000)),
            name: String(body?.name || 'SOCIO LOCAL').toUpperCase(),
            dni: body?.dni || '',
            phone: body?.phone || '',
            status: 'active',
            start: RD.limaDay(),
            end: body?.end || RD.addDays(RD.limaDay(), 30),
            plan_name: body?.plan_name || 'Plan Mensual (Local)'
          };
          const snap = JSON.parse(localStorage.getItem('rd_snapshot') || '{"members":[]}');
          snap.members = snap.members || [];
          snap.members.unshift(newMem);
          localStorage.setItem('rd_snapshot', JSON.stringify(snap));
          const mcache = RD.localEngine.readCache('/members');
          if (mcache && Array.isArray(mcache.members)) {
            mcache.members.unshift(newMem);
            localStorage.setItem('rd_lcache_/members', JSON.stringify(mcache));
          }
          window.dispatchEvent(new CustomEvent('rd:local-state'));
          return { ok: true, member: newMem, _localSaved: true };
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('rd:local-state'));
      return { ok: true, _localSaved: true, txId: item.id, label };
    },
    describeTx: (method, url, body) => {
      if (url === '/members' && method === 'POST') return `Nuevo Socio: ${body?.name || 'Registro'}`;
      if (url.includes('/memberships') || url.includes('/renew')) return `Renovación / Membresía (${RD.money(body?.amount || body?.price || 0)})`;
      if (url.includes('/store/sale')) return `Venta en Tienda POS (${RD.money(body?.total || body?.amount || 0)})`;
      if (url === '/cash/open') return `Apertura de Caja (${RD.money(body?.opening_amount || 0)})`;
      if (url === '/cash/close') return `Cierre de Turno de Caja`;
      if (url === '/cash/movement') return `Movimiento de Caja: ${body?.concept || body?.category || ''} (${RD.money(body?.amount || 0)})`;
      if (url.startsWith('/screen/')) return `Señal enviada a Smart TV (${body?.mode || 'evento'})`;
      return `${method} ${url}`;
    },
    flushToCloud: async () => {
      if (!navigator.onLine) throw new Error('Aún no hay conexión a internet en esta PC.');
      const t = localStorage.getItem('rd_staff_token');
      const headers = { 'Content-Type': 'application/json' };
      if (t) headers.Authorization = 'Bearer ' + t;

      const q = RD.localEngine.getTxQueue();
      const remaining = [];
      let syncedCount = 0;
      for (const item of q) {
        if (item.url.startsWith('/screen/')) { syncedCount++; continue; }
        try {
          const res = await fetch('/api' + item.url, {
            method: item.method,
            headers,
            body: JSON.stringify(item.body)
          });
          if (res.ok || res.status === 400 || res.status === 409) {
            syncedCount++;
          } else {
            remaining.push(item);
          }
        } catch {
          remaining.push(item);
        }
      }
      localStorage.setItem(LOCAL_TX_KEY, JSON.stringify(remaining));
      localStorage.setItem(LOCAL_SYNC_TS_KEY, String(Date.now()));
      window.dispatchEvent(new CustomEvent('rd:local-state'));
      return { syncedCount, remainingCount: remaining.length };
    }
  };

  // ---------- API ----------
  RD.makeApi = (tokenKey, onAuthFail) => {
    const call = async (method, url, body) => {
      // Si es envío de pantalla a la TV, transmitir siempre por el Bus Local de la PC en 0.1ms
      if (url.startsWith('/screen/') && body) {
        RD.localEngine.broadcastScreen(body);
      }

      // Si el Modo Local en PC está activado manualmente por el usuario (excepto login)
      if (RD.localEngine.isForced() && !url.startsWith('/auth/')) {
        if (method === 'GET') {
          return RD.localEngine.readCache(url);
        } else {
          return RD.localEngine.recordLocalWrite(method, url, body);
        }
      }

      const headers = { 'Content-Type': 'application/json' };
      const t = localStorage.getItem(tokenKey);
      if (t) headers.Authorization = 'Bearer ' + t;
      let res;
      try {
        res = await fetch('/api' + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      } catch (e) {
        // Fallback automático a Modo Local en la PC del dueño si se cae el internet o la luz del router
        if (!url.startsWith('/auth/')) {
          if (method === 'GET') {
            return RD.localEngine.readCache(url);
          } else {
            const localRes = RD.localEngine.recordLocalWrite(method, url, body);
            if (RD.toast) RD.toast('💾 Sin internet: Guardado en la Memoria Local de esta PC', 'ok');
            return localRes;
          }
        }
        const err = new Error('Sin conexión con el servidor'); err.offline = true; throw err;
      }
      let data = null;
      try { data = await res.json(); } catch { }
      if (res.status === 401 && onAuthFail && !url.startsWith('/auth/')) { onAuthFail(); }
      if (!res.ok) { const err = new Error((data && data.error) || 'Error ' + res.status); err.status = res.status; err.data = data; throw err; }
      if (method === 'GET' && data !== null) {
        RD.localEngine.saveCache(url, data);
      }
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
  // Permite iconos vectoriales internos (<svg class="svg-icon"...>) dentro de títulos escapando cualquier otro texto
  RD.safeTitle = str => String(str ?? '')
    .split(/(<svg\s+class="svg-icon[^"]*"[^>]*>[\s\S]*?<\/svg>)/g)
    .map(part => /^<svg\s+class="svg-icon/.test(part) ? part : RD.esc(part))
    .join('');

  RD.LOGO_SVG = function (size = 54) {
    return `<svg viewBox="0 0 100 100" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle;flex-shrink:0">
      <defs>
        <linearGradient id="rdGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="rdDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <polygon points="50,4 92,20 84,72 50,96 16,72 8,20" fill="url(#rdDark)" stroke="url(#rdGold)" stroke-width="3.5" stroke-linejoin="round"/>
      <polygon points="50,11 85,25 78,68 50,88 22,68 15,25" fill="none" stroke="url(#rdGold)" stroke-width="1.2" opacity="0.6"/>
      <rect x="26" y="32" width="48" height="3.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="22" y="27" width="5" height="13.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="73" y="27" width="5" height="13.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="18" y="29.5" width="3" height="8.5" rx="1" fill="#fbbf24"/>
      <rect x="79" y="29.5" width="3" height="8.5" rx="1" fill="#fbbf24"/>
      <text x="50" y="62" font-family="'Impact', 'Arial Black', sans-serif" font-weight="900" font-size="25" fill="url(#rdGold)" text-anchor="middle" letter-spacing="1.5">RD</text>
      <text x="50" y="74" font-family="'Arial Black', sans-serif" font-weight="800" font-size="6" fill="#f8fafc" text-anchor="middle" letter-spacing="2">FITNESS CLUB</text>
      <polygon points="50,78 51.5,82 55.5,82 52.5,84 53.5,88 50,85.5 46.5,88 47.5,84 44.5,82 48.5,82" fill="url(#rdGold)"/>
      <polygon points="41,79 42,81.5 44.5,81.5 42.5,83 43.2,85.5 41,84 38.8,85.5 39.5,83 37.5,81.5 40,81.5" fill="url(#rdGold)" opacity="0.8"/>
      <polygon points="59,79 60,81.5 62.5,81.5 60.5,83 61.2,85.5 59,84 56.8,85.5 57.5,83 55.5,81.5 58,81.5" fill="url(#rdGold)" opacity="0.8"/>
    </svg>`;
  };

  RD.openModal = (title, html, opts = {}) => {
    const back = document.createElement('div'); back.className = 'modal-back';
    back.innerHTML = `<div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true"><div class="modal-head"><h3 style="display:flex;align-items:center;gap:8px">${RD.safeTitle(title)}</h3><button class="icon-btn" data-close aria-label="Cerrar">${RD.icon('x', '', 18)}</button></div><div class="modal-body">${html}</div></div>`;
    document.body.appendChild(back);
    document.body.classList.add('no-scroll');
    const close = () => { back.remove(); if (!document.querySelector('.modal-back')) document.body.classList.remove('no-scroll'); opts.onClose && opts.onClose(); };
    back.addEventListener('click', e => { if (e.target === back && !opts.sticky) close(); if (e.target.closest('[data-close]')) close(); });
    return { el: back.querySelector('.modal-body'), root: back, close };
  };
  RD.confirm = (title, text, okLabel = 'Confirmar', danger = false) => new Promise(resolve => {
    const m = RD.openModal(title, `<p>${RD.esc(text)}</p><div class="row end gap"><button class="btn ghost" data-no>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${RD.safeTitle(okLabel)}</button></div>`, { onClose: () => resolve(false) });
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
    if (btn) { btn.disabled = true; btn.dataset.t = btn.innerHTML; btn.innerHTML = `${RD.icon('hourglass', '', 14)} Procesando…`; }
    try { return await fn(); } finally { if (btn) { btn.disabled = false; if (btn.dataset.t !== undefined) btn.innerHTML = btn.dataset.t; } }
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

    const modal = RD.openModal('Cobro Yape / Plin con QR', `
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
          ${RD.icon('smartphone', '', 15)} <b>Monto pre-cargado:</b> Al escanear este QR con Yape o Plin desde su celular, <b>se cargará automáticamente S/ ${(Number(amount) || 0).toFixed(2)}</b> a nombre de <b>${RD.esc(name)}</b> sin tener que tipear el número ni el monto.
        </div>

        <div class="row center gap wrap mb">
          <span class="badge info" style="font-size:0.82rem">Titular: ${RD.esc(name)}</span>
          <span class="badge" style="font-size:0.82rem;font-family:monospace">Cel: ${phone}</span>
          <button type="button" class="btn sm ghost" id="btncopyphone">${RD.icon('copy', '', 13)} Copiar N°</button>
        </div>

        <div class="box" style="background:var(--bg2);padding:10px;border-radius:8px;text-align:left">
          <label class="field" style="margin:0">
            <span style="font-weight:700">N° de Operación Yape/Plin (verificar en celular de caja):</span>
            <input id="modal_op_code" placeholder="Ej. 748291" inputmode="numeric" autofocus style="font-size:1.1rem;font-weight:700;letter-spacing:1px">
          </label>
        </div>

        <div class="grid g2 mt gap">
          <button type="button" class="btn ghost" id="btncan">Cancelar</button>
          <button type="button" class="btn primary" id="btnconfirm">${RD.icon('check', '', 16)} Confirmar Cobro</button>
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

    const modal = RD.openModal('Cobro con Tarjeta (POS Físico)', `
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
          <div class="small bold" style="color:#38bdf8;margin-bottom:6px;display:flex;align-items:center;gap:6px">${RD.icon('layers', '', 15)} Pasos en recepción:</div>
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
          <button type="button" class="btn primary" id="btnconfirmcard">${RD.icon('check', '', 16)} Confirmar Cobro POS</button>
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

  // Limpiador oficial de dirección (elimina referencias externas no autorizadas)
  RD.cleanAddress = addr => String(addr || 'Calle Antonio José de Sucre Lt. 10, Chivay')
    .replace(/\s*\(?\s*al costado de\s+(la\s+)?discoteca\s+muya\s*\)?/gi, '')
    .trim() || 'Calle Antonio José de Sucre Lt. 10, Chivay';

  // ---------- Generador de Boletas / Tickets (Térmico 58mm/80mm y WhatsApp) ----------
  RD.waReceiptText = (r) => {
    const cleanAddr = RD.cleanAddress(r.gym?.address || 'Calle Antonio José de Sucre Lt. 10, Chivay');
    return [
      `*${r.gym?.name || 'RD FITNESS CLUB'}*`,
      `Sede: ${cleanAddr}`,
      `Cel: ${r.gym?.phone || '982404043'}`,
      `--------------------------------`,
      `*COMPROBANTE:* ${r.receipt_no}`,
      `*Fecha:* ${RD.fmtDateTime(r.date || new Date().toISOString())}`,
      `*Cliente:* ${r.client?.name || 'Cliente'}${r.client?.doc ? ` (Doc: ${r.client.doc})` : ''}`,
      `--------------------------------`,
      `*Detalle:*`,
      `• ${r.concept}: ${RD.money(r.amount)}`,
      r.validity ? `  _${r.validity}_` : '',
      `--------------------------------`,
      `*TOTAL PAGADO:* ${RD.money(r.amount)}`,
      `*Método:* ${(r.method || 'Efectivo').toUpperCase()}${r.op_code ? ` (Op: #${r.op_code})` : ''}`,
      r.is_daily_pass ? `\n*PASE DIARIO:* Válido para reingreso hoy mostrando este comprobante o su QR en la puerta.` : '',
      `\n*Ver Comprobante Digital:* ${location.origin}/#receipt:${r.payment_id}`,
      `\n_${r.gym?.slogan || 'Disciplina · Constancia · Resultados'}_`,
      `¡Gracias por tu preferencia!`
    ].filter(Boolean).join('\n');
  };

  RD.receiptModal = (r) => {
    const waText = RD.waReceiptText(r);
    const waUrl = RD.waLink(r.client?.phone, waText);
    const qrSvg = r.qr_payload ? RD.qrSvg(r.qr_payload, { margin: 1 }) : null;
    const cleanAddr = RD.cleanAddress(r.gym?.address);

    const modal = RD.openModal(`${RD.icon('receipt')} Comprobante Oficial de Pago`, `
      <div class="receipt-wrap" id="rprint">
        <div class="receipt-ticket watermark-container" style="position:relative">
          <div class="watermark-bg" style="font-size:2.4rem;color:rgba(0,0,0,0.05)">RD FITNESS</div>
          <div class="r-center" style="margin-bottom:4px">${RD.LOGO_SVG(42)}</div>
          <div class="r-center r-bold" style="font-size:1.15rem">${RD.esc(r.gym?.name || 'RD FITNESS CLUB')}</div>
          <div class="r-center r-small muted">${RD.esc(r.gym?.slogan || 'Disciplina · Constancia · Resultados')}</div>
          <div class="r-center r-small">${RD.esc(cleanAddr)}</div>
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
        <button class="btn primary" id="btnprint">${RD.icon('printer', '', 15)} Imprimir Ticket (58mm / 80mm)</button>
        ${waUrl ? `<a class="btn ok" target="_blank" rel="noopener" href="${waUrl}">${RD.icon('whatsapp', '', 15)} Enviar por WhatsApp</a>` : `<button class="btn ok" id="btnwa">${RD.icon('whatsapp', '', 15)} Enviar por WhatsApp</button>`}
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
        <a class="btn primary sm" href="${RD.esc(src)}" target="_blank" rel="noopener">${RD.icon('search', '', 14)} Ver tamaño completo</a>
      </div>
    `, { wide: true });
  };

  RD.shiftTicketModal = (data) => {
    const s = data.shift || {};
    const t = data.totals || {};
    const settings = data.settings || {};
    const cleanAddr = RD.cleanAddress(settings.gym_address);
    const diff = Number(s.diff_cash ?? data.diff_cash ?? 0);
    let diffLabel = 'CUADRADO EXACTO (S/ 0.00)';
    let diffClass = 'ok';
    if (diff > 0) {
      diffLabel = `SOBRANTE EN CAJA: +${RD.money(diff)}`;
      diffClass = 'ok';
    } else if (diff < 0) {
      diffLabel = `FALTANTE EN CAJA: -${RD.money(Math.abs(diff))}`;
      diffClass = 'bad';
    }

    const modal = RD.openModal(`${RD.icon('file-text')} Acta de Cierre de Turno`, `
      <div class="receipt-wrap" id="rprint">
        <div class="receipt-ticket watermark-container" style="position:relative">
          <div class="watermark-bg" style="font-size:2.4rem;color:rgba(0,0,0,0.05)">RD FITNESS</div>
          <div class="r-center" style="margin-bottom:4px">${RD.LOGO_SVG(42)}</div>
          <div class="r-center r-bold" style="font-size:1.15rem">${RD.esc(settings.gym_name || 'RD FITNESS CLUB')}</div>
          <div class="r-center r-small muted">${RD.esc(settings.gym_slogan || 'Disciplina · Constancia · Resultados')}</div>
          <div class="r-center r-small">${RD.esc(cleanAddr)}</div>
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
          <div class="r-row"><span>Yape:</span> <span>${RD.money(t.digitalBreakdown?.yape || 0)}</span></div>
          <div class="r-row"><span>Plin:</span> <span>${RD.money(t.digitalBreakdown?.plin || 0)}</span></div>
          <div class="r-row"><span>Tarjeta POS (Izipay / Niubiz):</span> <span>${RD.money(t.digitalBreakdown?.card || 0)}</span></div>
          <div class="r-row"><span>Transferencias Bancarias:</span> <span>${RD.money(t.digitalBreakdown?.transfer || 0)}</span></div>
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
        <button class="btn primary" id="btnprintshift">${RD.icon('printer')} Imprimir Acta / Ticket</button>
      </div>
    `, { wide: false });

    modal.el.querySelector('#btnprintshift').onclick = () => {
      window.print();
    };
  };

  RD.registerSW = () => { if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => { }); };
  RD.GROUP_ICON_NAME = { Piernas: 'runner', Glúteos: 'target', Pecho: 'dumbbell', Espalda: 'activity', Hombros: 'barbell', Bíceps: 'dumbbell', Tríceps: 'dumbbell', Antebrazos: 'dumbbell', Trapecio: 'barbell', Core: 'flame', Cardio: 'heart', Movilidad: 'zap', Otros: 'award' };
  RD.groupIconSvg = (g, cls = '', size = 18) => RD.icon(RD.GROUP_ICON_NAME[g] || 'dumbbell', cls, size);

  // ---------- Sistema de Tema (Claro / Oscuro) ----------
  RD.getTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  RD.syncBrandColor = () => {
    const isLight = RD.getTheme() === 'light';
    if (isLight) {
      document.documentElement.style.removeProperty('--gold');
    } else if (RD.pub && RD.pub.color) {
      document.documentElement.style.setProperty('--gold', RD.pub.color);
    }
  };
  RD.setTheme = (theme, notify = false) => {
    const isLight = theme === 'light';
    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('rd_theme', 'light');
      localStorage.setItem('rd_display_theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('rd_theme', 'dark');
      localStorage.setItem('rd_display_theme', 'dark');
    }
    RD.syncBrandColor();
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isLight ? '#FAF8F5' : '#0b0b0d');

    document.querySelectorAll('[data-theme-toggle], #themetoggle, #appthemetoggle, .theme-toggle').forEach(btn => {
      btn.innerHTML = isLight ? RD.icon('moon', '', 18) : RD.icon('sun', '', 18);
      btn.title = isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    });

    if (notify) {
      RD.toast(isLight ? 'Modo Claro activado' : 'Modo Oscuro activado');
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

  // ---------- Sistema de Actualización Forzada y Sincronización en Caliente ----------
  RD.forceAppUpdate = async () => {
    RD.toast('🔄 Actualizando aplicación y descargando última versión...', 'info', 4000);
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.update().catch(() => {});
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
        }
      }
      if (RD.flushScans) await RD.flushScans().catch(() => {});
      if (RD.syncMembers) await RD.syncMembers().catch(() => {});
    } catch (e) {
      console.warn('Error durante el refresco de cache:', e);
    }
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_upd', String(Date.now()));
      window.location.href = url.toString();
    }, 500);
  };

  // Compresor universal de fotografías en navegador (JPEG 260x260 ligero para Bóveda Cloud)
  RD.compressPhoto = file => new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Selecciona una imagen'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = ev => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no soportado'));
      img.onload = () => {
        const size = 260;
        const c = document.createElement('canvas');
        c.width = size; c.height = size;
        const ctx = c.getContext('2d');
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ---------- Centro Legal, Normas del Gimnasio, Privacidad (Ley N° 29733) y Derechos de Autor ----------
  RD.openLegalModal = (initialTab = 'normas') => {
    const year = new Date().getFullYear();
    const m = RD.openModal('Centro Legal, Normas y Seguridad · RD Fitness Club', `
      <div class="chips mb" id="legaltabs">
        <span class="chip ${initialTab === 'normas' ? 'on' : ''}" data-lt="normas" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('award', '', 14)} Reglamento del Club</span>
        <span class="chip ${initialTab === 'privacidad' ? 'on' : ''}" data-lt="privacidad" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('shield', '', 14)} Privacidad (Ley 29733)</span>
        <span class="chip ${initialTab === 'terminos' ? 'on' : ''}" data-lt="terminos" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('file-text', '', 14)} Términos y Membresías</span>
        <span class="chip ${initialTab === 'copyright' ? 'on' : ''}" data-lt="copyright" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('lock', '', 14)} Derechos y Ciberseguridad</span>
      </div>
      <div id="legalbody"></div>
    `, { wide: true });

    const sections = {
      normas: `
        <div class="card flat mb">
          <h3 style="display:flex;align-items:center;gap:8px;color:var(--gold)">${RD.icon('award', 'gold', 20)} Reglamento Interno y Normas de Convivencia</h3>
          <p class="small muted">Para garantizar un ambiente seguro, higiénico y profesional para todos los socios de <b>RD Fitness Club (Chivay)</b>, es obligatorio el cumplimiento de las siguientes normas:</p>
          <ol class="steps mt">
            <li><div><b>Higiene y Toalla Personal:</b> Es obligatorio el uso de toalla personal al utilizar bancas, tapices y máquinas, así como limpiar el sudor tras finalizar tus series.</div></li>
            <li><div><b>Orden de Discos y Mancuernas:</b> Todo socio debe descargar las barras, prensas y máquinas al terminar su ejercicio y devolver las mancuernas y discos a su soporte correspondiente.</div></li>
            <li><div><b>Calzado e Indumentaria Deportiva:</b> El ingreso al área de entrenamiento requiere ropa deportiva adecuada y zapatillas cerradas limpias (prohibido entrenar en sandalias, zapatos de vestir o torso descubierto).</div></li>
            <li><div><b>Uso Personal del Pase QR:</b> La credencial digital QR dinámica y el carnet físico son estrictamente personales e intransferibles. El préstamo de código a terceros genera el bloqueo automático de la membresía.</div></li>
            <li><div><b>Respeto y Uso Compartido:</b> En horas de alta afluencia, permite alternar series en las máquinas y poleas durante tus tiempos de descanso. Evita azotar innecesariamente las pesas contra el piso.</div></li>
            <li><div><b>Salud y Entrenamiento en Altura (3,635 msnm):</b> Si presentas mareos, dolor torácico o falta de aire inusual, detén el ejercicio de inmediato y avisa al personal de recepción o entrenador.</div></li>
          </ol>
        </div>`,
      privacidad: `
        <div class="card flat mb">
          <h3 style="display:flex;align-items:center;gap:8px;color:var(--gold)">${RD.icon('shield', 'gold', 20)} Política de Privacidad y Protección de Datos (Ley N° 29733 - Perú)</h3>
          <p class="small muted">En cumplimiento de la <b>Ley N° 29733 — Ley de Protección de Datos Personales del Perú</b> y su Reglamento (D.S. N° 003-2013-JUS), RD Fitness Club garantiza la confidencialidad y seguridad de la información de sus socios:</p>
          <div class="list small mt">
            <div class="item"><div><b>1. Finalidad del Tratamiento:</b> Los datos registrados (nombre, DNI, teléfono, fecha de nacimiento, fotografía de control de acceso, historial de pagos, asistencias y mediciones corporales) se utilizan exclusivamente para la gestión de tu membresía, seguridad de ingreso al local y seguimiento deportivo.</div></div>
            <div class="item"><div><b>2. Confidencialidad y No Divulgación:</b> RD Fitness Club jamás vende, alquila ni cede tus datos personales o teléfonos a terceros ni empresas externas.</div></div>
            <div class="item"><div><b>3. Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición):</b> Como titular de tus datos, puedes actualizar tu información desde tu pestaña Perfil o solicitar la rectificación o baja de tus datos en recepción en cualquier momento.</div></div>
            <div class="item"><div><b>4. Cifrado de Credenciales:</b> Las contraseñas de socios y personal se almacenan mediante algoritmo criptográfico unidireccional <b>Bcrypt (Factor 10)</b>; ni siquiera el administrador puede ver tu contraseña en texto plano.</div></div>
          </div>
        </div>`,
      terminos: `
        <div class="card flat mb">
          <h3 style="display:flex;align-items:center;gap:8px;color:var(--gold)">${RD.icon('file-text', 'gold', 20)} Términos de Membresías, Congelamiento y Pagos</h3>
          <p class="small muted">Condiciones claras alineadas con el <b>Código de Protección y Defensa del Consumidor (Ley N° 29571 - INDECOPI)</b>:</p>
          <div class="list small mt">
            <div class="item"><div><b>Vigencia de Planes:</b> Las membresías (1 mes, 3 meses, 6 meses, 1 año) tienen vigencia continua desde la fecha de inicio elegida (inmediata o programada) hasta la fecha de vencimiento indicada en tu boleta digital.</div></div>
            <div class="item"><div><b>Congelamiento de Membresía:</b> En planes trimestrales, semestrales o anuales, el socio puede solicitar en recepción el congelamiento temporal de su plan por motivos de viaje o salud justificados; al descongelar, el sistema repone automáticamente los días exactos restantes.</div></div>
            <div class="item"><div><b>Comprobantes y Boletas Digitales:</b> Todo pago en efectivo, Yape, Plin, tarjeta POS o transferencia genera un comprobante electrónico verificable en tiempo real desde la sección <b>Perfil → Mis Boletas</b>.</div></div>
            <div class="item"><div><b>Pases Diarios:</b> El Pase Diario es válido únicamente durante la fecha de su emisión (horario de atención del club).</div></div>
          </div>
        </div>`,
      copyright: `
        <div class="card flat mb">
          <h3 style="display:flex;align-items:center;gap:8px;color:var(--gold)">${RD.icon('lock', 'gold', 20)} Propiedad Intelectual, Derechos de Autor y Ciberseguridad</h3>
          <div class="list small mt">
            <div class="item"><div><b>Propiedad Intelectual y Marca:</b> © ${year} <b>RD Fitness Club · Chivay, Caylloma, Arequipa - Perú</b>. Todos los derechos reservados. El nombre comercial, logotipo, diseño de interfaz, código fuente, arquitectura de base de datos, rutinas estructuradas y sistema de control de acceso son propiedad exclusiva de RD Fitness Club. Queda prohibida su reproducción, copia o distribución no autorizada conforme al <b>Decreto Legislativo N° 822 (Ley sobre el Derecho de Autor en el Perú)</b>.</div></div>
            <div class="item"><div><b>Arquitectura Anti-Hackeo y Ciberdefensa:</b>
              <ul style="margin:.4rem 0 0 1.1rem;padding:0">
                <li><b>Anti-Inyección SQL (SQLi):</b> 100% de consultas ejecutadas con sentencias preparadas parametrizadas en motor SQLite WAL.</li>
                <li><b>Anti-Falsificación de QR:</b> Firma criptográfica <code>HMAC-SHA256</code> dinámica que cambia cada 60 segundos; las capturas de pantalla caducan automáticamente.</li>
                <li><b>Anti-Fuerza Bruta y DDoS:</b> Bloqueo automático temporal por IP y por cuenta ante intentos fallidos repetidos de inicio de sesión.</li>
                <li><b>Cabeceras de Seguridad Bancaria:</b> Protección activa <code>X-Frame-Options: SAMEORIGIN</code>, <code>X-Content-Type-Options: nosniff</code>, <code>Strict-Transport-Security (HSTS)</code> y cookies seguras <code>HttpOnly</code>.</li>
                <li><b>Respaldo Triple Inmune a Caídas:</b> Sincronización continua en Base de Datos Local WAL + Bóveda JSON + Nube Cifrada <b>Upstash Redis</b>.</li>
              </ul>
            </div></div>
          </div>
        </div>`
    };

    const bodyEl = m.el.querySelector('#legalbody');
    const drawTab = k => {
      bodyEl.innerHTML = sections[k] || sections.normas;
      m.el.querySelectorAll('#legaltabs .chip').forEach(c => c.classList.toggle('on', c.dataset.lt === k));
    };
    m.el.querySelector('#legaltabs').onclick = e => {
      const c = e.target.closest('[data-lt]');
      if (c) drawTab(c.dataset.lt);
    };
    drawTab(initialTab);
  };

  RD.initTheme();

  // Protección global contra imágenes rotas (ejercicios, fotos de socios, avatares)
  window.addEventListener('error', e => {
    const el = e.target;
    if (!el || el.tagName !== 'IMG') return;
    const parent = el.parentElement;
    if (parent && parent.classList.contains('avatar')) {
      parent.innerHTML = RD.icon('user', '', 20);
      return;
    }
    if (parent && parent.classList.contains('ex-card')) {
      const div = document.createElement('div');
      div.className = 'avatar';
      div.style.cssText = 'width:84px;height:84px;border-radius:10px;font-size:1.8rem;flex-shrink:0';
      div.innerHTML = RD.icon('dumbbell', '', 36);
      el.replaceWith(div);
      return;
    }
    const fig = el.closest('.gifflip, figure');
    if (fig) {
      fig.remove();
      return;
    }
    el.style.display = 'none';
  }, true);
})();
