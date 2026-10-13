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
  const ctaHtml = c => !c ? '' : /^https:\/\//i.test(c.url)
    ? `<a class="btn sm mt2" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.label)}</a>`
    : `<a class="btn sm mt2" href="${esc(c.url)}">${esc(c.label)}</a>`;

  function paintBell(unread) {
    document.querySelectorAll('#belldot').forEach(d => { d.textContent = unread > 9 ? '9+' : String(unread); d.hidden = !unread; });
    const b = document.getElementById('bellbtn');
    if (b) b.title = unread ? `Avisos (${unread} sin leer)` : 'Avisos';
  }
  function paintBanner(banner) {
    const host = document.getElementById('noticebar');
    if (!host) return;
    if (!banner) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="noticebar ${esc(banner.kind)}" role="status">
      <span class="nb-ico">${ICON[banner.kind] || '📢'}</span>
      <button class="nb-main" id="nbopen"><b>${esc(banner.title)}</b>${banner.body ? `<span>${esc(banner.body.length > 90 ? banner.body.slice(0, 88) + '…' : banner.body)}</span>` : ''}</button>
      <button class="nb-x" id="nbx" aria-label="Descartar">✕</button></div>`;
    host.querySelector('#nbopen').onclick = () => H.openInbox();
    host.querySelector('#nbx').onclick = async () => {
      host.innerHTML = '';
      try { await api.post('/member/inbox/dismiss', { ref: banner.ref }); } catch { }
    };
  }
  H.refresh = async () => {
    if (!api) return;
    try { const s = await api.get('/member/inbox/summary'); paintBell(s.unread); paintBanner(s.banner); } catch { }
  };
  // Sincronización suave: al abrir, al volver a la app y cada 90 s mientras está visible (sin sondeo en segundo plano)
  H.start = (apiRef) => {
    api = apiRef; H.stop();
    H.refresh();
    timer = setInterval(() => { if (!document.hidden) H.refresh(); }, 90000);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('online', H.refresh);
  };
  const onVis = () => { if (!document.hidden) H.refresh(); };
  H.stop = () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('online', H.refresh); paintBell(0); paintBanner(null); };

  H.openInbox = async () => {
    const m = RD.openModal('🔔 Avisos', '<div class="empty">Cargando…</div>');
    try {
      const d = await api.get('/member/inbox');
      const unreadRefs = d.items.filter(i => !i.read).map(i => i.ref);
      const draw = () => {
        m.el.innerHTML = `
          ${d.items.length ? `<div class="inbox">${d.items.map(i => `
            <div class="inbox-item ${i.kind} ${i.priority === 'importante' ? 'imp' : ''} ${unreadRefs.includes(i.ref) ? 'new' : ''}">
              <div class="ii-ico">${ICON[i.kind] || '📢'}</div>
              <div class="ii-main">
                <div class="ii-title">${esc(i.title)}${unreadRefs.includes(i.ref) ? ' <span class="ii-new">Nuevo</span>' : ''}${i.pinned ? ' <span class="ii-pin">📌</span>' : ''}</div>
                ${i.body ? `<div class="ii-body">${nl(i.body)}</div>` : ''}
                <div class="ii-meta">${esc(KIND_LABEL[i.kind] || 'Aviso')} · ${i.source === 'system' ? 'Tu cuenta' : 'RD Fitness Club'} · ${RD.ago(i.created_at)}</div>
                ${ctaHtml(i.cta)}
              </div>
            </div>`).join('')}</div>`
            : '<div class="empty">🎉 Todo al día.<br><span class="small">No tienes avisos por ahora.</span></div>'}
          <div class="row between wrap gap mt">
            <button class="btn sm ghost" id="inbprefs">⚙️ Preferencias de avisos</button>
            <span class="tiny muted">Solo ves lo importante. Tú decides el resto.</span>
          </div>`;
        m.el.querySelector('#inbprefs').onclick = () => { m.close(); H.openPrefs(); };
      };
      draw();
      if (unreadRefs.length) { await api.post('/member/inbox/read', { refs: unreadRefs }).catch(() => { }); H.refresh(); }
    } catch (e) {
      m.el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión. Los avisos se cargan con internet.' : esc(e.message)}</div>`;
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
                <div class="row gap"><button class="btn sm ${sub ? '' : 'primary'}" id="pushtoggle">${sub ? 'Desactivar' : 'Activar'}</button>${sub ? '<button class="btn sm ghost" id="pushtest">Probar</button>' : ''}</div></div>`}
        </div>
        <div id="pushopts" class="${sub ? '' : 'dim'}">
          ${sw('push_critical', 'Avisos importantes', 'Cierres, mantenimiento o cambios de horario', p.push_critical)}
          ${sw('push_news', 'Novedades', 'Noticias del gimnasio', p.push_news)}
          ${sw('push_promos', 'Promociones', 'Ofertas y descuentos', p.push_promos)}
        </div>
        <p class="tiny muted mt">Respetamos tu descanso: nada de notificaciones de 9 pm a 7 am y como máximo una novedad o promoción cada 6 horas. Siempre podrás verlo todo en la campana.</p>`;

      m.el.querySelectorAll('.sw').forEach(i => i.onchange = async () => {
        try { await api.put('/member/prefs', { [i.dataset.k]: i.checked }); } catch (e) { i.checked = !i.checked; RD.toast(e.message, 'err'); }
      });
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
