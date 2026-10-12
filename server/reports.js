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

  const productStats = prods.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category || 'general',
    price: p.price,
    stock: p.stock,
    min_stock: p.min_stock || 5,
    barcode: p.barcode || '',
    sold_qty: prodSales[p.name]?.qty || 0,
    sold_total: prodSales[p.name]?.total || 0
  }));

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
    GROUP BY plan_name ORDER BY n DESC
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

  const cashExpenses = expenses.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0);
  const cashInDrawer = totalByMethod.efectivo - cashExpenses;
  const digitalTotal = totalByMethod.yape + totalByMethod.plin + totalByMethod.tarjeta + totalByMethod.transferencia;

  // ---------------- CONTROL INTEGRAL DE ASISTENCIAS ----------------
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
  const totalVisits = validVisits.length;
  const memberVisits = validVisits.filter(a => a.kind !== 'D').length;
  const dailyVisits = validVisits.filter(a => a.kind === 'D').length;

  const completedSessions = validVisits.filter(a => a.duration_min && a.duration_min > 0);
  const avgDurationMin = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((a, b) => a + b.duration_min, 0) / completedSessions.length)
    : null; // sin salidas registradas no se inventa una duración

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

  // Top Socios más Disciplinados / Fieles del Período
  const topMembers = q.all(`
    SELECT m.id, m.name, m.code, m.photo, m.dni,
      COUNT(DISTINCT a.day) AS days_attended,
      COUNT(*) AS total_sessions,
      ROUND(AVG(a.duration_min)) AS avg_min
    FROM attendance a
    JOIN members m ON m.id = a.member_id
    WHERE a.result IN ('ok','warn') AND a.day BETWEEN ? AND ?
    GROUP BY m.id
    ORDER BY days_attended DESC, total_sessions DESC
    LIMIT 10
  `, from, to);

  // Asistencia y Horas Pico
  const peak = q.all(`
    SELECT hour, COUNT(*) AS n
    FROM attendance
    WHERE result IN ('ok','warn') AND day BETWEEN ? AND ?
    GROUP BY hour ORDER BY hour ASC
  `, from, to);

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

  return {
    from, to,
    totalIncome, totalGymIncome, totalStoreIncome, totalOtherIncome,
    totalExpense, totalGymExpense, totalStoreExpense,
    netProfit: totalIncome - totalExpense,
    gymNet: totalGymIncome - totalGymExpense,
    storeNet: totalStoreIncome - totalStoreExpense,
    cashInDrawer, digitalTotal,
    gymByMethod, storeByMethod, totalByMethod,
    gymPayments, storePayments, otherPayments,
    expenses, gymExpenses, storeExpenses,
    shifts, productStats, dailyPasses, byPlan,
    peak, newMembers, renewals, expiredPeriod,
    dailyComparison,
    // Métricas ampliadas de asistencia
    attendance: {
      totalVisits,
      memberVisits,
      dailyVisits,
      avgDurationMin,
      insideNow,
      topMembers,
      rows: attendanceRows
    }
  };
}

// Detalle y Ficha Individual de Asistencias de un Socio
function getMemberAttendanceDetail({ memberId, from, to, q }) {
  const m = q.get(`
    SELECT m.*, p.name AS current_plan, ms.start_date, ms.end_date, ms.price AS plan_price
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

  const daysAttended = new Set(records.filter(r => r.result === 'ok' || r.result === 'warn').map(r => r.day)).size;
  const totalMinutes = records.reduce((acc, r) => acc + (r.duration_min || 0), 0);
  const totalHours = +(totalMinutes / 60).toFixed(1);

  const totalDaysInRange = Math.max(1, L.diffDays(to, from) + 1);
  const totalWeeks = Math.max(1, +(totalDaysInRange / 7).toFixed(1));
  const avgDaysPerWeek = +(daysAttended / totalWeeks).toFixed(1);
  const consistencyRate = Math.min(100, Math.round((daysAttended / (totalDaysInRange * 0.7)) * 100));

  return {
    member: m,
    records,
    stats: {
      from, to,
      daysAttended,
      totalSessions: records.length,
      totalHours,
      totalMinutes,
      avgDaysPerWeek,
      consistencyRate
    }
  };
}

module.exports = {
  getScopedReportData,
  getMemberAttendanceDetail
};

