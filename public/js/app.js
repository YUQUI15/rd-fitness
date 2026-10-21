/* RD Fitness Club - Aplicación del Socio (PWA Móvil de Élite) */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;

  let member = JSON.parse(localStorage.getItem('rd_member_data') || 'null');
  const api = RD.makeApi('rd_member_token', () => handleAuthFail());
  const root = document.getElementById('root');
  let currentTab = 'pass';
  let qrTimer = null;
  let exListCache = null;

  // Sincronizar ejercicios para uso sin internet
  async function getExercises() {
    if (!exListCache) {
      try {
        exListCache = await api.get('/exercises');
        localStorage.setItem('rd_ex_cache', JSON.stringify(exListCache));
      } catch (e) {
        exListCache = JSON.parse(localStorage.getItem('rd_ex_cache') || '[]');
      }
    }
    return exListCache;
  }

  // ---------------- LOGIN DEL SOCIO ----------------
  function showLogin(err) {
    RD.hub.stop();
    const themeLbl = () => RD.getTheme && RD.getTheme() === 'light' ? `${RD.icon('moon', '', 14)} Modo Oscuro` : `${RD.icon('sun', '', 14)} Modo Claro`;
    root.innerHTML = `
    <div class="auth">
      <form class="box" id="mlf" autocomplete="on">
        <div class="brand">
          <img class="logo" src="/logo.svg" alt="RD" style="height:48px;width:48px;max-height:48px;max-width:48px;object-fit:contain;margin:0 auto .6rem" width="48" height="48">
          <h1>RD FITNESS CLUB</h1>
          <p>Tu credencial y entrenador digital · Chivay</p>
        </div>
        ${err ? `<div class="banner err">${esc(err)}</div>` : ''}
        <label class="field">
          <span>DNI, Usuario o Código de socio</span>
          <input name="username" placeholder="Tu DNI, usuario o código (ej. 74839201)" required autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" autofocus>
        </label>
        <label class="field">
          <span>Contraseña</span>
          <div class="pw"><input name="password" type="password" placeholder="Tu contraseña o DNI" required autocomplete="current-password"><button type="button" class="pw-eye" data-eye aria-label="Mostrar contraseña">${RD.icon('eye', '', 16)}</button></div>
          <small class="tiny muted">¿Primera vez o regresas después de meses? Tu contraseña inicial es tu <b>DNI</b>. Si olvidaste tu clave, tu DNI siempre te permite ingresar.</small>
        </label>
        <button class="btn primary block" type="submit">Ingresar a mi App</button>
        <p class="center small mt2"><a href="#" id="forgot">¿Olvidaste tu contraseña?</a></p>
        <button type="button" class="btn ghost sm mt2 block" id="btn_login_install" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('smartphone', '', 16)} ¿Cómo instalar la App en tu Celular o PC?</button>
        <p class="center muted tiny mt2">Este dispositivo recordará tu sesión de forma segura.</p>
        <div class="card flat mt center small muted">
          ¿Aún no estás registrado? Acércate a recepción en Calle Sucre Lt. 10 para obtener tu código y credencial.
        </div>
        <p class="center muted tiny mt">Personal del gimnasio: <a href="/admin/">Acceso al panel</a> · <a href="#" id="loginlegal">Reglamento y Privacidad</a></p>
        <div class="center mt2">
          <button type="button" class="btn ghost sm" id="loginthemebtn" data-theme-toggle style="display:inline-flex;align-items:center;gap:6px">${themeLbl()}</button>
        </div>
        <div class="center muted tiny mt2">© ${new Date().getFullYear()} RD Fitness Club · Chivay · Derechos Reservados</div>
      </form>
    </div>`;

    const ltb = document.getElementById('loginthemebtn');
    ltb.onclick = () => { RD.toggleTheme(); ltb.innerHTML = themeLbl(); };
    const bli = document.getElementById('btn_login_install');
    if (bli) bli.onclick = () => RD.hub.openInstallGuide();
    const lleg = document.getElementById('loginlegal');
    if (lleg) lleg.onclick = e => { e.preventDefault(); RD.openLegalModal('normas'); };
    root.querySelector('[data-eye]').onclick = e => { const i = e.currentTarget.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; };
    document.getElementById('forgot').onclick = e => { e.preventDefault(); RD.hub.forgot(); };

    document.getElementById('mlf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      await RD.busy(f.querySelector('button[type=submit]'), async () => {
        try {
          const res = await api.post('/auth/member-login', {
            id: f.username.value.trim(),
            secret: f.password.value,
            ...RD.hub.deviceInfo()
          });
          startSession(res);
        } catch (error) {
          RD.toast(error.message, 'err');
        }
      });
    };

    if (location.hash.startsWith('#receipt:')) {
      const pid = +location.hash.replace('#receipt:', '');
      history.replaceState(null, '', location.pathname + location.search);
      if (pid) setTimeout(() => RD.showReceipt(pid), 350);
    }
  }

  function startSession(res) {
    localStorage.setItem('rd_member_token', res.token);
    localStorage.setItem('rd_member_data', JSON.stringify(res.member));
    member = res.member;
    RD.hub.keepStorage();
    boot();
  }

  let recovering = false;
  async function handleAuthFail() {
    if (recovering) return;
    recovering = true;
    try {
      const res = await RD.hub.resume();
      if (res && res.token) { startSession(res); return; }
    } finally { recovering = false; }
    logout(true);
  }

  function logout(auto) {
    clearInterval(qrTimer);
    RD.hub.stop();
    if (!auto) api.post('/auth/logout').catch(() => { });
    localStorage.removeItem('rd_member_token');
    localStorage.removeItem('rd_member_data');
    member = null;
    showLogin(auto ? 'Tu sesión terminó. Ingresa de nuevo.' : '');
  }

  // ---------------- NAVEGACIÓN Y ESTRUCTURA (5 TABS PROFESIONALES) ----------------
  function layout() {
    const isLight = RD.getTheme && RD.getTheme() === 'light';
    root.innerHTML = `
    <div>
      <header class="topbar">
        <img src="/logo.svg" alt="RD" class="topbar-logo" style="height:32px;width:32px;max-height:32px;max-width:32px;object-fit:contain;flex-shrink:0" width="32" height="32">
        <div class="t" id="apptitle">RD FITNESS CLUB</div>
        <button class="icon-btn" id="appinstallbtn" title="Cómo instalar la App en tu móvil o PC" aria-label="Instalar App">${RD.icon('smartphone', '', 18)}</button>
        <button class="icon-btn bell" id="bellbtn" title="Avisos" aria-label="Avisos">${RD.icon('bell', '', 18)}<span class="bell-dot" id="belldot" hidden></span></button>
        <button class="icon-btn theme-toggle" id="appthemetoggle" data-theme-toggle title="${isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}">${isLight ? RD.icon('moon', '', 18) : RD.icon('sun', '', 18)}</button>
        <button class="icon-btn" id="logoutbtn" title="Cerrar sesión" aria-label="Cerrar sesión">${RD.icon('power', '', 18)}</button>
      </header>
      <div id="noticebar"></div>
      <main class="page" id="mainview"></main>
      <nav class="nav">
        <button data-tab="pass" class="on"><span class="i">${RD.icon('pass', '', 20)}</span>Acceso</button>
        <button data-tab="train"><span class="i">${RD.icon('dumbbell', '', 20)}</span>Entrenar</button>
        <button data-tab="progress"><span class="i">${RD.icon('progress', '', 20)}</span>Progreso</button>
        <button data-tab="tools"><span class="i">${RD.icon('tools', '', 20)}</span>Herramientas</button>
        <button data-tab="profile"><span class="i">${RD.icon('profile', '', 20)}</span>Perfil</button>
      </nav>
    </div>`;

    document.querySelectorAll('.nav button').forEach(b => {
      b.onclick = () => switchTab(b.dataset.tab);
    });

    document.getElementById('appinstallbtn').onclick = () => RD.hub.openInstallGuide();
    document.getElementById('appthemetoggle').onclick = () => RD.toggleTheme();
    document.getElementById('bellbtn').onclick = () => RD.hub.openInbox();
    RD.hub.start(api);

    document.getElementById('logoutbtn').onclick = async () => {
      if (await RD.confirm('Cerrar sesión', '¿Deseas salir de tu cuenta en este dispositivo?', 'Salir', true)) {
        logout(false);
      }
    };
  }

  async function switchTab(tab) {
    currentTab = tab;
    clearInterval(qrTimer);
    document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const main = document.getElementById('mainview');
    main.innerHTML = '<div class="empty" style="padding-top:25vh">Cargando…</div>';

    if (tab === 'pass') await renderPassTab(main);
    else if (tab === 'train') await renderTrainTab(main);
    else if (tab === 'progress') await renderProgressTab(main);
    else if (tab === 'tools') await renderToolsTab(main);
    else if (tab === 'profile') await renderProfileTab(main);
  }

  // ---------------- TAB 1: PASE Y ACCESO DIGITAL QR ----------------
  async function renderPassTab(el) {
    let fresh;
    try {
      fresh = await api.get('/member/me');
      member = fresh.member;
      localStorage.setItem('rd_member_data', JSON.stringify(member));
    } catch (e) {
      fresh = { member, stats: {}, settings: {} };
    }

    const st = fresh.member.access;
    const isOk = st === 'ok';
    const isWarn = st === 'warn';
    const isDenied = st === 'denied';

    const gymName = fresh.settings?.gym_name || 'RD Fitness Club';
    const renewMsg = `Hola, soy ${member.name} (${member.code}). Quiero renovar mi membresía en ${gymName}.`;
    const renewWa = RD.waLink(fresh.settings?.gym_phone || '982404043', renewMsg);

    const snoozed = Date.now() - Number(localStorage.getItem('rd_setup_snooze') || 0) < 14 * 86400000;
    const showSetup = !member.has_password && !snoozed;

    el.innerHTML = `
    ${showSetup ? `
    <div class="card flat mb setup-card" id="setupcard">
      <div class="row gap">
        <div class="setup-icon-wrap" style="color:var(--gold);display:flex;align-items:center;justify-content:center">${RD.icon('sparkles', 'gold', 24)}</div>
        <div class="grow">
          <b>Crea tu usuario y contraseña</b>
          <div class="small muted">Ingresa con tu propio alias y protege tu cuenta. Tu código ${esc(member.code)} y tu DNI no cambian.</div>
        </div>
      </div>
      <div class="row end gap mt2">
        <button class="btn sm ghost" id="setuplater">Ahora no</button>
        <button class="btn sm primary" id="setupnow">${RD.icon('key', '', 14)} Configurar</button>
      </div>
    </div>` : ''}

    <div class="idcard watermark-container">
      <div class="idcard-watermark" aria-hidden="true">
        ${RD.LOGO_SVG(170)}
        <span>RD FITNESS CLUB</span>
      </div>
      <div class="row between" style="position:relative;z-index:1">
        <div class="row gap" style="align-items:center">
          ${RD.LOGO_SVG(36)}
          <span class="vip-pill"><span class="vip-dot"></span>SOCIO OFICIAL</span>
        </div>
        <span class="tag-loc" style="font-size:10px;font-weight:700;color:var(--gold);letter-spacing:1px">CHIVAY · 3,635m</span>
      </div>

      <div class="center mt2" style="position:relative;z-index:1">
        <h2 style="margin:0">${esc(member.name)}</h2>
        <div class="gold" style="font-size:1.4rem;font-weight:900;letter-spacing:1px">${esc(member.code)}</div>
      </div>

      <div class="qr" id="qrcodebox" style="position:relative;z-index:1">
        <div class="empty">Generando código…</div>
      </div>

      <div class="countdown" title="Código de seguridad dinámico" style="position:relative;z-index:1">
        <i id="cdbar" style="width:100%"></i>
      </div>
      <div class="muted tiny mt2 center" style="display:flex;align-items:center;justify-content:center;gap:5px;position:relative;z-index:1">${RD.icon('shield', 'muted', 12)} Código dinámico de alta seguridad (renovación cada 60s)</div>

      <div class="statusbar ${st} mt" style="position:relative;z-index:1">
        <div style="font-size:1.05rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px">
          ${isOk ? `${RD.icon('check-circle', '', 18)} MEMBRESÍA VIGENTE` : isWarn ? `${RD.icon('alert-triangle', '', 18)} POR VENCER` : `${RD.icon('x-circle', '', 18)} NO VIGENTE`}
        </div>
        <div class="small">${esc(member.access_reason)}</div>
        ${member.end_date ? `<div class="tiny mt2">Vence: <b>${RD.fmtDate(member.end_date)}</b> (${esc(member.plan_name || 'Plan')})</div>` : ''}
      </div>

      ${(!isOk) ? `
      <div class="mt" style="position:relative;z-index:1;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.32);padding:14px;border-radius:12px;text-align:center">
        <div style="color:#ef4444;font-weight:800;font-size:0.95rem;display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:4px">
          ${RD.icon('lock', '', 16)} ACCESO A SALA INHABILITADO
        </div>
        <p class="tiny muted" style="margin:0 0 12px">Tu plan ha finalizado. Tu historial, racha y marcas de entrenamiento siguen guardados. Renueva hoy para reactivar tu carné de ingreso:</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a class="btn primary sm" target="_blank" rel="noopener" href="${renewWa}" style="display:inline-flex;align-items:center;gap:6px;font-size:0.84rem">
            ${RD.icon('whatsapp', '', 16)} Renovar por WhatsApp
          </a>
          <button type="button" class="btn sm" id="btn_yape_direct_modal" style="display:inline-flex;align-items:center;gap:6px;font-size:0.84rem">
            💜 Pagar con Yape / Plin
          </button>
        </div>
      </div>` : ''}
    </div>

    <!-- Acceso Rápido a Entrenar Hoy -->
    <div class="card mt mb train-hero-card" style="background:linear-gradient(135deg,rgba(183,110,121,0.15),rgba(2,132,199,0.1));border-color:var(--gold)">
      <div class="row between mb">
        <div>
          <b style="font-size:1.05rem;display:flex;align-items:center;gap:7px">${RD.icon('train', 'gold', 20)} ¿Listo para entrenar hoy?</b>
          <div class="small muted">Registra tus series, pesos y descansos con cronómetro automático.</div>
        </div>
      </div>
      <div class="grid g2 keep gap">
        <button class="btn primary" id="btn_quick_train" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('play', '', 16)} Seguir Mi Rutina</button>
        <button class="btn" id="btn_quick_free" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('zap', 'gold', 16)} Sesión Libre</button>
      </div>
    </div>

    <!-- Estadísticas de Constancia -->
    <div class="grid g3 keep mb stat-grid">
      <div class="stat gold">
        <div class="stat-badge-icon">${RD.icon('flame', '', 18)}</div>
        <div class="v">${fresh.stats?.streak_weeks || 0}</div>
        <div class="l">Semanas racha</div>
      </div>
      <div class="stat">
        <div class="stat-badge-icon">${RD.icon('runner', '', 18)}</div>
        <div class="v">${fresh.stats?.visits_30 || 0}</div>
        <div class="l">Visitas este mes</div>
      </div>
      <div class="stat">
        <div class="stat-badge-icon">${RD.icon('barbell', '', 18)}</div>
        <div class="v">${Math.round((fresh.stats?.volume_30 || 0) / 1000)}k</div>
        <div class="l">Kg levantados</div>
      </div>
    </div>

    ${('Notification' in window) && Notification.permission === 'default' && !localStorage.getItem('rd_push_prompt_dismiss') ? `
    <div class="card mb" id="push_prompt_card" style="background:linear-gradient(135deg,rgba(245,180,0,0.14),rgba(245,180,0,0.04));border:1px solid var(--gold);padding:14px;border-radius:10px">
      <div class="row between wrap gap" style="align-items:center">
        <div class="grow" style="min-width:200px">
          <b style="color:var(--gold);display:flex;align-items:center;gap:6px">${RD.icon('bell-ring', '', 18)} ¿Activar Notificaciones al Celular?</b>
          <p class="tiny muted" style="margin:4px 0 0">Entérate al instante de promociones 2x1, cambios de horario y avisos de RD Fitness.</p>
        </div>
        <div class="row gap">
          <button class="btn sm ghost" id="btn_dismiss_push">Más tarde</button>
          <button class="btn sm primary" id="btn_enable_push" style="display:flex;align-items:center;gap:5px">${RD.icon('bell', '', 14)} Activar</button>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Novedades y Avisos Oficiales del Club -->
    <div id="pass_announcements_sec"></div>

    <!-- Enlaces directos a Boleta y Gimnasio -->
    <div class="card mb">
      <div class="row between wrap gap" style="align-items:center">
        <div>
          <b style="display:flex;align-items:center;gap:6px">${RD.icon('receipt', 'gold', 18)} Tu comprobante y boletas de pago</b>
          <div class="tiny muted">Revisa tus boletas digitales de pago en formato de ticket térmico.</div>
        </div>
        <button class="btn sm ok" id="btn_quick_receipt" style="display:flex;align-items:center;gap:5px">${RD.icon('receipt', '', 14)} Ver Boletas</button>
      </div>
    </div>

    <div class="card watermark-container">
      <div class="watermark-bg">RD FITNESS</div>
      <div class="row gap" style="align-items:center;position:relative;z-index:1">
        ${RD.LOGO_SVG(42)}
        <div>
          <h3 style="margin:0;display:flex;align-items:center;gap:6px">${RD.icon('map-pin', 'gold', 18)} RD Fitness Club · Sede Oficial Chivay</h3>
          <p class="muted small" style="margin:4px 0 0">
            ${esc(RD.cleanAddress(fresh.settings?.gym_address || 'Calle Antonio José de Sucre Lt. 10, Chivay'))}.<br>
            Horario: ${esc(fresh.settings?.opening || 'Lun a Sáb 6:00 a 21:00')} · WhatsApp: <b>${esc(fresh.settings?.gym_phone || '982 404 043')}</b>.
          </p>
        </div>
      </div>
    </div>`;

    const dPush = el.querySelector('#btn_dismiss_push');
    if (dPush) dPush.onclick = () => { localStorage.setItem('rd_push_prompt_dismiss', '1'); el.querySelector('#push_prompt_card')?.remove(); };
    const ePush = el.querySelector('#btn_enable_push');
    if (ePush) ePush.onclick = async () => {
      try {
        await RD.hub.enablePush();
        RD.toast('Notificaciones al celular activadas con éxito', 'ok');
        el.querySelector('#push_prompt_card')?.remove();
      } catch (err) {
        RD.toast(err.message, 'warn');
      }
    };

    // Función global para refrescar novedades oficiales en tiempo real
    const updateHeroAnnouncement = () => {
      const sec = document.getElementById('pass_announcements_sec');
      if (!sec) return;
      api.get('/member/inbox').then(inb => {
        const liveSec = document.getElementById('pass_announcements_sec');
        if (!liveSec || !inb || !inb.items) return;
        const gymItems = inb.items.filter(i => i.source === 'gym' && !i.dismissed);
        if (!gymItems.length) { liveSec.innerHTML = ''; return; }
        const latest = gymItems[0];
        const kindLabel = { aviso: 'Aviso', evento: 'Evento', tematica: 'Temática', promo: 'Promoción', mantenimiento: 'Mantenimiento', cierre: 'Atención' }[latest.kind] || 'Novedades';
        const kindIcon = { aviso: RD.icon('megaphone', '', 14), evento: RD.icon('party', '', 14), tematica: RD.icon('palette', '', 14), promo: RD.icon('tag', '', 14), mantenimiento: RD.icon('wrench', '', 14), cierre: RD.icon('shield-alert', '', 14) }[latest.kind] || RD.icon('megaphone', '', 14);
        liveSec.innerHTML = `
          <div class="card mb" style="border-left: 4px solid var(--gold);background:var(--bg2)">
            <div class="row between wrap gap mb2">
              <span class="badge ${esc(latest.kind || 'aviso')}" style="font-weight:700;display:inline-flex;align-items:center;gap:5px">${kindIcon} <span>${esc(kindLabel)}</span></span>
              <span class="tiny muted">${RD.ago(latest.created_at)}</span>
            </div>
            <b style="font-size:1.05rem;display:block;margin-bottom:6px">${esc(latest.title)}</b>
            ${latest.image_url ? `
              <div class="mb" style="max-height:190px;overflow:hidden;border-radius:8px;border:1px solid var(--line);background:var(--bg3);cursor:pointer;" id="ann_hero_img">
                <img src="${esc(latest.image_url)}" style="width:100%;max-height:190px;object-fit:cover;display:block" alt="${esc(latest.title)}">
              </div>
            ` : ''}
            ${latest.body ? `<div class="small muted mb" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;line-height:1.4">${esc(latest.body)}</div>` : ''}
            <div class="row between wrap gap mt2 pt2" style="border-top:1px solid var(--line);align-items:center">
              <button class="btn sm ghost" id="btn_open_all_inb">Ver todos (${gymItems.length})</button>
              <button class="btn sm primary" id="btn_open_hero_ann" style="display:flex;align-items:center;gap:5px">${RD.icon('eye', '', 14)} Leer Comunicado</button>
            </div>
          </div>
        `;
        liveSec.querySelector('#btn_open_hero_ann').onclick = () => RD.hub.openAnnouncementModal(latest);
        liveSec.querySelector('#btn_open_all_inb').onclick = () => RD.hub.openInbox();
        const heroImg = liveSec.querySelector('#ann_hero_img');
        if (heroImg) heroImg.onclick = () => RD.zoomImage(latest.image_url, latest.title);
      }).catch(() => {});
    };
    RD.hub.updateHeroAnnouncement = updateHeroAnnouncement;
    updateHeroAnnouncement();

    const setupLater = el.querySelector('#setuplater');
    if (setupLater) {
      setupLater.onclick = () => { localStorage.setItem('rd_setup_snooze', String(Date.now())); el.querySelector('#setupcard').remove(); };
      el.querySelector('#setupnow').onclick = () => RD.hub.openAccount(member, m => {
        member = m; localStorage.setItem('rd_member_data', JSON.stringify(m)); el.querySelector('#setupcard')?.remove();
      }, { first: true });
    }

    el.querySelector('#btn_quick_train').onclick = () => switchTab('train');
    el.querySelector('#btn_quick_free').onclick = async () => {
      const exList = await getExercises();
      const exMap = Object.fromEntries(exList.map(e => [e.id, e]));
      let lastWeights = {};
      try { lastWeights = await api.get('/member/last-weights'); } catch {}
      RD.startFreeWorkout({ exercises: exMap, lastWeights, onFinish: p => api.post('/member/workouts', p) });
    };
    el.querySelector('#btn_quick_receipt').onclick = () => RD.hub.openReceipts();

    const btnYapeModal = el.querySelector('#btn_yape_direct_modal');
    if (btnYapeModal) {
      btnYapeModal.onclick = () => {
        const qrUrl = fresh.settings?.yape_qr_url || '/logo.svg';
        const num = fresh.settings?.yape_phone || '982 404 043';
        const tit = fresh.settings?.yape_holder || fresh.settings?.gym_name || 'RD Fitness';
        RD.openModal('Renovación Rápida Yape / Plin', `
          <div style="text-align:center;padding:10px 0">
            <p class="small muted">Transfiere el monto de tu mensualidad y envía tu comprobante al WhatsApp de recepción:</p>
            <div style="background:#fff;padding:14px;border-radius:14px;display:inline-block;margin:12px 0;box-shadow:0 6px 18px rgba(0,0,0,0.25)">
              <img src="${esc(qrUrl)}" alt="Yape QR" style="width:180px;height:180px;object-fit:contain" onerror="this.src='/logo.svg'">
            </div>
            <div style="font-size:1.25rem;font-weight:900;color:var(--gold);letter-spacing:1px">${esc(num)}</div>
            <div class="tiny muted mt2">Titular: <b>${esc(tit)}</b></div>
            <a class="btn ok block mt" target="_blank" rel="noopener" href="${renewWa}" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:14px">
              ${RD.icon('whatsapp', '', 18)} Enviar Comprobante a Recepción
            </a>
          </div>
        `);
      };
    }

    const qrBox = el.querySelector('#qrcodebox');
    const cdBar = el.querySelector('#cdbar');

    async function updateQR() {
      if (!member?.qr_key) return;
      const payload = await RD.digitalPayload(member.code, member.qr_key);
      qrBox.innerHTML = RD.qrSvg(payload, { margin: 1 });
      if (!isOk) {
        const overlay = document.createElement('div');
        overlay.className = 'qr-expired-overlay';
        overlay.style = 'position:absolute;inset:0;background:rgba(15,23,42,0.85);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:12px;text-align:center;border-radius:12px;backdrop-filter:blur(3px);border:2px solid #ef4444';
        overlay.innerHTML = `
          <div style="background:#ef4444;color:#fff;font-weight:900;font-size:0.75rem;padding:3px 8px;border-radius:999px;margin-bottom:6px;display:inline-flex;align-items:center;gap:4px">
            ${RD.icon('lock', '', 12)} ACCESO INACTIVO
          </div>
          <div style="font-size:0.88rem;font-weight:800;color:#fff">MEMBRESÍA EXPIRADA</div>
          <div style="font-size:0.75rem;color:#fca5a5;margin-top:2px">Renueva en caja para volver a ingresar</div>
        `;
        qrBox.style.position = 'relative';
        qrBox.appendChild(overlay);
      }
    }

    function tick() {
      const sec = Math.floor((RD.now() % 60000) / 1000);
      const rem = 60 - sec;
      if (cdBar) cdBar.style.width = ((rem / 60) * 100) + '%';
      if (rem === 60 || !qrBox.querySelector('svg')) {
        updateQR();
      }
    }

    updateQR();
    tick();
    qrTimer = setInterval(tick, 1000);
  }

  // ---------------- TAB 2: ENTRENAR (RUTINAS, SESIÓN LIBRE, ASISTENTE, BIBLIOTECA) ----------------
  async function renderTrainTab(el) {
    const [routinesData, exList] = await Promise.all([
      api.get('/member/routines'),
      getExercises()
    ]);
    const exMap = Object.fromEntries(exList.map(e => [e.id, e]));

    el.innerHTML = `
    <div class="chips mb" id="ttabs">
      <span class="chip on" data-tt="my" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('train', '', 14)}<span>Mi Rutina</span></span>
      <span class="chip" data-tt="free" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('zap', '', 14)}<span>Sesión Libre</span></span>
      <span class="chip" data-tt="wizard" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('bot', '', 14)}<span>Asistente de Plan</span></span>
      <span class="chip" data-tt="templates" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('layers', '', 14)}<span>Plantillas (${routinesData.templates.length})</span></span>
      <span class="chip" data-tt="exercises" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('dumbbell', '', 14)}<span>Biblioteca (${exList.length})</span></span>
      <span class="chip" data-tt="timers" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('timer', '', 14)}<span>Cronómetros</span></span>
    </div>
    <div id="trainsubview"></div>`;

    const subview = el.querySelector('#trainsubview');

    async function showSubTab(tab) {
      el.querySelectorAll('#ttabs .chip').forEach(c => c.classList.toggle('on', c.dataset.tt === tab));

      if (tab === 'my') {
        renderMyRoutine(subview, routinesData.mine, exList);
      } else if (tab === 'free') {
        renderFreeWorkoutLauncher(subview, exMap);
      } else if (tab === 'wizard') {
        renderSmartRoutineWizard(subview, routinesData.templates);
      } else if (tab === 'templates') {
        renderRoutineTemplates(subview, routinesData.templates);
      } else if (tab === 'exercises') {
        subview.innerHTML = `<div class="card"><div id="exbox"></div></div>`;
        RD.exerciseLibrary(subview.querySelector('#exbox'), exList);
      } else if (tab === 'timers') {
        subview.innerHTML = `<div class="card" style="max-width:480px;margin:0 auto"><h3 style="display:flex;align-items:center;gap:6px">${RD.icon('timer', 'gold', 20)} Cronómetros y Tabata</h3><div id="tbox" class="mt"></div></div>`;
        RD.timersTool(subview.querySelector('#tbox'));
      }
    }

    el.querySelector('#ttabs').onclick = e => {
      const c = e.target.closest('[data-tt]');
      if (c) showSubTab(c.dataset.tt);
    };

    showSubTab('my');
  }

  async function renderMyRoutine(el, mine, exList) {
    if (!mine.length) {
      el.innerHTML = `
      <div class="card center mb" style="padding:2.5rem 1rem">
        <div style="margin:0 auto 1rem;color:var(--gold);display:flex;justify-content:center">${RD.icon('dumbbell', 'gold', 42)}</div>
        <h3>Aún no tienes una rutina asignada</h3>
        <p class="muted small mb">Puedes elegir una de las 10 rutinas profesionales creadas por entrenadores o usar nuestro Asistente Inteligente.</p>
        <div class="row gap mt" style="justify-content:center">
          <button class="btn primary" id="pickplan" style="display:flex;align-items:center;gap:6px">${RD.icon('layers', '', 16)} Explorar Plantillas Oficiales</button>
          <button class="btn" id="open_wiz_btn" style="display:flex;align-items:center;gap:6px">${RD.icon('bot', '', 16)} Asistente de Plan</button>
        </div>
      </div>`;
      el.querySelector('#pickplan').onclick = () => document.querySelector('[data-tt="templates"]').click();
      el.querySelector('#open_wiz_btn').onclick = () => document.querySelector('[data-tt="wizard"]').click();
      return;
    }

    const currentAssigned = mine[0];
    const full = await api.get('/routines/' + currentAssigned.id);
    const exMap = Object.fromEntries(exList.map(e => [e.id, e]));

    el.innerHTML = `
    <div class="card mb">
      <div class="row between">
        <span class="badge ok" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('check-circle', '', 14)}<span>Rutina Asignada</span></span>
        <span class="badge info">${esc(full.level)} · ${full.days_per_week || full.days.length} días/sem</span>
      </div>
      <h2 class="mt2" style="margin-bottom:.2rem">${esc(full.name)}</h2>
      <p class="muted small">${esc(full.goal || full.description || '')}</p>
      ${currentAssigned.note ? `<div class="tip small mb"><b>Nota de tu entrenador:</b> ${esc(currentAssigned.note)}</div>` : ''}
    </div>

    <h3>Selecciona el día a entrenar hoy:</h3>
    <div class="grid gap mt2">
      ${full.days.map((d, di) => `
      <div class="card" data-di="${di}">
        <div class="row between mb">
          <h4>${esc(d.title || `Día ${di + 1}`)}</h4>
          <span class="badge">${d.items.length} ejercicios</span>
        </div>
        <div class="list small mb">
          ${d.items.slice(0, 5).map(it => `<div class="item"><span>${esc(it.nombre)}</span> <span class="muted tiny">${it.sets}×${esc(it.reps)}</span></div>`).join('')}
          ${d.items.length > 5 ? `<div class="item muted tiny">＋ ${d.items.length - 5} ejercicios más…</div>` : ''}
        </div>
        <button class="btn primary block" data-startday="${di}" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('play', '', 16)} Iniciar Entrenamiento Guiado</button>
      </div>`).join('')}
    </div>`;

    el.onclick = async e => {
      const btn = e.target.closest('[data-startday]');
      if (!btn) return;
      const di = +btn.dataset.startday;

      let lastWeights = {};
      try { lastWeights = await api.get('/member/last-weights'); } catch (err) { }

      RD.startWorkout({
        routine: full,
        dayIndex: di,
        lastWeights,
        exercises: exMap,
        onFinish: async payload => api.post('/member/workouts', payload)
      });
    };
  }

  function renderFreeWorkoutLauncher(el, exMap) {
    el.innerHTML = `
    <div class="card center mb" style="padding:2.5rem 1rem">
      <div style="margin:0 auto 1rem;color:var(--gold);display:flex;justify-content:center">${RD.icon('zap', 'gold', 46)}</div>
      <h2>Entrenamiento Libre / Registro Rápido</h2>
      <p class="muted small mb" style="max-width:440px;margin:0 auto .8rem">
        ¿Quieres hacer un entrenamiento espontáneo hoy sin ceñirte a una rutina fija?
        Selecciona ejercicios al vuelo de nuestra biblioteca de más de 85 ejercicios, registra tus series y pesos con cronómetro automático, y se guardará en tu historial y récords personales.
      </p>
      <button class="btn ok lg" id="btn_start_free_act" style="font-size:1.1rem;padding:0.9rem 1.8rem;display:inline-flex;align-items:center;gap:8px">${RD.icon('play', '', 18)} Iniciar Sesión Libre Ahora</button>
    </div>`;

    el.querySelector('#btn_start_free_act').onclick = async () => {
      let lastWeights = {};
      try { lastWeights = await api.get('/member/last-weights'); } catch {}
      RD.startFreeWorkout({ exercises: exMap, lastWeights, onFinish: p => api.post('/member/workouts', p) });
    };
  }

  function renderSmartRoutineWizard(el, templates) {
    el.innerHTML = `
    <div class="card mb">
      <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('bot', 'gold', 20)} Asistente Inteligente de Rutinas</h3>
      <p class="muted small mb">Responde 3 preguntas y te recomendaremos el plan científicamente óptimo para ti.</p>

      <div class="mb">
        <b>1. ¿Cuál es tu objetivo principal?</b>
        <div class="grid mt2">
          <div class="wizard-option selected" data-wz-goal="hipertrofia">
            <span style="color:var(--gold);display:flex;align-items:center">${RD.icon('dumbbell', 'gold', 24)}</span>
            <div><b>Ganar Masa Muscular & Hipertrofia</b><div class="tiny muted">Volumen muscular, desarrollo estético y proporción</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="grasa">
            <span style="color:var(--gold);display:flex;align-items:center">${RD.icon('flame', 'gold', 24)}</span>
            <div><b>Perder Grasa & Tonificación</b><div class="tiny muted">Déficit calórico, circuitos metabólicos y quema de grasa</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="fuerza">
            <span style="color:var(--gold);display:flex;align-items:center">${RD.icon('barbell', 'gold', 24)}</span>
            <div><b>Fuerza Máxima (Powerbuilding)</b><div class="tiny muted">Levantamiento pesado de sentadilla, banca y peso muerto</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="gluteo">
            <span style="color:var(--gold);display:flex;align-items:center">${RD.icon('target', 'gold', 24)}</span>
            <div><b>Glúteos & Tren Inferior Pro</b><div class="tiny muted">Especialización en glúteos redondos, femorales y cintura fina</div></div>
          </div>
        </div>
      </div>

      <div class="mb">
        <b>2. ¿Cuántos días por semana puedes entrenar?</b>
        <div class="chips mt2" id="wz_days_chips">
          <span class="chip on" data-wz-days="3">3 días</span>
          <span class="chip" data-wz-days="4">4 días</span>
          <span class="chip" data-wz-days="6">6 días</span>
        </div>
      </div>

      <div class="mb">
        <b>3. Tu nivel de experiencia en gimnasio:</b>
        <div class="chips mt2" id="wz_lev_chips">
          <span class="chip on" data-wz-lev="principiante">Principiante (0 - 6 meses)</span>
          <span class="chip" data-wz-lev="intermedio">Intermedio (6m - 2 años)</span>
          <span class="chip" data-wz-lev="avanzado">Avanzado (+2 años)</span>
        </div>
      </div>

      <button class="btn primary block lg mt" id="wz_recommend_btn" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('sparkles', '', 18)} Recomendar Mi Rutina Ideal</button>
    </div>

    <div id="wz_result_box"></div>`;

    el.querySelectorAll('.wizard-option').forEach(opt => {
      opt.onclick = () => {
        el.querySelectorAll('.wizard-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
      };
    });
    el.querySelector('#wz_days_chips').onclick = e => {
      const c = e.target.closest('[data-wz-days]');
      if (!c) return;
      el.querySelectorAll('#wz_days_chips .chip').forEach(x => x.classList.toggle('on', x === c));
    };
    el.querySelector('#wz_lev_chips').onclick = e => {
      const c = e.target.closest('[data-wz-lev]');
      if (!c) return;
      el.querySelectorAll('#wz_lev_chips .chip').forEach(x => x.classList.toggle('on', x === c));
    };

    el.querySelector('#wz_recommend_btn').onclick = () => {
      const goal = el.querySelector('.wizard-option.selected')?.dataset.wzGoal || 'hipertrofia';
      const days = parseInt(el.querySelector('#wz_days_chips .chip.on')?.dataset.wzDays || '3', 10);
      const lev = el.querySelector('#wz_lev_chips .chip.on')?.dataset.wzLev || 'principiante';

      let match = templates.find(t => {
        const tName = t.name.toLowerCase();
        if (goal === 'gluteo' && tName.includes('glúteo')) return true;
        if (goal === 'fuerza' && tName.includes('fuerza')) return true;
        if (goal === 'grasa' && (tName.includes('grasa') || tName.includes('exprés'))) return true;
        if (days === 6 && tName.includes('6 días')) return true;
        if (days === 4 && tName.includes('4 días')) return true;
        return false;
      }) || templates[0];

      const resBox = el.querySelector('#wz_result_box');
      resBox.innerHTML = `
        <div class="card mb" style="border:2px solid var(--gold);background:rgba(183,110,121,0.08)">
          <div class="badge ok mb" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('check', '', 14)}<span>Plan Recomendado para Ti</span></div>
          <h2>${esc(match.name)}</h2>
          <p class="muted small">${esc(match.description || match.goal)}</p>
          <div class="chips mb">
            <span class="badge info">${esc(match.level)}</span>
            <span class="badge" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('calendar', '', 14)}<span>${match.days} días / semana</span></span>
          </div>
          <button class="btn ok block lg" id="wz_apply_btn" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('check', '', 18)} Activar y Comenzar Este Plan</button>
        </div>`;

      resBox.querySelector('#wz_apply_btn').onclick = async () => {
        await api.post(`/member/routines/${match.id}/follow`);
        RD.toast('Rutina recomendada activada con éxito');
        document.querySelector('[data-tt="my"]').click();
      };
      resBox.scrollIntoView({ behavior: 'smooth' });
    };
  }

  function renderRoutineTemplates(el, templates) {
    el.innerHTML = `
    <div class="grid g2">
      ${templates.map(r => `
      <div class="card" data-tpl="${r.id}">
        <span class="badge info">${esc(r.level || 'Todos')}</span>
        <h3 class="mt2" style="margin-bottom:.2rem">${esc(r.name)}</h3>
        <p class="muted small" style="min-height:2.6em">${esc(r.goal || r.description || '')}</p>
        <div class="small muted mb" style="display:flex;align-items:center;gap:5px">${RD.icon('calendar', '', 14)}<span>${r.days} días por semana</span></div>
        <div class="row gap">
          <button class="btn sm" data-act="viewtpl">Ver detalle</button>
          <button class="btn sm primary" data-act="applytpl">Seguir esta rutina</button>
        </div>
      </div>`).join('')}
    </div>`;

    el.onclick = async e => {
      const card = e.target.closest('[data-tpl]');
      if (!card) return;
      const rid = +card.dataset.tpl;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;

      if (act === 'viewtpl') {
        const full = await api.get('/routines/' + rid);
        RD.openModal(full.name, `
          <div class="muted small mb">${esc(full.goal || full.description || '')}</div>
          ${full.days.map((d, di) => `
          <div class="card flat mt mb">
            <h4>${esc(d.title || `Día ${di + 1}`)} (${d.items.length} ejercicios)</h4>
            <div class="list">
              ${d.items.map(it => `<div class="item"><b>${esc(it.nombre)}</b> <span class="muted small">${it.sets}×${esc(it.reps)} ${it.rest ? `(${it.rest}s descanso)` : ''}</span></div>`).join('')}
            </div>
          </div>`).join('')}
        `);
      } else if (act === 'applytpl') {
        if (await RD.confirm('Cambiar rutina', '¿Deseas activar esta rutina para tus entrenamientos diarios?', 'Activar')) {
          await api.post(`/member/routines/${rid}/follow`);
          RD.toast('Rutina activada con éxito');
          document.querySelector('[data-tt="my"]').click();
        }
      }
    };
  }

  // ---------------- TAB 3: PROGRESO Y DESARROLLO INTEGRAL (CORRELACIÓN EJERCICIOS + ASISTENCIAS + RUTINAS + HORARIOS) ----------------
  async function renderProgressTab(el) {
    const [prs, workouts, measurements, attendance, payments, analytics] = await Promise.all([
      api.get('/member/prs').catch(() => []),
      api.get('/member/workouts').catch(() => []),
      api.get('/member/measurements').catch(() => []),
      api.get('/member/attendance').catch(() => []),
      api.get('/member/payments').catch(() => []),
      api.get('/member/analytics').catch(() => ({ muscleDistribution: [], weeklyVolume: [], topExercises: [] }))
    ]);

    const adh = analytics.adherence || {};
    const sch = analytics.schedule || {};
    const dev = analytics.development || { score: 0, athleteLevel: 'En Progreso Activo', insights: [] };
    const actR = analytics.activeRoutine;
    const bDelta = analytics.bodyDelta;
    const topEx = analytics.topExercises || [];

    el.innerHTML = `
    <div class="chips mb" id="ptabs">
      <span class="chip on" data-pt="charts" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('chart', '', 14)}<span>Desarrollo Integral</span></span>
      <span class="chip" data-pt="prs" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('trophy', '', 14)}<span>Récords (${prs.length})</span></span>
      <span class="chip" data-pt="body" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('ruler', '', 14)}<span>Medidas (${measurements.length})</span></span>
      <span class="chip" data-pt="history" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('activity', '', 14)}<span>Asistencias y Sesiones</span></span>
      <span class="chip" data-pt="payments" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('receipt', '', 14)}<span>Pagos (${payments.length})</span></span>
    </div>
    <div id="progresssubview"></div>`;

    const subview = el.querySelector('#progresssubview');

    function fmtDelta(val, unit = '', invertGood = false) {
      if (val == null || isNaN(val)) return '<span class="muted">—</span>';
      if (val === 0) return `<span class="badge ghost tiny">0${unit}</span>`;
      const pos = val > 0;
      const isGood = invertGood ? !pos : pos;
      return `<span class="badge ${isGood ? 'ok' : 'info'} tiny">${pos ? '+' : ''}${val}${unit}</span>`;
    }

    function showSubTab(tab) {
      el.querySelectorAll('#ptabs .chip').forEach(c => c.classList.toggle('on', c.dataset.pt === tab));

      if (tab === 'charts') {
        const shiftTotal = Math.max(1, (sch.morning || 0) + (sch.afternoon || 0) + (sch.evening || 0));
        const pctM = Math.round(((sch.morning || 0) / shiftTotal) * 100);
        const pctA = Math.round(((sch.afternoon || 0) / shiftTotal) * 100);
        const pctE = Math.round(((sch.evening || 0) / shiftTotal) * 100);
        const weekdays = sch.weekdayDistribution || [
          { day: 'Lun', count: 0 }, { day: 'Mar', count: 0 }, { day: 'Mié', count: 0 },
          { day: 'Jue', count: 0 }, { day: 'Vie', count: 0 }, { day: 'Sáb', count: 0 }, { day: 'Dom', count: 0 }
        ];
        const maxDow = Math.max(1, ...weekdays.map(w => w.count || 0));

        subview.innerHTML = `
          <!-- TARJETA EJECUTIVA CON MARCA DE AGUA OFICIAL Y EXPEDIENTE IMPRIMIBLE -->
          <div class="card mb watermark-container" style="border:1px solid var(--gold);background:linear-gradient(145deg,rgba(15,23,42,0.92),rgba(183,110,121,0.12))">
            <div class="watermark-bg">RD FITNESS CLUB</div>
            <div class="row between wrap gap" style="position:relative;z-index:1;align-items:center">
              <div class="row gap" style="align-items:center">
                ${RD.LOGO_SVG(48)}
                <div>
                  <div class="tiny gold" style="font-weight:800;letter-spacing:1px;text-transform:uppercase">Expediente Deportivo Oficial · Chivay</div>
                  <h3 style="margin:2px 0">${esc(member.name)} <span class="badge ok">${esc(dev.athleteLevel)}</span></h3>
                  <div class="tiny muted">Código: <b>${esc(member.code)}</b> · Índice de Desarrollo: <b class="gold">${dev.score}/100 pts</b></div>
                </div>
              </div>
              <button class="btn sm primary" id="btn_open_member_dossier" style="display:flex;align-items:center;gap:6px">
                ${RD.icon('printer', '', 15)} Ficha Oficial de Progreso (PDF)
              </button>
            </div>

            <div class="grid g4 keep gap mt" style="position:relative;z-index:1">
              <div class="stat gold" style="padding:10px 8px">
                <div class="v" style="font-size:1.3rem">${adh.visits30 || 0} días</div>
                <div class="l">Asistencias (30d)</div>
              </div>
              <div class="stat" style="padding:10px 8px">
                <div class="v" style="font-size:1.3rem;color:#38bdf8">${sch.totalGymHours || 0} h</div>
                <div class="l">Horas Entrenadas</div>
              </div>
              <div class="stat" style="padding:10px 8px">
                <div class="v" style="font-size:1.3rem;color:#4ade80">${adh.weeklyAdherencePct || 0}%</div>
                <div class="l">Cumplimiento Sem.</div>
              </div>
              <div class="stat" style="padding:10px 8px">
                <div class="v" style="font-size:1.3rem;color:#f59e0b">${Math.round((analytics.totalVolume || 0) / 1000 * 10) / 10}t</div>
                <div class="l">Tonelaje Movido</div>
              </div>
            </div>
          </div>

          <!-- CORRELACIÓN: MI RUTINA ACTIVA + ASISTENCIAS + HORARIOS -->
          <div class="card mb watermark-container">
            <div class="watermark-bg">DISCIPLINA</div>
            <div style="position:relative;z-index:1">
              <div class="row between wrap gap mb">
                <div>
                  <h3 style="margin:0;display:flex;align-items:center;gap:6px">${RD.icon('layers', 'gold', 18)} Sinergia: Rutina Activa, Asistencia y Horarios</h3>
                  <div class="tiny muted">Relación directa entre tu plan asignado, tus ingresos por puerta y tus horas de mayor rendimiento</div>
                </div>
                <span class="badge info">${esc(sch.chronotype || 'Horario Flexible')}</span>
              </div>

              <!-- Bloque de Rutina vs Asistencia Semanal -->
              <div class="p mb" style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:10px;padding:12px">
                <div class="row between wrap gap">
                  <div>
                    <div class="tiny muted">RUTINA VINCULADA ACTUALMENTE:</div>
                    <b style="font-size:1.05rem;color:var(--gold)">${actR ? esc(actR.name) : 'Sin rutina fija activa (Modo Libre)'}</b>
                    <div class="tiny muted">${actR ? `${esc(actR.goal || '')} · Meta: ${adh.targetDaysPerWeek || 4} sesiones por semana` : 'Ve a la pestaña Entrenar para elegir una rutina estructurada'}</div>
                  </div>
                  <div class="right">
                    <div class="small bold">${Math.max(adh.visitsThisWeek || 0, adh.workoutsThisWeek || 0)} de ${adh.targetDaysPerWeek || 4} días esta semana</div>
                    <div class="tiny muted">Racha: <b>${adh.streakWeeks || 0} sem.</b> · Permanencia prom: <b>${sch.avgDurationMin || 65} min/visita</b></div>
                  </div>
                </div>
                <div class="muscle-track-bg mt2" style="height:10px">
                  <div class="muscle-track-bar" style="width:${adh.weeklyAdherencePct || 0}%;background:linear-gradient(90deg,var(--gold),#22c55e)"></div>
                </div>
              </div>

              <!-- Distribución por Turno Horario y Días de la Semana -->
              <div class="grid g2 gap">
                <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:10px;padding:12px">
                  <div class="small bold mb2" style="display:flex;align-items:center;gap:6px">${RD.icon('clock', 'gold', 15)} Tus Horarios de Entrenamiento (Hora Pico: ${esc(sch.peakHour || '18:00')})</div>
                  <div class="muscle-track-row">
                    <div class="muscle-track-head"><span>Mañana (06:00 - 12:00)</span><b>${sch.morning || 0} vis. (${pctM}%)</b></div>
                    <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${pctM}%;background:#38bdf8"></div></div>
                  </div>
                  <div class="muscle-track-row">
                    <div class="muscle-track-head"><span>Tarde (12:00 - 18:00)</span><b>${sch.afternoon || 0} vis. (${pctA}%)</b></div>
                    <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${pctA}%;background:#f59e0b"></div></div>
                  </div>
                  <div class="muscle-track-row" style="margin-bottom:0">
                    <div class="muscle-track-head"><span>Noche (18:00 - 21:00)</span><b>${sch.evening || 0} vis. (${pctE}%)</b></div>
                    <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${pctE}%;background:#a855f7"></div></div>
                  </div>
                </div>

                <div style="background:rgba(255,255,255,0.02);border:1px solid var(--line);border-radius:10px;padding:12px">
                  <div class="small bold mb2" style="display:flex;align-items:center;gap:6px">${RD.icon('calendar', 'gold', 15)} Frecuencia por Día de la Semana</div>
                  <div class="bars" style="height:95px;align-items:flex-end;gap:6px;padding-top:14px">
                    ${weekdays.map(w => `
                      <div class="b" style="height:${Math.max(6, Math.round((w.count / maxDow) * 100))}%;background:var(--gold);border-radius:5px 5px 0 0">
                        <span style="font-size:0.7rem;font-weight:800">${w.count || ''}</span>
                      </div>
                    `).join('')}
                  </div>
                  <div class="bars-l" style="font-size:0.72rem;font-weight:700">${weekdays.map(w => `<span>${w.day}</span>`).join('')}</div>
                </div>
              </div>

              <!-- Diagnóstico Inteligente del Socio -->
              ${(dev.insights && dev.insights.length) ? `
              <div class="mt2" style="background:rgba(245,180,0,0.07);border-left:3px solid var(--gold);padding:10px 12px;border-radius:0 8px 8px 0">
                <div class="tiny bold gold mb2" style="display:flex;align-items:center;gap:5px">${RD.icon('sparkles', 'gold', 14)} DIAGNÓSTICO DE RENDIMIENTO PERSONALIZADO:</div>
                ${dev.insights.map(ins => `<div class="tiny" style="margin-bottom:4px;line-height:1.4">• ${esc(ins)}</div>`).join('')}
              </div>` : ''}
            </div>
          </div>

          <!-- TRANSFORMACIÓN Y CURVA DE PESO CORPORAL -->
          <div class="card mb">
            <div class="row between wrap gap">
              <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('scale', 'gold', 18)} Evolución Corporal y Curva de Peso</h3>
              <button class="btn sm ghost" id="btn_add_meas_quick" style="display:flex;align-items:center;gap:5px">${RD.icon('plus', '', 14)} Registrar Peso / Medidas</button>
            </div>
            ${bDelta ? `
            <div class="grid g4 keep gap mt2 mb" style="background:rgba(255,255,255,0.02);padding:10px;border-radius:10px;border:1px solid var(--line)">
              <div class="center">
                <div class="tiny muted">Peso Actual</div>
                <div class="bold">${bDelta.latestWeight ? bDelta.latestWeight + ' kg' : '—'}</div>
                <div>${fmtDelta(bDelta.weightDiff, ' kg')}</div>
              </div>
              <div class="center">
                <div class="tiny muted">Cintura</div>
                <div class="bold">${bDelta.latestWaist ? bDelta.latestWaist + ' cm' : '—'}</div>
                <div>${fmtDelta(bDelta.waistDiff, ' cm', true)}</div>
              </div>
              <div class="center">
                <div class="tiny muted">Brazo</div>
                <div class="bold">${bDelta.latestArm ? bDelta.latestArm + ' cm' : '—'}</div>
                <div>${fmtDelta(bDelta.armDiff, ' cm')}</div>
              </div>
              <div class="center">
                <div class="tiny muted">% Grasa</div>
                <div class="bold">${bDelta.latestFat ? bDelta.latestFat + '%' : '—'}</div>
                <div>${fmtDelta(bDelta.fatDiff, '%', true)}</div>
              </div>
            </div>` : ''}
            ${RD.renderWeightSvgChart(measurements)}
          </div>

          <!-- Gráfico de Volumen de Carga Semanal -->
          <div class="card mb">
            <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('activity', 'gold', 18)} Volumen Semanal de Cargas (Kg Levantados)</h3>
            <p class="muted tiny">Muestra el trabajo acumulado por semana (${analytics.totalSets || 0} series registradas en ${analytics.totalWorkouts || 0} sesiones).</p>
            ${RD.renderVolumeSvgChart(analytics.weeklyVolume)}
          </div>

          <!-- Gráfico de Distribución Muscular -->
          <div class="card mb">
            <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('target', 'gold', 18)} Balance Muscular por Series y Grupo</h3>
            <p class="muted tiny">Equilibrio entre tren superior, tren inferior y core según tus ejercicios realizados.</p>
            ${RD.renderMuscleDistribution(analytics.muscleDistribution)}
          </div>

          <!-- TOP EJERCICIOS DOMINADOS Y FUERZA 1RM -->
          <div class="card mb">
            <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('dumbbell', 'gold', 18)} Tus Ejercicios Más Fuertes (Correlación Carga × Volumen)</h3>
            <div class="tbl-wrap mt2">
              <table>
                <thead>
                  <tr>
                    <th>Ejercicio</th>
                    <th>Grupo</th>
                    <th>Series</th>
                    <th>Peso Máx</th>
                    <th>1RM Est.</th>
                    <th>Volumen Acum.</th>
                  </tr>
                </thead>
                <tbody>
                  ${topEx.map(ex => `
                  <tr>
                    <td><b>${esc(ex.nombre)}</b></td>
                    <td><span class="badge tiny">${esc(ex.grupo)}</span></td>
                    <td>${ex.sets_count} series</td>
                    <td class="gold bold">${ex.max_weight} kg <span class="tiny muted">(${ex.max_reps}r)</span></td>
                    <td style="font-weight:700;color:#38bdf8">${ex.est_1rm} kg</td>
                    <td class="small muted">${Number(ex.total_volume || 0).toLocaleString('es-PE')} kg</td>
                  </tr>`).join('') || '<tr><td colspan="6" class="empty">Registra tus series en la pestaña Entrenar para analizar tu fuerza por ejercicio</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;

        subview.querySelector('#btn_add_meas_quick').onclick = () => openAddMeasurementModal(() => renderProgressTab(el));
        subview.querySelector('#btn_open_member_dossier').onclick = () => openMemberOfficialProgressModal({ prs, workouts, measurements, attendance, analytics });
      } else if (tab === 'prs') {
        subview.innerHTML = `
          <div class="card mb watermark-container">
            <div class="watermark-bg">RECORDS PR</div>
            <div class="row between wrap gap mb" style="position:relative;z-index:1">
              <div>
                <h3 style="margin:0;display:flex;align-items:center;gap:6px">${RD.icon('trophy', 'gold', 20)} Récords Personales Históricos (PRs)</h3>
                <div class="muted tiny">Cargas máximas verificadas y estimación de 1 Repetición Máxima (1RM Epley)</div>
              </div>
              <button class="btn sm primary" id="btn_open_1rm_tool" style="display:flex;align-items:center;gap:5px">${RD.icon('dumbbell', '', 14)} Calcular 1RM</button>
            </div>
            <div class="list" style="position:relative;z-index:1">
              ${prs.map(p => {
                const est1rm = Math.round(p.weight * (1 + Math.min(15, p.reps || 1) / 30));
                return `
                <div class="item">
                  <span class="grow">
                    <b>${esc(p.nombre)}</b> ${p.grupo ? `<span class="badge tiny">${esc(p.grupo)}</span>` : ''}
                    <div class="muted tiny">Mejor serie: <b>${p.weight} kg × ${p.reps || 1} reps</b> · 1RM estimado: <b style="color:#38bdf8">${est1rm} kg</b> ${p.day ? `· ${RD.fmtDate(p.day)}` : ''}</div>
                  </span>
                  <span class="gold" style="font-size:1.3rem;font-weight:900">${p.weight} kg</span>
                </div>`;
              }).join('') || '<div class="empty">Registra tus sesiones guiadas o libres para desbloquear tus récords personales.</div>'}
            </div>
          </div>`;

        subview.querySelector('#btn_open_1rm_tool').onclick = () => RD.open1RMCalculator(70, 8);
      } else if (tab === 'body') {
        subview.innerHTML = `
          <div class="card mb watermark-container">
            <div class="watermark-bg">RD FITNESS</div>
            <div class="row between wrap gap mb" style="position:relative;z-index:1">
              <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('ruler', 'gold', 18)} Historial de Medidas Corporales y Antropometría</h3>
              <button class="btn sm primary" id="btn_add_meas" style="display:flex;align-items:center;gap:5px">${RD.icon('plus', '', 14)} Registrar Medidas</button>
            </div>
            <div class="tbl-wrap" style="position:relative;z-index:1">
              <table>
                <thead><tr><th>Fecha</th><th>Peso</th><th>% Grasa</th><th>Cintura</th><th>Pecho</th><th>Brazo</th><th>Pierna</th><th>Cadera</th></tr></thead>
                <tbody>
                  ${measurements.slice().reverse().map(m => `
                  <tr>
                    <td><b>${RD.fmtDate(m.day)}</b></td>
                    <td style="font-weight:700;color:var(--gold)">${m.weight ? m.weight + ' kg' : '—'}</td>
                    <td>${m.body_fat ? m.body_fat + ' %' : '—'}</td>
                    <td>${m.waist ? m.waist + ' cm' : '—'}</td>
                    <td>${m.chest ? m.chest + ' cm' : '—'}</td>
                    <td>${m.arm ? m.arm + ' cm' : '—'}</td>
                    <td>${m.thigh ? m.thigh + ' cm' : '—'}</td>
                    <td>${m.hip ? m.hip + ' cm' : '—'}</td>
                  </tr>`).join('') || '<tr><td colspan="8" class="empty">Sin medidas registradas aún</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;

        subview.querySelector('#btn_add_meas').onclick = () => openAddMeasurementModal(() => renderProgressTab(el));
      } else if (tab === 'history') {
        subview.innerHTML = `
          <div class="card mb">
            <h3 style="display:flex;align-items:center;gap:6px">${RD.icon('activity', 'gold', 18)} Sesiones de Rutina Completadas (${workouts.length})</h3>
            <div class="list">
              ${workouts.map(w => `
              <div class="item">
                <div class="grow">
                  <b>${esc(w.title)}</b>
                  <div class="muted small">${RD.fmtDate(w.day)} · Duración de rutina: ${RD.fmtDur(w.duration_sec)}</div>
                </div>
                <div class="right">
                  <span class="badge info">${Math.round(w.volume)} kg</span>
                </div>
              </div>`).join('') || '<div class="empty">Aún no has completado entrenamientos guiados</div>'}
            </div>
          </div>
          <div class="card mb">
            <div class="row between wrap gap mb">
              <h3 style="margin:0;display:flex;align-items:center;gap:6px">${RD.icon('calendar', 'gold', 18)} Registro Oficial de Asistencias y Permanencia (${attendance.length})</h3>
              <button class="btn sm ghost" id="btn_hist_dossier">${RD.icon('printer', '', 14)} Imprimir Ficha</button>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Permanencia</th><th>Estado</th></tr></thead>
                <tbody>
                  ${attendance.slice(0, 35).map(a => {
                    const enterT = a.ts ? RD.fmtTime(a.ts) : '—';
                    const exitT = a.exit_ts ? RD.fmtTime(a.exit_ts) : (a.status === 'inside' ? 'En sala' : '—');
                    const dur = a.duration_min ? `${a.duration_min} min` : '—';
                    return `
                    <tr>
                      <td><b>${RD.fmtDate(a.day)}</b></td>
                      <td style="font-family:monospace">${enterT}</td>
                      <td style="font-family:monospace">${exitT}</td>
                      <td style="font-weight:700;color:var(--gold)">${dur}</td>
                      <td><span class="badge ok tiny">${RD.icon('check', '', 11)} Asistió</span></td>
                    </tr>`;
                  }).join('') || '<tr><td colspan="5" class="empty">Sin asistencias registradas</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;

        subview.querySelector('#btn_hist_dossier').onclick = () => openMemberOfficialProgressModal({ prs, workouts, measurements, attendance, analytics });
      } else if (tab === 'payments') {
        subview.innerHTML = `
          <div class="card watermark-container">
            <div class="watermark-bg">RD FITNESS</div>
            <h3 style="display:flex;align-items:center;gap:6px;position:relative;z-index:1">${RD.icon('receipt', 'gold', 18)} Tus Pagos, Membresías y Boletas Electrónicas</h3>
            <div class="tbl-wrap" style="position:relative;z-index:1">
              <table>
                <thead><tr><th>Fecha</th><th>N° Boleta</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Ticket</th></tr></thead>
                <tbody>
                  ${payments.map(p => `
                  <tr>
                    <td>${RD.fmtDate(p.day)}</td>
                    <td style="font-family:monospace" class="small muted">${esc(p.receipt_no || ('B001-' + String(p.id || 0).padStart(6, '0')))}</td>
                    <td><b>${esc(p.concept)}</b></td>
                    <td style="font-weight:700;color:var(--gold)">${money(p.amount)}</td>
                    <td><span class="badge">${esc(p.method)}</span></td>
                    <td>${p.id ? `<button class="btn sm ghost" data-payreceipt="${p.id}">${RD.icon('receipt', '', 13)} Boleta</button>` : ''}</td>
                  </tr>`).join('') || '<tr><td colspan="6" class="empty">Sin pagos registrados</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;

        subview.querySelectorAll('[data-payreceipt]').forEach(btn => {
          btn.onclick = () => RD.showReceipt(+btn.dataset.payreceipt);
        });
      }
    }

    el.querySelector('#ptabs').onclick = e => {
      const c = e.target.closest('[data-pt]');
      if (c) showSubTab(c.dataset.pt);
    };

    showSubTab('charts');
  }

  function openMemberOfficialProgressModal({ prs, workouts, measurements, attendance, analytics }) {
    const adh = analytics.adherence || {};
    const sch = analytics.schedule || {};
    const dev = analytics.development || {};
    const actR = analytics.activeRoutine;
    const topEx = analytics.topExercises || [];
    const pub = JSON.parse(localStorage.getItem('rd_public') || '{}');

    const m = RD.openModal(`${RD.icon('award')} Informe Oficial de Progreso y Rendimiento Deportivo`, `
      <div class="member-sheet-card watermark-container">
        <div class="watermark-bg">RD FITNESS CLUB</div>

        <div class="member-sheet-header">
          <div class="logo-box">${RD.LOGO_SVG(58)}</div>
          <div class="grow">
            <h2 style="margin:0;color:var(--gold);font-weight:900;letter-spacing:1px">${esc(pub.gym_name || 'RD FITNESS CLUB')} · SEDE CHIVAY</h2>
            <div class="small muted">${esc(pub.gym_slogan || 'Disciplina · Constancia · Resultados · Valle del Colca')}</div>
            <div class="tiny muted">RUC: 10702548911 · ${esc(RD.cleanAddress(pub.gym_address))} · Tel: ${esc(pub.gym_phone || '982404043')}</div>
          </div>
          <div class="no-print">
            <button class="btn primary sm" id="btn_print_member_dossier">${RD.icon('printer', '', 14)} Imprimir / Guardar PDF</button>
          </div>
        </div>

        <div class="member-sheet-profile">
          <div>
            ${member.photo ? `<img src="${esc(member.photo)}" style="width:64px;height:64px;border-radius:10px;object-fit:cover;border:2px solid var(--gold)">` : `<div style="width:64px;height:64px;border-radius:10px;background:#334155;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:bold">${esc((member.name || 'S')[0])}</div>`}
          </div>
          <div>
            <div style="font-size:1.15rem;font-weight:800">${esc(member.name)}</div>
            <div class="small"><b>Código:</b> <span class="badge">${esc(member.code)}</span> · <b>DNI:</b> ${esc(member.dni || '—')} · <b>Objetivo:</b> ${esc(member.goal || 'Desarrollo Integral')}</div>
            <div class="tiny muted mt2">Rutina Activa: <b>${actR ? esc(actR.name) : 'Entrenamiento Libre'}</b> · Horario Habitual: <b>${esc(sch.chronotype || 'Flexible')} (Pico ${esc(sch.peakHour || '18:00')})</b></div>
          </div>
          <div class="right">
            <div class="badge ok">${esc(dev.athleteLevel || 'Socio Activo')}</div>
            <div class="small mt2"><b>Score:</b> <span class="gold bold">${dev.score || 0}/100 pts</span></div>
            <div class="tiny muted">Emitido: ${new Date().toLocaleDateString('es-PE')}</div>
          </div>
        </div>

        <div class="member-sheet-kpis">
          <div class="kpi-box">
            <div style="font-size:1.3rem;font-weight:800;color:var(--gold)">${adh.visits30 || 0} días</div>
            <div class="tiny muted">Asistencias (Últ. 30 días)</div>
          </div>
          <div class="kpi-box">
            <div style="font-size:1.3rem;font-weight:800;color:#38bdf8">${sch.totalGymHours || 0} hrs</div>
            <div class="tiny muted">Tiempo Total de Entreno</div>
          </div>
          <div class="kpi-box">
            <div style="font-size:1.3rem;font-weight:800;color:#4ade80">${adh.monthlyAdherencePct || 0}%</div>
            <div class="tiny muted">Cumplimiento de Meta</div>
          </div>
          <div class="kpi-box">
            <div style="font-size:1.3rem;font-weight:800;color:#a855f7">${Number(analytics.totalVolume || 0).toLocaleString('es-PE')} kg</div>
            <div class="tiny muted">Volumen Total Levantado</div>
          </div>
        </div>

        <div class="grid g2 gap mb" style="position:relative;z-index:1">
          <div>
            <h4 class="mb2">Top Ejercicios y Récords de Fuerza (PRs)</h4>
            <table>
              <thead><tr><th>Ejercicio</th><th>Grupo</th><th>Peso Máx</th><th>1RM Est.</th></tr></thead>
              <tbody>
                ${(topEx.length ? topEx : prs).slice(0, 6).map(x => `
                <tr>
                  <td><b>${esc(x.nombre)}</b></td>
                  <td>${esc(x.grupo || 'Fuerza')}</td>
                  <td class="bold">${x.max_weight || x.weight} kg</td>
                  <td>${x.est_1rm || Math.round((x.weight || 0) * 1.15)} kg</td>
                </tr>`).join('') || '<tr><td colspan="4" class="empty">Sin registros de fuerza</td></tr>'}
              </tbody>
            </table>
          </div>
          <div>
            <h4 class="mb2">Control Antropométrico Reciente</h4>
            <table>
              <thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Brazo</th><th>% Grasa</th></tr></thead>
              <tbody>
                ${measurements.slice(-5).reverse().map(ms => `
                <tr>
                  <td>${RD.fmtDate(ms.day)}</td>
                  <td><b>${ms.weight ? ms.weight + ' kg' : '—'}</b></td>
                  <td>${ms.waist ? ms.waist + ' cm' : '—'}</td>
                  <td>${ms.arm ? ms.arm + ' cm' : '—'}</td>
                  <td>${ms.body_fat ? ms.body_fat + '%' : '—'}</td>
                </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin mediciones registradas</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <h4 class="mb2" style="position:relative;z-index:1">Últimas Asistencias Verificadas en Recepción</h4>
        <div class="tbl-wrap" style="position:relative;z-index:1">
          <table>
            <thead><tr><th>#</th><th>Fecha</th><th>Hora Ingreso</th><th>Hora Salida</th><th>Permanencia</th><th>Estado</th></tr></thead>
            <tbody>
              ${attendance.slice(0, 12).map((a, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td><b>${RD.fmtDate(a.day)}</b></td>
                <td style="font-family:monospace">${a.ts ? RD.fmtTime(a.ts) : '—'}</td>
                <td style="font-family:monospace">${a.exit_ts ? RD.fmtTime(a.exit_ts) : '—'}</td>
                <td><b>${a.duration_min ? a.duration_min + ' min' : 'Sesión estándar'}</b></td>
                <td>Ingreso Verificado QR</td>
              </tr>`).join('') || '<tr><td colspan="6" class="empty">Sin asistencias recientes</td></tr>'}
            </tbody>
          </table>
        </div>

        <div class="member-sheet-signatures">
          <div class="sig-box">
            <b>${esc(member.name)}</b><br>
            <span class="muted">Socio Oficial (${esc(member.code)})</span>
          </div>
          <div class="sig-box">
            <b>DIRECCIÓN DEPORTIVA</b><br>
            <span class="muted">RD Fitness Club · Chivay<br>Certificación Digital de Progreso</span>
          </div>
        </div>
      </div>
    `, { wide: true });

    m.el.querySelector('#btn_print_member_dossier')?.addEventListener('click', () => window.print());
  }

  function openAddMeasurementModal(onDone) {
    const d = RD.openModal('Registrar mi peso y medidas', `
      <form id="mf">
        <div class="grid g2 keep mb">
          <label class="field"><span>Peso (kg) *</span><input name="weight" type="number" step="0.1" placeholder="Ej. 68.5"></label>
          <label class="field"><span>Estatura (cm)</span><input name="height" type="number" step="0.5" placeholder="Ej. 170"></label>
        </div>
        <div class="grid g2 keep mb">
          <label class="field"><span>Cintura (cm)</span><input name="waist" type="number" step="0.5" placeholder="Ej. 82"></label>
          <label class="field"><span>Pecho (cm)</span><input name="chest" type="number" step="0.5" placeholder="Ej. 95"></label>
        </div>
        <div class="grid g2 keep mb">
          <label class="field"><span>Brazo (cm)</span><input name="arm" type="number" step="0.5" placeholder="Ej. 32"></label>
          <label class="field"><span>Muslo / Pierna (cm)</span><input name="thigh" type="number" step="0.5" placeholder="Ej. 54"></label>
        </div>
        <div class="grid g2 keep mb">
          <label class="field"><span>Cadera (cm)</span><input name="hip" type="number" step="0.5" placeholder="Ej. 96"></label>
          <label class="field"><span>Grasa Corporal (%)</span><input name="body_fat" type="number" step="0.1" placeholder="Ej. 16.5"></label>
        </div>
        <button class="btn primary block mt">Guardar Progreso</button>
      </form>
    `);

    d.el.querySelector('#mf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        await api.post('/member/measurements', {
          weight: f.weight.value || null,
          height: f.height.value || null,
          waist: f.waist.value || null,
          chest: f.chest.value || null,
          arm: f.arm.value || null,
          thigh: f.thigh.value || null,
          hip: f.hip.value || null,
          body_fat: f.body_fat.value || null
        });
        RD.toast('Medidas guardadas con éxito');
        d.close();
        if (onDone) onDone();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  // ---------------- TAB 4: HERRAMIENTAS PRO DEPORTIVAS ----------------
  async function renderToolsTab(el) {
    el.innerHTML = `
    <div class="card mb flat">
      <h2 style="display:flex;align-items:center;gap:8px">${RD.icon('tools', 'gold', 24)} Herramientas Deportivas Pro</h2>
      <p class="muted small">Calculadoras científicas diseñadas para sacarle el máximo provecho a cada entrenamiento y alimentación.</p>
    </div>

    <div class="grid g2 gap mb">
      <div class="card tool-card" id="tool_1rm" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:var(--gold);margin-bottom:.5rem">${RD.icon('barbell', 'gold', 32)}</div>
        <h3 class="mt2">Calculadora 1RM</h3>
        <p class="muted small">Predice tu fuerza máxima a 1 repetición y tabla exacta de cargas del 100% al 65%.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('dumbbell', '', 14)} Abrir Calculadora</button>
      </div>

      <div class="card tool-card" id="tool_plates" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:var(--gold);margin-bottom:.5rem">${RD.icon('layers', 'gold', 32)}</div>
        <h3 class="mt2">Discos de Barra</h3>
        <p class="muted small">Visualiza qué discos colocar a cada lado de la barra con los colores oficiales de halterofilia.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('layers', '', 14)} Calcular Discos</button>
      </div>

      <div class="card tool-card" id="tool_nutrition" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:var(--gold);margin-bottom:.5rem">${RD.icon('apple', 'gold', 32)}</div>
        <h3 class="mt2">Macros & Calorías TDEE</h3>
        <p class="muted small">Gasto calórico real y gramos exactos de proteínas, carbos y grasas según tu objetivo.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('apple', '', 14)} Calcular Dieta</button>
      </div>

      <div class="card tool-card" id="tool_fat" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:var(--gold);margin-bottom:.5rem">${RD.icon('ruler', 'gold', 32)}</div>
        <h3 class="mt2">Grasa Corporal (US Navy)</h3>
        <p class="muted small">Estimación científica de porcentaje graso usando tus contornos corporales.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('ruler', '', 14)} Calcular Grasa</button>
      </div>

      <div class="card tool-card" id="tool_water" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:#0284c7;margin-bottom:.5rem">${RD.icon('water', '', 32)}</div>
        <h3 class="mt2">Hidratación en Altura</h3>
        <p class="muted small">Calcula cuántos litros de agua necesitas al día en el clima y altitud de Chivay.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('water', '', 14)} Calcular Agua</button>
      </div>

      <div class="card tool-card" id="tool_timers" style="cursor:pointer">
        <div class="tool-icon-wrap" style="color:var(--gold);margin-bottom:.5rem">${RD.icon('timer', 'gold', 32)}</div>
        <h3 class="mt2">Tabata, HIIT y EMOM</h3>
        <p class="muted small">Cronómetros de intervalos con avisos sonoros y vibración offline.</p>
        <button class="btn sm primary mt" style="display:flex;align-items:center;gap:5px">${RD.icon('timer', '', 14)} Abrir Cronómetros</button>
      </div>
    </div>`;

    el.querySelector('#tool_1rm').onclick = () => RD.open1RMCalculator(70, 8);
    el.querySelector('#tool_plates').onclick = () => RD.openPlateCalculator(60, 20);
    el.querySelector('#tool_nutrition').onclick = () => RD.openNutritionCalculator(member || {});
    el.querySelector('#tool_fat').onclick = () => {
      const m = RD.openModal('Calculadora de Grasa (US Navy)', `
        <div class="mb">
          <p class="muted small mb">Fórmula de la Marina de EE.UU. para estimar el porcentaje de grasa corporal.</p>
          <label class="field"><span>Género</span>
            <select id="bf_g"><option value="male">Hombre</option><option value="female">Mujer</option></select>
          </label>
          <div class="grid g2 keep mb">
            <label class="field"><span>Estatura (cm)</span><input id="bf_h" type="number" value="170"></label>
            <label class="field"><span>Cuello (cm)</span><input id="bf_n" type="number" value="38"></label>
          </div>
          <div class="grid g2 keep mb">
            <label class="field"><span>Cintura (cm)</span><input id="bf_w" type="number" value="82"></label>
            <label class="field" id="bf_hip_wrap" style="display:none"><span>Cadera (cm)</span><input id="bf_hp" type="number" value="95"></label>
          </div>
        </div>
        <div class="card center mb" style="background:rgba(183,110,121,0.12);border-color:var(--gold)">
          <div class="muted small">Porcentaje de Grasa Estimado</div>
          <div class="gold" id="bf_res" style="font-size:2.4rem;font-weight:900">-- %</div>
        </div>
      `);
      const upd = () => {
        const g = m.el.querySelector('#bf_g').value;
        m.el.querySelector('#bf_hip_wrap').style.display = g === 'female' ? 'block' : 'none';
        const res = RD.calcBodyFat({
          gender: g,
          height: m.el.querySelector('#bf_h').value,
          neck: m.el.querySelector('#bf_n').value,
          waist: m.el.querySelector('#bf_w').value,
          hip: m.el.querySelector('#bf_hp').value
        });
        m.el.querySelector('#bf_res').textContent = `${res} %`;
      };
      m.el.querySelectorAll('input, select').forEach(i => i.oninput = upd);
      upd();
    };
    el.querySelector('#tool_water').onclick = () => {
      const w = member?.weight || 70;
      const res = RD.calcWater(w, 60);
      RD.openModal('Hidratación Deportiva', `
        <div class="card center mb" style="background:rgba(2,132,199,0.1);border-color:#0284c7">
          <div class="muted small">Requerimiento Diario Estimado</div>
          <div style="font-size:2.6rem;font-weight:900;color:#0284c7">${res} Litros</div>
          <div class="small muted">Aproximadamente ${Math.round(res / 0.25)} vasos de agua al día</div>
        </div>
        <p class="small muted">
          En Chivay (3,635 msnm), el aire es seco y frío, lo que incrementa la pérdida insensible de agua a través de la respiración. Bebe 500 ml antes de entrenar y pequeños sorbos cada 15 minutos en el gimnasio.
        </p>
      `);
    };
    el.querySelector('#tool_timers').onclick = () => {
      const m = RD.openModal('Cronómetros Deportivos y Tabata', '<div id="tim_box"></div>');
      RD.timersTool(m.el.querySelector('#tim_box'));
    };
  }

  // ---------------- TAB 5: PERFIL Y BOLETAS DIGITALES ----------------
  async function renderProfileTab(el) {
    el.innerHTML = `
    <div class="card mb center watermark-container">
      <div class="watermark-bg">RD FITNESS CLUB</div>
      <div style="position:relative;z-index:1">
        <div class="row between mb2">
          ${RD.LOGO_SVG(36)}
          <span class="badge ok">${RD.icon('shield', '', 12)} Socio Verificado</span>
        </div>
        <div class="row" style="justify-content:center;margin-bottom:8px">
          <div class="avatar lg">${member.photo ? `<img src="${esc(member.photo)}" alt="">` : esc((member.name || '?')[0])}</div>
        </div>
        <h2>${esc(member.name)}</h2>
        <div class="gold" style="font-size:1.3rem;font-weight:900">${esc(member.code)}</div>
        <div class="muted small mt2">Socio desde ${RD.fmtDate(member.created_at)}</div>
        <div class="row gap mt2" style="justify-content:center">
          <label class="btn sm ghost" style="cursor:pointer;display:inline-flex;align-items:center;gap:5px">
            ${RD.icon('camera', '', 14)} Cambiar mi foto
            <input type="file" id="pfphotof" accept="image/*" hidden>
          </label>
          <button class="btn sm" id="pfeditinfo" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('edit', '', 14)} Editar mis datos</button>
        </div>
      </div>
    </div>

    <div class="card mb">
      <h3>Información de tu Perfil</h3>
      <div class="list small">
        <div class="item"><span class="muted">DNI:</span> <b class="grow right">${esc(member.dni || '—')}</b></div>
        <div class="item"><span class="muted">Celular:</span> <b class="grow right">${esc(member.phone || '—')}</b></div>
        <div class="item"><span class="muted">Fecha de Nacimiento:</span> <b class="grow right">${RD.fmtDate(member.birth)}</b></div>
        <div class="item"><span class="muted">Objetivo Principal:</span> <b class="grow right">${esc(member.goal || 'General')}</b></div>
        <div class="item"><span class="muted">Nivel de entrenamiento:</span> <b class="grow right">${esc(member.level || 'Principiante')}</b></div>
        <div class="item"><span class="muted">Contacto de emergencia:</span> <b class="grow right">${esc(member.emergency || '—')}</b></div>
        <div class="item"><span class="muted">Observaciones de salud:</span> <b class="grow right">${esc(member.health || 'Sin observaciones')}</b></div>
      </div>
    </div>

    <div class="card mb">
      <h3>Mi cuenta y acceso</h3>
      <div class="list small">
        <div class="item"><span class="muted">Código de socio:</span> <b class="grow right">${esc(member.code)}</b></div>
        <div class="item"><span class="muted">Mi usuario:</span> <b class="grow right">${member.alias ? esc(member.alias) : '<span class="muted">Sin crear</span>'}</b></div>
        <div class="item"><span class="muted">Contraseña:</span> <b class="grow right" style="display:inline-flex;align-items:center;justify-content:flex-end;gap:5px">${member.has_password ? `${RD.icon('check', 'ok', 14)} Configurada` : 'Inicial (tu DNI)'}</b></div>
      </div>
      <div class="grid g2 keep mt2">
        <button class="btn sm ${member.has_password ? '' : 'primary'}" id="pfaccount" style="display:flex;align-items:center;justify-content:center;gap:6px">${member.has_password ? `${RD.icon('lock', '', 14)} Cambiar acceso` : `${RD.icon('sparkles', '', 14)} Crear usuario y contraseña`}</button>
        <button class="btn sm" id="pfdevices" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('smartphone', '', 14)} Mis dispositivos</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Boletas de pago, avisos y ajustes</h3>
      <p class="small muted">Consulta tus boletas electrónicas térmicas, revisa los avisos del club y ajusta alertas de sonido.</p>
      <div class="grid g3 keep gap">
        <button class="btn sm ok" id="pfreceipts" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('receipt', '', 14)} Mis Boletas</button>
        <button class="btn sm" id="pfinbox" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('bell', '', 14)} Avisos</button>
        <button class="btn sm ghost" id="pfprefs" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('settings', '', 14)} Ajustes</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Normas del Club, Privacidad y Seguridad</h3>
      <p class="small muted">Consulta el reglamento interno de convivencia, tu protección de datos (Ley N° 29733) y términos de membresía.</p>
      <div class="grid g2 keep gap">
        <button class="btn sm ghost" id="pf_normas" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('award', '', 14)} Reglamento del Club</button>
        <button class="btn sm ghost" id="pf_privacidad" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('shield', '', 14)} Privacidad y Datos</button>
        <button class="btn sm ghost" id="pf_terminos" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('file-text', '', 14)} Términos de Planes</button>
        <button class="btn sm ghost" id="pf_copyright" style="display:flex;align-items:center;justify-content:center;gap:5px">${RD.icon('lock', '', 14)} Derechos y Seguridad</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Aplicación</h3>
      <div class="row between wrap gap">
        <span class="small">Tema visual</span>
        <button class="btn sm" id="profilethemebtn" style="display:inline-flex;align-items:center;gap:6px">${RD.getTheme && RD.getTheme() === 'light' ? `${RD.icon('moon', '', 14)} Modo Oscuro` : `${RD.icon('sun', '', 14)} Modo Claro`}</button>
      </div>
      <div class="row between wrap gap mt2" id="installrow">
        <div class="small" style="display:flex;align-items:center;gap:6px">
          ${RD.hub.isStandalone() ? `${RD.icon('check-circle', 'ok', 16)} App instalada en este dispositivo` : `${RD.icon('info', 'gold', 16)} Puedes usarla como App en Android, iOS o PC`}
        </div>
        <div class="row gap">
          ${RD.hub.canInstall() ? `<button class="btn sm primary" id="pfinstall" style="display:flex;align-items:center;gap:5px">${RD.icon('zap', '', 14)} Instalar app</button>` : ''}
          <button class="btn sm info" id="pfinstallguide" style="display:flex;align-items:center;gap:5px">${RD.icon('smartphone', '', 14)} Guía de Instalación</button>
        </div>
      </div>
    </div>

    <div class="grid gap">
      <button class="btn danger block" id="outbtn" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('power', '', 16)} Cerrar Sesión</button>
    </div>
    <div class="center muted tiny mt">© ${new Date().getFullYear()} RD Fitness Club · Chivay, Arequipa · Todos los derechos reservados</div>`;

    const redrawProfile = m => {
      member = m;
      localStorage.setItem('rd_member_data', JSON.stringify(m));
      renderProfileTab(el);
    };

    const photoInput = el.querySelector('#pfphotof');
    if (photoInput) {
      photoInput.onchange = async e => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
          const data = await RD.compressPhoto(file);
          const res = await api.post('/member/photo', { data });
          RD.toast('Foto de perfil actualizada');
          redrawProfile(res.member || { ...member, photo: res.photo });
        } catch (err) {
          RD.toast(err.message || 'No se pudo actualizar la foto', 'err');
        }
      };
    }

    el.querySelector('#pfeditinfo').onclick = () => {
      const m = RD.openModal('Editar mis datos de perfil', `
        <form id="pfeditform">
          <div class="grid g2 gap">
            <label class="field"><span>Celular / WhatsApp</span><input name="phone" value="${esc(member.phone || '')}" placeholder="987654321"></label>
            <label class="field"><span>Correo electrónico</span><input name="email" type="email" value="${esc(member.email || '')}" placeholder="correo@ejemplo.com"></label>
            <label class="field"><span>Objetivo deportivo</span>
              <select name="goal">
                ${['Ganar masa muscular', 'Bajar grasa corporal', 'Fuerza y potencia', 'Tonificar glúteos y piernas', 'Salud y condición física', 'Rendimiento atlético'].map(g => `<option value="${esc(g)}" ${member.goal === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
              </select>
            </label>
            <label class="field"><span>Nivel de experiencia</span>
              <select name="level">
                ${[['principiante', 'Principiante'], ['intermedio', 'Intermedio'], ['avanzado', 'Avanzado']].map(([v, l]) => `<option value="${v}" ${(member.level || 'principiante') === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="field mt2"><span>Contacto de emergencia (Nombre y teléfono)</span><input name="emergency" value="${esc(member.emergency || '')}" placeholder="Ej. María (Madre) - 987654321"></label>
          <label class="field mt2"><span>Observaciones médicas o lesiones a considerar</span><input name="health" value="${esc(member.health || '')}" placeholder="Ej. Ninguna / Molestia lumbar leve"></label>
          <div class="row end gap mt">
            <button type="button" class="btn ghost" id="pfcancel">Cancelar</button>
            <button type="submit" class="btn primary">${RD.icon('check', '', 14)} Guardar cambios</button>
          </div>
        </form>
      `);
      m.el.querySelector('#pfcancel').onclick = m.close;
      m.el.querySelector('#pfeditform').onsubmit = async ev => {
        ev.preventDefault();
        const fd = Object.fromEntries(new FormData(ev.target));
        await RD.busy(ev.target.querySelector('button[type=submit]'), async () => {
          try {
            const res = await api.put('/member/profile', fd);
            m.close();
            RD.toast('Tus datos se actualizaron correctamente');
            redrawProfile(res.member);
          } catch (err) {
            RD.toast(err.message, 'err');
          }
        });
      };
    };

    el.querySelector('#pf_normas').onclick = () => RD.openLegalModal('normas');
    el.querySelector('#pf_privacidad').onclick = () => RD.openLegalModal('privacidad');
    el.querySelector('#pf_terminos').onclick = () => RD.openLegalModal('terminos');
    el.querySelector('#pf_copyright').onclick = () => RD.openLegalModal('copyright');

    el.querySelector('#pfaccount').onclick = () => RD.hub.openAccount(member, redrawProfile, { first: !member.has_password });
    el.querySelector('#pfdevices').onclick = () => RD.hub.openDevices();
    el.querySelector('#pfinbox').onclick = () => RD.hub.openInbox();
    el.querySelector('#pfreceipts').onclick = () => RD.hub.openReceipts();
    el.querySelector('#pfprefs').onclick = () => RD.hub.openPrefs();
    const pfi = el.querySelector('#pfinstall');
    if (pfi) pfi.onclick = async () => { if (await RD.hub.install()) { RD.toast('App instalada con éxito'); renderProfileTab(el); } };
    const pfig = el.querySelector('#pfinstallguide');
    if (pfig) pfig.onclick = () => RD.hub.openInstallGuide();

    const ptb = el.querySelector('#profilethemebtn');
    if (ptb) {
      ptb.onclick = () => {
        RD.toggleTheme();
        const isLight = RD.getTheme() === 'light';
        ptb.innerHTML = isLight ? `${RD.icon('moon', '', 14)} Modo Oscuro` : `${RD.icon('sun', '', 14)} Modo Claro`;
      };
    }

    el.querySelector('#outbtn').onclick = async () => {
      if (await RD.confirm('Cerrar sesión', '¿Deseas cerrar tu sesión? Tendrás que ingresar de nuevo en este dispositivo.', 'Salir', true)) {
        logout(false);
      }
    };
  }

  // ---------------- INICIO DE LA APLICACIÓN ----------------
  async function boot() {
    RD.registerSW();
    RD.syncTime();
    RD.hub.keepStorage();

    if (!localStorage.getItem('rd_member_token')) {
      const res = await RD.hub.resume();
      if (res && res.token) {
        localStorage.setItem('rd_member_token', res.token);
        localStorage.setItem('rd_member_data', JSON.stringify(res.member));
        member = res.member;
      } else {
        return showLogin();
      }
    }
    if (!member) member = JSON.parse(localStorage.getItem('rd_member_data') || 'null');
    layout();
    const qs = new URLSearchParams(location.search);
    const tab = qs.get('tab');
    switchTab(['pass', 'train', 'progress', 'tools', 'profile'].includes(tab) ? tab : 'pass');
    if (qs.get('inbox') === '1') { history.replaceState(null, '', '/'); RD.hub.openInbox(); }
    if (location.hash.startsWith('#receipt:')) {
      const pid = +location.hash.replace('#receipt:', '');
      history.replaceState(null, '', location.pathname + location.search);
      if (pid) setTimeout(() => RD.showReceipt(pid), 450);
    }
    window.addEventListener('hashchange', () => {
      if (location.hash.startsWith('#receipt:')) {
        const pid = +location.hash.replace('#receipt:', '');
        history.replaceState(null, '', location.pathname + location.search);
        if (pid) RD.showReceipt(pid);
      }
    });
  }

  window.RDMemberBoot = boot;
})();
