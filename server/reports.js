// Módulo de Reportes Contables y Asistencias (los formatos de salida viven en dataset.js / xlsx-report.js)
const L = require('./lib');

function getScopedReportData({ from, to, shift_id, q }) {
  const params = [from, to];
  let shiftFilter = '';
  const shiftParams = [];
  if (shift_id) {
    shiftFilter = ' AND p.shift_id = ?';
    shiftParams.push(shift_id);
  }

  // Todos los pagos del período
  const payments = q.all(`
    SELECT p.*,
      m.name AS member_name, m.code AS member_code, m.dni AS member_dni,
      dp.name AS dp_name, dp.code AS dp_code, dp.dni AS dp_dni,
      u.name AS cashier_name, s.shift_name
    FROM payments p
    LEFT JOIN members m ON m.id = p.member_id
    LEFT JOIN daily_passes dp ON dp.id = p.daily_pass_id
    LEFT JOIN users u ON u.id = p.user_id
    LEFT JOIN cash_shifts s ON s.id = p.shift_id
    WHERE p.voided = 0 AND p.day BETWEEN ? AND ? ${shiftFilter}
    ORDER BY p.id ASC
  `, ...params, ...shiftParams);

  // Clasificación estricta: Gimnasio vs Tiendita
  const gymPayments = [];
  const storePayments = [];
  const otherPayments = [];

  payments.forEach(p => {
    if (p.category === 'store' || (p.concept && p.concept.startsWith('Venta:'))) {
      storePayments.push(p);
    } else if (p.category === 'gym' || p.membership_id || p.daily_pass_id) {
      gymPayments.push(p);
    } else {
      otherPayments.push(p);
    }
  });

  // Gastos
  let expShiftFilter = '';
  if (shift_id) {
    expShiftFilter = ' AND e.shift_id = ?';
  }
  const expenses = q.all(`
    SELECT e.*, u.name AS user_name, s.shift_name
    FROM expenses e
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN cash_shifts s ON s.id = e.shift_id
    WHERE e.voided = 0 AND e.day BETWEEN ? AND ? ${expShiftFilter}
    ORDER BY e.id ASC
  `, ...params, ...shiftParams);

  const gymExpenses = expenses.filter(e => e.category !== 'store');
  const storeExpenses = expenses.filter(e => e.category === 'store');

  // Turnos cerrados
  const shifts = q.all(`
    SELECT s.*, u.name AS user_name
    FROM cash_shifts s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.day BETWEEN ? AND ?
    ORDER BY s.id DESC
  `, from, to);

  // Productos y ventas calculadas
  const prods = q.all('SELECT * FROM products ORDER BY name ASC');
  const prodSales = {};
  storePayments.forEach(p => {
    const match = p.concept.match(/Venta:\s*(.+?)\s*x(\d+)/i);
    if (match) {
      const name = match[1].trim();
      const qty = parseInt(match[2], 10) || 1;
      prodSales[name] = (prodSales[name] || { qty: 0, total: 0 });
      prodSales[name].qty += qty;
      prodSales[name].total += p.amount;
    } else {
      prodSales[p.concept] = (prodSales[p.concept] || { qty: 0, total: 0 });
      prodSales[p.concept].qty += 1;
      prodSales[p.concept].total += p.amount;
    }
  });

  const productStats = prods.map(p => {
    const sold_qty = prodSales[p.name]?.qty || 0;
    const sold_total = prodSales[p.name]?.total || 0;
    const unit_cost = Number(p.cost || 0);
    const sold_cost = +(sold_qty * unit_cost).toFixed(2);
    const sold_profit = +(sold_total - sold_cost).toFixed(2);
    return {
      id: p.id,
      name: p.name,
      category: p.category || 'general',
      cost: unit_cost,
      price: p.price,
      promo_price: p.promo_price || 0,
      stock: p.stock,
      min_stock: p.min_stock || 5,
      barcode: p.barcode || '',
      sold_qty,
      sold_total,
      sold_cost,
      sold_profit
    };
  });

  // Métricas de membresías y pases diarios
  const dailyPasses = q.all(`
    SELECT dp.*, u.name AS cashier_name
    FROM daily_passes dp
    LEFT JOIN users u ON u.id = dp.user_id
    WHERE dp.day BETWEEN ? AND ?
    ORDER BY dp.id ASC
  `, from, to);

  const byPlan = q.all(`
    SELECT plan_name, COUNT(*) AS n, SUM(price) AS total
    FROM memberships
    WHERE status='active' AND date(created_at) BETWEEN ? AND ?
    GROUP BY plan_name ORDER BY total DESC, n DESC
  `, from, to);

  // Métodos de pago
  const sumByMethod = (list) => {
    const res = { efectivo: 0, yape: 0, plin: 0, tarjeta: 0, transferencia: 0, total: 0 };
    list.forEach(item => {
      res[item.method] = (res[item.method] || 0) + item.amount;
      res.total += item.amount;
    });
    return res;
  };

  const gymByMethod = sumByMethod(gymPayments);
  const storeByMethod = sumByMethod(storePayments);
  const totalByMethod = sumByMethod(payments);

  const totalGymIncome = gymPayments.reduce((a, b) => a + b.amount, 0);
  const totalStoreIncome = storePayments.reduce((a, b) => a + b.amount, 0);
  const totalOtherIncome = otherPayments.reduce((a, b) => a + b.amount, 0);
  const totalIncome = totalGymIncome + totalStoreIncome + totalOtherIncome;

  const totalGymExpense = gymExpenses.reduce((a, b) => a + b.amount, 0);
  const totalStoreExpense = storeExpenses.reduce((a, b) => a + b.amount, 0);
  const totalExpense = totalGymExpense + totalStoreExpense;

  const totalStoreCost = productStats.reduce((a, b) => a + (b.sold_cost || 0), 0);
  const totalStoreGrossProfit = +(totalStoreIncome - totalStoreCost).toFixed(2);

  const cashExpenses = expenses.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0);
  const cashInDrawer = totalByMethod.efectivo - cashExpenses;
  const digitalTotal = totalByMethod.yape + totalByMethod.plin + totalByMethod.tarjeta + totalByMethod.transferencia;

  // Auditoría de pagos digitales Yape / Plin
  const digitalPayments = payments.filter(p => p.method === 'yape' || p.method === 'plin');
  const verifiedDigital = digitalPayments.filter(p => p.verified);
  const pendingDigital = digitalPayments.filter(p => !p.verified);
  const yapeAudit = {
    totalCount: digitalPayments.length,
    verifiedCount: verifiedDigital.length,
    pendingCount: pendingDigital.length,
    verifiedAmount: verifiedDigital.reduce((a, b) => a + b.amount, 0),
    pendingAmount: pendingDigital.reduce((a, b) => a + b.amount, 0)
  };

  // ---------------- CONTROL INTEGRAL DE ASISTENCIAS Y HORARIOS ----------------
  const attendanceRows = q.all(`
    SELECT a.*,
      m.name AS member_name, m.dni AS member_dni, m.code AS member_code, m.photo AS member_photo, m.phone AS member_phone,
      dp.name AS dp_name, dp.dni AS dp_dni, dp.code AS dp_code,
      u.name AS staff_name
    FROM attendance a
    LEFT JOIN members m ON m.id = a.member_id
    LEFT JOIN daily_passes dp ON dp.code = a.code
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.day BETWEEN ? AND ?
    ORDER BY a.ts DESC
  `, from, to);

  const validVisits = attendanceRows.filter(a => a.result === 'ok' || a.result === 'warn');
  const deniedVisits = attendanceRows.filter(a => a.result === 'denied');
  const totalVisits = validVisits.length;
  const memberVisits = validVisits.filter(a => a.kind !== 'D').length;
  const dailyVisits = validVisits.filter(a => a.kind === 'D').length;

  const completedSessions = validVisits.filter(a => a.duration_min && a.duration_min > 0);
  const avgDurationMin = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((a, b) => a + b.duration_min, 0) / completedSessions.length)
    : null;

  // Distribución por bloque horario y día de la semana
  let morningVisits = 0, afternoonVisits = 0, eveningVisits = 0;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0]; // Lun..Dom
  validVisits.forEach(a => {
    const h = typeof a.hour === 'number' ? a.hour : (a.ts ? new Date(a.ts).getHours() : 18);
    if (h < 12) morningVisits++;
    else if (h < 18) afternoonVisits++;
    else eveningVisits++;
    if (a.day) {
      const dt = new Date(a.day + 'T00:00:00Z');
      const idx = (dt.getUTCDay() + 6) % 7;
      if (idx >= 0 && idx < 7) weekdayCounts[idx]++;
    }
  });
  const weekdayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const byWeekday = weekdayNames.map((name, i) => ({
    day: name,
    short: name.slice(0, 3),
    label: name.slice(0, 3),
    count: weekdayCounts[i]
  }));

  // Personas actualmente dentro del gimnasio (status = 'inside' o sin exit_ts de hoy)
  const today = L.limaDay();
  const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
  const insideNow = q.all(`
    SELECT a.*,
      COALESCE(m.name, dp.name, 'Visitante') AS name,
      COALESCE(m.code, a.code) AS code,
      COALESCE(m.dni, dp.dni) AS dni,
      m.photo, m.phone
    FROM attendance a
    LEFT JOIN members m ON m.id = a.member_id
    LEFT JOIN daily_passes dp ON dp.code = a.code
    WHERE a.day = ? AND a.result IN ('ok','warn') AND (a.status = 'inside' OR a.exit_ts IS NULL) AND a.ts >= ?
    ORDER BY a.ts DESC
  `, today, fourHoursAgo);

  // Top Socios más Disciplinados / Fieles del Período (con su rutina activa y volumen)
  const topMembers = q.all(`
    SELECT m.id, m.name, m.code, m.photo, m.dni, m.phone,
      COUNT(DISTINCT a.day) AS days_attended,
      COUNT(*) AS total_sessions,
      ROUND(AVG(a.duration_min)) AS avg_min,
      (SELECT r.name FROM assignments asg JOIN routines r ON r.id=asg.routine_id WHERE asg.member_id=m.id AND asg.active=1 ORDER BY asg.id DESC LIMIT 1) AS routine_name,
      (SELECT COALESCE(SUM(w.volume),0) FROM workouts w WHERE w.member_id=m.id AND w.day BETWEEN ? AND ?) AS period_volume
    FROM attendance a
    JOIN members m ON m.id = a.member_id
    WHERE a.result IN ('ok','warn') AND a.day BETWEEN ? AND ?
    GROUP BY m.id
    ORDER BY days_attended DESC, total_sessions DESC
    LIMIT 10
  `, from, to, from, to).map(m => ({
    ...m,
    active_routine: m.routine_name || 'Entrenamiento Libre',
    volume_moved: Math.round(m.period_volume || 0)
  }));

  // Asistencia y Horas Pico
  const peak = q.all(`
    SELECT hour, COUNT(*) AS n
    FROM attendance
    WHERE result IN ('ok','warn') AND day BETWEEN ? AND ?
    GROUP BY hour ORDER BY hour ASC
  `, from, to);

  let peakHourObj = { hour: 18, n: 0 };
  peak.forEach(p => { if (p.n > peakHourObj.n) peakHourObj = p; });

  const newMembers = q.get('SELECT COUNT(*) n FROM members WHERE date(created_at) BETWEEN ? AND ?', from, to).n || 0;
  const renewals = q.get(`
    SELECT COUNT(*) n FROM memberships ms
    WHERE status='active' AND date(created_at) BETWEEN ? AND ?
      AND EXISTS (SELECT 1 FROM memberships o WHERE o.member_id=ms.member_id AND o.id < ms.id)
  `, from, to).n || 0;
  const expiredPeriod = q.get(`
    SELECT COUNT(DISTINCT member_id) n FROM memberships ms
    WHERE status='active' AND end_date BETWEEN ? AND ?
      AND NOT EXISTS (SELECT 1 FROM memberships o WHERE o.member_id=ms.member_id AND o.id > ms.id)
  `, from, to).n || 0;

  // Retención: Socios próximos a vencer (7 días) y Socios activos en riesgo de abandono (10+ días sin asistir)
  const next7 = L.addDays(today, 7);
  const expiringSoon = q.all(`
    SELECT m.id, m.name, m.code, m.phone, m.dni, ms.plan_name, ms.end_date
    FROM members m
    JOIN memberships ms ON ms.id = (SELECT id FROM memberships WHERE member_id=m.id AND status='active' ORDER BY end_date DESC LIMIT 1)
    WHERE m.status='active' AND ms.end_date BETWEEN ? AND ?
    ORDER BY ms.end_date ASC
    LIMIT 12
  `, today, next7).map(m => ({
    ...m,
    days_left: L.diffDays(m.end_date, today)
  }));

  const tenDaysAgo = L.addDays(today, -10);
  const atRiskMembers = q.all(`
    SELECT m.id, m.name, m.code, m.phone, m.dni, ms.plan_name, ms.end_date,
      (SELECT MAX(a.day) FROM attendance a WHERE a.member_id=m.id AND a.result IN ('ok','warn')) AS last_visit
    FROM members m
    JOIN memberships ms ON ms.id = (SELECT id FROM memberships WHERE member_id=m.id AND status='active' ORDER BY end_date DESC LIMIT 1)
    WHERE m.status='active' AND ms.end_date >= ?
      AND COALESCE((SELECT MAX(a.day) FROM attendance a WHERE a.member_id=m.id AND a.result IN ('ok','warn')), '2000-01-01') <= ?
    ORDER BY last_visit ASC
    LIMIT 12
  `, today, tenDaysAgo).map(m => ({
    ...m,
    last_visit_day: m.last_visit || null,
    days_absent: m.last_visit ? L.diffDays(today, m.last_visit) : null
  }));

  // Comparativa diaria
  const daysList = [];
  let cur = from;
  while (cur <= to) {
    daysList.push(cur);
    cur = L.addDays(cur, 1);
  }

  const dailyComparison = daysList.map(d => {
    const gymDay = gymPayments.filter(p => p.day === d).reduce((a, p) => a + p.amount, 0);
    const storeDay = storePayments.filter(p => p.day === d).reduce((a, p) => a + p.amount, 0);
    const expDay = expenses.filter(e => e.day === d).reduce((a, e) => a + e.amount, 0);
    const attDayCount = validVisits.filter(a => a.day === d).length;
    return {
      day: d,
      gym: gymDay,
      store: storeDay,
      total: gymDay + storeDay,
      expense: expDay,
      net: (gymDay + storeDay) - expDay,
      visits: attDayCount
    };
  });

  const netProfit = totalIncome - totalExpense;
  const marginPct = totalIncome > 0 ? Math.round((netProfit / totalIncome) * 100) : 0;
  const activeDaysCount = Math.max(1, dailyComparison.filter(x => x.total > 0 || x.visits > 0).length);
  const avgDailyIncome = +(totalIncome / activeDaysCount).toFixed(2);

  return {
    from, to,
    totalIncome, totalGymIncome, totalStoreIncome, totalOtherIncome,
    totalExpense, totalGymExpense, totalStoreExpense,
    totalStoreCost, totalStoreGrossProfit,
    netProfit, marginPct, avgDailyIncome,
    gymNet: totalGymIncome - totalGymExpense,
    storeNet: totalStoreIncome - totalStoreExpense,
    cashInDrawer, digitalTotal, yapeAudit,
    gymByMethod, storeByMethod, totalByMethod,
    gymPayments, storePayments, otherPayments,
    expenses, gymExpenses, storeExpenses,
    shifts, productStats, dailyPasses, byPlan,
    peak, peakHourObj, newMembers, renewals, expiredPeriod,
    expiringSoon, atRiskMembers,
    dailyComparison,
    attendance: {
      totalVisits,
      deniedCount: deniedVisits.length,
      memberVisits,
      dailyVisits,
      avgDurationMin,
      byShiftBlock: { morning: morningVisits, afternoon: afternoonVisits, evening: eveningVisits },
      byWeekday,
      peakHourObj,
      insideNow,
      topMembers,
      rows: attendanceRows
    }
  };
}

// Detalle y Ficha Individual Integral de Asistencias, Rutina y Rendimiento de un Socio
function getMemberAttendanceDetail({ memberId, from, to, q }) {
  const m = q.get(`
    SELECT m.*, COALESCE(p.name, ms.plan_name) AS current_plan, ms.start_date, ms.end_date, ms.price AS plan_price
    FROM members m
    LEFT JOIN memberships ms ON ms.member_id = m.id AND ms.status = 'active'
    LEFT JOIN plans p ON p.id = ms.plan_id
    WHERE m.id = ?
    ORDER BY ms.id DESC LIMIT 1
  `, memberId);
  if (!m) return null;

  const records = q.all(`
    SELECT a.*, u.name AS staff_name
    FROM attendance a
    LEFT JOIN users u ON u.id = a.user_id
    WHERE a.member_id = ? AND a.day BETWEEN ? AND ?
    ORDER BY a.ts DESC
  `, memberId, from, to);

  const validRecs = records.filter(r => r.result === 'ok' || r.result === 'warn');
  const daysAttended = new Set(validRecs.map(r => r.day)).size;
  const totalMinutes = validRecs.reduce((acc, r) => acc + (r.duration_min || 65), 0);
  const totalHours = +(totalMinutes / 60).toFixed(1);

  const totalDaysInRange = Math.max(1, L.diffDays(to, from) + 1);
  const totalWeeks = Math.max(1, +(totalDaysInRange / 7).toFixed(1));
  const avgDaysPerWeek = +(daysAttended / totalWeeks).toFixed(1);

  // Rutina activa, entrenamientos y PRs del socio
  const activeRoutine = q.get(`
    SELECT r.id, r.name, r.goal, r.level, r.days_per_week, a.note
    FROM assignments a
    JOIN routines r ON r.id = a.routine_id
    WHERE a.member_id = ? AND a.active = 1 AND r.active = 1
    ORDER BY a.id DESC LIMIT 1
  `, memberId);

  const targetDpw = activeRoutine?.days_per_week || 4;
  const consistencyRate = Math.min(100, Math.round((avgDaysPerWeek / Math.max(1, targetDpw)) * 100));

  // Horario favorito
  let morning = 0, afternoon = 0, evening = 0;
  validRecs.forEach(r => {
    const h = typeof r.hour === 'number' ? r.hour : (r.ts ? new Date(r.ts).getHours() : 18);
    if (h < 12) morning++;
    else if (h < 18) afternoon++;
    else evening++;
  });
  const preferredSchedule = morning >= afternoon && morning >= evening && morning > 0
    ? 'Mañana (06:00 - 12:00)'
    : afternoon >= evening && afternoon > 0
      ? 'Tarde (12:00 - 18:00)'
      : evening > 0
        ? 'Noche (18:00 - 21:00)'
        : 'Sin definir';

  const workoutSummary = q.get(`
    SELECT COUNT(*) AS count, COALESCE(SUM(volume), 0) AS total_volume, COALESCE(SUM(duration_sec), 0) AS total_sec
    FROM workouts
    WHERE member_id = ? AND day BETWEEN ? AND ?
  `, memberId, from, to);

  const topPrs = q.all(`
    SELECT e.nombre, e.nombre AS exercise, e.grupo, MAX(s.weight) AS weight, MAX(s.weight) AS weight_kg, MAX(s.reps) AS reps
    FROM set_logs s
    JOIN exercises e ON e.id = s.ex_id
    WHERE s.member_id = ? AND s.weight > 0
    GROUP BY s.ex_id
    ORDER BY weight DESC
    LIMIT 6
  `, memberId);

  const rawMeas = q.get('SELECT * FROM measurements WHERE member_id=? ORDER BY day DESC, id DESC LIMIT 1', memberId);
  const latestMeas = rawMeas ? {
    ...rawMeas,
    weight_kg: rawMeas.weight_kg ?? rawMeas.weight ?? null,
    waist_cm: rawMeas.waist_cm ?? rawMeas.waist ?? null,
    body_fat_pct: rawMeas.body_fat_pct ?? rawMeas.fat ?? null
  } : null;

  return {
    member: m,
    records,
    activeRoutine: activeRoutine || null,
    topPrs,
    latestMeas,
    stats: {
      from, to,
      daysAttended,
      totalSessions: records.length,
      totalHours,
      totalMinutes,
      avgDaysPerWeek,
      targetDpw,
      consistencyRate,
      preferredSchedule,
      scheduleBreakdown: { morning, afternoon, evening },
      workoutsLogged: workoutSummary?.count || 0,
      volumeMoved: Math.round(workoutSummary?.total_volume || 0)
    }
  };
}

module.exports = {
  getScopedReportData,
  getMemberAttendanceDetail
};

