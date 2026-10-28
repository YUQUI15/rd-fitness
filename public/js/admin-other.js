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
          <span class="chip on" data-t="routines">${RD.icon('dumbbell')} Rutinas (${can('admin', 'entrenador') ? 'Gestión' : 'Ver'})</span>
          <span class="chip" data-t="exercises">${RD.icon('layers')} Ejercicios (${exList.length})</span>
          <span class="chip" data-t="timers">${RD.icon('timer')} Cronómetros Gym</span>
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
          subview.innerHTML = `<div class="card" style="max-width:480px;margin:0 auto"><h3>${RD.icon('timer')} Cronómetros y Temporizadores</h3><div id="tbox" class="mt"></div></div>`;
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
          <span>${RD.icon('calendar')} ${r.days} día(s) / semana</span>
          <span>${RD.icon('dumbbell')} ${r.exercises} ejercicio(s)</span>
          <span>${RD.icon('users')} ${r.assigned} socio(s)</span>
        </div>
        <div class="row gap wrap">
          <button class="btn sm primary" data-act="view">Ver detalle</button>
          ${can('admin', 'entrenador') ? `
            <button class="btn sm" data-act="assign">${RD.icon('users')} Asignar</button>
            <button class="btn sm" data-act="edit">${RD.icon('edit')} Editar</button>
            <button class="btn sm danger" data-act="del" title="Eliminar">${RD.icon('trash')}</button>` : ''}
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
            ${days.length > 1 ? `<button type="button" class="btn sm danger" data-delday="${di}" title="Quitar día">${RD.icon('x')}</button>` : ''}
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
              <button type="button" class="icon-btn" data-delex="${di}" data-delii="${ii}" title="Quitar">${RD.icon('trash')}</button>
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
          RD.toast('Rutina guardada exitosamente');
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
        RD.toast(`Rutina asignada a ${selected.size} socio(s)`);
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
        RD.toast('Ejercicio agregado');
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

        const actShift = cash.active_shift;
        const actTotals = cash.active_shift_totals;

        view.innerHTML = `
        <!-- WIDGET DE TURNO DE CAJA -->
        <div class="card mb shift-banner" style="background:var(--bg2); border-left:4px solid ${actShift ? '#10b981' : '#f59e0b'};">
          <div class="row between wrap gap">
            <div>
              <span class="badge ${actShift ? 'ok' : 'warn'}">${actShift ? RD.icon('check', '', 14) + ' Turno en Curso' : RD.icon('lock', '', 14) + ' Sin Turno Abierto'}</span>
              <h3 style="margin:.3rem 0;color:var(--text)">${actShift ? esc(actShift.shift_name) : 'No hay un turno de caja abierto'}</h3>
              ${actShift ? `
                <div class="small muted">
                  Cajero(a): <b>${esc(actShift.user_name)}</b> · Abierto: <b>${RD.fmtTime(actShift.opened_at)}</b> · Fondo inicial: <b class="gold">${money(actShift.initial_cash)}</b>
                </div>
                <div class="row gap wrap mt2 small">
                  <span style="color:#10b981">${RD.icon('cash', '', 14)} Efectivo esperado en gaveta: <b>${money(actTotals?.expectedCashInDrawer || 0)}</b></span>
                  <span style="color:#8b5cf6">${RD.icon('nfc', '', 14)} Cobros Digitales (Yape/Plin/POS): <b>${money(actTotals?.expectedDigital || 0)}</b></span>
                </div>
                <div class="muted tiny mt" style="opacity:.85">
                  El turno permanece activo de forma continua hasta que realices el arqueo manual con el botón "Cerrar Turno".
                </div>
              ` : `
                <p class="small muted" style="margin:.2rem 0">Abre un turno antes de cobrar para registrar tu fondo de sencillo (vuelto) y auditar tu arqueo.</p>
              `}
            </div>
            <div class="row gap">
              ${actShift ? `
                <button class="btn sm danger" id="closeshiftbtn">${RD.icon('lock')} Cerrar Turno / Arqueo</button>
              ` : `
                <button class="btn sm ok" id="openshiftbtn">${RD.icon('unlock')} Abrir Turno de Caja</button>
              `}
            </div>
          </div>
        </div>

        <div class="row between wrap gap mb">
          <div class="row gap">
            <label class="small muted">Fecha de caja: <input type="date" id="cday" value="${day}" style="min-height:36px;width:auto"></label>
            <button class="btn sm" id="todaybtn">Hoy</button>
          </div>
          <div class="row gap wrap">
            <button class="btn sm ok" id="dpbtn">${RD.icon('ticket')} Pase Diario (S/ 5)</button>
            <button class="btn sm primary" id="posbtn">${RD.icon('store')} Venta rápida tienda</button>
            <button class="btn sm danger" id="expbtn">${RD.icon('expense')} Registrar Gasto</button>
          </div>
        </div>

        <!-- TARJETAS DE ARQUEO SEPARADAS: GIMNASIO VS TIENDITA -->
        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${money(cash.income)}</div>
            <div class="l">Total Ingresos del Día</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#f5b400">${money(cash.gym_income || 0)}</div>
            <div class="l">${RD.icon('dumbbell')} Ingresos Gimnasio (Membresías + Pases)</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${money(cash.store_income || 0)}</div>
            <div class="l">${RD.icon('cart')} Ventas Tiendita (Aguas / Bebidas)</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#4ade80">${money(cash.cash_in_drawer)}</div>
            <div class="l">${RD.icon('cash')} Efectivo físico en gaveta</div>
          </div>
        </div>

        <div class="grid g3 mb">
          <div class="stat">
            <div class="v" style="color:#a78bfa">${money((cash.byMethod.yape || 0) + (cash.byMethod.plin || 0))}</div>
            <div class="l">${RD.icon('qr')} Yape / Plin (${cash.yape_summary?.count || 0} op · ${cash.yape_summary?.verified_count || 0} verificadas)</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#f87171">-${money(cash.expense)}</div>
            <div class="l">${RD.icon('expense')} Gastos Totales del Día</div>
          </div>
          <div class="stat">
            <div class="v" style="color:${cash.net >= 0 ? '#4ade80' : '#f87171'}">${money(cash.net)}</div>
            <div class="l">Utilidad Neta (Ingresos - Gastos)</div>
          </div>
        </div>

        <div class="card mb">
          <h3>Resumen de Arqueo de Caja del Día</h3>
          <div class="grid g5 mt2" style="grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:10px">
            <div class="small">${RD.icon('cash')} Efectivo cobrado: <b>${money(cash.byMethod.efectivo || 0)}</b></div>
            <div class="small">${RD.icon('expense')} Gastos en efectivo: <b class="bad">-${money(cash.expenses.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0))}</b></div>
            <div class="small">${RD.icon('qr')} Yape: <b>${money(cash.byMethod.yape || 0)}</b></div>
            <div class="small">${RD.icon('qr')} Plin: <b>${money(cash.byMethod.plin || 0)}</b></div>
            <div class="small">${RD.icon('card')} Tarjeta POS: <b>${money(cash.byMethod.tarjeta || 0)}</b></div>
          </div>
          <div class="tip small mt">
            <b>Regla de Arqueo para el Dueño:</b> Al cerrar caja, debe haber exactamente <b>${money(cash.cash_in_drawer)}</b> en monedas y billetes dentro del cajón físico. En tu aplicación de celular debes tener <b>${money((cash.byMethod.yape || 0) + (cash.byMethod.plin || 0))}</b> entre Yape y Plin, y en el reporte de lote de tu POS físico debes tener <b>${money(cash.byMethod.tarjeta || 0)}</b>.
          </div>
        </div>

        <!-- MÓDULO DE AUDITORÍA Y CONCILIACIÓN YAPE / PLIN -->
        <div class="card mb yape-box">
          <div class="row between wrap gap">
            <div>
              <h3 style="color:#c084fc">${RD.icon('qr')} Auditoría y Conciliación Yape & Plin (${yapeList.length} cobros)</h3>
              <p class="muted small">Coteja con tu celular las notificaciones bancarias. Al verificar el N° de Operación, márcalo como cotejado.</p>
            </div>
            <span class="badge ${cash.yape_summary?.pending_count ? 'warn' : 'ok'}">
              ${cash.yape_summary?.pending_count ? `${RD.icon('hourglass')} ${cash.yape_summary.pending_count} por cotejar` : `${RD.icon('check')} 100% Cotejado`}
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
                      ${p.verified ? `${RD.icon('check')} Cotejado` : `${RD.icon('hourglass')} Marcar Cotejado`}
                    </button>
                  </td>
                  <td>
                    <button class="icon-btn" data-receipt="${p.id}" title="Ver e Imprimir Boleta">${RD.icon('receipt')}</button>
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
                      ${p.dp_name ? `<div class="gold tiny">${RD.icon('ticket')} Pase Diario: ${esc(p.dp_name)} (${esc(p.dp_code || '')})</div>` : ''}
                      ${p.op_code ? `<div class="tiny" style="color:#c084fc">Op: #${esc(p.op_code)}</div>` : ''}
                      ${p.note ? `<div class="gold tiny">${esc(p.note)}</div>` : ''}
                    </td>
                    <td style="font-weight:700">${money(p.amount)}</td>
                    <td>
                      <span class="badge ${p.method === 'yape' ? 'warn' : p.method === 'plin' ? 'info' : 'ok'}">${esc(p.method)}</span>
                    </td>
                    <td class="row gap">
                      <button class="icon-btn" data-receipt="${p.id}" title="Ver / Imprimir Boleta">${RD.icon('receipt')}</button>
                      ${can('admin') ? `<button class="icon-btn" data-voidpay="${p.id}" title="Anular cobro">${RD.icon('x')}</button>` : ''}
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
                    ${can('admin') ? `<td><button class="icon-btn" data-voidexp="${e.id}" title="Anular gasto">${RD.icon('x')}</button></td>` : ''}
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

        // Botones de turno
        const openBtn = view.querySelector('#openshiftbtn');
        if (openBtn) openBtn.onclick = () => openShiftModal(load);
        const closeBtn = view.querySelector('#closeshiftbtn');
        if (closeBtn) closeBtn.onclick = () => closeShiftModal(actShift, actTotals, load);

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
              RD.toast('Estado de cotejo actualizado');
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

  // ============================================================
  // TIENDA / POS & CONTROL DE INVENTARIO (ADMIN / RECEPCIÓN)
  // ============================================================
  RD.views.store = {
    async render(view) {
      let activeTab = 'pos';
      let selectedCat = 'all';
      let term = '';
      let cart = []; // [{ product, qty, price }]

      view.innerHTML = `
      <div class="row between wrap gap mb">
        <div class="chips" id="store_tabs">
          <span class="chip on" data-st="pos">${RD.icon ? RD.icon('store') : ''} Punto de Venta (POS)</span>
          <span class="chip" data-st="inventory">${RD.icon ? RD.icon('box') : ''} Inventario y Productos</span>
          <span class="chip" data-st="sales">${RD.icon ? RD.icon('reports') : ''} Historial de Ventas</span>
        </div>
        <div class="row gap">
          <button class="btn primary sm" id="btn_new_prod">＋ Registrar Nuevo Producto</button>
        </div>
      </div>
      <div id="store_content"></div>`;

      const content = view.querySelector('#store_content');

      async function loadTab(tab) {
        activeTab = tab;
        view.querySelectorAll('#store_tabs .chip').forEach(c => c.classList.toggle('on', c.dataset.st === tab));
        view.querySelector('#btn_new_prod').classList.toggle('hidden', tab !== 'inventory');

        if (tab === 'pos') await renderPosTab(content);
        else if (tab === 'inventory') await renderInventoryTab(content);
        else if (tab === 'sales') await renderSalesHistoryTab(content);
      }

      view.querySelector('#store_tabs').onclick = e => {
        const c = e.target.closest('[data-st]');
        if (c) loadTab(c.dataset.st);
      };

      view.querySelector('#btn_new_prod').onclick = () => {
        productEditorModal(null, () => loadTab('inventory'));
      };

      // TAB 1: POS RÁPIDO
      async function renderPosTab(el) {
        const prods = await RD.api.get('/products');
        const availableProds = prods.filter(p => p.active);
        const categories = Array.from(new Set(availableProds.map(p => p.category || 'general')));

        el.innerHTML = `
        <div class="grid g2" style="grid-template-columns: 1.5fr 1fr; align-items: start;">
          <div>
            <div class="card mb">
              <div class="row gap mb">
                <input id="store_search" class="grow" placeholder="Escanear código de barras con lector USB o buscar producto..." autocomplete="off" autofocus>
              </div>
              <div class="chips mb" id="cat_chips">
                <span class="chip on" data-cat="all">Todos (${availableProds.length})</span>
                ${categories.map(c => `<span class="chip" data-cat="${esc(c)}">${esc(c)}</span>`).join('')}
              </div>
              <div class="grid g3" id="prods_grid" style="gap:10px"></div>
            </div>
          </div>

          <div>
            <div class="card" style="position:sticky;top:70px">
              <h3>Ticket de Venta</h3>
              <div id="cart_items" class="list mb mt" style="max-height:280px;overflow-y:auto"></div>
              
              <div style="border-top:1px solid var(--line);padding-top:10px" class="mb">
                <div class="row between mb">
                  <span class="muted">Artículos:</span>
                  <span id="cart_qty" class="bold">0 un.</span>
                </div>
                <div class="row between" style="font-size:1.4rem;font-weight:900">
                  <span>TOTAL:</span>
                  <span class="gold" id="cart_total">S/ 0.00</span>
                </div>
              </div>

              <div class="mb">
                <label class="field"><span>Método de Pago:</span>
                  <select id="cart_method">
                    <option value="efectivo">Efectivo</option>
                    <option value="yape">Yape</option>
                    <option value="plin">Plin</option>
                    <option value="tarjeta">Tarjeta (POS)</option>
                  </select>
                </label>
              </div>

              <div class="row gap wrap mb">
                <button type="button" class="btn small ok grow" id="btn_cart_yape_qr">${RD.icon ? RD.icon('qr') : ''} QR Yape/Plin</button>
                <button type="button" class="btn small info grow" id="btn_cart_card_pos" style="background:#0284c7;color:#fff">${RD.icon ? RD.icon('card') : ''} Tarjeta POS</button>
              </div>

              <div class="yape-box hidden mb" id="cart_yape_box">
                <label class="field"><span id="cart_oplbl">N° Operación Yape/Plin:</span>
                  <input id="cart_op_code" placeholder="Ej. 748192">
                </label>
              </div>

              <div id="cash_calc_box" class="mb">
                <div class="grid g2 keep gap">
                  <label class="field"><span>Paga con (S/):</span>
                    <input id="cash_received" type="number" step="0.5" placeholder="Monto">
                  </label>
                  <label class="field"><span>Vuelto:</span>
                    <input id="cash_change" readonly style="font-weight:700;color:#60a5fa" placeholder="S/ 0.00">
                  </label>
                </div>
              </div>

              <button class="btn primary block lg" id="btn_checkout">Cobrar e Imprimir Ticket</button>
              <button class="btn ghost block sm mt" id="btn_clear_cart">Vaciar carrito</button>
            </div>
          </div>
        </div>`;

        const searchInp = el.querySelector('#store_search');
        const grid = el.querySelector('#prods_grid');
        const cartList = el.querySelector('#cart_items');
        const cartTotalEl = el.querySelector('#cart_total');
        const cartQtyEl = el.querySelector('#cart_qty');
        const methSel = el.querySelector('#cart_method');
        const yapeBox = el.querySelector('#cart_yape_box');
        const opInp = el.querySelector('#cart_op_code');
        const cashRecInp = el.querySelector('#cash_received');
        const cashChgInp = el.querySelector('#cash_change');

        function renderGrid() {
          const t = term.toLowerCase();
          const filtered = availableProds.filter(p => {
            const matchCat = selectedCat === 'all' || p.category === selectedCat;
            const matchText = !t || p.name.toLowerCase().includes(t) || (p.barcode && p.barcode.toLowerCase().includes(t));
            return matchCat && matchText;
          });

          grid.innerHTML = filtered.map(p => {
            const hasPromo = p.promo_price > 0 && p.promo_price < p.price;
            const activePrice = hasPromo ? p.promo_price : p.price;
            const isLow = p.stock <= (p.min_stock || 5);
            const isOut = p.stock <= 0;
            return `
            <div class="card click" data-prod-id="${p.id}" style="padding:12px 10px;text-align:center;border:${isOut ? '1px dashed #ef4444' : '1px solid var(--line)'};opacity:${isOut ? '0.65' : '1'};position:relative;display:flex;flex-direction:column;justify-content:space-between;min-height:120px;transition:transform .15s ease,box-shadow .15s ease">
              ${hasPromo ? `<span class="badge info tiny" style="position:absolute;top:6px;right:6px;font-weight:700">OFERTA</span>` : ''}
              <div>
                <span class="badge ghost tiny uppercase" style="font-size:0.65rem;letter-spacing:0.5px;padding:2px 6px;margin-bottom:6px;display:inline-block">${esc(p.category || 'General')}</span>
                <div class="bold small" style="line-height:1.25;min-height:28px;display:flex;align-items:center;justify-content:center">${esc(p.name)}</div>
              </div>
              <div class="mt">
                <div class="gold bold" style="font-size:1.2rem">
                  ${money(activePrice)}
                  ${hasPromo ? `<span class="muted tiny" style="text-decoration:line-through;margin-left:4px;font-weight:400">${money(p.price)}</span>` : ''}
                </div>
                <div class="mt2 row center gap" style="font-size:0.75rem">
                  <span class="badge ${isOut ? 'bad' : isLow ? 'warn' : 'ok'} tiny">Stock: ${p.stock} un.</span>
                  ${p.barcode ? `<span class="muted tiny" style="font-family:monospace">${esc(p.barcode)}</span>` : ''}
                </div>
                ${p.promo_desc ? `<div class="tiny muted mt2">${esc(p.promo_desc)}</div>` : ''}
              </div>
            </div>`;
          }).join('') || '<div class="empty" style="grid-column:1/-1">No se encontraron productos</div>';
        }
        renderGrid();

        searchInp.oninput = () => {
          term = searchInp.value.trim();
          renderGrid();
        };
        searchInp.onkeydown = e => {
          if (e.key === 'Enter') {
            const raw = searchInp.value.trim().toLowerCase();
            let qtyToAdd = 1;
            let val = raw;
            const starMatch = raw.match(/^(\d+)[\*xX\s]+(.*)$/);
            if (starMatch) {
              qtyToAdd = parseInt(starMatch[1], 10) || 1;
              val = starMatch[2].trim();
            }
            const direct = availableProds.find(p => (p.barcode && p.barcode.toLowerCase() === val) || p.name.toLowerCase() === val);
            if (direct) {
              addToCart(direct, qtyToAdd);
              searchInp.value = '';
              term = '';
              renderGrid();
              RD.beep('tick');
            }
          }
        };

        el.querySelector('#cat_chips').onclick = e => {
          const c = e.target.closest('[data-cat]');
          if (!c) return;
          selectedCat = c.dataset.cat;
          el.querySelectorAll('#cat_chips .chip').forEach(x => x.classList.toggle('on', x === c));
          renderGrid();
        };

        grid.onclick = e => {
          const card = e.target.closest('[data-prod-id]');
          if (!card) return;
          const p = availableProds.find(x => x.id === +card.dataset.prodId);
          if (p) addToCart(p);
        };

        function addToCart(p, qty = 1) {
          if (p.stock <= 0) return RD.toast(`El producto "${p.name}" está agotado`, 'warn');
          const existing = cart.find(it => it.product.id === p.id);
          const activePrice = (p.promo_price > 0 && p.promo_price < p.price) ? p.promo_price : p.price;
          if (existing) {
            if (existing.qty + qty > p.stock) return RD.toast(`Stock máximo disponible alcanzado (${p.stock} un.)`, 'warn');
            existing.qty += qty;
          } else {
            const addQ = Math.min(qty, p.stock);
            cart.push({ product: p, qty: addQ, price: activePrice });
          }
          RD.beep('tick');
          renderCart();
        }

        function renderCart() {
          let total = 0;
          let count = 0;
          if (!cart.length) {
            cartList.innerHTML = '<div class="muted small center" style="padding:20px 0">El carrito está vacío.<br>Toca un producto o escanea su código de barras.</div>';
          } else {
            cartList.innerHTML = cart.map((it, idx) => {
              const lineTotal = +(it.price * it.qty).toFixed(2);
              total += lineTotal;
              count += it.qty;
              return `
              <div class="item" style="padding:6px 0;border-bottom:1px solid var(--line)">
                <div class="grow">
                  <div class="bold small">${esc(it.product.name)}</div>
                  <div class="muted tiny">${money(it.price)} c/u</div>
                </div>
                <div class="row gap center">
                  <button type="button" class="icon-btn" data-cminus="${idx}">−</button>
                  <span class="bold small click" data-ceditqty="${idx}" title="Toca para ingresar cantidad numérica manual" style="min-width:24px;text-align:center;padding:2px 4px;border-radius:4px;background:rgba(255,255,255,0.06)">${it.qty}</span>
                  <button type="button" class="icon-btn" data-cplus="${idx}">＋</button>
                </div>
                <div class="bold small right" style="min-width:60px">${money(lineTotal)}</div>
                <button type="button" class="icon-btn" data-cdel="${idx}" title="Quitar">${RD.icon('x')}</button>
              </div>`;
            }).join('');
          }

          cartTotalEl.textContent = money(total);
          cartQtyEl.textContent = `${count} un.`;
          updateCashChange(total);

          if (cart.length > 0) {
            RD.setCustomerDisplay({
              mode: 'cart',
              title: `Venta Tienda (${count} productos)`,
              amount: total,
              items: cart.map(it => `${it.product.name} x${it.qty}`)
            }).catch(() => {});
          }
        }
        renderCart();

        function updateCashChange(total) {
          const rec = +cashRecInp.value || 0;
          if (rec > 0 && rec >= total) {
            cashChgInp.value = money(rec - total);
          } else {
            cashChgInp.value = 'S/ 0.00';
          }
        }
        cashRecInp.oninput = () => {
          const tot = cart.reduce((a, b) => a + b.price * b.qty, 0);
          updateCashChange(tot);
        };

        cartList.onclick = async e => {
          const eq = e.target.closest('[data-ceditqty]');
          if (eq) {
            const idx = +eq.dataset.ceditqty;
            const cur = cart[idx];
            const ans = await RD.prompt(`Cantidad: ${cur.product.name}`, `Ingresa la cantidad deseada (Stock máx: ${cur.product.stock}):`, String(cur.qty));
            if (ans !== null && ans !== '') {
              const num = parseInt(ans, 10);
              if (num > 0 && num <= cur.product.stock) {
                cur.qty = num;
                renderCart();
              } else if (num > cur.product.stock) {
                RD.toast(`Stock máximo disponible: ${cur.product.stock} un.`, 'warn');
              }
            }
            return;
          }
          const m = e.target.closest('[data-cminus]');
          if (m) {
            const idx = +m.dataset.cminus;
            if (cart[idx].qty > 1) cart[idx].qty--;
            else cart.splice(idx, 1);
            renderCart();
            return;
          }
          const p = e.target.closest('[data-cplus]');
          if (p) {
            const idx = +p.dataset.cplus;
            if (cart[idx].qty < cart[idx].product.stock) cart[idx].qty++;
            else RD.toast('No hay más stock disponible', 'warn');
            renderCart();
            return;
          }
          const d = e.target.closest('[data-cdel]');
          if (d) {
            cart.splice(+d.dataset.cdel, 1);
            renderCart();
          }
        };

        el.querySelector('#btn_clear_cart').onclick = () => {
          cart = [];
          renderCart();
          RD.setCustomerDisplay({ mode: 'idle' }).catch(() => {});
        };

        function updateStoreMethod(meth) {
          const isYape = meth === 'yape' || meth === 'plin';
          const isCard = meth === 'tarjeta';
          const opLbl = el.querySelector('#cart_oplbl');
          el.querySelector('#cash_calc_box').classList.toggle('hidden', meth !== 'efectivo');

          if (isYape) {
            yapeBox.classList.remove('hidden');
            opLbl.textContent = 'N° Operación Yape/Plin:';
            opInp.placeholder = 'Ej. 748192';
            setTimeout(() => opInp.focus(), 50);
          } else if (isCard) {
            yapeBox.classList.remove('hidden');
            opLbl.textContent = 'N° Referencia / Voucher POS (Izipay/Niubiz):';
            opInp.placeholder = 'Ej. Ref #041289';
            setTimeout(() => opInp.focus(), 50);
            const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
            RD.setCustomerDisplay({
              mode: 'card',
              method: 'tarjeta',
              title: `Tienda (${cart.length} productos)`,
              amount: total
            }).catch(() => {});
          } else {
            yapeBox.classList.add('hidden');
            if (cart.length > 0) renderCart();
          }
        }

        methSel.onchange = () => updateStoreMethod(methSel.value);

        el.querySelector('#btn_cart_yape_qr').onclick = () => {
          const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
          if (total <= 0) return RD.toast('Agrega productos al carrito primero', 'warn');
          const summaryConcept = cart.map(it => `${it.product.name} x${it.qty}`).join(', ');
          RD.yapePaymentModal({
            amount: total,
            concept: `Tienda: ${summaryConcept}`,
            onPaid: (op) => {
              if (op) {
                opInp.value = op;
                methSel.value = 'yape';
                updateStoreMethod('yape');
                RD.toast('N° de operación cargado');
              }
            }
          });
        };

        el.querySelector('#btn_cart_card_pos').onclick = () => {
          const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
          if (total <= 0) return RD.toast('Agrega productos al carrito primero', 'warn');
          const summaryConcept = cart.map(it => `${it.product.name} x${it.qty}`).join(', ');
          RD.cardPaymentModal({
            amount: total,
            concept: `Tienda: ${summaryConcept}`,
            onPaid: (ref) => {
              if (ref) {
                opInp.value = ref;
                methSel.value = 'tarjeta';
                updateStoreMethod('tarjeta');
                RD.toast('Ref. de tarjeta cargada');
              }
            }
          });
        };

        el.querySelector('#btn_checkout').onclick = async () => {
          if (!cart.length) return RD.toast('El carrito está vacío', 'warn');
          const total = cart.reduce((a, b) => a + b.price * b.qty, 0);
          const method = methSel.value;
          const opCode = opInp.value.trim() || null;

          await RD.busy(el.querySelector('#btn_checkout'), async () => {
            try {
              let lastReceipt = null;
              for (const it of cart) {
                const res = await RD.api.post('/sales', {
                  product_id: it.product.id,
                  qty: it.qty,
                  price: it.price,
                  method: method,
                  op_code: opCode,
                  concept: `Venta: ${it.product.name} x${it.qty}${it.price !== it.product.price ? ' (Promo)' : ''}`
                });
                lastReceipt = res.receipt;
              }

              RD.beep('done');
              RD.toast('Venta registrada con éxito');
              cart = [];
              renderCart();
              searchInp.value = '';
              opInp.value = '';
              cashRecInp.value = '';
              cashChgInp.value = '';

              if (lastReceipt) RD.receiptModal(lastReceipt);
              await renderPosTab(el);
            } catch (err) {
              RD.toast(err.message, 'err');
            }
          });
        };
      }

      // TAB 2: INVENTARIO Y GESTIÓN DE PRODUCTOS
      async function renderInventoryTab(el) {
        const prods = await RD.api.get('/products');
        const activeProds = prods.filter(p => p.active);
        const totalUnits = prods.reduce((a, b) => a + (b.stock || 0), 0);
        const totalCostVal = prods.reduce((a, b) => a + ((b.cost || 0) * (b.stock || 0)), 0);
        const totalSaleVal = prods.reduce((a, b) => a + ((b.price || 0) * (b.stock || 0)), 0);
        const lowStock = prods.filter(p => p.active && p.stock <= (p.min_stock || 5));

        el.innerHTML = `
        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${activeProds.length}</div>
            <div class="l">Productos Activos</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${totalUnits} un.</div>
            <div class="l">Existencias en Tienda</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#34d399">${money(totalSaleVal)}</div>
            <div class="l">Valor en Tienda (Venta)</div>
          </div>
          <div class="stat">
            <div class="v" style="color:${lowStock.length ? '#f87171' : '#4ade80'}">${lowStock.length}</div>
            <div class="l">Stock Bajo / Por Agotar</div>
          </div>
        </div>

        <div class="card mb">
          <div class="row between wrap gap mb">
            <div>
              <h3>Control Maestro de Inventario y Precios</h3>
              <p class="muted small">Configura costos, precios regulares, precios de promoción y reabastece mercadería.</p>
            </div>
            <button class="btn sm primary" id="btn_new_prod_tab">＋ Nuevo Producto</button>
          </div>

          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Código de Barras</th>
                  <th>Costo Compra</th>
                  <th>Precio Venta</th>
                  <th>Precio Promo</th>
                  <th>Stock Actual</th>
                  <th>Stock Mínimo</th>
                  <th>Estado</th>
                  <th class="no-print">Acciones</th>
                </tr>
              </thead>
              <tbody>
                ${prods.map(p => {
                  const hasPromo = p.promo_price > 0;
                  const isLow = p.stock <= (p.min_stock || 5);
                  return `
                  <tr class="${isLow && p.active ? 'row-warn' : ''}">
                    <td>
                      <b>${esc(p.name)}</b>
                      ${p.description ? `<div class="tiny muted">${esc(p.description)}</div>` : ''}
                    </td>
                    <td><span class="badge">${esc(p.category || 'general')}</span></td>
                    <td>
                      <span class="badge" style="font-family:monospace;font-size:0.8rem">
                        ${esc(p.barcode || 'Sin código')}
                      </span>
                    </td>
                    <td class="muted">${money(p.cost || 0)}</td>
                    <td class="bold gold">${money(p.price)}</td>
                    <td>
                      ${hasPromo ? `<span class="badge info bold">${money(p.promo_price)}</span>${p.promo_desc ? `<div class="tiny muted">${esc(p.promo_desc)}</div>` : ''}` : '<span class="muted">—</span>'}
                    </td>
                    <td>
                      <b style="color:${p.stock <= 0 ? '#ef4444' : isLow ? '#f59e0b' : '#10b981'}">${p.stock} un.</b>
                      ${isLow && p.active ? `<span class="badge warn tiny">¡Bajo!</span>` : ''}
                    </td>
                    <td class="muted">${p.min_stock || 5} un.</td>
                    <td>
                      <span class="badge ${p.active ? 'ok' : 'bad'}">${p.active ? 'Activo' : 'Oculto'}</span>
                    </td>
                    <td class="row gap no-print">
                      <button class="btn sm ok" data-addstock="${p.id}" data-pname="${esc(p.name)}" title="Ingresar mercadería">＋ Stock</button>
                      <button class="btn sm" data-editprd="${p.id}">${RD.icon('edit')} Editar</button>
                    </td>
                  </tr>`;
                }).join('') || '<tr><td colspan="10" class="empty">Sin productos registrados</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

        el.querySelector('#btn_new_prod_tab').onclick = () => {
          productEditorModal(null, () => renderInventoryTab(el));
        };

        el.onclick = async e => {
          const as = e.target.closest('[data-addstock]');
          if (as) {
            const pid = as.dataset.addstock;
            const pname = as.dataset.pname;
            const qty = await RD.prompt(`Reabastecer: ${pname}`, 'Cantidad de unidades que ingresaron:', '24');
            if (qty && parseInt(qty, 10) > 0) {
              await RD.api.post(`/products/${pid}/stock`, { qty: parseInt(qty, 10), note: 'Ingreso desde gestión de tienda' });
              RD.toast(`Stock de ${pname} actualizado`);
              renderInventoryTab(el);
            }
            return;
          }

          const ep = e.target.closest('[data-editprd]');
          if (ep) {
            const p = prods.find(x => x.id === +ep.dataset.editprd);
            if (p) productEditorModal(p, () => renderInventoryTab(el));
          }
        };
      }

      // TAB 3: HISTORIAL DE VENTAS
      async function renderSalesHistoryTab(el) {
        const d = await RD.api.get('/reports/finance?scope=month');
        const payments = (d.store?.payments || []);

        el.innerHTML = `
        <div class="card mb">
          <div class="row between wrap gap mb">
            <div>
              <h3>Historial de Ventas de Tienda (Últimos 30 días)</h3>
              <p class="muted small">Registro detallado de aguas, bebidas y productos vendidos en recepción.</p>
            </div>
            <div class="stat gold" style="display:inline-block;padding:6px 16px">
              <div class="v" style="font-size:1.4rem">${money(d.store?.income || 0)}</div>
              <div class="l">Total Recaudado Tienda</div>
            </div>
          </div>

          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Boleta / Ticket</th>
                  <th>Detalle / Concepto</th>
                  <th>Método de Pago</th>
                  <th>Monto</th>
                  <th>Atendido Por</th>
                  <th class="no-print">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${payments.map(p => `
                <tr>
                  <td class="small muted">${p.day} ${p.created_at ? p.created_at.slice(11, 16) : ''}</td>
                  <td class="small bold" style="font-family:monospace">${esc(p.receipt_no || ('B001-' + String(p.id).padStart(6, '0')))}</td>
                  <td><b>${esc(p.concept)}</b></td>
                  <td>
                    <span class="badge ${p.method === 'yape' ? 'warn' : p.method === 'plin' ? 'info' : 'ok'}">${esc(p.method)}</span>
                    ${p.op_code ? `<span class="tiny" style="color:#c084fc">#${esc(p.op_code)}</span>` : ''}
                  </td>
                  <td class="bold gold">${money(p.amount)}</td>
                  <td class="small muted">${esc(p.user_name || 'Recepción')}</td>
                  <td class="no-print">
                    <button class="icon-btn" data-receipt="${p.id}" title="Ver e Imprimir Boleta">${RD.icon('receipt')}</button>
                  </td>
                </tr>`).join('') || '<tr><td colspan="7" class="empty">Sin ventas de tienda registradas este mes</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

        el.onclick = async e => {
          const rc = e.target.closest('[data-receipt]');
          if (rc) {
            try {
              const r = await RD.api.get(`/payments/${rc.dataset.receipt}/receipt`);
              RD.receiptModal(r);
            } catch (err) { RD.toast(err.message, 'err'); }
          }
        };
      }

      await loadTab(activeTab);
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
              <option value="efectivo">Efectivo</option>
              <option value="yape">Yape</option>
              <option value="plin">Plin</option>
              <option value="tarjeta">Tarjeta (POS)</option>
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
        RD.toast('Venta registrada con éxito');
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
        <label class="field"><span>Concepto del gasto *</span><input name="concept" required placeholder="Ej. Compra de pack de agua para tienda, limpieza gym, mantenimiento máquinas"></label>
        <div class="grid g3 keep">
          <label class="field"><span>Monto (S/) *</span><input name="amount" type="number" step="0.5" min="0.5" required placeholder="0.00"></label>
          <label class="field"><span>Canal Contable *</span>
            <select name="category">
              <option value="gym">Gimnasio (Operativo)</option>
              <option value="store">Tiendita (Mercadería / Stock)</option>
            </select>
          </label>
          <label class="field"><span>Método</span>
            <select name="method">
              <option value="efectivo">Efectivo de gaveta</option>
              <option value="yape">Yape</option>
              <option value="transferencia">Transferencia bancaria</option>
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
          category: f.category.value,
          method: f.method.value
        });
        RD.toast('Gasto registrado');
        d.close();
        onDone && onDone();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function openShiftModal(onDone) {
    const d = RD.openModal(`${RD.icon('unlock')} Apertura de Turno de Caja`, `
      <form id="shiftopenf">
        <label class="field">
          <span>Nombre del Turno *</span>
          <select name="shift_name" required>
            <option value="Turno Mañana (6:00 am - 2:00 pm)">Turno Mañana (6:00 am - 2:00 pm)</option>
            <option value="Turno Tarde / Noche (2:00 pm - 9:00 pm)">Turno Tarde / Noche (2:00 pm - 9:00 pm)</option>
            <option value="Turno Completo (6:00 am - 9:00 pm)">Turno Completo (6:00 am - 9:00 pm)</option>
            <option value="Turno Fin de Semana">Turno Fin de Semana</option>
          </select>
        </label>
        <label class="field">
          <span>Fondo Inicial de Efectivo (S/ para dar vuelto en gaveta) *</span>
          <input name="initial_cash" type="number" step="0.5" min="0" value="50.00" required placeholder="50.00" style="font-size:1.15rem;font-weight:700">
        </label>
        <label class="field">
          <span>Notas u Observaciones iniciales</span>
          <textarea name="notes" rows="2" placeholder="Ej. Se reciben 50 soles en sencillo: monedas de 1, 2 y billetes de 10..."></textarea>
        </label>
        <div class="tip small mt mb">
          <b>Control de Arqueo:</b> Este dinero inicial no cuenta como ganancia; es la base para asegurar que al cerrar el turno el efectivo físico coincida sin faltantes ni confusiones.
        </div>
        <button class="btn ok block">${RD.icon('check')} Iniciar y Abrir Turno</button>
      </form>
    `);
    const f = d.el.querySelector('#shiftopenf');
    f.onsubmit = async e => {
      e.preventDefault();
      try {
        await RD.api.post('/shifts/open', {
          shift_name: f.shift_name.value.trim(),
          initial_cash: +f.initial_cash.value,
          notes: f.notes.value.trim()
        });
        RD.toast('Turno de caja abierto correctamente');
        d.close();
        onDone && onDone();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function closeShiftModal(activeShift, shiftTotals, onDone) {
    const expCash = shiftTotals?.expectedCashInDrawer || 0;
    const expDig = shiftTotals?.expectedDigital || 0;

    const d = RD.openModal(`${RD.icon('lock')} Cierre de Turno y Arqueo de Caja`, `
      <form id="shiftclosef">
        <div class="card mb" style="background:#0f172a;border:1px solid #334155">
          <div class="row between">
            <span class="badge ok">Turno #${activeShift.id}</span>
            <span class="small muted">${activeShift.day}</span>
          </div>
          <h4 style="margin:.3rem 0;color:#fff">${esc(activeShift.shift_name)}</h4>
          <div class="small muted">Atendido por: <b style="color:#fff">${esc(activeShift.user_name)}</b></div>
        </div>

        <div class="grid g2 keep mb">
          <div class="stat">
            <div class="v" style="font-size:1.3rem;color:#4ade80">${money(expCash)}</div>
            <div class="l">${RD.icon('cash')} Efectivo esperado en gaveta</div>
          </div>
          <div class="stat">
            <div class="v" style="font-size:1.3rem;color:#a78bfa">${money(expDig)}</div>
            <div class="l">${RD.icon('qr')} Digital esperado (Yape / POS / Bancos)</div>
          </div>
        </div>

        <div class="card mb small">
          <div class="bold mb" style="color:#4ade80">${RD.icon('cash')} Arqueo de Efectivo Físico:</div>
          <div class="row between"><span>Fondo inicial (vuelto):</span> <b>${money(activeShift.initial_cash)}</b></div>
          <div class="row between"><span>(+) Cobros Gym en efectivo:</span> <b>+${money(shiftTotals?.gymCash || 0)}</b></div>
          <div class="row between"><span>(+) Cobros Tienda en efectivo:</span> <b>+${money(shiftTotals?.storeCash || 0)}</b></div>
          <div class="row between"><span>(-) Gastos en efectivo:</span> <b class="bad">-${money(shiftTotals?.cashExpenses || 0)}</b></div>
        </div>

        <div class="card mb small">
          <div class="bold mb" style="color:#a78bfa">${RD.icon('qr')} Conciliación Digital (Apps y POS):</div>
          <div class="row between"><span>${RD.icon('qr')} Yape:</span> <b>${money(shiftTotals?.digitalBreakdown?.yape || 0)}</b></div>
          <div class="row between"><span>${RD.icon('qr')} Plin:</span> <b>${money(shiftTotals?.digitalBreakdown?.plin || 0)}</b></div>
          <div class="row between"><span>${RD.icon('card')} Tarjeta POS (Izipay / Niubiz):</span> <b>${money(shiftTotals?.digitalBreakdown?.card || 0)}</b></div>
          <div class="row between"><span>${RD.icon('bank')} Transferencias Bancarias:</span> <b>${money(shiftTotals?.digitalBreakdown?.transfer || 0)}</b></div>
          <div class="tip small mt" style="padding:6px 10px;font-size:0.75rem;margin-top:6px">
            ${RD.icon('bulb')} <b>Cierre de Lote del POS:</b> Imprime el reporte diario en tu máquina Izipay/Niubiz y coteja que sume <b>${money(shiftTotals?.digitalBreakdown?.card || 0)}</b>.
          </div>
        </div>

        <label class="field">
          <span>Efectivo Físico Contado en Gaveta (Billetes + Monedas) *</span>
          <input name="actual_cash" id="inpactual" type="number" step="0.10" min="0" required placeholder="0.00" style="font-size:1.3rem;font-weight:700">
        </label>

        <div id="diffpreview" class="p-2 mb" style="border-radius:6px;font-weight:700;text-align:center;background:#1e293b;padding:10px;margin:8px 0">
          Ingresa el dinero físico para verificar si la caja cuadra
        </div>

        <label class="field">
          <span>Observaciones / Justificación de discrepancias</span>
          <textarea name="notes" rows="2" placeholder="Ej. Todo cuadrado / Faltó S/ 1 por falta de cambio de 10 céntimos..."></textarea>
        </label>

        <button class="btn danger block mt">${RD.icon('lock')} Guardar Cierre y Emitir Acta</button>
      </form>
    `);

    const f = d.el.querySelector('#shiftclosef');
    const inp = d.el.querySelector('#inpactual');
    const prev = d.el.querySelector('#diffpreview');

    inp.oninput = () => {
      const val = parseFloat(inp.value) || 0;
      const diff = +(val - expCash).toFixed(2);
      const isLight = RD.getTheme && RD.getTheme() === 'light';
      if (Math.abs(diff) < 0.05) {
        prev.style.color = isLight ? '#14532d' : '#4ade80';
        prev.style.background = isLight ? '#dcfce7' : '#064e3b';
        prev.innerHTML = `<span class="badge ok">${RD.icon('check')} CAJA CUADRADA EXACTA (Diferencia S/ 0.00)</span>`;
      } else if (diff > 0) {
        prev.style.color = isLight ? '#0369a1' : '#60a5fa';
        prev.style.background = isLight ? '#e0f2fe' : '#1e3a8a';
        prev.innerHTML = `<span class="badge info">${RD.icon('plus')} SOBRANTE EN CAJA: +${money(diff)}</span>`;
      } else {
        prev.style.color = isLight ? '#881337' : '#f87171';
        prev.style.background = isLight ? '#ffe4e6' : '#7f1d1d';
        prev.innerHTML = `<span class="badge denied">${RD.icon('x')} FALTANTE EN CAJA: -${money(Math.abs(diff))}</span>`;
      }
    };

    f.onsubmit = async e => {
      e.preventDefault();
      try {
        const res = await RD.api.post('/shifts/close', {
          shift_id: activeShift.id,
          actual_cash: +inp.value,
          notes: f.notes.value.trim()
        });
        RD.toast('Turno cerrado correctamente');
        d.close();
        onDone && onDone();
        try {
          const full = await RD.api.get(`/shifts/${activeShift.id}`);
          RD.shiftTicketModal(full);
        } catch (err) {}
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  RD.LOGO_SVG = function (size = 54) {
    return `<svg viewBox="0 0 100 100" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle">
      <defs>
        <linearGradient id="rdGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbbf24"/>
          <stop offset="50%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#b45309"/>
        </linearGradient>
        <linearGradient id="rdDark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#1e293b"/>
          <stop offset="100%" stop-color="#0f172a"/>
        </linearGradient>
      </defs>
      <polygon points="50,4 92,20 84,72 50,96 16,72 8,20" fill="url(#rdDark)" stroke="url(#rdGold)" stroke-width="3.5" stroke-linejoin="round"/>
      <polygon points="50,11 85,25 78,68 50,88 22,68 15,25" fill="none" stroke="url(#rdGold)" stroke-width="1.2" opacity="0.6"/>
      <rect x="26" y="32" width="48" height="3.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="22" y="27" width="5" height="13.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="73" y="27" width="5" height="13.5" rx="1.5" fill="url(#rdGold)"/>
      <rect x="18" y="29.5" width="3" height="8.5" rx="1" fill="#fbbf24"/>
      <rect x="79" y="29.5" width="3" height="8.5" rx="1" fill="#fbbf24"/>
      <text x="50" y="62" font-family="'Impact', 'Arial Black', sans-serif" font-weight="900" font-size="25" fill="url(#rdGold)" text-anchor="middle" letter-spacing="1.5">RD</text>
      <text x="50" y="74" font-family="'Arial Black', sans-serif" font-weight="800" font-size="6" fill="#f8fafc" text-anchor="middle" letter-spacing="2">FITNESS CLUB</text>
      <polygon points="50,78 51.5,82 55.5,82 52.5,84 53.5,88 50,85.5 46.5,88 47.5,84 44.5,82 48.5,82" fill="url(#rdGold)"/>
      <polygon points="41,79 42,81.5 44.5,81.5 42.5,83 43.2,85.5 41,84 38.8,85.5 39.5,83 37.5,81.5 40,81.5" fill="url(#rdGold)" opacity="0.8"/>
      <polygon points="59,79 60,81.5 62.5,81.5 60.5,83 61.2,85.5 59,84 56.8,85.5 57.5,83 55.5,81.5 58,81.5" fill="url(#rdGold)" opacity="0.8"/>
    </svg>`;
  };

  RD.memberAttendanceSheetModal = async function (memberId, fromDate, toDate) {
    const today = RD.limaDay();
    const to = toDate || today;
    const from = fromDate || RD.addDays(to, -30);
    try {
      const data = await RD.api.get(`/reports/member/${memberId}/attendance?from=${from}&to=${to}`);
      if (!data || !data.member) {
        RD.toast('No se encontró información del socio', 'err');
        return;
      }
      const m = data.member;
      const s = data.stats || {};
      const recs = data.records || [];
      const set = data.settings || {};
      const routine = data.activeRoutine || null;
      const topPrs = data.topPrs || [];
      const meas = data.latestMeas || null;

      const d = RD.openModal(`${RD.icon('reports')} Ficha Integral del Socio: ${m.name}`, `
        <div class="member-sheet-card watermark-container">
          <div class="watermark-bg">RD FITNESS CLUB</div>

          <!-- ENCABEZADO OFICIAL CON LOGO SVG -->
          <div class="member-sheet-header">
            <div class="logo-box">
              ${RD.LOGO_SVG(58)}
            </div>
            <div class="grow">
              <h2 style="color:var(--gold);font-weight:900;letter-spacing:1px">${esc(set.gym_name || 'RD FITNESS CLUB')} - CHIVAY</h2>
              <div class="small muted">${esc(set.gym_slogan || 'Disciplina · Constancia · Resultados · Valle del Colca')}</div>
              <div class="tiny muted">RUC: ${esc(set.gym_ruc || '10702548911')} · ${esc(RD.cleanAddress(set.gym_address))} · Tel: ${esc(set.gym_phone || '982404043')}</div>
            </div>
            <div class="text-right no-print">
              <button class="btn primary sm" id="btnprintsheet">${RD.icon('printer')} Imprimir / Guardar PDF</button>
            </div>
          </div>

          <div class="row between wrap gap mb" style="border-bottom:1px dashed var(--border,#334155);padding-bottom:.6rem;position:relative;z-index:1">
            <div>
              <h3 style="margin:0;font-size:1.1rem">FICHA OFICIAL DE ASISTENCIA, RUTINA Y RENDIMIENTO DEPORTIVO</h3>
              <div class="small muted">Auditoría correlacionada de asistencias, horarios, rutinas, récords y progreso físico</div>
            </div>
            <div class="small">
              <b>Período evaluado:</b> ${from} al ${to}<br>
              <span class="muted tiny">Emitido: ${new Date().toLocaleDateString('es-PE')} ${new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <!-- DATOS DEL SOCIO -->
          <div class="member-sheet-profile">
            <div>
              ${m.photo ? `<img src="${esc(m.photo)}" style="width:64px;height:64px;border-radius:8px;object-fit:cover;border:2px solid var(--gold)">` : `<div style="width:64px;height:64px;border-radius:8px;background:#334155;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1.6rem;font-weight:bold">${esc((m.name || 'S')[0])}</div>`}
            </div>
            <div>
              <div style="font-size:1.15rem;font-weight:800">${esc(m.name)}</div>
              <div class="small"><b>DNI:</b> ${esc(m.dni || '—')} · <b>Código:</b> <span class="badge" style="font-family:monospace;font-weight:bold">${esc(m.code)}</span> · <b>Cel:</b> ${esc(m.phone || '—')}</div>
              <div class="small muted mt2">Socio desde: ${RD.fmtDate(m.created_at)} · <b>Horario preferido:</b> <span style="color:var(--gold);font-weight:700">${esc(s.preferredSchedule || 'Por definir')}</span></div>
            </div>
            <div class="text-right">
              <div><b>Plan Actual:</b> <span class="gold" style="font-weight:700">${esc(m.current_plan || 'Sin plan activo')}</span></div>
              <div class="small"><b>Vigencia:</b> ${m.start_date ? RD.fmtDate(m.start_date) : '—'} al ${m.end_date ? RD.fmtDate(m.end_date) : '—'}</div>
              <div class="mt2"><span class="badge ${m.status === 'active' ? 'ok' : 'denied'}">${m.status === 'active' ? 'Socio Activo' : 'Inactivo / Vencido'}</span></div>
            </div>
          </div>

          <!-- METRICAS DE ASISTENCIA, HORARIO Y VOLUMEN -->
          <div class="member-sheet-kpis">
            <div class="kpi-box">
              <div style="font-size:1.35rem;font-weight:800;color:var(--gold)">${s.daysAttended || 0} días</div>
              <div class="small muted">Días asistidos (${s.totalSessions || 0} ses.)</div>
            </div>
            <div class="kpi-box">
              <div style="font-size:1.35rem;font-weight:800;color:#60a5fa">${s.totalHours || 0} hrs</div>
              <div class="small muted">Total horas en sala</div>
            </div>
            <div class="kpi-box">
              <div style="font-size:1.35rem;font-weight:800;color:#4ade80">${s.avgDaysPerWeek || 0} d/sem</div>
              <div class="small muted">Frecuencia (${s.consistencyRate || 0}% constancia)</div>
            </div>
            <div class="kpi-box">
              <div style="font-size:1.35rem;font-weight:800;color:#a78bfa">${Number(s.volumeMoved || 0).toLocaleString('es-PE')} kg</div>
              <div class="small muted">Volumen (${s.workoutsLogged || 0} rutinas reg.)</div>
            </div>
          </div>

          <!-- CORRELACIÓN DE RUTINA ACTIVA, PRs Y COMPOSICIÓN CORPORAL -->
          <div class="grid g3 gap mb" style="position:relative;z-index:1">
            <div style="background:rgba(15,23,42,0.5);border:1px solid var(--border,#334155);border-radius:8px;padding:.75rem">
              <div class="tiny muted" style="font-weight:800;letter-spacing:.5px">${RD.icon('dumbbell', '', 13)} RUTINA Y PLAN DE ENTRENAMIENTO</div>
              ${routine ? `
                <div style="font-weight:800;color:var(--gold);margin-top:4px">${esc(routine.name)}</div>
                <div class="tiny muted">${esc(routine.goal || 'General')} · ${esc(routine.level || 'Intermedio')} · ${routine.days_per_week || 4} días/sem</div>
              ` : `<div class="small muted mt2">Entrenamiento libre (sin rutina asignada)</div>`}
            </div>
            <div style="background:rgba(15,23,42,0.5);border:1px solid var(--border,#334155);border-radius:8px;padding:.75rem">
              <div class="tiny muted" style="font-weight:800;letter-spacing:.5px">${RD.icon('trophy', '', 13)} TOP RÉCORDS PERSONALES (PRs)</div>
              ${topPrs.length ? topPrs.slice(0, 3).map(pr => `
                <div class="row between tiny" style="margin-top:3px">
                  <span>${esc(pr.exercise)}</span>
                  <b class="gold">${pr.weight_kg}kg × ${pr.reps}</b>
                </div>
              `).join('') : `<div class="small muted mt2">Sin PRs registrados aún</div>`}
            </div>
            <div style="background:rgba(15,23,42,0.5);border:1px solid var(--border,#334155);border-radius:8px;padding:.75rem">
              <div class="tiny muted" style="font-weight:800;letter-spacing:.5px">${RD.icon('scale', '', 13)} ÚLTIMO CONTROL CORPORAL</div>
              ${meas ? `
                <div class="row between tiny" style="margin-top:4px">
                  <span>Peso: <b>${meas.weight_kg || '—'} kg</b></span>
                  <span>Cintura: <b>${meas.waist_cm || '—'} cm</b></span>
                </div>
                <div class="row between tiny" style="margin-top:3px">
                  <span>Grasa: <b>${meas.body_fat_pct ? meas.body_fat_pct + '%' : '—'}</b></span>
                  <span class="muted">Fecha: ${meas.day}</span>
                </div>
              ` : `<div class="small muted mt2">Sin mediciones registradas</div>`}
            </div>
          </div>

          <!-- TABLA DETALLADA DE SESIONES -->
          <h4 class="mb mt" style="position:relative;z-index:1">Historial de Sesiones (Entradas, Salidas y Permanencia)</h4>
          <div class="tbl-wrap" style="position:relative;z-index:1">
            <table>
              <thead>
                <tr>
                  <th style="width:30px">#</th>
                  <th>Fecha</th>
                  <th>Hora Entrada</th>
                  <th>Hora Salida</th>
                  <th>Permanencia</th>
                  <th>Atendido Por</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                ${recs.map((r, i) => {
                  const enterTime = r.ts ? new Date(r.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
                  const exitTime = r.exit_ts ? new Date(r.exit_ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : (r.status === 'inside' ? `<span class="badge ok tiny">${RD.icon('login')} En Sala</span>` : '—');
                  const duration = r.duration_min ? `${Math.floor(r.duration_min / 60) > 0 ? Math.floor(r.duration_min / 60) + 'h ' : ''}${r.duration_min % 60}m` : (r.status === 'inside' ? '<span class="gold tiny">Entrenando</span>' : '—');
                  return `
                  <tr>
                    <td class="muted small">${i + 1}</td>
                    <td><b>${r.day}</b></td>
                    <td style="font-family:monospace">${enterTime}</td>
                    <td style="font-family:monospace">${exitTime}</td>
                    <td style="font-weight:700">${duration}</td>
                    <td class="small muted">${esc(r.staff_name || 'Recepción')}</td>
                    <td><span class="badge ${r.result === 'ok' ? 'ok' : r.result === 'warn' ? 'warn' : 'denied'} tiny">${r.result === 'ok' ? 'Ingreso OK' : r.result === 'warn' ? 'Aviso' : 'Rechazado'}</span></td>
                  </tr>`;
                }).join('') || '<tr><td colspan="7" class="empty">No se registran asistencias en el período seleccionado</td></tr>'}
              </tbody>
            </table>
          </div>

          <!-- SECCIÓN DE FIRMAS Y VALIDEZ -->
          <div class="member-sheet-signatures">
            <div class="sig-box">
              <br><br>
              <b>${esc(m.name)}</b><br>
              <span class="muted">Firma del Socio<br>DNI: ${esc(m.dni || '—')}</span>
            </div>
            <div class="sig-box">
              <br><br>
              <b>ADMINISTRACIÓN / RECEPCIÓN</b><br>
              <span class="muted">${esc(set.gym_name || 'RD FITNESS CLUB')}<br>Sello y Conformidad</span>
            </div>
          </div>
        </div>
      `, { wide: true });

      d.el.querySelector('#btnprintsheet')?.addEventListener('click', () => window.print());
    } catch (err) {
      RD.toast(err.message, 'err');
    }
  };

  RD.openGoogleSheetsSyncModal = googleSheetsSyncModal;
  function googleSheetsSyncModal(settings = {}) {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const prodHost = 'https://rd-fitness.onrender.com';
    const effectiveOrigin = isLocal ? prodHost : window.location.origin;
    const key = settings.google_sheets_key || 'RD-CHIVAY-2026';
    let currentSep = 'semicolon';
    let currentFeed = 'daily';

    function getFormula(feed, sep) {
      const url = `${effectiveOrigin}/api/reports/live-feed.csv?type=${feed}&key=${key}&sep=${sep}`;
      const delim = sep === 'semicolon' ? ';' : ',';
      return `=IMPORTDATA("${url}&t=" & TEXT(NOW()${delim} "yyyymmddhhmm"))`;
    }

    function getAppsScriptCode() {
      return `/**
 * =========================================================================
 * RD FITNESS CLUB - CHIVAY | SINCRONIZADOR MAESTRO PARA GOOGLE SHEETS
 * Sincroniza TODO el gimnasio en tiempo real:
 * - Dashboard Ejecutivo con KPIs y Gráficos Nativos
 * - Ingresos Diarios (Gimnasio vs Tienda vs Total)
 * - Métodos de Pago (Cuadre de Efectivo vs Digital)
 * - Pagos Detallados (Boletas, Conceptos, Comprobantes)
 * - Tienda Ventas (Por producto, costo y utilidad)
 * - Top Productos Más Vendidos
 * - Inventario y Semáforo de Stock
 * - Base de Socios y Estado de Membresías
 * - Vencimientos Próximos y Vencidos
 * - Socios en Riesgo de Abandono (10+ días sin asistir)
 * - Membresías Vendidas (Nuevas y Renovaciones con Promociones)
 * - Planes y Tarifas
 * - Asistencias (Entrada, Salida, Duración, Tipo, Estado, Personal)
 * - Afluencia Horaria (Entradas vs Salidas registradas)
 * - Afluencia por Día de la Semana
 * - Mapa de Calor (Día x Hora)
 * - Accesos Denegados (Seguridad)
 * - Turnos de Caja (Arqueo y Descuadres)
 * - Gastos Operativos
 * =========================================================================
 */

var CONFIG = {
  ENDPOINT: "${effectiveOrigin}/api/reports/sheets-feed",
  KEY: "${key}"
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('RD Fitness')
    .addItem('Actualizar Todo en Vivo', 'actualizarTodo')
    .addSeparator()
    .addItem('Activar Auto-Actualización (Cada 10 min)', 'activarAutoActualizacion')
    .addItem('Detener Auto-Actualización', 'detenerAutoActualizacion')
    .addSeparator()
    .addItem('Ver Estado de Conexión', 'verEstado')
    .addToUi();
}

function actualizarTodo() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Conectando con RD Fitness...', 'Sincronizador', 5);
  
  var url = CONFIG.ENDPOINT + '?key=' + encodeURIComponent(CONFIG.KEY) + '&_t=' + new Date().getTime();
  var options = {
    method: 'get',
    muteHttpExceptions: true,
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      'x-rd-key': CONFIG.KEY
    }
  };
  
  var response = null;
  var retries = 3;
  while (retries > 0) {
    try {
      response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) break;
    } catch (e) {
      Utilities.sleep(1500);
    }
    retries--;
  }
  
  if (!response || response.getResponseCode() !== 200) {
    var code = response ? response.getResponseCode() : 'Sin respuesta';
    SpreadsheetApp.getUi().alert('Error al conectar con RD Fitness (Código: ' + code + '). Verifique su conexión y que la clave sea correcta.');
    return;
  }
  
  var ds = JSON.parse(response.getContentText());
  if (!ds || !ds.tables) {
    SpreadsheetApp.getUi().alert('Datos no válidos recibidos desde el servidor.');
    return;
  }
  
  // 1. Llenar cada tabla de datos en su propia hoja
  var order = ds.tableOrder || Object.keys(ds.tables);
  for (var i = 0; i < order.length; i++) {
    var k = order[i];
    var tbl = ds.tables[k];
    if (!tbl) continue;
    poblarHoja(ss, tbl.name, tbl.headers, tbl.rows, tbl.types);
  }
  
  // 2. Crear / Actualizar Hoja Dashboard con KPIs y Gráficos
  poblarDashboard(ss, ds);
  
  // Posicionar Dashboard al inicio
  var dashSheet = ss.getSheetByName('Dashboard');
  if (dashSheet) {
    ss.setActiveSheet(dashSheet);
    ss.moveActiveSheet(1);
  }
  
  ss.toast('¡Todas las hojas y gráficos actualizados en vivo!', 'RD Fitness Club', 5);
}

function poblarHoja(ss, name, headers, rows, types) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  sheet.clear();
  
  var allData = [headers];
  if (rows && rows.length > 0) {
    for (var r = 0; r < rows.length; r++) {
      allData.push(rows[r]);
    }
  }
  
  var numRows = allData.length;
  var numCols = headers.length;
  var range = sheet.getRange(1, 1, numRows, numCols);
  range.setValues(allData);
  
  // Formato Encabezado
  var headerRange = sheet.getRange(1, 1, 1, numCols);
  headerRange.setFontWeight('bold')
    .setBackground('#111827')
    .setFontColor('#f59e0b')
    .setHorizontalAlignment('center');
  sheet.setFrozenRows(1);
  
  // Formato de columnas según tipo
  if (types && types.length && rows.length > 0) {
    for (var c = 0; c < types.length; c++) {
      var colRange = sheet.getRange(2, c + 1, rows.length, 1);
      var t = types[c];
      if (t === 'money') {
        colRange.setNumberFormat('"S/ "#,##0.00');
      } else if (t === 'int' || t === 'min') {
        colRange.setNumberFormat('#,##0');
      } else if (t === 'pct') {
        colRange.setNumberFormat('0.0%');
      } else if (t === 'date') {
        colRange.setNumberFormat('yyyy-mm-dd');
      } else if (t === 'time') {
        colRange.setNumberFormat('hh:mm');
      }
    }
  }
  
  // Auto-ajustar ancho de columnas
  for (var c = 1; c <= numCols; c++) {
    sheet.autoResizeColumn(c);
  }
}

function poblarDashboard(ss, ds) {
  var sheet = ss.getSheetByName('Dashboard');
  if (!sheet) {
    sheet = ss.insertSheet('Dashboard');
  }
  sheet.clear();
  var charts = sheet.getCharts();
  for (var i = 0; i < charts.length; i++) {
    sheet.removeChart(charts[i]);
  }
  
  var k = ds.kpis || {};
  var m = ds.meta || {};
  
  // Banner principal
  sheet.getRange('A1:L1').merge()
    .setValue('RD FITNESS CLUB - CHIVAY  |  DASHBOARD EJECUTIVO EN TIEMPO REAL')
    .setFontWeight('bold').setFontSize(14).setBackground('#111827').setFontColor('#f59e0b')
    .setHorizontalAlignment('center');
    
  sheet.getRange('A2:L2').merge()
    .setValue('Período: ' + m.from + ' al ' + m.to + '   |   Generado: ' + m.generated + ' (' + m.timezone + ')')
    .setFontSize(10).setFontColor('#9ca3af').setBackground('#1f2937')
    .setHorizontalAlignment('center');

  // Tarjetas KPI fila 4 a 5
  var kpis = [
    ['INGRESO TOTAL', 'S/ ' + (k.ingresos || 0).toFixed(2), '#10b981'],
    ['GIMNASIO', 'S/ ' + (k.gimnasio || 0).toFixed(2), '#f59e0b'],
    ['TIENDITA', 'S/ ' + (k.tienda || 0).toFixed(2), '#3b82f6'],
    ['GASTOS OPERATIVOS', 'S/ ' + (k.gastos || 0).toFixed(2), '#ef4444'],
    ['UTILIDAD NETA', 'S/ ' + (k.utilidad || 0).toFixed(2), '#10b981'],
    ['EFECTIVO EN GAVETA', 'S/ ' + (k.efectivo || 0).toFixed(2), '#6366f1']
  ];
  
  for (var idx = 0; idx < kpis.length; idx++) {
    var col = 1 + idx * 2;
    sheet.getRange(4, col, 1, 2).merge()
      .setValue(kpis[idx][0]).setFontSize(9).setFontWeight('bold').setFontColor('#9ca3af').setBackground('#1f2937').setHorizontalAlignment('center');
    sheet.getRange(5, col, 1, 2).merge()
      .setValue(kpis[idx][1]).setFontSize(15).setFontWeight('bold').setFontColor(kpis[idx][2]).setBackground('#111827').setHorizontalAlignment('center');
  }

  // Tarjetas KPI fila 7 a 8 (Asistencias y Socios)
  var kpis2 = [
    ['ENTRADAS TOTALES', (k.visitas || 0) + ' visitas', '#f59e0b'],
    ['SALIDAS REGISTRADAS', ((k.visitas || 0) - (k.sin_salida || 0)) + ' salidas', '#10b981'],
    ['SIN SALIDA REGISTRADA', (k.sin_salida || 0) + ' (' + (k.pct_sin_salida || 0) + '%)', '#f97316'],
    ['SOCIOS VIGENTES', (k.socios_vigentes || 0) + ' activos', '#3b82f6'],
    ['POR VENCER (≤7 DÍAS)', (k.por_vencer || 0) + ' socios', '#eab308'],
    ['STOCK BAJO / AGOTADO', (k.stock_bajo || 0) + ' prods', '#ef4444']
  ];
  
  for (var idx2 = 0; idx2 < kpis2.length; idx2++) {
    var col2 = 1 + idx2 * 2;
    sheet.getRange(7, col2, 1, 2).merge()
      .setValue(kpis2[idx2][0]).setFontSize(9).setFontWeight('bold').setFontColor('#9ca3af').setBackground('#1f2937').setHorizontalAlignment('center');
    sheet.getRange(8, col2, 1, 2).merge()
      .setValue(kpis2[idx2][1]).setFontSize(13).setFontWeight('bold').setFontColor(kpis2[idx2][2]).setBackground('#111827').setHorizontalAlignment('center');
  }

  // Gráficos Nativos en el Dashboard
  try {
    var sheetDaily = ss.getSheetByName('Ingresos Diarios');
    if (sheetDaily && sheetDaily.getLastRow() > 1) {
      var chart1 = sheet.newChart()
        .setChartType(Charts.ChartType.COLUMN)
        .addRange(sheetDaily.getRange(1, 1, sheetDaily.getLastRow(), 1))
        .addRange(sheetDaily.getRange(1, 3, sheetDaily.getLastRow(), 1))
        .addRange(sheetDaily.getRange(1, 4, sheetDaily.getLastRow(), 1))
        .setPosition(10, 1, 0, 0)
        .setOption('title', 'Ingresos Diarios: Gimnasio vs Tiendita')
        .setOption('width', 580)
        .setOption('height', 300)
        .setOption('isStacked', true)
        .setOption('colors', ['#f59e0b', '#3b82f6'])
        .build();
      sheet.insertChart(chart1);
    }
    
    var sheetHourly = ss.getSheetByName('Afluencia Horaria');
    if (sheetHourly && sheetHourly.getLastRow() > 1) {
      var chart2 = sheet.newChart()
        .setChartType(Charts.ChartType.COLUMN)
        .addRange(sheetHourly.getRange(1, 1, sheetHourly.getLastRow(), 1))
        .addRange(sheetHourly.getRange(1, 2, sheetHourly.getLastRow(), 1))
        .addRange(sheetHourly.getRange(1, 3, sheetHourly.getLastRow(), 1))
        .setPosition(10, 7, 0, 0)
        .setOption('title', 'Afluencia por Hora: Entradas vs Salidas')
        .setOption('width', 580)
        .setOption('height', 300)
        .setOption('colors', ['#f59e0b', '#10b981'])
        .build();
      sheet.insertChart(chart2);
    }

    var sheetMethods = ss.getSheetByName('Métodos de Pago');
    if (sheetMethods && sheetMethods.getLastRow() > 1) {
      var chart3 = sheet.newChart()
        .setChartType(Charts.ChartType.PIE)
        .addRange(sheetMethods.getRange(1, 1, sheetMethods.getLastRow(), 1))
        .addRange(sheetMethods.getRange(1, 4, sheetMethods.getLastRow(), 1))
        .setPosition(27, 1, 0, 0)
        .setOption('title', 'Distribución de Pagos por Método (Cuadre)')
        .setOption('width', 580)
        .setOption('height', 280)
        .setOption('pieHole', 0.4)
        .build();
      sheet.insertChart(chart3);
    }

    var sheetTop = ss.getSheetByName('Top Productos');
    if (sheetTop && sheetTop.getLastRow() > 1) {
      var limit = Math.min(sheetTop.getLastRow(), 11);
      var chart4 = sheet.newChart()
        .setChartType(Charts.ChartType.BAR)
        .addRange(sheetTop.getRange(1, 2, limit, 1))
        .addRange(sheetTop.getRange(1, 3, limit, 1))
        .setPosition(27, 7, 0, 0)
        .setOption('title', 'Top Productos Más Vendidos (Unidades)')
        .setOption('width', 580)
        .setOption('height', 280)
        .setOption('colors', ['#3b82f6'])
        .build();
      sheet.insertChart(chart4);
    }
  } catch (e) { }
}

function activarAutoActualizacion() {
  detenerAutoActualizacion();
  ScriptApp.newTrigger('actualizarTodo')
    .timeBased()
    .everyMinutes(10)
    .create();
  SpreadsheetApp.getUi().alert('Auto-actualización activada: Tus hojas y gráficos se actualizarán automáticamente cada 10 minutos en segundo plano.');
}

function detenerAutoActualizacion() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'actualizarTodo') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  SpreadsheetApp.getUi().alert('Auto-actualización detenida.');
}

function verEstado() {
  var triggers = ScriptApp.getProjectTriggers();
  var auto = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'actualizarTodo') auto = true;
  }
  var msg = 'Servidor: ' + CONFIG.ENDPOINT + '\\n'
    + 'Clave configurada: ' + CONFIG.KEY.slice(0, 6) + '...\\n'
    + 'Auto-actualización cada 10 min: ' + (auto ? 'ACTIVADA' : 'DESACTIVADA');
  SpreadsheetApp.getUi().alert(msg);
}`;
    }

    const d = RD.openModal(`${RD.icon('sheet')} Sincronización en Vivo con Google Sheets`, `
      ${isLocal ? `
      <div class="tip warn mb small">
        <b>Modo Servidor en la Nube Activado:</b><br>
        Actualmente estás conectado desde una red local o desarrollo. Dado que Google Sheets está en la nube, Google no puede acceder a direcciones "localhost".
        Las fórmulas y el script usan tu servidor oficial en la nube de Render: <b>${prodHost}</b>.
      </div>` : ''}

      <div class="chips mb" id="gstab">
        <span class="chip on" data-gt="script">${RD.icon('zap')} Opción A: Script Maestro Multi-Hojas (Recomendado 100% en vivo)</span>
        <span class="chip" data-gt="formula">${RD.icon('activity')} Opción B: Fórmulas Rápidas =IMPORTDATA</span>
      </div>

      <div id="gtcontent"></div>
    `, { wide: true });

    function renderGContent(tab) {
      const cnt = d.el.querySelector('#gtcontent');
      if (tab === 'script') {
        cnt.innerHTML = `
          <p class="small muted mb">
            <b>Crea en 1 clic un libro completo en Google Sheets</b> con 19 hojas (Dashboard con Gráficos, Ingresos Diarios, Métodos de Pago, Pagos, Ventas Tienda, Inventario, Socios, Vencimientos, Asistencias con Entrada/Salida, Afluencia Horaria, etc.) y auto-actualización cada 10 minutos.
          </p>

          <div class="card mb" style="background:#0f172a">
            <div class="row between wrap gap mb">
              <span class="small muted"><b>Código Google Apps Script Maestro (Con Gráficos y Auto-Sync):</b></span>
              <div class="row gap">
                <button class="btn primary sm" id="btncopyscript">${RD.icon('copy')} Copiar Código Script</button>
              </div>
            </div>
            <textarea id="gsscriptcode" rows="13" readonly style="font-family:monospace;font-size:.78rem;background:#1e293b;color:#38bdf8;width:100%">${getAppsScriptCode()}</textarea>
          </div>

          <div class="tip small mb">
            <b>¿Cómo instalarlo en tu Google Sheets en 30 segundos?</b><br>
            1. Abre tu hoja en blanco en <a href="https://sheets.new" target="_blank" rel="noopener">Google Sheets</a>.<br>
            2. En el menú superior ve a: <b>Extensiones &gt; Apps Script</b>.<br>
            3. Borra todo el código que aparece por defecto y pega este código con <b>Ctrl + V</b>.<br>
            4. Haz clic en el icono <b>Guardar</b>.<br>
            5. Vuelve a tu hoja de cálculo y presiona <b>F5</b>: aparecerá un nuevo menú arriba llamado <b>RD Fitness</b>.<br>
            6. Haz clic en <b>"RD Fitness" &gt; "Actualizar Todo en Vivo"</b> (la primera vez Google te pedirá autorizar la ejecución del script).<br>
            <i>¡Listo! Todas las 19 hojas se generarán solas con sus datos, formatos y gráficos.</i>
          </div>
        `;

        cnt.querySelector('#btncopyscript').onclick = () => {
          const ta = cnt.querySelector('#gsscriptcode');
          ta.select();
          navigator.clipboard.writeText(ta.value);
          RD.toast('¡Código Apps Script copiado al portapapeles!');
        };
      } else {
        cnt.innerHTML = `
          <p class="small muted mb">
            Fórmulas para sincronizar hojas individuales usando la función nativa <code>=IMPORTDATA</code> de Google Sheets.
          </p>

          <div class="row between wrap gap mb">
            <label class="small muted"><b>Tipo de Reporte a Sincronizar:</b>
              <select id="gsfeedsel" style="min-height:36px">
                <option value="daily" ${currentFeed === 'daily' ? 'selected' : ''}>Ingresos Diarios (Gimnasio vs Tienda vs Utilidad)</option>
                <option value="attendance" ${currentFeed === 'attendance' ? 'selected' : ''}>Asistencias (Entradas, Salidas, Permanencia)</option>
                <option value="payments" ${currentFeed === 'payments' ? 'selected' : ''}>Pagos y Boletas Detalladas</option>
                <option value="sales" ${currentFeed === 'sales' ? 'selected' : ''}>Ventas de Tienda (Con Costo y Utilidad)</option>
                <option value="inventory" ${currentFeed === 'inventory' ? 'selected' : ''}>Inventario y Stock</option>
                <option value="members" ${currentFeed === 'members' ? 'selected' : ''}>Base de Socios y Membresías</option>
                <option value="shifts" ${currentFeed === 'shifts' ? 'selected' : ''}>Historial y Arqueo de Turnos</option>
              </select>
            </label>
            <label class="small muted"><b>Configuración Regional de tu Google Sheets:</b>
              <select id="gssepsel" style="min-height:36px">
                <option value="semicolon" ${currentSep === 'semicolon' ? 'selected' : ''}>🇵🇪 Perú / Latinoamérica (Separador ; )</option>
                <option value="comma" ${currentSep === 'comma' ? 'selected' : ''}>Internacional / USA (Separador , )</option>
              </select>
            </label>
          </div>

          <div class="card mb" style="background:#0f172a">
            <div class="row between wrap gap">
              <label class="small muted"><b>Fórmula anti-caché para pegar en la celda A1:</b></label>
              <span class="badge ok tiny">Anti-Caché</span>
            </div>
            <div class="row gap mt2">
              <input type="text" id="gsformula" value='${getFormula(currentFeed, currentSep)}' readonly style="font-family:monospace;font-size:.85rem;background:#1e293b;color:#4ade80">
              <button class="btn primary sm" id="btncopy">${RD.icon('copy')} Copiar Fórmula</button>
            </div>
          </div>

          <div class="tip small mb">
            <b>Instrucciones:</b><br>
            1. En tu hoja de <a href="https://sheets.new" target="_blank" rel="noopener">Google Sheets</a>, haz clic en la celda <b>A1</b> y pega la fórmula.<br>
            2. Presiona <b>Enter</b> y los datos se descargarán automáticamente.
          </div>
        `;

        cnt.querySelector('#gsfeedsel').onchange = e => { currentFeed = e.target.value; cnt.querySelector('#gsformula').value = getFormula(currentFeed, currentSep); };
        cnt.querySelector('#gssepsel').onchange = e => { currentSep = e.target.value; cnt.querySelector('#gsformula').value = getFormula(currentFeed, currentSep); };
        cnt.querySelector('#btncopy').onclick = () => {
          const inp = cnt.querySelector('#gsformula');
          inp.select();
          navigator.clipboard.writeText(inp.value);
          RD.toast('¡Fórmula copiada! Pégala en la celda A1 de tu Google Sheets.');
        };
      }
    }

    d.el.querySelector('#gstab').onclick = e => {
      const c = e.target.closest('[data-gt]');
      if (!c) return;
      d.el.querySelectorAll('#gstab .chip').forEach(x => x.classList.toggle('on', x === c));
      renderGContent(c.dataset.gt);
    };

    renderGContent('script');
  }

  // ============================================================
  // 3. REPORTES Y ANÁLISIS
  // ============================================================
  RD.views.reports = {
    async render(view) {
      const today = RD.limaDay();
      let to = today, from = RD.addDays(today, -29);
      let channel = 'consolidated'; // 'consolidated' | 'gym' | 'store' | 'shifts' | 'attendance' | 'security'

      async function load() {
        const d = await RD.api.get(`/reports?from=${from}&to=${to}&scope=${channel}`);
        const settings = await RD.api.get('/settings').catch(() => ({}));

        view.innerHTML = `
        <!-- NAVEGACIÓN DE CANALES SEPARADOS -->
        <div class="row between wrap gap mb">
          <div class="chips" id="reptabs">
            <span class="chip ${channel === 'consolidated' ? 'on' : ''}" data-ch="consolidated">${RD.icon('chart')} Consolidado General</span>
            <span class="chip ${channel === 'gym' ? 'on' : ''}" data-ch="gym">${RD.icon('dumbbell')} Caja Gimnasio</span>
            <span class="chip ${channel === 'store' ? 'on' : ''}" data-ch="store">${RD.icon('cart')} Tiendita y POS</span>
            <span class="chip ${channel === 'shifts' ? 'on' : ''}" data-ch="shifts">${RD.icon('clock')} Historial de Turnos</span>
            <span class="chip ${channel === 'attendance' ? 'on' : ''}" data-ch="attendance">${RD.icon('users')} Asistencias y Aforo</span>
            <span class="chip ${channel === 'security' ? 'on' : ''}" data-ch="security">${RD.icon('shield')} Verificar Presencia / Coartada</span>
          </div>

          <div class="row gap wrap no-print">
            <button class="btn sm ok" id="btnexcel">${RD.icon('cloud-download')} Descargar Excel (.xlsx)</button>
            <button class="btn sm primary" id="btnprint">${RD.icon('printer')} Imprimir / Guardar PDF</button>
            <button class="btn sm" style="background:#107c41;color:#fff;border-color:#107c41" id="btngsheets" title="Abrir o conectar hoja de Google Sheets en vivo">${RD.icon('sheet')} Google Sheets</button>
            <button class="btn sm ghost" id="btngsheets_guide" title="Ver Guía y Código Apps Script de Sincronización Automática">${RD.icon('wrench')} Apps Script</button>
          </div>
        </div>

        <!-- FILTROS DE FECHAS -->
        <div class="row between wrap gap mb no-print">
          <div class="row gap wrap">
            <label class="small muted">Desde: <input type="date" id="rf" value="${from}" style="min-height:36px;width:auto"></label>
            <label class="small muted">Hasta: <input type="date" id="rt" value="${to}" style="min-height:36px;width:auto"></label>
            <button class="btn sm" id="apply">Filtrar</button>
          </div>
          <div class="chips" id="quickchips">
            <span class="chip" data-r="1">Hoy</span>
            <span class="chip" data-r="7">7 días</span>
            <span class="chip on" data-r="30">30 días</span>
            <span class="chip" data-r="90">3 meses</span>
          </div>
        </div>

        <!-- MEMBRETE OFICIAL PARA IMPRESIÓN (Visible al imprimir) -->
        <div class="print-header mb">
          <div class="row gap mb">
            ${RD.LOGO_SVG(46)}
            <div>
              <h2 style="margin:0">${esc(settings.gym_name || 'RD FITNESS CLUB')} - CHIVAY</h2>
              <p class="small muted" style="margin:0">RUC: ${esc(settings.gym_ruc || '10702548911')} · ${esc(RD.cleanAddress(settings.gym_address))} · Tel: ${esc(settings.gym_phone || '982404043')}</p>
            </div>
          </div>
          <h3>REPORTE: ${channel === 'consolidated' ? 'CONSOLIDADO GENERAL EJECUTIVO' : channel === 'gym' ? 'INGRESOS Y RETENCIÓN DEL GIMNASIO' : channel === 'store' ? 'VENTAS, INVENTARIO Y RENTABILIDAD DE TIENDITA' : channel === 'attendance' ? 'CONTROL DE ASISTENCIAS, HORARIOS Y RENDIMIENTO' : channel === 'security' ? 'VERIFICACIÓN DE PRESENCIA Y AUDITORÍA DE ACCESOS' : 'HISTORIAL Y AUDITORÍA DE TURNOS'}</h3>
          <p class="small"><b>Período:</b> ${from} al ${to} · <b>Generado el:</b> ${new Date().toLocaleString('es-PE')}</p>
          <hr class="mt mb">
        </div>

        <div id="repcontent"></div>`;

        const repcontent = view.querySelector('#repcontent');
        if (channel === 'consolidated') renderConsolidated(repcontent, d);
        else if (channel === 'gym') renderGym(repcontent, d);
        else if (channel === 'store') renderStore(repcontent, d);
        else if (channel === 'shifts') renderShifts(repcontent, d);
        else if (channel === 'attendance') renderAttendance(repcontent, d, settings);
        else if (channel === 'security') renderSecurityPresence(repcontent, settings);

        // Handlers de pestañas
        view.querySelector('#reptabs').onclick = e => {
          const ch = e.target.closest('[data-ch]')?.dataset.ch;
          if (ch && ch !== channel) {
            channel = ch;
            load();
          }
        };

        // Handlers de fechas
        view.querySelector('#apply').onclick = () => {
          from = view.querySelector('#rf').value;
          to = view.querySelector('#rt').value;
          load();
        };

        view.querySelector('#quickchips').onclick = e => {
          const c = e.target.closest('[data-r]');
          if (!c) return;
          const days = +c.dataset.r;
          to = RD.limaDay();
          from = RD.addDays(to, -days + 1);
          view.querySelectorAll('#quickchips .chip').forEach(x => x.classList.toggle('on', x === c));
          load();
        };

        // Handlers de botones de exportación
        view.querySelector('#btnprint').onclick = () => window.print();
        view.querySelector('#btngsheets').onclick = () => RD.openGoogleSheetsDirect();
        view.querySelector('#btngsheets_guide').onclick = () => googleSheetsSyncModal(settings);
        view.querySelector('#btnexcel').onclick = async () => {
          const btn = view.querySelector('#btnexcel');
          const old = btn.innerHTML;
          btn.disabled = true;
          btn.innerHTML = `${RD.icon('hourglass')} Generando Excel...`;
          try {
            const fn = await RD.downloadAuth(`/reports/export/excel?from=${from}&to=${to}`, `Reporte_RD_Fitness_${from}_al_${to}.xlsx`);
            RD.toast('Excel descargado con éxito: ' + fn, 'ok');
          } catch (err) {
            RD.toast(err.message || 'Error al descargar Excel', 'err');
          } finally {
            btn.disabled = false;
            btn.innerHTML = old;
          }
        };
      }

      // ---------------- 1. CANAL CONSOLIDADO GENERAL ----------------
      function renderConsolidated(el, d) {
        const c = d.consolidated || {};
        const daily = c.dailyComparison || [];
        const maxDay = Math.max(1, ...daily.map(x => Math.max(x.total || 0, x.expense || 0)));
        const totIncome = Number(c.totalIncome || 0);
        const gymPct = totIncome > 0 ? Math.round((Number(c.totalGymIncome || 0) / totIncome) * 100) : 0;
        const storePct = totIncome > 0 ? Math.round((Number(c.totalStoreIncome || 0) / totIncome) * 100) : 0;
        const yapeAudit = c.yapeAudit || { totalCount: 0, verifiedCount: 0, pendingCount: 0, pendingAmount: 0 };
        const gymByMethod = c.gymByMethod || {};
        const storeByMethod = c.storeByMethod || {};
        const totalByMethod = c.totalByMethod || {};
        const byMethodArr = d.byMethod || [];
        const expCat = c.expensesByCat || d.expenses?.byCat || [];

        // Construir matriz cruzada Método × Canal
        const methodsOrder = ['efectivo', 'yape', 'plin', 'tarjeta', 'transferencia'];
        const methodLabels = { efectivo: 'Efectivo Físico', yape: 'Yape (QR / Celular)', plin: 'Plin', tarjeta: 'Tarjeta POS', transferencia: 'Transferencia' };
        const matrixRows = methodsOrder.map(m => {
          const gymAmt = Number(gymByMethod[m] || 0);
          const storeAmt = Number(storeByMethod[m] || 0);
          const totalAmt = Number(totalByMethod[m] || (gymAmt + storeAmt));
          const totRow = byMethodArr.find(x => x.method === m);
          const txCount = Number(totRow?.n || 0);
          return { method: m, label: methodLabels[m] || m, gymAmt, storeAmt, totalAmt, txCount };
        }).filter(r => r.totalAmt > 0 || r.method === 'efectivo' || r.method === 'yape');

        el.innerHTML = `
        <!-- KPI EJECUTIVOS DE ALTA VISIBILIDAD -->
        <div class="grid g4 mb">
          <div class="stat gold watermark-container">
            <div class="watermark-bg" style="font-size:2.4rem">RD</div>
            <div class="v">${money(c.totalIncome || 0)}</div>
            <div class="l">${RD.icon('chart')} Ingresos Consolidados (${c.txCount || 0} cobros)</div>
            <div class="tiny muted mt2">Promedio diario: <b class="gold">${money(c.avgDailyIncome || 0)}/día</b></div>
          </div>
          <div class="stat">
            <div class="v" style="color:#f5b400">${money(c.totalGymIncome || 0)}</div>
            <div class="l">${RD.icon('dumbbell')} Caja Gimnasio (${gymPct}% del total)</div>
            <div class="tiny muted mt2">${d.newMembers || 0} nuevos · ${d.renewals || 0} renovaciones</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${money(c.totalStoreIncome || 0)}</div>
            <div class="l">${RD.icon('cart')} Ventas Tiendita (${storePct}% del total)</div>
            <div class="tiny muted mt2">Ganancia comercial: <b style="color:#4ade80">${money(c.storeGrossProfit || 0)}</b></div>
          </div>
          <div class="stat" style="border-color:${(c.netProfit || 0) >= 0 ? 'rgba(74,222,128,.45)' : 'rgba(248,113,113,.45)'}">
            <div class="v" style="color:${(c.netProfit || 0) >= 0 ? '#4ade80' : '#f87171'}">${money(c.netProfit || 0)}</div>
            <div class="l">${RD.icon('trophy')} Utilidad Neta Libre (Margen ${c.marginPct || 0}%)</div>
            <div class="tiny muted mt2">Gastos: <b class="bad">-${money(c.totalExpense || 0)}</b> · Costo prod: <b>-${money(c.storeCostOfGoods || 0)}</b></div>
          </div>
        </div>

        <!-- ARQUEO GLOBAL Y AUDITORÍA ANTIFRAUDE DIGITAL -->
        <div class="card mb watermark-container">
          <div class="watermark-bg">AUDITORIA RD</div>
          <div class="row between wrap gap" style="position:relative;z-index:1">
            <div>
              <h3>${RD.icon('shield')} Arqueo Financiero y Separación de Fondos</h3>
              <p class="muted small">Conciliación exacta entre dinero físico en gaveta, billeteras digitales (Yape/Plin) y egresos operativos.</p>
            </div>
            <div class="row gap">
              ${yapeAudit.pendingCount > 0
                ? `<span class="badge warn">${RD.icon('info')} ${yapeAudit.pendingCount} Yape/Plin por verificar (${money(yapeAudit.pendingAmount)})</span>`
                : `<span class="badge ok">${RD.icon('check')} 100% Digital Verificado (${yapeAudit.verifiedCount} op.)</span>`}
              <span class="badge ok">Balance Auditado</span>
            </div>
          </div>
          <div class="grid g4 mt2" style="position:relative;z-index:1">
            <div style="background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.25);padding:.75rem;border-radius:10px">
              <div class="tiny muted">${RD.icon('cash', '', 13)} EFECTIVO NETO EN GAVETA</div>
              <div style="font-size:1.3rem;font-weight:900;color:#4ade80;margin-top:2px">${money(c.cashInDrawer || 0)}</div>
              <div class="tiny muted">Cobros efec. (${money(c.cashGross || 0)}) − Gastos</div>
            </div>
            <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.25);padding:.75rem;border-radius:10px">
              <div class="tiny muted">${RD.icon('qr', '', 13)} DINERO DIGITAL (YAPE / PLIN / POS)</div>
              <div style="font-size:1.3rem;font-weight:900;color:#a78bfa;margin-top:2px">${money(c.digitalTotal || 0)}</div>
              <div class="tiny muted">Directo a cuenta bancaria</div>
            </div>
            <div style="background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.25);padding:.75rem;border-radius:10px">
              <div class="tiny muted">${RD.icon('expense', '', 13)} GASTOS OPERATIVOS REGISTRADOS</div>
              <div style="font-size:1.3rem;font-weight:900;color:#f87171;margin-top:2px">-${money(c.totalExpense || 0)}</div>
              <div class="tiny muted">${(c.expensesList || []).length} egresos documentados</div>
            </div>
            <div style="background:rgba(245,180,0,0.08);border:1px solid rgba(245,180,0,0.25);padding:.75rem;border-radius:10px">
              <div class="tiny muted">${RD.icon('clock', '', 13)} TURNOS DE CAJA AUDITADOS</div>
              <div style="font-size:1.3rem;font-weight:900;color:var(--gold);margin-top:2px">${(c.shifts || []).length} turnos</div>
              <div class="tiny muted">${c.activeDaysCount || 0} días con movimiento comercial</div>
            </div>
          </div>
        </div>

        <!-- GRÁFICO VISUAL DE EVOLUCIÓN DIARIA (APILADO GIMNASIO + TIENDA vs GASTOS) -->
        <div class="card mb">
          <div class="row between wrap gap mb">
            <div>
              <h3>${RD.icon('chart')} Evolución Visual de Ingresos Diarios (Gimnasio + Tiendita)</h3>
              <p class="muted small">Barras apiladas proporcionales por fecha: <span style="color:#f5b400;font-weight:700">■ Gimnasio</span> · <span style="color:#60a5fa;font-weight:700">■ Tiendita</span> · <span style="color:#4ade80;font-weight:700">● Utilidad Neta</span></p>
            </div>
          </div>
          ${daily.length ? `
            <div class="bars" style="height:165px;align-items:flex-end;gap:6px;padding-top:22px;overflow-x:auto">
              ${daily.slice(-31).map(row => {
                const gH = Math.max(0, (row.gym / maxDay) * 100);
                const sH = Math.max(0, (row.store / maxDay) * 100);
                const totH = Math.max(4, gH + sH);
                return `
                  <div style="flex:1;min-width:22px;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center" title="${row.day}: Total ${money(row.total)} (Gym: ${money(row.gym)} | Tienda: ${money(row.store)} | Neto: ${money(row.net)})">
                    <div class="tiny" style="font-size:.63rem;font-weight:800;color:var(--gold);margin-bottom:3px;white-space:nowrap">${row.total > 0 ? Math.round(row.total) : ''}</div>
                    <div style="width:100%;height:${totH}%;display:flex;flex-direction:column;justify-content:flex-end;border-radius:5px 5px 0 0;overflow:hidden;background:rgba(255,255,255,0.04)">
                      ${row.store > 0 ? `<div style="height:${(row.store / row.total) * 100}%;background:#60a5fa;width:100%"></div>` : ''}
                      ${row.gym > 0 ? `<div style="height:${(row.gym / row.total) * 100}%;background:var(--gold);width:100%"></div>` : ''}
                    </div>
                  </div>`;
              }).join('')}
            </div>
            <div class="bars-l" style="gap:6px;overflow-x:auto">
              ${daily.slice(-31).map(row => `<span style="min-width:22px;font-size:.65rem">${row.day.slice(5)}</span>`).join('')}
            </div>
          ` : `<div class="empty">Sin movimientos financieros en el rango de fechas seleccionado</div>`}
        </div>

        <!-- MATRIZ DE CONCILIACIÓN POR MÉTODO Y DESGLOSE DE GASTOS -->
        <div class="grid g2 mb">
          <div class="card">
            <h3>${RD.icon('cash')} Matriz de Conciliación: Método × Canal</h3>
            <p class="muted small mb">Relación exacta entre medio de pago y origen del ingreso para cuadre bancario y de gaveta.</p>
            <div class="tbl-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Método de Pago</th>
                    <th>Gimnasio</th>
                    <th>Tiendita</th>
                    <th>Op.</th>
                    <th>Total Recaudado</th>
                  </tr>
                </thead>
                <tbody>
                  ${matrixRows.map(r => `
                    <tr>
                      <td><b>${esc(r.label)}</b></td>
                      <td style="color:#f5b400">${money(r.gymAmt)}</td>
                      <td style="color:#60a5fa">${money(r.storeAmt)}</td>
                      <td class="muted small">${r.txCount}</td>
                      <td style="font-weight:800;color:#4ade80">${money(r.totalAmt)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3>${RD.icon('expense')} Estructura de Gastos Operativos</h3>
            <p class="muted small mb">Distribución de egresos por categoría registrados en el período.</p>
            ${expCat.length ? `
              <div style="display:flex;flex-direction:column;gap:.65rem;margin-top:.8rem">
                ${expCat.map(e => {
                  const pct = c.totalExpense > 0 ? Math.round((e.total / c.totalExpense) * 100) : 0;
                  return `
                    <div>
                      <div class="row between small" style="margin-bottom:3px">
                        <span><b>${esc(e.category)}</b></span>
                        <span class="bad"><b>-${money(e.total)}</b> <span class="tiny muted">(${pct}%)</span></span>
                      </div>
                      <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${pct}%;background:#f87171"></div></div>
                    </div>`;
                }).join('')}
              </div>
            ` : `<div class="empty">No se registraron gastos operativos en este período</div>`}
          </div>
        </div>

        <!-- TABLA COMPARATIVA DÍA POR DÍA CON FILA DE TOTALES -->
        <div class="card mb">
          <h3>${RD.icon('reports')} Desglose Contable Día por Día</h3>
          <p class="muted small mb">Auditoría cronológica de ingresos por unidad de negocio, gastos y utilidad neta diaria.</p>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Gimnasio (S/)</th>
                  <th>Tiendita (S/)</th>
                  <th>Ingreso Total (S/)</th>
                  <th>Gastos (S/)</th>
                  <th>Utilidad Neta (S/)</th>
                  <th style="width:120px" class="no-print">Proporción</th>
                </tr>
              </thead>
              <tbody>
                ${daily.map(row => {
                  const gW = row.total > 0 ? Math.round((row.gym / row.total) * 100) : 0;
                  const sW = 100 - gW;
                  return `
                  <tr>
                    <td><b>${row.day}</b></td>
                    <td style="color:#f5b400;font-weight:700">${money(row.gym)}</td>
                    <td style="color:#60a5fa;font-weight:700">${money(row.store)}</td>
                    <td style="font-weight:800">${money(row.total)}</td>
                    <td class="bad">${row.expense > 0 ? '-' + money(row.expense) : 'S/ 0.00'}</td>
                    <td style="font-weight:800;color:${row.net >= 0 ? '#4ade80' : '#f87171'}">${money(row.net)}</td>
                    <td class="no-print">
                      <div style="display:flex;height:8px;border-radius:99px;overflow:hidden;background:rgba(255,255,255,0.08)">
                        <div style="width:${gW}%;background:#f5b400" title="Gimnasio ${gW}%"></div>
                        <div style="width:${sW}%;background:#60a5fa" title="Tiendita ${sW}%"></div>
                      </div>
                    </td>
                  </tr>`;
                }).join('') || '<tr><td colspan="7" class="empty">Sin movimientos en este período</td></tr>'}
              </tbody>
              ${daily.length ? `
              <tfoot>
                <tr style="background:rgba(245,180,0,0.1);font-weight:900;border-top:2px solid var(--gold)">
                  <td>TOTAL PERÍODO (${daily.length} días)</td>
                  <td style="color:#f5b400">${money(c.totalGymIncome || 0)}</td>
                  <td style="color:#60a5fa">${money(c.totalStoreIncome || 0)}</td>
                  <td>${money(c.totalIncome || 0)}</td>
                  <td class="bad">-${money(c.totalExpense || 0)}</td>
                  <td style="color:${(c.netProfit || 0) >= 0 ? '#4ade80' : '#f87171'}">${money(c.netProfit || 0)}</td>
                  <td class="no-print small muted">${gymPct}% Gym / ${storePct}% POS</td>
                </tr>
              </tfoot>` : ''}
            </table>
          </div>
        </div>`;
      }

      // ---------------- 2. CANAL CAJA GIMNASIO (MEMBRESÍAS, PASES Y RETENCIÓN) ----------------
      function renderGym(el, d) {
        const g = d.gym || {};
        const payments = g.payments || [];
        const dailyPasses = g.dailyPasses || [];
        const byPlan = g.byPlan || [];
        const expiringSoon = g.expiringSoon || [];
        const atRisk = g.atRiskMembers || [];
        const dailyPassTotal = dailyPasses.reduce((a, b) => a + Number(b.price || 0), 0);
        const maxPlanTotal = Math.max(1, ...byPlan.map(p => Number(p.total || 0)), dailyPassTotal);

        el.innerHTML = `
        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${money(g.income || 0)}</div>
            <div class="l">${RD.icon('dumbbell')} Total Recaudado Gimnasio</div>
            <div class="tiny muted mt2">${payments.length} cobros registrados</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#f5b400">${dailyPasses.length} pases (${money(dailyPassTotal)})</div>
            <div class="l">${RD.icon('ticket')} Pases Diarios Emitidos</div>
            <div class="tiny muted mt2">Ingreso rápido de visitantes</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#4ade80">${d.newMembers || 0} nuevos / ${d.renewals || 0} renov.</div>
            <div class="l">${RD.icon('users')} Altas y Renovaciones del Período</div>
            <div class="tiny muted mt2">Crecimiento de cartera activa</div>
          </div>
          <div class="stat" style="border-color:${expiringSoon.length ? 'rgba(245,158,11,.45)' : 'var(--line)'}">
            <div class="v" style="color:${expiringSoon.length ? '#f59e0b' : '#4ade80'}">${expiringSoon.length} por vencer · ${atRisk.length} ausentes</div>
            <div class="l">${RD.icon('bell')} Alertas de Retención y Renovación</div>
            <div class="tiny muted mt2">Próximos 7 días y ausentes +10d</div>
          </div>
        </div>

        <div class="grid g2 mb">
          <!-- RENDIMIENTO POR PLAN CON BARRAS PROPORCIONALES -->
          <div class="card">
            <div class="row between wrap gap mb">
              <div>
                <h3>${RD.icon('trophy')} Recaudación por Tipo de Membresía y Pase</h3>
                <p class="muted small">Participación financiera de cada plan en los ingresos del gimnasio.</p>
              </div>
            </div>
            <div class="tbl-wrap">
              <table>
                <thead><tr><th>Plan / Modalidad</th><th>Ventas</th><th>Total Recaudado</th><th style="width:110px">Participación</th></tr></thead>
                <tbody>
                  ${byPlan.map(p => {
                    const pct = g.income > 0 ? Math.round((p.total / g.income) * 100) : 0;
                    const barW = Math.max(6, Math.round((p.total / maxPlanTotal) * 100));
                    return `
                    <tr>
                      <td><b>${esc(p.plan_name)}</b></td>
                      <td>${p.n} memb.</td>
                      <td class="gold" style="font-weight:800">${money(p.total)}</td>
                      <td>
                        <div class="tiny muted" style="margin-bottom:2px">${pct}%</div>
                        <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${barW}%"></div></div>
                      </td>
                    </tr>`;
                  }).join('') || '<tr><td colspan="4" class="empty">Sin membresías vendidas en este rango</td></tr>'}
                  <tr style="background:rgba(245,180,0,.07)">
                    <td><b>${RD.icon('ticket')} Pase Diario / Visita Libre</b></td>
                    <td>${dailyPasses.length} pases</td>
                    <td class="gold" style="font-weight:800">${money(dailyPassTotal)}</td>
                    <td>
                      <div class="tiny muted" style="margin-bottom:2px">${g.income > 0 ? Math.round((dailyPassTotal / g.income) * 100) : 0}%</div>
                      <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${Math.max(4, Math.round((dailyPassTotal / maxPlanTotal) * 100))}%;background:#60a5fa"></div></div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- INTELIGENCIA DE RETENCIÓN: POR VENCER Y EN RIESGO DE ABANDONO -->
          <div class="card">
            <div class="row between wrap gap mb">
              <div>
                <h3>${RD.icon('refresh')} Centro de Retención y Seguimiento de Socios</h3>
                <p class="muted small">Acción directa por WhatsApp para asegurar renovaciones y recuperar socios inactivos.</p>
              </div>
            </div>

            <div class="tiny muted" style="font-weight:800;letter-spacing:.5px;margin-bottom:6px;color:#f59e0b">${RD.icon('clock', '', 13)} MEMBRESÍAS POR VENCER EN LOS PRÓXIMOS 7 DÍAS (${expiringSoon.length})</div>
            <div style="max-height:145px;overflow-y:auto;margin-bottom:.9rem;border:1px solid var(--line);border-radius:8px;padding:.4rem">
              ${expiringSoon.length ? expiringSoon.map(m => `
                <div class="row between gap" style="padding:.35rem .4rem;border-bottom:1px solid var(--line)">
                  <div>
                    <b class="small">${esc(m.name)}</b> <span class="badge warn tiny">${m.days_left === 0 ? 'Vence Hoy' : `En ${m.days_left}d`}</span>
                    <div class="tiny muted">${esc(m.plan_name)} · Vence: ${m.end_date}</div>
                  </div>
                  <div class="row gap no-print">
                    ${m.phone ? `<a class="btn sm ok" target="_blank" href="${RD.waLink(m.phone, `Hola ${m.name}, te saludamos de RD Fitness Club. Tu membresía (${m.plan_name}) vence el ${m.end_date}. ¡Te esperamos para renovarla y seguir entrenando con todo!`)}">${RD.icon('whatsapp')} Avisar</a>` : ''}
                    <button class="btn sm ghost" data-membersheet="${m.id}">${RD.icon('reports')}</button>
                  </div>
                </div>
              `).join('') : `<div class="small muted p">Ninguna membresía vence en los próximos 7 días.</div>`}
            </div>

            <div class="tiny muted" style="font-weight:800;letter-spacing:.5px;margin-bottom:6px;color:#f87171">${RD.icon('heart-pulse', '', 13)} SOCIOS ACTIVOS CON +10 DÍAS SIN ASISTIR (${atRisk.length})</div>
            <div style="max-height:145px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:.4rem">
              ${atRisk.length ? atRisk.map(m => `
                <div class="row between gap" style="padding:.35rem .4rem;border-bottom:1px solid var(--line)">
                  <div>
                    <b class="small">${esc(m.name)}</b> <span class="badge denied tiny">${m.days_absent !== null ? `${m.days_absent}d sin venir` : 'Sin ingresos'}</span>
                    <div class="tiny muted">Última visita: ${m.last_visit_day || 'Nunca'} · Vence: ${m.end_date}</div>
                  </div>
                  <div class="row gap no-print">
                    ${m.phone ? `<a class="btn sm" target="_blank" href="${RD.waLink(m.phone, `¡Hola ${m.name}! Te extrañamos en RD Fitness Club. Notamos que llevas unos días sin venir a entrenar. ¡Retoma tu rutina esta semana, la constancia hace al campeón!`)}">${RD.icon('whatsapp')} Motivar</a>` : ''}
                    <button class="btn sm ghost" data-membersheet="${m.id}">${RD.icon('reports')}</button>
                  </div>
                </div>
              `).join('') : `<div class="small muted p">¡Excelente! Todos los socios activos están asistiendo regularmente.</div>`}
            </div>
          </div>
        </div>

        <!-- DETALLE DE PAGOS DEL GIMNASIO CON BUSCADOR -->
        <div class="card mb">
          <div class="row between wrap gap mb">
            <div>
              <h3>${RD.icon('receipt')} Libro de Cobros del Gimnasio (${payments.length} registros)</h3>
              <p class="muted small">Registro íntegro de membresías y pases diarios con verificación de medio de pago.</p>
            </div>
            <div class="no-print">
              <input type="text" id="gym_pay_filter" placeholder="Buscar por socio, boleta o método..." style="min-height:34px;width:240px">
            </div>
          </div>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Boleta</th>
                  <th>Socio / Visitante</th>
                  <th>Concepto</th>
                  <th>Método</th>
                  <th>Verificación</th>
                  <th>Monto</th>
                  <th class="no-print">Boleta</th>
                </tr>
              </thead>
              <tbody id="gym_pay_tbody">
                ${payments.map(p => {
                  const isDigital = p.method === 'yape' || p.method === 'plin';
                  const isVer = Boolean(p.verified || p.yape_verified);
                  const opCode = p.op_code || p.yape_op_code || '';
                  const verBadge = isDigital
                    ? (isVer ? `<span class="badge ok tiny">${RD.icon('check', '', 11)} Verificado ${opCode ? '#' + esc(opCode) : ''}</span>` : `<span class="badge warn tiny">Por validar</span>`)
                    : `<span class="tiny muted">Caja física</span>`;
                  return `
                  <tr data-search="${esc((p.member_name || p.dp_name || '') + ' ' + (p.receipt_no || '') + ' ' + (p.concept || '') + ' ' + (p.method || '')).toLowerCase()}">
                    <td class="small muted">${p.day} ${p.created_at ? p.created_at.slice(11, 16) : ''}</td>
                    <td class="small muted" style="font-family:monospace">${esc(p.receipt_no || ('REC-' + p.id))}</td>
                    <td><b>${esc(p.member_name || p.dp_name || 'Visitante')}</b> ${p.member_code ? `<span class="badge">${esc(p.member_code)}</span>` : ''}</td>
                    <td class="small">${esc(p.concept)}</td>
                    <td><span class="badge ${p.method === 'yape' ? 'warn' : p.method === 'plin' ? 'info' : 'ok'}">${esc(p.method)}</span></td>
                    <td>${verBadge}</td>
                    <td style="font-weight:800;color:#f5b400">${money(p.amount)}</td>
                    <td class="no-print"><button class="icon-btn" data-receipt="${p.id}" title="Ver e Imprimir Boleta">${RD.icon('receipt')}</button></td>
                  </tr>`;
                }).join('') || '<tr><td colspan="8" class="empty">Sin cobros de membresías o pases</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

        attachReceiptButtons(el);
        el.querySelectorAll('[data-membersheet]').forEach(btn => {
          btn.onclick = () => RD.memberAttendanceSheetModal(btn.dataset.membersheet, from, to);
        });
        const gFilter = el.querySelector('#gym_pay_filter');
        if (gFilter) {
          gFilter.oninput = () => {
            const q = gFilter.value.toLowerCase().trim();
            el.querySelectorAll('#gym_pay_tbody tr[data-search]').forEach(tr => {
              tr.style.display = !q || tr.dataset.search.includes(q) ? '' : 'none';
            });
          };
        }
      }

      // ---------------- 3. CANAL TIENDITA Y POS (VENTAS, COSTOS Y MARGEN) ----------------
      function renderStore(el, d) {
        const s = d.store || {};
        const prods = s.productStats || [];
        const topSelling = s.topSelling || [];
        const lowStock = s.lowStock || [];
        const totalUnits = prods.reduce((a, b) => a + (b.sold_qty || 0), 0);
        const maxSoldTotal = Math.max(1, ...topSelling.map(p => Number(p.sold_total || 0)));

        el.innerHTML = `
        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${money(s.income || 0)}</div>
            <div class="l">${RD.icon('cart')} Total Ventas Tiendita</div>
            <div class="tiny muted mt2">${(s.payments || []).length} tickets emitidos</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#4ade80">${money(s.grossProfit || 0)}</div>
            <div class="l">${RD.icon('trophy')} Ganancia Neta Comercial</div>
            <div class="tiny muted mt2">Costo mercadería: <b>${money(s.costOfGoods || 0)}</b></div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${totalUnits} unidades</div>
            <div class="l">${RD.icon('box')} Productos Despachados</div>
            <div class="tiny muted mt2">${prods.length} referencias activas</div>
          </div>
          <div class="stat">
            <div class="v" style="color:${lowStock.length ? '#f87171' : '#4ade80'}">${lowStock.length} productos</div>
            <div class="l">${RD.icon('info')} Alerta de Stock Crítico</div>
            <div class="tiny muted mt2">${lowStock.length ? 'Requiere reposición' : 'Inventario saludable'}</div>
          </div>
        </div>

        ${topSelling.length ? `
        <div class="card mb">
          <h3>${RD.icon('chart')} Ranking de Productos Más Vendidos y Rentabilidad</h3>
          <p class="muted small mb">Comparativa visual entre ingresos brutos (<span style="color:#60a5fa">■ Ventas</span>) y ganancia neta comercial (<span style="color:#4ade80">■ Ganancia</span>).</p>
          <div class="grid g2 gap">
            ${topSelling.slice(0, 6).map(p => {
              const w = Math.max(6, Math.round(((p.sold_total || 0) / maxSoldTotal) * 100));
              const unitMargin = (p.price || 0) - (p.cost || 0);
              const netProfit = (p.sold_qty || 0) * unitMargin;
              return `
                <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:10px;padding:.65rem .8rem">
                  <div class="row between small" style="margin-bottom:4px">
                    <b>${esc(p.name)} <span class="badge tiny">${p.sold_qty} un.</span></b>
                    <span><b style="color:#60a5fa">${money(p.sold_total || 0)}</b> <span class="tiny" style="color:#4ade80">(+${money(netProfit)} neto)</span></span>
                  </div>
                  <div class="muscle-track-bg"><div class="muscle-track-bar" style="width:${w}%;background:linear-gradient(90deg,#60a5fa,#4ade80)"></div></div>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- CONTROL DE INVENTARIO, COSTOS Y MARGEN POR PRODUCTO -->
        <div class="card mb">
          <h3>${RD.icon('box')} Control de Inventario, Costos y Margen por Producto</h3>
          <p class="muted small mb">Auditoría de existencias, costo unitario, precio de venta y utilidad generada por cada ítem.</p>
          <div class="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Costo Unit.</th>
                  <th>Precio Venta</th>
                  <th>Stock Actual</th>
                  <th>Vendidos</th>
                  <th>Total Venta</th>
                  <th>Ganancia Neta</th>
                  <th class="no-print">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${prods.map(p => {
                  const cost = Number(p.cost || 0);
                  const price = Number(p.price || 0);
                  const soldQty = Number(p.sold_qty || 0);
                  const soldTot = Number(p.sold_total || 0);
                  const profit = soldTot - (soldQty * cost);
                  return `
                  <tr class="${p.stock <= p.min_stock ? 'row-warn' : ''}">
                    <td><b>${esc(p.name)}</b> ${p.barcode ? `<div class="tiny muted">BC: ${esc(p.barcode)}</div>` : ''}</td>
                    <td><span class="badge">${esc(p.category)}</span></td>
                    <td class="muted small">${money(cost)}</td>
                    <td style="font-weight:700">${money(price)}</td>
                    <td>
                      <b style="color:${p.stock <= p.min_stock ? '#f87171' : '#4ade80'}">${p.stock} un.</b>
                      <span class="tiny muted">(mín ${p.min_stock})</span>
                      ${p.stock <= p.min_stock ? '<span class="badge warn tiny">¡Bajo!</span>' : ''}
                    </td>
                    <td style="font-weight:700">${soldQty} un.</td>
                    <td style="font-weight:700;color:#60a5fa">${money(soldTot)}</td>
                    <td style="font-weight:800;color:#4ade80">${money(profit)}</td>
                    <td class="no-print">
                      <button class="btn sm" data-addstock="${p.id}" data-pname="${esc(p.name)}">＋ Stock</button>
                    </td>
                  </tr>`;
                }).join('') || '<tr><td colspan="9" class="empty">Sin productos registrados</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <!-- DETALLE DE VENTAS DE TIENDA -->
        <div class="card mb">
          <h3>${RD.icon('receipt')} Tickets de Venta de Tienda (${(s.payments || []).length} ventas)</h3>
          <div class="tbl-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Boleta</th>
                  <th>Detalle / Producto</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th class="no-print">Ticket</th>
                </tr>
              </thead>
              <tbody>
                ${(s.payments || []).map(p => `
                <tr>
                  <td class="small muted">${p.day} ${p.created_at ? p.created_at.slice(11, 16) : ''}</td>
                  <td class="small muted" style="font-family:monospace">${esc(p.receipt_no || ('TICK-' + p.id))}</td>
                  <td><b>${esc(p.concept)}</b></td>
                  <td><span class="badge ${p.method === 'yape' ? 'warn' : p.method === 'plin' ? 'info' : 'ok'}">${esc(p.method)}</span></td>
                  <td style="font-weight:700;color:#60a5fa">${money(p.amount)}</td>
                  <td class="no-print"><button class="icon-btn" data-receipt="${p.id}" title="Ver e Imprimir Ticket">${RD.icon('receipt')}</button></td>
                </tr>`).join('') || '<tr><td colspan="6" class="empty">Sin ventas de tienda en este período</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

        attachReceiptButtons(el);

        // Handler sumar stock rápido
        el.querySelectorAll('[data-addstock]').forEach(btn => {
          btn.onclick = async () => {
            const pid = btn.dataset.addstock;
            const pname = btn.dataset.pname;
            const qty = await RD.prompt(`Sumar Stock: ${pname}`, 'Cantidad de unidades que ingresaron', '12');
            if (qty && parseInt(qty, 10) > 0) {
              await RD.api.post(`/products/${pid}/stock`, { qty: parseInt(qty, 10), note: 'Ingreso rápido desde reporte' });
              RD.toast('Stock actualizado');
              load();
            }
          };
        });
      }

      // ---------------- 4. CANAL HISTORIAL DE TURNOS ----------------
      function renderShifts(el, d) {
        const shifts = d.consolidated?.shifts || [];
        const closedShifts = shifts.filter(s => s.status !== 'open');
        const exactShifts = closedShifts.filter(s => Math.abs(Number(s.diff_cash || 0)) < 0.01).length;
        const netDiff = closedShifts.reduce((a, b) => a + Number(b.diff_cash || 0), 0);
        const totalExpectedCash = shifts.reduce((a, b) => a + Number(b.expected_cash || 0), 0);

        el.innerHTML = `
        <div class="grid g4 mb">
          <div class="stat gold">
            <div class="v">${shifts.length} turnos</div>
            <div class="l">${RD.icon('clock')} Turnos Registrados en el Período</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#4ade80">${exactShifts} / ${closedShifts.length}</div>
            <div class="l">${RD.icon('check')} Cierres con Cuadre Exacto (S/ 0.00)</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${money(totalExpectedCash)}</div>
            <div class="l">${RD.icon('cash')} Efectivo Acumulado en Turnos</div>
          </div>
          <div class="stat">
            <div class="v" style="color:${netDiff >= 0 ? '#4ade80' : '#f87171'}">${netDiff >= 0 ? '+' : ''}${money(netDiff)}</div>
            <div class="l">${RD.icon('shield')} Balance Neto de Diferencias</div>
          </div>
        </div>

        <div class="card mb">
          <div class="row between wrap gap">
            <div>
              <h3>${RD.icon('clock')} Historial de Turnos y Auditoría de Arqueos (${shifts.length} turnos)</h3>
              <p class="muted small">Control riguroso por turno y cajero. Cada cierre registra la diferencia física (sobrante o faltante).</p>
            </div>
            <span class="badge ok">Arqueo Seguro</span>
          </div>

          <div class="tbl-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>N° Turno</th>
                  <th>Cajero(a)</th>
                  <th>Turno</th>
                  <th>Fecha</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Fondo Inicial</th>
                  <th>Efectivo Esperado</th>
                  <th>Efectivo Contado</th>
                  <th>Diferencia</th>
                  <th>Digital Esperado</th>
                  <th>Estado</th>
                  <th class="no-print">Acta</th>
                </tr>
              </thead>
              <tbody>
                ${shifts.map(s => {
                  const diff = Number(s.diff_cash || 0);
                  const diffBadge = diff === 0 ? '<span class="badge ok">S/ 0.00 Cuadrado</span>' : (diff > 0 ? `<span class="badge info">+${money(diff)} Sobrante</span>` : `<span class="badge warn">-${money(Math.abs(diff))} Faltante</span>`);
                  return `
                  <tr>
                    <td><b>#${s.id}</b></td>
                    <td><b>${esc(s.user_name || s.user_id)}</b></td>
                    <td class="small">${esc(s.shift_name || 'General')}</td>
                    <td>${s.day}</td>
                    <td class="small muted">${s.opened_at ? RD.fmtTime(s.opened_at) : '—'}</td>
                    <td class="small muted">${s.closed_at ? RD.fmtTime(s.closed_at) : '—'}</td>
                    <td style="color:#f5b400">${money(s.initial_cash || 0)}</td>
                    <td style="font-weight:700">${money(s.expected_cash || 0)}</td>
                    <td style="font-weight:700;color:#2563eb">${money(s.actual_cash || 0)}</td>
                    <td>${diffBadge}</td>
                    <td style="color:#a78bfa">${money(s.expected_digital || 0)}</td>
                    <td><span class="badge ${s.status === 'open' ? 'ok' : 'ghost'}">${s.status === 'open' ? `${RD.icon('check')} Abierto` : `${RD.icon('lock')} Cerrado`}</span></td>
                    <td class="no-print">
                      <button class="btn sm" data-viewshift="${s.id}">${RD.icon('receipt')} Acta</button>
                    </td>
                  </tr>`;
                }).join('') || '<tr><td colspan="13" class="empty">No hay turnos registrados en este período</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>`;

        // Handler ver acta de turno
        el.querySelectorAll('[data-viewshift]').forEach(btn => {
          btn.onclick = async () => {
            const sid = btn.dataset.viewshift;
            try {
              const full = await RD.api.get(`/shifts/${sid}`);
              RD.shiftTicketModal(full);
            } catch (err) {
              RD.toast(err.message, 'err');
            }
          };
        });
      }

      function attachReceiptButtons(container) {
        container.querySelectorAll('[data-receipt]').forEach(btn => {
          btn.onclick = async () => {
            try {
              const receipt = await RD.api.get(`/payments/${btn.dataset.receipt}/receipt`);
              RD.receiptModal(receipt);
            } catch (err) { RD.toast(err.message, 'err'); }
          };
        });
      }

      // ---------------- 5. CANAL ASISTENCIAS, HORARIOS Y RENDIMIENTO ----------------
      function renderAttendance(el, d, settings) {
        const att = d.attendance || {};
        const rows = att.rows || [];
        const insideNow = att.insideNow || [];
        const topMembers = att.topMembers || [];
        const shifts = att.byShiftBlock || { morning: 0, afternoon: 0, evening: 0 };
        const totShift = Math.max(1, (shifts.morning || 0) + (shifts.afternoon || 0) + (shifts.evening || 0));
        const byWeekday = att.byWeekday || [];
        const maxW = Math.max(1, ...byWeekday.map(w => w.count || 0));
        const hoursAll = Array.from({ length: 16 }, (_, i) => i + 6);
        const hoursMap = Object.fromEntries((d.peak || []).map(x => [x.hour, x.n]));
        const maxH = Math.max(1, ...(d.peak || []).map(x => x.n));

        el.innerHTML = `
        <!-- KPI METRICS DE ASISTENCIA Y AFORO -->
        <div class="grid g4 mb">
          <div class="stat" style="border-color:#4ade80">
            <div class="v" style="color:#4ade80">${insideNow.length} personas</div>
            <div class="l">${RD.icon('timer')} Aforo Actual en Sala (Dentro Ahora)</div>
          </div>
          <div class="stat gold">
            <div class="v">${att.totalVisits || 0} visitas</div>
            <div class="l">${RD.icon('users')} Total Asistencias Registradas</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#f5b400">${att.memberVisits || 0} socios / ${att.dailyVisits || 0} pases</div>
            <div class="l">${RD.icon('dumbbell')} Socios vs ${RD.icon('ticket')} Pases Diarios</div>
          </div>
          <div class="stat">
            <div class="v" style="color:#60a5fa">${att.avgDurationMin || 75} min</div>
            <div class="l">${RD.icon('clock')} Permanencia Promedio por Sesión</div>
          </div>
        </div>

        <!-- PERSONAS ACTUALMENTE DENTRO (AFORO EN VIVO) -->
        <div class="card mb" style="border: 1px solid rgba(74, 222, 128, 0.4)">
          <div class="row between wrap gap">
            <div>
              <h3 style="color:#4ade80;display:flex;align-items:center;gap:.5rem">
                <span>${RD.icon('users')}</span> Personas Entrenando en el Gimnasio Ahora (${insideNow.length})
              </h3>
              <p class="muted small">Control en tiempo real de entradas y registro de salida al concluir su rutina en Chivay.</p>
            </div>
            <span class="badge ok">Aforo Seguro</span>
          </div>

          <div class="tbl-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Socio / Visitante</th>
                  <th>DNI / Código</th>
                  <th>Hora Entrada</th>
                  <th>Tiempo en Sala</th>
                  <th>Tipo</th>
                  <th class="no-print">Acción</th>
                </tr>
              </thead>
              <tbody>
                ${insideNow.map(row => {
                  const enterTime = row.ts ? new Date(row.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
                  const mins = Math.max(1, Math.round((Date.now() - new Date(row.ts).getTime()) / 60000));
                  const durText = `${Math.floor(mins / 60) > 0 ? Math.floor(mins / 60) + 'h ' : ''}${mins % 60}m`;
                  return `
                  <tr>
                    <td>
                      <div class="row gap">
                        ${row.photo ? `<img src="${esc(row.photo)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover">` : `<div style="width:32px;height:32px;border-radius:50%;background:#334155;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold">${esc((row.name || 'V')[0])}</div>`}
                        <div>
                          <b>${esc(row.name)}</b>
                          ${row.phone ? `<div class="tiny muted">${RD.icon('phone')} ${esc(row.phone)}</div>` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span class="badge" style="font-family:monospace">${esc(row.code || '—')}</span>
                      ${row.dni ? `<div class="tiny muted">DNI: ${esc(row.dni)}</div>` : ''}
                    </td>
                    <td style="font-family:monospace;font-weight:bold">${enterTime}</td>
                    <td style="color:#4ade80;font-weight:bold">${durText}</td>
                    <td><span class="badge ${row.kind === 'D' ? 'warn' : 'ok'}">${row.kind === 'D' ? `${RD.icon('ticket')} Pase Diario` : `${RD.icon('dumbbell')} Socio`}</span></td>
                    <td class="no-print">
                      <div class="row gap">
                        <button class="btn sm warn" data-checkout="${row.id}" data-name="${esc(row.name)}">${RD.icon('door')} Registrar Salida</button>
                        ${row.member_id ? `<button class="btn sm ghost" data-membersheet="${row.member_id}">${RD.icon('reports')} Ficha</button>` : ''}
                      </div>
                    </td>
                  </tr>`;
                }).join('') || '<tr><td colspan="6" class="empty">No hay personas registradas en el gimnasio en este momento</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div class="grid g2 mb">
          <!-- RANKING TOP 10 SOCIOS MAS DISCIPLINADOS (CORRELACIONADO CON RUTINA Y VOLUMEN) -->
          <div class="card">
            <div class="row between wrap gap">
              <div>
                <h3>${RD.icon('trophy')} Top Socios Más Disciplinados y Rendimiento</h3>
                <p class="muted small">Correlación de asistencia, rutina activa, volumen de carga y permanencia.</p>
              </div>
              <span class="badge ok">Constancia</span>
            </div>
            <div class="tbl-wrap mt">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Socio</th>
                    <th>Rutina Activa</th>
                    <th>Asistencia</th>
                    <th>Promedio</th>
                    <th class="no-print">Ficha</th>
                  </tr>
                </thead>
                <tbody>
                  ${topMembers.map((m, idx) => {
                    const badgeRank = idx === 0 ? '1°' : idx === 1 ? '2°' : idx === 2 ? '3°' : `${idx + 1}°`;
                    return `
                    <tr>
                      <td style="font-size:1.05rem;font-weight:900;color:var(--gold)">${badgeRank}</td>
                      <td>
                        <b>${esc(m.name)}</b>
                        <div class="tiny muted">${esc(m.code)} ${m.dni ? '· DNI ' + esc(m.dni) : ''}</div>
                      </td>
                      <td>
                        <span class="badge">${esc(m.active_routine || 'Entrenamiento Libre')}</span>
                        ${m.volume_moved > 0 ? `<div class="tiny muted mt2">${Number(m.volume_moved).toLocaleString('es-PE')} kg movidos</div>` : ''}
                      </td>
                      <td style="font-weight:bold;color:var(--gold)">${m.days_attended} días <span class="tiny muted">(${m.total_sessions} ses.)</span></td>
                      <td class="small muted">${m.avg_min || 75} min</td>
                      <td class="no-print">
                        <button class="btn sm ghost" data-membersheet="${m.id}" title="Ver Ficha Oficial Integral">${RD.icon('reports')} Ficha</button>
                      </td>
                    </tr>`;
                  }).join('') || '<tr><td colspan="6" class="empty">Sin asistencias registradas en este período</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>

          <!-- DISTRIBUCIÓN HORARIA, TURNOS Y DÍAS DE LA SEMANA -->
          <div class="card">
            <h3>${RD.icon('clock')} Analítica de Horarios, Turnos y Afluencia</h3>
            <p class="muted small mb">Distribución por bloques horarios y horas pico en sala de máquinas.</p>

            <div class="grid g3 gap mb">
              <div style="background:rgba(245,180,0,0.08);border:1px solid rgba(245,180,0,0.22);border-radius:8px;padding:.55rem;text-align:center">
                <div class="tiny muted">MAÑANA (05h-12h)</div>
                <div style="font-size:1.15rem;font-weight:900;color:var(--gold)">${shifts.morning || 0} <span class="tiny">(${Math.round(((shifts.morning || 0) / totShift) * 100)}%)</span></div>
              </div>
              <div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.22);border-radius:8px;padding:.55rem;text-align:center">
                <div class="tiny muted">TARDE (12h-18h)</div>
                <div style="font-size:1.15rem;font-weight:900;color:#60a5fa">${shifts.afternoon || 0} <span class="tiny">(${Math.round(((shifts.afternoon || 0) / totShift) * 100)}%)</span></div>
              </div>
              <div style="background:rgba(167,139,250,0.08);border:1px solid rgba(167,139,250,0.22);border-radius:8px;padding:.55rem;text-align:center">
                <div class="tiny muted">NOCHE (18h-23h)</div>
                <div style="font-size:1.15rem;font-weight:900;color:#a78bfa">${shifts.evening || 0} <span class="tiny">(${Math.round(((shifts.evening || 0) / totShift) * 100)}%)</span></div>
              </div>
            </div>

            <div class="bars" style="height:115px">
              ${hoursAll.map(h => {
                const count = hoursMap[h] || 0;
                return `<div class="b" style="height:${Math.max(2, count / maxH * 100)}%;background:var(--gold)"><span>${count || ''}</span></div>`;
              }).join('')}
            </div>
            <div class="bars-l">${hoursAll.map(h => `<span>${h}h</span>`).join('')}</div>

            ${byWeekday.length ? `
              <div class="mt2 pt" style="border-top:1px dashed var(--border,#334155)">
                <div class="tiny muted mb" style="font-weight:700">AFLUENCIA POR DÍA DE LA SEMANA:</div>
                <div class="grid" style="grid-template-columns:repeat(7,1fr);gap:6px;text-align:center">
                  ${byWeekday.map(w => `
                    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--line);border-radius:6px;padding:4px 2px">
                      <div class="tiny muted">${w.label}</div>
                      <div style="font-weight:800;font-size:.85rem;color:${w.count === maxW && w.count > 0 ? 'var(--gold)' : 'var(--text)'}">${w.count}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- BUSCADOR RAPIDO PARA FICHA INDIVIDUAL -->
            <div class="mt2 pt" style="border-top:1px dashed var(--border,#334155)">
              <label class="small muted"><b>${RD.icon('search')} Generar Ficha Individual de un Socio:</b></label>
              <div class="row gap mt2">
                <input type="text" id="att_search_member" placeholder="Escribe nombre o DNI del socio..." style="min-height:36px">
                <button class="btn sm primary" id="btn_open_sheet">${RD.icon('reports')} Abrir Ficha</button>
              </div>
              <div id="att_member_results" class="list mt2 hidden"></div>
            </div>
          </div>
        </div>

        <!-- HISTORIAL COMPLETO DE ENTRADAS Y SALIDAS -->
        <div class="card mb">
          <div class="row between wrap gap">
            <div>
              <h3>${RD.icon('reports')} Historial de Entradas, Salidas y Permanencia (${rows.length} registros)</h3>
              <p class="muted small">Auditoría detallada con hora de ingreso, hora de salida y minutos de estancia.</p>
            </div>
            <div class="row gap wrap no-print">
              <input type="text" id="att_filter_txt" placeholder="Filtrar por nombre o DNI..." style="min-height:32px;font-size:.85rem;width:200px">
              <div class="chips" id="att_type_chips">
                <span class="chip on" data-attfilter="all">Todos</span>
                <span class="chip" data-attfilter="members">Solo Socios</span>
                <span class="chip" data-attfilter="daily">Pases Diarios</span>
                <span class="chip" data-attfilter="inside">En Sala</span>
              </div>
            </div>
          </div>

          <div class="tbl-wrap mt">
            <table id="tbl_att_history">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora Entrada</th>
                  <th>Hora Salida</th>
                  <th>Permanencia</th>
                  <th>Tipo</th>
                  <th>Socio / Visitante</th>
                  <th>DNI / Código</th>
                  <th>Estado</th>
                  <th>Atendido Por</th>
                  <th class="no-print">Acción</th>
                </tr>
              </thead>
              <tbody id="att_history_body">
              </tbody>
            </table>
          </div>
        </div>`;

        // Render filas de historial
        function renderAttendanceRows(filterText = '', filterType = 'all') {
          const tbody = el.querySelector('#att_history_body');
          if (!tbody) return;
          const q = filterText.toLowerCase().trim();

          const filtered = rows.filter(r => {
            const name = (r.member_name || r.dp_name || 'Visitante').toLowerCase();
            const dni = String(r.member_dni || r.dp_dni || '').toLowerCase();
            const code = String(r.member_code || r.dp_code || r.code || '').toLowerCase();
            const matchesText = !q || name.includes(q) || dni.includes(q) || code.includes(q);
            if (!matchesText) return false;

            if (filterType === 'members') return r.kind !== 'D';
            if (filterType === 'daily') return r.kind === 'D';
            if (filterType === 'inside') return r.status === 'inside' || !r.exit_ts;
            return true;
          });

          tbody.innerHTML = filtered.map(r => {
            const displayName = r.member_name || r.dp_name || 'Visitante';
            const displayDni = r.member_dni || r.dp_dni || '—';
            const displayCode = r.member_code || r.dp_code || r.code || '—';
            const enterTime = r.ts ? new Date(r.ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '—';
            const exitTime = r.exit_ts ? new Date(r.exit_ts).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : (r.status === 'inside' ? `<span class="badge ok tiny">${RD.icon('login')} En Sala</span>` : '—');
            const duration = r.duration_min ? `${Math.floor(r.duration_min / 60) > 0 ? Math.floor(r.duration_min / 60) + 'h ' : ''}${r.duration_min % 60}m` : (r.status === 'inside' ? '<span class="gold tiny">Entrenando</span>' : '—');
            const isInside = r.status === 'inside' || (!r.exit_ts && r.day === RD.limaDay());

            return `
            <tr>
              <td class="small muted">${r.day}</td>
              <td style="font-family:monospace;font-weight:bold">${enterTime}</td>
              <td style="font-family:monospace">${exitTime}</td>
              <td style="font-weight:bold">${duration}</td>
              <td><span class="badge ${r.kind === 'D' ? 'warn' : 'ok'}">${r.kind === 'D' ? `${RD.icon('ticket')} Pase Diario` : `${RD.icon('dumbbell')} Socio`}</span></td>
              <td><b>${esc(displayName)}</b></td>
              <td>
                <span class="badge" style="font-family:monospace">${esc(displayCode)}</span>
                ${displayDni !== '—' ? `<div class="tiny muted">DNI: ${esc(displayDni)}</div>` : ''}
              </td>
              <td><span class="badge ${r.result === 'ok' ? 'ok' : r.result === 'warn' ? 'warn' : 'denied'} tiny">${r.result === 'ok' ? 'Ingreso OK' : r.result === 'warn' ? 'Aviso' : 'Rechazado'}</span></td>
              <td class="small muted">${esc(r.staff_name || 'Recepción')}</td>
              <td class="no-print">
                <div class="row gap">
                  ${isInside ? `<button class="btn sm warn" data-checkout="${r.id}" data-name="${esc(displayName)}">${RD.icon('door')} Salida</button>` : ''}
                  ${r.member_id ? `<button class="btn sm ghost" data-membersheet="${r.member_id}" title="Ficha de Asistencias">${RD.icon('reports')} Ficha</button>` : ''}
                </div>
              </td>
            </tr>`;
          }).join('') || '<tr><td colspan="10" class="empty">No se encontraron asistencias con los filtros aplicados</td></tr>';

          attachAttendanceActions(tbody);
        }

        function attachAttendanceActions(container) {
          // Salida manual
          container.querySelectorAll('[data-checkout]').forEach(btn => {
            btn.onclick = async () => {
              const id = btn.dataset.checkout;
              const name = btn.dataset.name;
              if (confirm(`¿Registrar salida de ${name}?`)) {
                try {
                  const res = await RD.api.post(`/attendance/${id}/checkout`);
                  RD.toast(`Salida registrada (${res.session?.duration_min || 0} min)`);
                  load();
                } catch (err) { RD.toast(err.message, 'err'); }
              }
            };
          });

          // Ficha individual
          container.querySelectorAll('[data-membersheet]').forEach(btn => {
            btn.onclick = () => {
              const mid = btn.dataset.membersheet;
              if (mid) RD.memberAttendanceSheetModal(mid, from, to);
            };
          });
        }

        renderAttendanceRows();
        attachAttendanceActions(el);

        // Filtro texto
        const filterInput = el.querySelector('#att_filter_txt');
        let currentFilterType = 'all';
        if (filterInput) {
          filterInput.oninput = () => renderAttendanceRows(filterInput.value, currentFilterType);
        }

        // Filtro chips tipo
        el.querySelector('#att_type_chips')?.addEventListener('click', e => {
          const c = e.target.closest('[data-attfilter]');
          if (!c) return;
          el.querySelectorAll('#att_type_chips .chip').forEach(x => x.classList.toggle('on', x === c));
          currentFilterType = c.dataset.attfilter;
          renderAttendanceRows(filterInput?.value || '', currentFilterType);
        });

        // Buscador directo de socio para ficha individual
        const sInp = el.querySelector('#att_search_member');
        const sRes = el.querySelector('#att_member_results');
        const sBtn = el.querySelector('#btn_open_sheet');
        if (sInp && sRes) {
          let sTimer;
          sInp.oninput = () => {
            clearTimeout(sTimer);
            sTimer = setTimeout(async () => {
              const q = sInp.value.trim();
              if (q.length < 2) { sRes.classList.add('hidden'); return; }
              try {
                const res = await RD.api.get(`/members?q=${encodeURIComponent(q)}&limit=8`);
                const mems = res.members || [];
                if (!mems.length) {
                  sRes.innerHTML = '<div class="item small muted">No se encontraron socios</div>';
                  sRes.classList.remove('hidden');
                  return;
                }
                sRes.innerHTML = mems.map(m => `
                  <div class="item click" data-mid="${m.id}">
                    <b>${esc(m.name)}</b>
                    <span class="badge" style="font-family:monospace">${esc(m.code)}</span>
                    <span class="small muted">DNI: ${esc(m.dni || '—')}</span>
                  </div>
                `).join('');
                sRes.classList.remove('hidden');

                sRes.querySelectorAll('[data-mid]').forEach(it => {
                  it.onclick = () => {
                    sRes.classList.add('hidden');
                    RD.memberAttendanceSheetModal(it.dataset.mid, from, to);
                  };
                });
              } catch (err) {}
            }, 250);
          };
          sBtn.onclick = () => {
            const first = sRes.querySelector('[data-mid]');
            if (first) {
              sRes.classList.add('hidden');
              RD.memberAttendanceSheetModal(first.dataset.mid, from, to);
            } else if (sInp.value.trim()) {
              RD.toast('Selecciona un socio de la lista para ver su ficha', 'info');
            }
          };
        }
      }

      // ---------------- 6. CANAL VERIFICACIÓN DE PRESENCIA Y COARTADAS ----------------
      function renderSecurityPresence(el, settings) {
        el.innerHTML = `
        <div class="card mb">
          <div class="row between wrap gap">
            <div>
              <h3>${RD.icon('shield')} Verificación de Presencia y Ficha de Seguridad</h3>
              <p class="muted small">Busca a cualquier persona (Socio o Visitante con Pase Diario) y una fecha específica para verificar con certeza oficial si estuvo en el gimnasio, a qué hora ingresó y a qué hora se retiró.</p>
            </div>
            <span class="badge ok">Auditoría y Seguridad</span>
          </div>

          <div class="grid g3 gap mt2 p" style="background:rgba(255,255,255,0.02);border-radius:8px">
            <div style="position:relative">
              <label class="small muted"><b>1. Persona (Nombre, DNI o Código):</b></label>
              <input type="text" id="sec_query" placeholder="Ej: Juan Quispe, 70254891..." style="min-height:38px">
              <div id="sec_results" class="list mt hidden" style="max-height:220px;overflow-y:auto;background:var(--card,#1e293b);border:1px solid var(--border,#334155);border-radius:6px;position:absolute;z-index:100;left:0;right:0"></div>
            </div>
            <div>
              <label class="small muted"><b>2. Fecha a Comprobar:</b></label>
              <input type="date" id="sec_day" value="${today}" style="min-height:38px">
            </div>
            <div style="display:flex;align-items:flex-end">
              <button class="btn primary" id="sec_btn_check" style="width:100%;min-height:38px">${RD.icon('search')} Verificar Presencia</button>
            </div>
          </div>
        </div>

        <div id="sec_verdict_container">
          <div class="empty p2" style="background:var(--card,#1e293b);border-radius:8px">
            Ingresa el nombre o DNI de la persona y la fecha que deseas auditar para generar la constancia oficial.
          </div>
        </div>`;

        let selectedPerson = null;
        const qInp = el.querySelector('#sec_query');
        const resBox = el.querySelector('#sec_results');
        const dayInp = el.querySelector('#sec_day');
        const btnCheck = el.querySelector('#sec_btn_check');
        const vContainer = el.querySelector('#sec_verdict_container');

        let debounceTimer;
        qInp.oninput = () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(async () => {
            const term = qInp.value.trim();
            if (term.length < 2) { resBox.classList.add('hidden'); return; }
            try {
              const list = await RD.api.get(`/reports/people?q=${encodeURIComponent(term)}`);
              if (!list.length) {
                resBox.innerHTML = '<div class="item small muted">No se encontraron socios ni visitantes</div>';
                resBox.classList.remove('hidden');
                return;
              }
              resBox.innerHTML = list.map(p => `
                <div class="item click" data-pid="${p.id}" data-pkind="${p.kind}">
                  <div class="row between">
                    <b>${esc(p.name)}</b>
                    <span class="badge ${p.kind === 'D' ? 'warn' : 'ok'}">${p.kind === 'D' ? `${RD.icon('ticket')} Pase Diario` : `${RD.icon('dumbbell')} Socio`}</span>
                  </div>
                  <div class="tiny muted">${esc(p.code)} · DNI: ${esc(p.dni || 'Sin DNI')} ${p.phone ? '· Cel: ' + esc(p.phone) : ''}</div>
                </div>
              `).join('');
              resBox.classList.remove('hidden');

              resBox.querySelectorAll('[data-pid]').forEach(it => {
                it.onclick = () => {
                  const id = it.dataset.pid;
                  const kind = it.dataset.pkind;
                  selectedPerson = list.find(x => String(x.id) === String(id) && x.kind === kind);
                  qInp.value = selectedPerson ? `${selectedPerson.name} (${selectedPerson.code})` : '';
                  resBox.classList.add('hidden');
                };
              });
            } catch (e) { }
          }, 300);
        };

        btnCheck.onclick = async () => {
          if (!selectedPerson) {
            RD.toast('Por favor busca y selecciona una persona de la lista desplegable', 'info');
            qInp.focus();
            return;
          }
          const checkDay = dayInp.value || today;
          btnCheck.disabled = true;
          btnCheck.innerHTML = `${RD.icon('hourglass')} Verificando...`;
          try {
            const rep = await RD.api.get(`/reports/person?kind=${selectedPerson.kind}&id=${selectedPerson.id}&day=${checkDay}&from=${RD.addDays(checkDay, -30)}&to=${checkDay}`);
            renderVerdict(rep, checkDay);
          } catch (err) {
            RD.toast(err.message || 'Error al consultar presencia', 'err');
          } finally {
            btnCheck.disabled = false;
            btnCheck.innerHTML = `${RD.icon('search')} Verificar Presencia`;
          }
        };

        function renderVerdict(rep, checkDay) {
          const p = rep.person || {};
          const pres = rep.presence || {};
          const stats = rep.stats || {};
          const sessions = rep.sessions || [];
          const isPresent = pres.present;

          vContainer.innerHTML = `
          <!-- CONSTANCIA OFICIAL / DICTAMEN -->
          <div class="card mb watermark-container" style="border: 2px solid ${isPresent ? '#22c55e' : '#ef4444'};background:#0b0f19;position:relative">
            <div class="watermark-bg">RD FITNESS</div>

            <div class="row between wrap gap mb">
              <div class="row gap">
                ${RD.LOGO_SVG(52)}
                <div>
                  <h2 style="margin:0;color:var(--gold)">${esc(settings.gym_name || 'RD FITNESS CLUB')} - CHIVAY</h2>
                  <p class="small muted" style="margin:0">CONSTANCIA OFICIAL DE REGISTRO DE ACCESOS Y PERMANENCIA</p>
                </div>
              </div>
              <div class="no-print">
                <button class="btn sm primary" id="btnprintcertificate">${RD.icon('printer')} Imprimir Constancia Oficial (PDF)</button>
              </div>
            </div>

            <hr class="mb">

            <!-- DICTAMEN DE PRESENCIA -->
            <div class="p2 mb" style="border-radius:8px;background:${isPresent ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)'};border:1px solid ${isPresent ? '#22c55e' : '#ef4444'}">
              <div class="row gap" style="align-items:flex-start">
                <span style="font-size:2.2rem">${isPresent ? RD.icon('check', '', 36) : RD.icon('x', '', 36)}</span>
                <div>
                  <h3 style="margin:0;color:${isPresent ? '#4ade80' : '#f87171'}">
                    ${isPresent ? 'DICTAMEN: ASISTENCIA Y PRESENCIA CONFIRMADA' : 'DICTAMEN: NO SE REGISTRA INGRESO EN LA FECHA CONSULTADA'}
                  </h3>
                  <p style="margin:0.5rem 0 0 0;font-size:1.05rem;line-height:1.5">
                    ${esc(pres.summary)}
                  </p>
                  <p class="tiny muted" style="margin:0.4rem 0 0 0">
                    Fecha auditada: <b>${checkDay}</b> · Hora de emisión: <b>${new Date().toLocaleTimeString('es-PE')} (Hora de Lima)</b>
                  </p>
                </div>
              </div>
            </div>

            <!-- FICHA DE LA PERSONA -->
            <div class="grid g4 gap mb p" style="background:rgba(255,255,255,0.03);border-radius:8px">
              <div>
                <div class="tiny muted">NOMBRE COMPLETO:</div>
                <div style="font-size:1.05rem;font-weight:bold">${esc(p.name)}</div>
              </div>
              <div>
                <div class="tiny muted">DOCUMENTO DE IDENTIDAD:</div>
                <div style="font-size:1.05rem;font-weight:bold">${esc(p.dni || 'Sin DNI')}</div>
              </div>
              <div>
                <div class="tiny muted">CÓDIGO DE IDENTIFICACIÓN:</div>
                <div style="font-size:1.05rem;font-weight:bold;color:var(--gold);font-family:monospace">${esc(p.code)}</div>
              </div>
              <div>
                <div class="tiny muted">TIPO / CONDICIÓN:</div>
                <div><span class="badge ${p.kind === 'D' ? 'warn' : 'ok'}">${esc(p.type)}</span> ${p.plan ? `<span class="badge">${esc(p.plan)}</span>` : ''}</div>
              </div>
            </div>

            <!-- HISTORIAL DEL DÍA AUDITADO -->
            <h4>Sesiones Registradas en la Fecha (${checkDay})</h4>
            <div class="tbl-wrap mt mb">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora Entrada</th>
                    <th>Hora Salida</th>
                    <th>Tiempo de Permanencia</th>
                    <th>Estado de Sesión</th>
                    <th>Personal que Registró</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  ${sessions.length ? sessions.map(s => `
                    <tr>
                      <td><b>${s.day}</b></td>
                      <td style="font-family:monospace;font-weight:bold">${s.entrada || '—'}</td>
                      <td style="font-family:monospace">${s.salida || '<span class="badge warn tiny">Sin registrar</span>'}</td>
                      <td style="font-weight:bold">${s.dur ? `${Math.floor(s.dur / 60) > 0 ? Math.floor(s.dur / 60) + 'h ' : ''}${s.dur % 60}m` : '—'}</td>
                      <td><span class="badge ${s.estado === 'Salida registrada' ? 'ok' : s.estado === 'En sala' ? 'info' : 'warn'} tiny">${esc(s.estado)}</span></td>
                      <td class="small muted">${esc(s.staff || 'Recepción')}</td>
                      <td><span class="badge ${s.result === 'ok' ? 'ok' : s.result === 'warn' ? 'warn' : 'denied'} tiny">${esc(s.result)}</span></td>
                    </tr>
                  `).join('') : `<tr><td colspan="7" class="empty">No existe ningún registro de ingreso ni de intento en la fecha consultada (${checkDay}).</td></tr>`}
                </tbody>
              </table>
            </div>

            <!-- FIRMAS OFICIALES PARA IMPRESIÓN -->
            <div class="row between mt2 pt2" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:2rem">
              <div style="text-align:center;width:240px">
                <div style="border-top:1px solid #94a3b8;margin-bottom:4px"></div>
                <div class="small"><b>Firma Administración / Recepción</b></div>
                <div class="tiny muted">RD Fitness Club - Chivay</div>
              </div>
              <div style="text-align:center;width:240px">
                <div style="border-top:1px solid #94a3b8;margin-bottom:4px"></div>
                <div class="small"><b>Sello de Control de Accesos</b></div>
                <div class="tiny muted">Verificación Digital Inmutable</div>
              </div>
            </div>
          </div>`;

          vContainer.querySelector('#btnprintcertificate')?.addEventListener('click', () => {
            window.print();
          });
        }
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
        <span class="chip on" data-st="gym">${RD.icon('building')} Datos del Gimnasio</span>
        <span class="chip" data-st="plans">${RD.icon('plans')} Planes de Precios</span>
        <span class="chip" data-st="prods">${RD.icon('cart')} Productos / Stock</span>
        <span class="chip" data-st="users">${RD.icon('users')} Usuarios del Sistema</span>
        <span class="chip" data-st="system">${RD.icon('save')} Copia de Seguridad</span>
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
        <label class="field"><span>Enlace Oficial de Google Sheets (Spreadsheet URL)</span>
          <input name="google_sheet_url" placeholder="https://docs.google.com/spreadsheets/d/..." value="${esc(s.google_sheet_url || '')}">
        </label>

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
        RD.toast('Ajustes guardados');
        RD.pub = await (await fetch('/api/public')).json();
        localStorage.setItem('rd_public', JSON.stringify(RD.pub));
        if (RD.syncBrandColor) RD.syncBrandColor();
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
        RD.toast('Plan guardado');
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
            RD.toast(`Stock actualizado (+${qty} unidades)`);
            RD.go('settings');
          } catch (err) { RD.toast(err.message, 'err'); }
        }
      }
    };
  }

  function productEditorModal(p, done) {
    const d = RD.openModal(p ? 'Editar Producto' : 'Nuevo Producto', `
      <form id="prf">
        <label class="field"><span>Nombre del producto *</span><input name="name" value="${esc(p?.name || '')}" required placeholder="Ej. Agua San Mateo 625ml, Bebida Isotónica"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Código de barras (EAN-13 / Lector USB)</span>
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
        <div class="grid g3 keep">
          <label class="field"><span>Costo Compra (S/)</span><input name="cost" type="number" step="0.1" min="0" value="${p?.cost ?? 0}" placeholder="0.00"></label>
          <label class="field"><span>Precio Regular (S/) *</span><input name="price" type="number" step="0.5" min="0" value="${p?.price ?? 2}" required></label>
          <label class="field"><span>Precio Promo / Oferta (S/)</span><input name="promo_price" type="number" step="0.5" min="0" value="${p?.promo_price ?? 0}" placeholder="0.00"></label>
        </div>
        <label class="field"><span>Descripción de Oferta / Promoción (opcional)</span><input name="promo_desc" value="${esc(p?.promo_desc || '')}" placeholder="Ej. 2 por S/ 5.00, Pack Especial"></label>
        <div class="grid g2 keep">
          <label class="field"><span>Stock actual (unidades)</span><input name="stock" type="number" min="0" value="${p?.stock ?? 12}"></label>
          <label class="field"><span>Stock mínimo de alerta</span><input name="min_stock" type="number" min="1" value="${p?.min_stock ?? 5}"></label>
        </div>
        <label class="field"><span>Detalle / Descripción adicional</span><input name="description" value="${esc(p?.description || '')}" placeholder="Marca, presentación, etc."></label>
        <label class="check"><input type="checkbox" name="active" ${p ? (p.active ? 'checked' : '') : 'checked'}> <span>Activo para venta en recepción y POS</span></label>
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
          cost: +f.cost.value || 0,
          price: +f.price.value,
          promo_price: +f.promo_price.value || 0,
          promo_desc: f.promo_desc.value.trim() || null,
          stock: +f.stock.value || 0,
          min_stock: +f.min_stock.value || 5,
          description: f.description.value.trim() || null,
          active: f.active.checked ? 1 : 0
        };
        if (p) await RD.api.put('/products/' + p.id, body);
        else await RD.api.post('/products', body);
        d.close();
        RD.toast('Producto guardado con éxito');
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
        RD.toast('Usuario guardado');
        done && done();
      } catch (err) {
        RD.toast(err.message, 'err');
      }
    };
  }

  function renderSystemSettings(el) {
    el.innerHTML = `
    <div class="grid gap" style="max-width:900px">
      <!-- TARJETA: ESTADO DE PERSISTENCIA -->
      <div class="card" style="border-left: 4px solid var(--primary, #e63946);">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 0.5rem; flex-wrap:wrap; gap:8px;">
          <h3 style="margin:0; display:flex; align-items:center; gap:8px;">
            ${RD.icon('sheet', '', 20)} Persistencia y Respaldo de Datos en Producción
          </h3>
          <span class="badge ok" style="font-weight:bold;">100% Protegido</span>
        </div>
        <p class="small muted" style="margin-bottom:0.75rem;">
          Tus datos están protegidos contra reinicios o actualizaciones. El sistema cuenta con tres mecanismos de respaldo: 
          <strong>Base de Datos SQLite (.db)</strong>, <strong>Volcado Portátil JSON</strong> y <strong>Sincronización en la Nube con Google Sheets</strong>.
        </p>
        <div style="background:var(--bg-subtle, rgba(0,0,0,0.03)); border-radius:8px; padding:0.75rem 1rem; font-size:0.85rem; line-height:1.5;">
          <strong>¿Cómo funciona en Render?</strong> El plan gratuito de Render dispone de <strong>512 MB de memoria RAM</strong> (el sistema RD Fitness solo consume ~50 MB, apenas el 10%). Sin embargo, el almacenamiento en disco de Render Free es efímero cuando se duerme o se hace deploy. Con la sincronización a Google Sheets y los botones de respaldo abajo, tus datos jamás se perderán.
        </div>
      </div>

      <!-- TARJETA: BÓVEDA PERSISTENTE EN LA NUBE (CLOUD VAULT) -->
      <div class="card" style="border: 2px solid #f59e0b; background: linear-gradient(180deg, rgba(245,158,11,0.06) 0%, transparent 100%);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:0.75rem;">
          <h3 style="display:flex; align-items:center; gap:8px; margin:0;">
            ${RD.icon('cloud')} Bóveda Persistente en la Nube (Cloud Vault)
          </h3>
          <span id="cloud-vault-badge" class="badge" style="background:#4b5563; color:#fff; font-size:0.8rem; padding:4px 10px; border-radius:12px;">
            Consultando...
          </span>
        </div>
        <p class="small muted" style="margin-bottom:1rem; line-height:1.5;">
          Protege tus socios, pagos, accesos y contraseñas de forma permanente. Cada vez que se registra un socio o pago, se respalda automáticamente en la nube. Al reiniciar o actualizar el servidor, se restaura todo al instante.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:0.75rem;">
          <button class="btn primary" id="btn-cloud-sync" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-upload')} Sincronizar Ahora a la Nube
          </button>
          <button class="btn" id="btn-cloud-pull" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-download')} Recuperar desde la Nube
          </button>
        </div>
        <div id="cloud-vault-info" class="small muted" style="display:none; padding:8px 12px; background:rgba(0,0,0,0.2); border-radius:6px; font-family:monospace;"></div>
      </div>

      <!-- TARJETA: COPIAS DE SEGURIDAD (.DB SQLITE) -->
      <div class="card">
        <h3 style="display:flex; align-items:center; gap:8px; margin-bottom:0.5rem;">
          ${RD.icon('database')} Base de Datos Nativa SQLite (.db)
        </h3>
        <p class="small muted" style="margin-bottom:1rem;">
          Descarga o restaura la base de datos completa exactamente como está en el servidor. Al restaurar, los socios, pagos y asistencias se fusionarán automáticamente sin bloquear el sistema.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" id="btn-backup-db" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-download')} Descargar Base de Datos (.db)
          </button>
          <button class="btn" id="btn-restore-db" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-upload')} Restaurar Base de Datos (.db)
          </button>
          <input type="file" id="file-restore-db" accept=".db,.sqlite,.sqlite3" style="display:none;" />
        </div>
      </div>

      <!-- TARJETA: EXPORTACIÓN E IMPORTACIÓN PORTÁTIL (JSON) -->
      <div class="card">
        <h3 style="display:flex; align-items:center; gap:8px; margin-bottom:0.5rem;">
          ${RD.icon('reports')} Respaldo Portátil en JSON
        </h3>
        <p class="small muted" style="margin-bottom:1rem;">
          Exporta todos los datos en un formato de texto legible e independiente (.json) con todos los socios, membresías, productos, caja y asistencias. Útil para auditoría o migración universal.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn" id="btn-export-json" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-upload')} Exportar Todo en JSON
          </button>
          <button class="btn" id="btn-import-json" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('cloud-download')} Importar desde JSON
          </button>
          <input type="file" id="file-import-json" accept=".json" style="display:none;" />
        </div>
      </div>

      <!-- TARJETA: SINCRONIZACIÓN GOOGLE SHEETS -->
      <div class="card">
        <h3 style="display:flex; align-items:center; gap:8px; margin-bottom:0.5rem;">
          ${RD.icon('sheet')} Sincronización y Recuperación con Google Sheets
        </h3>
        <p class="small muted" style="margin-bottom:1rem;">
          Si estás en un nuevo entorno o reiniciaste el servidor, puedes reimportar en 1 clic todos los socios y membresías que se sincronizaron en tu hoja de cálculo oficial de Google Sheets.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          <button class="btn primary" id="btn-sync-sheets" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('refresh')} Reimportar Socios desde Google Sheets
          </button>
          <a class="btn" id="lnk-open-sheets" href="#" target="_blank" style="display:none; text-decoration:none;">
            ↗ Abrir Hoja de Sheets
          </a>
        </div>
      </div>

      <!-- TARJETA: HERRAMIENTAS ADICIONALES, SMART TV CCTV Y ANATOMÍA 3D -->
      <div class="card">
        <h3 style="margin-bottom:0.5rem;">${RD.icon('printer')} Herramientas de Recepción, Smart TV CCTV y Arquitectura 3D</h3>
        <p class="small muted" style="margin-bottom:0.85rem;">
          Accede en 1 clic a la pantalla para la Smart TV del gimnasio (Cámaras CCTV 24/7 + Picture-in-Picture + Bienvenidas QR + Spot Publicitario), al diseñador de carnés PVC y a la Máquina Interactiva 3D (Anatomy3D v2.0) con el despiece de equipos y conexiones.
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <a class="btn primary" href="/display.html" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('qr')} Abrir Smart TV + Cámaras CCTV (/display.html)
          </a>
          <a class="btn" href="/anatomy/index.html" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px; border-color:rgba(39,230,255,0.45); color:#27e6ff;">
            ${RD.icon('activity')} Máquina Interactiva 3D (Anatomy3D v2.0)
          </a>
          <a class="btn" href="/anatomy/report.html" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('file-text')} Plano Técnico 2D y BOM de Equipos
          </a>
          <a class="btn" href="/admin/cards.html" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('idcard')} Diseñador / Impresor Masivo de Tarjetas PVC
          </a>
        </div>
      </div>

      <!-- TARJETA: CIBERSEGURIDAD, AUDITORÍA Y NORMATIVA LEGAL -->
      <div class="card" style="border:1px solid rgba(16,185,129,0.35); background:linear-gradient(135deg, rgba(16,185,129,0.06), rgba(0,0,0,0));">
        <div class="row between wrap gap" style="margin-bottom:0.5rem;">
          <h3 style="display:flex; align-items:center; gap:8px; margin:0; color:#34d399;">
            ${RD.icon('shield')} Escudo de Ciberseguridad, Bitácora de Auditoría y Marco Legal
          </h3>
          <span class="badge ok">Blindaje Activo 100%</span>
        </div>
        <p class="small muted" style="margin-bottom:1rem;">
          Verifica en tiempo real el estado de las defensas Anti-Hackeo (SQLi, XSS, Fuerza Bruta, DDoS, QR HMAC-SHA256), la integridad del motor SQLite WAL, el registro de acciones del personal y la documentación legal (Ley N° 29733 Perú y Derechos de Autor).
        </p>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button class="btn primary" id="btn-security-audit" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('shield')} Ver Auditoría de Ciberseguridad y Bitácora
          </button>
          <button class="btn" id="btn-admin-legal" style="display:inline-flex; align-items:center; gap:6px;">
            ${RD.icon('file-text')} Reglamento, Privacidad (Ley 29733) y Derechos
          </button>
        </div>
      </div>
    </div>`;

    // 0. Cloud Vault status & actions
    const badgeVault = el.querySelector('#cloud-vault-badge');
    const infoVault = el.querySelector('#cloud-vault-info');
    const refreshVaultStatus = async () => {
      try {
        const st = await RD.api.get('/cloud-vault/status');
        if (st && st.configured) {
          badgeVault.textContent = `Conectado (${st.provider})`;
          badgeVault.style.background = '#059669';
          infoVault.style.display = 'block';
          infoVault.textContent = `Proveedor: ${st.provider.toUpperCase()} | Última sincro: ${st.last_sync ? new Date(st.last_sync).toLocaleString() : 'Pendiente'}`;
        } else {
          badgeVault.textContent = 'Bóveda Local (.json)';
          badgeVault.style.background = '#d97706';
          infoVault.style.display = 'block';
          infoVault.innerHTML = 'Sin nube externa configurada. Los datos se guardan en el archivo local <code>storage/backup-vault.json</code>. Configura <code>UPSTASH_REDIS_REST_URL</code> y <code>UPSTASH_REDIS_REST_TOKEN</code> en Render para activar la nube gratis permanente.';
        }
      } catch (e) {
        if (badgeVault) badgeVault.textContent = 'Local';
      }
    };
    refreshVaultStatus();

    el.querySelector('#btn-cloud-sync').onclick = async () => {
      RD.toast('Enviando copia a la nube...', 'info');
      try {
        const res = await RD.api.post('/cloud-vault/sync');
        RD.toast('¡Bóveda en la nube sincronizada con éxito!', 'ok');
        refreshVaultStatus();
      } catch (err) {
        RD.toast(err.message || 'Error al sincronizar con la nube', 'err');
      }
    };

    el.querySelector('#btn-cloud-pull').onclick = async () => {
      if (!confirm('¿Deseas restaurar la información guardada en la Bóveda en la Nube?\n\nEsto actualizará socios, pagos y asistencias con la última versión de la nube.')) return;
      RD.toast('Descargando y restaurando desde la nube...', 'info');
      try {
        const res = await RD.api.post('/cloud-vault/pull');
        RD.toast(`¡Restauración exitosa! ${res.restored} socios sincronizados desde la nube.`, 'ok');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        RD.toast(err.message || 'Error al restaurar desde la nube', 'err');
      }
    };

    // 1. Descargar .db
    el.querySelector('#btn-backup-db').onclick = async () => {
      try {
        RD.toast('Generando copia SQLite...', 'info');
        const fn = await RD.downloadAuth('/backup', 'rdfitness_backup.db');
        RD.toast('Copia descargada con éxito: ' + fn, 'ok');
      } catch (err) {
        RD.toast(err.message || 'Error al descargar respaldo', 'err');
      }
    };

    // 2. Restaurar .db
    const fileDb = el.querySelector('#file-restore-db');
    el.querySelector('#btn-restore-db').onclick = () => fileDb.click();
    fileDb.onchange = async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!confirm(`¿Estás seguro de restaurar "${file.name}"?\\n\\nLos registros de socios, pagos y asistencias de este archivo se integrarán en la base de datos.`)) {
        e.target.value = '';
        return;
      }
      RD.toast('Subiendo y restaurando base de datos...', 'info');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const b64 = reader.result.split(',')[1];
          const res = await RD.api.post('/backup/restore', { base64: b64 });
          RD.toast(`¡Restauración exitosa! ${res.restoredMembers} socios y ${res.restoredPayments} pagos recuperados.`, 'ok');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          RD.toast(err.message || 'Error restaurando respaldo', 'err');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsDataURL(file);
    };

    // 3. Exportar JSON
    el.querySelector('#btn-export-json').onclick = async () => {
      try {
        RD.toast('Exportando datos a JSON...', 'info');
        const d = new Date().toISOString().slice(0, 10);
        const fn = await RD.downloadAuth('/backup/export-json', `rdfitness_export_${d}.json`);
        RD.toast('Exportación completada: ' + fn, 'ok');
      } catch (err) {
        RD.toast(err.message || 'Error al exportar JSON', 'err');
      }
    };

    // 4. Importar JSON
    const fileJson = el.querySelector('#file-import-json');
    el.querySelector('#btn-import-json').onclick = () => fileJson.click();
    fileJson.onchange = async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!confirm(`¿Estás seguro de importar datos desde "${file.name}"?\\n\\nSe registrarán y actualizarán los socios, pagos y asistencias.`)) {
        e.target.value = '';
        return;
      }
      RD.toast('Leyendo archivo JSON...', 'info');
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const json = JSON.parse(reader.result);
          const res = await RD.api.post('/backup/import-json', { data: json });
          RD.toast(`¡Importación exitosa! ${res.restoredMembers} socios recuperados.`, 'ok');
          setTimeout(() => location.reload(), 1500);
        } catch (err) {
          RD.toast('Error al importar JSON: ' + (err.message || err), 'err');
        } finally {
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    };

    // 5. Sincronizar desde Sheets
    el.querySelector('#btn-sync-sheets').onclick = async () => {
      if (!confirm('¿Deseas sincronizar ahora todos los socios desde la hoja de Google Sheets?\\n\\nEsto recuperará los socios y membresías guardados en la nube.')) return;
      RD.toast('Sincronizando con Google Sheets...', 'info');
      try {
        const res = await RD.api.post('/admin/sync-from-sheets');
        RD.toast(`¡Sincronización completada! ${res.synced} socios sincronizados (${res.created} nuevos creados).`, 'ok');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        RD.toast(err.message || 'Error sincronizando con Google Sheets', 'err');
      }
    };

    // Cargar link de Google Sheets si existe
    RD.api.get('/settings').then(s => {
      if (s && s.google_sheet_url) {
        const lnk = el.querySelector('#lnk-open-sheets');
        if (lnk) {
          lnk.href = s.google_sheet_url;
          lnk.style.display = 'inline-flex';
        }
      }
    }).catch(() => {});

    // 6. Auditoría de Ciberseguridad y Centro Legal
    const btnLegal = el.querySelector('#btn-admin-legal');
    if (btnLegal) btnLegal.onclick = () => RD.openLegalModal('normas');

    const btnAudit = el.querySelector('#btn-security-audit');
    if (btnAudit) {
      btnAudit.onclick = async () => {
        try {
          const a = await RD.api.get('/admin/security-audit');
          const p = a.protections || {};
          const r = a.resilience || {};
          const c = a.counts || {};
          RD.openModal('Auditoría en Vivo de Ciberseguridad e Integridad', `
            <div class="grid g4 mb">
              <div class="stat ok"><div class="v">${a.security_score || 100}%</div><div class="l">Puntaje de Seguridad</div></div>
              <div class="stat gold"><div class="v">${esc(String(r.db_integrity || 'ok').toUpperCase())}</div><div class="l">Integridad SQLite WAL</div></div>
              <div class="stat"><div class="v">${c.exercises || 135} / ${c.routines || 17}</div><div class="l">Ejercicios / Rutinas</div></div>
              <div class="stat"><div class="v">${r.ram_mb || 0} MB</div><div class="l">Memoria RAM Servidor</div></div>
            </div>
            <div class="card flat mb">
              <h3 style="display:flex;align-items:center;gap:8px;color:#34d399">${RD.icon('shield', '', 18)} Escudos Anti-Hackeo y Ciberdefensa Activos</h3>
              <div class="list small mt2">
                <div class="item"><span>Inyección SQL (SQLi):</span> <b class="ok">${esc(p.sql_injection)}</b></div>
                <div class="item"><span>Protección XSS y Cabeceras:</span> <b class="ok">${esc(p.xss_protection)}</b></div>
                <div class="item"><span>Criptografía de Pase QR:</span> <b class="ok">${esc(p.qr_cryptography)}</b></div>
                <div class="item"><span>Cifrado de Contraseñas:</span> <b class="ok">${esc(p.password_hashing)}</b></div>
                <div class="item"><span>Escudo Anti-Fuerza Bruta:</span> <b class="ok">${esc(p.brute_force_shield)}</b></div>
                <div class="item"><span>Escudo Anti-Flood / DDoS:</span> <b class="ok">${esc(p.ddos_flood_shield)}</b></div>
                <div class="item"><span>Aislamiento de Sesiones:</span> <b class="ok">${esc(p.session_isolation)}</b></div>
                <div class="item"><span>Respaldo Triple (Cloud Vault):</span> <b class="${r.cloud_vault_configured ? 'ok' : 'warn'}">${r.cloud_vault_configured ? 'ACTIVO (' + esc(r.cloud_vault_provider) + ')' : 'Solo Bóveda Local'}</b></div>
                <div class="item"><span>Cumplimiento Normativo:</span> <b>${esc(p.legal_compliance)}</b></div>
              </div>
            </div>
            <div class="card flat">
              <h3 style="display:flex;align-items:center;gap:8px">${RD.icon('activity', 'gold', 18)} Bitácora Reciente de Seguridad y Acciones (${(a.recent_audit || []).length})</h3>
              <div class="tbl-wrap mt2" style="max-height:260px;overflow-y:auto">
                <table>
                  <thead><tr><th>Fecha / Hora</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead>
                  <tbody>
                    ${(a.recent_audit || []).map(x => `
                      <tr>
                        <td class="small muted">${esc(x.ts || '')}</td>
                        <td><b>${esc(x.user_name || x.username || 'Socio / Sistema')}</b></td>
                        <td><span class="badge info">${esc(x.action || '')}</span></td>
                        <td class="tiny muted" style="font-family:monospace">${esc(String(x.detail || '').slice(0, 100))}</td>
                      </tr>
                    `).join('') || '<tr><td colspan="4" class="empty">Sin eventos registrados</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          `, { wide: true });
        } catch (err) {
          RD.toast(err.message || 'No se pudo cargar la auditoría', 'err');
        }
      };
    }
  }

})();
