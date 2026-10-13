/* RD Fitness Club - Escáner de acceso universal (Socios, Pases Diarios y Lector de Códigos de Barra Tienda) */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;
  const lastSeen = {};            // code -> ms del último ingreso aceptado (anti-duplicado)
  const recent = [];              // últimos escaneos de esta sesión
  const device = () => localStorage.getItem('rd_device') || (localStorage.setItem('rd_device', (RD.user?.username || 'staff') + '-' + Math.random().toString(36).slice(2, 5)), localStorage.getItem('rd_device'));

  // ---------- Evaluación universal de cualquier código escaneado ----------
  RD.evaluate = async function (text, scanMode = 'auto') {
    // 1. Si estamos en línea, delegar al servidor autoritativo con SQLite en tiempo real
    if (navigator.onLine) {
      try {
        const res = await RD.api.post('/attendance/scan', { text, scanMode });
        if (res) return res;
      } catch (e) {
        if (!e.offline && e.data) return e.data;
      }
    }

    // 2. Modo fuera de línea (Fallback local con snapshot)
    let snap = RD.snap();
    if (!snap) {
      if (navigator.onLine) { try { snap = await RD.syncMembers(); } catch { } }
      if (!snap) return { level: 'invalid', reason: 'Sin datos. Conéctate a internet una vez para sincronizar.' };
    }
    const p = RD.parsePayload(text);
    if (!p) return { level: 'invalid', reason: 'Código no reconocido.' };

    // Si el operador activó explícitamente el Modo Salida
    if (scanMode === 'out') {
      if (navigator.onLine) {
        try {
          const res = await RD.api.post('/attendance/checkout-code', { code: p.code });
          return {
            level: 'ok',
            is_checkout: true,
            code: p.code,
            name: res.session?.member_name || res.session?.name || 'Socio / Visitante',
            duration_min: res.duration_min,
            reason: `Salida completada (${res.duration_min} min en el gimnasio)`
          };
        } catch (e) {
          return { level: 'warn', code: p.code, reason: e.message || 'No se encontró un ingreso activo para registrar salida hoy.' };
        }
      }
    }

    // 1. CASO: PASE DIARIO (Visitante que paga S/ 5 hoy)
    if (p.type === 'daily' || p.type === 'daily_code') {
      const today = RD.limaDay();
      if (p.day && p.day !== today) {
        return {
          level: 'denied',
          is_daily: true,
          code: p.code,
          name: 'Visitante (Pase anterior)',
          reason: `Pase diario vencido (era válido el ${RD.fmtDate(p.day)}). Debe abonar un nuevo pase diario de S/ 5.`
        };
      }
      let dp = (snap.dailyPasses || []).find(x => x.code === p.code);
      if (navigator.onLine) {
        try {
          const res = await RD.api.post('/daily-passes/scan', { code: p.code });
          dp = res.pass;
        } catch (e) {
          if (e.data?.pass) {
            return { level: 'denied', is_daily: true, code: p.code, name: e.data.pass.name, reason: e.data.reason || 'Pase diario caducado' };
          }
        }
      }

      // Si está en modo automático y ya ingresó hoy hace más de 10 min, registrar salida
      const last = lastSeen[p.code];
      if (scanMode === 'auto' && last && (RD.now() - last >= 10 * 60000) && navigator.onLine) {
        try {
          const res = await RD.api.post('/attendance/checkout-code', { code: p.code });
          if (res && res.ok) {
            delete lastSeen[p.code];
            return {
              level: 'ok',
              is_checkout: true,
              is_daily: true,
              code: p.code,
              name: dp?.name || 'Visitante',
              duration_min: res.duration_min,
              reason: `Salida registrada (${res.duration_min} min en sala)`
            };
          }
        } catch (e) { }
      }

      return {
        level: 'ok',
        is_daily: true,
        code: p.code,
        name: dp?.name || 'Visitante casual',
        reason: 'Pase diario vigente (Acceso hoy)',
        daily: dp
      };
    }

    // 2. CASO: CÓDIGO DE BARRAS DE PRODUCTO DE LA TIENDA (Agua, Energizante, etc.)
    if (p.type === 'barcode') {
      const prods = snap.products || [];
      let prod = prods.find(x => x.barcode === p.code);
      if (!prod && navigator.onLine) {
        try {
          prod = await RD.api.get(`/products/by-barcode/${encodeURIComponent(p.code)}`);
        } catch (e) { }
      }
      if (prod) {
        return { level: 'pos', product: prod };
      }
      return { level: 'invalid', reason: `Código de barras no registrado en tienda: ${p.code}` };
    }

    // 3. CASO: SOCIO REGISTRADO
    let m = RD.findMember(p.code);
    if (!m && navigator.onLine) { try { await RD.syncMembers(); m = RD.findMember(p.code); } catch { } }
    if (!m) return { level: 'invalid', code: p.code, reason: 'Socio no encontrado. Sincroniza los datos.' };
    if (p.sig) {
      const sig = await RD.hmac(m.key, `${p.code}|${p.kind}${p.n}`);
      if (sig !== p.sig) return { level: 'invalid', code: p.code, reason: 'Código falsificado o alterado.' };
      if (p.kind === 'P' && p.n > m.pv && navigator.onLine) { try { await RD.syncMembers(); m = RD.findMember(p.code); } catch { } }
      if (p.kind === 'P' && p.n < m.pv) return { level: 'denied', member: m, code: p.code, kind: p.kind, reason: 'Tarjeta anulada o reemplazada' };
      if (p.kind === 'D') {
        const cur = Math.floor(RD.now() / 60000);
        if (Math.abs(cur - p.n) > 1) return { level: 'denied', member: m, code: p.code, kind: p.kind, reason: 'QR digital caducado. Que actualice o reabra su app.' };
      }
    }

    // En modo auto, si ya ingresó hace más de 10 min, consultar y marcar salida
    const last = Math.max(lastSeen[m.code] || 0, m.last_in ? Date.parse(m.last_in) : 0);
    if (scanMode === 'auto' && last && (RD.now() - last >= 10 * 60000) && navigator.onLine) {
      try {
        const res = await RD.api.post('/attendance/checkout-code', { code: m.code });
        if (res && res.ok) {
          delete lastSeen[m.code];
          return {
            level: 'ok',
            is_checkout: true,
            member: m,
            code: m.code,
            name: m.name,
            duration_min: res.duration_min,
            reason: `Salida completada (${res.duration_min} min entrenando)`
          };
        }
      } catch (e) { }
    }

    return decide(m, p.kind || 'M');
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
    if (r.dup || r.level === 'pos') return;
    const entry = {
      uid: RD.uid(),
      code: r.code || null,
      ts: RD.now(),
      result: r.level,
      reason: r.reason,
      kind: kindOverride || (r.is_daily ? 'D' : r.kind) || null,
      direction: r.is_checkout ? 'out' : 'in',
      duration_min: r.duration_min || null,
      device: device()
    };
    if (r.level === 'invalid' && !r.code) return;
    if (r.level === 'ok' || r.level === 'warn') {
      if (!r.is_checkout) lastSeen[r.code] = entry.ts;
    }
    RD.pushScan(entry);
    recent.unshift({ ...entry, name: r.name || r.member?.name, is_daily: r.is_daily, is_checkout: r.is_checkout });
    recent.length = Math.min(recent.length, 12);
    clearTimeout(record._t); record._t = setTimeout(() => RD.flushScans(), 800);
  }

  // ---------- Pantalla de resultado y acciones ----------
  let overlay = null, hideT = null;
  function showResult(r) {
    clearTimeout(hideT);
    if (overlay) overlay.remove();

    // Si es un producto escaneado, se abre directamente la venta rápida de tienda
    if (r.level === 'pos' && r.product) {
      quickProductSaleModal(r.product);
      return;
    }

    const m = r.member;
    const lvl = r.level;
    const titles = {
      ok: r.is_checkout ? '🚪 SALIDA REGISTRADA' : (r.is_daily ? '✔ ADELANTE (PASE DIARIO)' : '✔ ADELANTE (ENTRADA)'),
      warn: '⚠ PUEDE PASAR',
      denied: r.is_daily ? '✖ PASE DIARIO VENCIDO' : '✖ NO PUEDE PASAR',
      invalid: '? CÓDIGO NO VÁLIDO'
    };
    const head = r.dup ? '✔ YA REGISTRADO' : titles[lvl];
    overlay = document.createElement('div');
    overlay.className = 'result ' + (r.dup ? 'ok' : lvl);

    const displayName = r.name || m?.name || 'Visitante';
    const subTitle = r.is_checkout
      ? `¡Buen entrenamiento! Vuelve pronto (Permanencia: ${r.duration_min || 0} min)`
      : (r.is_daily
        ? (lvl === 'ok' ? `Pase Diario · Válido para hoy (${r.code})` : `Pase Diario Expirado (${r.code})`)
        : (m ? `${esc(m.plan || 'Sin plan')} · vence ${RD.fmtDate(m.end)}` : ''));

    overlay.innerHTML = `
      ${m && m.photo ? `<img class="ph" src="${esc(m.photo)}" alt="">` : `<div class="ph">${r.is_checkout ? '🚪' : r.is_daily ? '🎟️' : esc((displayName)[0] || '?')}</div>`}
      <div class="big">${head}</div>
      <div class="nm">${esc(displayName)}</div>
      ${subTitle ? `<div class="sub">${subTitle}</div>` : ''}
      <div class="sub" style="margin-top:.4rem;font-weight:700">${esc(r.reason)}${r.dup ? ` · ingresó hace ${r.mins} min (no se duplica)` : ''}</div>
      <div class="acts">
        ${!r.is_checkout && (lvl === 'ok' || lvl === 'warn') && r.code ? `<button class="btn warn" data-a="checkout-now">🚪 Marcar como Salida</button>` : ''}
        ${r.is_daily && lvl === 'denied' ? '<button class="btn ok" data-a="new-daily">🎟️ Cobrar nuevo pase (S/ 5)</button>' : ''}
        ${m && (lvl === 'denied' || lvl === 'warn') && m.status === 'active' ? '<button class="btn" data-a="renew">💳 Renovar membresía</button>' : ''}
        ${m ? '<button class="btn" data-a="profile">Ver ficha</button>' : ''}
        <button class="btn" data-a="close">Cerrar</button>
      </div>`;
    document.body.appendChild(overlay);
    RD.beep(r.dup ? 'ok' : lvl === 'invalid' ? 'denied' : lvl);

    // Sincronizar estado en la tablet de mostrador (garantía omnicanal)
    if (r.is_checkout) {
      RD.setCustomerDisplay({
        mode: 'goodbye',
        name: displayName,
        photo: m?.photo || null,
        plan: m?.plan || 'Membresía',
        duration_min: r.duration_min || 0,
        reason: r.reason,
        level: 'ok',
        is_checkout: true
      }).catch(() => {});
    } else if (r.is_daily) {
      if (lvl === 'ok') {
        RD.setCustomerDisplay({
          mode: 'daily_welcome',
          name: displayName,
          code: r.code,
          reason: 'Pase diario activo',
          level: 'ok'
        }).catch(() => {});
      } else {
        RD.setCustomerDisplay({
          mode: 'denied',
          name: displayName,
          code: r.code,
          reason: r.reason,
          level: 'denied',
          is_daily: true
        }).catch(() => {});
      }
    } else if (m) {
      if (lvl === 'ok' || lvl === 'warn') {
        RD.setCustomerDisplay({
          mode: 'welcome',
          name: m.name,
          photo: m.photo,
          plan: m.plan,
          daysLeft: r.daysLeft,
          end: m.end,
          level: lvl,
          reason: r.reason
        }).catch(() => {});
      } else {
        RD.setCustomerDisplay({
          mode: 'denied',
          name: m.name,
          photo: m.photo,
          plan: m.plan || 'Sin plan activo',
          end: m.end,
          level: 'denied',
          reason: r.reason || 'Membresía vencida. Por favor acércate a recepción a renovar tu plan.',
          is_daily: false
        }).catch(() => {});
      }
    } else if (lvl === 'denied' || lvl === 'invalid') {
      RD.setCustomerDisplay({
        mode: 'denied',
        name: displayName,
        reason: r.reason,
        level: lvl
      }).catch(() => {});
    }

    const close = () => {
      clearTimeout(hideT);
      if (overlay) overlay.remove();
      overlay = null;
      RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
    };

    overlay.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'checkout-now') {
        close();
        try {
          const res = await RD.api.post('/attendance/checkout-code', { code: r.code });
          RD.toast(`Salida registrada (${res.duration_min || 0} min) ✔`);
          recent.unshift({ uid: RD.uid(), code: r.code, ts: RD.now(), result: 'ok', name: displayName, is_checkout: true, duration_min: res.duration_min });
          if (window.RD.drawScanRecent) window.RD.drawScanRecent();
        } catch (err) { RD.toast(err.message, 'err'); }
      }
      else if (a === 'new-daily') { close(); dailyPassDialog(); }
      else if (a === 'renew') { close(); RD.renewDialog(m.id, m.name, async () => { await RD.syncMembers().catch(() => { }); }); }
      else if (a === 'profile') { close(); RD.openMember(m.id); }
      else close();
    });
    const ms = r.dup ? 2500 : lvl === 'ok' ? 4000 : lvl === 'warn' ? 4500 : 9000;
    hideT = setTimeout(close, ms);
  }

  // ---------- Modal de Venta Rápida por Código de Barras (Tienda) ----------
  function quickProductSaleModal(prod) {
    RD.beep('tick');
    const d = RD.openModal(`🛒 Venta: ${prod.name}`, `
      <form id="qsf">
        <div class="row between mb">
          <span class="badge ok">Código: ${esc(prod.barcode || '—')}</span>
          <span class="small muted">Stock actual: <b>${prod.stock}</b></span>
        </div>
        <div class="stat gold mb">
          <div class="v" id="qstot">${money(prod.price)}</div>
          <div class="l">Total a cobrar</div>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Cantidad</span>
            <input name="qty" id="qsqty" type="number" min="1" max="${prod.stock}" value="1" required autofocus>
          </label>
          <label class="field"><span>Método de pago *</span>
            <select name="method" id="qsmeth">
              <option value="efectivo">💵 Efectivo</option>
              <option value="yape">🟣 Yape</option>
              <option value="plin">🔵 Plin</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
          </label>
        </div>
        <div class="yape-box hidden mb mt" id="qs_yape">
          <label class="field"><span>N° de Operación Yape/Plin (4-6 dígitos)</span>
            <input name="op_code" id="qsop" placeholder="Ej. 182940" inputmode="numeric">
          </label>
        </div>
        <button class="btn primary block mt" type="submit">Cobrar y Emitir Boleta</button>
      </form>
    `);

    const f = d.el.querySelector('#qsf');
    const qInp = f.querySelector('#qsqty');
    const mSel = f.querySelector('#qsmeth');
    const yBox = d.el.querySelector('#qs_yape');
    const totEl = d.el.querySelector('#qstot');

    const updateTot = () => {
      const q = Math.max(1, +qInp.value || 1);
      totEl.textContent = money(prod.price * q);
    };
    qInp.oninput = updateTot;
    mSel.onchange = () => {
      const isYape = mSel.value === 'yape' || mSel.value === 'plin';
      yBox.classList.toggle('hidden', !isYape);
      if (isYape) setTimeout(() => d.el.querySelector('#qsop')?.focus(), 50);
    };

    f.onsubmit = async e => {
      e.preventDefault();
      try {
        const res = await RD.api.post('/sales', {
          product_id: prod.id,
          qty: +qInp.value,
          method: mSel.value,
          op_code: f.op_code?.value.trim() || null
        });
        d.close();
        RD.beep('done');
        RD.toast('Venta registrada ✔');
        if (res.receipt) RD.receiptModal(res.receipt);
        await RD.syncMembers().catch(() => {});
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  // ---------- Diálogo de Pase Diario (1-clic para visitantes casuales de S/ 5) ----------
  function dailyPassDialog(onDone) {
    const cfg = RD.snap()?.cfg || {};
    const price = cfg.daily_pass_price || 5;

    const d = RD.openModal('🎟️ Pase Diario (Visitante)', `
      <form id="dpf">
        <div class="tip small mb">Acceso válido para el día de hoy. El cliente podrá entrar y salir mostrando su comprobante o el código QR temporal emitido.</div>
        <label class="field"><span>Nombre del visitante *</span>
          <input name="name" value="Visitante casual" required autofocus autocomplete="off">
        </label>
        <div class="grid g2 keep">
          <label class="field"><span>DNI (opcional)</span><input name="dni" inputmode="numeric" placeholder="8 dígitos" autocomplete="off"></label>
          <label class="field"><span>Celular (WhatsApp comprobante)</span><input name="phone" inputmode="tel" placeholder="9XXXXXXXX" autocomplete="off"></label>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Monto (S/) *</span><input name="price" type="number" step="0.5" value="${price}" required></label>
          <label class="field"><span>Método de pago *</span>
            <select name="method" id="dpmeth">
              <option value="efectivo">💵 Efectivo</option>
              <option value="yape">🟣 Yape</option>
              <option value="plin">🔵 Plin</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
          </label>
        </div>
        <div class="row gap wrap mb">
          <button type="button" class="btn small ok" id="dp_btnyape">📱 QR Yape/Plin</button>
          <button type="button" class="btn small info" id="dp_btncard" style="background:#0284c7;color:#fff">💳 Tarjeta POS</button>
        </div>
        <div class="yape-box hidden mb mt" id="dp_yape">
          <label class="field"><span id="dp_oplbl">N° de Operación / Ref *</span>
            <input name="op_code" id="dpop" placeholder="Ej. 492018">
          </label>
        </div>
        <button class="btn ok block mt" type="submit">🎟️ Cobrar S/ <span id="dpbtntot">${price}</span> y Generar Ticket</button>
      </form>
    `);

    const f = d.el.querySelector('#dpf');
    const pInp = f.querySelector('input[name=price]');
    const mSel = f.querySelector('#dpmeth');
    const yBox = d.el.querySelector('#dp_yape');
    const yLbl = d.el.querySelector('#dp_oplbl');
    const opInp = d.el.querySelector('#dpop');
    const bTot = d.el.querySelector('#dpbtntot');

    pInp.oninput = () => bTot.textContent = pInp.value || '0';

    function updatePassMethod(meth) {
      if (meth === 'yape' || meth === 'plin') {
        yBox.classList.remove('hidden');
        yLbl.textContent = 'N° de Operación Yape/Plin (4-6 dígitos) *';
        opInp.placeholder = 'Ej. 492018';
        setTimeout(() => opInp.focus(), 50);
      } else if (meth === 'tarjeta') {
        yBox.classList.remove('hidden');
        yLbl.textContent = 'N° de Referencia / Voucher del POS (Izipay / Niubiz) *';
        opInp.placeholder = 'Ej. Ref #041289';
        setTimeout(() => opInp.focus(), 50);
        const amount = +pInp.value || price;
        RD.setCustomerDisplay({
          mode: 'card',
          method: 'tarjeta',
          title: `Pase Diario: ${f.name.value.trim() || 'Visitante'}`,
          amount: amount
        }).catch(() => {});
      } else {
        yBox.classList.add('hidden');
        RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
      }
    }

    mSel.onchange = () => updatePassMethod(mSel.value);

    d.el.querySelector('#dp_btnyape').onclick = () => {
      const amount = +pInp.value || price;
      RD.yapePaymentModal({
        amount,
        concept: `Pase Diario: ${f.name.value.trim() || 'Visitante'}`,
        onPaid: (op) => {
          if (op) {
            opInp.value = op;
            mSel.value = 'yape';
            updatePassMethod('yape');
            RD.toast('N° de operación cargado ✔');
          }
        }
      });
    };

    d.el.querySelector('#dp_btncard').onclick = () => {
      const amount = +pInp.value || price;
      RD.cardPaymentModal({
        amount,
        concept: `Pase Diario: ${f.name.value.trim() || 'Visitante'}`,
        onPaid: (ref) => {
          if (ref) {
            opInp.value = ref;
            mSel.value = 'tarjeta';
            updatePassMethod('tarjeta');
            RD.toast('Ref. de tarjeta cargada ✔');
          }
        }
      });
    };

    f.onsubmit = async e => {
      e.preventDefault();
      await RD.busy(f.querySelector('button[type=submit]'), async () => {
        try {
          const body = {
            name: f.name.value.trim(),
            dni: f.dni.value.trim() || null,
            phone: f.phone.value.trim() || null,
            price: +f.price.value,
            method: f.method.value,
            op_code: f.op_code?.value.trim() || null
          };
          const res = await RD.api.post('/daily-passes', body);
          d.close();
          RD.beep('ok');
          RD.toast('Pase diario emitido con éxito ✔');
          // Actualizar snapshot local con el nuevo pase
          const snap = RD.snap();
          if (snap) {
            snap.dailyPasses = snap.dailyPasses || [];
            snap.dailyPasses.unshift(res.pass);
            localStorage.setItem('rd_snapshot', JSON.stringify(snap));
          }
          if (res.receipt) RD.receiptModal(res.receipt);
          onDone && onDone();
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      });
    };
  }
  RD.dailyPassDialog = dailyPassDialog;

  // ---------- Vista principal del escáner ----------
  RD.views.scan = {
    async render(view) {
      let scanMode = 'auto'; // 'auto' | 'in' | 'out'

      view.innerHTML = `
      <div class="row between wrap gap mb">
        <div class="chips" id="scan_mode_chips">
          <span class="chip on" data-sm="auto">🔄 Auto (Entrada/Salida)</span>
          <span class="chip" data-sm="in">🟢 Solo Entrada</span>
          <span class="chip" data-sm="out">🚪 Solo Salida</span>
        </div>
        <div class="row gap">
          <button class="btn ok sm" id="dpassbtn">🎟️ Pase Diario (S/ 5)</button>
          <button class="btn sm" id="btn_open_tablet" title="Abrir Pantalla de Cliente / Tablet de Mostrador en 2do Monitor">🖥️ Pantalla Tablet</button>
          <button class="btn sm" id="sync">🔄 Sincronizar</button>
        </div>
      </div>
      <div class="scanbox" id="sbox">
        <video id="vid" playsinline muted></video>
        <div class="frame"></div>
        <div class="tools">
          <button id="torch" title="Linterna" class="hidden">🔦</button>
          <button id="flip" title="Cambiar cámara">🔄</button>
        </div>
        <div class="hint" id="shint">Iniciando cámara…</div>
      </div>
      <div class="row gap mt wrap">
        <button class="btn" id="cam">⏸ Pausar cámara</button>
        <span class="muted small grow">Lector USB / Bluetooth 2D: apunta y escanea QR de socios, pases diarios o productos de tienda.</span>
      </div>
      <div class="card mt">
        <h3>Búsqueda manual</h3>
        <input id="msearch" placeholder="Buscar por Nombre, DNI o Código (ej. RD-0012, RD-DAY-001)" autocomplete="off">
        <div class="list mt2" id="mres"></div>
      </div>
      <div class="card mt">
        <div class="row between">
          <h3>Últimos escaneos</h3>
          <span class="muted small" id="sinfo">…</span>
        </div>
        <div class="list" id="recent"></div>
      </div>`;

      const vid = view.querySelector('#vid');
      let stream = null, running = false, facing = 'environment', detector = null, canvas = null, ctx = null, busy = false, lastRun = 0, lastText = '', lastAt = 0;
      const hint = t => view.querySelector('#shint').textContent = t;

      view.querySelector('#scan_mode_chips')?.addEventListener('click', e => {
        const c = e.target.closest('[data-sm]');
        if (!c) return;
        view.querySelectorAll('#scan_mode_chips .chip').forEach(x => x.classList.toggle('on', x === c));
        scanMode = c.dataset.sm;
        RD.toast(scanMode === 'out' ? 'Modo Salida Activado 🚪' : scanMode === 'in' ? 'Modo Entrada Activado 🟢' : 'Modo Automático Activado 🔄');
      });

      const info = () => {
        const s = RD.snap(); const el = view.querySelector('#sinfo'); if (!el) return;
        el.innerHTML = s ? `Socios: <b>${s.members.length}</b> · Pases hoy: <b>${(s.dailyPasses || []).length}</b> · ${RD.ago(new Date(s.at).toISOString())}${RD.queue().length ? ` · <span class="warn">${RD.queue().length} pendientes</span>` : ''}` : '<span class="bad">Sin datos: pulsa Sincronizar</span>';
      };
      const drawRecent = () => {
        const el = view.querySelector('#recent'); if (!el) return;
        el.innerHTML = recent.map(s => `
          <div class="item">
            <span class="badge ${s.is_checkout ? 'warn' : s.result === 'ok' ? 'ok' : s.result === 'warn' ? 'warn' : 'denied'}">
              ${s.is_checkout ? '🚪 Salida' : s.result === 'ok' ? (s.is_daily ? 'Pase Diario' : 'Entró') : s.result === 'warn' ? 'Aviso' : 'Rechazado'}
            </span>
            <div class="grow">
              <b>${esc(s.name || s.code || '—')}</b>
              <div class="muted tiny">${s.is_checkout ? `Permanencia: ${s.duration_min || 0} min` : esc(s.reason || '')}</div>
            </div>
            <span class="muted small">${RD.fmtTime(new Date(s.ts).toISOString())}</span>
          </div>`).join('') || '<div class="empty">Aún no hay escaneos hoy</div>';
      };
      window.RD.drawScanRecent = drawRecent;
      info(); drawRecent();
      const infoT = setInterval(info, 5000);

      async function onCode(text) {
        const now = Date.now();
        if (text === lastText && now - lastAt < 3000) return;
        lastText = text; lastAt = now;
        let r;
        try { r = await RD.evaluate(text, scanMode); } catch (e) { r = { level: 'invalid', reason: 'Error al validar: ' + e.message }; }
        record(r);
        showResult(r);
        drawRecent();
        info();
      }

      // --- Cámara con auto-detección QR y Código de barras ---
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
        if (!navigator.mediaDevices?.getUserMedia) { hint('Usa un lector USB/Bluetooth o activa la cámara en HTTPS.'); return; }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          vid.srcObject = stream; await vid.play();
          try {
            detector = ('BarcodeDetector' in window)
              ? new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128'] })
              : null;
          } catch { detector = null; }
          const track = stream.getVideoTracks()[0];
          const caps = track.getCapabilities ? track.getCapabilities() : {};
          view.querySelector('#torch').classList.toggle('hidden', !caps.torch);
          running = true; hint('Acerca el QR o código al recuadro'); view.querySelector('#cam').textContent = '⏸ Pausar cámara';
          loop();
        } catch (e) {
          hint(e.name === 'NotAllowedError' ? 'Permiso de cámara denegado.' : 'Cámara lista para lector USB.');
        }
      }
      function stopCam() {
        running = false;
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null; vid.srcObject = null;
        view.querySelector('#cam') && (view.querySelector('#cam').textContent = '▶ Activar cámara');
        hint('Cámara en pausa (Lector USB siempre activo)');
      }

      view.querySelector('#cam').onclick = () => running ? stopCam() : startCam();
      view.querySelector('#flip').onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; stopCam(); startCam(); };
      let torchOn = false;
      view.querySelector('#torch').onclick = async () => { try { torchOn = !torchOn; await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: torchOn }] }); } catch { } };

      view.querySelector('#sync').onclick = async e => RD.busy(e.target, async () => {
        try { await RD.flushScans(); await RD.syncMembers(); RD.toast('Datos sincronizados'); info(); }
        catch (err) { RD.toast(err.offline ? 'Sin internet: usando datos guardados' : err.message, 'warn'); }
      });

      view.querySelector('#dpassbtn').onclick = () => dailyPassDialog(() => { drawRecent(); info(); });
      view.querySelector('#btn_open_tablet')?.addEventListener('click', () => {
        if (typeof RD.openCustomerDisplayWindow === 'function') RD.openCustomerDisplayWindow();
        else window.open('/display.html', 'RD_CustomerDisplay', 'width=1024,height=600,menubar=no,toolbar=no');
      });

      // --- Lector USB / Bluetooth 2D (emulación de teclado física) ---
      let buf = '', bufT = 0;
      const onKey = e => {
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || document.querySelector('.modal-back')) return;
        const now = Date.now();
        if (now - bufT > 130) buf = '';
        bufT = now;
        if (e.key === 'Enter') {
          if (buf.length >= 4) onCode(buf.trim());
          buf = '';
        } else if (e.key.length === 1) {
          buf += e.key;
        }
      };
      document.addEventListener('keydown', onKey);

      // --- Búsqueda manual (Socios y Pases Diarios) ---
      const search = view.querySelector('#msearch'), mres = view.querySelector('#mres');
      search.oninput = RD.debounce(() => {
        const t = search.value.trim().toLowerCase();
        if (t.length < 2) { mres.innerHTML = ''; return; }
        const snap = RD.snap();
        const memList = (snap?.members || []).filter(m => [m.name, m.dni, m.code, m.phone].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 6);
        const passList = (snap?.dailyPasses || []).filter(p => [p.name, p.dni, p.code].some(v => String(v || '').toLowerCase().includes(t))).slice(0, 4);

        const htmlM = memList.map(m => {
          const st = RD.accessState({ status: m.status, frozen: m.frozen, end: m.end }, RD.limaDay(), snap.cfg);
          return `<div class="item click" data-type="m" data-code="${esc(m.code)}">
            <div class="avatar">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc(m.name[0])}</div>
            <div class="grow"><b>${esc(m.name)}</b><div class="muted small">${esc(m.code)} · DNI ${esc(m.dni || '—')} · vence ${RD.fmtDate(m.end)}</div></div>
            <span class="badge ${st.level}">${st.level === 'ok' ? 'Vigente' : st.level === 'warn' ? 'Por vencer' : 'No vigente'}</span>
          </div>`;
        }).join('');

        const htmlP = passList.map(p => `
          <div class="item click" data-type="p" data-code="${esc(p.code)}">
            <div class="avatar">🎟️</div>
            <div class="grow"><b>${esc(p.name)}</b><div class="muted small">Pase Diario: ${esc(p.code)} · DNI ${esc(p.dni || '—')}</div></div>
            <span class="badge daily">Pase Hoy</span>
          </div>
        `).join('');

        mres.innerHTML = (htmlM + htmlP) || '<div class="empty">Sin resultados</div>';
      }, 150);

      mres.onclick = async e => {
        const it = e.target.closest('[data-code]');
        if (!it) return;
        const code = it.dataset.code;
        const type = it.dataset.type;
        if (type === 'm') {
          const m = RD.findMember(code);
          if (m) {
            RD.confirm('Registrar Asistencia', `Socio: <b>${esc(m.name)}</b> (DNI: ${esc(m.dni || '—')}, Código: ${esc(m.code)}).<br>¿Procesar registro de entrada/salida?`, 'Registrar').then(ok => {
              if (!ok) return;
              onCode(m.code);
              search.value = ''; mres.innerHTML = '';
            });
          }
        } else if (type === 'p') {
          onCode(code);
          search.value = ''; mres.innerHTML = '';
        }
      };

      startCam();
      return () => {
        clearInterval(infoT);
        stopCam();
        document.removeEventListener('keydown', onKey);
        if (overlay) { overlay.remove(); overlay = null; }
      };
    }
  };
})();
