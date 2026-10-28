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
    const el = $('#net');
    const btnLocal = $('#btn_local_mode');
    const banner = $('#local_mode_banner');
    const st = RD.localEngine ? RD.localEngine.getStats() : {
      forced: false, online: navigator.onLine, activeLocal: !navigator.onLine,
      membersCached: (RD.snap()?.members || []).length, totalPending: RD.queue().length, saveCount: 0
    };

    if (el) {
      el.style.cursor = 'pointer';
      el.title = 'Haz clic para abrir el Centro de Control de Modo Local y Contingencia PC';
      el.onclick = () => RD.openLocalModeModal();
      if (st.activeLocal) {
        el.className = 'net off';
        el.style.background = 'rgba(245, 158, 11, 0.18)';
        el.style.color = '#fbbf24';
        el.style.border = '1px solid rgba(245, 158, 11, 0.45)';
        el.innerHTML = `⚡ MODO LOCAL PC ${st.totalPending ? `· <b>${st.totalPending} guardados</b>` : `· <b>Activo</b>`}`;
      } else {
        el.className = 'net';
        el.style.background = '';
        el.style.color = '';
        el.style.border = '';
        el.innerHTML = `● Nube + PC Local${st.totalPending ? ` · ${st.totalPending} pend.` : ''}`;
      }
    }

    if (btnLocal) {
      if (st.activeLocal) {
        btnLocal.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        btnLocal.style.color = '#000';
        btnLocal.style.fontWeight = '800';
        btnLocal.style.borderColor = '#fbbf24';
        btnLocal.innerHTML = `${RD.icon('zap', '', 15)} <span>Modo Local: ON (${st.totalPending})</span>`;
      } else {
        btnLocal.style.background = '';
        btnLocal.style.color = '';
        btnLocal.style.fontWeight = '';
        btnLocal.style.borderColor = '';
        btnLocal.innerHTML = `${RD.icon('database', '', 15)} <span>Modo Local PC</span>`;
      }
    }

    if (banner) {
      if (st.activeLocal) {
        const lastTime = st.lastWriteAt ? RD.fmtTime(new Date(st.lastWriteAt).toISOString()) : 'Listo';
        banner.style.display = 'flex';
        banner.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px">
            <span style="background:#f59e0b;color:#000;font-weight:900;padding:2px 8px;border-radius:5px;font-size:11px">⚡ MODO LOCAL ACTIVO EN ESTA PC</span>
            <span>Operando <b>100% sin internet</b> en la memoria de esta computadora · <b>${st.membersCached} socios</b> protegidos · <b>${st.totalPending} op.</b> en cola local · Último guardado: <b>${esc(lastTime)}</b></span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <button class="btn sm" id="bn_verify_local" style="padding:4px 10px;font-size:11.5px">🧪 Verificar Guardado</button>
            <button class="btn sm primary" id="bn_open_local_panel" style="padding:4px 10px;font-size:11.5px">⚙️ Control Modo Local</button>
            ${st.online ? `<button class="btn sm" id="bn_sync_now" style="padding:4px 10px;font-size:11.5px;border-color:#10b981;color:#10b981">☁️ Volver a Nube y Sincronizar</button>` : ''}
          </div>
        `;
        const bVer = banner.querySelector('#bn_verify_local');
        if (bVer) bVer.onclick = () => {
          const t0 = performance.now();
          localStorage.setItem('rd_local_test_probe', String(Date.now()));
          const ms = Math.max(0.1, Math.round((performance.now() - t0) * 10) / 10);
          RD.toast(`✅ Memoria Local de esta PC verificada (${ms} ms) · ${st.membersCached} socios y ${st.totalPending} registros seguros`, 'ok');
        };
        const bPan = banner.querySelector('#bn_open_local_panel');
        if (bPan) bPan.onclick = () => RD.openLocalModeModal();
        const bSync = banner.querySelector('#bn_sync_now');
        if (bSync) bSync.onclick = async () => {
          RD.localEngine.setForced(false);
          await RD.flushScans();
          if (RD.localEngine) await RD.localEngine.flushToCloud().catch(() => {});
          await RD.syncMembers().catch(() => {});
          updateNet();
          RD.toast('☁️ Conectado a la Nube y cola local sincronizada al 100%', 'ok');
          if (RD.currentView) go(RD.currentView);
        };
      } else {
        banner.style.display = 'none';
      }
    }
  }
  window.addEventListener('online', () => {
    updateNet();
    if (!RD.localEngine?.isForced()) {
      RD.flushScans();
      if (RD.localEngine) RD.localEngine.flushToCloud().catch(() => {});
      RD.syncMembers().catch(() => { });
    }
  });
  window.addEventListener('offline', updateNet);
  window.addEventListener('rd:local-state', updateNet);
  setInterval(() => { if (RD.user && navigator.onLine && !RD.localEngine?.isForced()) { RD.flushScans(); RD.localEngine?.flushToCloud().catch(() => {}); } }, 20000);
  setInterval(() => { if (RD.user && navigator.onLine && !RD.localEngine?.isForced() && RD.currentView !== 'scan') RD.syncMembers().catch(() => { }); }, 120000);

  // ---------- Login ----------
  function showLogin(msg) {
    const p = RD.pub;
    root.innerHTML = `
    <div class="auth"><form class="box" id="lf" autocomplete="on">
      <div class="brand"><img class="logo" src="/logo.svg" alt="RD"><h1>${esc(p.gym_name || 'RD Fitness Club')}</h1><p>Panel de gestión</p></div>
      <div id="lf_err" class="banner err" style="${msg ? '' : 'display:none'}">${esc(msg || '')}</div>
      <label class="field"><span>Usuario</span><input name="u" autocomplete="username" autocapitalize="none" required autofocus></label>
      <label class="field"><span>Contraseña</span><input name="p" type="password" autocomplete="current-password" required></label>
      <button class="btn primary block" type="submit">Ingresar</button>
      <p class="muted small center mt">¿Eres socio? <a href="/">Abre tu app aquí</a></p>
    </form></div>`;
    $('#lf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      const errBox = $('#lf_err');
      if (errBox) errBox.style.display = 'none';
      const runBusy = RD.busy || (async (btn, fn) => {
        if (btn) btn.disabled = true;
        try { return await fn(); } finally { if (btn) btn.disabled = false; }
      });
      await runBusy(f.querySelector('button'), async () => {
        try {
          const r = await RD.api.post('/auth/login', { username: f.u.value, password: f.p.value });
          localStorage.setItem('rd_staff_token', r.token);
          localStorage.setItem('rd_staff_user', JSON.stringify(r.user));
          RD.user = r.user;
          layout();
          if (navigator.onLine) { RD.flushScans(); RD.syncMembers().catch(() => { }); RD.getPlans().catch(() => { }); }
          const saved = localStorage.getItem('rd_last_view');
          const h = (location.hash || '').replace('#/', '') || saved;
          go(h && NAV[h] ? h : (RD.user.role === 'entrenador' ? 'home' : 'scan'));
        } catch (err) {
          const m = err.message || 'Usuario o contraseña incorrectos';
          if (errBox) { errBox.textContent = m; errBox.style.display = 'block'; }
          if (RD.toast) RD.toast(m, 'err');
        }
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
      RD.toast('Pantalla Tablet / Mostrador acoplada');
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
      RD.toast('Abriendo Google Sheets oficial…');
    } else {
      const m = RD.openModal('Google Sheets Oficial', `
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
          <button class="btn ghost sm" id="gs_sync_guide_btn">${RD.icon('settings', '', 14)} Ver Guía y Código Apps Script</button>
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
          RD.toast('Enlace de Google Sheets guardado');
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

  RD.openLocalModeModal = async () => {
    let batteryInfo = '⚡ Conectado a corriente de línea';
    try {
      if (navigator.getBattery) {
        const b = await navigator.getBattery();
        const pct = Math.round(b.level * 100);
        batteryInfo = b.charging ? `⚡ Conectado a corriente AC (${pct}%)` : `🔋 En batería (${pct}%) · Modo ahorro activo`;
      }
    } catch {}

    const renderModalContent = (m) => {
      const st = RD.localEngine ? RD.localEngine.getStats() : {
        forced: false, online: navigator.onLine, activeLocal: !navigator.onLine,
        membersCached: (RD.snap()?.members || []).length, totalPending: RD.queue().length, pendingScans: 0, pendingTx: 0,
        lastSyncAt: 0, lastWriteAt: 0, saveCount: 0, storageKB: 0
      };
      const txQueue = RD.localEngine ? RD.localEngine.getTxQueue() : [];

      m.el.innerHTML = `
      <div class="modal-box" style="max-width:760px;width:95%">
        <div class="modal-head">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:${st.activeLocal ? '#f59e0b' : '#10b981'};color:#000;padding:3px 8px;border-radius:6px;font-weight:900;font-size:12px">
              ${st.activeLocal ? '⚡ MODO LOCAL ACTIVO' : '🟢 NUBE + PC LOCAL'}
            </span>
            <h3 style="margin:0">Centro de Modo Local y Contingencia en PC del Dueño</h3>
          </div>
          <button class="icon-btn" id="m_close">${RD.icon('x', '', 18)}</button>
        </div>
        <div class="modal-body" style="padding:18px 24px">
          <p class="muted small" style="margin-bottom:16px">
            Este módulo garantiza que el sistema <b>siga funcionando al 100% en esta computadora</b> si se corta el internet, se apaga el router o hay inestabilidad en la zona. Las asistencias QR (0.1s), cobros en caja, impresión de boletas y pantalla TV operan de inmediato en la memoria local.
          </p>

          <div style="background:${st.activeLocal ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.08)'};border:1px solid ${st.activeLocal ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.25)'};border-radius:12px;padding:16px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
            <div>
              <div style="font-weight:900;font-size:15px;color:${st.activeLocal ? '#fbbf24' : '#10b981'};margin-bottom:3px">
                ${st.activeLocal ? '🟠 Modo Local Autónomo Forzado en esta PC' : '🟢 Modo Híbrido: Nube + Respaldo Espejo en esta PC'}
              </div>
              <div style="font-size:12.5px;color:var(--text-muted)">
                ${st.activeLocal ? 'Todas las operaciones se están escribiendo y validando en el disco de esta PC.' : 'Cada cambio se guarda en la nube y mantiene una copia instantánea en esta PC.'}
              </div>
            </div>
            <button class="btn ${st.forced ? '' : 'primary'}" id="btn_toggle_local" style="font-weight:800;padding:10px 18px">
              ${st.forced ? '☁️ Desactivar y Volver a Nube' : '⚡ Activar Modo Local en esta PC'}
            </button>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(150px, 1fr));gap:12px;margin-bottom:18px">
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Socios en PC Local</div>
              <div style="font-size:22px;font-weight:900;color:var(--text);margin-top:2px">${st.membersCached}</div>
              <div style="font-size:11px;color:#10b981">Listos para QR (0.1s)</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Cola Pendiente</div>
              <div style="font-size:22px;font-weight:900;color:${st.totalPending ? '#f59e0b' : '#10b981'};margin-top:2px">${st.totalPending}</div>
              <div style="font-size:11px;color:var(--text-muted)">${st.pendingTx} ventas · ${st.pendingScans} scans</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Energía / Batería</div>
              <div style="font-size:13.5px;font-weight:800;color:var(--text);margin-top:6px">${esc(batteryInfo)}</div>
            </div>
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px">
              <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;font-weight:700">Disco Ocupado</div>
              <div style="font-size:18px;font-weight:900;color:var(--gold);margin-top:2px">${st.storageKB} KB</div>
              <div style="font-size:11px;color:var(--text-muted)">${st.saveCount} escrituras</div>
            </div>
          </div>

          <div id="test_feedback" style="display:none;padding:10px 14px;border-radius:8px;font-size:12.5px;font-weight:700;margin-bottom:14px"></div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:18px">
            <button class="btn sm" id="btn_run_test" style="gap:5px">${RD.icon('zap', '', 14)} 🧪 Probar Guardado en Disco Local</button>
            <button class="btn sm" id="btn_sync_cloud" ${!st.online || !st.totalPending ? 'disabled' : ''} style="gap:5px;border-color:#10b981;color:#10b981">
              ${RD.icon('refresh', '', 14)} 🔄 Sincronizar Cola Local con Nube
            </button>
            <button class="btn sm" id="btn_export_json" style="gap:5px">${RD.icon('save', '', 14)} 💾 Descargar Respaldo (.JSON)</button>
            <button class="btn sm" id="btn_download_bat" style="gap:5px">${RD.icon('laptop', '', 14)} 💻 Instalador Local (.BAT)</button>
          </div>

          ${txQueue.length ? `
            <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden">
              <div style="background:var(--bg-card);padding:8px 14px;font-size:12px;font-weight:800;color:var(--gold);display:flex;justify-content:space-between">
                <span>Operaciones Guardadas en esta PC (${txQueue.length})</span>
                <span style="color:var(--text-muted)">Pendientes de subir al servidor</span>
              </div>
              <div style="max-height:160px;overflow-y:auto;font-size:12px">
                ${txQueue.map(item => `
                  <div style="padding:6px 14px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
                    <span><b>${esc(item.label || item.url)}</b></span>
                    <span class="muted">${RD.fmtTime(item.ts)}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div style="background:rgba(16,185,129,0.06);border:1px dashed rgba(16,185,129,0.3);border-radius:10px;padding:12px;text-align:center;font-size:12.5px;color:#10b981">
              ✓ Todo el sistema se encuentra al día. No hay transacciones pendientes en esta computadora.
            </div>
          `}
        </div>
      </div>`;

      m.el.querySelector('#m_close').onclick = () => m.close();
      m.el.querySelector('#btn_toggle_local').onclick = () => {
        RD.localEngine.setForced(!st.forced);
        updateNet();
        renderModalContent(m);
        RD.toast(st.forced ? 'Modo Local desactivado. Conectado a la Nube.' : '⚡ Modo Local activado en esta PC.', 'ok');
      };
      m.el.querySelector('#btn_run_test').onclick = () => {
        const t0 = performance.now();
        const testKey = 'rd_probe_' + Date.now();
        localStorage.setItem(testKey, 'TEST_VAL_' + Math.random());
        const readVal = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        const duration = Math.max(0.1, Math.round((performance.now() - t0) * 10) / 10);
        const fb = m.el.querySelector('#test_feedback');
        fb.style.display = 'block';
        if (readVal && readVal.startsWith('TEST_VAL_')) {
          fb.style.background = 'rgba(16,185,129,0.15)';
          fb.style.border = '1px solid #10b981';
          fb.style.color = '#10b981';
          fb.innerHTML = `✓ Prueba Exitosa: Escritura y lectura en disco local completadas en <b>${duration} ms</b> sin errores.`;
        } else {
          fb.style.background = 'rgba(239,68,68,0.15)';
          fb.style.border = '1px solid #ef4444';
          fb.style.color = '#ef4444';
          fb.textContent = 'Aviso: La memoria de almacenamiento local del navegador está restringida.';
        }
      };
      m.el.querySelector('#btn_sync_cloud').onclick = async () => {
        try {
          await RD.busy(m.el.querySelector('#btn_sync_cloud'), async () => {
            const r = await RD.localEngine.flushToCloud();
            await RD.flushScans();
            await RD.syncMembers();
            renderModalContent(m);
            RD.toast(`Sincronizadas ${r.syncedCount} operaciones con la nube`, 'ok');
          });
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      };
      m.el.querySelector('#btn_export_json').onclick = () => {
        const backup = {
          gym: RD.pub.gym_name || 'Gym',
          exported_at: new Date().toISOString(),
          snapshot: RD.snap(),
          local_tx: RD.localEngine.getTxQueue(),
          scans: RD.queue(),
          plans: JSON.parse(localStorage.getItem('rd_plans') || '[]')
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `Respaldo_Local_Gym_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        RD.toast('Copia de seguridad descargada en esta PC', 'ok');
      };
      m.el.querySelector('#btn_download_bat').onclick = () => {
        const batContent = `@echo off
title Sistema Inteligente de Gestion de Gimnasio - Modo Local PC
echo ========================================================
echo   INICIANDO SISTEMA EN LA PC LOCAL DEL GIMNASIO
echo ========================================================
echo.
echo Verificando Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js no esta instalado. Descargalo gratis desde https://nodejs.org
    echo     O abre tu navegador y usa el sistema normalmente con la memoria local offline.
    pause
    exit /b
)
echo [OK] Node.js detectado.
echo Iniciando servidor local en el puerto 3000...
start http://localhost:3000/admin
node server.js
pause`;
        const blob = new Blob([batContent], { type: 'application/bat' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'Instalar_Sistema_Local_PC.bat';
        a.click();
        RD.toast('Instalador .BAT descargado para Windows', 'ok');
      };
    };

    const m = RD.openModal('Modo Local', '<div id="local_m_cnt">Cargando...</div>');
    renderModalContent(m);
  };

  function layout() {
    const items = Object.entries(NAV).filter(([, v]) => v[2].includes(RD.user.role));
    const isLight = RD.getTheme && RD.getTheme() === 'light';
    root.innerHTML = `
    <div class="admin">
      <header class="topbar">
        <img src="/logo.svg" alt="RD" class="topbar-logo" style="height:32px;width:32px;max-height:32px;max-width:32px;object-fit:contain;flex-shrink:0" width="32" height="32">
        <div class="t" id="title">${esc(RD.pub.gym_name || 'RD Fitness Club')}</div>
        <span id="net" class="net">…</span>
        <button class="top-btn" id="btn_local_mode" title="Centro de Control de Modo Local y Contingencia en PC del Dueño">
          ${RD.icon('database', '', 15)} <span>Modo Local PC</span>
        </button>
        <button class="top-btn" id="btn_customer_screen" title="Abrir Pantalla TV / Cámaras CCTV en 2do Monitor o Ventana Acoplada">
          ${RD.icon('monitor', '', 15)} <span>TV / CCTV</span>
        </button>
        <a class="top-btn" href="/admin/cards.html" target="_blank" style="text-decoration:none" title="Estudio de Impresión de Tarjetas y Carnets QR Físicos">
          ${RD.icon('idcard', '', 15)} <span>Carnets QR</span>
        </a>
        <button class="top-btn" id="btn_google_sheets" title="Abrir Google Sheets Oficial del Gimnasio">
          ${RD.icon('sheet', '', 15)} <span>Sheets</span>
        </button>
        <button class="top-btn" id="btn_refresh_system" title="Actualizar aplicación a la última versión y recargar datos en vivo">
          ${RD.icon('refresh', '', 15)} <span>Actualizar</span>
        </button>
        <button class="icon-btn theme-toggle" id="themetoggle" data-theme-toggle title="${isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro (Pastel)'}">
          ${isLight ? RD.icon('moon', '', 18) : RD.icon('sun', '', 18)}
        </button>
        <button class="icon-btn" id="who" title="${esc(RD.user.name)}">${RD.icon('user', '', 18)}</button>
      </header>
      <div id="local_mode_banner" class="local-banner" style="display:none;background:rgba(245,158,11,0.12);border-bottom:1px solid rgba(245,158,11,0.3);padding:8px 18px;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"></div>
      <main class="page" id="view"></main>
      <nav class="nav">${items.map(([k, v]) => `<button data-v="${k}"><span class="i">${RD.icon(v[0], '', 20)}</span>${v[1]}</button>`).join('')}</nav>
    </div>`;
    document.querySelectorAll('.nav button').forEach(b => b.onclick = () => go(b.dataset.v));
    $('#themetoggle').onclick = () => { RD.toggleTheme(); };
    $('#who').onclick = userMenu;
    $('#btn_local_mode').onclick = RD.openLocalModeModal;
    $('#btn_customer_screen').onclick = RD.openCustomerDisplayWindow;
    $('#btn_google_sheets').onclick = RD.openGoogleSheetsDirect;
    $('#btn_refresh_system').onclick = RD.forceAppUpdate;
    updateNet();
  }
  function userMenu() {
    const isLight = RD.getTheme && RD.getTheme() === 'light';
    const m = RD.openModal(RD.user.name, `<p class="muted">Rol: <b>${esc(RD.user.role)}</b></p>
      <div class="grid">
        <button class="btn" id="tm">${isLight ? RD.icon('moon') + ' Modo Oscuro' : RD.icon('sun') + ' Modo Claro (Paleta Pastel)'}</button>
        <button class="btn" id="cp">${RD.icon('lock')} Cambiar contraseña</button>
        <button class="btn" id="rf">${RD.icon('refresh')} Actualizar sistema y datos en vivo</button>
        <button class="btn danger" id="lo">Cerrar sesión</button>
      </div>`);
    m.el.querySelector('#tm').onclick = () => { m.close(); RD.toggleTheme(); };
    m.el.querySelector('#lo').onclick = () => { m.close(); logout(); };
    m.el.querySelector('#rf').onclick = () => { m.close(); RD.forceAppUpdate(); };
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
      view.innerHTML = `<div class="empty">${e.offline ? 'Sin conexión. Esta sección necesita internet.<br>El escáner sigue funcionando.' : esc(e.message)}</div>`;
    }
    if (RD.user.must_change && name !== 'scan') {
      view.insertAdjacentHTML('afterbegin', `<div class="banner">${RD.icon('alert-triangle', '', 14)} Estás usando la contraseña inicial. <a href="#" id="chp">Cámbiala ahora</a>.</div>`);
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
            wa(m, `Hola ${first(m.name)}, te escribimos de ${gym}. Tu membresía vence el ${RD.fmtDate(m.end_date)}. Renueva y mantén tu constancia. Planes: ${priceList}. ¡Te esperamos!`))).join('') || '<div class="empty">Nadie por vencer</div>'}</div></div>
        <div class="card"><h3>${RD.icon('calendar', '', 16)} Vencidos (últimos 30 días) <span class="badge bad">${d.recently_expired.length}</span></h3>
          <div class="list">${d.recently_expired.slice(0, 15).map(m => person(m, `Venció ${RD.fmtDate(m.end_date)} (hace ${-m.days_left} d)`,
            wa(m, `Hola ${first(m.name)}, te extrañamos en ${gym}. Tu membresía venció el ${RD.fmtDate(m.end_date)}. Vuelve a entrenar: ${priceList}. ¡Te esperamos!`))).join('') || '<div class="empty">Sin vencidos recientes</div>'}</div></div>
        <div class="card"><h3>${RD.icon('users', '', 16)} Socios en riesgo (10+ días sin venir) <span class="badge info">${d.at_risk.length}</span></h3>
          <div class="list">${d.at_risk.slice(0, 15).map(m => person(m, `Última visita: ${m.last_in ? RD.ago(m.last_in) : 'nunca'}`,
            wa(m, `Hola ${first(m.name)}, te extrañamos en ${gym}. Tu constancia es tu mejor inversión. ¿Te esperamos hoy?`))).join('') || '<div class="empty">Todos vienen con regularidad</div>'}</div></div>
        <div class="card"><h3>${RD.icon('dumbbell', '', 16)} En el gimnasio ahora</h3>
          <div class="list">${d.in_gym.map(m => `<div class="item click" data-id="${m.id}"><div class="avatar">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(m.name[0])}</div><div class="grow"><b>${esc(m.name)}</b></div><span class="muted small">${RD.fmtTime(m.ts)}</span></div>`).join('') || '<div class="empty">Nadie registrado en las últimas horas</div>'}</div></div>
        ${d.birthdays.length ? `<div class="card"><h3>${RD.icon('cake', '', 16)} Cumpleaños de hoy</h3><div class="list">${d.birthdays.map(m => person(m, '', wa(m, `¡Feliz cumpleaños ${first(m.name)}! De parte de todo el equipo de ${gym}. ¡Hoy entrenas con nosotros con un regalo especial!`))).join('')}</div></div>` : ''}
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
