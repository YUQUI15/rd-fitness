/* RD Fitness Club - Panel: Rutinas, Caja, Reportes y Ajustes */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;
  const can = (...roles) => roles.includes(RD.user.role);

  // ============================================================
  // 1. RUTINAS Y ENTRENAMIENTO (ADMIN / RECEPCIÓN / ENTRENADOR)
  // ============================================================
  RD.views.routines = {
    async render(view) {
      let exList = [];
      try { exList = await RD.api.get('/exercises'); } catch (e) { }

      view.innerHTML = `
      <div class="row between wrap gap mb">
        <div class="chips" id="tabs">
          <span class="chip on" data-t="routines">🏋️ Rutinas (${can('admin', 'entrenador') ? 'Gestión' : 'Ver'})</span>
          <span class="chip" data-t="exercises">📖 Ejercicios (${exList.length})</span>
          <span class="chip" data-t="timers">⏱ Cronómetros Gym</span>
        </div>
        ${can('admin', 'entrenador') ? '<button class="btn primary sm" id="newr">＋ Crear Rutina</button>' : ''}
      </div>
      <div id="subview"></div>`;

      const subview = view.querySelector('#subview');

      async function showTab(tab) {
        view.querySelectorAll('#tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.t === tab));
        const newBtn = view.querySelector('#newr');
        if (newBtn) newBtn.classList.toggle('hidden', tab !== 'routines');

        if (tab === 'routines') await renderRoutinesList(subview);
        else if (tab === 'exercises') {
          subview.innerHTML = `<div class="card">${can('admin', 'entrenador') ? '<div class="row end mb"><button class="btn sm" id="addex">＋ Agregar ejercicio personalizado</button></div>' : ''}<div id="exlib"></div></div>`;
          RD.exerciseLibrary(subview.querySelector('#exlib'), exList);
          const addBtn = subview.querySelector('#addex');
          if (addBtn) addBtn.onclick = () => addCustomExerciseDialog(() => showTab('exercises'));
        } else if (tab === 'timers') {
          subview.innerHTML = `<div class="card" style="max-width:480px;margin:0 auto"><h3>⏱ Cronómetros y Temporizadores</h3><div id="tbox" class="mt"></div></div>`;
          RD.timersTool(subview.querySelector('#tbox'));
        }
      }

      view.querySelector('#tabs').onclick = e => {
        const c = e.target.closest('[data-t]');
        if (c) showTab(c.dataset.t);
      };

      const newBtn = view.querySelector('#newr');
      if (newBtn) newBtn.onclick = () => routineEditorModal(null, exList, () => showTab('routines'));

      await showTab('routines');
    }
  };

  async function renderRoutinesList(el) {
    const list = await RD.api.get('/routines');
    el.innerHTML = `
    <div class="grid g2">
      ${list.map(r => `
      <div class="card" data-rid="${r.id}">
        <div class="row between">
          <span class="badge ${r.template ? 'ok' : 'info'}">${r.template ? 'Plantilla Oficial' : 'Personalizada'}</span>
          <span class="badge">${esc(r.level || 'Todos')}</span>
        </div>
        <h3 class="mt2" style="margin-bottom:.2rem">${esc(r.name)}</h3>
        <p class="muted small" style="min-height:2.6em">${esc(r.goal || r.description || 'Sin descripción')}</p>
        <div class="row between wrap gap small muted mb">
          <span>📅 ${r.days} día(s) / semana</span>
          <span>🏋️ ${r.exercises} ejercicio(s)</span>
          <span>👥 ${r.assigned} socio(s)</span>
        </div>
        <div class="row gap wrap">
          <button class="btn sm primary" data-act="view">Ver detalle</button>
          ${can('admin', 'entrenador') ? `
            <button class="btn sm" data-act="assign">👥 Asignar</button>
            <button class="btn sm" data-act="edit">✏️ Editar</button>
            <button class="btn sm danger" data-act="del">🗑</button>` : ''}
        </div>
      </div>`).join('') || '<div class="empty">No hay rutinas registradas aún</div>'}
    </div>`;

    el.onclick = async e => {
      const card = e.target.closest('[data-rid]');
      if (!card) return;
      const rid = +card.dataset.rid;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (!act) return;

      if (act === 'view') {
        const full = await RD.api.get('/routines/' + rid);
        showRoutineDetailModal(full);
      } else if (act === 'assign') {
        bulkAssignRoutineModal(rid);
      } else if (act === 'edit') {
        const [full, exList] = await Promise.all([RD.api.get('/routines/' + rid), RD.api.get('/exercises')]);
        routineEditorModal(full, exList, () => renderRoutinesList(el));
      } else if (act === 'del') {
        if (await RD.confirm('Eliminar rutina', '¿Estás seguro de eliminar esta rutina? Se desvinculará de los socios asignados.', 'Eliminar', true)) {
          await RD.api.del('/routines/' + rid);
          RD.toast('Rutina eliminada');
          renderRoutinesList(el);
        }
      }
    };
  }

  function showRoutineDetailModal(r) {
    const d = RD.openModal(r.name, `
      <div class="muted small mb">${esc(r.goal || '')} · Nivel: <b>${esc(r.level)}</b></div>
      ${r.description ? `<div class="tip small mb">${esc(r.description)}</div>` : ''}
      ${r.days.map((d, di) => `
        <div class="card flat mt mb">
          <h4>${esc(d.title || `Día ${di + 1}`)} (${d.items.length} ejercicios)</h4>
          <div class="list">
            ${d.items.map((it, idx) => `
            <div class="item click" data-ex="${esc(it.ex_id)}">
              <span class="muted small" style="width:24px">${idx + 1}.</span>
              <div class="grow">
                <b>${esc(it.nombre)}</b>
                <div class="muted tiny">${esc(it.grupo || '')} · ${it.sets} series × ${esc(it.reps)}${it.seconds ? ` (${it.seconds}s)` : ''} · descanso ${it.rest || 60}s</div>
                ${it.note ? `<div class="gold tiny">Nota: ${esc(it.note)}</div>` : ''}
              </div>
            </div>`).join('')}
          </div>
        </div>`).join('')}
    `, { wide: true });

    d.el.onclick = async e => {
      const it = e.target.closest('[data-ex]');
      if (!it) return;
      try {
        const exList = await RD.api.get('/exercises');
        const ex = exList.find(x => x.id === it.dataset.ex);
        if (ex) RD.openExercise(ex);
      } catch (err) { }
    };
  }

  function routineEditorModal(existing, exList, onDone) {
    let days = existing ? JSON.parse(JSON.stringify(existing.days)) : [
      { index: 0, title: 'Día 1: Entrenamiento A', items: [] }
    ];

    const d = RD.openModal(existing ? 'Editar Rutina' : 'Nueva Rutina', `
      <form id="ref">
        <label class="field"><span>Nombre de la rutina *</span><input name="name" value="${esc(existing?.name || '')}" required placeholder="Ej. Full Body 3 Días"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Objetivo</span><input name="goal" value="${esc(existing?.goal || '')}" placeholder="Fuerza, masa, pérdida de grasa"></label>
          <label class="field"><span>Nivel</span>
            <select name="level">
              <option value="principiante" ${existing?.level === 'principiante' ? 'selected' : ''}>Principiante</option>
              <option value="intermedio" ${existing?.level === 'intermedio' ? 'selected' : ''}>Intermedio</option>
              <option value="avanzado" ${existing?.level === 'avanzado' ? 'selected' : ''}>Avanzado</option>
            </select>
          </label>
        </div>
        <label class="field"><span>Descripción / Instrucciones</span><textarea name="description">${esc(existing?.description || '')}</textarea></label>
        <label class="check"><input type="checkbox" name="template" ${existing?.template ? 'checked' : ''}> <span>Marcar como plantilla oficial del gimnasio</span></label>
        <hr style="border-color:var(--line);margin:1rem 0">
        <div class="row between mb">
          <h3>Estructura de Días y Ejercicios</h3>
          <button type="button" class="btn sm" id="addday">＋ Agregar Día</button>
        </div>
        <div id="daycontainer"></div>
        <button class="btn primary block mt" type="submit">Guardar Rutina Completa</button>
      </form>
    `, { wide: true, sticky: true });

    const f = d.el.querySelector('#ref');
    const container = d.el.querySelector('#daycontainer');

    function renderDays() {
      container.innerHTML = days.map((day, di) => `
        <div class="card mb" data-di="${di}">
          <div class="row between gap mb">
            <input class="grow" style="font-weight:700" value="${esc(day.title || `Día ${di + 1}`)}" data-daytitle="${di}">
            <button type="button" class="btn sm" data-addex="${di}">＋ Ejercicio</button>
            ${days.length > 1 ? `<button type="button" class="btn sm danger" data-delday="${di}">✕</button>` : ''}
          </div>
          <div class="list">
            ${day.items.map((it, ii) => `
            <div class="item gap" data-ii="${ii}">
              <div class="grow">
                <b>${esc(it.nombre)}</b> <span class="badge info">${esc(it.grupo || '')}</span>
                <div class="row gap wrap mt2">
                  <label class="small muted">Series: <input type="number" min="1" max="10" value="${it.sets || 3}" data-prop="sets" style="width:60px;min-height:30px;padding:2px 6px"></label>
                  <label class="small muted">Reps: <input type="text" value="${esc(it.reps || '10')}" data-prop="reps" style="width:75px;min-height:30px;padding:2px 6px"></label>
                  <label class="small muted">Descanso (s): <input type="number" min="0" step="5" value="${it.rest || 60}" data-prop="rest" style="width:65px;min-height:30px;padding:2px 6px"></label>
                </div>
              </div>
              <button type="button" class="icon-btn" data-delex="${di}" data-delii="${ii}" title="Quitar">🗑</button>
            </div>`).join('') || '<div class="muted small center">Sin ejercicios en este día</div>'}
          </div>
        </div>
      `).join('');
    }

    renderDays();

    d.el.querySelector('#addday').onclick = () => {
      days.push({ index: days.length, title: `Día ${days.length + 1}`, items: [] });
      renderDays();
    };

    container.oninput = e => {
      const dt = e.target.dataset.daytitle;
      if (dt != null) { days[+dt].title = e.target.value; return; }
      const itemEl = e.target.closest('[data-ii]');
      if (!itemEl) return;
      const dayEl = e.target.closest('[data-di]');
      const di = +dayEl.dataset.di;
      const ii = +itemEl.dataset.ii;
      const prop = e.target.dataset.prop;
      if (prop === 'sets') days[di].items[ii].sets = Math.max(1, parseInt(e.target.value, 10) || 1);
      if (prop === 'reps') days[di].items[ii].reps = e.target.value;
      if (prop === 'rest') days[di].items[ii].rest = Math.max(0, parseInt(e.target.value, 10) || 60);
    };

    container.onclick = e => {
      const delDay = e.target.closest('[data-delday]');
      if (delDay) {
        days.splice(+delDay.dataset.delday, 1);
        days.forEach((d, idx) => d.index = idx);
        renderDays();
        return;
      }
      const delEx = e.target.closest('[data-delex]');
      if (delEx) {
        days[+delEx.dataset.delex].items.splice(+delEx.dataset.delii, 1);
        renderDays();
        return;
      }
      const addEx = e.target.closest('[data-addex]');
      if (addEx) {
        const di = +addEx.dataset.addex;
        const pickerModal = RD.openModal('Seleccionar ejercicio para ' + (days[di].title || `Día ${di + 1}`), '<div id="pickerlib"></div>', { wide: true });
        RD.exerciseLibrary(pickerModal.el.querySelector('#pickerlib'), exList, chosen => {
          days[di].items.push({
            ex_id: chosen.id,
            nombre: chosen.nombre,
            grupo: chosen.grupo,
            tipo: chosen.tipo,
            sets: 3,
            reps: chosen.tipo === 'core' ? '15' : '10',
            rest: 60,
            seconds: null
          });
          pickerModal.close();
          renderDays();
        });
      }
    };

    f.onsubmit = async e => {
      e.preventDefault();
      const hasExercises = days.some(d => d.items.length > 0);
      if (!hasExercises) return RD.toast('Agrega al menos un ejercicio a la rutina', 'warn');

      await RD.busy(f.querySelector('button[type=submit]'), async () => {
        try {
          const body = {
            name: f.name.value.trim(),
            goal: f.goal.value.trim(),
            level: f.level.value,
            description: f.description.value.trim(),
            template: f.template.checked,
            days: days.map((d, di) => ({
              index: di,
              title: d.title || `Día ${di + 1}`,
              items: d.items
            }))
          };
          if (existing) await RD.api.put('/routines/' + existing.id, body);
          else await RD.api.post('/routines', body);
          d.close();
          RD.toast('Rutina guardada exitosamente ✔');
          onDone && onDone();
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      });
    };
  }

  async function bulkAssignRoutineModal(rid) {
    const [routine, membersRes] = await Promise.all([RD.api.get('/routines/' + rid), RD.api.get('/members?filter=active&limit=500')]);
    const members = membersRes.members;

    const d = RD.openModal('Asignar "' + routine.name + '" a socios', `
      <p class="muted small">Selecciona uno o más socios activos para asignarles esta rutina a su app.</p>
      <input id="aq" placeholder="Filtrar por nombre o DNI…" class="mb">
      <div class="row between mb">
        <label class="check"><input type="checkbox" id="selall"> <span>Seleccionar todos los visibles</span></label>
        <span class="small muted" id="cntsel">0 seleccionados</span>
      </div>
      <div class="list" id="memlist" style="max-height:320px;overflow-y:auto"></div>
      <label class="check mt"><input type="checkbox" id="replace" checked> <span>Reemplazar rutinas anteriores asignadas a los socios elegidos</span></label>
      <button class="btn primary block mt" id="doassign">Confirmar Asignación</button>
    `, { wide: true });

    const listEl = d.el.querySelector('#memlist');
    const cntEl = d.el.querySelector('#cntsel');
    const selected = new Set();
    let filtered = members;

    function renderList() {
      listEl.innerHTML = filtered.map(m => `
        <label class="item click">
          <input type="checkbox" data-mid="${m.id}" ${selected.has(m.id) ? 'checked' : ''} style="margin-right:8px">
          <div class="grow">
            <b>${esc(m.name)}</b> <span class="muted small">${esc(m.code)} · DNI ${esc(m.dni || '—')}</span>
            <div class="muted tiny">${m.plan_name ? esc(m.plan_name) + ' · ' : ''}Objetivo: ${esc(m.goal || 'General')}</div>
          </div>
        </label>
      `).join('') || '<div class="empty">No hay socios con ese criterio</div>';
      cntEl.textContent = `${selected.size} seleccionado(s)`;
    }

    renderList();

    d.el.querySelector('#aq').oninput = RD.debounce(e => {
      const q = e.target.value.toLowerCase().trim();
      filtered = members.filter(m => [m.name, m.dni, m.code].some(v => String(v || '').toLowerCase().includes(q)));
      renderList();
    }, 150);

    listEl.onchange = e => {
      const mid = +e.target.dataset.mid;
      if (e.target.checked) selected.add(mid);
      else selected.delete(mid);
      cntEl.textContent = `${selected.size} seleccionado(s)`;
    };

    d.el.querySelector('#selall').onchange = e => {
      if (e.target.checked) filtered.forEach(m => selected.add(m.id));
      else filtered.forEach(m => selected.delete(m.id));
      renderList();
    };

    d.el.querySelector('#doassign').onclick = async () => {
      if (!selected.size) return RD.toast('Elige al menos un socio', 'warn');
      try {
        await RD.api.post(`/routines/${rid}/assign`, {
          member_ids: Array.from(selected),
          replace: d.el.querySelector('#replace').checked
        });
        RD.toast(`Rutina asignada a ${selected.size} socio(s) ✔`);
        d.close();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function addCustomExerciseDialog(done) {
    const d = RD.openModal('Nuevo Ejercicio Personalizado', `
      <form id="cef">
        <label class="field"><span>Nombre del ejercicio *</span><input name="nombre" required placeholder="Ej. Sentadilla búlgara"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Grupo muscular *</span>
            <select name="grupo">
              ${['Piernas', 'Glúteos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Core', 'Cardio', 'Movilidad', 'Otros'].map(g => `<option>${g}</option>`).join('')}
            </select>
          </label>
          <label class="field"><span>Tipo</span><select name="tipo"><option>fuerza</option><option>cardio</option><option>core</option><option>movilidad</option></select></label>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Equipo</span><input name="equipo" placeholder="Mancuerna / barra / máquina / sin equipo"></label>
          <label class="field"><span>Nivel</span><select name="nivel"><option>principiante</option><option>intermedio</option><option>avanzado</option></select></label>
        </div>
        <label class="field"><span>Músculos que trabaja</span><input name="musculos" placeholder="Ej. Cuádriceps, glúteo mayor"></label>
        <label class="field"><span>¿Para qué sirve? (Efecto real)</span><input name="efecto" placeholder="Desarrollo de fuerza, potencia, etc."></label>
        <label class="field"><span>Pasos detallados (uno por línea) *</span><textarea name="pasos" required placeholder="1. Coloca el pie...&#10;2. Baja la cadera...&#10;3. Empuja con fuerza..."></textarea></label>
        <label class="field"><span>Errores comunes (uno por línea)</span><textarea name="errores" placeholder="Adelantar demasiado la rodilla&#10;Perder la estabilidad..."></textarea></label>
        <label class="field"><span>Consejo de seguridad / respiración</span><input name="consejo" placeholder="Inhala al bajar, exhala al subir"></label>
        <label class="field"><span>Video / enlace (opcional)</span><input name="video" placeholder="https://..."></label>
        <button class="btn primary block mt">Guardar Ejercicio</button>
      </form>
    `, { wide: true });

    d.el.querySelector('#cef').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      const pasos = f.pasos.value.split('\n').map(s => s.trim()).filter(Boolean);
      const errores = f.errores.value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!pasos.length) return RD.toast('Ingresa al menos un paso', 'warn');

      try {
        await RD.api.post('/exercises', {
          nombre: f.nombre.value.trim(),
          grupo: f.grupo.value,
          tipo: f.tipo.value,
          equipo: f.equipo.value.trim(),
          nivel: f.nivel.value,
          musculos: f.musculos.value.trim(),
          efecto: f.efecto.value.trim(),
          pasos,
          errores,
          consejo: f.consejo.value.trim(),
          video: f.video.value.trim() || null
        });
        d.close();
        RD.toast('Ejercicio agregado ✔');
        done && done();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  // ============================================================
  // 2. CAJA DIARIA, VENTAS Y GASTOS (ARQUEO)
  // ============================================================
  // ============================================================
  // 2. CAJA DIARIA, VENTAS Y GASTOS (ARQUEO Y CONCILIACIÓN)
  // ============================================================
  RD.views.cash = {
    async render(view) {
      let day = RD.limaDay();

      async function load() {
        const [cash, prods] = await Promise.all([RD.api.get(`/cash?day=${day}`), RD.api.get('/products')]);
        const yapeList = cash.payments.filter(p => p.method === 'yape' || p.method === 'plin');
        const dailyPassesToday = cash.dailyPasses || [];

        view.innerHTML = `
        <div class="row between wrap gap mb">
          <div class="row gap">
            <label class="small muted">Fecha de caja: <input type="date" id="cday" value="${day}" style="min-height:36px;width:auto"></label>
            <button class="btn sm" id="todaybtn">Hoy</button>
          </div>
          <div class="row gap wrap">
            <button class="btn sm ok" id="dpbtn">🎟️ Pase Diario (S/ 5)</button>
            <button class="btn sm primary" id="posbtn">🛒 Venta rápida tienda</button>
            <button class="btn sm danger" id="expbtn">💸 Registrar Gasto</button>
          </div>
        </div>

        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${money(cash.income)}</div>
            <div class="l">Ingresos totales del día</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#4ade80">${money(cash.cash_in_drawer)}</div>
            <div class="l">💵 Efectivo físico en gaveta</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#a78bfa">${money((cash.byMethod.yape || 0) + (cash.byMethod.plin || 0))}</div>
            <div class="l">📱 Yape / Plin (${cash.yape_summary?.count || 0} op · ${cash.yape_summary?.verified_count || 0} verificadas)</div>
          </div>
          <div class="stat">
            <div class="v">${money(cash.net)}</div>
            <div class="l">Utilidad Neta (Ingresos - Gastos)</div>
          </div>
        </div>

        <div class="card mb">
          <h3>Resumen de Arqueo de Caja</h3>
          <div class="grid g4 mt2">
            <div class="small">💵 Efectivo cobrado: <b>${money(cash.byMethod.efectivo || 0)}</b></div>
            <div class="small">💸 Gastos en efectivo: <b class="bad">-${money(cash.expenses.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0))}</b></div>
            <div class="small">🟣 Yape: <b>${money(cash.byMethod.yape || 0)}</b></div>
            <div class="small">🔵 Plin / Bancos: <b>${money((cash.byMethod.plin || 0) + (cash.byMethod.tarjeta || 0) + (cash.byMethod.transferencia || 0))}</b></div>
          </div>
          <div class="tip small mt">
            <b>Regla de Arqueo para el Dueño:</b> Al cerrar caja, debe haber exactamente <b>${money(cash.cash_in_drawer)}</b> en monedas y billetes dentro del cajón físico. En tu aplicación de celular debes tener <b>${money((cash.byMethod.yape || 0) + (cash.byMethod.plin || 0))}</b> entre Yape y Plin.
          </div>
        </div>

        <!-- MÓDULO DE AUDITORÍA Y CONCILIACIÓN YAPE / PLIN -->
        <div class="card mb yape-box">
          <div class="row between wrap gap">
            <div>
              <h3 style="color:#c084fc">📱 Auditoría y Conciliación Yape & Plin (${yapeList.length} cobros)</h3>
              <p class="muted small">Coteja con tu celular las notificaciones bancarias. Al verificar el N° de Operación, márcalo como cotejado.</p>
            </div>
            <span class="badge ${cash.yape_summary?.pending_count ? 'warn' : 'ok'}">
              ${cash.yape_summary?.pending_count ? `⏳ ${cash.yape_summary.pending_count} por cotejar` : '✔ 100% Cotejado'}
            </span>
          </div>

          <div class="tbl-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Concepto</th>
                  <th>Monto</th>
                  <th>N° Operación</th>
                  <th>Cotejo</th>
                  <th>Boleta</th>
                </tr>
              </thead>
              <tbody>
                ${yapeList.map(p => `
                <tr>
                  <td class="small muted">${RD.fmtTime(p.created_at)}</td>
                  <td><b>${esc(p.member_name || p.dp_name || 'Cliente')}</b></td>
                  <td class="small">${esc(p.concept)}</td>
                  <td style="font-weight:700;color:#c084fc">${money(p.amount)}</td>
                  <td>
                    ${p.op_code ? `<span class="badge warn" style="font-family:monospace;font-size:.85rem">#${esc(p.op_code)}</span>` : '<span class="muted small">Sin código</span>'}
                  </td>
                  <td>
                    <button class="btn sm ${p.verified ? 'ok' : 'warn'}" data-verify="${p.id}">
                      ${p.verified ? '✔ Cotejado' : '⏳ Marcar Cotejado'}
                    </button>
                  </td>
                  <td>
                    <button class="icon-btn" data-receipt="${p.id}" title="Ver e Imprimir Boleta">🧾</button>
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="empty">No hay pagos por Yape o Plin en este día</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid g2">
          <div class="card">
            <h3>Todos los Cobros e Ingresos (${cash.payments.length})</h3>
            <div class="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Hora</th>
                    <th>Boleta</th>
                    <th>Concepto / Cliente</th>
                    <th>Monto</th>
                    <th>Método</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  ${cash.payments.map(p => `
                  <tr>
                    <td class="small muted">${RD.fmtTime(p.created_at)}</td>
                    <td class="small muted" style="font-family:monospace">${esc(p.receipt_no || ('B001-' + p.id))}</td>
                    <td>
                      <b>${esc(p.concept)}</b>
                      ${p.member_name ? `<div class="muted tiny">${esc(p.member_name)} (${esc(p.member_code)})</div>` : ''}
                      ${p.dp_name ? `<div class="gold tiny">🎟️ Pase Diario: ${esc(p.dp_name)} (${esc(p.dp_code || '')})</div>` : ''}
                      ${p.op_code ? `<div class="tiny" style="color:#c084fc">Op: #${esc(p.op_code)}</div>` : ''}
                      ${p.note ? `<div class="gold tiny">${esc(p.note)}</div>` : ''}
                    </td>
                    <td style="font-weight:700">${money(p.amount)}</td>
                    <td>
                      <span class="badge ${p.method === 'yape' ? 'warn' : p.method === 'plin' ? 'info' : 'ok'}">${esc(p.method)}</span>
                    </td>
                    <td class="row gap">
                      <button class="icon-btn" data-receipt="${p.id}" title="Ver / Imprimir Boleta">🧾</button>
                      ${can('admin') ? `<button class="icon-btn" data-voidpay="${p.id}" title="Anular cobro">✕</button>` : ''}
                    </td>
                  </tr>`).join('') || '<tr><td colspan="6" class="empty">Sin cobros en este día</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3>Gastos y Egresos (${cash.expenses.length})</h3>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Hora</th><th>Concepto</th><th>Monto</th><th>Método</th>${can('admin') ? '<th></th>' : ''}</tr></thead>
                <tbody>
                  ${cash.expenses.map(e => `
                  <tr>
                    <td class="small muted">${RD.fmtTime(e.created_at)}</td>
                    <td><b>${esc(e.concept)}</b><div class="muted tiny">Por: ${esc(e.user_name || 'Admin')}</div></td>
                    <td class="bad" style="font-weight:700">-${money(e.amount)}</td>
                    <td><span class="badge">${esc(e.method)}</span></td>
                    ${can('admin') ? `<td><button class="icon-btn" data-voidexp="${e.id}" title="Anular gasto">✕</button></td>` : ''}
                  </tr>`).join('') || '<tr><td colspan="5" class="empty">Sin gastos registrados</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>`;

        // Eventos de fecha
        view.querySelector('#cday').onchange = e => { day = e.target.value; load(); };
        view.querySelector('#todaybtn').onclick = () => { day = RD.limaDay(); load(); };

        // Botón pase diario rápido
        view.querySelector('#dpbtn').onclick = () => {
          if (RD.dailyPassDialog) RD.dailyPassDialog(load);
        };

        // Botón venta rápida (tienda con escáner)
        view.querySelector('#posbtn').onclick = () => posSaleModal(prods, load);

        // Botón gasto
        view.querySelector('#expbtn').onclick = () => addExpenseModal(load);

        // Acciones sobre pagos (Ver comprobante, verificar cotejo, anular)
        view.onclick = async e => {
          const rc = e.target.closest('[data-receipt]');
          if (rc) {
            try {
              const receipt = await RD.api.get(`/payments/${rc.dataset.receipt}/receipt`);
              RD.receiptModal(receipt);
            } catch (err) { RD.toast(err.message, 'err'); }
            return;
          }

          const vf = e.target.closest('[data-verify]');
          if (vf) {
            try {
              await RD.api.post(`/payments/${vf.dataset.verify}/verify`);
              RD.toast('Estado de cotejo actualizado ✔');
              load();
            } catch (err) { RD.toast(err.message, 'err'); }
            return;
          }

          const vp = e.target.closest('[data-voidpay]');
          if (vp) {
            const reason = await RD.prompt('Anular cobro', 'Motivo de la anulación', 'Error de digitación, devolución, etc.');
            if (reason) {
              await RD.api.post(`/payments/${vp.dataset.voidpay}/void`, { reason });
              RD.toast('Cobro anulado');
              load();
            }
            return;
          }

          const ve = e.target.closest('[data-voidexp]');
          if (ve) {
            if (await RD.confirm('Anular gasto', '¿Deseas anular este gasto registrado?', 'Anular', true)) {
              await RD.api.post(`/expenses/${ve.dataset.voidexp}/void`);
              RD.toast('Gasto anulado');
              load();
            }
          }
        };
      }

      await load();
    }
  };

  function posSaleModal(prods, onDone) {
    const act = prods.filter(p => p.active);
    const d = RD.openModal('Venta Rápida (Recepción / Tienda)', `
      <form id="posf">
        <label class="field">
          <span>Escanear código de barras o buscar</span>
          <input id="bcinput" placeholder="Escanea la botella con el lector USB o escribe…" autocomplete="off" autofocus>
        </label>
        <label class="field"><span>Producto *</span>
          <select name="product_id" id="posprod">
            ${act.map(p => `<option value="${p.id}" data-p="${p.price}" data-s="${p.stock}" data-bc="${esc(p.barcode || '')}">${esc(p.name)} - ${money(p.price)} (Stock: ${p.stock}) ${p.barcode ? `[BC: ${esc(p.barcode)}]` : ''}</option>`).join('')}
          </select>
        </label>
        <div class="grid g2 keep">
          <label class="field"><span>Cantidad</span><input name="qty" type="number" min="1" value="1" id="posqty" required></label>
          <label class="field"><span>Método de pago *</span>
            <select name="method" id="posmeth">
              <option value="efectivo">💵 Efectivo</option>
              <option value="yape">🟣 Yape</option>
              <option value="plin">🔵 Plin</option>
              <option value="tarjeta">💳 Tarjeta</option>
            </select>
          </label>
        </div>
        <div class="yape-box hidden mb mt" id="pos_yape">
          <label class="field"><span>N° de Operación Yape/Plin (4-6 dígitos)</span>
            <input name="op_code" id="posop" placeholder="Ej. 182940" inputmode="numeric">
          </label>
        </div>
        <div class="stat gold mt mb"><div class="v" id="postotal">S/ 0.00</div><div class="l">Total a cobrar</div></div>
        <button class="btn primary block">Cobrar Venta y Emitir Boleta</button>
      </form>
    `);

    const f = d.el.querySelector('#posf');
    const bcInp = f.querySelector('#bcinput');
    const prodSel = f.querySelector('#posprod');
    const qtyInp = f.querySelector('#posqty');
    const methSel = f.querySelector('#posmeth');
    const yBox = d.el.querySelector('#pos_yape');
    const totalEl = d.el.querySelector('#postotal');

    function updateTotal() {
      const opt = prodSel.selectedOptions[0];
      const p = opt ? +opt.dataset.p : 0;
      const q = Math.max(1, +qtyInp.value || 1);
      totalEl.textContent = money(p * q);
    }
    updateTotal();
    prodSel.onchange = updateTotal;
    qtyInp.oninput = updateTotal;

    // Escáner de código de barras dentro del modal
    bcInp.oninput = () => {
      const val = bcInp.value.trim().toLowerCase();
      if (!val) return;
      const matchOpt = Array.from(prodSel.options).find(opt =>
        (opt.dataset.bc && opt.dataset.bc.toLowerCase() === val) ||
        opt.textContent.toLowerCase().includes(val)
      );
      if (matchOpt) {
        prodSel.value = matchOpt.value;
        updateTotal();
        RD.beep('tick');
      }
    };
    bcInp.onkeydown = e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        qtyInp.focus();
      }
    };

    methSel.onchange = () => {
      const isYape = methSel.value === 'yape' || methSel.value === 'plin';
      yBox.classList.toggle('hidden', !isYape);
      if (isYape) setTimeout(() => d.el.querySelector('#posop')?.focus(), 50);
    };

    f.onsubmit = async e => {
      e.preventDefault();
      try {
        const res = await RD.api.post('/sales', {
          product_id: +prodSel.value,
          qty: +qtyInp.value,
          method: methSel.value,
          op_code: f.op_code?.value.trim() || null
        });
        RD.beep('done');
        RD.toast('Venta registrada con éxito ✔');
        d.close();
        if (res.receipt) RD.receiptModal(res.receipt);
        onDone && onDone();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function addExpenseModal(onDone) {
    const d = RD.openModal('Registrar Gasto de Caja', `
      <form id="expf">
        <label class="field"><span>Concepto del gasto *</span><input name="concept" required placeholder="Ej. Compra de agua para recepción, limpieza, pasajes"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Monto (S/) *</span><input name="amount" type="number" step="0.5" min="0.5" required placeholder="0.00"></label>
          <label class="field"><span>Método</span>
            <select name="method">
              <option value="efectivo">Efectivo de caja</option>
              <option value="yape">Yape</option>
              <option value="transferencia">Transferencia</option>
            </select>
          </label>
        </div>
        <button class="btn danger block mt">Registrar Egreso</button>
      </form>
    `);
    const f = d.el.querySelector('#expf');
    f.onsubmit = async e => {
      e.preventDefault();
      try {
        await RD.api.post('/expenses', {
          concept: f.concept.value.trim(),
          amount: +f.amount.value,
          method: f.method.value
        });
        RD.toast('Gasto registrado ✔');
        d.close();
        onDone && onDone();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  // ============================================================
  // 3. REPORTES Y ANÁLISIS
  // ============================================================
  RD.views.reports = {
    async render(view) {
      const today = RD.limaDay();
      let to = today, from = RD.addDays(today, -29);

      async function load() {
        const d = await RD.api.get(`/reports?from=${from}&to=${to}`);
        const maxH = Math.max(1, ...d.peak.map(x => x.n));
        const hoursMap = Object.fromEntries(d.peak.map(x => [x.hour, x.n]));
        const hoursAll = Array.from({ length: 16 }, (_, i) => i + 6); // 6am a 21pm

        view.innerHTML = `
        <div class="row between wrap gap mb">
          <div class="row gap wrap">
            <label class="small muted">Desde: <input type="date" id="rf" value="${from}" style="min-height:36px;width:auto"></label>
            <label class="small muted">Hasta: <input type="date" id="rt" value="${to}" style="min-height:36px;width:auto"></label>
            <button class="btn sm" id="apply">Filtrar</button>
          </div>
          <div class="chips">
            <span class="chip" data-r="7">Últimos 7 días</span>
            <span class="chip on" data-r="30">Últimos 30 días</span>
            <span class="chip" data-r="90">Últimos 3 meses</span>
          </div>
        </div>

        <div class="grid g4 mb">
          <div class="stat gold"><div class="v">${money(d.totalIncome)}</div><div class="l">Ingresos del período</div></div>
          <div class="stat"><div class="v">-${money(d.expenses)}</div><div class="l">Gastos del período</div></div>
          <div class="stat"><div class="v">${money(d.net)}</div><div class="l">Utilidad Neta</div></div>
          <div class="stat"><div class="v">${d.newMembers}</div><div class="l">Socios Nuevos</div></div>
        <div class="card mb">
          <h3>📊 Desglose de Ingresos por Categoría</h3>
          <div class="grid g4 mt2">
            <div class="stat">
              <div class="v" style="font-size:1.35rem">${money(d.catIncome?.memberships || 0)}</div>
              <div class="l">🏋️ Membresías de Socios</div>
            </div>
            <div class="stat">
              <div class="v" style="font-size:1.35rem;color:#f5b400">${money(d.catIncome?.daily_passes || 0)}</div>
              <div class="l">🎟️ Pases Diarios (Visitantes)</div>
            </div>
            <div class="stat">
              <div class="v" style="font-size:1.35rem;color:#60a5fa">${money(d.catIncome?.store || 0)}</div>
              <div class="l">🛒 Ventas Tienda (Bebidas/Supl.)</div>
            </div>
            <div class="stat">
              <div class="v" style="font-size:1.35rem">${money(d.catIncome?.others || 0)}</div>
              <div class="l">📄 Otros Conceptos</div>
            </div>
          </div>
        </div>

        <div class="grid g2 mb">
          <div class="card">
            <h3>⏰ Horas Pico del Gimnasio (Asistencias)</h3>
            <p class="muted small mb">Muestra a qué hora asisten más personas para gestionar el aforo y la atención.</p>
            <div class="bars" style="height:140px">
              ${hoursAll.map(h => {
                const count = hoursMap[h] || 0;
                return `<div class="b" style="height:${Math.max(2, count / maxH * 100)}%;background:var(--gold)"><span>${count || ''}</span></div>`;
              }).join('')}
            </div>
            <div class="bars-l">${hoursAll.map(h => `<span>${h}h</span>`).join('')}</div>
          </div>

          <div class="card">
            <h3>Membresías por Plan Vendido</h3>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Plan</th><th>Ventas</th><th>Total Recaudado</th></tr></thead>
                <tbody>
                  ${d.byPlan.map(p => `
                  <tr>
                    <td><b>${esc(p.plan_name)}</b></td>
                    <td>${p.n} membresías</td>
                    <td class="gold" style="font-weight:700">${money(p.total)}</td>
                  </tr>`).join('') || '<tr><td colspan="3" class="empty">Sin membresías vendidas</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="grid g2">
          <div class="card">
            <h3>Ingresos por Método de Pago</h3>
            <div class="list">
              ${d.byMethod.map(m => `
              <div class="item">
                <span class="badge ${m.method === 'yape' ? 'warn' : m.method === 'plin' ? 'info' : 'ok'}">${esc(m.method)}</span>
                <span class="grow">${m.n} transacciones</span>
                <b>${money(m.total)}</b>
              </div>`).join('') || '<div class="empty">Sin transacciones</div>'}
            </div>
          </div>

          <div class="card">
            <h3>Retención y Renovaciones</h3>
            <div class="list">
              <div class="item">
                <span class="grow">Socios nuevos en el período:</span>
                <b>${d.newMembers}</b>
              </div>
              <div class="item">
                <span class="grow">Renovaciones de socios antiguos:</span>
                <b class="ok">${d.renewals}</b>
              </div>
              <div class="item">
                <span class="grow">Membresías vencidas sin renovar:</span>
                <b class="bad">${d.expiredPeriod}</b>
              </div>
            </div>
          </div>
        </div>`;

        view.querySelector('#apply').onclick = () => {
          from = view.querySelector('#rf').value;
          to = view.querySelector('#rt').value;
          load();
        };

        view.querySelectorAll('[data-r]').forEach(c => c.onclick = () => {
          const days = +c.dataset.r;
          to = RD.limaDay();
          from = RD.addDays(to, -days + 1);
          view.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === c));
          load();
        });
      }

      await load();
    }
  };

  // ============================================================
  // 4. AJUSTES, PLANES, PRODUCTOS, PERSONAL Y BACKUP (SOLO ADMIN)
  // ============================================================
  RD.views.settings = {
    async render(view) {
      const [settings, users, plans, prods] = await Promise.all([
        RD.api.get('/settings'),
        RD.api.get('/users'),
        RD.api.get('/plans'),
        RD.api.get('/products')
      ]);

      view.innerHTML = `
      <div class="chips mb" id="stabs">
        <span class="chip on" data-st="gym">🏢 Datos del Gimnasio</span>
        <span class="chip" data-st="plans">📋 Planes de Precios</span>
        <span class="chip" data-st="prods">🛒 Productos / Stock</span>
        <span class="chip" data-st="users">👥 Usuarios del Sistema</span>
        <span class="chip" data-st="system">💾 Copia de Seguridad</span>
      </div>
      <div id="stabview"></div>`;

      const stabview = view.querySelector('#stabview');

      function showSubTab(tab) {
        view.querySelectorAll('#stabs .chip').forEach(c => c.classList.toggle('on', c.dataset.st === tab));
        if (tab === 'gym') renderGymSettings(stabview, settings);
        else if (tab === 'plans') renderPlansSettings(stabview, plans);
        else if (tab === 'prods') renderProdsSettings(stabview, prods);
        else if (tab === 'users') renderUsersSettings(stabview, users);
        else if (tab === 'system') renderSystemSettings(stabview);
      }

      view.querySelector('#stabs').onclick = e => {
        const c = e.target.closest('[data-st]');
        if (c) showSubTab(c.dataset.st);
      };

      showSubTab('gym');
    }
  };

  function renderGymSettings(el, s) {
    el.innerHTML = `
    <div class="card" style="max-width:680px">
      <h3>Configuración General del Gimnasio</h3>
      <form id="gf">
        <label class="field"><span>Nombre del gimnasio *</span><input name="gym_name" value="${esc(s.gym_name)}" required></label>
        <label class="field"><span>Eslogan</span><input name="gym_slogan" value="${esc(s.gym_slogan)}"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Teléfono / WhatsApp *</span><input name="gym_phone" value="${esc(s.gym_phone)}" required></label>
          <label class="field"><span>Color de marca</span><input name="color" type="color" value="${esc(s.color || '#f5b400')}"></label>
        </div>
        <label class="field"><span>Dirección física</span><input name="gym_address" value="${esc(s.gym_address)}"></label>
        <label class="field"><span>Horario de atención</span><input name="opening" value="${esc(s.opening)}"></label>

        <h3 class="mt">Reglas del Escáner de Acceso</h3>
        <div class="grid g2 keep">
          <label class="field"><span>Aviso de vencimiento (días antes)</span>
            <input name="warn_days" type="number" min="0" max="30" value="${s.warn_days}">
          </label>
          <label class="field"><span>Días de gracia tras vencer (permite entrar)</span>
            <input name="grace_days" type="number" min="0" max="15" value="${s.grace_days}">
          </label>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Anti-pase duplicado (minutos entre escaneos)</span>
            <input name="passback_min" type="number" min="1" max="60" value="${s.passback_min}">
          </label>
          <label class="field"><span>Tiempo estimado de estadía (minutos)</span>
            <input name="stay_min" type="number" min="30" max="360" value="${s.stay_min}">
          </label>
        </div>

        <button class="btn primary block mt">Guardar Ajustes</button>
      </form>
    </div>`;

    el.querySelector('#gf').onsubmit = async e => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(e.target).entries());
      try {
        await RD.api.put('/settings', body);
        RD.toast('Ajustes guardados ✔');
        RD.pub = await (await fetch('/api/public')).json();
        localStorage.setItem('rd_public', JSON.stringify(RD.pub));
        document.documentElement.style.setProperty('--gold', RD.pub.color || '#f5b400');
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function renderPlansSettings(el, plans) {
    el.innerHTML = `
    <div class="card">
      <div class="row between mb">
        <h3>Planes de Membresía</h3>
        <button class="btn sm primary" id="addplan">＋ Nuevo Plan</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Duración</th><th>Precio</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${plans.map(p => `
            <tr>
              <td><b>${esc(p.name)}</b></td>
              <td>${p.months ? `${p.months} mes(es)` : `${p.days} día(s)`}</td>
              <td class="gold" style="font-weight:700">${money(p.price)}</td>
              <td><span class="badge ${p.active ? 'ok' : 'bad'}">${p.active ? 'Activo' : 'Inactivo'}</span></td>
              <td><button class="btn sm" data-editplan="${p.id}">Editar</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

    el.querySelector('#addplan').onclick = () => planEditorModal(null, () => RD.go('settings'));
    el.onclick = e => {
      const ep = e.target.closest('[data-editplan]');
      if (ep) {
        const p = plans.find(x => x.id === +ep.dataset.editplan);
        planEditorModal(p, () => RD.go('settings'));
      }
    };
  }

  function planEditorModal(p, done) {
    const d = RD.openModal(p ? 'Editar Plan' : 'Nuevo Plan', `
      <form id="pf">
        <label class="field"><span>Nombre del plan *</span><input name="name" value="${esc(p?.name || '')}" required placeholder="Ej. 1 mes, 3 meses"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Duración en meses</span><input name="months" type="number" min="0" value="${p?.months ?? 1}"></label>
          <label class="field"><span>O en días (ej. pase diario)</span><input name="days" type="number" min="0" value="${p?.days ?? 0}"></label>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Precio (S/) *</span><input name="price" type="number" step="0.5" min="0" value="${p?.price ?? 60}" required></label>
          <label class="field"><span>Orden</span><input name="sort" type="number" value="${p?.sort ?? 1}"></label>
        </div>
        <label class="check"><input type="checkbox" name="active" ${p ? (p.active ? 'checked' : '') : 'checked'}> <span>Plan activo para la venta</span></label>
        <button class="btn primary block mt">Guardar Plan</button>
      </form>
    `);

    d.el.querySelector('#pf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        const body = {
          name: f.name.value.trim(),
          months: +f.months.value || 0,
          days: +f.days.value || 0,
          price: +f.price.value,
          sort: +f.sort.value || 1,
          active: f.active.checked ? 1 : 0
        };
        if (p) await RD.api.put('/plans/' + p.id, body);
        else await RD.api.post('/plans', body);
        d.close();
        RD.toast('Plan guardado ✔');
        done && done();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function renderProdsSettings(el, prods) {
    el.innerHTML = `
    <div class="card">
      <div class="row between wrap gap mb">
        <div>
          <h3>Productos e Inventario de Tienda</h3>
          <p class="muted small">Asigna códigos de barra para que el escáner de recepción venda aguas y suplementos al instante.</p>
        </div>
        <button class="btn sm primary" id="addprd">＋ Nuevo Producto</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Código Barras</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${prods.map(p => `
            <tr>
              <td><b>${esc(p.name)}</b><div class="muted tiny">${esc(p.category || 'general')}</div></td>
              <td><span class="badge" style="font-family:monospace;font-size:.8rem">${esc(p.barcode || 'Sin código')}</span></td>
              <td class="gold" style="font-weight:700">${money(p.price)}</td>
              <td><span class="badge ${p.stock <= (p.min_stock || 5) ? 'bad' : 'info'}">${p.stock} unid.</span></td>
              <td><span class="badge ${p.active ? 'ok' : 'bad'}">${p.active ? 'Disponible' : 'Oculto'}</span></td>
              <td class="row gap">
                <button class="btn sm ok" data-addstock="${p.id}" title="Reabastecer mercadería">＋ Stock</button>
                <button class="btn sm" data-editprd="${p.id}">Editar</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

    el.querySelector('#addprd').onclick = () => productEditorModal(null, () => RD.go('settings'));
    el.onclick = async e => {
      const ep = e.target.closest('[data-editprd]');
      if (ep) {
        const p = prods.find(x => x.id === +ep.dataset.editprd);
        productEditorModal(p, () => RD.go('settings'));
        return;
      }
      const as = e.target.closest('[data-addstock]');
      if (as) {
        const p = prods.find(x => x.id === +as.dataset.addstock);
        const qty = await RD.prompt(`Reabastecer: ${p.name}`, `Unidades compradas a sumar (Stock actual: ${p.stock}):`, '24');
        if (qty && +qty > 0) {
          try {
            await RD.api.post(`/products/${p.id}/stock`, { qty: +qty });
            RD.toast(`Stock actualizado (+${qty} unidades) ✔`);
            RD.go('settings');
          } catch (err) { RD.toast(err.message, 'err'); }
        }
      }
    };
  }

  function productEditorModal(p, done) {
    const d = RD.openModal(p ? 'Editar Producto' : 'Nuevo Producto', `
      <form id="prf">
        <label class="field"><span>Nombre del producto *</span><input name="name" value="${esc(p?.name || '')}" required placeholder="Ej. Agua 625 ml, Bebida energizante"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Código de barras (EAN-13 / Lector)</span>
            <input name="barcode" value="${esc(p?.barcode || '')}" placeholder="Escanea con el lector USB…">
          </label>
          <label class="field"><span>Categoría</span>
            <select name="category">
              <option value="bebidas" ${p?.category === 'bebidas' ? 'selected' : ''}>Bebidas / Hidratación</option>
              <option value="suplementos" ${p?.category === 'suplementos' ? 'selected' : ''}>Suplementos / Proteína</option>
              <option value="accesorios" ${p?.category === 'accesorios' ? 'selected' : ''}>Accesorios / Toallas</option>
              <option value="general" ${p?.category === 'general' ? 'selected' : ''}>General / Snacks</option>
            </select>
          </label>
        </div>
        <div class="grid g2 keep">
          <label class="field"><span>Precio de venta (S/) *</span><input name="price" type="number" step="0.5" min="0" value="${p?.price ?? 2}" required></label>
          <label class="field"><span>Stock actual</span><input name="stock" type="number" min="0" value="${p?.stock ?? 10}"></label>
        </div>
        <label class="check"><input type="checkbox" name="active" ${p ? (p.active ? 'checked' : '') : 'checked'}> <span>Activo para venta en recepción</span></label>
        <button class="btn primary block mt">Guardar Producto</button>
      </form>
    `);

    d.el.querySelector('#prf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        const body = {
          name: f.name.value.trim(),
          barcode: f.barcode.value.trim() || null,
          category: f.category.value,
          price: +f.price.value,
          stock: +f.stock.value || 0,
          active: f.active.checked ? 1 : 0
        };
        if (p) await RD.api.put('/products/' + p.id, body);
        else await RD.api.post('/products', body);
        d.close();
        RD.toast('Producto guardado con éxito ✔');
        done && done();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function renderUsersSettings(el, users) {
    el.innerHTML = `
    <div class="card">
      <div class="row between mb">
        <h3>Personal del Gimnasio con Acceso al Panel</h3>
        <button class="btn sm primary" id="adduser">＋ Nuevo Usuario</button>
      </div>
      <div class="tbl-wrap">
        <table>
          <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${users.map(u => `
            <tr>
              <td><b>${esc(u.username)}</b></td>
              <td>${esc(u.name)}</td>
              <td><span class="badge ${u.role === 'admin' ? 'gold' : u.role === 'recepcion' ? 'ok' : 'info'}">${esc(u.role)}</span></td>
              <td><span class="badge ${u.active ? 'ok' : 'bad'}">${u.active ? 'Activo' : 'Inactivo'}</span></td>
              <td><button class="btn sm" data-editusr="${u.id}">Editar / Clave</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`;

    el.querySelector('#adduser').onclick = () => userEditorModal(null, () => RD.go('settings'));
    el.onclick = e => {
      const eu = e.target.closest('[data-editusr]');
      if (eu) {
        const u = users.find(x => x.id === +eu.dataset.editusr);
        userEditorModal(u, () => RD.go('settings'));
      }
    };
  }

  function userEditorModal(u, done) {
    const d = RD.openModal(u ? 'Editar Usuario' : 'Nuevo Usuario', `
      <form id="uf">
        <label class="field"><span>Nombre completo *</span><input name="name" value="${esc(u?.name || '')}" required></label>
        <div class="grid g2 keep">
          <label class="field"><span>Usuario (login) *</span><input name="username" value="${esc(u?.username || '')}" required ${u ? 'disabled' : ''}></label>
          <label class="field"><span>Rol *</span>
            <select name="role">
              <option value="recepcion" ${u?.role === 'recepcion' ? 'selected' : ''}>Recepción (Caja y Escáner)</option>
              <option value="entrenador" ${u?.role === 'entrenador' ? 'selected' : ''}>Entrenador (Rutinas y Fichas)</option>
              <option value="admin" ${u?.role === 'admin' ? 'selected' : ''}>Administrador (Todo)</option>
            </select>
          </label>
        </div>
        <label class="field"><span>Contraseña ${u ? '(dejar en blanco para no cambiar)' : '*'}</span><input name="password" type="password" minlength="6" ${u ? '' : 'required'}></label>
        ${u ? `<label class="check"><input type="checkbox" name="active" ${u.active ? 'checked' : ''}> <span>Usuario activo</span></label>` : ''}
        <button class="btn primary block mt">Guardar Usuario</button>
      </form>
    `);

    d.el.querySelector('#uf').onsubmit = async e => {
      e.preventDefault();
      const f = e.target;
      try {
        const body = {
          name: f.name.value.trim(),
          role: f.role.value,
          password: f.password.value || undefined
        };
        if (u) {
          body.active = f.active.checked ? 1 : 0;
          await RD.api.put('/users/' + u.id, body);
        } else {
          body.username = f.username.value.trim().toLowerCase();
          await RD.api.post('/users', body);
        }
        d.close();
        RD.toast('Usuario guardado ✔');
        done && done();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function renderSystemSettings(el) {
    el.innerHTML = `
    <div class="card" style="max-width:600px">
      <h3>Copia de Seguridad y Datos</h3>
      <p class="muted small mb">El sistema realiza respaldos automáticos diarios en el servidor. Puedes descargar una copia de seguridad completa de la base de datos SQLite en cualquier momento.</p>
      <div class="grid gap mt">
        <a class="btn primary" href="/api/backup" download>💾 Descargar Copia de Seguridad (.db)</a>
        <a class="btn" href="/admin/cards.html" target="_blank">🖨 Diseñador / Impresor Masivo de Tarjetas PVC</a>
      </div>
    </div>`;
  }

})();
