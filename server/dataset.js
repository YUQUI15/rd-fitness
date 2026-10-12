// Capa de datos única para TODOS los reportes (Excel, Google Sheets, CSV y pantalla).
// Todas las horas se convierten a hora de Lima (UTC-5): la base guarda marcas en UTC.
const L = require('./lib');
const { getScopedReportData } = require('./reports');

const LIMA_OFFSET_MS = -5 * 3600 * 1000;
const DOW = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Lunes a Domingo
const HOURS = Array.from({ length: 19 }, (_, i) => i + 5); // 05:00 a 23:00
const METHOD_LABEL = { efectivo: 'Efectivo', yape: 'Yape', plin: 'Plin', tarjeta: 'Tarjeta POS', transferencia: 'Transferencia' };

function toDate(v) {
  if (!v) return null;
  let s = String(v);
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s = s.replace(' ', 'T') + (s.length <= 10 ? 'T00:00:00' : '') + 'Z';
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
// Devuelve {day:'YYYY-MM-DD', time:'HH:MM', hour, dow, min} en hora de Lima
function lima(v) {
  const d = toDate(v);
  if (!d) return null;
  const l = new Date(d.getTime() + LIMA_OFFSET_MS);
  const iso = l.toISOString();
  return { day: iso.slice(0, 10), time: iso.slice(11, 16), hour: l.getUTCHours(), dow: l.getUTCDay(), ms: d.getTime() };
}
const dowOfDay = day => new Date(day + 'T12:00:00Z').getUTCDay();
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const fmtDur = m => (m == null || m === '' ? '' : `${Math.floor(m / 60) ? Math.floor(m / 60) + ' h ' : ''}${m % 60} min`);

function memberState(m, today, warnDays) {
  if (m.status === 'blocked') return 'Bloqueado';
  if (m.status === 'inactive') return 'Baja';
  if (m.frozen_from) return 'Congelado';
  if (!m.end_date) return 'Sin membresía';
  if (m.start_date && m.start_date > today) return 'Programada';
  const left = L.diffDays(m.end_date, today);
  if (left < 0) return 'Vencido';
  if (left <= warnDays) return 'Por vencer';
  return 'Vigente';
}

const MEMBER_SQL = `
  SELECT m.*,
    (SELECT start_date FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS start_date,
    (SELECT MAX(end_date) FROM memberships s WHERE s.member_id=m.id AND s.status='active') AS end_date,
    (SELECT plan_name FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS plan_name,
    (SELECT plan_id FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS plan_id,
    (SELECT MAX(ts) FROM attendance a WHERE a.member_id=m.id AND a.result IN ('ok','warn')) AS last_in
  FROM members m ORDER BY m.name`;

// ---------- Sesiones de asistencia (entrada + salida) ----------
function sessionFromRow(r, today, stayMin) {
  const en = lima(r.ts);
  const ex = r.exit_ts ? lima(r.exit_ts) : null;
  let dur = r.duration_min;
  if (!dur && ex) dur = Math.max(1, Math.round((ex.ms - en.ms) / 60000));
  let estado;
  if (ex) estado = 'Salida registrada';
  else if (r.day === today && (Date.now() - en.ms) / 60000 <= stayMin) estado = 'En sala';
  else estado = 'Sin salida registrada';
  return {
    id: r.id, day: r.day, entrada: en.time, salida: ex ? ex.time : '', salida_day: ex ? ex.day : '',
    dur: dur || null, estado, hour: en.hour, exit_hour: ex ? ex.hour : null, exit_day: ex ? ex.day : null,
    kind: r.kind === 'D' ? 'Pase diario' : 'Socio', staff: r.staff_name || '', result: r.result, reason: r.reason || ''
  };
}

function buildDataset({ from, to, q, settings }) {
  const today = L.limaDay();
  const warnDays = +settings.warn_days || 5;
  const stayMin = +settings.stay_min || 120;
  const base = getScopedReportData({ from, to, q });
  const nowLima = lima(new Date().toISOString());

  // ---------- Pagos ----------
  const allPayments = [...base.gymPayments, ...base.storePayments, ...base.otherPayments].sort((a, b) => a.id - b.id);
  const catOf = p => (base.storePayments.includes(p) ? 'Tienda' : base.gymPayments.includes(p) ? 'Gimnasio' : 'Otros');
  const tipoOf = p => (p.category === 'store' || String(p.concept).startsWith('Venta:') ? 'Venta tienda' : p.daily_pass_id ? 'Pase diario' : p.membership_id ? 'Membresía' : 'Otro');
  const payRows = allPayments.map(p => {
    const t = lima(p.created_at);
    return [p.day, t ? t.time : '', p.receipt_no || ('REC-' + p.id), catOf(p), tipoOf(p),
      p.member_name || p.dp_name || 'Cliente general', p.member_dni || p.dp_dni || '', p.member_code || p.dp_code || '',
      p.concept, METHOD_LABEL[p.method] || p.method, p.op_code || '', p.verified ? 'Sí' : (['yape', 'plin', 'tarjeta', 'transferencia'].includes(p.method) ? 'Pendiente' : 'N/A'),
      round2(p.amount), p.cashier_name || '', p.shift_name || ''];
  });

  // ---------- Ventas de tienda (línea por producto) ----------
  const saleLines = q.all(`
    SELECT p.id, p.day, p.created_at, p.receipt_no, p.method, p.amount, p.qty, p.unit_price, p.unit_cost, p.product_id, p.concept,
      pr.name AS pname, pr.category AS pcat, u.name AS cashier
    FROM payments p
    LEFT JOIN products pr ON pr.id = p.product_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.voided = 0 AND (p.category = 'store' OR p.concept LIKE 'Venta:%') AND p.day BETWEEN ? AND ?
    ORDER BY p.id`, from, to);
  const prodAgg = new Map();
  const saleRows = saleLines.map(s => {
    const m = String(s.concept).match(/^Venta:\s*(.+?)\s*x(\d+)/i);
    const name = s.pname || (m ? m[1].trim() : s.concept);
    const qty = s.qty || (m ? parseInt(m[2], 10) : 1) || 1;
    const unitPrice = s.unit_price != null ? s.unit_price : round2(s.amount / qty);
    const cost = (s.unit_cost || 0) * qty;
    const t = lima(s.created_at);
    const a = prodAgg.get(name) || { qty: 0, total: 0, cost: 0 };
    a.qty += qty; a.total += s.amount; a.cost += cost; prodAgg.set(name, a);
    return [s.day, t ? t.time : '', s.receipt_no || ('TICK-' + s.id), name, s.pcat || 'general', qty, round2(unitPrice), round2(s.amount),
      round2(s.unit_cost || 0), round2(s.amount - cost), METHOD_LABEL[s.method] || s.method, s.cashier || ''];
  });
  const storeCogs = [...prodAgg.values()].reduce((a, b) => a + b.cost, 0);

  // ---------- Inventario ----------
  const products = q.all('SELECT * FROM products ORDER BY active DESC, name');
  const invRows = products.map(p => {
    const a = prodAgg.get(p.name) || { qty: 0, total: 0, cost: 0 };
    const min = p.min_stock || 5;
    const estado = !p.active ? 'Inactivo' : p.stock <= 0 ? 'AGOTADO' : p.stock <= min ? 'BAJO' : 'OK';
    return [p.name, p.category || 'general', p.barcode || '', round2(p.cost || 0), round2(p.price), round2(p.promo_price || 0), p.stock, min,
      estado, round2((p.cost || 0) * p.stock), round2(p.price * p.stock), a.qty, round2(a.total), round2(a.total - a.cost)];
  });
  const topProducts = [...prodAgg.entries()].map(([name, a]) => ({ name, qty: a.qty, total: round2(a.total), profit: round2(a.total - a.cost) }))
    .sort((a, b) => b.qty - a.qty || b.total - a.total);

  // ---------- Métodos de pago ----------
  const methods = Object.keys(METHOD_LABEL).map(k => {
    const list = allPayments.filter(p => p.method === k);
    return {
      key: k, label: METHOD_LABEL[k],
      gym: round2(base.gymPayments.filter(p => p.method === k).reduce((a, p) => a + p.amount, 0)),
      store: round2(base.storePayments.filter(p => p.method === k).reduce((a, p) => a + p.amount, 0)),
      total: round2(list.reduce((a, p) => a + p.amount, 0)), n: list.length
    };
  });

  // ---------- Asistencia: entradas, salidas, horas pico ----------
  const attRows = base.attendance.rows; // todas (ok, warn, denied, invalid)
  const valid = attRows.filter(a => a.result === 'ok' || a.result === 'warn');
  const sessions = valid.map(r => sessionFromRow(r, today, stayMin));
  const denied = attRows.filter(a => a.result !== 'ok' && a.result !== 'warn');
  const entriesByHour = Object.fromEntries(HOURS.map(h => [h, 0]));
  const exitsByHour = Object.fromEntries(HOURS.map(h => [h, 0]));
  const heat = DOW_ORDER.map(() => HOURS.map(() => 0));
  sessions.forEach((s, i) => {
    const h = s.hour;
    if (entriesByHour[h] !== undefined) entriesByHour[h]++;
    const di = DOW_ORDER.indexOf(dowOfDay(s.day)), hi = HOURS.indexOf(h);
    if (di >= 0 && hi >= 0) heat[di][hi]++;
    if (s.exit_hour != null && s.exit_day >= from && s.exit_day <= to && exitsByHour[s.exit_hour] !== undefined) exitsByHour[s.exit_hour]++;
  });
  const personKey = r => (r.kind === 'D' ? 'D:' + r.code : 'M:' + r.member_id);
  const dayList = [];
  for (let d = from; d <= to; d = L.addDays(d, 1)) dayList.push(d);
  const dowDays = {};
  dayList.forEach(d => { const w = dowOfDay(d); dowDays[w] = (dowDays[w] || 0) + 1; });
  const weekday = DOW_ORDER.map(w => {
    const n = sessions.filter(s => dowOfDay(s.day) === w).length;
    return { dow: DOW[w], entries: n, days: dowDays[w] || 0, avg: dowDays[w] ? round2(n / dowDays[w]) : 0 };
  });

  const doneSessions = sessions.filter(s => s.dur);
  const avgDur = doneSessions.length ? Math.round(doneSessions.reduce((a, s) => a + s.dur, 0) / doneSessions.length) : null;
  const noExit = sessions.filter(s => s.estado === 'Sin salida registrada').length;

  const dailyRows = dayList.map(d => {
    const w = dowOfDay(d);
    const gym = base.gymPayments.filter(p => p.day === d).reduce((a, p) => a + p.amount, 0);
    const store = base.storePayments.filter(p => p.day === d).reduce((a, p) => a + p.amount, 0);
    const other = base.otherPayments.filter(p => p.day === d).reduce((a, p) => a + p.amount, 0);
    const exp = base.expenses.filter(e => e.day === d).reduce((a, e) => a + e.amount, 0);
    const ds = valid.filter(a => a.day === d);
    const uniq = new Set(ds.map(personKey)).size;
    const exits = sessions.filter(s => s.exit_day === d).length;
    return { day: d, dow: DOW[w], gym: round2(gym + other), store: round2(store), expense: round2(exp), entries: ds.length, exits, uniq };
  });

  // ---------- Socios ----------
  const members = q.all(MEMBER_SQL);
  const visitsBy = {};
  valid.filter(a => a.kind !== 'D').forEach(a => {
    const v = visitsBy[a.member_id] || (visitsBy[a.member_id] = { n: 0, days: new Set() });
    v.n++; v.days.add(a.day);
  });
  const memberRows = members.map(m => {
    const estado = memberState(m, today, warnDays);
    const left = m.end_date ? L.diffDays(m.end_date, today) : '';
    const li = m.last_in ? lima(m.last_in) : null;
    const v = visitsBy[m.id];
    return [m.code, m.name, m.dni || '', m.phone || '', m.email || '', m.plan_name || '', m.start_date || '', m.end_date || '', left, estado,
      li ? li.day : '', li ? li.time : '', v ? v.n : 0, v ? v.days.size : 0, (lima(m.created_at) || {}).day || '', m.gender || '', m.birth || '', m.goal || '', m.level || ''];
  });
  const stateCount = s => memberRows.filter(r => r[9] === s).length;
  const vigentes = stateCount('Vigente') + stateCount('Por vencer');

  const expiring = memberRows.filter(r => r[9] === 'Por vencer' || (r[9] === 'Vigente' && r[8] !== '' && r[8] <= 7))
    .sort((a, b) => a[8] - b[8]).map(r => [r[0], r[1], r[3], r[5], r[7], r[8], 'Por vencer']);
  const lapsed = memberRows.filter(r => r[9] === 'Vencido' && r[8] !== '' && r[8] >= -30)
    .sort((a, b) => b[8] - a[8]).map(r => [r[0], r[1], r[3], r[5], r[7], r[8], 'Vencido']);
  const atRisk = memberRows.filter(r => (r[9] === 'Vigente' || r[9] === 'Por vencer')).filter(r => {
    const created = r[14];
    if (created && L.diffDays(today, created) < 8) return false;
    return !r[10] || L.diffDays(today, r[10]) >= 10;
  }).map(r => [r[0], r[1], r[3], r[5], r[7], r[10] || 'Nunca', r[10] ? L.diffDays(today, r[10]) : '']);

  // ---------- Membresías vendidas / planes ----------
  const msRaw = q.all(`
    SELECT ms.*, m.name AS member_name, m.code AS member_code, m.dni AS member_dni,
      (SELECT COUNT(*) FROM memberships o WHERE o.member_id = ms.member_id AND o.id < ms.id) AS prev
    FROM memberships ms JOIN members m ON m.id = ms.member_id
    WHERE ms.status = 'active' ORDER BY ms.id`);
  const msRows = msRaw.filter(ms => {
    const c = lima(ms.created_at);
    return c && c.day >= from && c.day <= to;
  }).map(ms => [lima(ms.created_at).day, ms.member_code, ms.member_name, ms.member_dni || '', ms.plan_name || '', ms.prev > 0 ? 'Renovación' : 'Nueva',
    ms.start_date, ms.end_date, ms.extra_days || 0, ms.promo_note || '', round2(ms.price)]);
  const plans = q.all('SELECT * FROM plans ORDER BY sort, id');
  const planRows = plans.map(p => {
    const sold = msRows.filter(r => r[4] === p.name);
    const dur = p.days ? `${p.days} día${p.days > 1 ? 's' : ''}` : `${p.months} mes${p.months > 1 ? 'es' : ''}`;
    const activeNow = members.filter(m => m.plan_id === p.id && ['Vigente', 'Por vencer'].includes(memberState(m, today, warnDays))).length;
    return [p.name, dur, round2(p.price), p.active ? 'Activo' : 'Inactivo', activeNow, sold.length, round2(sold.reduce((a, r) => a + r[10], 0))];
  });

  // ---------- Turnos / Gastos ----------
  const shiftRows = base.shifts.map(s => [s.id, s.user_name || '', s.shift_name || '', s.day, (lima(s.opened_at) || {}).time || '', (lima(s.closed_at) || {}).time || '',
    round2(s.initial_cash), round2(s.expected_cash), round2(s.actual_cash), round2(s.diff_cash), round2(s.expected_digital), s.status === 'open' ? 'Abierto' : 'Cerrado', s.notes || '']);
  const expRows = base.expenses.map(e => [e.day, (lima(e.created_at) || {}).time || '', e.concept, e.category === 'store' ? 'Tienda' : 'Gimnasio',
    METHOD_LABEL[e.method] || e.method, round2(e.amount), e.user_name || '', e.shift_name || '']);

  // ---------- Totales ----------
  const totalIncome = round2(base.totalIncome);
  const totalExpense = round2(base.totalExpense);
  const days = Math.max(1, dayList.length);
  const kpis = {
    ingresos: totalIncome, gimnasio: round2(base.totalGymIncome + base.totalOtherIncome), tienda: round2(base.totalStoreIncome),
    gastos: totalExpense, utilidad: round2(totalIncome - totalExpense),
    utilidad_tienda: round2(base.totalStoreIncome - storeCogs), costo_ventas: round2(storeCogs),
    efectivo: round2(base.totalByMethod.efectivo), digital: round2(base.digitalTotal),
    ticket: allPayments.length ? round2(totalIncome / allPayments.length) : 0, operaciones: allPayments.length,
    visitas: sessions.length, unicos: new Set(valid.map(personKey)).size, visitas_dia: round2(sessions.length / days),
    permanencia_min: avgDur, sin_salida: noExit, pct_sin_salida: sessions.length ? round2((noExit / sessions.length) * 100) : 0,
    denegados: denied.length, socios_total: members.length, socios_vigentes: vigentes, por_vencer: expiring.length,
    vencidos: stateCount('Vencido'), nuevos: msRows.filter(r => r[5] === 'Nueva').length, renovaciones: msRows.filter(r => r[5] === 'Renovación').length,
    pases: base.dailyPasses.length, stock_bajo: invRows.filter(r => r[8] === 'BAJO' || r[8] === 'AGOTADO').length,
    en_riesgo: atRisk.length
  };

  const meta = {
    gym_name: settings.gym_name || 'RD Fitness Club', slogan: settings.gym_slogan || '', ruc: settings.gym_ruc || '',
    address: settings.gym_address || '', phone: settings.gym_phone || '', from, to, today,
    generated: `${nowLima.day} ${nowLima.time}`, timezone: 'Hora de Lima (UTC-5)'
  };

  // Definición de tablas (comparten Excel y Google Sheets). types: text|money|int|date|time|min|dec|pct
  const tables = {
    daily: { name: 'Ingresos Diarios', title: 'INGRESOS, GASTOS Y ASISTENCIA POR DÍA',
      headers: ['Fecha', 'Día', 'Gimnasio (S/)', 'Tienda (S/)', 'Ingreso total (S/)', 'Gastos (S/)', 'Utilidad neta (S/)', 'Entradas', 'Salidas registradas', 'Personas únicas'],
      types: ['date', 'text', 'money', 'money', 'money', 'money', 'money', 'int', 'int', 'int'],
      rows: dailyRows.map(d => [d.day, d.dow, d.gym, d.store, round2(d.gym + d.store), d.expense, round2(d.gym + d.store - d.expense), d.entries, d.exits, d.uniq]) },
    payments: { name: 'Pagos Detalle', title: 'DETALLE DE TODOS LOS COBROS (SIN ANULADOS)',
      headers: ['Fecha', 'Hora', 'Comprobante', 'Área', 'Tipo', 'Cliente', 'DNI', 'Código', 'Concepto', 'Método', 'N° Operación / Ref. POS', 'Verificado', 'Monto (S/)', 'Cajero', 'Turno'],
      types: ['date', 'time', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'text', 'money', 'text', 'text'], rows: payRows },
    methods: { name: 'Métodos de Pago', title: 'INGRESOS POR MÉTODO DE PAGO (CUADRE DE CAJA)',
      headers: ['Método', 'Gimnasio (S/)', 'Tienda (S/)', 'Total (S/)', 'N° operaciones', '% del total'],
      types: ['text', 'money', 'money', 'money', 'int', 'pct'],
      rows: methods.map(m => [m.label, m.gym, m.store, m.total, m.n, totalIncome ? round2(m.total / totalIncome) : 0]) },
    sales: { name: 'Tienda Ventas', title: 'VENTAS DE TIENDA POR PRODUCTO (CON COSTO Y UTILIDAD)',
      headers: ['Fecha', 'Hora', 'Comprobante', 'Producto', 'Categoría', 'Cant.', 'P. unitario (S/)', 'Total (S/)', 'Costo unit. (S/)', 'Utilidad (S/)', 'Método', 'Cajero'],
      types: ['date', 'time', 'text', 'text', 'text', 'int', 'money', 'money', 'money', 'money', 'text', 'text'], rows: saleRows },
    inventory: { name: 'Inventario', title: 'INVENTARIO, STOCK Y ROTACIÓN',
      headers: ['Producto', 'Categoría', 'Cód. barras', 'Costo (S/)', 'Precio (S/)', 'Promo (S/)', 'Stock', 'Stock mín.', 'Estado', 'Valor a costo (S/)', 'Valor a precio (S/)', 'Vendidos (período)', 'Ingreso (período)', 'Utilidad (período)'],
      types: ['text', 'text', 'text', 'money', 'money', 'money', 'int', 'int', 'text', 'money', 'money', 'int', 'money', 'money'], rows: invRows },
    topProducts: { name: 'Top Productos', title: 'PRODUCTOS MÁS VENDIDOS DEL PERÍODO',
      headers: ['#', 'Producto', 'Unidades', 'Ingreso (S/)', 'Utilidad (S/)'], types: ['int', 'text', 'int', 'money', 'money'],
      rows: topProducts.slice(0, 25).map((p, i) => [i + 1, p.name, p.qty, p.total, p.profit]) },
    members: { name: 'Socios', title: 'BASE DE SOCIOS Y ESTADO DE MEMBRESÍA',
      headers: ['Código', 'Nombre', 'DNI', 'Celular', 'Email', 'Plan', 'Inicio', 'Vence', 'Días restantes', 'Estado', 'Última visita', 'Hora', 'Visitas (período)', 'Días asistidos', 'Alta', 'Género', 'Nacimiento', 'Objetivo', 'Nivel'],
      types: ['text', 'text', 'text', 'text', 'text', 'text', 'date', 'date', 'int', 'text', 'date', 'time', 'int', 'int', 'date', 'text', 'date', 'text', 'text'], rows: memberRows },
    expiring: { name: 'Vencimientos', title: 'SOCIOS POR VENCER (≤7 DÍAS) Y VENCIDOS (ÚLTIMOS 30 DÍAS)',
      headers: ['Código', 'Nombre', 'Celular', 'Plan', 'Vence', 'Días', 'Situación'], types: ['text', 'text', 'text', 'text', 'date', 'int', 'text'],
      rows: [...expiring, ...lapsed] },
    atRisk: { name: 'Socios en Riesgo', title: 'SOCIOS VIGENTES QUE NO ASISTEN HACE 10+ DÍAS (RIESGO DE ABANDONO)',
      headers: ['Código', 'Nombre', 'Celular', 'Plan', 'Vence', 'Última visita', 'Días sin venir'], types: ['text', 'text', 'text', 'text', 'date', 'text', 'int'], rows: atRisk },
    memberships: { name: 'Membresías Vendidas', title: 'MEMBRESÍAS VENDIDAS EN EL PERÍODO (NUEVAS Y RENOVACIONES)',
      headers: ['Fecha venta', 'Código', 'Socio', 'DNI', 'Plan', 'Tipo', 'Inicio', 'Vence', 'Días extra (promo)', 'Promoción', 'Precio (S/)'],
      types: ['date', 'text', 'text', 'text', 'text', 'text', 'date', 'date', 'int', 'text', 'money'], rows: msRows },
    plans: { name: 'Planes', title: 'PLANES Y TARIFAS',
      headers: ['Plan', 'Duración', 'Precio (S/)', 'Estado', 'Socios vigentes ahora', 'Vendidos (período)', 'Ingreso (período)'],
      types: ['text', 'text', 'money', 'text', 'int', 'int', 'money'], rows: planRows },
    attendance: { name: 'Asistencias', title: 'ENTRADAS Y SALIDAS — REGISTRO INDIVIDUAL (HORA DE LIMA)',
      headers: ['Fecha', 'Entrada', 'Salida', 'Permanencia (min)', 'Tipo', 'Nombre', 'DNI', 'Código', 'Estado', 'Personal'],
      types: ['date', 'time', 'time', 'min', 'text', 'text', 'text', 'text', 'text', 'text'],
      rows: valid.map((r, i) => {
        const s = sessions[i];
        return [r.day, s.entrada, s.salida, s.dur || '', s.kind, r.member_name || r.dp_name || 'Visitante', r.member_dni || r.dp_dni || '', r.member_code || r.dp_code || r.code || '', s.estado, s.staff];
      }) },
    hourly: { name: 'Afluencia Horaria', title: 'ENTRADAS Y SALIDAS POR HORA DEL DÍA',
      headers: ['Hora', 'Entradas', 'Salidas registradas', 'Entradas sin salida'], types: ['text', 'int', 'int', 'int'],
      rows: HOURS.map(h => [String(h).padStart(2, '0') + ':00', entriesByHour[h], exitsByHour[h], Math.max(0, entriesByHour[h] - exitsByHour[h])]) },
    weekday: { name: 'Por Día de Semana', title: 'AFLUENCIA POR DÍA DE LA SEMANA',
      headers: ['Día', 'Entradas', 'Días en período', 'Promedio por día'], types: ['text', 'int', 'int', 'dec'], rows: weekday.map(w => [w.dow, w.entries, w.days, w.avg]) },
    heatmap: { name: 'Mapa de Calor', title: 'MAPA DE CALOR: ENTRADAS POR DÍA Y HORA',
      headers: ['Día', ...HOURS.map(h => String(h).padStart(2, '0') + 'h'), 'Total'], types: ['text', ...HOURS.map(() => 'int'), 'int'],
      rows: DOW_ORDER.map((w, i) => [DOW[w], ...heat[i], heat[i].reduce((a, b) => a + b, 0)]) },
    denied: { name: 'Accesos Denegados', title: 'INTENTOS DE INGRESO RECHAZADOS (SEGURIDAD)',
      headers: ['Fecha', 'Hora', 'Persona / Código', 'Motivo', 'Resultado', 'Personal'], types: ['date', 'time', 'text', 'text', 'text', 'text'],
      rows: denied.map(r => [r.day, (lima(r.ts) || {}).time || '', r.member_name || r.dp_name || r.code || 'Desconocido', r.reason || '', r.result === 'invalid' ? 'QR inválido' : 'Denegado', r.staff_name || '']) },
    shifts: { name: 'Turnos de Caja', title: 'TURNOS DE CAJA Y ARQUEO',
      headers: ['N°', 'Cajero', 'Turno', 'Fecha', 'Apertura', 'Cierre', 'Fondo inicial (S/)', 'Efectivo esperado (S/)', 'Efectivo contado (S/)', 'Diferencia (S/)', 'Digital esperado (S/)', 'Estado', 'Notas'],
      types: ['int', 'text', 'text', 'date', 'time', 'time', 'money', 'money', 'money', 'money', 'money', 'text', 'text'], rows: shiftRows },
    expenses: { name: 'Gastos', title: 'GASTOS Y EGRESOS',
      headers: ['Fecha', 'Hora', 'Concepto', 'Área', 'Método', 'Monto (S/)', 'Registrado por', 'Turno'], types: ['date', 'time', 'text', 'text', 'text', 'money', 'text', 'text'], rows: expRows }
  };

  return { meta, kpis, tables, tableOrder: Object.keys(tables), methods, topProducts, hourly: HOURS.map(h => ({ hour: h, in: entriesByHour[h], out: exitsByHour[h] })), weekday, heat, hours: HOURS, dow: DOW_ORDER.map(w => DOW[w]) };
}

// ---------- Ficha individual (socio o pase diario): entradas y salidas ----------
function searchPeople({ term, q }) {
  const t = '%' + String(term || '').trim().replace(/[%_]/g, '') + '%';
  if (t.length < 3) return [];
  const m = q.all(`SELECT id, code, name, dni, phone FROM members WHERE name LIKE ? OR dni LIKE ? OR code LIKE ? ORDER BY name LIMIT 12`, t, t, t)
    .map(r => ({ kind: 'M', ...r }));
  const d = q.all(`SELECT MAX(id) id, code, name, dni, phone, COUNT(*) passes FROM daily_passes WHERE name LIKE ? OR dni LIKE ? OR code LIKE ?
    GROUP BY COALESCE(NULLIF(dni,''), code), name ORDER BY MAX(id) DESC LIMIT 8`, t, t, t).map(r => ({ kind: 'D', ...r }));
  return [...m, ...d];
}

function getPersonReport({ kind, id, from, to, day, q, settings }) {
  const today = L.limaDay();
  const stayMin = +settings.stay_min || 120;
  let person, where, params;
  if (kind === 'D') {
    const dp = q.get('SELECT * FROM daily_passes WHERE id=?', id);
    if (!dp) return null;
    const codes = dp.dni ? q.all('SELECT code FROM daily_passes WHERE dni=?', dp.dni).map(r => r.code) : [dp.code];
    person = { kind: 'D', id: dp.id, code: dp.code, name: dp.name, dni: dp.dni || '', phone: dp.phone || '', type: 'Visitante (pase diario)' };
    where = `a.kind='D' AND a.code IN (${codes.map(() => '?').join(',')})`; params = codes;
    person.passes = q.get(`SELECT COUNT(*) n, COALESCE(SUM(price),0) total FROM daily_passes WHERE code IN (${codes.map(() => '?').join(',')})`, ...codes);
  } else {
    const m = q.get(`SELECT m.*, ms.plan_name, ms.start_date, ms.end_date FROM members m
      LEFT JOIN memberships ms ON ms.member_id=m.id AND ms.status='active' WHERE m.id=? ORDER BY ms.end_date DESC LIMIT 1`, id);
    if (!m) return null;
    person = { kind: 'M', id: m.id, code: m.code, name: m.name, dni: m.dni || '', phone: m.phone || '', type: 'Socio', plan: m.plan_name || '', start: m.start_date || '', end: m.end_date || '', photo: m.photo || '' };
    where = 'a.member_id=?'; params = [m.id];
  }
  const rangeFrom = day || from, rangeTo = day || to;
  const rows = q.all(`SELECT a.*, u.name AS staff_name FROM attendance a LEFT JOIN users u ON u.id=a.user_id
    WHERE ${where} AND a.day BETWEEN ? AND ? ORDER BY a.ts`, ...params, rangeFrom, rangeTo);
  const sessions = rows.map(r => sessionFromRow(r, today, stayMin));
  const okSessions = sessions.filter(s => s.result === 'ok' || s.result === 'warn');
  const daysSet = new Set(okSessions.map(s => s.day));
  const real = okSessions.filter(s => s.dur);
  const totalMin = real.reduce((a, s) => a + s.dur, 0);
  const span = Math.max(1, L.diffDays(rangeTo, rangeFrom) + 1);
  const stats = {
    from: rangeFrom, to: rangeTo, visits: okSessions.length, days: daysSet.size,
    totalMin, totalHours: round2(totalMin / 60), avgMin: real.length ? Math.round(totalMin / real.length) : null,
    withoutExit: okSessions.filter(s => s.estado === 'Sin salida registrada').length,
    denied: sessions.length - okSessions.length,
    perWeek: round2(daysSet.size / Math.max(1, span / 7)),
    firstEntry: okSessions[0] ? okSessions[0].day + ' ' + okSessions[0].entrada : '', lastEntry: okSessions.length ? okSessions[okSessions.length - 1].day + ' ' + okSessions[okSessions.length - 1].entrada : ''
  };
  const out = { person, stats, sessions };
  if (day) {
    const rowsOk = okSessions;
    let summary;
    if (!rowsOk.length) {
      summary = `NO existe registro de ingreso de ${person.name} el ${day}. ` + (sessions.length ? `Hubo ${sessions.length} intento(s) rechazado(s) ese día.` : 'Tampoco hubo intentos rechazados.');
    } else {
      summary = rowsOk.map(s => `Ingresó a las ${s.entrada}` + (s.salida ? ` y salió a las ${s.salida} (${fmtDur(s.dur)})` : ' — NO registró salida')).join('; ') + `. Fecha: ${day}.`;
    }
    out.presence = { day, present: rowsOk.length > 0, summary };
  }
  return out;
}

// CSV (UTF-8 con BOM, compatible con Excel) de cualquier tabla del dataset
function tableToCsv(table, sep = ',') {
  const s = sep === ';' ? ';' : ',';
  const cell = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + [table.headers, ...table.rows].map(r => r.map(cell).join(s)).join('\r\n');
}

module.exports = { buildDataset, searchPeople, getPersonReport, tableToCsv, lima, toDate, HOURS, DOW, METHOD_LABEL, fmtDur };
