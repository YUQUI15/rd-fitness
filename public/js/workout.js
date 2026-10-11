/* RD Fitness Club - Ejercicios, entrenador digital, cronómetros y modo entrenamiento */
(function () {
  const RD = window.RD;
  const { esc } = RD;

  // ---------- Ejercicios ----------
  RD.exThumb = ex => ex.imagenes && ex.imagenes[0] ? `<img loading="lazy" src="${esc(ex.imagenes[0])}" alt="${esc(ex.nombre)}">` : `<div class="avatar" style="width:84px;height:84px;border-radius:10px">${RD.GROUP_ICON[ex.grupo] || '⭐'}</div>`;
  RD.exCard = ex => `<div class="ex-card" data-ex="${esc(ex.id)}">${RD.exThumb(ex)}
    <div class="grow"><b>${esc(ex.nombre)}</b><div class="muted small">${esc(ex.grupo)} · ${esc(ex.equipo || '')}</div>
    <div class="chips mt2"><span class="badge info">${esc(ex.nivel || '')}</span><span class="badge">${esc(ex.tipo || '')}</span></div></div></div>`;

  RD.exDetailHTML = ex => {
    const imgs = ex.imagenes || [];
    const pics = imgs.length >= 2
      ? `<div class="gifflip" title="Toca para ver el movimiento"><img src="${esc(imgs[0])}" alt="Inicio"><img class="b" src="${esc(imgs[1])}" alt="Final"></div>
         <div class="ex-imgs mt2"><figure><img src="${esc(imgs[0])}" alt="Posición inicial"><figcaption>1 · Inicio</figcaption></figure><figure><img src="${esc(imgs[1])}" alt="Posición final"><figcaption>2 · Final</figcaption></figure></div>`
      : imgs.length ? `<img src="${esc(imgs[0])}" style="width:100%;border-radius:12px" alt="">` : '';
    return `${pics}
      <div class="chips mt"><span class="badge info">${esc(ex.grupo || '')}</span><span class="badge">${esc(ex.tipo || '')}</span><span class="badge">${esc(ex.equipo || '')}</span><span class="badge">${esc(ex.nivel || '')}</span></div>
      <p class="small mt2"><b>Músculos:</b> ${esc(ex.musculos || '—')}</p>
      ${ex.efecto ? `<div class="tip"><b>¿Para qué sirve?</b> ${esc(ex.efecto)}</div>` : ''}
      <h3 class="mt">Paso a paso</h3>
      <ol class="steps">${(ex.pasos || []).map(s => `<li><div>${esc(s)}</div></li>`).join('')}</ol>
      ${(ex.errores || []).length ? `<div class="err"><b>Errores comunes</b><ul style="margin:.3rem 0 0 1rem;padding:0">${ex.errores.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
      ${ex.consejo ? `<div class="tip"><b>Consejo:</b> ${esc(ex.consejo)}</div>` : ''}
      ${ex.variante ? `<p class="small muted">🔁 ${esc(ex.variante)}</p>` : ''}
      ${ex.video ? `<p><a target="_blank" rel="noopener" href="${esc(ex.video)}">▶ Ver video</a></p>` : ''}`;
  };
  RD.openExercise = ex => RD.openModal(ex.nombre, RD.exDetailHTML(ex), { wide: true });

  // Biblioteca con búsqueda y filtros. onPick(ex) opcional (para el constructor de rutinas)
  RD.exerciseLibrary = (el, list, onPick) => {
    const groups = ['Todos', ...Array.from(new Set(list.map(e => e.grupo)))];
    let g = 'Todos', t = '';
    el.innerHTML = `<input id="exq" placeholder="Buscar ejercicio, músculo o equipo…" autocomplete="off">
      <div class="chips mt2 mb" id="exg">${groups.map(x => `<span class="chip ${x === 'Todos' ? 'on' : ''}" data-g="${esc(x)}">${esc(x)}</span>`).join('')}</div>
      <div class="grid g2" id="exl"></div>`;
    const draw = () => {
      const q = t.toLowerCase();
      const items = list.filter(e => (g === 'Todos' || e.grupo === g) && (!q || [e.nombre, e.musculos, e.equipo, e.grupo, e.tipo].some(v => String(v || '').toLowerCase().includes(q))));
      el.querySelector('#exl').innerHTML = items.map(RD.exCard).join('') || '<div class="empty">Sin resultados</div>';
    };
    el.querySelector('#exq').oninput = RD.debounce(e => { t = e.target.value.trim(); draw(); }, 150);
    el.querySelector('#exg').onclick = e => { const c = e.target.closest('[data-g]'); if (!c) return; g = c.dataset.g; el.querySelectorAll('#exg .chip').forEach(x => x.classList.toggle('on', x === c)); draw(); };
    el.querySelector('#exl').onclick = e => { const c = e.target.closest('[data-ex]'); if (!c) return; const ex = list.find(x => x.id === c.dataset.ex); onPick ? onPick(ex) : RD.openExercise(ex); };
    draw();
  };

  // ---------- Cuenta regresiva basada en reloj real ----------
  function Countdown() {
    let end = 0, timer = null, onTick, onDone, lastWhole = -1, paused = 0;
    return {
      start(secs, tick, done) { this.stop(); end = Date.now() + secs * 1000; onTick = tick; onDone = done; lastWhole = -1; timer = setInterval(() => this._t(), 150); this._t(); },
      _t() {
        const rem = Math.max(0, (end - Date.now()) / 1000), whole = Math.ceil(rem);
        if (whole !== lastWhole) { lastWhole = whole; onTick && onTick(whole, rem); if (whole > 0 && whole <= 3) RD.beep('tick'); }
        if (rem <= 0) { const d = onDone; this.stop(); d && d(); }
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

  // ---------- Cronómetros / intervalos ----------
  RD.timersTool = el => {
    const presets = [
      ['⏱ Cuenta regresiva', 'countdown'], ['⏲ Cronómetro', 'stopwatch'], ['🔥 Tabata (20/10 × 8)', 'tabata'],
      ['💥 HIIT personalizado', 'hiit'], ['⌚ EMOM (cada minuto)', 'emom'], ['🏁 AMRAP (tiempo límite)', 'amrap'], ['😮‍💨 Descanso rápido', 'rest']
    ];
    const home = () => {
      el.innerHTML = `<div class="grid">${presets.map(([l, k]) => `<button class="btn block" data-k="${k}" style="justify-content:flex-start;padding:1rem">${l}</button>`).join('')}</div>
        <p class="muted small mt">Los cronómetros funcionan sin internet y suenan al cambiar de fase.</p>`;
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
      if (kind === 'rest') { el.innerHTML = `<button class="btn ghost sm" id="back">← Volver</button><div class="grid g3 keep mt">${[30, 45, 60, 90, 120, 180].map(s => `<button class="btn" data-s="${s}">${s < 60 ? s + ' s' : (s / 60) + ' min'}</button>`).join('')}</div>`; el.querySelector('#back').onclick = home; el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => runPhases([{ label: 'Descanso', secs: +b.dataset.s, kind: 'rest' }], 'Descanso')); return; }
      el.innerHTML = `<button class="btn ghost sm" id="back">← Volver</button><div class="mt">${body}</div><button class="btn primary block" id="go">Iniciar</button>`;
      el.querySelector('#back').onclick = home;
      el.querySelector('#go').onclick = () => {
        const v = id => Math.max(0, parseInt(el.querySelector('#' + id)?.value, 10) || 0);
        if (kind === 'countdown') { const t = v('m') * 60 + v('s'); if (t < 1) return RD.toast('Indica un tiempo', 'warn'); runPhases([{ label: 'Tiempo', secs: t, kind: 'work' }], 'Cuenta regresiva'); }
        if (kind === 'hiit') { if (!v('w') || !v('n')) return RD.toast('Completa los datos', 'warn'); runPhases(buildHiit(v('w'), v('r'), v('n'), 'hiit'), 'HIIT'); }
        if (kind === 'emom') { const n = v('n'), p = v('p') || 60; if (!n) return; runPhases(Array.from({ length: n }, (_, i) => ({ label: `Minuto ${i + 1}/${n}`, secs: p, kind: 'work' })), 'EMOM'); }
        if (kind === 'amrap') { if (!v('m')) return; runPhases([{ label: 'AMRAP: tantas rondas como puedas', secs: v('m') * 60, kind: 'work' }], 'AMRAP'); }
      };
    }
    const buildHiit = (w, r, n) => { const ph = [{ label: 'Prepárate', secs: 5, kind: 'rest' }]; for (let i = 1; i <= n; i++) { ph.push({ label: `¡TRABAJA! ${i}/${n}`, secs: w, kind: 'work' }); if (r && i < n) ph.push({ label: `Descanso (siguiente ${i + 1}/${n})`, secs: r, kind: 'rest' }); } return ph; };
    function runPhases(phases, title) {
      const cd = Countdown(); let i = 0, total = phases.reduce((a, p) => a + p.secs, 0), doneSecs = 0, running = true;
      el.innerHTML = `<div class="center"><div class="muted">${esc(title)}</div><div class="timer-big" id="tb">0:00</div><h2 id="lb"></h2><div class="progress mt"><i id="pg" style="width:0"></i></div>
        <div class="muted small mt2" id="inf"></div>
        <div class="row gap mt" style="justify-content:center"><button class="btn" id="pp">⏸ Pausar</button><button class="btn" id="sk">⏭ Saltar</button><button class="btn danger" id="st">■ Terminar</button></div></div>`;
      const tb = el.querySelector('#tb');
      const next = () => {
        if (i >= phases.length) { RD.beep('done'); tb.textContent = '¡Listo!'; tb.className = 'timer-big'; el.querySelector('#lb').textContent = '🎉 Completado'; el.querySelector('#pg').style.width = '100%'; el.querySelector('#pp').disabled = el.querySelector('#sk').disabled = true; return; }
        const p = phases[i]; tb.className = 'timer-big ' + (p.kind === 'work' ? 'work' : 'rest'); el.querySelector('#lb').textContent = p.label;
        if (i > 0) RD.beep(p.kind === 'work' ? 'ok' : 'warn');
        el.querySelector('#inf').textContent = `Fase ${i + 1} de ${phases.length}`;
        cd.start(p.secs, s => { tb.textContent = mmss(s); el.querySelector('#pg').style.width = Math.min(100, (doneSecs + (p.secs - s)) / total * 100) + '%'; }, () => { doneSecs += p.secs; i++; next(); });
      };
      el.querySelector('#pp').onclick = e => { if (running) { cd.pause(); e.target.textContent = '▶ Continuar'; } else { cd.resume(); e.target.textContent = '⏸ Pausar'; } running = !running; };
      el.querySelector('#sk').onclick = () => { cd.stop(); doneSecs += phases[i].secs; i++; next(); };
      el.querySelector('#st').onclick = () => { cd.stop(); home(); };
      next();
    }
    function stopwatch() {
      let t0 = 0, acc = 0, timer = null, laps = [];
      el.innerHTML = `<button class="btn ghost sm" id="back">← Volver</button><div class="timer-big mt" id="tb">0:00.0</div>
        <div class="row gap mt" style="justify-content:center"><button class="btn primary" id="ss">▶ Iniciar</button><button class="btn" id="lap">Vuelta</button><button class="btn" id="rs">Reiniciar</button></div><div class="list mt" id="laps"></div>`;
      const tb = el.querySelector('#tb'); const cur = () => acc + (timer ? Date.now() - t0 : 0);
      const fmt = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${Math.floor(ms / 100) % 10}`;
      const tick = () => tb.textContent = fmt(cur());
      el.querySelector('#ss').onclick = e => { if (timer) { acc += Date.now() - t0; clearInterval(timer); timer = null; e.target.textContent = '▶ Continuar'; } else { t0 = Date.now(); timer = setInterval(tick, 100); e.target.textContent = '⏸ Pausar'; } };
      el.querySelector('#lap').onclick = () => { if (!timer) return; laps.unshift(cur()); el.querySelector('#laps').innerHTML = laps.map((l, i) => `<div class="item"><b>#${laps.length - i}</b><span class="grow right">${fmt(l)}</span></div>`).join(''); };
      el.querySelector('#rs').onclick = () => { clearInterval(timer); timer = null; acc = 0; laps = []; tb.textContent = '0:00.0'; el.querySelector('#ss').textContent = '▶ Iniciar'; el.querySelector('#laps').innerHTML = ''; };
      el.querySelector('#back').onclick = () => { clearInterval(timer); home(); };
    }
    home();
  };

  // ---------- Modo entrenamiento ----------
  RD.startWorkout = function ({ routine, dayIndex, lastWeights = {}, exercises = {}, onFinish }) {
    const day = routine.days[dayIndex];
    if (!day || !day.items.length) return RD.toast('Esta rutina no tiene ejercicios', 'warn');
    const startedAt = new Date().toISOString(), t0 = Date.now();
    const state = day.items.map(it => {
      const target = parseInt(String(it.reps).match(/\d+/)?.[0] || '10', 10);
      const lw = lastWeights[it.ex_id];
      return { it, sets: Array.from({ length: it.sets }, () => ({ reps: it.seconds ? 0 : target, weight: lw ? lw.weight : '', done: false })) };
    });
    let idx = 0, wake = null;
    const rest = Countdown(), setCd = Countdown();
    const wrap = document.createElement('div'); wrap.className = 'train';
    document.body.appendChild(wrap); document.body.classList.add('no-scroll');
    try { navigator.wakeLock && navigator.wakeLock.request('screen').then(w => wake = w).catch(() => { }); } catch { }
    const totalSets = state.reduce((a, s) => a + s.sets.length, 0);
    const doneSets = () => state.reduce((a, s) => a + s.sets.filter(x => x.done).length, 0);
    let elapsedT = setInterval(() => { const e = wrap.querySelector('#el'); if (e) e.textContent = RD.fmtDur((Date.now() - t0) / 1000); }, 1000);

    function cleanup() { clearInterval(elapsedT); rest.stop(); setCd.stop(); wrap.remove(); document.body.classList.remove('no-scroll'); try { wake && wake.release(); } catch { } }
    function startRest(secs) {
      const bar = wrap.querySelector('#restbar'); if (!bar || !secs) return;
      bar.classList.remove('hidden');
      const tb = bar.querySelector('#rt');
      rest.start(secs, s => { tb.textContent = mmss(s); tb.className = 'timer-big rest' + (s <= 3 ? ' alert' : ''); }, () => { RD.beep('done'); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); bar.classList.add('hidden'); });
    }

    function draw() {
      const s = state[idx], it = s.it, ex = exercises[it.ex_id] || { nombre: it.nombre, imagenes: it.imagenes };
      const imgs = it.imagenes && it.imagenes.length ? it.imagenes : (ex.imagenes || []);
      wrap.innerHTML = `<div class="wrapw">
        <div class="row between"><div><div class="muted small">${esc(routine.name)} · ${esc(day.title)}</div><b>⏱ <span id="el">${RD.fmtDur((Date.now() - t0) / 1000)}</span></b> <span class="muted small">· ${doneSets()}/${totalSets} series</span></div>
          <button class="btn sm danger" id="end">Terminar</button></div>
        <div class="progress mt2"><i style="width:${doneSets() / totalSets * 100}%"></i></div>
        <div class="muted small mt">Ejercicio ${idx + 1} de ${state.length}</div>
        <h2>${esc(it.nombre)}</h2>
        ${imgs.length >= 2 ? `<div class="gifflip" id="gf"><img src="${esc(imgs[0])}" alt=""><img class="b" src="${esc(imgs[1])}" alt=""></div>` : imgs[0] ? `<img src="${esc(imgs[0])}" style="width:100%;border-radius:12px" alt="">` : ''}
        <div class="row gap wrap mt2"><span class="badge info">${it.sets} series × ${esc(it.reps)}</span>${it.rest ? `<span class="badge">Descanso ${it.rest}s</span>` : ''}<button class="btn sm" id="how">📖 Ver paso a paso</button></div>
        ${it.note ? `<div class="tip small">${esc(it.note)}</div>` : ''}
        <div class="mt" id="sets">
          ${it.seconds ? '' : '<div class="setrow muted tiny"><span></span><span>Repeticiones</span><span>Peso (kg)</span><span></span></div>'}
          ${s.sets.map((x, i) => it.seconds
            ? `<div class="setrow ${x.done ? 'done' : ''}" style="grid-template-columns:34px 1fr 44px"><span class="n">${i + 1}</span><button class="btn ${x.done ? 'ok' : 'primary'}" data-timed="${i}">${x.done ? '✔ Hecho' : '▶ Iniciar ' + (it.seconds >= 60 ? mmss(it.seconds) : it.seconds + ' s')}</button><button class="ck" data-ck="${i}">${x.done ? '✔' : ''}</button></div>`
            : `<div class="setrow ${x.done ? 'done' : ''}"><span class="n">${i + 1}</span><input type="number" inputmode="numeric" min="0" value="${x.reps}" data-r="${i}"><input type="number" inputmode="decimal" min="0" step="0.5" placeholder="kg" value="${x.weight}" data-w="${i}"><button class="ck" data-ck="${i}">${x.done ? '✔' : ''}</button></div>`).join('')}
        </div>
        <button class="btn ghost sm" id="addset">＋ Agregar serie</button>
        <div class="row gap mt"><button class="btn block" id="prev" ${idx === 0 ? 'disabled' : ''}>← Anterior</button>
          ${idx < state.length - 1 ? '<button class="btn primary block" id="next">Siguiente →</button>' : '<button class="btn ok block" id="finish">🏁 Finalizar</button>'}</div>
        <div class="restbar hidden" id="restbar"><div class="muted small center">Descanso</div><div class="timer-big rest" id="rt" style="font-size:3rem">0:00</div>
          <div class="row gap mt2" style="justify-content:center"><button class="btn sm" id="m15">−15 s</button><button class="btn sm" id="p15">+15 s</button><button class="btn sm primary" id="skip">Saltar</button></div></div>
      </div>`;
      const q = sel => wrap.querySelector(sel);
      q('#how').onclick = () => { const full = exercises[it.ex_id]; full ? RD.openExercise(full) : RD.toast('Detalle no disponible', 'warn'); };
      q('#end').onclick = () => finish(true);
      const fin = q('#finish'); if (fin) fin.onclick = () => finish(false);
      const nx = q('#next'); if (nx) nx.onclick = () => { rest.stop(); setCd.stop(); idx++; draw(); wrap.scrollTop = 0; };
      q('#prev').onclick = () => { rest.stop(); setCd.stop(); idx--; draw(); wrap.scrollTop = 0; };
      q('#addset').onclick = () => { const last = s.sets[s.sets.length - 1]; s.sets.push({ reps: last ? last.reps : 10, weight: last ? last.weight : '', done: false }); draw(); };
      wrap.querySelectorAll('[data-r]').forEach(inp => inp.oninput = () => s.sets[+inp.dataset.r].reps = Math.max(0, parseInt(inp.value, 10) || 0));
      wrap.querySelectorAll('[data-w]').forEach(inp => inp.oninput = () => s.sets[+inp.dataset.w].weight = inp.value);
      wrap.querySelectorAll('[data-ck]').forEach(b => b.onclick = () => {
        const i = +b.dataset.ck, set = s.sets[i]; set.done = !set.done;
        if (set.done) { RD.beep('tick'); const allDone = state.every(x => x.sets.every(y => y.done)); draw(); if (!allDone) startRest(it.rest); }
        else { rest.stop(); draw(); }
      });
      wrap.querySelectorAll('[data-timed]').forEach(b => b.onclick = () => {
        const i = +b.dataset.timed; if (s.sets[i].done) return;
        b.disabled = true; let started = false;
        setCd.start(it.seconds + 3, rem => {
          if (rem > it.seconds) { b.textContent = `Prepárate… ${rem - it.seconds}`; return; }
          if (!started) { started = true; RD.beep('ok'); }
          b.textContent = '⏳ ' + mmss(rem);
        }, () => { s.sets[i].done = true; s.sets[i].reps = 1; RD.beep('done'); draw(); startRest(it.rest); });
      });
      q('#p15').onclick = () => rest.add(15); q('#m15').onclick = () => rest.add(-15);
      q('#skip').onclick = () => { rest.stop(); q('#restbar').classList.add('hidden'); };
      if (rest.running) q('#restbar').classList.remove('hidden');
    }

    async function finish(early) {
      const done = doneSets();
      if (early && done === 0) { if (!(await RD.confirm('Salir', 'No registraste ninguna serie. ¿Salir sin guardar?', 'Salir', true))) return; cleanup(); return; }
      if (early && !(await RD.confirm('Terminar entrenamiento', `Completaste ${done} de ${totalSets} series. ¿Guardar y terminar?`, 'Guardar'))) return;
      const dur = Math.round((Date.now() - t0) / 1000);
      const sets = [];
      state.forEach(s => s.sets.forEach((x, i) => { if (x.done) sets.push({ ex_id: s.it.ex_id, set_no: i + 1, reps: s.it.seconds ? 1 : x.reps, weight: parseFloat(x.weight) || 0 }); }));
      const volume = sets.reduce((a, x) => a + x.reps * x.weight, 0);
      const payload = { uid: RD.uid(), routine_id: routine.id, day_index: dayIndex, title: `${routine.name} · ${day.title}`, started: startedAt, finished: new Date().toISOString(), duration_sec: dur, sets };
      cleanup();
      let prs = [], saved = true;
      try { const r = await onFinish(payload); prs = r?.prs || []; } catch (e) { saved = false; }
      RD.beep('done');
      RD.openModal('🎉 ¡Entrenamiento completado!', `<div class="grid g2 keep"><div class="stat gold"><div class="v">${RD.fmtDur(dur)}</div><div class="l">Duración</div></div>
        <div class="stat"><div class="v">${done}</div><div class="l">Series completadas</div></div>
        <div class="stat"><div class="v">${Math.round(volume)} kg</div><div class="l">Volumen levantado</div></div>
        <div class="stat"><div class="v">${prs.length}</div><div class="l">Récords nuevos</div></div></div>
        ${prs.length ? `<div class="tip mt"><b>🏆 Nuevos récords:</b><ul style="margin:.3rem 0 0 1rem;padding:0">${prs.map(p => `<li>${esc(p.nombre)}: ${p.weight} kg</li>`).join('')}</ul></div>` : ''}
        ${saved ? '' : '<div class="banner mt">Sin conexión: tu entrenamiento se guardó en el teléfono y se enviará solo cuando vuelva el internet.</div>'}
        <p class="center mt"><b>¡Gran trabajo! La constancia es lo que da resultados 💪</b></p>`);
    }
    draw();
  };
})();
