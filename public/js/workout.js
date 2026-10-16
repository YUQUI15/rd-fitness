/* RD Fitness Club - Módulo de Ejercicios, Entrenador Digital, Cronómetros, Calculadoras Pro y Gráficos */
(function () {
  const RD = window.RD;
  const { esc, money } = RD;

  // ---------- 1. Visualización de Ejercicios ----------
  RD.exThumb = ex => ex.imagenes && ex.imagenes[0]
    ? `<img loading="lazy" src="${esc(ex.imagenes[0])}" alt="${esc(ex.nombre)}">`
    : `<div class="avatar" style="width:84px;height:84px;border-radius:10px;font-size:1.8rem">${RD.groupIconSvg(ex.grupo, '', 36)}</div>`;

  RD.exCard = ex => `
    <div class="ex-card" data-ex="${esc(ex.id)}">
      ${RD.exThumb(ex)}
      <div class="grow">
        <b>${esc(ex.nombre)}</b>
        <div class="muted small">${esc(ex.grupo)} · ${esc(ex.equipo || 'Sin equipo')}</div>
        <div class="chips mt2">
          <span class="badge info">${esc(ex.nivel || 'Todos')}</span>
          <span class="badge">${esc(ex.tipo || 'Fuerza')}</span>
        </div>
      </div>
    </div>`;

  RD.exDetailHTML = ex => {
    const imgs = ex.imagenes || [];
    const pics = imgs.length >= 2
      ? `<div class="gifflip" title="Toca para ver el movimiento"><img src="${esc(imgs[0])}" alt="Inicio"><img class="b" src="${esc(imgs[1])}" alt="Final"></div>
         <div class="ex-imgs mt2"><figure><img src="${esc(imgs[0])}" alt="Posición inicial"><figcaption>1 · Inicio</figcaption></figure><figure><img src="${esc(imgs[1])}" alt="Posición final"><figcaption>2 · Final</figcaption></figure></div>`
      : imgs.length ? `<img src="${esc(imgs[0])}" style="width:100%;border-radius:12px" alt="">` : '';
    return `${pics}
      <div class="chips mt">
        <span class="badge info">${esc(ex.grupo || '')}</span>
        <span class="badge">${esc(ex.tipo || '')}</span>
        <span class="badge">${esc(ex.equipo || '')}</span>
        <span class="badge">${esc(ex.nivel || '')}</span>
      </div>
      <p class="small mt2"><b>Músculos implicados:</b> ${esc(ex.musculos || '—')}</p>
      ${ex.efecto ? `<div class="tip"><b>¿Para qué sirve?</b> ${esc(ex.efecto)}</div>` : ''}
      <h3 class="mt">Técnica paso a paso</h3>
      <ol class="steps">${(ex.pasos || []).map(s => `<li><div>${esc(s)}</div></li>`).join('')}</ol>
      ${(ex.errores || []).length ? `<div class="err"><b>Errores comunes a evitar</b><ul style="margin:.3rem 0 0 1rem;padding:0">${ex.errores.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      ${ex.consejo ? `<div class="tip"><b>Consejo biomecánico:</b> ${esc(ex.consejo)}</div>` : ''}
      ${ex.variante ? `<p class="small muted"><b>Variantes:</b> ${esc(ex.variante)}</p>` : ''}
      <div class="row gap mt">
        <button class="btn sm ghost" onclick="RD.openPlateCalculator(60)" style="display:flex;align-items:center;gap:5px">${RD.icon('layers', '', 14)} Calcular discos de barra</button>
        <button class="btn sm primary" onclick="RD.open1RMCalculator(70, 8)" style="display:flex;align-items:center;gap:5px">${RD.icon('dumbbell', '', 14)} Calcular mi 1RM</button>
      </div>`;
  };

  RD.openExercise = ex => RD.openModal(ex.nombre, RD.exDetailHTML(ex), { wide: true });

  // Biblioteca con búsqueda avanzada y filtros por grupo y equipamiento
  RD.exerciseLibrary = (el, list, onPick) => {
    const groups = ['Todos', 'Piernas', 'Glúteos', 'Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazos', 'Trapecio', 'Core', 'Cardio', 'Movilidad'];
    let g = 'Todos', eq = 'Todos', t = '';

    el.innerHTML = `
      <div class="row gap mb">
        <input id="exq" placeholder="Buscar ejercicio, músculo o equipo…" autocomplete="off" style="flex:1">
        <select id="exeq" style="max-width:140px">
          <option value="Todos">Cualquier equipo</option>
          <option value="Barra">Barra</option>
          <option value="Mancuerna">Mancuernas</option>
          <option value="Polea">Poleas</option>
          <option value="Máquina">Máquinas</option>
          <option value="Sin equipo">Peso corporal</option>
        </select>
      </div>
      <div class="chips mb" id="exg">
        ${groups.map(x => `<span class="chip ${x === 'Todos' ? 'on' : ''}" data-g="${esc(x)}">${esc(x)}</span>`).join('')}
      </div>
      <div class="row between mb small muted">
        <span id="excount">Mostrando ${list.length} ejercicios</span>
        <span>${onPick ? 'Toca uno para seleccionarlo' : 'Toca uno para ver técnica'}</span>
      </div>
      <div class="grid g2" id="exl"></div>`;

    const countEl = el.querySelector('#excount');
    const draw = () => {
      const q = t.toLowerCase();
      const items = list.filter(e => {
        const matchG = g === 'Todos' || e.grupo === g;
        const matchEq = eq === 'Todos' || (e.equipo || '').toLowerCase().includes(eq.toLowerCase());
        const matchQ = !q || [e.nombre, e.musculos, e.equipo, e.grupo, e.tipo].some(v => String(v || '').toLowerCase().includes(q));
        return matchG && matchEq && matchQ;
      });
      if (countEl) countEl.textContent = `Mostrando ${items.length} de ${list.length} ejercicios`;
      el.querySelector('#exl').innerHTML = items.map(RD.exCard).join('') || '<div class="empty">No se encontraron ejercicios con este criterio</div>';
    };

    el.querySelector('#exq').oninput = RD.debounce(e => { t = e.target.value.trim(); draw(); }, 150);
    el.querySelector('#exeq').onchange = e => { eq = e.target.value; draw(); };
    el.querySelector('#exg').onclick = e => {
      const c = e.target.closest('[data-g]');
      if (!c) return;
      g = c.dataset.g;
      el.querySelectorAll('#exg .chip').forEach(x => x.classList.toggle('on', x === c));
      draw();
    };
    el.querySelector('#exl').onclick = e => {
      const c = e.target.closest('[data-ex]');
      if (!c) return;
      const ex = list.find(x => x.id === c.dataset.ex);
      if (!ex) return;
      onPick ? onPick(ex) : RD.openExercise(ex);
    };
    draw();
  };

  // ---------- 2. Cuenta Regresiva y Cronómetros ----------
  function Countdown() {
    let end = 0, timer = null, onTick, onDone, lastWhole = -1, paused = 0;
    return {
      start(secs, tick, done) {
        this.stop();
        end = Date.now() + secs * 1000;
        onTick = tick;
        onDone = done;
        lastWhole = -1;
        timer = setInterval(() => this._t(), 150);
        this._t();
      },
      _t() {
        const rem = Math.max(0, (end - Date.now()) / 1000), whole = Math.ceil(rem);
        if (whole !== lastWhole) {
          lastWhole = whole;
          onTick && onTick(whole, rem);
          if (whole > 0 && whole <= 3) RD.beep('tick');
        }
        if (rem <= 0) {
          const d = onDone;
          this.stop();
          d && d();
        }
      },
      add(s) { end += s * 1000; this._t(); },
      pause() { if (timer) { paused = end - Date.now(); clearInterval(timer); timer = null; } },
      resume() { if (!timer && paused) { end = Date.now() + paused; paused = 0; timer = setInterval(() => this._t(), 150); } },
      get running() { return !!timer; },
      stop() { clearInterval(timer); timer = null; paused = 0; }
    };
  }
  RD.Countdown = Countdown;
  const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  RD.timersTool = el => {
    const presets = [
      [`${RD.icon('timer', 'gold', 18)} <span>Cuenta regresiva</span>`, 'countdown'],
      [`${RD.icon('stopwatch', 'gold', 18)} <span>Cronómetro con vueltas</span>`, 'stopwatch'],
      [`${RD.icon('flame', 'gold', 18)} <span>Tabata (20/10 × 8)</span>`, 'tabata'],
      [`${RD.icon('zap', 'gold', 18)} <span>HIIT personalizado</span>`, 'hiit'],
      [`${RD.icon('clock', 'gold', 18)} <span>EMOM (cada minuto)</span>`, 'emom'],
      [`${RD.icon('award', 'gold', 18)} <span>AMRAP (tiempo límite)</span>`, 'amrap'],
      [`${RD.icon('activity', 'gold', 18)} <span>Descanso rápido</span>`, 'rest']
    ];
    const home = () => {
      el.innerHTML = `<div class="grid">${presets.map(([l, k]) => `<button class="btn block" data-k="${k}" style="justify-content:flex-start;padding:0.9rem 1.2rem;display:flex;align-items:center;gap:10px">${l}</button>`).join('')}</div>
        <p class="muted small mt">Los cronómetros funcionan sin internet y emiten sonido y vibración al cambiar de intervalo.</p>`;
      el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => config(b.dataset.k));
    };
    const field = (id, label, v, min = 1, max = 3600) => `<label class="field"><span>${label}</span><input id="${id}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${v}"></label>`;
    function config(kind) {
      if (kind === 'stopwatch') return stopwatch();
      if (kind === 'tabata') return runPhases(buildHiit(20, 10, 8, 'tabata'), 'Tabata');
      let body = '';
      if (kind === 'countdown') body = field('m', 'Minutos', 1) + field('s', 'Segundos', 0, 0, 59);
      if (kind === 'hiit') body = field('w', 'Trabajo (seg)', 40) + field('r', 'Descanso (seg)', 20) + field('n', 'Rondas', 10);
      if (kind === 'emom') body = field('n', 'Minutos totales', 10) + field('p', 'Segundos por intervalo', 60, 10, 300);
      if (kind === 'amrap') body = field('m', 'Minutos', 12);
      if (kind === 'rest') {
        el.innerHTML = `<button class="btn ghost sm" id="back" style="display:flex;align-items:center;gap:5px">${RD.icon('chevron-left', '', 14)} Volver</button><div class="grid g3 keep mt">${[30, 45, 60, 90, 120, 180].map(s => `<button class="btn" data-s="${s}">${s < 60 ? s + ' s' : (s / 60) + ' min'}</button>`).join('')}</div>`;
        el.querySelector('#back').onclick = home;
        el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => runPhases([{ label: 'Descanso', secs: +b.dataset.s, kind: 'rest' }], 'Descanso'));
        return;
      }
      el.innerHTML = `<button class="btn ghost sm" id="back" style="display:flex;align-items:center;gap:5px">${RD.icon('chevron-left', '', 14)} Volver</button><div class="mt">${body}</div><button class="btn primary block" id="go" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('play', '', 16)} Iniciar</button>`;
      el.querySelector('#back').onclick = home;
      el.querySelector('#go').onclick = () => {
        const v = id => Math.max(0, parseInt(el.querySelector('#' + id)?.value, 10) || 0);
        if (kind === 'countdown') { const t = v('m') * 60 + v('s'); if (t < 1) return RD.toast('Indica un tiempo', 'warn'); runPhases([{ label: 'Tiempo', secs: t, kind: 'work' }], 'Cuenta regresiva'); }
        if (kind === 'hiit') { if (!v('w') || !v('n')) return RD.toast('Completa los datos', 'warn'); runPhases(buildHiit(v('w'), v('r'), v('n'), 'hiit'), 'HIIT'); }
        if (kind === 'emom') { const n = v('n'), p = v('p') || 60; if (!n) return; runPhases(Array.from({ length: n }, (_, i) => ({ label: `Minuto ${i + 1}/${n}`, secs: p, kind: 'work' })), 'EMOM'); }
        if (kind === 'amrap') { if (!v('m')) return; runPhases([{ label: 'AMRAP: tantas rondas como puedas', secs: v('m') * 60, kind: 'work' }], 'AMRAP'); }
      };
    }
    const buildHiit = (w, r, n) => {
      const ph = [{ label: 'Prepárate', secs: 5, kind: 'rest' }];
      for (let i = 1; i <= n; i++) {
        ph.push({ label: `¡TRABAJA! ${i}/${n}`, secs: w, kind: 'work' });
        if (r && i < n) ph.push({ label: `Descanso (siguiente ${i + 1}/${n})`, secs: r, kind: 'rest' });
      }
      return ph;
    };
    function runPhases(phases, title) {
      const cd = Countdown(); let i = 0, total = phases.reduce((a, p) => a + p.secs, 0), doneSecs = 0, running = true;
      el.innerHTML = `<div class="center"><div class="muted">${esc(title)}</div><div class="timer-big" id="tb">0:00</div><h2 id="lb"></h2><div class="progress mt"><i id="pg" style="width:0"></i></div>
        <div class="muted small mt2" id="inf"></div>
        <div class="row gap mt" style="justify-content:center"><button class="btn" id="pp" style="display:flex;align-items:center;gap:6px">${RD.icon('pause', '', 16)} Pausar</button><button class="btn" id="sk" style="display:flex;align-items:center;gap:6px">${RD.icon('chevron-right', '', 16)} Saltar</button><button class="btn danger" id="st" style="display:flex;align-items:center;gap:6px">${RD.icon('power', '', 16)} Terminar</button></div></div>`;
      const tb = el.querySelector('#tb');
      const next = () => {
        if (i >= phases.length) { RD.beep('done'); tb.textContent = '¡Listo!'; tb.className = 'timer-big'; el.querySelector('#lb').innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px">${RD.icon('check-circle', 'ok', 22)} <span>Completado</span></span>`; el.querySelector('#pg').style.width = '100%'; el.querySelector('#pp').disabled = el.querySelector('#sk').disabled = true; return; }
        const p = phases[i]; tb.className = 'timer-big ' + (p.kind === 'work' ? 'work' : 'rest'); el.querySelector('#lb').textContent = p.label;
        if (i > 0) RD.beep(p.kind === 'work' ? 'ok' : 'warn');
        el.querySelector('#inf').textContent = `Fase ${i + 1} de ${phases.length}`;
        cd.start(p.secs, s => { tb.textContent = mmss(s); el.querySelector('#pg').style.width = Math.min(100, (doneSecs + (p.secs - s)) / total * 100) + '%'; }, () => { doneSecs += p.secs; i++; next(); });
      };
      el.querySelector('#pp').onclick = e => { if (running) { cd.pause(); e.currentTarget.innerHTML = `${RD.icon('play', '', 16)} Continuar`; } else { cd.resume(); e.currentTarget.innerHTML = `${RD.icon('pause', '', 16)} Pausar`; } running = !running; };
      el.querySelector('#sk').onclick = () => { cd.stop(); doneSecs += phases[i].secs; i++; next(); };
      el.querySelector('#st').onclick = () => { cd.stop(); home(); };
      next();
    }
    function stopwatch() {
      let t0 = 0, acc = 0, timer = null, laps = [];
      el.innerHTML = `<button class="btn ghost sm" id="back">← Volver</button><div class="timer-big mt" id="tb">0:00.0</div>
        <div class="row gap mt" style="justify-content:center"><button class="btn primary" id="ss">${RD.icon('play')} Iniciar</button><button class="btn" id="lap">Vuelta</button><button class="btn" id="rs">Reiniciar</button></div><div class="list mt" id="laps"></div>`;
      const tb = el.querySelector('#tb'); const cur = () => acc + (timer ? Date.now() - t0 : 0);
      const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`;
      const tick = () => tb.textContent = fmt(cur());
      el.querySelector('#ss').onclick = e => { if (timer) { acc += Date.now() - t0; clearInterval(timer); timer = null; e.currentTarget.innerHTML = `${RD.icon('play')} Continuar`; } else { t0 = Date.now(); timer = setInterval(tick, 100); e.currentTarget.innerHTML = `${RD.icon('pause')} Pausar`; } };
      el.querySelector('#lap').onclick = () => { if (!timer) return; laps.unshift(cur()); el.querySelector('#laps').innerHTML = laps.map((l, i) => `<div class="item"><b>#${laps.length - i}</b><span class="grow right">${fmt(l)}</span></div>`).join(''); };
      el.querySelector('#rs').onclick = () => { clearInterval(timer); timer = null; acc = 0; laps = []; tb.textContent = '0:00.0'; el.querySelector('#ss').innerHTML = `${RD.icon('play')} Iniciar`; el.querySelector('#laps').innerHTML = ''; };
      el.querySelector('#back').onclick = () => { clearInterval(timer); home(); };
    }
    home();
  };

  // ---------- 3. Calculadoras Deportivas Profesionales ----------

  // Calculadora Científica de 1RM
  RD.calc1RM = (weight, reps) => {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps, 10) || 1;
    if (w <= 0 || r <= 0) return { oneRM: 0, percentages: [] };
    let oneRM;
    if (r === 1) {
      oneRM = w;
    } else {
      const epley = w * (1 + r / 30);
      const brzycki = r < 37 ? w * (36 / (37 - r)) : epley;
      oneRM = Math.round(((epley + brzycki) / 2) * 10) / 10;
    }
    const pctList = [
      { pct: 100, reps: '1', goal: 'Fuerza Máxima (1RM)' },
      { pct: 95, reps: '2', goal: 'Potencia / Fuerza' },
      { pct: 90, reps: '3 - 4', goal: 'Fuerza Pura' },
      { pct: 85, reps: '5 - 6', goal: 'Fuerza & Hipertrofia' },
      { pct: 80, reps: '7 - 8', goal: 'Hipertrofia Óptima' },
      { pct: 75, reps: '9 - 10', goal: 'Hipertrofia & Bombeo' },
      { pct: 70, reps: '11 - 12', goal: 'Hipertrofia Metabólica' },
      { pct: 65, reps: '15+', goal: 'Resistencia Muscular' }
    ];
    const percentages = pctList.map(item => ({
      ...item,
      weight: Math.round((oneRM * item.pct / 100) * 10) / 10
    }));
    return { oneRM, percentages };
  };

  RD.open1RMCalculator = (defaultWeight = 70, defaultReps = 8) => {
    const m = RD.openModal('Calculadora de 1RM y Porcentajes', `
      <div class="mb">
        <p class="muted small mb">Calcula tu peso máximo a 1 repetición (1RM) con fórmulas científicas (Epley & Brzycki) para saber exactamente cuánto levantar según tu objetivo.</p>
        <div class="grid g2 keep mb">
          <label class="field"><span>Peso levantado (kg)</span><input id="rm_w" type="number" step="0.5" value="${defaultWeight}"></label>
          <label class="field"><span>Repeticiones logradas</span><input id="rm_r" type="number" min="1" max="30" value="${defaultReps}"></label>
        </div>
      </div>
      <div class="card center mb" style="background:rgba(183,110,121,0.12);border-color:var(--gold)">
        <div class="muted small">Tu 1RM Estimado</div>
        <div class="gold" id="rm_res" style="font-size:2.4rem;font-weight:900">-- kg</div>
        <div class="small muted">Peso teórico máximo para 1 repetición limpia</div>
      </div>
      <h4>Tabla de Cargas de Trabajo:</h4>
      <div class="tbl-wrap">
        <table class="rm-table">
          <thead><tr><th>Intensidad</th><th>Repeticiones</th><th>Peso a Cargar</th><th>Objetivo</th></tr></thead>
          <tbody id="rm_table_body"></tbody>
        </table>
      </div>
    `);

    const calc = () => {
      const w = m.el.querySelector('#rm_w').value;
      const r = m.el.querySelector('#rm_r').value;
      const res = RD.calc1RM(w, r);
      m.el.querySelector('#rm_res').textContent = `${res.oneRM} kg`;
      m.el.querySelector('#rm_table_body').innerHTML = res.percentages.map(p => `
        <tr>
          <td><b>${p.pct}%</b></td>
          <td>${p.reps}</td>
          <td class="gold" style="font-weight:800;font-size:1.05rem">${p.weight} kg</td>
          <td class="muted small">${p.goal}</td>
        </tr>
      `).join('');
    };

    m.el.querySelector('#rm_w').oninput = calc;
    m.el.querySelector('#rm_r').oninput = calc;
    calc();
  };

  // Calculadora Gráfica de Discos de Barra (Barbell Plate Calculator)
  RD.calcPlates = (targetWeight, barWeight = 20) => {
    const tw = parseFloat(targetWeight) || 0;
    const bw = parseFloat(barWeight) || 20;
    if (tw <= bw) return { barWeight: bw, sideWeight: 0, plates: [], totalWeight: bw };
    const perSide = (tw - bw) / 2;
    let rem = perSide;
    const available = [25, 20, 15, 10, 5, 2.5, 1.25];
    const plates = [];
    for (const p of available) {
      while (rem >= p - 0.001) {
        plates.push(p);
        rem = Math.round((rem - p) * 100) / 100;
      }
    }
    const loadedPerSide = plates.reduce((a, b) => a + b, 0);
    const total = bw + loadedPerSide * 2;
    return { barWeight: bw, sideWeight: loadedPerSide, plates, totalWeight: total };
  };

  RD.openPlateCalculator = (defaultWeight = 60, defaultBar = 20) => {
    const m = RD.openModal('Calculadora Gráfica de Discos de Barra', `
      <div class="mb">
        <p class="muted small mb">Ingresa el peso total que deseas levantar y la app te mostrará exactamente qué discos colocar a cada lado de la barra con los colores oficiales.</p>
        <div class="grid g2 keep mb">
          <label class="field"><span>Peso Total Deseado (kg)</span><input id="pc_tw" type="number" step="2.5" value="${defaultWeight}"></label>
          <label class="field"><span>Peso de la Barra</span>
            <select id="pc_bw">
              <option value="20" ${defaultBar === 20 ? 'selected' : ''}>Barra Olímpica (20 kg)</option>
              <option value="15" ${defaultBar === 15 ? 'selected' : ''}>Barra Femenina/Corta (15 kg)</option>
              <option value="10" ${defaultBar === 10 ? 'selected' : ''}>Barra Z / Liviana (10 kg)</option>
            </select>
          </label>
        </div>
      </div>
      <div id="pc_visual_box"></div>
      <div class="card flat mt" id="pc_breakdown"></div>
    `);

    const render = () => {
      const tw = m.el.querySelector('#pc_tw').value;
      const bw = m.el.querySelector('#pc_bw').value;
      const res = RD.calcPlates(tw, bw);

      const visualBox = m.el.querySelector('#pc_visual_box');
      const breakdown = m.el.querySelector('#pc_breakdown');

      if (!res.plates.length) {
        visualBox.innerHTML = `
          <div class="barbell-visual">
            <div class="bar-shaft"></div>
            <div class="bar-collar"></div>
            <div class="bar-sleeve"><span class="tiny muted" style="padding:0 8px">Sin discos</span></div>
          </div>`;
        breakdown.innerHTML = `<div class="center muted small">Carga solo la barra de <b>${res.barWeight} kg</b> sin discos adicionales.</div>`;
        return;
      }

      visualBox.innerHTML = `
        <div class="barbell-visual">
          <div class="bar-shaft"></div>
          <div class="bar-collar"></div>
          <div class="bar-sleeve">
            ${res.plates.map(p => `<div class="plate plate-${String(p).replace('.', '_')}" title="${p} kg">${p}</div>`).join('')}
          </div>
          <div class="bar-collar" style="background:#64748b;height:24px"></div>
        </div>`;

      const counts = {};
      res.plates.forEach(p => counts[p] = (counts[p] || 0) + 1);
      const textList = Object.entries(counts).map(([p, c]) => `<b>${c}×</b> disco de ${p} kg`).join(' + ');

      breakdown.innerHTML = `
        <div class="row between mb">
          <span>Por cada lado cargar:</span>
          <b class="gold">${res.sideWeight} kg</b>
        </div>
        <div class="small mb">${textList}</div>
        <div class="row between pt border-top small muted">
          <span>Peso Total Exacto:</span>
          <b>${res.totalWeight} kg (${res.barWeight}kg barra + ${res.sideWeight * 2}kg discos)</b>
        </div>`;
    };

    m.el.querySelector('#pc_tw').oninput = render;
    m.el.querySelector('#pc_bw').onchange = render;
    render();
  };

  // Calculadora Nutricional TDEE & Macronutrientes Deportivos
  RD.calcTDEE = ({ gender = 'male', age = 25, weight = 70, height = 170, activity = 1.55, goal = 'maintain' }) => {
    const w = parseFloat(weight) || 70;
    const h = parseFloat(height) || 170;
    const a = parseInt(age, 10) || 25;
    const act = parseFloat(activity) || 1.55;

    // Fórmula Mifflin-St Jeor
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += (gender === 'female' ? -161 : 5);
    const tdee = Math.round(bmr * act);

    let targetCalories = tdee;
    let proteinPerKg = 2.0;

    if (goal === 'cut') {
      targetCalories = Math.round(tdee * 0.80); // Déficit del 20%
      proteinPerKg = 2.2; // Alta proteína para preservar masa muscular
    } else if (goal === 'bulk') {
      targetCalories = Math.round(tdee * 1.12); // Superávit limpio del 12%
      proteinPerKg = 1.9;
    } else {
      proteinPerKg = 2.0; // Recomposición corporal
    }

    const proteinG = Math.round(w * proteinPerKg);
    const fatG = Math.round(w * 0.85); // Grasas saludables mínimas
    const remainingCalories = Math.max(0, targetCalories - (proteinG * 4 + fatG * 9));
    const carbG = Math.round(remainingCalories / 4);

    return {
      bmr: Math.round(bmr),
      tdee,
      targetCalories,
      proteinG,
      proteinPerKg,
      fatG,
      carbG,
      goal
    };
  };

  RD.openNutritionCalculator = (memberData = {}) => {
    const m = RD.openModal('Calculadora Nutricional & Macros', `
      <div class="mb">
        <p class="muted small mb">Calcula tu gasto calórico real y el plan exacto de macronutrientes (Proteínas, Carbohidratos y Grasas) según tu objetivo en el gimnasio.</p>
        <div class="grid g2 keep mb">
          <label class="field"><span>Género</span>
            <select id="nt_gender">
              <option value="male">Hombre</option>
              <option value="female">Mujer</option>
            </select>
          </label>
          <label class="field"><span>Edad (años)</span><input id="nt_age" type="number" min="14" max="90" value="26"></label>
        </div>
        <div class="grid g2 keep mb">
          <label class="field"><span>Peso actual (kg)</span><input id="nt_weight" type="number" step="0.5" value="${memberData.weight || 70}"></label>
          <label class="field"><span>Estatura (cm)</span><input id="nt_height" type="number" min="120" max="220" value="${memberData.height || 170}"></label>
        </div>
        <div class="grid g2 keep mb">
          <label class="field"><span>Días de Gym</span>
            <select id="nt_act">
              <option value="1.375">1 - 2 días / semana (Ligero)</option>
              <option value="1.55" selected>3 - 5 días / semana (Moderado)</option>
              <option value="1.725">6 - 7 días / semana (Intenso)</option>
            </select>
          </label>
          <label class="field"><span>Objetivo</span>
            <select id="nt_goal">
              <option value="cut">Perder grasa / Definición</option>
              <option value="maintain" selected>Mantenimiento / Recomposición</option>
              <option value="bulk">Ganar masa muscular / Volumen</option>
            </select>
          </label>
        </div>
      </div>
      <div class="card center mb" style="background:rgba(183,110,121,0.12);border-color:var(--gold)">
        <div class="muted small">Calorías Diarias Recomendadas</div>
        <div class="gold" id="nt_cals" style="font-size:2.4rem;font-weight:900">-- kcal</div>
        <div class="small muted" id="nt_desc">TDEE estimado</div>
      </div>
      <h4>Distribución Diaria de Macronutrientes:</h4>
      <div class="macro-grid">
        <div class="macro-box">
          <div class="macro-val" id="nt_prot">-- g</div>
          <div class="macro-lbl">Proteínas</div>
          <div class="tiny muted" id="nt_prot_kg">-- g/kg</div>
        </div>
        <div class="macro-box">
          <div class="macro-val" id="nt_carbs" style="color:#0284c7">-- g</div>
          <div class="macro-lbl">Carbohidratos</div>
          <div class="tiny muted">Energía pura</div>
        </div>
        <div class="macro-box">
          <div class="macro-val" id="nt_fat" style="color:#eab308">-- g</div>
          <div class="macro-lbl">Grasas Buenas</div>
          <div class="tiny muted">Salud hormonal</div>
        </div>
      </div>
      <div class="tip small mt">
        <b>Consejo RD Fitness (Chivay · 3,635 msnm):</b> La tasa metabólica basal y la deshidratación aumentan con la altitud. Consume al menos 2.5 L de agua pura al día y prioriza proteínas limpias (huevos, pollo, quinua de la zona, pescado, carnes magras).
      </div>
    `);

    const update = () => {
      const res = RD.calcTDEE({
        gender: m.el.querySelector('#nt_gender').value,
        age: m.el.querySelector('#nt_age').value,
        weight: m.el.querySelector('#nt_weight').value,
        height: m.el.querySelector('#nt_height').value,
        activity: m.el.querySelector('#nt_act').value,
        goal: m.el.querySelector('#nt_goal').value
      });

      m.el.querySelector('#nt_cals').textContent = `${res.targetCalories} kcal`;
      m.el.querySelector('#nt_desc').textContent = res.goal === 'cut'
        ? `Déficit calórico para quemar grasa (Mantenimiento: ${res.tdee} kcal)`
        : res.goal === 'bulk'
        ? `Superávit controlado para hipertrofia (Mantenimiento: ${res.tdee} kcal)`
        : `Mantenimiento óptimo con recomposición corporal (${res.tdee} kcal)`;

      m.el.querySelector('#nt_prot').textContent = `${res.proteinG} g`;
      m.el.querySelector('#nt_prot_kg').textContent = `${res.proteinPerKg} g/kg peso`;
      m.el.querySelector('#nt_carbs').textContent = `${res.carbG} g`;
      m.el.querySelector('#nt_fat').textContent = `${res.fatG} g`;
    };

    m.el.querySelectorAll('input, select').forEach(el => el.oninput = update);
    update();
  };

  // Calculadora de Grasa Corporal (US Navy) e Hidratación
  RD.calcBodyFat = ({ gender = 'male', height = 170, waist = 82, neck = 38, hip = 95 }) => {
    const h = parseFloat(height) || 170;
    const w = parseFloat(waist) || 82;
    const n = parseFloat(neck) || 38;
    const hp = parseFloat(hip) || 95;

    let fat = 0;
    if (gender === 'male') {
      const diff = Math.max(1, w - n);
      fat = 495 / (1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(h)) - 450;
    } else {
      const diff = Math.max(1, w + hp - n);
      fat = 495 / (1.29579 - 0.35004 * Math.log10(diff) + 0.22100 * Math.log10(h)) - 450;
    }
    return Math.max(3, Math.min(50, Math.round(fat * 10) / 10));
  };

  RD.calcWater = (weight = 70, trainingMin = 60) => {
    const w = parseFloat(weight) || 70;
    const t = parseFloat(trainingMin) || 60;
    // Base: 35ml/kg + 350ml por cada 30 min de entrenamiento
    const ml = (w * 35) + ((t / 30) * 350);
    return Math.round((ml / 1000) * 10) / 10;
  };

  // ---------- 4. Gráficos Visuales SVG Interactivos ----------

  // Gráfico de Evolución de Peso Corporal
  RD.renderWeightSvgChart = (measurements = []) => {
    const data = measurements.filter(m => m.weight && Number(m.weight) > 0);
    if (data.length < 2) {
      return `
        <div class="empty center" style="padding:2rem 1rem">
          Registra al menos 2 mediciones de peso para ver tu curva de evolución gráfica.
        </div>`;
    }

    const weights = data.map(d => Number(d.weight));
    const minW = Math.min(...weights) - 1.5;
    const maxW = Math.max(...weights) + 1.5;
    const rangeW = Math.max(1, maxW - minW);

    const W = 520, H = 200, padX = 45, padY = 25;
    const plotW = W - padX - 15;
    const plotH = H - padY * 2;

    const getX = i => padX + (i / (data.length - 1)) * plotW;
    const getY = val => H - padY - ((val - minW) / rangeW) * plotH;

    const points = data.map((d, i) => ({ x: getX(i), y: getY(d.weight), val: d.weight, day: d.day }));
    const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1].x} ${H - padY} L ${points[0].x} ${H - padY} Z`;

    const initialW = weights[0];
    const currentW = weights[weights.length - 1];
    const diffW = Math.round((currentW - initialW) * 10) / 10;
    const diffSign = diffW > 0 ? `+${diffW}` : `${diffW}`;

    // Grid horizontal lines (3 levels)
    const midW = Math.round(((minW + maxW) / 2) * 10) / 10;
    const gridY1 = getY(minW + 1.5);
    const gridY2 = getY(midW);
    const gridY3 = getY(maxW - 1.5);

    return `
      <div class="row between mb small">
        <div>Inicial: <b>${initialW} kg</b> · Actual: <b>${currentW} kg</b></div>
        <div>Cambio: <b class="${diffW <= 0 ? 'ok' : 'gold'}">${diffSign} kg</b></div>
      </div>
      <div class="svg-chart-container">
        <svg class="svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#b76e79" stop-opacity="0.38"/>
              <stop offset="100%" stop-color="#b76e79" stop-opacity="0.0"/>
            </linearGradient>
          </defs>
          <!-- Grid lines -->
          <line x1="${padX}" y1="${gridY3}" x2="${W - 15}" y2="${gridY3}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3"/>
          <text x="${padX - 8}" y="${gridY3 + 4}" fill="#736878" font-size="10" text-anchor="end">${Math.round(maxW - 1.5)}k</text>
          <line x1="${padX}" y1="${gridY2}" x2="${W - 15}" y2="${gridY2}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3"/>
          <text x="${padX - 8}" y="${gridY2 + 4}" fill="#736878" font-size="10" text-anchor="end">${midW}k</text>
          <line x1="${padX}" y1="${gridY1}" x2="${W - 15}" y2="${gridY1}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3"/>
          <text x="${padX - 8}" y="${gridY1 + 4}" fill="#736878" font-size="10" text-anchor="end">${Math.round(minW + 1.5)}k</text>

          <!-- Area & Line -->
          <path d="${areaD}" fill="url(#weightGrad)"/>
          <path d="${pathD}" fill="none" stroke="#b76e79" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

          <!-- Interactive Points -->
          ${points.map((p, i) => `
            <circle cx="${p.x}" cy="${p.y}" r="5" fill="#FAF7FA" stroke="#b76e79" stroke-width="2.5" class="chart-point" data-tip="${RD.fmtDate(p.day)}: ${p.val} kg"/>
            ${i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2) ? `<text x="${p.x}" y="${H - 8}" fill="#736878" font-size="9" text-anchor="middle">${RD.fmtDate(p.day)}</text>` : ''}
          `).join('')}
        </svg>
      </div>`;
  };

  // Gráfico de Volumen Semanal (Carga Levantada en Kg)
  RD.renderVolumeSvgChart = (weeklyVolume = []) => {
    if (!weeklyVolume.length) {
      return '<div class="empty center" style="padding:2rem 1rem">Registra tus entrenamientos para ver tu progresión de volumen semanal.</div>';
    }

    const volumes = weeklyVolume.map(v => Number(v.volume) || 0);
    const maxV = Math.max(100, Math.max(...volumes));
    const W = 520, H = 180, padX = 40, padY = 25;
    const barW = Math.max(14, Math.min(32, (W - padX - 20) / weeklyVolume.length - 8));

    return `
      <div class="svg-chart-container">
        <svg class="svg-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <!-- Baseline -->
          <line x1="${padX}" y1="${H - padY}" x2="${W - 10}" y2="${H - padY}" stroke="rgba(255,255,255,0.15)"/>
          ${weeklyVolume.map((item, i) => {
            const h = Math.max(4, (item.volume / maxV) * (H - padY * 2));
            const x = padX + i * ((W - padX - 10) / weeklyVolume.length) + 6;
            const y = H - padY - h;
            return `
              <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="4" fill="#f5b400" opacity="0.85" class="chart-bar"/>
              <text x="${x + barW / 2}" y="${y - 5}" fill="#f5b400" font-size="9" font-weight="700" text-anchor="middle">${Math.round(item.volume / 1000)}k</text>
              <text x="${x + barW / 2}" y="${H - 8}" fill="#736878" font-size="9" text-anchor="middle">S${i + 1}</text>`;
          }).join('')}
        </svg>
      </div>`;
  };

  // Gráfico de Distribución Muscular
  RD.renderMuscleDistribution = (distribution = []) => {
    if (!distribution.length) {
      return '<div class="empty center">Sin registros musculares aún</div>';
    }
    const maxSets = Math.max(1, Math.max(...distribution.map(d => d.sets_count)));
    return `
      <div class="mt">
        ${distribution.map(d => {
          const pct = Math.round((d.sets_count / maxSets) * 100);
          return `
            <div class="muscle-track-row">
              <div class="muscle-track-head">
                <span><b>${RD.groupIconSvg(d.grupo)} ${esc(d.grupo)}</b></span>
                <span class="muted small">${d.sets_count} series · ${Math.round(d.volume)} kg</span>
              </div>
              <div class="muscle-track-bg">
                <div class="muscle-track-bar" style="width:${pct}%"></div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  };

  // ---------- 5. Modo Entrenamiento Guiado ----------
  RD.startWorkout = function ({ routine, dayIndex, lastWeights = {}, exercises = {}, onFinish }) {
    const day = routine.days[dayIndex];
    if (!day || !day.items.length) return RD.toast('Esta rutina no tiene ejercicios', 'warn');
    const startedAt = new Date().toISOString(), t0 = Date.now();
    const state = day.items.map(it => {
      const target = parseInt(String(it.reps).match(/\d+/)?.[0] || '10', 10);
      const lw = lastWeights[it.ex_id];
      return {
        it,
        sets: Array.from({ length: it.sets }, () => ({
          reps: it.seconds ? 0 : target,
          weight: lw ? lw.weight : '',
          done: false
        }))
      };
    });
    let idx = 0, wake = null;
    const rest = Countdown(), setCd = Countdown();
    const wrap = document.createElement('div');
    wrap.className = 'train';
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');

    try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { }); } catch { }
    const totalSets = state.reduce((a, s) => a + s.sets.length, 0);
    const doneSets = () => state.reduce((a, s) => a + s.sets.filter(x => x.done).length, 0);
    let elapsedT = setInterval(() => {
      const e = wrap.querySelector('#el');
      if (e) e.textContent = RD.fmtDur((Date.now() - t0) / 1000);
    }, 1000);

    function cleanup() {
      clearInterval(elapsedT);
      rest.stop();
      setCd.stop();
      wrap.remove();
      document.body.classList.remove('no-scroll');
      try { wake && wake.release(); } catch { }
    }

    function startRest(secs) {
      const bar = wrap.querySelector('#restbar');
      if (!bar || !secs) return;
      bar.classList.remove('hidden');
      const tb = bar.querySelector('#rt');
      rest.start(secs, s => {
        tb.textContent = mmss(s);
        tb.className = 'timer-big rest' + (s <= 3 ? ' alert' : '');
      }, () => {
        RD.beep('done');
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        bar.classList.add('hidden');
      });
    }

    function draw() {
      const s = state[idx], it = s.it, ex = exercises[it.ex_id] || { nombre: it.nombre, imagenes: it.imagenes };
      const imgs = it.imagenes && it.imagenes.length ? it.imagenes : (ex.imagenes || []);
      const lw = lastWeights[it.ex_id];

      wrap.innerHTML = `
        <div class="wrapw">
          <div class="row between">
            <div>
              <div class="muted small">${esc(routine.name)} · ${esc(day.title)}</div>
              <b>${RD.icon('timer')} <span id="el">${RD.fmtDur((Date.now() - t0) / 1000)}</span></b>
              <span class="muted small">· ${doneSets()}/${totalSets} series</span>
            </div>
            <button class="btn sm danger" id="end">Terminar</button>
          </div>
          <div class="progress mt2"><i style="width:${doneSets() / totalSets * 100}%"></i></div>
          <div class="row between mt small">
            <span class="muted">Ejercicio ${idx + 1} de ${state.length}</span>
            ${lw ? `<span class="badge info">Última vez: ${lw.weight} kg × ${lw.reps}</span>` : ''}
          </div>
          <h2>${esc(it.nombre)}</h2>
          ${imgs.length >= 2
            ? `<div class="gifflip" id="gf"><img src="${esc(imgs[0])}" alt=""><img class="b" src="${esc(imgs[1])}" alt=""></div>`
            : imgs[0] ? `<img src="${esc(imgs[0])}" style="width:100%;border-radius:12px" alt="">` : ''}
          <div class="row gap wrap mt2">
            <span class="badge info">${it.sets} series × ${esc(it.reps)}</span>
            ${it.rest ? `<span class="badge">Descanso ${it.rest}s</span>` : ''}
            <button class="btn sm" id="how" style="display:flex;align-items:center;gap:5px">${RD.icon('info', '', 14)} Técnica</button>
            <button class="btn sm ghost" id="btn_calc_plates" style="display:flex;align-items:center;gap:5px">${RD.icon('layers', '', 14)} Discos</button>
          </div>
          ${it.note ? `<div class="tip small">${esc(it.note)}</div>` : ''}
          <div class="mt" id="sets">
            ${it.seconds ? '' : '<div class="setrow muted tiny"><span></span><span>Repeticiones</span><span>Peso (kg)</span><span></span></div>'}
            ${s.sets.map((x, i) => it.seconds
              ? `<div class="setrow ${x.done ? 'done' : ''}" style="grid-template-columns:34px 1fr 44px">
                   <span class="n">${i + 1}</span>
                   <button class="btn ${x.done ? 'ok' : 'primary'}" data-timed="${i}" style="display:flex;align-items:center;justify-content:center;gap:6px">
                     ${x.done ? `${RD.icon('check', '', 14)} Hecho` : `${RD.icon('play', '', 14)} Iniciar ${it.seconds >= 60 ? mmss(it.seconds) : it.seconds + ' s'}`}
                   </button>
                   <button class="ck" data-ck="${i}">${x.done ? RD.icon('check', '', 16) : ''}</button>
                 </div>`
              : `<div class="setrow ${x.done ? 'done' : ''}">
                   <span class="n">${i + 1}</span>
                   <input type="number" inputmode="numeric" min="0" value="${x.reps}" data-r="${i}">
                   <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${x.weight}" data-w="${i}">
                   <button class="ck" data-ck="${i}">${x.done ? RD.icon('check', '', 16) : ''}</button>
                 </div>`).join('')}
          </div>
          <button class="btn ghost sm" id="addset" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('plus', '', 14)} Agregar serie</button>
          <div class="row gap mt">
            <button class="btn block" id="prev" ${idx === 0 ? 'disabled' : ''}>← Anterior</button>
            ${idx < state.length - 1
              ? '<button class="btn primary block" id="next">Siguiente →</button>'
              : `<button class="btn ok block" id="finish" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('check', '', 18)} Finalizar Entrenamiento</button>`}
          </div>
          <div class="restbar hidden" id="restbar">
            <div class="muted small center">Descanso</div>
            <div class="timer-big rest" id="rt" style="font-size:3rem">0:00</div>
            <div class="row gap mt2" style="justify-content:center">
              <button class="btn sm" id="m15">−15 s</button>
              <button class="btn sm" id="p15">+15 s</button>
              <button class="btn sm primary" id="skip">Saltar</button>
            </div>
          </div>
        </div>`;

      const q = sel => wrap.querySelector(sel);
      q('#how').onclick = () => { const full = exercises[it.ex_id]; full ? RD.openExercise(full) : RD.toast('Detalle no disponible', 'warn'); };
      q('#btn_calc_plates').onclick = () => {
        const firstW = s.sets.find(x => parseFloat(x.weight) > 0)?.weight || 60;
        RD.openPlateCalculator(firstW);
      };
      q('#end').onclick = () => finish(true);
      const fin = q('#finish'); if (fin) fin.onclick = () => finish(false);
      const nx = q('#next'); if (nx) nx.onclick = () => { rest.stop(); setCd.stop(); idx++; draw(); wrap.scrollTop = 0; };
      q('#prev').onclick = () => { rest.stop(); setCd.stop(); idx--; draw(); wrap.scrollTop = 0; };
      q('#addset').onclick = () => {
        const last = s.sets[s.sets.length - 1];
        s.sets.push({ reps: last ? last.reps : 10, weight: last ? last.weight : '', done: false });
        draw();
      };
      wrap.querySelectorAll('[data-r]').forEach(inp => inp.oninput = () => s.sets[+inp.dataset.r].reps = Math.max(0, parseInt(inp.value, 10) || 0));
      wrap.querySelectorAll('[data-w]').forEach(inp => inp.oninput = () => s.sets[+inp.dataset.w].weight = inp.value);
      wrap.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => {
        const i = +b.dataset.ck, set = s.sets[i]; set.done = !set.done;
        if (set.done) {
          RD.beep('tick');
          const allDone = state.every(x => x.sets.every(y => y.done));
          draw();
          if (!allDone) startRest(it.rest);
        } else {
          rest.stop();
          draw();
        }
      });
      wrap.querySelectorAll('[data-timed]').forEach(b => b.onclick = () => {
        const i = +b.dataset.timed; if (s.sets[i].done) return;
        b.disabled = true; let started = false;
        setCd.start(it.seconds + 3, rem => {
          if (rem > it.seconds) { b.textContent = `Prepárate… ${rem - it.seconds}`; return; }
          if (!started) { started = true; RD.beep('ok'); }
          b.innerHTML = `${RD.icon('timer')} ${mmss(rem)}`;
        }, () => { s.sets[i].done = true; s.sets[i].reps = 1; RD.beep('done'); draw(); startRest(it.rest); });
      });
      q('#p15').onclick = () => rest.add(15);
      q('#m15').onclick = () => rest.add(-15);
      q('#skip').onclick = () => { rest.stop(); q('#restbar').classList.add('hidden'); };
      if (rest.running) q('#restbar').classList.remove('hidden');
    }

    async function finish(early) {
      const done = doneSets();
      if (early && done === 0) {
        if (!(await RD.confirm('Salir', 'No registraste ninguna serie. ¿Salir sin guardar?', 'Salir', true))) return;
        cleanup();
        return;
      }
      if (early && !(await RD.confirm('Terminar entrenamiento', `Completaste ${done} de ${totalSets} series. ¿Guardar y terminar?`, 'Guardar'))) return;

      const dur = Math.round((Date.now() - t0) / 1000);
      const sets = [];
      state.forEach(s => s.sets.forEach((x, i) => {
        if (x.done) sets.push({ ex_id: s.it.ex_id, set_no: i + 1, reps: s.it.seconds ? 1 : x.reps, weight: parseFloat(x.weight) || 0 });
      }));
      const volume = sets.reduce((a, x) => a + x.reps * x.weight, 0);
      const payload = {
        uid: RD.uid(),
        routine_id: routine.id,
        day_index: dayIndex,
        title: `${routine.name} · ${day.title}`,
        started: startedAt,
        finished: new Date().toISOString(),
        duration_sec: dur,
        sets
      };
      cleanup();

      let prs = [], saved = true;
      try {
        const r = await onFinish(payload);
        prs = r?.prs || [];
      } catch (e) {
        saved = false;
      }
      RD.beep('done');
      RD.openModal('¡Entrenamiento Completado!', `
        <div class="grid g2 keep">
          <div class="stat gold"><div class="v">${RD.fmtDur(dur)}</div><div class="l">Duración</div></div>
          <div class="stat"><div class="v">${done}</div><div class="l">Series hechas</div></div>
          <div class="stat"><div class="v">${Math.round(volume)} kg</div><div class="l">Volumen total</div></div>
          <div class="stat"><div class="v">${prs.length}</div><div class="l">Nuevos Récords</div></div>
        </div>
        ${prs.length ? `<div class="tip mt"><b style="display:flex;align-items:center;gap:6px">${RD.icon('trophy', 'gold', 18)} ¡Nuevos Récords Personales (PRs)!</b><ul style="margin:.3rem 0 0 1rem;padding:0">${prs.map(p => `<li><b>${esc(p.nombre)}</b>: ${p.weight} kg</li>`).join('')}</ul></div>` : ''}
        ${saved ? '' : '<div class="banner mt">Sin conexión: tu entrenamiento se guardó en el teléfono y se enviará solo cuando vuelva el internet.</div>'}
        <p class="center mt"><b>¡Gran sesión! La sobrecarga progresiva y la constancia rinden frutos.</b></p>
      `);
    }
    draw();
  };

  // ---------- 6. Modo Entrenamiento Libre / Registro Rápido ----------
  RD.startFreeWorkout = function ({ exercises = {}, lastWeights = {}, onFinish }) {
    const startedAt = new Date().toISOString(), t0 = Date.now();
    const exList = Object.values(exercises);
    const selectedExercises = []; // { ex, sets: [{ reps, weight, done }] }
    let wake = null;
    const rest = Countdown();

    const wrap = document.createElement('div');
    wrap.className = 'train';
    document.body.appendChild(wrap);
    document.body.classList.add('no-scroll');

    try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { }); } catch { }
    let elapsedT = setInterval(() => {
      const e = wrap.querySelector('#el');
      if (e) e.textContent = RD.fmtDur((Date.now() - t0) / 1000);
    }, 1000);

    function cleanup() {
      clearInterval(elapsedT);
      rest.stop();
      wrap.remove();
      document.body.classList.remove('no-scroll');
      try { wake && wake.release(); } catch { }
    }

    function startRest(secs = 60) {
      const bar = wrap.querySelector('#restbar');
      if (!bar) return;
      bar.classList.remove('hidden');
      const tb = bar.querySelector('#rt');
      rest.start(secs, s => {
        tb.textContent = mmss(s);
        tb.className = 'timer-big rest' + (s <= 3 ? ' alert' : '');
      }, () => {
        RD.beep('done');
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
        bar.classList.add('hidden');
      });
    }

    function draw() {
      const doneCount = selectedExercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
      const totalSets = selectedExercises.reduce((a, e) => a + e.sets.length, 0);

      wrap.innerHTML = `
        <div class="wrapw">
          <div class="row between mb">
            <div>
              <div class="badge ok" style="display:inline-flex;align-items:center;gap:5px">${RD.icon('zap', '', 14)}<span>Sesión Libre / Registro Rápido</span></div>
              <div class="mt" style="display:flex;align-items:center;gap:6px">${RD.icon('timer', 'gold', 14)} <b><span id="el">${RD.fmtDur((Date.now() - t0) / 1000)}</span></b> <span class="muted small">· ${doneCount} series listas</span></div>
            </div>
            <button class="btn sm danger" id="end_free">Terminar</button>
          </div>

          <div class="card mb flat">
            <div class="row between wrap gap">
              <b>Ejercicios de la sesión (${selectedExercises.length})</b>
              <button class="btn sm primary" id="add_ex_btn" style="display:flex;align-items:center;gap:5px">${RD.icon('plus', '', 14)} Añadir Ejercicio</button>
            </div>
          </div>

          ${!selectedExercises.length ? `
            <div class="card center" style="padding:2.5rem 1rem">
              <div style="margin:0 auto 1rem;color:var(--gold);display:flex;justify-content:center">${RD.icon('dumbbell', 'gold', 36)}</div>
              <h3>Tu sesión está vacía</h3>
              <p class="muted small mb">Toca el botón para elegir cualquier ejercicio de la biblioteca y comenzar a registrar tus series.</p>
              <button class="btn primary" id="add_ex_empty" style="display:inline-flex;align-items:center;gap:6px">${RD.icon('plus', '', 16)} Seleccionar Primer Ejercicio</button>
            </div>` : ''}

          <div id="ex_items_list">
            ${selectedExercises.map((item, eIdx) => {
              const ex = item.ex;
              const lw = lastWeights[ex.id];
              return `
                <div class="card mb" data-eidx="${eIdx}">
                  <div class="row between mb">
                    <div>
                      <h3 style="margin:0">${esc(ex.nombre)}</h3>
                      <div class="muted tiny">${esc(ex.grupo)} · ${esc(ex.equipo || 'Sin equipo')} ${lw ? `· Anterior: ${lw.weight} kg × ${lw.reps}` : ''}</div>
                    </div>
                    <button class="btn ghost sm danger" data-remex="${eIdx}" style="display:flex;align-items:center;gap:4px">${RD.icon('trash', '', 14)} Quitar</button>
                  </div>
                  <div class="setrow muted tiny">
                    <span></span><span>Repeticiones</span><span>Peso (kg)</span><span></span>
                  </div>
                  ${item.sets.map((s, sIdx) => `
                    <div class="setrow ${s.done ? 'done' : ''}">
                      <span class="n">${sIdx + 1}</span>
                      <input type="number" inputmode="numeric" min="0" value="${s.reps}" data-er="${eIdx}" data-si="${sIdx}">
                      <input type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${s.weight}" data-ew="${eIdx}" data-si="${sIdx}">
                      <button class="ck" data-eck="${eIdx}" data-si="${sIdx}">${s.done ? RD.icon('check', '', 16) : ''}</button>
                    </div>`).join('')}
                  <div class="row between mt">
                    <button class="btn ghost sm" data-addset="${eIdx}" style="display:inline-flex;align-items:center;gap:4px">${RD.icon('plus', '', 14)} Agregar Serie</button>
                    <button class="btn ghost sm" data-plates="${eIdx}" style="display:inline-flex;align-items:center;gap:4px">${RD.icon('layers', '', 14)} Discos</button>
                  </div>
                </div>`;
            }).join('')}
          </div>

          ${selectedExercises.length ? `
            <div class="mt mb">
              <button class="btn ok block lg" id="finish_free" style="display:flex;align-items:center;justify-content:center;gap:6px">${RD.icon('check', '', 18)} Guardar y Finalizar Entrenamiento</button>
            </div>` : ''}

          <div class="restbar hidden" id="restbar">
            <div class="muted small center">Descanso</div>
            <div class="timer-big rest" id="rt" style="font-size:3rem">0:00</div>
            <div class="row gap mt2" style="justify-content:center">
              <button class="btn sm" id="m15">−15 s</button>
              <button class="btn sm" id="p15">+15 s</button>
              <button class="btn sm primary" id="skip">Saltar</button>
            </div>
          </div>
        </div>`;

      const q = sel => wrap.querySelector(sel);
      q('#end_free').onclick = () => finishFree(true);
      const fin = q('#finish_free'); if (fin) fin.onclick = () => finishFree(false);

      const addBtn = q('#add_ex_btn') || q('#add_ex_empty');
      if (addBtn) {
        addBtn.onclick = () => {
          const m = RD.openModal('Seleccionar Ejercicio para Hoy', '<div id="picker_box"></div>', { wide: true });
          RD.exerciseLibrary(m.el.querySelector('#picker_box'), exList, chosen => {
            const lw = lastWeights[chosen.id];
            selectedExercises.push({
              ex: chosen,
              sets: [
                { reps: 10, weight: lw ? lw.weight : '', done: false },
                { reps: 10, weight: lw ? lw.weight : '', done: false },
                { reps: 10, weight: lw ? lw.weight : '', done: false }
              ]
            });
            m.close();
            draw();
          });
        };
      }

      wrap.querySelectorAll('[data-remex]').forEach(b => b.onclick = () => {
        selectedExercises.splice(+b.dataset.remex, 1);
        draw();
      });

      wrap.querySelectorAll('[data-addset]').forEach(b => b.onclick = () => {
        const item = selectedExercises[+b.dataset.addset];
        const last = item.sets[item.sets.length - 1];
        item.sets.push({ reps: last ? last.reps : 10, weight: last ? last.weight : '', done: false });
        draw();
      });

      wrap.querySelectorAll('[data-plates]').forEach(b => b.onclick = () => {
        const item = selectedExercises[+b.dataset.plates];
        const lastW = item.sets.find(x => parseFloat(x.weight) > 0)?.weight || 60;
        RD.openPlateCalculator(lastW);
      });

      wrap.querySelectorAll('[data-er]').forEach(inp => inp.oninput = () => {
        selectedExercises[+inp.dataset.er].sets[+inp.dataset.si].reps = Math.max(0, parseInt(inp.value, 10) || 0);
      });
      wrap.querySelectorAll('[data-ew]').forEach(inp => inp.oninput = () => {
        selectedExercises[+inp.dataset.ew].sets[+inp.dataset.si].weight = inp.value;
      });

      wrap.querySelectorAll('[data-eck]').forEach(b => b.onclick = () => {
        const eIdx = +b.dataset.eck, sIdx = +b.dataset.si;
        const set = selectedExercises[eIdx].sets[sIdx];
        set.done = !set.done;
        if (set.done) {
          RD.beep('tick');
          draw();
          startRest(60);
        } else {
          rest.stop();
          draw();
        }
      });

      q('#p15').onclick = () => rest.add(15);
      q('#m15').onclick = () => rest.add(-15);
      q('#skip').onclick = () => { rest.stop(); q('#restbar').classList.add('hidden'); };
      if (rest.running) q('#restbar').classList.remove('hidden');
    }

    async function finishFree(early) {
      const doneCount = selectedExercises.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
      if (early && doneCount === 0) {
        if (!(await RD.confirm('Salir', 'No registraste series en esta sesión libre. ¿Salir sin guardar?', 'Salir', true))) return;
        cleanup();
        return;
      }
      if (early && !(await RD.confirm('Finalizar sesión libre', `Registraste ${doneCount} series. ¿Guardar ahora?`, 'Guardar'))) return;

      const dur = Math.round((Date.now() - t0) / 1000);
      const sets = [];
      selectedExercises.forEach(item => {
        item.sets.forEach((x, i) => {
          if (x.done) sets.push({ ex_id: item.ex.id, set_no: i + 1, reps: x.reps, weight: parseFloat(x.weight) || 0 });
        });
      });
      const volume = sets.reduce((a, x) => a + x.reps * x.weight, 0);
      const payload = {
        uid: RD.uid(),
        routine_id: null,
        day_index: null,
        title: `Sesión Libre (${selectedExercises.map(x => x.ex.grupo).filter((v, i, a) => a.indexOf(v) === i).join(', ')})`,
        started: startedAt,
        finished: new Date().toISOString(),
        duration_sec: dur,
        sets
      };
      cleanup();

      let prs = [], saved = true;
      try {
        const r = await onFinish(payload);
        prs = r?.prs || [];
      } catch (e) {
        saved = false;
      }
      RD.beep('done');
      RD.openModal('¡Sesión Libre Guardada!', `
        <div class="grid g2 keep">
          <div class="stat gold"><div class="v">${RD.fmtDur(dur)}</div><div class="l">Duración</div></div>
          <div class="stat"><div class="v">${doneCount}</div><div class="l">Series hechas</div></div>
          <div class="stat"><div class="v">${Math.round(volume)} kg</div><div class="l">Volumen total</div></div>
          <div class="stat"><div class="v">${prs.length}</div><div class="l">Nuevos Récords</div></div>
        </div>
        ${prs.length ? `<div class="tip mt"><b style="display:flex;align-items:center;gap:6px">${RD.icon('trophy', 'gold', 18)} ¡Nuevos Récords Personales (PRs)!</b><ul style="margin:.3rem 0 0 1rem;padding:0">${prs.map(p => `<li><b>${esc(p.nombre)}</b>: ${p.weight} kg</li>`).join('')}</ul></div>` : ''}
        ${saved ? '' : '<div class="banner mt">Sin conexión: tu entrenamiento se guardó en el teléfono y se enviará cuando vuelva el internet.</div>'}
      `);
    }

    draw();
  };
})();
