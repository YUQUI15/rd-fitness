/* RD Fitness Club - Panel: socios, fichas, altas y renovaciones */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;

  const addMonths = (s, n) => {
    const [y, m, d] = s.split('-').map(Number); const tm = m - 1 + n;
    const ty = y + Math.floor(tm / 12), mm = ((tm % 12) + 12) % 12;
    const last = new Date(Date.UTC(ty, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(ty, mm, Math.min(d, last))).toISOString().slice(0, 10);
  };
  function nextMonday(fromDay) {
    const [y, m, d] = fromDay.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const dayOfWeek = dt.getUTDay();
    const daysUntilMonday = ((8 - dayOfWeek) % 7) || 7;
    return RD.addDays(fromDay, daysUntilMonday);
  }

  RD.previewEnd = (curEnd, plan, explicitStart = null, extraDays = 0) => {
    const today = RD.limaDay();
    let start = explicitStart || (curEnd && curEnd >= today ? RD.addDays(curEnd, 1) : today);
    let end = plan.days && !plan.months ? RD.addDays(start, plan.days - 1) : RD.addDays(addMonths(start, plan.months), -1);
    const extra = Number(extraDays) || 0;
    if (extra > 0) end = RD.addDays(end, extra);
    return { start, end };
  };
  RD.resizeImage = (file, max = 480) => new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => rej(new Error('No se pudo leer la imagen')); img.src = url;
  });
  const badge = m => {
    if (m.status === 'blocked') return '<span class="badge denied">Bloqueado</span>';
    if (m.status === 'inactive') return '<span class="badge">De baja</span>';
    if (m.frozen) return '<span class="badge info">Congelado</span>';
    if (m.scheduled) return '<span class="badge info">📅 ' + esc(m.access_reason) + '</span>';
    if (m.access === 'ok') return '<span class="badge ok">Vigente</span>';
    if (m.access === 'warn') return '<span class="badge warn">' + esc(m.access_reason) + '</span>';
    return '<span class="badge denied">' + (m.end_date ? 'Vencido' : 'Sin plan') + '</span>';
  };
  const avatar = (m, lg) => `<div class="avatar ${lg ? 'lg' : ''}">${m.photo ? `<img src="${esc(m.photo)}" alt="">` : esc((m.name || '?')[0])}</div>`;
  const can = (...roles) => roles.includes(RD.user.role);

  // ---------- Lista de socios ----------
  const FILTERS = [['all', 'Todos'], ['active', 'Activos'], ['scheduled', 'Programados'], ['expiring', 'Por vencer'], ['expired', 'Vencidos'], ['frozen', 'Congelados'], ['blocked', 'Bloqueados/Baja']];
  RD.views.members = {
    async render(view) {
      let filter = 'all', term = '';
      view.innerHTML = `
      <div class="row gap wrap mb">
        <input id="q" class="grow" placeholder="Buscar por nombre, DNI, celular o código" style="min-width:200px">
        ${can('admin', 'recepcion') ? '<button class="btn primary" id="new">＋ Nuevo socio</button>' : ''}
      </div>
      <div class="chips mb" id="chips">${FILTERS.map(([k, l]) => `<span class="chip ${k === 'all' ? 'on' : ''}" data-f="${k}">${l}</span>`).join('')}</div>
      <div class="card"><div class="muted small mb" id="cnt"></div><div class="list" id="list"></div></div>`;
      const list = view.querySelector('#list');
      async function load() {
        const d = await RD.api.get(`/members?filter=${filter}&q=${encodeURIComponent(term)}&limit=200`);
        view.querySelector('#cnt').textContent = `${d.total} socio${d.total === 1 ? '' : 's'}${d.total > 200 ? ' (mostrando 200, usa el buscador)' : ''}`;
        list.innerHTML = d.members.map(m => `<div class="item click" data-id="${m.id}">${avatar(m)}<div class="grow"><b>${esc(m.name)}</b>
          <div class="muted small">${esc(m.code)} · DNI ${esc(m.dni || '—')}${m.plan_name ? ' · ' + esc(m.plan_name) : ''}</div></div>
          <div class="right">${badge(m)}<div class="muted tiny mt2">${m.end_date ? 'vence ' + RD.fmtDate(m.end_date) : ''}</div></div></div>`).join('') || '<div class="empty">No hay socios con ese criterio</div>';
      }
      view.querySelector('#q').oninput = RD.debounce(e => { term = e.target.value.trim(); load().catch(err => RD.toast(err.message, 'err')); }, 250);
      view.querySelector('#chips').onclick = e => {
        const c = e.target.closest('[data-f]'); if (!c) return; filter = c.dataset.f;
        view.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); load();
      };
      list.onclick = e => { const it = e.target.closest('[data-id]'); if (it) RD.openMember(+it.dataset.id, () => load()); };
      const nb = view.querySelector('#new'); if (nb) nb.onclick = () => RD.newMemberDialog(() => load());
      await load();
    }
  };

  // ---------- Alta de socio ----------
  const GOALS = ['Bajar de peso', 'Ganar masa muscular', 'Tonificar', 'Mejorar condición física', 'Salud y bienestar', 'Rendimiento deportivo'];
  RD.newMemberDialog = async function (onDone) {
    const plans = (await RD.getPlans()).filter(p => p.active);
    let photoData = null;
    const today = RD.limaDay();
    let selStart = today;
    let extraDays = 0;
    let promoNote = '';

    const m = RD.openModal('Nuevo socio', `
    <form id="nf">
      <div class="row gap2 mb"><label class="avatar lg" id="pbox" style="cursor:pointer">📷</label><div class="grow muted small">Toca para tomar o elegir una foto. Ayuda a validar la identidad en la puerta.<input id="photo" type="file" accept="image/*" capture="user" class="hidden"></div></div>
      <label class="field"><span>Nombres y apellidos *</span><input name="name" required autocomplete="off"></label>
      <div class="grid g2 keep"><label class="field"><span>DNI *</span><input name="dni" inputmode="numeric" maxlength="12" required autocomplete="off"></label>
      <label class="field"><span>Celular (WhatsApp)</span><input name="phone" inputmode="tel" placeholder="9XXXXXXXX" autocomplete="off"></label></div>
      <div class="grid g2 keep"><label class="field"><span>Fecha de nacimiento</span><input name="birth" type="date"></label>
      <label class="field"><span>Sexo</span><select name="gender"><option value="">—</option><option>Femenino</option><option>Masculino</option></select></label></div>
      <div class="grid g2 keep"><label class="field"><span>Objetivo</span><select name="goal"><option value="">—</option>${GOALS.map(g => `<option>${g}</option>`).join('')}</select></label>
      <label class="field"><span>Nivel</span><select name="level"><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option></select></label></div>
      <label class="field"><span>Contacto de emergencia (nombre y teléfono)</span><input name="emergency"></label>
      <label class="field"><span>Lesiones o condiciones de salud</span><textarea name="health" placeholder="Ninguna / hipertensión / rodilla / etc."></textarea></label>
      <hr style="border-color:var(--line)">
      <h3>Plan y período de membresía</h3>
      <div class="chips mb" id="plans">${plans.map((p, i) => `<span class="chip ${i === 0 ? 'on' : ''}" data-id="${p.id}">${esc(p.name)} · ${money(p.price)}</span>`).join('')}<span class="chip" data-id="">Sin plan (solo registrar)</span></div>
      <div id="paybox">
        <div class="card mb" style="background:var(--bg2);border:1px solid var(--line);padding:12px">
          <div class="small bold muted mb">📅 ¿Cuándo inicia su membresía?</div>
          <div class="chips mb" id="start_chips">
            <span class="chip on" data-s="today">Hoy (${RD.fmtDate(today)})</span>
            <span class="chip" data-s="tomorrow">Mañana</span>
            <span class="chip" data-s="monday">Próx. Lunes</span>
            <span class="chip" data-s="custom">Fecha libre</span>
          </div>
          <input type="date" id="custom_start_in" class="hidden mb" style="max-width:200px" value="${today}">

          <div class="small bold muted mb mt">🎁 Días extra de promoción / inauguración:</div>
          <div class="chips mb" id="promo_chips">
            <span class="chip on" data-d="0">Sin promo (+0d)</span>
            <span class="chip" data-d="7">🎁 +7 días (1 sem gratis)</span>
            <span class="chip" data-d="15">🎁 +15 días</span>
            <span class="chip" data-d="30">🎁 +30 días (+1 mes gratis)</span>
            <span class="chip" data-d="custom">Otro</span>
          </div>
          <div class="grid g2 keep mb hidden" id="custom_promo_box">
            <input type="number" min="0" placeholder="Cant. días extra" id="custom_extra_days" style="max-width:140px">
            <input placeholder="Detalle: Promo inauguración, amigo..." id="custom_promo_note">
          </div>
        </div>

        <div class="grid g2 keep"><label class="field"><span>Monto a cobrar (S/)</span><input name="price" type="number" step="0.5" min="0"></label>
        <label class="field"><span>Método de pago *</span><select name="method" id="nfmeth"><option value="efectivo">💵 Efectivo</option><option value="yape">🟣 Yape</option><option value="plin">🔵 Plin</option><option value="tarjeta">💳 Tarjeta</option><option value="transferencia">🏦 Transferencia</option></select></label></div>
        
        <div class="row gap wrap mb">
          <button type="button" class="btn small ok" id="btnyapeqr">📱 QR Yape/Plin</button>
          <button type="button" class="btn small info" id="btncardpos" style="background:#0284c7;color:#fff">💳 Tarjeta POS</button>
        </div>

        <div class="yape-box hidden mb mt" id="nf_yape">
          <label class="field"><span id="nfop_label">N° de Operación Yape/Plin (4-6 dígitos)</span><input name="op_code" id="nfop" placeholder="Ej. 182940"></label>
        </div>
        <label class="field hidden" id="dn"><span>Motivo del descuento</span><input name="discount_note" placeholder="Promoción de inauguración, convenio…"></label>
        <div class="banner" id="prev"></div>
      </div>
      <label class="check"><input type="checkbox" name="consent" required> <span>El socio autoriza el uso de sus datos personales y de salud para la gestión del gimnasio y declara estar apto para realizar actividad física.</span></label>
      <button class="btn primary block" type="submit">Registrar socio</button>
    </form>`, { wide: true, sticky: true });

    const f = m.el.querySelector('#nf');
    let plan = plans[0] || null;

    const refresh = () => {
      m.el.querySelector('#paybox').classList.toggle('hidden', !plan);
      if (!plan) return;
      f.price.value = plan.price;
      const pv = RD.previewEnd(null, plan, selStart, extraDays);
      const isFuture = selStart > today;
      m.el.querySelector('#prev').innerHTML = `Plan <b>${esc(plan.name)}</b>: ${isFuture ? '📅 <i>(Inicio programado)</i> ' : ''}del <b>${RD.fmtDate(pv.start)}</b> al <b>${RD.fmtDate(pv.end)}</b> ${extraDays > 0 ? `<span class="badge info" style="margin-left:6px">+${extraDays}d promo gratis</span>` : ''}`;
      m.el.querySelector('#dn').classList.add('hidden');
    };
    refresh();

    // Chips de inicio
    const customStartInp = m.el.querySelector('#custom_start_in');
    m.el.querySelector('#start_chips').onclick = e => {
      const c = e.target.closest('[data-s]'); if (!c) return;
      m.el.querySelectorAll('#start_chips .chip').forEach(x => x.classList.toggle('on', x === c));
      const s = c.dataset.s;
      if (s === 'today') { selStart = today; customStartInp.classList.add('hidden'); }
      else if (s === 'tomorrow') { selStart = RD.addDays(today, 1); customStartInp.classList.add('hidden'); }
      else if (s === 'monday') { selStart = nextMonday(today); customStartInp.classList.add('hidden'); }
      else if (s === 'custom') { customStartInp.classList.remove('hidden'); customStartInp.focus(); selStart = customStartInp.value || today; }
      refresh();
    };
    customStartInp.onchange = () => { selStart = customStartInp.value || today; refresh(); };

    // Chips de promo
    const customPromoBox = m.el.querySelector('#custom_promo_box');
    const customExtraInp = m.el.querySelector('#custom_extra_days');
    const customNoteInp = m.el.querySelector('#custom_promo_note');
    m.el.querySelector('#promo_chips').onclick = e => {
      const c = e.target.closest('[data-d]'); if (!c) return;
      m.el.querySelectorAll('#promo_chips .chip').forEach(x => x.classList.toggle('on', x === c));
      const d = c.dataset.d;
      if (d === 'custom') {
        customPromoBox.classList.remove('hidden');
        extraDays = +customExtraInp.value || 0;
        promoNote = customNoteInp.value.trim();
      } else {
        customPromoBox.classList.add('hidden');
        extraDays = +d;
        promoNote = extraDays > 0 ? `Promoción +${extraDays}d gratis` : '';
      }
      refresh();
    };
    customExtraInp.oninput = () => { extraDays = +customExtraInp.value || 0; refresh(); };
    customNoteInp.oninput = () => { promoNote = customNoteInp.value.trim(); };

    function updateMethodFields(meth) {
      const opBox = m.el.querySelector('#nf_yape');
      const opLbl = m.el.querySelector('#nfop_label');
      const opInp = m.el.querySelector('#nfop');
      if (meth === 'yape' || meth === 'plin') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Operación Yape/Plin (4-6 dígitos) *';
        opInp.placeholder = 'Ej. 182940';
        setTimeout(() => opInp.focus(), 50);
      } else if (meth === 'tarjeta') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Referencia / Voucher del POS (Izipay / Niubiz) *';
        opInp.placeholder = 'Ej. Ref #041289';
        setTimeout(() => opInp.focus(), 50);
        const amount = +f.price.value || (plan ? plan.price : 0);
        RD.setCustomerDisplay({
          mode: 'card',
          method: 'tarjeta',
          title: `Membresía ${plan ? plan.name : ''} (${f.name.value.trim() || 'Socio'})`,
          amount: amount
        }).catch(() => {});
      } else if (meth === 'transferencia') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Operación Bancaria *';
        opInp.placeholder = 'Ej. Op #0049182';
        setTimeout(() => opInp.focus(), 50);
      } else {
        opBox.classList.add('hidden');
        RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
      }
    }

    // Cobro Yape con QR dinámico
    m.el.querySelector('#btnyapeqr').onclick = () => {
      if (!plan) return RD.toast('Selecciona un plan primero', 'warn');
      const amount = +f.price.value || plan.price;
      RD.yapePaymentModal({
        amount,
        concept: `Membresía ${plan.name} (${f.name.value.trim() || 'Nuevo socio'})`,
        onPaid: (op) => {
          if (op) {
            f.op_code.value = op;
            f.method.value = 'yape';
            updateMethodFields('yape');
            RD.toast('N° de operación cargado ✔');
          }
        }
      });
    };

    // Cobro Tarjeta POS
    m.el.querySelector('#btncardpos').onclick = () => {
      if (!plan) return RD.toast('Selecciona un plan primero', 'warn');
      const amount = +f.price.value || plan.price;
      RD.cardPaymentModal({
        amount,
        concept: `Membresía ${plan.name} (${f.name.value.trim() || 'Nuevo socio'})`,
        onPaid: (ref) => {
          if (ref) {
            f.op_code.value = ref;
            f.method.value = 'tarjeta';
            updateMethodFields('tarjeta');
            RD.toast('Ref. de tarjeta cargada ✔');
          }
        }
      });
    };

    m.el.querySelector('#plans').onclick = e => {
      const c = e.target.closest('[data-id]'); if (!c) return;
      m.el.querySelectorAll('#plans .chip').forEach(x => x.classList.toggle('on', x === c));
      plan = plans.find(p => String(p.id) === c.dataset.id) || null; refresh();
    };
    f.price.oninput = () => { if (plan) m.el.querySelector('#dn').classList.toggle('hidden', +f.price.value >= plan.price); };
    m.el.querySelector('#nfmeth').onchange = e => {
      updateMethodFields(e.target.value);
    };
    m.el.querySelector('#pbox').onclick = () => m.el.querySelector('#photo').click();
    m.el.querySelector('#photo').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try { photoData = await RD.resizeImage(file); m.el.querySelector('#pbox').innerHTML = `<img src="${photoData}" alt="">`; } catch (err) { RD.toast(err.message, 'err'); }
    };
    f.onsubmit = async e => {
      e.preventDefault();
      await RD.busy(f.querySelector('button[type=submit]'), async () => {
        try {
          const body = Object.fromEntries(new FormData(f).entries());
          body.consent = f.consent.checked; body.plan_id = plan ? plan.id : null;
          if (plan) {
            body.start_date = selStart;
            body.extra_days = extraDays;
            body.promo_note = promoNote || null;
          } else {
            delete body.price; delete body.method; delete body.op_code;
          }
          const r = await RD.api.post('/members', body);
          if (photoData) { try { await RD.api.post(`/members/${r.member.id}/photo`, { data: photoData }); r.member.photo = (await RD.api.get('/members/' + r.member.id)).member.photo; } catch { RD.toast('Socio creado, pero la foto no se pudo subir', 'warn'); } }
          m.close(); RD.syncMembers().catch(() => { });
          onDone && onDone();
          successDialog(r);
        } catch (err) {
          if (err.status === 409 && err.data?.existing) { RD.toast(err.message, 'err', 5000); } else RD.toast(err.message, 'err', 5000);
        }
      });
    };
  };
  function successDialog(r) {
    const mem = r.member;
    const msg = `¡Bienvenido a ${RD.pub.gym_name || 'RD Fitness Club'}! 💪 Tu código de socio es ${mem.code}. Abre ${location.origin} e ingresa con tu código y tu DNI para ver tu QR de acceso, tus rutinas y tu progreso.`;
    const wa = RD.waLink(mem.phone, msg);
    const d = RD.openModal('✅ Socio registrado', `
      <div class="center"><div class="row" style="justify-content:center;margin-bottom:8px">${avatar(mem, true)}</div>
      <h2>${esc(mem.name)}</h2><div class="gold" style="font-size:1.6rem;font-weight:800">${esc(mem.code)}</div>
      ${r.membership ? `<p>Membresía vigente hasta <b>${RD.fmtDate(r.membership.end)}</b></p>` : '<p class="muted">Sin membresía activa todavía.</p>'}</div>
      <div class="grid mt">
        ${r.receipt ? `<button class="btn ok" id="rcptbtn">🧾 Ver e Imprimir Boleta</button>` : ''}
        <a class="btn primary" target="_blank" href="/admin/cards.html?ids=${mem.id}">🖨 Imprimir tarjeta QR</a>
        ${wa ? `<a class="btn ok" target="_blank" rel="noopener" href="${wa}">📲 Enviar acceso por WhatsApp</a>` : ''}
        <button class="btn" id="prof">Ver ficha</button>
      </div>`);
    if (r.receipt) {
      d.el.querySelector('#rcptbtn').onclick = () => RD.receiptModal(r.receipt);
    }
    d.el.querySelector('#prof').onclick = () => { d.close(); RD.openMember(mem.id); };
  }

  // ---------- Renovación ----------
  RD.renewDialog = async function (memberId, name, onDone) {
    const [plans, det] = await Promise.all([RD.getPlans(), RD.api.get('/members/' + memberId)]);
    const act = plans.filter(p => p.active);
    let plan = act.find(p => p.months === 1) || act[0];
    const curEnd = det.member.end_date;
    const today = RD.limaDay();
    let selStart = (curEnd && curEnd >= today) ? RD.addDays(curEnd, 1) : today;
    let extraDays = 0;
    let promoNote = '';

    const m = RD.openModal('Renovar membresía', `
      <p><b>${esc(name)}</b> ${curEnd ? `<span class="muted">· vence ${RD.fmtDate(curEnd)}</span>` : ''}</p>
      <div class="chips mb" id="plans">${act.map(p => `<span class="chip ${p === plan ? 'on' : ''}" data-id="${p.id}">${esc(p.name)} · ${money(p.price)}</span>`).join('')}</div>
      <form id="rf">
        <div class="card mb" style="background:var(--bg2);border:1px solid var(--line);padding:12px">
          <div class="small bold muted mb">📅 Fecha de inicio de la renovación:</div>
          <div class="chips mb" id="r_start_chips">
            <span class="chip on" data-s="auto">${curEnd && curEnd >= today ? 'Al vencer actual (' + RD.fmtDate(curEnd) + ')' : 'Hoy (' + RD.fmtDate(today) + ')'}</span>
            <span class="chip" data-s="today">Hoy</span>
            <span class="chip" data-s="tomorrow">Mañana</span>
            <span class="chip" data-s="monday">Próx. Lunes</span>
            <span class="chip" data-s="custom">Fecha libre</span>
          </div>
          <input type="date" id="r_custom_start_in" class="hidden mb" style="max-width:200px" value="${selStart}">

          <div class="small bold muted mb mt">🎁 Días extra de promoción:</div>
          <div class="chips mb" id="r_promo_chips">
            <span class="chip on" data-d="0">Sin promo (+0d)</span>
            <span class="chip" data-d="7">🎁 +7 días (1 sem)</span>
            <span class="chip" data-d="15">🎁 +15 días</span>
            <span class="chip" data-d="30">🎁 +30 días (+1 mes)</span>
            <span class="chip" data-d="custom">Otro</span>
          </div>
          <div class="grid g2 keep mb hidden" id="r_custom_promo_box">
            <input type="number" min="0" placeholder="Cant. días extra" id="r_custom_extra_days" style="max-width:140px">
            <input placeholder="Detalle: Fidelidad, promo..." id="r_custom_promo_note">
          </div>
        </div>

        <div class="grid g2 keep"><label class="field"><span>Monto (S/)</span><input name="price" type="number" step="0.5" min="0" required></label>
        <label class="field"><span>Método de pago</span><select name="method" id="rfmeth"><option value="efectivo">💵 Efectivo</option><option value="yape">🟣 Yape</option><option value="plin">🔵 Plin</option><option value="tarjeta">💳 Tarjeta</option><option value="transferencia">🏦 Transferencia</option></select></label></div>
        
        <div class="row gap wrap mb">
          <button type="button" class="btn small ok" id="r_btnyapeqr">📱 QR Yape/Plin</button>
          <button type="button" class="btn small info" id="r_btncardpos" style="background:#0284c7;color:#fff">💳 Tarjeta POS</button>
        </div>

        <div class="yape-box hidden mb mt" id="rf_yape">
          <label class="field"><span id="rfop_label">N° de Operación Yape/Plin (4-6 dígitos)</span><input name="op_code" id="rfop" placeholder="Ej. 182940"></label>
        </div>
        <label class="field hidden" id="dn"><span>Motivo del descuento</span><input name="discount_note"></label>
        <div class="banner" id="prev"></div>
        <button class="btn primary block">Cobrar y renovar</button>
      </form>`);

    const f = m.el.querySelector('#rf');
    const refresh = () => {
      f.price.value = plan.price;
      const pv = RD.previewEnd(null, plan, selStart, extraDays);
      m.el.querySelector('#prev').innerHTML = `Nuevo período: <b>${RD.fmtDate(pv.start)}</b> → <b>${RD.fmtDate(pv.end)}</b> ${extraDays > 0 ? `<span class="badge info" style="margin-left:6px">+${extraDays}d de promo</span>` : ''}`;
      m.el.querySelector('#dn').classList.add('hidden');
    };
    refresh();

    // Chips de inicio
    const customStartInp = m.el.querySelector('#r_custom_start_in');
    m.el.querySelector('#r_start_chips').onclick = e => {
      const c = e.target.closest('[data-s]'); if (!c) return;
      m.el.querySelectorAll('#r_start_chips .chip').forEach(x => x.classList.toggle('on', x === c));
      const s = c.dataset.s;
      if (s === 'auto') { selStart = (curEnd && curEnd >= today) ? RD.addDays(curEnd, 1) : today; customStartInp.classList.add('hidden'); }
      else if (s === 'today') { selStart = today; customStartInp.classList.add('hidden'); }
      else if (s === 'tomorrow') { selStart = RD.addDays(today, 1); customStartInp.classList.add('hidden'); }
      else if (s === 'monday') { selStart = nextMonday(today); customStartInp.classList.add('hidden'); }
      else if (s === 'custom') { customStartInp.classList.remove('hidden'); customStartInp.focus(); selStart = customStartInp.value || today; }
      refresh();
    };
    customStartInp.onchange = () => { selStart = customStartInp.value || today; refresh(); };

    // Chips promo
    const customPromoBox = m.el.querySelector('#r_custom_promo_box');
    const customExtraInp = m.el.querySelector('#r_custom_extra_days');
    const customNoteInp = m.el.querySelector('#r_custom_promo_note');
    m.el.querySelector('#r_promo_chips').onclick = e => {
      const c = e.target.closest('[data-d]'); if (!c) return;
      m.el.querySelectorAll('#r_promo_chips .chip').forEach(x => x.classList.toggle('on', x === c));
      const d = c.dataset.d;
      if (d === 'custom') {
        customPromoBox.classList.remove('hidden');
        extraDays = +customExtraInp.value || 0;
        promoNote = customNoteInp.value.trim();
      } else {
        customPromoBox.classList.add('hidden');
        extraDays = +d;
        promoNote = extraDays > 0 ? `Promoción +${extraDays}d extra` : '';
      }
      refresh();
    };
    customExtraInp.oninput = () => { extraDays = +customExtraInp.value || 0; refresh(); };
    customNoteInp.oninput = () => { promoNote = customNoteInp.value.trim(); };

    function updateRenewMethodFields(meth) {
      const opBox = m.el.querySelector('#rf_yape');
      const opLbl = m.el.querySelector('#rfop_label');
      const opInp = m.el.querySelector('#rfop');
      if (meth === 'yape' || meth === 'plin') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Operación Yape/Plin (4-6 dígitos) *';
        opInp.placeholder = 'Ej. 182940';
        setTimeout(() => opInp.focus(), 50);
      } else if (meth === 'tarjeta') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Referencia / Voucher del POS (Izipay / Niubiz) *';
        opInp.placeholder = 'Ej. Ref #041289';
        setTimeout(() => opInp.focus(), 50);
        const amount = +f.price.value || plan.price;
        RD.setCustomerDisplay({
          mode: 'card',
          method: 'tarjeta',
          title: `Renovación ${plan ? plan.name : ''} (${name})`,
          amount: amount
        }).catch(() => {});
      } else if (meth === 'transferencia') {
        opBox.classList.remove('hidden');
        opLbl.textContent = 'N° de Operación Bancaria *';
        opInp.placeholder = 'Ej. Op #0049182';
        setTimeout(() => opInp.focus(), 50);
      } else {
        opBox.classList.add('hidden');
        RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
      }
    }

    // Yape modal
    m.el.querySelector('#r_btnyapeqr').onclick = () => {
      const amount = +f.price.value || plan.price;
      RD.yapePaymentModal({
        amount,
        concept: `Renovación ${plan.name} (${name})`,
        onPaid: (op) => {
          if (op) {
            f.op_code.value = op;
            f.method.value = 'yape';
            updateRenewMethodFields('yape');
            RD.toast('N° de operación cargado ✔');
          }
        }
      });
    };

    // Tarjeta modal
    m.el.querySelector('#r_btncardpos').onclick = () => {
      const amount = +f.price.value || plan.price;
      RD.cardPaymentModal({
        amount,
        concept: `Renovación ${plan.name} (${name})`,
        onPaid: (ref) => {
          if (ref) {
            f.op_code.value = ref;
            f.method.value = 'tarjeta';
            updateRenewMethodFields('tarjeta');
            RD.toast('Ref. de tarjeta cargada ✔');
          }
        }
      });
    };

    m.el.querySelector('#plans').onclick = e => {
      const c = e.target.closest('[data-id]'); if (!c) return;
      m.el.querySelectorAll('#plans .chip').forEach(x => x.classList.toggle('on', x === c));
      plan = act.find(p => String(p.id) === c.dataset.id); refresh();
    };
    f.price.oninput = () => m.el.querySelector('#dn').classList.toggle('hidden', +f.price.value >= plan.price);
    m.el.querySelector('#rfmeth').onchange = e => {
      updateRenewMethodFields(e.target.value);
    };
    f.onsubmit = async e => {
      e.preventDefault();
      await RD.busy(f.querySelector('button'), async () => {
        try {
          const r = await RD.api.post(`/members/${memberId}/renew`, {
            plan_id: plan.id,
            price: +f.price.value,
            method: f.method.value,
            discount_note: f.discount_note.value,
            op_code: f.op_code?.value.trim() || null,
            start_date: selStart,
            extra_days: extraDays,
            promo_note: promoNote || null
          });
          m.close(); RD.beep('done'); RD.toast(`Renovado hasta ${RD.fmtDate(r.end)} ✔`);
          await RD.syncMembers().catch(() => { });
          if (r.receipt) RD.receiptModal(r.receipt);
          onDone && onDone(r);
        } catch (err) { RD.toast(err.message, 'err', 5000); }
      });
    };
  };

  // ---------- Ficha del socio ----------
  RD.openMember = async function (id, onChange) {
    let modal = null;
    async function draw() {
      const d = await RD.api.get('/members/' + id);
      const m = d.member;
      const html = `
      <div class="row gap2 mb">${avatar(m, true)}<div class="grow"><h2 style="margin-bottom:.1rem">${esc(m.name)}</h2>
        <div class="gold" style="font-weight:800">${esc(m.code)}</div><div class="mt2">${badge(m)}</div></div></div>
      <div class="statusbar ${m.access}">${esc(m.access_reason)}${m.end_date ? ` · vence ${RD.fmtDate(m.end_date)}` : ''}${m.plan_name ? ` · ${esc(m.plan_name)}` : ''}</div>
      <div class="grid g2 keep mt">
        <div class="stat"><div class="v">${d.attendance_30}</div><div class="l">Visitas últimos 30 días</div></div>
        <div class="stat"><div class="v">${d.attendance[0] ? RD.ago(d.attendance.find(a => a.result === 'ok' || a.result === 'warn')?.ts) : 'nunca'}</div><div class="l">Última visita</div></div>
      </div>
      <div class="row gap wrap mt" id="acts">
        ${can('admin', 'recepcion') && m.status !== 'inactive' ? `<button class="btn primary sm" data-a="renew">${RD.icon('card')} Renovar</button>` : ''}
        ${can('admin', 'recepcion') ? `<a class="btn sm" target="_blank" href="/admin/cards.html?ids=${m.id}">${RD.icon('printer')} Tarjeta QR</a>` : ''}
        <button class="btn sm ghost" data-a="att-sheet">${RD.icon('reports')} Ficha Asistencias</button>
        ${RD.waLink(m.phone, '') ? `<a class="btn sm ok" target="_blank" rel="noopener" href="${RD.waLink(m.phone, 'Hola ' + m.name.split(' ')[0] + ', te escribimos de ' + (RD.pub.gym_name || 'RD Fitness Club') + '. ')}">${RD.icon('whatsapp')} WhatsApp</a>` : ''}
        ${can('admin', 'recepcion', 'entrenador') ? `<button class="btn sm" data-a="edit">${RD.icon('edit')} Editar</button>` : ''}
        ${can('admin', 'recepcion', 'entrenador') ? `<button class="btn sm" data-a="routine">${RD.icon('dumbbell')} Asignar rutina</button>` : ''}
        ${can('admin', 'recepcion') ? `<button class="btn sm" data-a="checkin">${RD.icon('check')} Ingreso manual</button>` : ''}
        ${can('admin', 'recepcion') ? `<button class="btn sm" data-a="freeze">${m.frozen ? RD.icon('refresh') + ' Reanudar membresía' : RD.icon('snowflake') + ' Congelar'}</button>` : ''}
        ${can('admin', 'recepcion') ? `<button class="btn sm" data-a="reissue">${RD.icon('refresh')} Reemitir tarjeta</button>` : ''}
        ${can('admin', 'recepcion') ? `<button class="btn sm ghost" data-a="reset-cred" title="Restablece la clave a su DNI">${RD.icon('key')} Restablecer acceso</button>` : ''}
        ${can('admin', 'recepcion') ? `<button class="btn sm danger" data-a="${m.status === 'blocked' ? 'unblock' : 'block'}">${m.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</button>` : ''}
        ${can('admin') ? `<button class="btn sm ghost" data-a="${m.status === 'inactive' ? 'reactivate' : 'inactive'}">${m.status === 'inactive' ? 'Reactivar' : 'Dar de baja'}</button>` : ''}
      </div>
      <h3 class="mt">Datos</h3>
      <div class="small">
        <div>📱 ${esc(m.phone || '—')} · ✉️ ${esc(m.email || '—')}</div>
        <div>🪪 DNI ${esc(m.dni || '—')} · 🎂 ${RD.fmtDate(m.birth)} · ${esc(m.gender || '')}</div>
        <div>🎯 ${esc(m.goal || '—')} · Nivel: ${esc(m.level || '—')}</div>
        <div>🚑 ${esc(m.emergency || '—')}</div>
        <div>🩺 ${esc(m.health || 'Sin observaciones')}</div>
        ${m.block_reason ? `<div class="bad">Motivo de bloqueo/baja: ${esc(m.block_reason)}</div>` : ''}
        <div class="muted">Socio desde ${RD.fmtDate(m.created_at)}</div>
      </div>
      <h3 class="mt">Rutinas asignadas</h3>
      <div class="list">${d.routines.map(r => `<div class="item"><div class="grow"><b>${esc(r.name)}</b><div class="muted tiny">desde ${RD.fmtDate(r.assigned_at)}</div></div>${can('admin', 'entrenador') ? `<button class="btn sm ghost" data-unassign="${r.assignment_id}">Quitar</button>` : ''}</div>`).join('') || '<div class="muted small">Sin rutina asignada</div>'}</div>
      ${can('admin', 'recepcion') ? `<h3 class="mt">Pagos</h3>
      <div class="tbl-wrap"><table><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Método</th><th>Boleta</th></tr>${d.payments.map(p => `<tr style="${p.voided ? 'opacity:.4;text-decoration:line-through' : ''}"><td>${RD.fmtDate(p.day)}</td><td>${esc(p.concept)}</td><td>${money(p.amount)}</td><td>${esc(p.method)}${p.op_code ? ` <span class="tiny" style="color:#c084fc">#${esc(p.op_code)}</span>` : ''}</td><td><button class="icon-btn" data-rcpt="${p.id}" title="Ver e imprimir boleta">🧾</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Sin pagos</td></tr>'}</table></div>` : ''}
      <h3 class="mt">Membresías</h3>
      <div class="tbl-wrap"><table><tr><th>Plan</th><th>Desde</th><th>Hasta</th><th>Precio</th></tr>${d.memberships.map(s => `<tr style="${s.status !== 'active' ? 'opacity:.4' : ''}"><td>${esc(s.plan_name)}</td><td>${RD.fmtDate(s.start_date)}</td><td>${RD.fmtDate(s.end_date)}</td><td>${money(s.price)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">—</td></tr>'}</table></div>
      <h3 class="mt">Medidas y progreso</h3>
      <form class="grid g4" id="mf" style="align-items:end">
        <label class="field"><span>Peso kg</span><input name="weight" type="number" step="0.1"></label>
        <label class="field"><span>Cintura cm</span><input name="waist" type="number" step="0.1"></label>
        <label class="field"><span>Pecho cm</span><input name="chest" type="number" step="0.1"></label>
        <button class="btn sm" style="margin-bottom:.8rem">Guardar</button></form>
      <div class="tbl-wrap"><table><tr><th>Fecha</th><th>Peso</th><th>Cintura</th><th>Pecho</th></tr>${d.measurements.map(x => `<tr><td>${RD.fmtDate(x.day)}</td><td>${x.weight ?? '—'}</td><td>${x.waist ?? '—'}</td><td>${x.chest ?? '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin medidas</td></tr>'}</table></div>
      <h3 class="mt">Asistencia reciente</h3>
      <div class="list small">${d.attendance.slice(0, 12).map(a => `<div class="item"><span class="badge ${a.result === 'ok' ? 'ok' : a.result === 'warn' ? 'warn' : 'denied'}">${a.result === 'ok' || a.result === 'warn' ? 'Entró' : 'Rechazado'}</span><div class="grow">${RD.fmtDateTime(a.ts)}<div class="muted tiny">${esc(a.reason || '')}${a.kind === 'M' ? ' · manual' : ''}</div></div></div>`).join('') || '<div class="muted">Sin asistencias</div>'}</div>`;
      if (!modal) modal = RD.openModal('Ficha del socio', html, { wide: true, onClose: () => onChange && onChange() });
      else modal.el.innerHTML = html;
      wire(m);
    }
    function wire(m) {
      const el = modal.el, redraw = () => draw().catch(e => RD.toast(e.message, 'err'));
      el.addEventListener('click', async e => {
        const rc = e.target.closest('[data-rcpt]');
        if (rc) {
          try {
            const r = await RD.api.get(`/payments/${rc.dataset.rcpt}/receipt`);
            RD.receiptModal(r);
          } catch (err) { RD.toast(err.message, 'err'); }
        }
      });
      el.querySelector('#acts').onclick = async e => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        try {
          if (a === 'renew') RD.renewDialog(id, m.name, redraw);
          else if (a === 'att-sheet') { if (RD.memberAttendanceSheetModal) RD.memberAttendanceSheetModal(id); return; }
          else if (a === 'edit') editDialog(m, redraw);
          else if (a === 'routine') assignRoutineDialog(id, redraw);
          else if (a === 'checkin') {
            if (await RD.confirm('Ingreso manual', `¿Registrar ingreso de ${m.name} sin QR?`, 'Registrar')) {
              const r = await RD.api.post(`/members/${id}/checkin`); RD.toast(r.access === 'denied' ? '❌ ' + r.reason : '✔ Ingreso registrado: ' + r.reason, r.access === 'denied' ? 'err' : 'ok'); redraw();
            }
          } else if (a === 'freeze') {
            if (await RD.confirm(m.frozen ? 'Reanudar' : 'Congelar', m.frozen ? 'Se reanudará la membresía y se sumarán a su vencimiento los días que estuvo congelada.' : 'Mientras esté congelada no podrá ingresar. Al reanudar se extiende su vencimiento por los días congelados.', 'Aceptar')) {
              const r = await RD.api.post(`/members/${id}/freeze`, { action: m.frozen ? 'end' : 'start' });
              RD.toast(m.frozen ? `Reanudada: +${r.days_added} días` : 'Membresía congelada'); await RD.syncMembers().catch(() => { }); redraw();
            }
          } else if (a === 'reissue') {
            if (await RD.confirm('Reemitir tarjeta', 'La tarjeta física anterior dejará de funcionar. Luego imprime la nueva. El QR digital de la app no cambia.', 'Anular y reemitir', true)) {
              await RD.api.post(`/members/${id}/reissue-card`); await RD.syncMembers().catch(() => { });
              RD.toast('Tarjeta anterior anulada'); window.open('/admin/cards.html?ids=' + id, '_blank'); redraw();
            }
          } else if (a === 'reset-cred') {
            if (await RD.confirm(
              'Restablecer acceso',
              `¿Deseas restablecer la contraseña de ${m.name}? La clave volverá a ser su DNI (${m.dni || 'sin DNI'}), conservando su alias y código de socio.`,
              'Restablecer'
            )) {
              const res = await RD.api.post(`/members/${id}/reset-credentials`);
              RD.toast(res.msg || 'Acceso restablecido ✔');
            }
          } else if (a === 'block' || a === 'inactive') {
            const reason = await RD.prompt(a === 'block' ? 'Bloquear socio' : 'Dar de baja', 'Motivo', 'Ej. conducta, deuda, retiro voluntario');
            if (reason) { await RD.api.post(`/members/${id}/status`, { status: a === 'block' ? 'blocked' : 'inactive', reason }); await RD.syncMembers().catch(() => { }); redraw(); }
          } else if (a === 'unblock' || a === 'reactivate') {
            await RD.api.post(`/members/${id}/status`, { status: 'active' }); await RD.syncMembers().catch(() => { }); redraw();
          }
        } catch (err) { RD.toast(err.message, 'err', 5000); }
      };
      el.querySelectorAll('[data-unassign]').forEach(b => b.onclick = async () => { await RD.api.del('/assignments/' + b.dataset.unassign); redraw(); });
      el.querySelector('#mf').onsubmit = async e => {
        e.preventDefault(); const f = e.target;
        if (!f.weight.value && !f.waist.value && !f.chest.value) return RD.toast('Ingresa al menos un dato', 'warn');
        try { await RD.api.post(`/members/${id}/measurements`, { weight: f.weight.value || null, waist: f.waist.value || null, chest: f.chest.value || null }); RD.toast('Medidas guardadas'); redraw(); } catch (err) { RD.toast(err.message, 'err'); }
      };
    }
    try { await draw(); } catch (e) { RD.toast(e.message, 'err'); }
  };

  function editDialog(m, done) {
    const full = m;
    const d = RD.openModal('Editar socio', `<form id="ef">
      <div class="row gap2 mb"><label class="avatar lg" id="pbox" style="cursor:pointer">${full.photo ? `<img src="${esc(full.photo)}" alt="">` : '📷'}</label><div class="grow muted small">Cambiar foto<input id="photo" type="file" accept="image/*" capture="user" class="hidden"></div></div>
      <label class="field"><span>Nombre</span><input name="name" value="${esc(full.name)}" required ${can('entrenador') ? 'disabled' : ''}></label>
      <div class="grid g2 keep"><label class="field"><span>DNI</span><input name="dni" value="${esc(full.dni || '')}" ${can('entrenador') ? 'disabled' : ''}></label>
      <label class="field"><span>Celular</span><input name="phone" value="${esc(full.phone || '')}" ${can('entrenador') ? 'disabled' : ''}></label></div>
      <div class="grid g2 keep"><label class="field"><span>Nacimiento</span><input name="birth" type="date" value="${esc(full.birth || '')}" ${can('entrenador') ? 'disabled' : ''}></label>
      <label class="field"><span>Nivel</span><select name="level">${['principiante', 'intermedio', 'avanzado'].map(l => `<option ${l === full.level ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
      <label class="field"><span>Objetivo</span><input name="goal" value="${esc(full.goal || '')}"></label>
      <label class="field"><span>Emergencia</span><input name="emergency" value="${esc(full.emergency || '')}" ${can('entrenador') ? 'disabled' : ''}></label>
      <label class="field"><span>Salud / lesiones</span><textarea name="health">${esc(full.health || '')}</textarea></label>
      <button class="btn primary block">Guardar cambios</button></form>`);
    const f = d.el.querySelector('#ef'); let photo = null;
    d.el.querySelector('#pbox').onclick = () => d.el.querySelector('#photo').click();
    d.el.querySelector('#photo').onchange = async e => { const file = e.target.files[0]; if (!file) return; photo = await RD.resizeImage(file); d.el.querySelector('#pbox').innerHTML = `<img src="${photo}" alt="">`; };
    f.onsubmit = async e => {
      e.preventDefault();
      await RD.busy(f.querySelector('button'), async () => {
        try {
          const body = {}; for (const [k, v] of new FormData(f).entries()) body[k] = v;
          await RD.api.put('/members/' + full.id, body);
          if (photo && can('admin', 'recepcion')) await RD.api.post(`/members/${full.id}/photo`, { data: photo });
          d.close(); RD.toast('Datos guardados'); RD.syncMembers().catch(() => { }); done();
        } catch (err) { RD.toast(err.message, 'err'); }
      });
    };
  }

  async function assignRoutineDialog(memberId, done) {
    const routines = await RD.api.get('/routines');
    const d = RD.openModal('Asignar rutina', `<p class="muted small">La rutina aparecerá en la app del socio. Reemplaza la anterior asignada.</p>
      <div class="list">${routines.map(r => `<div class="item click" data-id="${r.id}"><div class="grow"><b>${esc(r.name)}</b><div class="muted small">${esc(r.goal || '')} · ${r.days} día(s) · ${esc(r.level || '')}</div></div><button class="btn sm primary">Asignar</button></div>`).join('')}</div>`);
    d.el.onclick = async e => {
      const it = e.target.closest('[data-id]'); if (!it) return;
      try { await RD.api.post(`/routines/${it.dataset.id}/assign`, { member_ids: [memberId], replace: true }); RD.toast('Rutina asignada ✔'); d.close(); done(); } catch (err) { RD.toast(err.message, 'err'); }
    };
  }
})();
