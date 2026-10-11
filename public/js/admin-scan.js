/* RD Fitness Club - Escáner de acceso (funciona sin internet) */
(function () {
  const RD = window.RD;
  const { esc } = RD;
  const lastSeen = {};            // code -> ms del último ingreso aceptado (anti-duplicado)
  const recent = [];              // últimos escaneos de esta sesión
  const device = () => localStorage.getItem('rd_device') || (localStorage.setItem('rd_device', (RD.user?.username || 'staff') + '-' + Math.random().toString(36).slice(2, 5)), localStorage.getItem('rd_device'));

  // ---------- Evaluación de un código ----------
  RD.evaluate = async function (text) {
    let snap = RD.snap();
    if (!snap) {
      if (navigator.onLine) { try { snap = await RD.syncMembers(); } catch { } }
      if (!snap) return { level: 'invalid', reason: 'Sin datos. Conéctate a internet una vez para sincronizar.' };
    }
    const p = RD.parsePayload(text);
    if (!p) return { level: 'invalid', reason: 'Código no válido. No es una credencial de RD Fitness.' };
    let m = RD.findMember(p.code);
    if (!m && navigator.onLine) { try { await RD.syncMembers(); m = RD.findMember(p.code); } catch { } }
    if (!m) return { level: 'invalid', code: p.code, reason: 'Socio no encontrado. Sincroniza los datos.' };
    const sig = await RD.hmac(m.key, `${p.code}|${p.kind}${p.n}`);
    if (sig !== p.sig) return { level: 'invalid', code: p.code, reason: 'Código falsificado o alterado.' };
    if (p.kind === 'P' && p.n > m.pv && navigator.onLine) { try { await RD.syncMembers(); m = RD.findMember(p.code); } catch { } }
    if (p.kind === 'P' && p.n < m.pv) return { level: 'denied', member: m, code: p.code, kind: p.kind, reason: 'Tarjeta anulada o reemplazada' };
    if (p.kind === 'D') {
      const cur = Math.floor(RD.now() / 60000);
      if (Math.abs(cur - p.n) > 1) return { level: 'denied', member: m, code: p.code, kind: p.kind, reason: 'QR digital caducado. Que actualice o reabra su app.' };
    }
    return decide(m, p.kind);
  };

  function decide(m, kind) {
    const snap = RD.snap();
    const st = RD.accessState({ status: m.status, frozen: m.frozen, end: m.end }, RD.limaDay(), snap.cfg);
    const r = { level: st.level, reason: st.reason, daysLeft: st.daysLeft, member: m, code: m.code, kind };
    if (st.level !== 'denied') {
      const pb = (snap.cfg.passback_min || 3) * 60000;
      const last = Math.max(lastSeen[m.code] || 0, m.last_in ? Date.parse(m.last_in) : 0);
      if (last && RD.now() - last < pb && RD.now() - last >= 0) { r.dup = true; r.mins = Math.max(0, Math.round((RD.now() - last) / 60000)); }
    }
    return r;
  }

  function record(r, kindOverride) {
    if (r.dup) return;
    const entry = { uid: RD.uid(), code: r.code || null, ts: RD.now(), result: r.level, reason: r.reason, kind: kindOverride || r.kind || null, device: device() };
    if (r.level === 'invalid' && !r.code) return; // basura: no se guarda
    if (r.level === 'ok' || r.level === 'warn') lastSeen[r.code] = entry.ts;
    RD.pushScan(entry);
    recent.unshift({ ...entry, name: r.member?.name });
    recent.length = Math.min(recent.length, 10);
    clearTimeout(record._t); record._t = setTimeout(() => RD.flushScans(), 800);
  }

  // ---------- Pantalla de resultado ----------
  let overlay = null, hideT = null;
  function showResult(r) {
    clearTimeout(hideT);
    if (overlay) overlay.remove();
    const m = r.member;
    const lvl = r.level;
    const titles = { ok: '✔ ADELANTE', warn: '⚠ PUEDE PASAR', denied: '✖ NO PUEDE PASAR', invalid: '? CÓDIGO NO VÁLIDO' };
    const head = r.dup ? '✔ YA REGISTRADO' : titles[lvl];
    overlay = document.createElement('div');
    overlay.className = 'result ' + (r.dup ? 'ok' : lvl);
    const phone = m && RD.waLink(m.phone, '');
    overlay.innerHTML = `
      ${m ? (m.photo ? `<img class="ph" src="${esc(m.photo)}" alt="">` : `<div class="ph">${esc(m.name[0] || '?')}</div>`) : ''}
      <div class="big">${head}</div>
      ${m ? `<div class="nm">${esc(m.name)}</div><div class="sub">${esc(m.plan || 'Sin plan')} · vence ${RD.fmtDate(m.end)}</div>` : ''}
      <div class="sub" style="margin-top:.4rem;font-weight:700">${esc(r.reason)}${r.dup ? ` · ingresó hace ${r.mins} min (no se duplica)` : ''}</div>
      <div class="acts">
        ${m && (lvl === 'denied' || lvl === 'warn') && m.status === 'active' ? '<button class="btn" data-a="renew">💳 Renovar ahora</button>' : ''}
        ${m ? '<button class="btn" data-a="profile">Ver ficha</button>' : ''}
        <button class="btn" data-a="close">Cerrar</button>
      </div>`;
    document.body.appendChild(overlay);
    RD.beep(r.dup ? 'ok' : lvl === 'invalid' ? 'denied' : lvl);
    const close = () => { clearTimeout(hideT); overlay && overlay.remove(); overlay = null; };
    overlay.addEventListener('click', e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'renew') { close(); RD.renewDialog(m.id, m.name, async () => { await RD.syncMembers().catch(() => { }); }); }
      else if (a === 'profile') { close(); RD.openMember(m.id); }
      else close();
    });
    const ms = r.dup ? 1800 : lvl === 'ok' ? 1700 : lvl === 'warn' ? 3200 : 9000;
    hideT = setTimeout(close, ms);
  }

  // ---------- Vista del escáner ----------
  RD.views.scan = {
    async render(view) {
      view.innerHTML = `
      <div class="row between wrap gap mb">
        <div class="small muted" id="sinfo">…</div>
        <button class="btn sm" id="sync">🔄 Sincronizar</button>
      </div>
      <div class="scanbox" id="sbox">
        <video id="vid" playsinline muted></video>
        <div class="frame"></div>
        <div class="tools"><button id="torch" title="Linterna" class="hidden">🔦</button><button id="flip" title="Cambiar cámara">🔄</button></div>
        <div class="hint" id="shint">Iniciando cámara…</div>
      </div>
      <div class="row gap mt wrap">
        <button class="btn" id="cam">⏸ Pausar cámara</button>
        <span class="muted small grow">También funciona con lector USB/Bluetooth: apunta y escanea, sin tocar nada.</span>
      </div>
      <div class="card mt"><h3>Búsqueda manual</h3>
        <input id="msearch" placeholder="Nombre, DNI o código (ej. RD-0012)" autocomplete="off">
        <div class="list mt2" id="mres"></div></div>
      <div class="card mt"><h3>Últimos escaneos</h3><div class="list" id="recent"></div></div>`;
      const vid = view.querySelector('#vid');
      let stream = null, running = false, facing = 'environment', detector = null, canvas = null, ctx = null, busy = false, lastRun = 0, lastText = '', lastAt = 0;
      const hint = t => view.querySelector('#shint').textContent = t;

      const info = () => {
        const s = RD.snap(); const el = view.querySelector('#sinfo'); if (!el) return;
        el.innerHTML = s ? `Socios cargados: <b>${s.members.length}</b> · actualizado ${RD.ago(new Date(s.at).toISOString())}${RD.queue().length ? ` · <span class="warn">${RD.queue().length} ingreso(s) por enviar</span>` : ''}` : '<span class="bad">Sin datos: conecta a internet y pulsa Sincronizar</span>';
      };
      const drawRecent = () => {
        const el = view.querySelector('#recent'); if (!el) return;
        el.innerHTML = recent.map(s => `<div class="item"><span class="badge ${s.result === 'ok' ? 'ok' : s.result === 'warn' ? 'warn' : 'denied'}">${s.result === 'ok' ? 'Entró' : s.result === 'warn' ? 'Aviso' : 'Rechazado'}</span><div class="grow"><b>${esc(s.name || s.code || '—')}</b><div class="muted tiny">${esc(s.reason || '')}</div></div><span class="muted small">${RD.fmtTime(new Date(s.ts).toISOString())}</span></div>`).join('') || '<div class="empty">Aún no hay escaneos</div>';
      };
      info(); drawRecent();
      const infoT = setInterval(info, 5000);

      async function onCode(text) {
        const now = Date.now();
        if (text === lastText && now - lastAt < 3500) return;
        lastText = text; lastAt = now;
        let r;
        try { r = await RD.evaluate(text); } catch (e) { r = { level: 'invalid', reason: 'Error al validar: ' + e.message }; }
        record(r); showResult(r); drawRecent(); info();
      }

      // --- Cámara ---
      async function decodeFrame() {
        if (detector) {
          const codes = await detector.detect(vid);
          return codes.length ? codes[0].rawValue : null;
        }
        const w = 640, h = Math.round(640 * vid.videoHeight / vid.videoWidth) || 480;
        if (!canvas) { canvas = document.createElement('canvas'); ctx = canvas.getContext('2d', { willReadFrequently: true }); }
        canvas.width = w; canvas.height = h; ctx.drawImage(vid, 0, 0, w, h);
        const img = ctx.getImageData(0, 0, w, h);
        const res = window.jsQR(img.data, w, h, { inversionAttempts: 'attemptBoth' });
        return res ? res.data : null;
      }
      function loop() {
        if (!running) return;
        const t = performance.now();
        if (t - lastRun > 90 && !busy && vid.readyState >= 2 && vid.videoWidth) {
          lastRun = t; busy = true;
          decodeFrame().then(txt => { if (txt) onCode(txt); }).catch(() => { detector = null; }).finally(() => { busy = false; });
        }
        requestAnimationFrame(loop);
      }
      async function startCam() {
        if (running) return;
        if (!navigator.mediaDevices?.getUserMedia) { hint('Este navegador no permite usar la cámara. Usa HTTPS o un lector USB.'); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          vid.srcObject = stream; await vid.play();
          try { detector = ('BarcodeDetector' in window) ? new BarcodeDetector({ formats: ['qr_code'] }) : null; } catch { detector = null; }
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          view.querySelector('#torch').classList.toggle('hidden', !caps.torch);
          running = true; hint('Acerca el QR al recuadro'); view.querySelector('#cam').textContent = '⏸ Pausar cámara';
          loop();
        } catch (e) {
          hint(e.name === 'NotAllowedError' ? 'Permiso de cámara denegado. Actívalo en el navegador.' : 'No se pudo abrir la cámara: ' + e.message);
        }
      }
      function stopCam() {
        running = false;
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null; vid.srcObject = null; view.querySelector('#cam') && (view.querySelector('#cam').textContent = '▶ Activar cámara');
        hint('Cámara en pausa');
      }
      view.querySelector('#cam').onclick = () => running ? stopCam() : startCam();
      view.querySelector('#flip').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; stopCam(); startCam(); };
      let torchOn = false;
      view.querySelector('#torch').onclick = async () => { try { torchOn = !torchOn; await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: torchOn }] }); } catch { } };
      view.querySelector('#sync').onclick = async e => RD.busy(e.target, async () => {
        try { await RD.flushScans(); await RD.syncMembers(); RD.toast('Datos sincronizados'); info(); } catch (err) { RD.toast(err.offline ? 'Sin internet: se usarán los últimos datos guardados' : err.message, 'warn'); }
      });

      // --- Lector USB / Bluetooth (se comporta como teclado) ---
      let buf = '', bufT = 0;
      const onKey = e => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('.modal-back')) return;
        const now = Date.now();
        if (now - bufT > 120) buf = '';
        bufT = now;
        if (e.key === 'Enter') { if (buf.length > 10) onCode(buf.trim()); buf = ''; }
        else if (e.key.length === 1) buf += e.key;
      };
      document.addEventListener('keydown', onKey);

      // --- Búsqueda manual ---
      const search = view.querySelector('#msearch'), mres = view.querySelector('#mres');
      search.oninput = RD.debounce(() => {
        const t = search.value.trim().toLowerCase(); if (t.length < 2) { mres.innerHTML = ''; return; }
        const list = (RD.snap()?.members || []).filter(m => [m.name, m.dni, m.code].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 8);
        mres.innerHTML = list.map(m => {
          const st = RD.accessState({ status: m.status, frozen: m.frozen, end: m.end }, RD.limaDay(), RD.snap().cfg);
          return `<div class="item click" data-code="${esc(m.code)}"><div class="avatar">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(m.name[0])}</div><div class="grow"><b>${esc(m.name)}</b><div class="muted small">${esc(m.code)} · DNI ${esc(m.dni || '—')} · vence ${RD.fmtDate(m.end)}</div></div><span class="badge ${st.level}">${st.level === 'ok' ? 'Vigente' : st.level === 'warn' ? 'Por vencer' : 'No vigente'}</span></div>`;
        }).join('') || '<div class="empty">Sin resultados</div>';
      }, 150);
      mres.onclick = e => {
        const it = e.target.closest('[data-code]'); if (!it) return;
        const m = RD.findMember(it.dataset.code);
        const r = decide(m, 'M');
        // Ingreso manual: se pide confirmar identidad (no hubo QR)
        RD.confirm('Ingreso manual', `Confirma que verificaste la identidad de ${m.name} (DNI ${m.dni || '—'}). ¿Registrar ingreso?`, 'Registrar').then(ok => {
          if (!ok) return; record(r, 'M'); showResult(r); drawRecent(); info(); search.value = ''; mres.innerHTML = '';
        });
      };

      startCam();
      return () => { clearInterval(infoT); stopCam(); document.removeEventListener('keydown', onKey); if (overlay) { overlay.remove(); overlay = null; } };
    }
  };
})();
