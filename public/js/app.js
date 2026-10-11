/* RD Fitness Club - Aplicación del Socio (PWA Móvil) */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;

  let member = JSON.parse(localStorage.getItem('rd_member_data') || 'null');
  const api = RD.makeApi('rd_member_token', () => logout(true));
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
    root.innerHTML = `
    <div class="auth">
      <form class="box" id="mlf">
        <div class="brand">
          <img class="logo" src="/logo.svg" alt="RD">
          <h1>RD FITNESS CLUB</h1>
          <p>Tu credencial y entrenador digital · Chivay</p>
        </div>
        ${err ? `<div class="banner err">${esc(err)}</div>` : ''}
        <label class="field">
          <span>Código de socio (ej. RD-0001 o solo el número) *</span>
          <input name="code" placeholder="RD-0001" required autocomplete="off" autofocus>
        </label>
        <label class="field">
          <span>Número de DNI *</span>
          <input name="dni" inputmode="numeric" placeholder="8 dígitos" required autocomplete="off">
        </label>
        <button class="btn primary block" type="submit">Ingresar a mi App</button>
        <div class="card flat mt center small muted">
          ¿Aún no estás registrado? Acércate a recepción en Calle Sucre Lt. 10 para obtener tu código y credencial.
        </div>
        <p class="center muted tiny mt">Personal del gimnasio: <a href="/admin/">Acceso al panel</a></p>
      </form>
    </div>`;

    document.getElementById('mlf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      await RD.busy(f.querySelector('button'), async () => {
        try {
          const res = await api.post('/auth/member-login', {
            code: f.code.value.trim(),
            dni: f.dni.value.trim()
          });
          localStorage.setItem('rd_member_token', res.token);
          localStorage.setItem('rd_member_data', JSON.stringify(res.member));
          member = res.member;
          boot();
        } catch (error) {
          RD.toast(error.message, 'err');
        }
      });
    };
  }

  function logout(auto) {
    clearInterval(qrTimer);
    localStorage.removeItem('rd_member_token');
    localStorage.removeItem('rd_member_data');
    member = null;
    showLogin(auto ? 'Tu sesión caducó. Ingresa de nuevo.' : '');
  }

  // ---------------- NAVEGACIÓN Y ESTRUCTURA ----------------
  function layout() {
    root.innerHTML = `
    <div>
      <header class="topbar">
        <img src="/logo.svg" alt="RD">
        <div class="t" id="apptitle">RD FITNESS CLUB</div>
        <button class="icon-btn" id="logoutbtn" title="Cerrar sesión">✕</button>
      </header>
      <main class="page" id="mainview"></main>
      <nav class="nav">
        <button data-tab="pass" class="on"><span class="i">🪪</span>Acceso</button>
        <button data-tab="train"><span class="i">🏋️</span>Entrenar</button>
        <button data-tab="progress"><span class="i">📈</span>Progreso</button>
        <button data-tab="profile"><span class="i">👤</span>Perfil</button>
      </nav>
    </div>`;

    document.querySelectorAll('.nav button').forEach(b => {
      b.onclick = () => switchTab(b.dataset.tab);
    });

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
    main.innerHTML = '<div class="empty">Cargando…</div>';

    if (tab === 'pass') await renderPassTab(main);
    else if (tab === 'train') await renderTrainTab(main);
    else if (tab === 'progress') await renderProgressTab(main);
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

    el.innerHTML = `
    <div class="idcard">
      <div class="row between">
        <img src="/logo.svg" style="height:32px" alt="RD">
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
      <div class="muted tiny mt2 center">El código se renueva cada 60 s para evitar capturas</div>

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

    <!-- Estadísticas de constancia del socio -->
    <div class="grid g3 keep mt mb">
      <div class="stat gold">
        <div class="v">🔥 ${fresh.stats?.streak_weeks || 0}</div>
        <div class="l">Semanas seguidas</div>
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

    <div class="card mt">
      <h3>📍 RD Fitness Club - Chivay</h3>
      <p class="muted small">
        Calle Antonio José de Sucre Lt. 10 (al costado de discoteca Muya).<br>
        Horario: ${esc(fresh.settings?.opening || 'Lun a Sáb 6:00 a 21:00')}.<br>
        Consultas y WhatsApp: <b>${esc(fresh.settings?.gym_phone || '982 404 043')}</b>.
      </p>
    </div>`;

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

  // ---------------- TAB 2: ENTRENAMIENTO Y RUTINAS ----------------
  async function renderTrainTab(el) {
    const [routinesData, exList] = await Promise.all([
      api.get('/member/routines'),
      getExercises()
    ]);

    el.innerHTML = `
    <div class="chips mb" id="ttabs">
      <span class="chip on" data-tt="my">Mi Rutina</span>
      <span class="chip" data-tt="templates">Explorar Rutinas</span>
      <span class="chip" data-tt="exercises">Biblioteca (${exList.length})</span>
      <span class="chip" data-tt="timers">Cronómetros</span>
    </div>
    <div id="trainsubview"></div>`;

    const subview = el.querySelector('#trainsubview');

    async function showSubTab(tab) {
      el.querySelectorAll('#ttabs .chip').forEach(c => c.classList.toggle('on', c.dataset.tt === tab));

      if (tab === 'my') {
        renderMyRoutine(subview, routinesData.mine, exList);
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
      <div class="card center" style="padding:2.5rem 1rem">
        <h3>Aún no tienes una rutina asignada</h3>
        <p class="muted small mb">El entrenador puede asignarte una personalizada en el gimnasio, o puedes elegir una de las plantillas oficiales ahora mismo.</p>
        <button class="btn primary" id="pickplan">Explorar Rutinas Disponibles</button>
      </div>`;
      el.querySelector('#pickplan').onclick = () => document.querySelector('[data-tt="templates"]').click();
      return;
    }

    const currentAssigned = mine[0];
    const full = await api.get('/routines/' + currentAssigned.id);
    const exMap = Object.fromEntries(exList.map(e => [e.id, e]));

    el.innerHTML = `
    <div class="card mb">
      <div class="row between">
        <span class="badge ok">Rutina Asignada</span>
        <span class="badge info">${esc(full.level)}</span>
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
          ${d.items.slice(0, 4).map(it => `<div class="item"><span>${esc(it.nombre)}</span> <span class="muted tiny">${it.sets}×${esc(it.reps)}</span></div>`).join('')}
          ${d.items.length > 4 ? `<div class="item muted tiny">＋ ${d.items.length - 4} más…</div>` : ''}
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
        onFinish: async (payload) => {
          return await api.post('/member/workouts', payload);
        }
      });
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
          <div class="muted small mb">${esc(full.goal || '')}</div>
          ${full.days.map((d, di) => `
          <div class="card flat mt mb">
            <h4>${esc(d.title || `Día ${di + 1}`)} (${d.items.length} ejercicios)</h4>
            <div class="list">
              ${d.items.map(it => `<div class="item"><b>${esc(it.nombre)}</b> <span class="muted small">${it.sets}×${esc(it.reps)}</span></div>`).join('')}
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

  // ---------------- TAB 3: PROGRESO Y RÉCORDS ----------------
  async function renderProgressTab(el) {
    const [prs, workouts, measurements, attendance, payments] = await Promise.all([
      api.get('/member/prs').catch(() => []),
      api.get('/member/workouts').catch(() => []),
      api.get('/member/measurements').catch(() => []),
      api.get('/member/attendance').catch(() => []),
      api.get('/member/payments').catch(() => [])
    ]);

    el.innerHTML = `
    <!-- Récords Personales (PRs) -->
    <div class="card mb">
      <h3>🏆 Récords Personales (Máximos pesos levantados)</h3>
      <div class="list">
        ${prs.map(p => `
        <div class="item">
          <span class="grow"><b>${esc(p.nombre)}</b></span>
          <span class="gold" style="font-size:1.2rem;font-weight:900">${p.weight} kg</span>
        </div>`).join('') || '<div class="empty">Registra tus entrenamientos para desbloquear tus récords.</div>'}
      </div>
    </div>

    <!-- Registro de peso y medidas corporales -->
    <div class="card mb">
      <div class="row between mb">
        <h3>Evolución Corporal</h3>
        <button class="btn sm primary" id="addm">＋ Registrar Medidas</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Pecho</th><th>Brazo</th></tr></thead>
          <tbody>
            ${measurements.map(m => `
            <tr>
              <td>${RD.fmtDate(m.day)}</td>
              <td style="font-weight:700">${m.weight ? m.weight + ' kg' : '—'}</td>
              <td>${m.waist ? m.waist + ' cm' : '—'}</td>
              <td>${m.chest ? m.chest + ' cm' : '—'}</td>
              <td>${m.arm ? m.arm + ' cm' : '—'}</td>
            </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin medidas registradas aún</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Historial de entrenamientos -->
    <div class="card mb">
      <h3>Sesiones de Entrenamiento Completadas (${workouts.length})</h3>
      <div class="list">
        ${workouts.slice(0, 10).map(w => `
        <div class="item">
          <div class="grow">
            <b>${esc(w.title)}</b>
            <div class="muted small">${RD.fmtDate(w.day)} · Duración: ${RD.fmtDur(w.duration_sec)}</div>
          </div>
          <div class="right">
            <span class="badge info">${Math.round(w.volume)} kg</span>
          </div>
        </div>`).join('') || '<div class="empty">Aún no has completado entrenamientos guiados</div>'}
      </div>
    </div>

    <!-- Historial de asistencias -->
    <div class="card mb">
      <h3>Historial de Asistencias en el Gimnasio</h3>
      <div class="list small">
        ${attendance.slice(0, 15).map(a => `
        <div class="item">
          <span class="badge ok">Presente</span>
          <span class="grow">${RD.fmtDateTime(a.ts)}</span>
        </div>`).join('') || '<div class="empty">Sin asistencias registradas</div>'}
      </div>
    </div>

    <!-- Historial de pagos -->
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

    el.querySelector('#addm').onclick = () => {
      const d = RD.openModal('Registrar mi peso y medidas', `
        <form id="mf">
          <div class="grid g2 keep">
            <label class="field"><span>Peso (kg) *</span><input name="weight" type="number" step="0.1" placeholder="Ej. 68.5"></label>
            <label class="field"><span>Cintura (cm)</span><input name="waist" type="number" step="0.5" placeholder="Ej. 82"></label>
          </div>
          <div class="grid g2 keep">
            <label class="field"><span>Pecho (cm)</span><input name="chest" type="number" step="0.5" placeholder="Ej. 95"></label>
            <label class="field"><span>Brazo (cm)</span><input name="arm" type="number" step="0.5" placeholder="Ej. 32"></label>
          </div>
          <button class="btn primary block mt">Guardar Progreso</button>
        </form>
      `);

      d.el.querySelector('#mf').onsubmit = async e => {
        e.preventDefault();
        const f = e.target;
        if (!f.weight.value && !f.waist.value && !f.chest.value && !f.arm.value) {
          return RD.toast('Ingresa al menos un dato', 'warn');
        }
        try {
          await api.post('/member/measurements', {
            weight: f.weight.value || null,
            waist: f.waist.value || null,
            chest: f.chest.value || null,
            arm: f.arm.value || null
          });
          RD.toast('Medidas guardadas con éxito ✔');
          d.close();
          renderProgressTab(el);
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      };
    };
  }

  // ---------------- TAB 4: PERFIL Y SALUD ----------------
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

    <div class="grid gap">
      <button class="btn danger block" id="outbtn">Cerrar Sesión</button>
    </div>`;

    el.querySelector('#outbtn').onclick = async () => {
      if (await RD.confirm('Cerrar sesión', '¿Deseas cerrar tu sesión?', 'Salir', true)) {
        logout(false);
      }
    };
  }

  // ---------------- INICIO DE LA APLICACIÓN ----------------
  async function boot() {
    RD.registerSW();
    RD.syncTime();
    if (!localStorage.getItem('rd_member_token')) {
      return showLogin();
    }
    layout();
    switchTab('pass');
  }

  window.RDMemberBoot = boot;
})();
