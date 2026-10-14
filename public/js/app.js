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
    const themeLbl = () => RD.getTheme && RD.getTheme() === 'light' ? '🌙 Modo Oscuro' : '☀️ Modo Claro (Pastel)';
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
          <div class="pw"><input name="password" type="password" placeholder="Tu contraseña o DNI" required autocomplete="current-password"><button type="button" class="pw-eye" data-eye aria-label="Mostrar contraseña">👁</button></div>
          <small class="tiny muted">¿Primera vez o regresas después de meses? Tu contraseña inicial es tu <b>DNI</b>. Si olvidaste tu clave, tu DNI siempre te permite ingresar.</small>
        </label>
        <button class="btn primary block" type="submit">Ingresar a mi App</button>
        <p class="center small mt2"><a href="#" id="forgot">¿Olvidaste tu contraseña?</a></p>
        <button type="button" class="btn ghost sm mt2 block" id="btn_login_install">📲 ¿Cómo instalar la App en tu Celular o PC?</button>
        <p class="center muted tiny mt2">Este dispositivo recordará tu sesión de forma segura.</p>
        <div class="card flat mt center small muted">
          ¿Aún no estás registrado? Acércate a recepción en Calle Sucre Lt. 10 para obtener tu código y credencial.
        </div>
        <p class="center muted tiny mt">Personal del gimnasio: <a href="/admin/">Acceso al panel</a></p>
        <div class="center mt2">
          <button type="button" class="btn ghost sm" id="loginthemebtn" data-theme-toggle>${themeLbl()}</button>
        </div>
      </form>
    </div>`;

    const ltb = document.getElementById('loginthemebtn');
    ltb.onclick = () => { RD.toggleTheme(); ltb.textContent = themeLbl(); };
    const bli = document.getElementById('btn_login_install');
    if (bli) bli.onclick = () => RD.hub.openInstallGuide();
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
        <button class="icon-btn" id="appinstallbtn" title="Cómo instalar la App en tu móvil o PC" aria-label="Instalar App">📲</button>
        <button class="icon-btn bell" id="bellbtn" title="Avisos" aria-label="Avisos">🔔<span class="bell-dot" id="belldot" hidden></span></button>
        <button class="icon-btn theme-toggle" id="appthemetoggle" data-theme-toggle title="${isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro (Pastel)'}">${isLight ? '🌙' : '☀️'}</button>
        <button class="icon-btn" id="logoutbtn" title="Cerrar sesión">✕</button>
      </header>
      <div id="noticebar"></div>
      <main class="page" id="mainview"></main>
      <nav class="nav">
        <button data-tab="pass" class="on"><span class="i">🪪</span>Acceso</button>
        <button data-tab="train"><span class="i">🏋️</span>Entrenar</button>
        <button data-tab="progress"><span class="i">📈</span>Progreso</button>
        <button data-tab="tools"><span class="i">🧮</span>Herramientas</button>
        <button data-tab="profile"><span class="i">👤</span>Perfil</button>
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
        <div style="font-size:1.6rem">✨</div>
        <div class="grow">
          <b>Crea tu usuario y contraseña</b>
          <div class="small muted">Ingresa con tu propio alias y protege tu cuenta. Tu código ${esc(member.code)} y tu DNI no cambian.</div>
        </div>
      </div>
      <div class="row end gap mt2">
        <button class="btn sm ghost" id="setuplater">Ahora no</button>
        <button class="btn sm primary" id="setupnow">Configurar</button>
      </div>
    </div>` : ''}

    <div class="idcard">
      <div class="row between">
        <img src="/logo.svg" style="height:32px;width:32px;object-fit:contain" alt="RD" width="32" height="32">
        <span class="tag-loc" style="font-size:10px;font-weight:700;color:var(--gold)">CHIVAY</span>
      </div>

      <div class="center mt2">
        <h2 style="margin:0">${esc(member.name)}</h2>
        <div class="gold" style="font-size:1.4rem;font-weight:900;letter-spacing:1px">${esc(member.code)}</div>
      </div>

      <div class="qr" id="qrcodebox">
        <div class="empty">Generando código…</div>
      </div>

      <div class="countdown" title="Código de seguridad dinámico">
        <i id="cdbar" style="width:100%"></i>
      </div>
      <div class="muted tiny mt2 center">El código se renueva automáticamente cada 60 s para seguridad</div>

      <div class="statusbar ${st} mt">
        <div style="font-size:1.1rem;font-weight:900">${isOk ? '✔ MEMBRESÍA VIGENTE' : isWarn ? '⚠ POR VENCER' : '✖ NO VIGENTE'}</div>
        <div class="small">${esc(member.access_reason)}</div>
        ${member.end_date ? `<div class="tiny mt2">Vence: <b>${RD.fmtDate(member.end_date)}</b> (${esc(member.plan_name || 'Plan')})</div>` : ''}
      </div>

      ${(!isOk) ? `
      <div class="mt">
        <a class="btn primary block" target="_blank" rel="noopener" href="${renewWa}">💳 Renovar Membresía por WhatsApp</a>
      </div>` : ''}
    </div>

    <!-- Acceso Rápido a Entrenar Hoy -->
    <div class="card mt mb" style="background:linear-gradient(135deg,rgba(183,110,121,0.15),rgba(2,132,199,0.1));border-color:var(--gold)">
      <div class="row between mb">
        <div>
          <b style="font-size:1.05rem">🏋️ ¿Listo para entrenar hoy?</b>
          <div class="small muted">Registra tus series, pesos y descansos con cronómetro automático.</div>
        </div>
      </div>
      <div class="grid g2 keep gap">
        <button class="btn primary" id="btn_quick_train">▶ Seguir Mi Rutina</button>
        <button class="btn" id="btn_quick_free">⚡ Sesión Libre</button>
      </div>
    </div>

    <!-- Estadísticas de Constancia -->
    <div class="grid g3 keep mb">
      <div class="stat gold">
        <div class="v">🔥 ${fresh.stats?.streak_weeks || 0}</div>
        <div class="l">Semanas racha</div>
      </div>
      <div class="stat">
        <div class="v">🏃 ${fresh.stats?.visits_30 || 0}</div>
        <div class="l">Visitas este mes</div>
      </div>
      <div class="stat">
        <div class="v">🏋️ ${Math.round((fresh.stats?.volume_30 || 0) / 1000)}k</div>
        <div class="l">Kg levantados</div>
      </div>
    </div>

    ${('Notification' in window) && Notification.permission === 'default' && !localStorage.getItem('rd_push_prompt_dismiss') ? `
    <div class="card mb" id="push_prompt_card" style="background:linear-gradient(135deg,rgba(245,180,0,0.14),rgba(245,180,0,0.04));border:1px solid var(--gold);padding:14px;border-radius:10px">
      <div class="row between wrap gap" style="align-items:center">
        <div class="grow" style="min-width:200px">
          <b style="color:var(--gold);display:flex;align-items:center;gap:6px">📲 ¿Activar Notificaciones al Celular?</b>
          <p class="tiny muted" style="margin:4px 0 0">Entérate al instante de promociones 2x1, cambios de horario y avisos de RD Fitness.</p>
        </div>
        <div class="row gap">
          <button class="btn sm ghost" id="btn_dismiss_push">Más tarde</button>
          <button class="btn sm primary" id="btn_enable_push">🔔 Activar</button>
        </div>
      </div>
    </div>
    ` : ''}

    <!-- Novedades y Avisos Oficiales del Club -->
    <div id="pass_announcements_sec"></div>

    <!-- Enlaces directos a Boleta y Gimnasio -->
    <div class="card mb">
      <div class="row between">
        <div>
          <b>🧾 Tu comprobante y boletas de pago</b>
          <div class="tiny muted">Revisa tus boletas digitales de pago en formato de ticket térmico.</div>
        </div>
        <button class="btn sm ok" id="btn_quick_receipt">Ver Boletas</button>
      </div>
    </div>

    <div class="card">
      <h3>📍 RD Fitness Club - Chivay</h3>
      <p class="muted small">
        Calle Antonio José de Sucre Lt. 10 (al costado de discoteca Muya).<br>
        Horario: ${esc(fresh.settings?.opening || 'Lun a Sáb 6:00 a 21:00')}.<br>
        Consultas y WhatsApp: <b>${esc(fresh.settings?.gym_phone || '982 404 043')}</b>.
      </p>
    </div>`;

    const dPush = el.querySelector('#btn_dismiss_push');
    if (dPush) dPush.onclick = () => { localStorage.setItem('rd_push_prompt_dismiss', '1'); el.querySelector('#push_prompt_card')?.remove(); };
    const ePush = el.querySelector('#btn_enable_push');
    if (ePush) ePush.onclick = async () => {
      try {
        await RD.hub.enablePush();
        RD.toast('¡Notificaciones al celular activadas con éxito! ✔', 'ok');
        el.querySelector('#push_prompt_card')?.remove();
      } catch (err) {
        RD.toast(err.message, 'warn');
      }
    };

    // Función global para refrescar novedades oficiales en tiempo real
    const updateHeroAnnouncement = () => {
      const sec = el.querySelector('#pass_announcements_sec');
      if (!sec) return;
      api.get('/member/inbox').then(inb => {
        if (!sec || !inb || !inb.items) return;
        const gymItems = inb.items.filter(i => i.source === 'gym' && !i.dismissed);
        if (!gymItems.length) { sec.innerHTML = ''; return; }
        const latest = gymItems[0];
        const kindLabel = { aviso: 'Aviso', evento: 'Evento', tematica: 'Temática', promo: 'Promoción', mantenimiento: 'Mantenimiento', cierre: 'Atención' }[latest.kind] || 'Novedades';
        const kindIcon = { aviso: '📢', evento: '🎉', tematica: '🎨', promo: '🏷️', mantenimiento: '🛠️', cierre: '⛔' }[latest.kind] || '📢';
        sec.innerHTML = `
          <div class="card mb" style="border-left: 4px solid var(--gold);background:var(--bg2)">
            <div class="row between wrap gap mb2">
              <span class="badge ${esc(latest.kind || 'aviso')}" style="font-weight:700">${kindIcon} ${esc(kindLabel)}</span>
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
              <button class="btn sm primary" id="btn_open_hero_ann">👁️ Leer Comunicado</button>
            </div>
          </div>
        `;
        sec.querySelector('#btn_open_hero_ann').onclick = () => RD.hub.openAnnouncementModal(latest);
        sec.querySelector('#btn_open_all_inb').onclick = () => RD.hub.openInbox();
        const heroImg = sec.querySelector('#ann_hero_img');
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

    const qrBox = el.querySelector('#qrcodebox');
    const cdBar = el.querySelector('#cdbar');

    async function updateQR() {
      if (!member?.qr_key) return;
      const payload = await RD.digitalPayload(member.code, member.qr_key);
      qrBox.innerHTML = RD.qrSvg(payload, { margin: 1 });
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
      <span class="chip on" data-tt="my">Mi Rutina</span>
      <span class="chip" data-tt="free">⚡ Sesión Libre</span>
      <span class="chip" data-tt="wizard">🤖 Asistente de Plan</span>
      <span class="chip" data-tt="templates">Explorar Plantillas (${routinesData.templates.length})</span>
      <span class="chip" data-tt="exercises">Biblioteca (${exList.length})</span>
      <span class="chip" data-tt="timers">Cronómetros</span>
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
        subview.innerHTML = `<div class="card" style="max-width:480px;margin:0 auto"><h3>⏱ Cronómetros y Tabata</h3><div id="tbox" class="mt"></div></div>`;
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
        <h3>Aún no tienes una rutina asignada</h3>
        <p class="muted small mb">Puedes elegir una de las 10 rutinas profesionales creadas por entrenadores o usar nuestro Asistente Inteligente.</p>
        <div class="row gap mt" style="justify-content:center">
          <button class="btn primary" id="pickplan">Explorar Plantillas Oficiales</button>
          <button class="btn" id="open_wiz_btn">🤖 Asistente de Plan</button>
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
        <span class="badge ok">Rutina Asignada</span>
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
        <button class="btn primary block" data-startday="${di}">▶ Iniciar Entrenamiento Guiado</button>
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
      <div style="font-size:3rem">⚡</div>
      <h2>Entrenamiento Libre / Registro Rápido</h2>
      <p class="muted small mb" style="max-width:440px;margin:0 auto .8rem">
        ¿Quieres hacer un entrenamiento espontáneo hoy sin ceñirte a una rutina fija?
        Selecciona ejercicios al vuelo de nuestra biblioteca de más de 85 ejercicios, registra tus series y pesos con cronómetro automático, y se guardará en tu historial y récords personales.
      </p>
      <button class="btn ok lg" id="btn_start_free_act" style="font-size:1.1rem;padding:0.9rem 1.8rem">▶ Iniciar Sesión Libre Ahora</button>
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
      <h3>🤖 Asistente Inteligente de Rutinas</h3>
      <p class="muted small mb">Responde 3 preguntas y te recomendaremos el plan científicamente óptimo para ti.</p>

      <div class="mb">
        <b>1. ¿Cuál es tu objetivo principal?</b>
        <div class="grid mt2">
          <div class="wizard-option selected" data-wz-goal="hipertrofia">
            <span style="font-size:1.5rem">💪</span>
            <div><b>Ganar Masa Muscular & Hipertrofia</b><div class="tiny muted">Volumen muscular, desarrollo estético y proporción</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="grasa">
            <span style="font-size:1.5rem">🔥</span>
            <div><b>Perder Grasa & Tonificación</b><div class="tiny muted">Déficit calórico, circuitos metabólicos y quema de grasa</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="fuerza">
            <span style="font-size:1.5rem">🏋️</span>
            <div><b>Fuerza Máxima (Powerbuilding)</b><div class="tiny muted">Levantamiento pesado de sentadilla, banca y peso muerto</div></div>
          </div>
          <div class="wizard-option" data-wz-goal="gluteo">
            <span style="font-size:1.5rem">🍑</span>
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

      <button class="btn primary block lg mt" id="wz_recommend_btn">Recomendar Mi Rutina Ideal</button>
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
          <div class="badge ok mb">Plan Recomendado para Ti</div>
          <h2>${esc(match.name)}</h2>
          <p class="muted small">${esc(match.description || match.goal)}</p>
          <div class="chips mb">
            <span class="badge info">${esc(match.level)}</span>
            <span class="badge">📅 ${match.days} días / semana</span>
          </div>
          <button class="btn ok block lg" id="wz_apply_btn">✔ Activar y Comenzar Este Plan</button>
        </div>`;

      resBox.querySelector('#wz_apply_btn').onclick = async () => {
        await api.post(`/member/routines/${match.id}/follow`);
        RD.toast('¡Rutina recomendada activada con éxito! ✔');
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
        <div class="small muted mb">📅 ${r.days} días por semana</div>
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
          RD.toast('Rutina activada con éxito ✔');
          document.querySelector('[data-tt="my"]').click();
        }
      }
    };
  }

  // ---------------- TAB 3: PROGRESO Y RÉCORDS (GRÁFICOS, MEDIDAS, PRs) ----------------
  async function renderProgressTab(el) {
    const [prs, workouts, measurements, attendance, payments, analytics] = await Promise.all([
      api.get('/member/prs').catch(() => []),
      api.get('/member/workouts').catch(() => []),
      api.get('/member/measurements').catch(() => []),
      api.get('/member/attendance').catch(() => []),
      api.get('/member/payments').catch(() => []),
      api.get('/member/analytics').catch(() => ({ muscleDistribution: [], weeklyVolume: [] }))
    ]);

    el.innerHTML = `
    <div class="chips mb" id="ptabs">
      <span class="chip on" data-pt="charts">📊 Gráficos de Evolución</span>
      <span class="chip" data-pt="prs">🏆 Récords (PRs)</span>
      <span class="chip" data-pt="body">📏 Medidas Corporales (${measurements.length})</span>
      <span class="chip" data-pt="history">📋 Historial (${workouts.length})</span>
      <span class="chip" data-pt="payments">💳 Pagos (${payments.length})</span>
    </div>
    <div id="progresssubview"></div>`;

    const subview = el.querySelector('#progresssubview');

    function showSubTab(tab) {
      el.querySelectorAll('#ptabs .chip').forEach(c => c.classList.toggle('on', c.dataset.pt === tab));

      if (tab === 'charts') {
        subview.innerHTML = `
          <!-- Gráfico de Peso Corporal -->
          <div class="card mb">
            <div class="row between">
              <h3>Curva de Peso Corporal</h3>
              <button class="btn sm ghost" id="btn_add_meas_quick">＋ Registrar Peso</button>
            </div>
            ${RD.renderWeightSvgChart(measurements)}
          </div>

          <!-- Gráfico de Volumen de Carga Semanal -->
          <div class="card mb">
            <h3>Volumen Semanal de Cargas (Kg Levantados)</h3>
            <p class="muted tiny">Muestra el trabajo acumulado por semana para verificar la sobrecarga progresiva.</p>
            ${RD.renderVolumeSvgChart(analytics.weeklyVolume)}
          </div>

          <!-- Gráfico de Distribución Muscular -->
          <div class="card mb">
            <h3>Distribución de Series por Grupo Muscular</h3>
            <p class="muted tiny">Asegura que tu entrenamiento esté balanceado y sin descompensaciones posturales.</p>
            ${RD.renderMuscleDistribution(analytics.muscleDistribution)}
          </div>`;

        subview.querySelector('#btn_add_meas_quick').onclick = () => openAddMeasurementModal(() => renderProgressTab(el));
      } else if (tab === 'prs') {
        subview.innerHTML = `
          <div class="card mb">
            <div class="row between mb">
              <div>
                <h3 style="margin:0">🏆 Récords Personales (PRs)</h3>
                <div class="muted tiny">Tus cargas máximas históricas en cada ejercicio</div>
              </div>
              <button class="btn sm primary" id="btn_open_1rm_tool">💪 Calcular 1RM</button>
            </div>
            <div class="list">
              ${prs.map(p => `
              <div class="item">
                <span class="grow">
                  <b>${esc(p.nombre)}</b>
                  <div class="muted tiny">Carga registrada: ${p.weight} kg</div>
                </span>
                <span class="gold" style="font-size:1.3rem;font-weight:900">${p.weight} kg</span>
              </div>`).join('') || '<div class="empty">Registra tus sesiones guiadas o libres para desbloquear tus récords personales.</div>'}
            </div>
          </div>`;

        subview.querySelector('#btn_open_1rm_tool').onclick = () => RD.open1RMCalculator(70, 8);
      } else if (tab === 'body') {
        subview.innerHTML = `
          <div class="card mb">
            <div class="row between mb">
              <h3>Historial de Medidas Corporales</h3>
              <button class="btn sm primary" id="btn_add_meas">＋ Registrar Medidas</button>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Pecho</th><th>Brazo</th><th>Pierna</th><th>Cadera</th></tr></thead>
                <tbody>
                  ${measurements.map(m => `
                  <tr>
                    <td>${RD.fmtDate(m.day)}</td>
                    <td style="font-weight:700">${m.weight ? m.weight + ' kg' : '—'}</td>
                    <td>${m.waist ? m.waist + ' cm' : '—'}</td>
                    <td>${m.chest ? m.chest + ' cm' : '—'}</td>
                    <td>${m.arm ? m.arm + ' cm' : '—'}</td>
                    <td>${m.thigh ? m.thigh + ' cm' : '—'}</td>
                    <td>${m.hip ? m.hip + ' cm' : '—'}</td>
                  </tr>`).join('') || '<tr><td colspan="7" class="empty">Sin medidas registradas aún</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;

        subview.querySelector('#btn_add_meas').onclick = () => openAddMeasurementModal(() => renderProgressTab(el));
      } else if (tab === 'history') {
        subview.innerHTML = `
          <div class="card mb">
            <h3>Sesiones de Entrenamiento Completadas (${workouts.length})</h3>
            <div class="list">
              ${workouts.map(w => `
              <div class="item">
                <div class="grow">
                  <b>${esc(w.title)}</b>
                  <div class="muted small">${RD.fmtDate(w.day)} · Duración: ${RD.fmtDur(w.duration_sec)}</div>
                </div>
                <div class="right">
                  <span class="badge info">${Math.round(w.volume)} kg</span>
                </div>
              </div>`).join('') || '<div class="empty">Aún no has completado entrenamientos</div>'}
            </div>
          </div>
          <div class="card mb">
            <h3>Historial de Asistencias en Gimnasio (${attendance.length})</h3>
            <div class="list small">
              ${attendance.slice(0, 20).map(a => `
              <div class="item">
                <span class="badge ok">Presente</span>
                <span class="grow">${RD.fmtDateTime(a.ts)}</span>
              </div>`).join('') || '<div class="empty">Sin asistencias registradas</div>'}
            </div>
          </div>`;
      } else if (tab === 'payments') {
        subview.innerHTML = `
          <div class="card">
            <h3>Tus Pagos y Membresías</h3>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Método</th></tr></thead>
                <tbody>
                  ${payments.map(p => `
                  <tr>
                    <td>${RD.fmtDate(p.day)}</td>
                    <td><b>${esc(p.concept)}</b></td>
                    <td style="font-weight:700">${money(p.amount)}</td>
                    <td><span class="badge">${esc(p.method)}</span></td>
                  </tr>`).join('') || '<tr><td colspan="4" class="empty">Sin pagos</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>`;
      }
    }

    el.querySelector('#ptabs').onclick = e => {
      const c = e.target.closest('[data-pt]');
      if (c) showSubTab(c.dataset.pt);
    };

    showSubTab('charts');
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
        RD.toast('Medidas guardadas con éxito ✔');
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
      <h2>🧮 Herramientas Deportivas Pro</h2>
      <p class="muted small">Calculadoras científicas diseñadas para sacarle el máximo provecho a cada entrenamiento y alimentación.</p>
    </div>

    <div class="grid g2 gap mb">
      <div class="card" id="tool_1rm" style="cursor:pointer">
        <div style="font-size:2rem">💪</div>
        <h3 class="mt2">Calculadora 1RM</h3>
        <p class="muted small">Predice tu fuerza máxima a 1 repetición y tabla exacta de cargas del 100% al 65%.</p>
        <button class="btn sm primary mt">Abrir Calculadora</button>
      </div>

      <div class="card" id="tool_plates" style="cursor:pointer">
        <div style="font-size:2rem">🧮</div>
        <h3 class="mt2">Discos de Barra</h3>
        <p class="muted small">Visualiza qué discos colocar a cada lado de la barra con los colores oficiales de halterofilia.</p>
        <button class="btn sm primary mt">Calcular Discos</button>
      </div>

      <div class="card" id="tool_nutrition" style="cursor:pointer">
        <div style="font-size:2rem">🥗</div>
        <h3 class="mt2">Macros & Calorías TDEE</h3>
        <p class="muted small">Gasto calórico real y gramos exactos de proteínas, carbos y grasas según tu objetivo.</p>
        <button class="btn sm primary mt">Calcular Dieta</button>
      </div>

      <div class="card" id="tool_fat" style="cursor:pointer">
        <div style="font-size:2rem">📏</div>
        <h3 class="mt2">Grasa Corporal (US Navy)</h3>
        <p class="muted small">Estimación científica de porcentaje graso usando tus contornos corporales.</p>
        <button class="btn sm primary mt">Calcular Grasa</button>
      </div>

      <div class="card" id="tool_water" style="cursor:pointer">
        <div style="font-size:2rem">💧</div>
        <h3 class="mt2">Hidratación en Altura</h3>
        <p class="muted small">Calcula cuántos litros de agua necesitas al día en el clima y altitud de Chivay.</p>
        <button class="btn sm primary mt">Calcular Agua</button>
      </div>

      <div class="card" id="tool_timers" style="cursor:pointer">
        <div style="font-size:2rem">⏱</div>
        <h3 class="mt2">Tabata, HIIT y EMOM</h3>
        <p class="muted small">Cronómetros de intervalos con avisos sonoros y vibración offline.</p>
        <button class="btn sm primary mt">Abrir Cronómetros</button>
      </div>
    </div>`;

    el.querySelector('#tool_1rm').onclick = () => RD.open1RMCalculator(70, 8);
    el.querySelector('#tool_plates').onclick = () => RD.openPlateCalculator(60, 20);
    el.querySelector('#tool_nutrition').onclick = () => RD.openNutritionCalculator(member || {});
    el.querySelector('#tool_fat').onclick = () => {
      const m = RD.openModal('📏 Calculadora de Grasa (US Navy)', `
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
      RD.openModal('💧 Hidratación Deportiva', `
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
      const m = RD.openModal('⏱ Cronómetros y Tabata', '<div id="tim_box"></div>');
      RD.timersTool(m.el.querySelector('#tim_box'));
    };
  }

  // ---------------- TAB 5: PERFIL Y BOLETAS DIGITALES ----------------
  async function renderProfileTab(el) {
    el.innerHTML = `
    <div class="card mb center">
      <div class="row" style="justify-content:center;margin-bottom:8px">
        <div class="avatar lg">${member.photo ? `<img src="${esc(member.photo)}" alt="">` : esc((member.name || '?')[0])}</div>
      </div>
      <h2>${esc(member.name)}</h2>
      <div class="gold" style="font-size:1.3rem;font-weight:900">${esc(member.code)}</div>
      <div class="muted small mt2">Socio desde ${RD.fmtDate(member.created_at)}</div>
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
        <div class="item"><span class="muted">Contraseña:</span> <b class="grow right">${member.has_password ? 'Propia ✔' : 'Inicial (tu DNI)'}</b></div>
      </div>
      <div class="grid g2 keep mt2">
        <button class="btn sm ${member.has_password ? '' : 'primary'}" id="pfaccount">${member.has_password ? '🔐 Cambiar acceso' : '✨ Crear usuario y contraseña'}</button>
        <button class="btn sm" id="pfdevices">📱 Mis dispositivos</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Boletas de pago, avisos y ajustes</h3>
      <p class="small muted">Consulta tus boletas electrónicas térmicas, revisa los avisos del club y ajusta alertas de sonido.</p>
      <div class="grid g3 keep gap">
        <button class="btn sm ok" id="pfreceipts">🧾 Mis Boletas</button>
        <button class="btn sm" id="pfinbox">🔔 Avisos</button>
        <button class="btn sm ghost" id="pfprefs">⚙️ Ajustes</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Aplicación</h3>
      <div class="row between wrap gap">
        <span class="small">Tema visual</span>
        <button class="btn sm" id="profilethemebtn">${RD.getTheme && RD.getTheme() === 'light' ? '🌙 Modo Oscuro' : '☀️ Modo Claro (Pastel)'}</button>
      </div>
      <div class="row between wrap gap mt2" id="installrow">
        <div class="small">
          ${RD.hub.isStandalone() ? '✅ App instalada en este dispositivo' : '💡 Puedes usarla como App en Android, iOS o PC'}
        </div>
        <div class="row gap">
          ${RD.hub.canInstall() ? '<button class="btn sm primary" id="pfinstall">⚡ Instalar app</button>' : ''}
          <button class="btn sm info" id="pfinstallguide">📲 Guía de Instalación</button>
        </div>
      </div>
    </div>

    <div class="grid gap">
      <button class="btn danger block" id="outbtn">Cerrar Sesión</button>
    </div>`;

    const redrawProfile = m => {
      member = m;
      localStorage.setItem('rd_member_data', JSON.stringify(m));
      renderProfileTab(el);
    };
    el.querySelector('#pfaccount').onclick = () => RD.hub.openAccount(member, redrawProfile, { first: !member.has_password });
    el.querySelector('#pfdevices').onclick = () => RD.hub.openDevices();
    el.querySelector('#pfinbox').onclick = () => RD.hub.openInbox();
    el.querySelector('#pfreceipts').onclick = () => RD.hub.openReceipts();
    el.querySelector('#pfprefs').onclick = () => RD.hub.openPrefs();
    const pfi = el.querySelector('#pfinstall');
    if (pfi) pfi.onclick = async () => { if (await RD.hub.install()) { RD.toast('App instalada ✔'); renderProfileTab(el); } };
    const pfig = el.querySelector('#pfinstallguide');
    if (pfig) pfig.onclick = () => RD.hub.openInstallGuide();

    const ptb = el.querySelector('#profilethemebtn');
    if (ptb) {
      ptb.onclick = () => {
        RD.toggleTheme();
        ptb.textContent = RD.getTheme() === 'light' ? '🌙 Modo Oscuro' : '☀️ Modo Claro (Pastel)';
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
