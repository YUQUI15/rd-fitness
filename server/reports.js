// Módulo de Reportes Contables, Asistencias, Exportación a Excel y Live Feed de Google Sheets
const L = require('./lib');

function escXml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
    : 75;

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
      ROUND(AVG(COALESCE(a.duration_min, 75))) AS avg_min
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
  const totalMinutes = records.reduce((acc, r) => acc + (r.duration_min || 70), 0);
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

// Generador de XML Spreadsheet de Microsoft Excel con Fórmulas Nativas
function buildExcelXmlReport({ data, settings }) {
  const gymName = settings.gym_name || 'RD Fitness Club';
  const gymRuc = settings.gym_ruc || '10702548911';
  const gymAddress = settings.gym_address || 'Calle Antonio José de Sucre Lt. 10, Chivay';
  const gymPhone = settings.gym_phone || '982404043';
  const periodText = `Período: ${data.from} al ${data.to}`;

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Reporte Contable y Asistencias - ${escXml(gymName)}</Title>
  <Subject>Caja Separada: Gimnasio, Tiendita, Turnos y Control de Entradas/Salidas</Subject>
  <Author>${escXml(gymName)}</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Color="#1E293B"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="TitleMain">
   <Font ss:FontName="Segoe UI" ss:Size="15" ss:Bold="1" ss:Color="#0F172A"/>
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Subtitle">
   <Font ss:FontName="Segoe UI" ss:Size="10" ss:Italic="1" ss:Color="#64748B"/>
  </Style>
  <Style ss:ID="HeaderGold">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#F5B400" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#B45309"/>
   </Borders>
  </Style>
  <Style ss:ID="HeaderDark">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E293B" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderBlue">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="HeaderGreen">
   <Font ss:FontName="Segoe UI" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#16A34A" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Currency">
   <NumberFormat ss:Format="&quot;S/ &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CurrencyBold">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#0F172A"/>
   <NumberFormat ss:Format="&quot;S/ &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CurrencyDiffPos">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#16A34A"/>
   <NumberFormat ss:Format="&quot;+S/ &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="CurrencyDiffNeg">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#DC2626"/>
   <NumberFormat ss:Format="&quot;-S/ &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="TotalRow">
   <Font ss:FontName="Segoe UI" ss:Bold="1" ss:Color="#000000"/>
   <Interior ss:Color="#FEF08A" ss:Pattern="Solid"/>
   <NumberFormat ss:Format="&quot;S/ &quot;#,##0.00"/>
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#000000"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#000000"/>
   </Borders>
  </Style>
  <Style ss:ID="DateCenter">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="BoldText">
   <Font ss:FontName="Segoe UI" ss:Bold="1"/>
  </Style>
 </Styles>`;

  // ---------------- HOJA 1: CONSOLIDADO GENERAL ----------------
  xml += `
 <Worksheet ss:Name="1. Consolidado General">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="200"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="160"/>
   <Row ss:Height="26">
    <Cell ss:MergeAcross="4" ss:StyleID="TitleMain"><Data ss:Type="String">RD FITNESS CLUB - REPORTE EJECUTIVO CONSOLIDADO</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="4" ss:StyleID="Subtitle"><Data ss:Type="String">RUC: ${escXml(gymRuc)} | ${escXml(gymAddress)} | Tel: ${escXml(gymPhone)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="4" ss:StyleID="Subtitle"><Data ss:Type="String">${escXml(periodText)} | Generado el: ${new Date().toLocaleString('es-PE')}</Data></Cell>
   </Row>
   <Row ss:Height="12"></Row>

   <!-- RESUMEN EJECUTIVO -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="2" ss:StyleID="HeaderDark"><Data ss:Type="String">RESUMEN GENERAL DE CAJA Y RESULTADOS</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">1. Ingresos Gimnasio (Membresías + Pases)</Data></Cell>
    <Cell ss:StyleID="CurrencyBold"><Data ss:Type="Number">${data.totalGymIncome.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">Separado en Hoja 2</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">2. Ingresos Tiendita (Bebidas, Suplementos)</Data></Cell>
    <Cell ss:StyleID="CurrencyBold"><Data ss:Type="Number">${data.totalStoreIncome.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">Separado en Hoja 3</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">3. Otros Ingresos</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalOtherIncome.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">TOTAL INGRESOS BRUTOS</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-3]C:R[-1]C)"><Data ss:Type="Number">${data.totalIncome.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Total Gastos Operativos</Data></Cell>
    <Cell ss:StyleID="CurrencyBold"><Data ss:Type="Number">${data.totalExpense.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">UTILIDAD NETA FINAL</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=R[-2]C-R[-1]C)"><Data ss:Type="Number">${data.netProfit.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${data.netProfit >= 0 ? '✔ Rentabilidad Positiva' : '⚠ Saldo Negativo'}</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- ARQUEO EFECTIVO VS DIGITAL -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="2" ss:StyleID="HeaderBlue"><Data ss:Type="String">DISTRIBUCIÓN Y ARQUEO: EFECTIVO VS DIGITAL</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Efectivo cobrado (Físico)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalByMethod.efectivo.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">(-) Gastos pagados en efectivo</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${(data.expenses.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0)).toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Efectivo neto en Gaveta</Data></Cell>
    <Cell ss:StyleID="CurrencyBold" ss:Formula="=R[-2]C-R[-1]C"><Data ss:Type="Number">${data.cashInDrawer.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">Debe cuadrar con el cajón físico</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Digital: Yape</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalByMethod.yape.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Digital: Plin</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalByMethod.plin.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Digital: Tarjeta POS (Izipay / Niubiz)</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalByMethod.tarjeta.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Digital: Transferencias Bancarias</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${data.totalByMethod.transferencia.toFixed(2)}</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">TOTAL DINERO DIGITAL</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-4]C:R[-1]C)"><Data ss:Type="Number">${data.digitalTotal.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">Verificar en celular, apps y reporte POS</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- COMPARATIVA DÍA POR DÍA -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="5" ss:StyleID="HeaderDark"><Data ss:Type="String">EVOLUCIÓN DÍA POR DÍA (GIMNASIO VS TIENDITA VS ASISTENCIAS)</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Gimnasio (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Tiendita (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Gastos (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Utilidad Neta (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Asistencias</Data></Cell>
   </Row>`;

  data.dailyComparison.forEach(d => {
    xml += `
   <Row>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${d.day}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${d.gym.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${d.store.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${d.expense.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="CurrencyBold" ss:Formula="=RC[-3]+RC[-2]-RC[-1]"><Data ss:Type="Number">${d.net.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${d.visits || 0}</Data></Cell>
   </Row>`;
  });

  if (data.dailyComparison.length > 0) {
    const n = data.dailyComparison.length;
    xml += `
   <Row>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String">TOTALES</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${n}]C:R[-1]C)"><Data ss:Type="Number">${data.totalGymIncome.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${n}]C:R[-1]C)"><Data ss:Type="Number">${data.totalStoreIncome.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${n}]C:R[-1]C)"><Data ss:Type="Number">${data.totalExpense.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${n}]C:R[-1]C)"><Data ss:Type="Number">${data.netProfit.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${n}]C:R[-1]C)"><Data ss:Type="Number">${data.attendance?.totalVisits || 0}</Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>`;

  // ---------------- HOJA 2: CAJA GIMNASIO ----------------
  xml += `
 <Worksheet ss:Name="2. Caja Gimnasio">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="85"/>
   <Column ss:Width="70"/>
   <Column ss:Width="95"/>
   <Column ss:Width="180"/>
   <Column ss:Width="85"/>
   <Column ss:Width="160"/>
   <Column ss:Width="85"/>
   <Column ss:Width="95"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="9" ss:StyleID="TitleMain"><Data ss:Type="String">INGRESOS ESPECÍFICOS DEL GIMNASIO (MEMBRESÍAS Y PASES)</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="9" ss:StyleID="Subtitle"><Data ss:Type="String">Exclusivo de membresías, renovaciones y pases diarios de S/ 5. No mezclado con la tiendita.</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>

   <!-- RESUMEN DE PLANES -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="3" ss:StyleID="HeaderBlue"><Data ss:Type="String">VENTAS POR PLAN Y PASES DIARIOS</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Plan / Pase</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Cantidad</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Total Recaudado</Data></Cell>
   </Row>`;

  data.byPlan.forEach(p => {
    xml += `
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escXml(p.plan_name)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${p.n}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${(p.total || 0).toFixed(2)}</Data></Cell>
   </Row>`;
  });

  const dailyPassesTotal = data.dailyPasses.reduce((a, b) => a + b.price, 0);
  xml += `
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">🎟️ Pases Diarios (S/ 5)</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${data.dailyPasses.length}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${dailyPassesTotal.toFixed(2)}</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- DETALLE DE PAGOS GYM -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="9" ss:StyleID="HeaderDark"><Data ss:Type="String">DETALLE COMPLETO DE INGRESOS - GIMNASIO</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Hora</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">N° Comprobante</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Socio / Cliente</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">DNI</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Concepto</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Método</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">N° Op. Yape</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Monto (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Atendido Por</Data></Cell>
   </Row>`;

  data.gymPayments.forEach(p => {
    const time = p.created_at ? p.created_at.slice(11, 16) : '';
    const clientName = p.member_name || p.dp_name || 'Visitante';
    const dni = p.member_dni || p.dp_dni || '-';
    xml += `
   <Row>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${p.day}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${time}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.receipt_no || ('REC-' + p.id))}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(clientName)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(dni)}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(p.concept)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.method)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.op_code || '-')}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.amount.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(p.cashier_name || 'Recepción')}</Data></Cell>
   </Row>`;
  });

  if (data.gymPayments.length > 0) {
    const gn = data.gymPayments.length;
    xml += `
   <Row>
    <Cell ss:MergeAcross="7" ss:StyleID="HeaderDark"><Data ss:Type="String">TOTAL RECAUDADO EN GIMNASIO</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${gn}]C:R[-1]C)"><Data ss:Type="Number">${data.totalGymIncome.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String"></Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>`;

  // ---------------- HOJA 3: VENTAS TIENDITA ----------------
  xml += `
 <Worksheet ss:Name="3. Ventas Tienda">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="85"/>
   <Column ss:Width="70"/>
   <Column ss:Width="95"/>
   <Column ss:Width="180"/>
   <Column ss:Width="80"/>
   <Column ss:Width="85"/>
   <Column ss:Width="95"/>
   <Column ss:Width="100"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="8" ss:StyleID="TitleMain"><Data ss:Type="String">VENTAS DE LA TIENDITA Y CONTROL DE STOCK</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="8" ss:StyleID="Subtitle"><Data ss:Type="String">Aguas, bebidas energéticas, suplementos y accesorios. Inventario y recaudación aislada.</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>

   <!-- RESUMEN DE STOCK E INVENTARIO -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="6" ss:StyleID="HeaderGreen"><Data ss:Type="String">INVENTARIO Y UNIDADES VENDIDAS</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Producto</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Categoría</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Precio (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Stock Actual</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Mínimo</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Vendidos (U)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Recaudación (S/)</Data></Cell>
   </Row>`;

  data.productStats.forEach(p => {
    xml += `
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">${escXml(p.name)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.category)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.price.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${p.stock}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${p.min_stock}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${p.sold_qty}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.sold_total.toFixed(2)}</Data></Cell>
   </Row>`;
  });

  xml += `
   <Row ss:Height="14"></Row>

   <!-- DETALLE TRANSACCIONES TIENDITA -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="7" ss:StyleID="HeaderDark"><Data ss:Type="String">DETALLE DE TICKETS DE VENTA DE TIENDITA</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Hora</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">N° Comprobante</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Detalle de Venta</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Método</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">N° Op. Yape</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Monto (S/)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Atendido Por</Data></Cell>
   </Row>`;

  data.storePayments.forEach(p => {
    const time = p.created_at ? p.created_at.slice(11, 16) : '';
    xml += `
   <Row>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${p.day}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${time}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.receipt_no || ('TICK-' + p.id))}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(p.concept)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.method)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(p.op_code || '-')}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${p.amount.toFixed(2)}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(p.cashier_name || 'Recepción')}</Data></Cell>
   </Row>`;
  });

  if (data.storePayments.length > 0) {
    const sn = data.storePayments.length;
    xml += `
   <Row>
    <Cell ss:MergeAcross="5" ss:StyleID="HeaderDark"><Data ss:Type="String">TOTAL VENTAS TIENDITA</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=SUM(R[-${sn}]C:R[-1]C)"><Data ss:Type="Number">${data.totalStoreIncome.toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="HeaderDark"><Data ss:Type="String"></Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>`;

  // ---------------- HOJA 4: CIERRES DE TURNO ----------------
  xml += `
 <Worksheet ss:Name="4. Cierres de Turno">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="60"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="85"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="95"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="105"/>
   <Column ss:Width="80"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="12" ss:StyleID="TitleMain"><Data ss:Type="String">HISTORIAL DE TURNOS Y AUDITORÍA DE ARQUEOS</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="12" ss:StyleID="Subtitle"><Data ss:Type="String">Control por cajero, fecha y turno. Comparación de efectivo esperado vs contado físico (Sobrante/Faltante).</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">ID Turno</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Cajero</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Turno</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Apertura</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Cierre</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fondo Inicial</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Efectivo Cobrado</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Efectivo Esperado</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Contado Físico</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Diferencia</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Digital Esperado</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Estado</Data></Cell>
   </Row>`;

  data.shifts.forEach(s => {
    const openTime = s.opened_at ? s.opened_at.slice(11, 16) : '-';
    const closeTime = s.closed_at ? s.closed_at.slice(11, 16) : '-';
    const diffStyle = s.diff_cash > 0 ? 'CurrencyDiffPos' : (s.diff_cash < 0 ? 'CurrencyDiffNeg' : 'CurrencyBold');
    xml += `
   <Row>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${s.id}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(s.user_name || s.user_id)}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(s.shift_name || 'Turno')}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${s.day}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${openTime}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${closeTime}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${(s.initial_cash || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${((s.expected_cash || 0) - (s.initial_cash || 0)).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="CurrencyBold"><Data ss:Type="Number">${(s.expected_cash || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="CurrencyBold"><Data ss:Type="Number">${(s.actual_cash || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="${diffStyle}"><Data ss:Type="Number">${(s.diff_cash || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="Currency"><Data ss:Type="Number">${(s.expected_digital || 0).toFixed(2)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${s.status === 'open' ? '🟢 Abierto' : '🔒 Cerrado'}</Data></Cell>
   </Row>`;
  });

  xml += `
  </Table>
 </Worksheet>`;

  // ---------------- HOJA 5: CONTROL DE ASISTENCIAS (ENTRADAS Y SALIDAS) ----------------
  const attRows = data.attendance?.rows || [];
  xml += `
 <Worksheet ss:Name="5. Asistencias y Aforo">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="85"/>
   <Column ss:Width="80"/>
   <Column ss:Width="80"/>
   <Column ss:Width="95"/>
   <Column ss:Width="95"/>
   <Column ss:Width="180"/>
   <Column ss:Width="85"/>
   <Column ss:Width="90"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Row ss:Height="24">
    <Cell ss:MergeAcross="9" ss:StyleID="TitleMain"><Data ss:Type="String">CONTROL DETALLADO DE ASISTENCIAS, ENTRADAS Y SALIDAS</Data></Cell>
   </Row>
   <Row>
    <Cell ss:MergeAcross="9" ss:StyleID="Subtitle"><Data ss:Type="String">Registro de ingresos y salidas con tiempo de permanencia de socios y visitantes en Chivay.</Data></Cell>
   </Row>
   <Row ss:Height="10"></Row>

   <!-- RESUMEN DE ASISTENCIA -->
   <Row ss:Height="20">
    <Cell ss:MergeAcross="4" ss:StyleID="HeaderBlue"><Data ss:Type="String">RESUMEN DEL PERÍODO</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Total de Asistencias Registradas</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${data.attendance?.totalVisits || 0}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Tiempo Promedio Entrenamiento</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${data.attendance?.avgDurationMin || 75} minutos</Data></Cell>
   </Row>
   <Row>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Asistencias de Socios Activos</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${data.attendance?.memberVisits || 0}</Data></Cell>
    <Cell ss:StyleID="BoldText"><Data ss:Type="String">Visitas de Pases Diarios (S/ 5)</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${data.attendance?.dailyVisits || 0}</Data></Cell>
   </Row>
   <Row ss:Height="14"></Row>

   <!-- TABLA DETALLE ENTRADAS Y SALIDAS -->
   <Row ss:Height="22">
    <Cell ss:MergeAcross="9" ss:StyleID="HeaderDark"><Data ss:Type="String">DETALLE DE ASISTENCIAS CON HORA DE ENTRADA Y SALIDA</Data></Cell>
   </Row>
   <Row ss:Height="20">
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Fecha</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Hora Entrada</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Hora Salida</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Permanencia (min)</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Tipo</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Persona / Socio</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">DNI</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Código</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Estado</Data></Cell>
    <Cell ss:StyleID="HeaderGold"><Data ss:Type="String">Personal Recepción</Data></Cell>
   </Row>`;

  attRows.forEach(a => {
    const enterTime = a.ts ? a.ts.slice(11, 16) : '-';
    const exitTime = a.exit_ts ? a.exit_ts.slice(11, 16) : (a.status === 'inside' ? 'En el Gym' : '-');
    const name = a.member_name || a.dp_name || 'Visitante';
    const dni = a.member_dni || a.dp_dni || '-';
    const code = a.member_code || a.dp_code || a.code || '-';
    const kindText = a.kind === 'D' ? 'Pase Diario' : 'Socio';
    const statusText = a.status === 'inside' ? '🟢 En el Gym' : '⚪ Salida Registrada';

    xml += `
   <Row>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${a.day}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${enterTime}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${exitTime}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="Number">${a.duration_min || 0}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${kindText}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(name)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(dni)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${escXml(code)}</Data></Cell>
    <Cell ss:StyleID="DateCenter"><Data ss:Type="String">${statusText}</Data></Cell>
    <Cell><Data ss:Type="String">${escXml(a.staff_name || 'Recepción')}</Data></Cell>
   </Row>`;
  });

  if (attRows.length > 0) {
    const an = attRows.length;
    xml += `
   <Row>
    <Cell ss:MergeAcross="2" ss:StyleID="HeaderDark"><Data ss:Type="String">PROMEDIO / TOTALES</Data></Cell>
    <Cell ss:StyleID="TotalRow" ss:Formula="=AVERAGE(R[-${an}]C:R[-1]C)"><Data ss:Type="Number">${data.attendance?.avgDurationMin || 75}</Data></Cell>
    <Cell ss:MergeAcross="5" ss:StyleID="HeaderDark"><Data ss:Type="String"></Data></Cell>
   </Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

// Generador de CSV en Vivo (Compatible con Google Sheets =IMPORTDATA y Excel)
function buildCsvLiveFeed({ type, data, sep = ',' }) {
  let rows = [];
  const s = sep === ';' ? ';' : ',';

  if (type === 'gym') {
    rows.push(['Fecha', 'Hora', 'N_Comprobante', 'Tipo', 'Cliente', 'DNI', 'Concepto', 'Metodo', 'Op_Yape', 'Monto_Soles', 'Cajero']);
    data.gymPayments.forEach(p => {
      rows.push([
        p.day,
        p.created_at ? p.created_at.slice(11, 16) : '',
        p.receipt_no || ('REC-' + p.id),
        p.daily_pass_id ? 'Pase Diario' : 'Membresia',
        p.member_name || p.dp_name || 'Visitante',
        p.member_dni || p.dp_dni || '',
        p.concept,
        p.method,
        p.op_code || '',
        p.amount.toFixed(2),
        p.cashier_name || 'Recepcion'
      ]);
    });
  } else if (type === 'store') {
    rows.push(['Fecha', 'Hora', 'N_Comprobante', 'Producto_Detalle', 'Metodo', 'Op_Yape', 'Total_Soles', 'Cajero']);
    data.storePayments.forEach(p => {
      rows.push([
        p.day,
        p.created_at ? p.created_at.slice(11, 16) : '',
        p.receipt_no || ('TICK-' + p.id),
        p.concept,
        p.method,
        p.op_code || '',
        p.amount.toFixed(2),
        p.cashier_name || 'Recepcion'
      ]);
    });
  } else if (type === 'shifts') {
    rows.push(['ID_Turno', 'Cajero', 'Turno', 'Fecha', 'Apertura', 'Cierre', 'Fondo_Inicial', 'Efectivo_Esperado', 'Contado_Fisico', 'Diferencia', 'Digital_Esperado', 'Estado']);
    data.shifts.forEach(s => {
      rows.push([
        s.id,
        s.user_name || s.user_id,
        s.shift_name,
        s.day,
        s.opened_at ? s.opened_at.slice(11, 16) : '',
        s.closed_at ? s.closed_at.slice(11, 16) : '',
        (s.initial_cash || 0).toFixed(2),
        (s.expected_cash || 0).toFixed(2),
        (s.actual_cash || 0).toFixed(2),
        (s.diff_cash || 0).toFixed(2),
        (s.expected_digital || 0).toFixed(2),
        s.status
      ]);
    });
  } else if (type === 'attendance') {
    rows.push(['Fecha', 'Hora_Entrada', 'Hora_Salida', 'Duracion_Minutos', 'Tipo', 'Nombre', 'DNI', 'Codigo', 'Estado', 'Personal']);
    (data.attendance?.rows || []).forEach(a => {
      rows.push([
        a.day,
        a.ts ? a.ts.slice(11, 16) : '',
        a.exit_ts ? a.exit_ts.slice(11, 16) : '',
        a.duration_min || 0,
        a.kind === 'D' ? 'Pase Diario' : 'Socio',
        a.member_name || a.dp_name || 'Visitante',
        a.member_dni || a.dp_dni || '',
        a.member_code || a.dp_code || a.code || '',
        a.status === 'inside' ? 'En el Gym' : 'Salida Registrada',
        a.staff_name || 'Recepcion'
      ]);
    });
  } else {
    // Consolidated / Ejecutivo
    rows.push(['Fecha', 'Ingresos_Gimnasio', 'Ingresos_Tiendita', 'Ingresos_Totales', 'Gastos_Operativos', 'Utilidad_Neta', 'Asistencias']);
    data.dailyComparison.forEach(d => {
      rows.push([
        d.day,
        d.gym.toFixed(2),
        d.store.toFixed(2),
        d.total.toFixed(2),
        d.expense.toFixed(2),
        d.net.toFixed(2),
        d.visits || 0
      ]);
    });
  }

  // Convert to CSV with UTF-8 BOM
  const csvContent = '\uFEFF' + rows.map(r => r.map(field => {
    const str = String(field ?? '').replace(/"/g, '""');
    return `"${str}"`;
  }).join(s)).join('\r\n');

  return csvContent;
}

module.exports = {
  getScopedReportData,
  getMemberAttendanceDetail,
  buildExcelXmlReport,
  buildCsvLiveFeed
};
