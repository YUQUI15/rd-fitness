/* RD Fitness Club - Panel de gestión: núcleo (login, navegación, sincronización, inicio) */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;
  RD.views = {};
  RD.user = JSON.parse(localStorage.getItem('rd_staff_user') || 'null');
  RD.api = RD.makeApi('rd_staff_token', () => logout(true));
  RD.pub = JSON.parse(localStorage.getItem('rd_public') || '{}');

  const $ = s => document.querySelector(s);
  const root = document.getElementById('root');

  // ---------- Snapshot de socios (para validar sin internet) ----------
  RD.snap = () => { try { return JSON.parse(localStorage.getItem('rd_snapshot') || 'null'); } catch { return null; } };
  RD.findMember = (code) => (RD.snap()?.members || []).find(m => m.code === code);
  let syncing = null;
  RD.syncMembers = () => {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const d = await RD.api.get('/sync/members');
        RD.timeOffset = d.now - Date.now();
        localStorage.setItem('rd_time_offset', String(RD.timeOffset));
        d.at = Date.now();
        localStorage.setItem('rd_snapshot', JSON.stringify(d));
        updateNet();
        return d;
      } finally { syncing = null; }
    })();
    return syncing;
  };
  // Cola de ingresos pendientes de enviar
  const QK = 'rd_scanq';
  RD.queue = () => JSON.parse(localStorage.getItem(QK) || '[]');
  RD.pushScan = s => { const q = RD.queue(); q.push(s); localStorage.setItem(QK, JSON.stringify(q)); updateNet(); };
  let flushing = false;
  RD.flushScans = async () => {
    if (flushing) return; const q = RD.queue(); if (!q.length) return;
    flushing = true;
    try {
      for (let i = 0; i < q.length; i += 200) await RD.api.post('/sync/scans', { scans: q.slice(i, i + 200) });
      localStorage.setItem(QK, '[]');
    } catch (e) { /* se reintenta luego */ } finally { flushing = false; updateNet(); }
  };
  RD.plansCache = null;
  RD.getPlans = async (force) => {
    if (!RD.plansCache || force) {
      try { RD.plansCache = await RD.api.get('/plans'); localStorage.setItem('rd_plans', JSON.stringify(RD.plansCache)); }
      catch (e) { RD.plansCache = JSON.parse(localStorage.getItem('rd_plans') || '[]'); if (!RD.plansCache.length) throw e; }
    }
    return RD.plansCache;
  };

  function updateNet() {
    const el = $('#net'); if (!el) return;
    const online = navigator.onLine;
    const pend = RD.queue().length;
    el.className = 'net' + (online ? '' : ' off');
    el.textContent = (online ? '● En línea' : '● Sin internet') + (pend ? ` · ${pend} por enviar` : '');
  }
  window.addEventListener('online', () => { updateNet(); RD.flushScans(); RD.syncMembers().catch(() => { }); });
  window.addEventListener('offline', updateNet);
  setInterval(() => { if (RD.user && navigator.onLine) { RD.flushScans(); } }, 20000);
  setInterval(() => { if (RD.user && navigator.onLine && RD.currentView !== 'scan') RD.syncMembers().catch(() => { }); }, 120000);

  // ---------- Login ----------
  function showLogin(msg) {
    const p = RD.pub;
    root.innerHTML = `
    <div class="auth"><form class="box" id="lf" autocomplete="on">
      <div class="brand"><img class="logo" src="/logo.svg" alt="RD"><h1>${esc(p.gym_name || 'RD Fitness Club')}</h1><p>Panel de gestión</p></div>
      ${msg ? `<div class="banner err">${esc(msg)}</div>` : ''}
      <label class="field"><span>Usuario</span><input name="u" autocomplete="username" autocapitalize="none" required autofocus></label>
      <label class="field"><span>Contraseña</span><input name="p" type="password" autocomplete="current-password" required></label>
      <button class="btn primary block" type="submit">Ingresar</button>
      <p class="muted small center mt">¿Eres socio? <a href="/">Abre tu app aquí</a></p>
    </form></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      await RD.busy(f.querySelector('button'), async () => {
        try {
          const r = await RD.api.post('/auth/login', { username: f.u.value, password: f.p.value });
          localStorage.setItem('rd_staff_token', r.token);
          localStorage.setItem('rd_staff_user', JSON.stringify(r.user));
          RD.user = r.user; boot();
        } catch (err) { RD.toast(err.message, 'err'); }
      });
    };
  }
  async function logout(auto) {
    if (auto) {
      try {
        const res = await fetch('/api/auth/staff-resume', { method: 'POST' });
        if (res.ok) {
          const d = await res.json();
          localStorage.setItem('rd_staff_token', d.token);
          localStorage.setItem('rd_staff_user', JSON.stringify(d.user));
          RD.user = d.user;
          return; // Sesión reanudada con cookie HttpOnly rd_s, no interrumpir al usuario
        }
      } catch { }
    }
    try { if (!auto) await RD.api.post('/auth/logout'); } catch { }
    localStorage.removeItem('rd_staff_token'); localStorage.removeItem('rd_staff_user');
    RD.user = null; showLogin(auto ? 'Tu sesión expiró. Ingresa de nuevo.' : '');
  }
  RD.logout = () => logout(false);

  // ---------- Estructura y navegación profesional con Iconos Vectoriales ----------
  const NAV = {
    scan: ['scan', 'Escáner', ['admin', 'recepcion']],
    home: ['home', 'Inicio', ['admin', 'recepcion', 'entrenador']],
    members: ['users', 'Socios', ['admin', 'recepcion', 'entrenador']],
    store: ['store', 'Tienda / POS', ['admin', 'recepcion']],
    cash: ['cash', 'Caja', ['admin', 'recepcion']],
    routines: ['dumbbell', 'Rutinas', ['admin', 'recepcion', 'entrenador']],
    reports: ['reports', 'Reportes', ['admin', 'recepcion']],
    announcements: ['announcements', 'Avisos', ['admin', 'recepcion']],
    settings: ['settings', 'Ajustes', ['admin']]
  };
  RD.openCustomerDisplayWindow = () => {
    const w = 1024, h = 600;
    const left = window.screen.availWidth ? Math.max(0, window.screen.availWidth - w - 20) : 50;
    const top = 50;
    const win = window.open('/display.html', 'RD_CustomerDisplay', `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=no,status=no`);
    if (win) {
      win.focus();
      RD.toast('Pantalla Tablet / Mostrador acoplada ✔');
    } else {
      window.open('/display.html', '_blank');
    }
  };

  RD.openGoogleSheetsDirect = async () => {
    let settings = {};
    try { settings = await RD.api.get('/settings'); } catch {}
    const url = String(settings.google_sheet_url || '').trim();
    if (url && /^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      RD.toast('Abriendo Google Sheets oficial… 📊');
    } else {
      const m = RD.openModal('📊 Google Sheets Oficial', `
        <div class="mb">
          <p class="muted small mb">Conecta tu hoja de Google Sheets para acceder directamente con un solo clic desde cualquier lugar del sistema.</p>
          <label class="field"><span>Enlace de tu Hoja en Google Sheets (URL completa)</span>
            <input id="gs_url_inp" placeholder="https://docs.google.com/spreadsheets/d/..." value="${esc(url)}">
          </label>
        </div>
        <div class="grid g2 keep mb">
          <button class="btn primary" id="gs_save_btn">Guardar y Abrir</button>
          <button class="btn" id="gs_new_btn">Crear Hoja Nueva</button>
        </div>
        <div class="center mt">
          <button class="btn ghost sm" id="gs_sync_guide_btn">⚙️ Ver Guía y Código Apps Script</button>
        </div>
      `);
      m.el.querySelector('#gs_save_btn').onclick = async () => {
        const newUrl = m.el.querySelector('#gs_url_inp').value.trim();
        if (!newUrl || !/^https?:\/\//i.test(newUrl)) {
          RD.toast('Ingresa una URL válida que empiece con https://', 'err');
          return;
        }
        try {
          await RD.api.put('/settings', { google_sheet_url: newUrl });
          RD.toast('Enlace de Google Sheets guardado ✔');
          m.close();
          window.open(newUrl, '_blank', 'noopener,noreferrer');
        } catch (err) { RD.toast(err.message, 'err'); }
      };
      m.el.querySelector('#gs_new_btn').onclick = () => {
        window.open('https://sheets.new', '_blank', 'noopener,noreferrer');
      };
      m.el.querySelector('#gs_sync_guide_btn').onclick = () => {
        m.close();
        if (typeof RD.openGoogleSheetsSyncModal === 'function') RD.openGoogleSheetsSyncModal(settings);
        else go('reports');
      };
    }
  };

  function layout() {
    const items = Object.entries(NAV).filter(([, v]) => v[2].includes(RD.user.role));
    const isLight = RD.getTheme && RD.getTheme() === 'light';
    root.innerHTML = `
    <div class="admin">
      <header class="topbar">
        <img src="/logo.svg" alt="">
        <div class="t" id="title">${esc(RD.pub.gym_name || 'RD Fitness Club')}</div>
        <span id="net" class="net">…</span>
        <button class="top-btn" id="btn_customer_screen" title="Abrir Pantalla Tablet / Mostrador en 2do Monitor o Ventana Acoplada">
          ${RD.icon('monitor', '', 15)} <span>Tablet</span>
        </button>
        <button class="top-btn" id="btn_google_sheets" title="Abrir Google Sheets Oficial del Gimnasio">
          ${RD.icon('sheet', '', 15)} <span>Sheets</span>
        </button>
        <button class="icon-btn theme-toggle" id="themetoggle" data-theme-toggle title="${isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro (Pastel)'}">
          ${isLight ? RD.icon('moon', '', 18) : RD.icon('sun', '', 18)}
        </button>
        <button class="icon-btn" id="who" title="${esc(RD.user.name)}">${RD.icon('user', '', 18)}</button>
      </header>
      <main class="page" id="view"></main>
      <nav class="nav">${items.map(([k, v]) => `<button data-v="${k}"><span class="i">${RD.icon(v[0], '', 20)}</span>${v[1]}</button>`).join('')}</nav>
    </div>`;
    document.querySelectorAll('.nav button').forEach(b => b.onclick = () => go(b.dataset.v));
    $('#themetoggle').onclick = () => { RD.toggleTheme(); layout(); };
    $('#who').onclick = userMenu;
    $('#btn_customer_screen').onclick = RD.openCustomerDisplayWindow;
    $('#btn_google_sheets').onclick = RD.openGoogleSheetsDirect;
    updateNet();
  }
  function userMenu() {
    const isLight = RD.getTheme && RD.getTheme() === 'light';
    const m = RD.openModal(RD.user.name, `<p class="muted">Rol: <b>${esc(RD.user.role)}</b></p>
      <div class="grid">
        <button class="btn" id="tm">${isLight ? RD.icon('moon') + ' Modo Oscuro' : RD.icon('sun') + ' Modo Claro (Paleta Pastel)'}</button>
        <button class="btn" id="cp">${RD.icon('lock')} Cambiar contraseña</button>
        <button class="btn" id="rf">${RD.icon('refresh')} Actualizar datos ahora</button>
        <button class="btn danger" id="lo">Cerrar sesión</button>
      </div>`);
    m.el.querySelector('#tm').onclick = () => { m.close(); RD.toggleTheme(); layout(); };
    m.el.querySelector('#lo').onclick = () => { m.close(); logout(); };
    m.el.querySelector('#rf').onclick = async () => { try { await RD.flushScans(); await RD.syncMembers(); RD.toast('Datos actualizados'); } catch (e) { RD.toast(e.message, 'err'); } };
    m.el.querySelector('#cp').onclick = () => { m.close(); changePassword(); };
  }
  function changePassword() {
    const m = RD.openModal('Cambiar contraseña', `<form id="f"><label class="field"><span>Contraseña actual</span><input name="o" type="password" required></label>
      <label class="field"><span>Nueva contraseña (mínimo 6)</span><input name="n" type="password" minlength="6" required></label><button class="btn primary block">Guardar</button></form>`);
    m.el.querySelector('#f').onsubmit = async e => {
      e.preventDefault();
      try { await RD.api.post('/auth/change-password', { old_password: e.target.o.value, new_password: e.target.n.value }); RD.toast('Contraseña actualizada'); m.close(); RD.user.must_change = 0; localStorage.setItem('rd_staff_user', JSON.stringify(RD.user)); go(RD.currentView); }
      catch (err) { RD.toast(err.message, 'err'); }
    };
  }

  let unmount = null;
  async function go(name, arg) {
    if (!NAV[name] || !NAV[name][2].includes(RD.user.role)) name = RD.user.role === 'entrenador' ? 'home' : 'scan';
    if (unmount) { try { unmount(); } catch { } unmount = null; }
    RD.currentView = name;
    localStorage.setItem('rd_last_view', name);
    history.replaceState(null, '', '#/' + name);
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.v === name));
    $('#title').textContent = NAV[name][1];
    const view = $('#view');
    view.innerHTML = '<div class="empty">Cargando…</div>';
    try {
      const v = RD.views[name];
      if (!v || typeof v.render !== 'function') {
        view.innerHTML = `<div class="empty">${RD.icon('refresh', '', 24)}<br>La pestaña <b>${NAV[name]?.[1] || name}</b> no está disponible o aún se está cargando.<br><button class="btn sm primary mt" onclick="location.reload()">Recargar</button></div>`;
        return;
      }
      const r = await v.render(view, arg);
      if (typeof r === 'function') unmount = r; else if (v.unmount) unmount = v.unmount;
    } catch (e) {
      view.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión. Esta sección necesita internet.<br>El escáner sigue funcionando.' : esc(e.message)}</div>`;
    }
    if (RD.user.must_change && name !== 'scan') {
      view.insertAdjacentHTML('afterbegin', `<div class="banner">⚠️ Estás usando la contraseña inicial. <a href="#" id="chp">Cámbiala ahora</a>.</div>`);
      $('#chp').onclick = e => { e.preventDefault(); changePassword(); };
    }
  }
  RD.go = go;

  // ---------- Inicio (dashboard) ----------
  RD.views.home = {
    async render(view) {
      const d = await RD.api.get('/dashboard');
      const plans = await RD.getPlans().catch(() => []);
      const maxI = Math.max(1, ...d.chart7.map(x => x.income)), maxV = Math.max(1, ...d.chart7.map(x => x.visits));
      const dayName = s => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date(s + 'T12:00:00Z').getUTCDay()];
      const priceList = plans.filter(p => p.active && p.days === 0).map(p => `${p.name} ${money(p.price)}`).join(', ');
      const gym = RD.pub.gym_name || 'RD Fitness Club';
      const wa = (m, text) => { const l = RD.waLink(m.phone, text); return l ? `<a class="btn sm ok" target="_blank" rel="noopener" href="${l}">${RD.icon('whatsapp', '', 14)} WhatsApp</a>` : '<span class="muted tiny">sin celular</span>'; };
      const first = n => String(n).split(' ')[0];
      const person = (m, extra, btn) => `<div class="item click" data-id="${m.id}"><div class="grow"><b>${esc(m.name)}</b><div class="muted small">${extra}</div></div>${btn || ''}</div>`;
      view.innerHTML = `
      <div class="grid g4 mb">
        <div class="stat gold"><div class="v">${money(d.income_today)}</div><div class="l">Ingresos de hoy</div></div>
        <div class="stat"><div class="v">${d.in_gym.length}</div><div class="l">En el gimnasio ahora</div></div>
        <div class="stat"><div class="v">${d.visits_today}</div><div class="l">Asistencias hoy${d.denied_today ? ` · <span class="bad">${d.denied_today} rechazos</span>` : ''}</div></div>
        <div class="stat"><div class="v">${d.members_active}<span class="muted small"> / ${d.members_total}</span></div><div class="l">Socios activos</div></div>
      </div>
      <div class="grid g2 mb">
        <div class="card"><h3>Ingresos últimos 7 días <span class="muted small">· mes: ${money(d.income_month)}</span></h3>
          <div class="bars">${d.chart7.map(x => `<div class="b" style="height:${Math.max(2, x.income / maxI * 100)}%"><span>${x.income ? Math.round(x.income) : ''}</span></div>`).join('')}</div>
          <div class="bars-l">${d.chart7.map(x => `<span>${dayName(x.day)}</span>`).join('')}</div></div>
        <div class="card"><h3>Asistencia últimos 7 días</h3>
          <div class="bars">${d.chart7.map(x => `<div class="b" style="height:${Math.max(2, x.visits / maxV * 100)}%;background:#60a5fa"><span>${x.visits || ''}</span></div>`).join('')}</div>
          <div class="bars-l">${d.chart7.map(x => `<span>${dayName(x.day)}</span>`).join('')}</div></div>
      </div>
      <div class="grid g2">
        <div class="card"><h3>${RD.icon('clock', '', 16)} Vencen pronto (7 días) <span class="badge warn">${d.expiring_soon.length}</span></h3>
          <div class="list">${d.expiring_soon.map(m => person(m, `${m.plan_name || ''} · vence ${RD.fmtDate(m.end_date)} (${m.days_left === 0 ? 'HOY' : m.days_left + ' d'})`,
            wa(m, `Hola ${first(m.name)} 👋, te escribimos de ${gym}. Tu membresía vence el ${RD.fmtDate(m.end_date)}. Renueva y no pierdas tu constancia 💪. Planes: ${priceList}. ¡Te esperamos!`))).join('') || '<div class="empty">Nadie por vencer</div>'}</div></div>
        <div class="card"><h3>${RD.icon('calendar', '', 16)} Vencidos (últimos 30 días) <span class="badge bad">${d.recently_expired.length}</span></h3>
          <div class="list">${d.recently_expired.slice(0, 15).map(m => person(m, `Venció ${RD.fmtDate(m.end_date)} (hace ${-m.days_left} d)`,
            wa(m, `Hola ${first(m.name)}, te extrañamos en ${gym} 💪. Tu membresía venció el ${RD.fmtDate(m.end_date)}. Vuelve a entrenar: ${priceList}. ¡Te esperamos!`))).join('') || '<div class="empty">Sin vencidos recientes</div>'}</div></div>
        <div class="card"><h3>${RD.icon('users', '', 16)} Socios en riesgo (10+ días sin venir) <span class="badge info">${d.at_risk.length}</span></h3>
          <div class="list">${d.at_risk.slice(0, 15).map(m => person(m, `Última visita: ${m.last_in ? RD.ago(m.last_in) : 'nunca'}`,
            wa(m, `Hola ${first(m.name)} 👋, ¡te extrañamos en ${gym}! Tu constancia es tu mejor inversión. ¿Te esperamos hoy? 💪`))).join('') || '<div class="empty">Todos vienen con regularidad</div>'}</div></div>
        <div class="card"><h3>${RD.icon('dumbbell', '', 16)} En el gimnasio ahora</h3>
          <div class="list">${d.in_gym.map(m => `<div class="item click" data-id="${m.id}"><div class="avatar">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(m.name[0])}</div><div class="grow"><b>${esc(m.name)}</b></div><span class="muted small">${RD.fmtTime(m.ts)}</span></div>`).join('') || '<div class="empty">Nadie registrado en las últimas horas</div>'}</div></div>
        ${d.birthdays.length ? `<div class="card"><h3>🎂 Cumpleaños de hoy</h3><div class="list">${d.birthdays.map(m => person(m, '', wa(m, `¡Feliz cumpleaños ${first(m.name)}! 🎉 De parte de todo el equipo de ${gym}. ¡Hoy entrenas con nosotros con un regalito! 💪`))).join('')}</div></div>` : ''}
        <div class="card"><h3>Últimos escaneos</h3>
          <div class="list">${d.last_scans.map(s => `<div class="item"><span class="badge ${s.result === 'ok' ? 'ok' : s.result === 'warn' ? 'warn' : 'denied'}">${s.result === 'ok' ? 'Entró' : s.result === 'warn' ? 'Aviso' : 'Rechazado'}</span><div class="grow"><b>${esc(s.name || s.code || 'Desconocido')}</b><div class="muted tiny">${esc(s.reason || '')}</div></div><span class="muted small">${RD.fmtTime(s.ts)}</span></div>`).join('') || '<div class="empty">Sin movimientos todavía</div>'}</div></div>
      </div>`;
      view.querySelectorAll('[data-id]').forEach(el => el.onclick = e => { if (e.target.closest('a')) return; RD.openMember(+el.dataset.id); });
    }
  };

  // ---------- Verificación Segura de Sesión de Personal ----------
  async function ensureStaffAuth() {
    const token = localStorage.getItem('rd_staff_token');
    if (token) {
      try {
        const u = await RD.api.get('/me');
        RD.user = u;
        localStorage.setItem('rd_staff_user', JSON.stringify(u));
        return true;
      } catch (e) {
        if (e.offline && RD.user) return true;
      }
    }
    // Reanudar automáticamente con cookie segura HttpOnly (rd_s)
    try {
      const res = await fetch('/api/auth/staff-resume', { method: 'POST' });
      if (res.ok) {
        const d = await res.json();
        localStorage.setItem('rd_staff_token', d.token);
        localStorage.setItem('rd_staff_user', JSON.stringify(d.user));
        RD.user = d.user;
        return true;
      }
    } catch { }
    return false;
  }

  // ---------- Arranque ----------
  async function boot() {
    RD.registerSW();
    RD.syncTime();
    try { RD.pub = await (await fetch('/api/public')).json(); localStorage.setItem('rd_public', JSON.stringify(RD.pub)); } catch { }
    document.documentElement.style.setProperty('--gold', RD.pub.color || '#f5b400');
    const authed = await ensureStaffAuth();
    if (!authed) return showLogin();
    layout();
    if (navigator.onLine) { RD.flushScans(); RD.syncMembers().catch(() => { }); RD.getPlans().catch(() => { }); }
    const saved = localStorage.getItem('rd_last_view');
    const h = (location.hash || '').replace('#/', '') || saved;
    go(h && NAV[h] ? h : (RD.user.role === 'entrenador' ? 'home' : 'scan'));
  }
  window.RDboot = boot;
})();
