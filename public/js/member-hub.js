/* RD Fitness Club - Hub del socio (cliente)
 * Sesión persistente por dispositivo, acceso propio, bandeja de avisos sin acoso, preferencias, dispositivos,
 * notificaciones push opt-in e instalación de la app. */
(function () {
  const RD = window.RD = window.RD || {};
  const { esc } = RD;
  const H = RD.hub = {};
  let api = null, timer = null, deferredInstall = null;

  // ---------- Dispositivo ----------
  H.deviceId = () => {
    let d = localStorage.getItem('rd_device_id');
    if (!d) { d = RD.uid(); localStorage.setItem('rd_device_id', d); }
    return d;
  };
  H.isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  H.isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  H.deviceLabel = () => {
    const ua = navigator.userAgent;
    const os = /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Dispositivo';
    return `${os} · ${H.isStandalone() ? 'App instalada' : 'Navegador'}`;
  };
  H.deviceInfo = () => ({ device_id: H.deviceId(), device_label: H.deviceLabel() });
  // Pide al navegador no borrar los datos de la app (mantiene la sesión iniciada)
  H.keepStorage = () => { try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch { } };

  // ---------- Instalación (PWA) ----------
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; });
  H.canInstall = () => !!deferredInstall && !H.isStandalone();
  H.install = async () => {
    if (!deferredInstall) return false;
    deferredInstall.prompt();
    const r = await deferredInstall.userChoice.catch(() => ({}));
    deferredInstall = null;
    return r.outcome === 'accepted';
  };

  H.openInstallGuide = () => {
    let activeTab = H.isIOS() ? 'ios' : (/Android/i.test(navigator.userAgent) ? 'android' : 'desktop');
    const m = RD.openModal('📲 Cómo instalar la App de RD Fitness', `
      <div class="small muted mb">
        Esta aplicación es una <b>PWA Oficial</b>: no requiere descargar pesados archivos de tiendas, se actualiza sola y puedes usarla tanto en tu celular (Android / iPhone) como en tu PC o Laptop.
      </div>

      ${H.canInstall() ? `
        <div class="card mb" style="background:rgba(217,119,6,0.1);border:1px solid #d97706;border-radius:10px;text-align:center;padding:12px">
          <p class="small bold" style="color:#d97706;margin:0 0 6px">✨ ¡Tu navegador permite la instalación directa con un clic!</p>
          <button class="btn primary sm" id="btn_direct_install">⚡ Instalar App ahora en este dispositivo</button>
        </div>
      ` : ''}

      <div class="chips mb" id="guide_tabs">
        <span class="chip ${activeTab === 'android' ? 'on' : ''}" data-gt="android">📱 Android (Chrome)</span>
        <span class="chip ${activeTab === 'ios' ? 'on' : ''}" data-gt="ios">🍏 iPhone / iPad (Safari)</span>
        <span class="chip ${activeTab === 'desktop' ? 'on' : ''}" data-gt="desktop">💻 PC / Laptop (Windows/Mac)</span>
      </div>

      <div id="guide_content" class="card flat" style="padding:14px;background:var(--bg2);border:1px solid var(--line);border-radius:10px"></div>
    `, { wide: true });

    const content = m.el.querySelector('#guide_content');
    const tabs = m.el.querySelector('#guide_tabs');

    const renderTab = (tab) => {
      activeTab = tab;
      tabs.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.gt === tab));
      if (tab === 'android') {
        content.innerHTML = `
          <h4 style="margin:0 0 8px;display:flex;align-items:center;gap:6px">📱 Instalación en Android (Google Chrome, Brave, Samsung)</h4>
          <ol class="small" style="padding-left:1.2rem;line-height:1.75">
            <li>Abre esta página en tu navegador <b>Google Chrome</b>.</li>
            <li>Toca el botón de <b>opciones de 3 puntos (⋮)</b> arriba a la derecha.</li>
            <li>Busca y presiona <b>"Instalar aplicación"</b> o <b>"Añadir a pantalla de inicio"</b>.</li>
            <li>Confirma tocando <b>"Instalar"</b>.</li>
          </ol>
          <div class="card flat mt small" style="background:rgba(34,197,94,0.1);border-left:4px solid #22c55e;padding:10px">
            <b>Ventajas:</b> Se crea el icono oficial de RD Fitness en tus apps, abre a pantalla completa sin barra de direcciones y guarda tu sesión para siempre.
          </div>
        `;
      } else if (tab === 'ios') {
        content.innerHTML = `
          <h4 style="margin:0 0 8px;display:flex;align-items:center;gap:6px">🍏 Instalación en iPhone / iPad (Apple Safari)</h4>
          <ol class="small" style="padding-left:1.2rem;line-height:1.75">
            <li>Abre la página exclusivamente en el navegador oficial <b>Safari</b>.</li>
            <li>En la barra inferior del iPhone (o superior del iPad), toca el botón <b>Compartir</b> (el cuadrado con la flecha hacia arriba ⎋).</li>
            <li>Desliza las opciones hacia abajo y selecciona <b>"Agregar al inicio"</b> (➕).</li>
            <li>Toca <b>"Agregar"</b> en la esquina superior derecha.</li>
          </ol>
          <div class="card flat mt small" style="background:rgba(34,197,94,0.1);border-left:4px solid #22c55e;padding:10px">
            <b>Requisito Apple:</b> En iOS, las notificaciones push y el inicio automático en pantalla completa requieren abrir la app desde la pantalla de inicio agregada con Safari.
          </div>
        `;
      } else if (tab === 'desktop') {
        content.innerHTML = `
          <h4 style="margin:0 0 8px;display:flex;align-items:center;gap:6px">💻 Instalación en Computadora / Laptop (Windows 10/11, Mac, Linux)</h4>
          <ol class="small" style="padding-left:1.2rem;line-height:1.75">
            <li>Abre la web en <b>Google Chrome</b> o <b>Microsoft Edge</b>.</li>
            <li>En el extremo derecho de la barra de direcciones (donde escribes la URL, al lado de la estrella), verás un icono de <b>pantalla con flecha</b> o símbolo <b>⊕</b>.</li>
            <li>Haz clic en <b>"Instalar RD Fitness"</b>.</li>
            <li>¡Listo! Se anclará a tu barra de tareas o escritorio y funcionará como una aplicación nativa ultra rápida.</li>
          </ol>
          <div class="card flat mt small" style="background:rgba(59,130,246,0.1);border-left:4px solid #3b82f6;padding:10px">
            <b>Recepción y Entrenamiento:</b> En recepción o pantallas táctiles de mostrador, puedes usar pantalla completa presionando F11 para una experiencia 100% profesional.
          </div>
        `;
      }
    };

    renderTab(activeTab);

    tabs.onclick = e => {
      const c = e.target.closest('[data-gt]');
      if (c) renderTab(c.dataset.gt);
    };

    const bDirect = m.el.querySelector('#btn_direct_install');
    if (bDirect) {
      bDirect.onclick = async () => {
        const ok = await H.install();
        if (ok) {
          RD.toast('¡App instalada con éxito! ✔');
          m.close();
        }
      };
    }
  };

  // ---------- Sesión: recuperar si el navegador borró el almacenamiento ----------
  H.resume = async () => {
    try {
      const r = await fetch('/api/auth/resume', { method: 'POST', credentials: 'same-origin' });
      if (!r.ok) return null;
      return await r.json();
    } catch { return null; }
  };

  // ---------- Bandeja ----------
  const ICON = { aviso: '📢', evento: '🎉', tematica: '🎨', promo: '🏷️', mantenimiento: '🛠️', cierre: '⛔', pago: '🧾', recordatorio: '⏰' };
  const KIND_LABEL = { aviso: 'Aviso', evento: 'Evento', tematica: 'Temática', promo: 'Promoción', mantenimiento: 'Mantenimiento', cierre: 'Atención', pago: 'Pago', recordatorio: 'Recordatorio' };
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const ctaHtml = c => {
    if (!c) return '';
    if (c.url && c.url.startsWith('#receipt:')) {
      const pid = c.url.replace('#receipt:', '');
      return `<button type="button" class="btn sm ok mt2" onclick="RD.showReceipt(${pid})">${esc(c.label || 'Ver Boleta')}</button>`;
    }
    return /^https:\/\//i.test(c.url)
      ? `<a class="btn sm mt2" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`
      : `<a class="btn sm mt2" href="${esc(c.url)}">${esc(c.label)}</a>`;
  };

  function paintBell(unread) {
    document.querySelectorAll('#belldot').forEach(d => { d.textContent = unread > 9 ? '9+' : String(unread); d.hidden = !unread; });
    const b = document.getElementById('bellbtn');
    if (b) b.title = unread ? `Avisos (${unread} sin leer)` : 'Avisos';
  }

  // Visualizador completo de comunicados y publicaciones del club
  H.openAnnouncementModal = (a) => {
    if (!a) return;
    const kindLabel = KIND_LABEL[a.kind] || 'Aviso';
    const kindIcon = ICON[a.kind] || '📢';
    const dateStr = a.created_at ? RD.fmtDateTime(a.created_at) : 'Reciente';

    const m = RD.openModal(`${kindIcon} ${kindLabel}`, `
      <div class="announcement-detail" style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <div class="row between wrap gap mb">
            <span class="badge ${esc(a.kind || 'aviso')}" style="font-weight:700">${kindIcon} ${esc(kindLabel)}</span>
            <span class="tiny muted">${esc(dateStr)}</span>
          </div>
          <h2 style="margin:4px 0 8px;font-size:1.35rem;line-height:1.3">${esc(a.title)}</h2>
        </div>

        ${a.image_url ? `
          <div class="ann-img-card" style="border-radius:12px;overflow:hidden;background:var(--bg3);border:1px solid var(--line);max-height:360px;position:relative;text-align:center;">
            <img id="ann_full_img" src="${esc(a.image_url)}" alt="${esc(a.title)}" style="max-width:100%;max-height:360px;width:100%;object-fit:contain;display:block;cursor:pointer;">
          </div>
          <div class="row end" style="margin-top:-4px">
            <button type="button" class="btn sm ghost" id="btn_zoom_ann">🔍 Pantalla completa / Zoom</button>
          </div>
        ` : ''}

        ${a.body ? `
          <div class="ann-body-text" style="font-size:0.95rem;line-height:1.65;white-space:pre-wrap;color:var(--text);padding:4px 2px;">
            ${nl(a.body)}
          </div>
        ` : ''}

        ${a.cta ? `
          <div class="mt pt" style="border-top:1px solid var(--line);display:flex;justify-content:flex-end;">
            ${ctaHtml(a.cta)}
          </div>
        ` : ''}

        <div class="row between wrap gap mt2 pt" style="border-top:1px solid var(--line);align-items:center;">
          <span class="tiny muted">RD Fitness Club · Comunicación Oficial</span>
          <button type="button" class="btn sm" id="btn_close_ann">Cerrar</button>
        </div>
      </div>
    `, { wide: true });

    if (a.image_url) {
      const zoomBtn = m.el.querySelector('#btn_zoom_ann');
      const imgEl = m.el.querySelector('#ann_full_img');
      const zoom = () => RD.zoomImage(a.image_url, a.title);
      if (zoomBtn) zoomBtn.onclick = zoom;
      if (imgEl) imgEl.onclick = zoom;
    }
    const closeBtn = m.el.querySelector('#btn_close_ann');
    if (closeBtn) closeBtn.onclick = () => m.close();

    // Marcar como leído si tiene ref
    if (a.ref && api) {
      api.post('/member/inbox/read', { refs: [a.ref] }).catch(() => {});
      H.refresh();
    }
  };

  function paintBanner(banner) {
    const host = document.getElementById('noticebar');
    if (!host) return;
    if (!banner) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="noticebar ${esc(banner.kind)}" role="status">
      <span class="nb-ico">${ICON[banner.kind] || '📢'}</span>
      <button class="nb-main" id="nbopen">
        <b>${esc(banner.title)}</b>
        <span>${esc(banner.body ? (banner.body.length > 90 ? banner.body.slice(0, 88) + '…' : banner.body) : 'Toca para leer el comunicado completo')}</span>
      </button>
      <button class="nb-x" id="nbx" aria-label="Descartar">✕</button>
    </div>`;
    host.querySelector('#nbopen').onclick = () => H.openAnnouncementModal(banner);
    host.querySelector('#nbx').onclick = async () => {
      host.innerHTML = '';
      try { await api.post('/member/inbox/dismiss', { ref: banner.ref }); } catch { }
    };
  }
  let lastUnreadCount = null;
  H.refresh = async () => {
    if (!api) return;
    try {
      const s = await api.get('/member/inbox/summary');
      if (lastUnreadCount !== null && typeof s.unread === 'number' && s.unread > lastUnreadCount) {
        try { if (typeof RD.beep === 'function') RD.beep('bell'); } catch {}
        try { RD.toast('📢 Nuevo comunicado oficial de RD Fitness Club', 'info', 6000); } catch {}
      }
      lastUnreadCount = s.unread;
      paintBell(s.unread);
      paintBanner(s.banner);
      if (typeof H.updateHeroAnnouncement === 'function') H.updateHeroAnnouncement();
    } catch { }
  };
  // Sincronización ágil: al abrir, al volver a la app y cada 25 s mientras está visible
  H.start = (apiRef) => {
    api = apiRef; H.stop();
    H.refresh();
    if (typeof H.autoSubscribe === 'function') H.autoSubscribe();
    timer = setInterval(() => { if (!document.hidden) H.refresh(); }, 25000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', H.refresh);
  };
  const onVis = () => { if (!document.hidden) H.refresh(); };
  H.stop = () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', H.refresh); paintBell(0); paintBanner(null); };

  H.openInbox = async () => {
    const m = RD.openModal('🔔 Avisos y Comunicados', '<div class="empty">Cargando…</div>', { wide: true });
    try {
      const d = await api.get('/member/inbox');
      const unreadRefs = d.items.filter(i => !i.read).map(i => i.ref);
      const draw = () => {
        m.el.innerHTML = `
          ${d.items.length ? `<div class="inbox">${d.items.map((i, idx) => `
            <div class="inbox-item ${i.kind} ${i.priority === 'importante' ? 'imp' : ''} ${unreadRefs.includes(i.ref) ? 'new' : ''}" data-idx="${idx}">
              <div class="ii-ico">${ICON[i.kind] || '📢'}</div>
              <div class="ii-main">
                <div class="ii-title">${esc(i.title)}${unreadRefs.includes(i.ref) ? ' <span class="ii-new">Nuevo</span>' : ''}${i.pinned ? ' <span class="ii-pin">📌</span>' : ''}</div>
                ${i.image_url ? `
                  <div class="ii-img-wrap mb mt inb-img-wrap" style="margin:8px 0;max-height:220px;overflow:hidden;border-radius:8px;border:1px solid var(--line);cursor:pointer;background:var(--bg3)">
                    <img src="${esc(i.image_url)}" class="ii-img" alt="${esc(i.title)}" style="width:100%;max-height:220px;object-fit:cover;display:block">
                  </div>
                ` : ''}
                ${i.body ? `<div class="ii-body" style="white-space:pre-wrap;line-height:1.5;">${nl(i.body)}</div>` : ''}
                <div class="ii-meta">${esc(KIND_LABEL[i.kind] || 'Aviso')} · ${i.source === 'system' ? 'Tu cuenta' : 'RD Fitness Club'} · ${RD.ago(i.created_at)}</div>
                <div class="row wrap gap mt2" style="align-items:center">
                  ${ctaHtml(i.cta)}
                  <button type="button" class="btn sm ghost inb-read-btn">👁️ Ver completo</button>
                </div>
              </div>
            </div>`).join('')}</div>`
            : '<div class="empty">🎉 Todo al día.<br><span class="small">No tienes avisos por ahora.</span></div>'}
          <div class="row between wrap gap mt">
            <div class="row gap">
              <button class="btn sm ghost" id="inbprefs">⚙️ Preferencias</button>
              <button class="btn sm ok ghost" id="inbreceipts">🧾 Mis Boletas</button>
            </div>
            <span class="tiny muted">RD Fitness Club · Notificaciones oficiales</span>
          </div>`;

        m.el.querySelectorAll('.inbox-item').forEach(itemEl => {
          const item = d.items[+itemEl.dataset.idx];
          if (!item) return;
          const imgWrap = itemEl.querySelector('.inb-img-wrap');
          if (imgWrap && item.image_url) {
            imgWrap.onclick = () => RD.zoomImage(item.image_url, item.title);
          }
          const readBtn = itemEl.querySelector('.inb-read-btn');
          if (readBtn) {
            readBtn.onclick = () => {
              m.close();
              H.openAnnouncementModal(item);
            };
          }
        });

        m.el.querySelector('#inbprefs').onclick = () => { m.close(); H.openPrefs(); };
        m.el.querySelector('#inbreceipts').onclick = () => { m.close(); H.openReceipts(); };
      };
      draw();
      if (unreadRefs.length) { await api.post('/member/inbox/read', { refs: unreadRefs }).catch(() => { }); H.refresh(); }
    } catch (e) {
      m.el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión. Los avisos se cargan con internet.' : esc(e.message)}</div>`;
    }
  };

  // ---------- Historial de boletas digitales del socio ----------
  H.openReceipts = async () => {
    const m = RD.openModal('🧾 Mis Boletas y Pagos', '<div class="empty">Cargando comprobantes…</div>', { wide: true });
    try {
      const data = await api.get('/member/receipts');
      const list = data.receipts || [];
      if (!list.length) {
        m.el.innerHTML = '<div class="empty">No tienes boletas registradas todavía.<br><span class="small muted">Al realizar un pago o renovar tu membresía aparecerán aquí automáticamente.</span></div>';
        return;
      }
      m.el.innerHTML = `
        <p class="small muted mb">Historial de pagos de membresías y consumos en RD Fitness Club con valor de comprobante.</p>
        <div class="list">
          ${list.map(r => `
            <div class="card item mb" style="padding:10px 14px;align-items:center">
              <div class="grow">
                <div class="row between wrap gap">
                  <span class="bold small">${esc(r.concept)}</span>
                  <span class="gold bold">${RD.money(r.amount)}</span>
                </div>
                <div class="row gap wrap tiny muted mt2">
                  <span><b>N° Boleta:</b> ${esc(r.receipt_no)}</span>
                  <span>·</span>
                  <span><b>Fecha:</b> ${RD.fmtDate(r.date)}</span>
                  <span>·</span>
                  <span><b>Pago:</b> ${(r.method || 'efectivo').toUpperCase()}</span>
                  ${r.op_code ? `<span>· <b>Op:</b> #${esc(r.op_code)}</span>` : ''}
                </div>
                ${r.validity ? `<div class="tiny info mt2">${esc(r.validity)}</div>` : ''}
              </div>
              <button class="btn sm ok" data-view-receipt="${r.id}">🧾 Ver Boleta</button>
            </div>
          `).join('')}
        </div>
      `;
      m.el.querySelectorAll('[data-view-receipt]').forEach(b => {
        b.onclick = () => RD.showReceipt(+b.dataset.viewReceipt);
      });
    } catch (e) {
      m.el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión.' : esc(e.message)}</div>`;
    }
  };

  // ---------- Preferencias y notificaciones push ----------
  const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const b64ToU8 = s => { const p = '='.repeat((4 - s.length % 4) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  async function currentSub() { try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch { return null; } }
  H.enablePush = async () => {
    const cfg = await api.get('/member/push/config');
    if (!cfg.enabled) throw new Error('Los avisos al celular no están disponibles por ahora.');
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('No diste permiso para notificaciones. Puedes activarlo en los ajustes del navegador.');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.publicKey) });
    await api.post('/member/push/subscribe', { subscription: sub.toJSON(), device_id: H.deviceId() });
    return true;
  };
  H.autoSubscribe = async () => {
    try {
      if (!pushSupported()) return;
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const cfg = await api.get('/member/push/config');
      if (!cfg || !cfg.enabled) return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(cfg.publicKey) });
      }
      if (sub) {
        await api.post('/member/push/subscribe', { subscription: sub.toJSON(), device_id: H.deviceId() });
      }
    } catch (e) {
      console.warn('Auto-subscribe push notice:', e.message);
    }
  };
  H.disablePush = async () => {
    const sub = await currentSub();
    if (sub) { const ep = sub.endpoint; await sub.unsubscribe().catch(() => { }); await api.post('/member/push/unsubscribe', { endpoint: ep }).catch(() => { }); }
  };

  const sw = (key, label, hint, on) => `<label class="sw-row"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" class="sw" data-k="${key}" ${on ? 'checked' : ''}></label>`;

  H.openPrefs = async () => {
    const m = RD.openModal('⚙️ Preferencias de avisos', '<div class="empty">Cargando…</div>');
    try {
      const p = await api.get('/member/prefs');
      const sub = pushSupported() ? await currentSub() : null;
      const needInstall = H.isIOS() && !H.isStandalone();
      m.el.innerHTML = `
        <h4>En mi bandeja 🔔</h4>
        ${sw('show_reminders', 'Recordatorios de mi cuenta', 'Vencimiento de membresía y pagos registrados', p.show_reminders)}
        ${sw('show_promos', 'Promociones y temáticas', 'Ofertas, eventos y días especiales', p.show_promos)}
        <h4 class="mt">En mi celular 📲 <span class="tiny muted">(opcional)</span></h4>
        <div class="card flat" id="pushbox">
          ${!pushSupported() ? `<div class="small muted">Este navegador no admite notificaciones al celular. Seguirás viendo todo en la campana 🔔.</div>`
            : needInstall ? `<div class="small muted">En iPhone/iPad primero instala la app: toca <b>Compartir</b> ➜ <b>Añadir a pantalla de inicio</b> y ábrela desde ahí para poder activar los avisos.</div>`
            : `<div class="row between wrap gap"><div class="small">${sub ? '✅ Activadas en este dispositivo' : 'Desactivadas en este dispositivo'}</div>
                <div class="row gap"><button class="btn sm ${sub ? '' : 'primary'}" id="pushtoggle">${sub ? 'Desactivar' : 'Activar'}</button>${sub ? '<button class="btn sm ghost" id="pushtest">Probar Push</button>' : ''}</div></div>`}
        </div>
        <div id="pushopts" class="${sub ? '' : 'dim'}">
          <label class="field mt mb">
            <span>Modo de alerta de notificaciones:</span>
            <select id="pref_alert_mode">
              <option value="sound" ${p.alert_mode === 'sound' ? 'selected' : ''}>🔊 Sonido y vibración (Recomendado)</option>
              <option value="vibrate" ${p.alert_mode === 'vibrate' ? 'selected' : ''}>📳 Solo vibración (Silencioso con vibración)</option>
              <option value="silent" ${p.alert_mode === 'silent' ? 'selected' : ''}>🔕 Totalmente silencioso (Solo en pantalla)</option>
            </select>
          </label>
          <div class="row gap mb">
            <button type="button" class="btn sm ghost" id="btn_test_chime">🔔 Probar timbre y vibración</button>
          </div>
          ${sw('push_critical', 'Avisos importantes', 'Cierres, mantenimiento o cambios de horario', p.push_critical)}
          ${sw('push_news', 'Novedades', 'Noticias del gimnasio', p.push_news)}
          ${sw('push_promos', 'Promociones', 'Ofertas y descuentos', p.push_promos)}
        </div>
        <p class="tiny muted mt">Respetamos tu descanso: nada de notificaciones de 9 pm a 7 am y como máximo una novedad o promoción cada 6 horas. Siempre podrás verlo todo en la campana.</p>`;

      m.el.querySelectorAll('.sw').forEach(i => i.onchange = async () => {
        try { await api.put('/member/prefs', { [i.dataset.k]: i.checked }); } catch (e) { i.checked = !i.checked; RD.toast(e.message, 'err'); }
      });
      const amSel = m.el.querySelector('#pref_alert_mode');
      if (amSel) {
        amSel.onchange = async () => {
          try {
            await api.put('/member/prefs', { alert_mode: amSel.value });
            RD.toast('Preferencia de alerta guardada ✔');
          } catch (e) { RD.toast(e.message, 'err'); }
        };
      }
      const btChime = m.el.querySelector('#btn_test_chime');
      if (btChime) {
        btChime.onclick = () => {
          const mode = amSel ? amSel.value : 'sound';
          if (mode === 'sound') {
            RD.beep('bell');
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            RD.toast('Reproduciendo timbre y vibración 🔊');
          } else if (mode === 'vibrate') {
            if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
            RD.toast('Vibración emitida 📳');
          } else {
            RD.toast('Modo silencioso: sin sonido ni vibración 🔕');
          }
        };
      }
      const tg = m.el.querySelector('#pushtoggle');
      if (tg) tg.onclick = async () => {
        await RD.busy(tg, async () => {
          try { if (sub) await H.disablePush(); else await H.enablePush(); m.close(); H.openPrefs(); RD.toast(sub ? 'Avisos al celular desactivados' : 'Avisos al celular activados ✔'); }
          catch (e) { RD.toast(e.message, 'err', 5000); }
        });
      };
      const ts = m.el.querySelector('#pushtest');
      if (ts) ts.onclick = async () => { try { await api.post('/member/push/test'); RD.toast('Enviamos una notificación de prueba'); } catch (e) { RD.toast(e.message, 'err'); } };
    } catch (e) { m.el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión.' : esc(e.message)}</div>`; }
  };

  // ---------- Mi acceso (usuario y contraseña propios) ----------
  H.openAccount = (member, onDone, opts = {}) => {
    const has = !!member.has_password;
    const m = RD.openModal(opts.first ? '✨ Personaliza tu acceso' : '🔐 Mi usuario y contraseña', `
      <p class="small muted">${opts.first
        ? 'Elige un usuario fácil de recordar y tu propia contraseña. Tu código <b>' + esc(member.code) + '</b> no cambia: es tu identificador en el gimnasio.'
        : 'Tu código <b>' + esc(member.code) + '</b> no cambia. Aquí gestionas cómo ingresas a la app.'}</p>
      <form id="acf" autocomplete="off">
        <label class="field"><span>Mi usuario (alias)</span>
          <input name="alias" value="${esc(member.alias || '')}" placeholder="ej. carlos.fit" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false">
          <small id="aliashint" class="tiny muted">3 a 20 caracteres: letras, números, punto o guion bajo.</small></label>
        <label class="field"><span>${has ? 'Nueva contraseña (opcional)' : 'Mi nueva contraseña (mín. 6)'}</span>
          <div class="pw"><input name="np" type="password" minlength="6" maxlength="72" autocomplete="new-password" ${has ? '' : 'required'}><button type="button" class="pw-eye" data-eye>👁</button></div></label>
        <label class="field"><span>Repetir contraseña</span>
          <div class="pw"><input name="np2" type="password" autocomplete="new-password"><button type="button" class="pw-eye" data-eye>👁</button></div></label>
        <hr class="sep">
        <label class="field"><span>${has ? 'Mi contraseña actual' : 'Mi contraseña actual (tu DNI)'} *</span>
          <div class="pw"><input name="cur" type="password" required autocomplete="current-password" ${has ? '' : 'inputmode="numeric"'}><button type="button" class="pw-eye" data-eye>👁</button></div></label>
        <button class="btn primary block mt">Guardar</button>
        ${has ? '<p class="tiny muted mt center">Al cambiar tu contraseña se cerrará tu sesión en los demás dispositivos.</p>' : ''}
      </form>`);
    const f = m.el.querySelector('#acf'), hint = m.el.querySelector('#aliashint');
    m.el.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = b.previousElementSibling; i.type = i.type === 'password' ? 'text' : 'password'; });
    const check = RD.debounce(async () => {
      const a = f.alias.value.trim();
      if (!a || a.toLowerCase() === String(member.alias || '').toLowerCase()) { hint.className = 'tiny muted'; hint.textContent = '3 a 20 caracteres: letras, números, punto o guion bajo.'; return; }
      try { const r = await api.get('/member/alias-available?alias=' + encodeURIComponent(a)); hint.className = 'tiny ' + (r.available ? 'ok' : 'bad'); hint.textContent = r.available ? '✔ Disponible' : r.reason; } catch { }
    }, 350);
    f.alias.oninput = check;
    f.onsubmit = async e => {
      e.preventDefault();
      if (f.np.value !== f.np2.value) return RD.toast('Las contraseñas no coinciden', 'warn');
      await RD.busy(f.querySelector('button.primary'), async () => {
        try {
          const r = await api.post('/member/credentials', { alias: f.alias.value.trim(), new_password: f.np.value, current_secret: f.cur.value });
          RD.toast('Acceso actualizado ✔'); m.close(); onDone && onDone(r.member);
        } catch (err) { RD.toast(err.message, 'err', 5000); }
      });
    };
  };

  // ---------- Mis dispositivos ----------
  H.openDevices = async () => {
    const m = RD.openModal('📱 Mis dispositivos', '<div class="empty">Cargando…</div>');
    const draw = async () => {
      try {
        const list = await api.get('/member/devices');
        m.el.innerHTML = `<p class="small muted">Estos dispositivos tienen tu sesión iniciada. Si no reconoces alguno, ciérralo.</p>
          <div class="list">${list.map(d => `<div class="item">
            <div class="avatar">${/iPhone|Android/.test(d.label) ? '📱' : '💻'}</div>
            <div class="grow"><b>${esc(d.label)}</b> ${d.current ? '<span class="badge ok">Este dispositivo</span>' : ''}
              <div class="tiny muted">Último uso ${RD.ago(d.last_seen)}</div></div>
            ${d.current ? '' : `<button class="btn sm ghost" data-close-dev="${esc(d.id)}">Cerrar</button>`}</div>`).join('')}</div>
          ${list.length > 1 ? '<button class="btn sm danger block mt" id="closeothers">Cerrar sesión en los demás</button>' : ''}`;
        m.el.querySelectorAll('[data-close-dev]').forEach(b => b.onclick = async () => { try { await api.del('/member/devices/' + b.dataset.closeDev); RD.toast('Dispositivo cerrado'); draw(); } catch (e) { RD.toast(e.message, 'err'); } });
        const co = m.el.querySelector('#closeothers');
        if (co) co.onclick = async () => { if (await RD.confirm('Cerrar otras sesiones', 'Tendrán que volver a ingresar con su usuario y contraseña.', 'Cerrar', true)) { await api.post('/member/devices/logout-others'); RD.toast('Listo'); draw(); } };
      } catch (e) { m.el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión.' : esc(e.message)}</div>`; }
    };
    draw();
  };

  // ---------- Ayuda para recuperar acceso ----------
  H.forgot = async () => {
    let phone = '982404043';
    try { const p = await (await fetch('/api/public')).json(); if (p.gym_phone) phone = p.gym_phone; } catch { }
    const wa = RD.waLink(phone, 'Hola, olvidé mi contraseña de la app. ¿Me ayudan a restablecerla?');
    RD.openModal('¿Olvidaste tu contraseña?', `
      <p class="small">Por seguridad, la restablece el personal del gimnasio. Con tu DNI en mano:</p>
      <ol class="small" style="padding-left:1.1rem;line-height:1.6"><li>Acércate a recepción o escríbenos por WhatsApp.</li><li>Te restablecemos el acceso: tu contraseña vuelve a ser tu <b>DNI</b>.</li><li>Ingresa y crea una nueva contraseña propia.</li></ol>
      ${wa ? `<a class="btn ok block mt" target="_blank" rel="noopener" href="${wa}">💬 Escribir por WhatsApp</a>` : ''}`);
  };

  // Abrir la bandeja al tocar una notificación push
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', e => { if (e.data && e.data.type === 'open-inbox' && api) H.openInbox(); });
  }
})();
