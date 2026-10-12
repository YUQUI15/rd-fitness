// Libro Excel (.xlsx real) a partir del dataset único: Dashboard + una hoja por tabla.
// Fórmulas con valor en caché, formato condicional (barras, mapa de calor), logo y marca de agua.
const path = require('path');
const ExcelJS = require('exceljs');
const { getBrandAssets } = require('./watermark');

const GOLD = 'FFD4AF37', INK = 'FF111111', INK2 = 'FF1F1F1F', PAPER = 'FFF7F4EA', GREY = 'FF6B6B6B', LINE = 'FFD9D9D9';
const FMT = { money: '"S/ "#,##0.00', int: '#,##0', date: 'dd/mm/yyyy', time: 'hh:mm', min: '0', dec: '0.00', pct: '0.0%', text: '@' };
const ORDER = ['daily', 'methods', 'payments', 'sales', 'topProducts', 'inventory', 'memberships', 'plans', 'members', 'expiring', 'atRisk',
  'attendance', 'hourly', 'weekday', 'heatmap', 'denied', 'shifts', 'expenses'];
// Columnas (0-based) con total SUBTOTAL por tabla; 'all' = todas las money/int
const SUMS = {
  daily: [2, 3, 4, 5, 6, 7, 8], methods: [1, 2, 3, 4], payments: [12], sales: [5, 7, 9], topProducts: [2, 3, 4],
  inventory: [6, 9, 10, 11, 12, 13], memberships: [10], plans: [4, 5, 6], hourly: [1, 2, 3], weekday: [1, 2],
  shifts: [6, 7, 8, 9, 10], expenses: [5]
};
// Semáforo por texto: tabla -> {col, map: valor -> [colorTexto, colorFondo]}
const RED = ['FF9C0006', 'FFFFC7CE'], AMB = ['FF9C5700', 'FFFFEB9C'], GRN = ['FF006100', 'FFC6EFCE'];
const STATUS = {
  inventory: { col: 8, map: { AGOTADO: RED, BAJO: AMB, OK: GRN, Inactivo: ['FF6B6B6B', 'FFEDEDED'] } },
  members: { col: 9, map: { Vigente: GRN, 'Por vencer': AMB, Vencido: RED, Bloqueado: RED, Baja: ['FF6B6B6B', 'FFEDEDED'], Programada: ['FF1F4E79', 'FFDDEBF7'] } },
  attendance: { col: 8, map: { 'Sin salida registrada': AMB, 'Salida registrada': GRN, 'En sala': ['FF1F4E79', 'FFDDEBF7'] } },
  expiring: { col: 6, map: { 'Por vencer': AMB, Vencido: RED } },
  payments: { col: 11, map: { Pendiente: AMB, 'Sí': GRN } },
  shifts: { col: 11, map: { Abierto: AMB, Cerrado: GRN } }
};

const colL = n => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };
const q = name => `'${name.replace(/'/g, "''")}'`;
const xlDate = s => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00Z') : null);
const xlTime = s => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ''); return m ? (+m[1] * 60 + +m[2]) / 1440 : null; };
const num = v => (typeof v === 'number' ? v : 0);
const fmtDay = d => (d ? d.split('-').reverse().join('/') : '');

function convert(type, v) {
  if (v === '' || v == null) return null;
  if (type === 'date') return xlDate(String(v)) || String(v);
  if (type === 'time') { const t = xlTime(String(v)); return t == null ? String(v) : t; }
  if (['money', 'int', 'min', 'dec', 'pct'].includes(type)) { const n = Number(v); return isNaN(n) ? String(v) : n; }
  return String(v);
}

const border = { top: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };

function pageSetup(ws, titleRow) {
  ws.pageSetup = { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 }, printTitlesRow: titleRow ? `${titleRow}:${titleRow}` : undefined };
  ws.headerFooter = { oddHeader: '&L&"-,Bold"&K111111RD FITNESS CLUB&R&K6B6B6BReporte confidencial', oddFooter: '&L&K6B6B6B&F — &A&CHora de Lima&RPágina &P de &N' };
}

function banner(ws, ctx, title, subtitle, lastCol) {
  ws.getRow(1).height = 24; ws.getRow(2).height = 20; ws.getRow(3).height = 20;
  for (let r = 1; r <= 3; r++) for (let c = 1; c <= lastCol; c++) ws.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INK } };
  ws.addImage(ctx.logoId, { tl: { col: 0.15, row: 0.1 }, ext: { width: 58, height: 58 } });
  ws.mergeCells(1, 2, 1, lastCol); ws.mergeCells(2, 2, 2, lastCol); ws.mergeCells(3, 2, 3, lastCol);
  const m = ctx.ds.meta;
  Object.assign(ws.getCell(1, 2), { value: `${m.gym_name.toUpperCase()}  ·  ${title}`, font: { name: 'Calibri', size: 15, bold: true, color: { argb: GOLD } }, alignment: { vertical: 'middle', indent: 1 } });
  Object.assign(ws.getCell(2, 2), { value: subtitle, font: { name: 'Calibri', size: 10, color: { argb: 'FFFFFFFF' } }, alignment: { vertical: 'middle', indent: 1 } });
  Object.assign(ws.getCell(3, 2), {
    value: `Período: ${fmtDay(m.from)} al ${fmtDay(m.to)}   |   ${[m.ruc && 'RUC ' + m.ruc, m.address, m.phone].filter(Boolean).join('  ·  ')}   |   Generado ${m.generated} (${m.timezone})`,
    font: { name: 'Calibri', size: 9, italic: true, color: { argb: 'FFBDBDBD' } }, alignment: { vertical: 'middle', indent: 1 }
  });
}

function addDataSheet(ctx, key) {
  const t = ctx.ds.tables[key];
  const ws = ctx.wb.getWorksheet(t.name);
  const n = t.headers.length;
  const HDR = 5, FIRST = 6;
  const rows = t.rows;
  const last = FIRST + Math.max(rows.length, 1) - 1;
  ctx.ranges[key] = { first: FIRST, last, name: t.name };
  ws.views = [{ state: 'frozen', ySplit: HDR, showGridLines: false, zoomScale: 100 }];
  ws.properties.tabColor = { argb: GOLD };
  banner(ws, ctx, t.title, `Hoja: ${t.name}   ·   ${rows.length} registro(s)`, Math.max(n, 6));
  if (ws.getColumn(1).width < 12) ws.getColumn(1).width = 12;

  // Encabezado de columnas
  const hr = ws.getRow(HDR); hr.height = 34;
  t.headers.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    Object.assign(c, { value: h, font: { name: 'Calibri', bold: true, size: 10, color: { argb: GOLD } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: INK2 } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border });
  });
  // Datos
  const widths = t.headers.map(h => Math.min(18, Math.max(8, h.length * 0.8)));
  rows.forEach((r, ri) => {
    const row = ws.getRow(FIRST + ri);
    r.forEach((v, ci) => {
      const type = t.types[ci];
      const val = convert(type, v);
      const c = row.getCell(ci + 1);
      c.value = val; c.numFmt = FMT[type] || '@'; c.border = border;
      c.font = { name: 'Calibri', size: 10 };
      c.alignment = { vertical: 'middle', horizontal: ['date', 'time'].includes(type) ? 'center' : ['money', 'int', 'min', 'dec', 'pct'].includes(type) ? 'right' : 'left' };
      const len = val instanceof Date ? 10 : String(v ?? '').length;
      if (len > widths[ci]) widths[ci] = Math.min(40, len + 2);
    });
  });
  if (!rows.length) {
    ws.mergeCells(FIRST, 1, FIRST, Math.max(n, 6));
    Object.assign(ws.getCell(FIRST, 1), { value: 'Sin registros en el período seleccionado.', font: { italic: true, color: { argb: GREY } }, alignment: { horizontal: 'center' } });
  }
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = Math.max(w, i === 0 ? 12 : 8); });

  // Totales con SUBTOTAL (se recalculan al filtrar)
  const sums = rows.length ? (SUMS[key] || []) : [];
  let totalRow = null;
  if (sums.length) {
    totalRow = last + 1;
    const tr = ws.getRow(totalRow);
    const labelCol = [...Array(n).keys()].find(i => !sums.includes(i));
    t.headers.forEach((h, i) => {
      const c = tr.getCell(i + 1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE6C4' } };
      c.font = { bold: true, name: 'Calibri', size: 10 }; c.border = { ...border, top: { style: 'medium', color: { argb: INK } } };
      if (i === labelCol) c.value = 'TOTAL';
      if (sums.includes(i)) {
        const L = colL(i + 1);
        const result = rows.reduce((a, r) => a + num(Number(r[i])), 0);
        c.value = { formula: `SUBTOTAL(109,${L}${FIRST}:${L}${last})`, result };
        c.numFmt = FMT[t.types[i]];
      }
    });
    ctx.totals[key] = totalRow;
  }
  ws.autoFilter = { from: { row: HDR, column: 1 }, to: { row: HDR, column: n } };

  // Formato condicional: bandas, semáforo, barras
  const area = `A${FIRST}:${colL(n)}${last}`;
  const cf = [{ ref: area, rules: [{ type: 'expression', formulae: ['MOD(ROW(),2)=0'], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: PAPER } } } }] }];
  const st = STATUS[key];
  if (st && rows.length) {
    const L = colL(st.col + 1);
    cf.unshift({ ref: `${L}${FIRST}:${L}${last}`, rules: Object.entries(st.map).map(([val, [fc, bg]]) => ({
      type: 'expression', formulae: [`$${L}${FIRST}="${val}"`], style: { font: { bold: true, color: { argb: fc } }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: bg } } } })) });
  }
  if (key === 'shifts' && rows.length) cf.unshift({ ref: `J${FIRST}:J${last}`, rules: [{ type: 'expression', formulae: [`J${FIRST}<0`], style: { font: { bold: true, color: { argb: RED[0] } } } }, { type: 'expression', formulae: [`J${FIRST}>0`], style: { font: { bold: true, color: { argb: 'FF1F4E79' } } } }] });
  if (rows.length) {
    const bar = (col, argb) => cf.push({ ref: `${colL(col + 1)}${FIRST}:${colL(col + 1)}${last}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb } }] });
    if (key === 'daily') { bar(4, 'FFD4AF37'); bar(7, 'FF8FB8DE'); }
    if (key === 'methods') bar(3, 'FFD4AF37');
    if (key === 'topProducts') { bar(2, 'FFD4AF37'); bar(3, 'FF9BD39B'); }
    if (key === 'hourly') { bar(1, 'FFD4AF37'); bar(2, 'FF8FB8DE'); bar(3, 'FFF4A9A8'); }
    if (key === 'weekday') bar(1, 'FFD4AF37');
    if (key === 'plans') bar(6, 'FFD4AF37');
    if (key === 'inventory') bar(6, 'FF9BD39B');
    if (key === 'heatmap') cf.push({ ref: `B${FIRST}:${colL(n - 1)}${last}`, rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FFF6E3A1' }, { argb: 'FFD4AF37' }] }] });
  }
  ws.conditionalFormatting = cf;
  pageSetup(ws, HDR);
  return ws;
}

// ---------------- Dashboard ----------------
function addDashboard(ctx) {
  const { ds, wb } = ctx;
  const ws = wb.getWorksheet('Dashboard');
  const k = ds.kpis, T = ds.tables, R = ctx.ranges, C = ctx.totals;
  const COLS = 24;
  ws.views = [{ showGridLines: false, state: 'normal' }];
  ws.properties.tabColor = { argb: INK };
  for (let c = 1; c <= COLS; c++) ws.getColumn(c).width = 8.6;
  banner(ws, ctx, 'DASHBOARD EJECUTIVO', 'Gimnasio y Tienda separados · Consolidado · Asistencia (entradas y salidas) · Inventario', COLS);
  const col = (key, i) => `${q(R[key].name)}!$${colL(i + 1)}$${R[key].first}:$${colL(i + 1)}$${R[key].last}`;
  const cell = (key, i, r) => `${q(R[key].name)}!${colL(i + 1)}${R[key].first + r}`;
  const sumOf = (key, i) => T[key].rows.reduce((a, r) => a + num(Number(r[i])), 0);
  const solid = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

  // ---- Tarjetas KPI ----
  const gastoG = T.expenses.rows.filter(r => r[3] === 'Gimnasio').reduce((a, r) => a + r[5], 0);
  const gastoT = T.expenses.rows.filter(r => r[3] === 'Tienda').reduce((a, r) => a + r[5], 0);
  const card = (r, i, label, v, fmt, sub) => {
    const c0 = 1 + i * 4;
    [r, r + 1, r + 2].forEach(rr => { ws.mergeCells(rr, c0, rr, c0 + 3); for (let c = c0; c < c0 + 4; c++) ws.getCell(rr, c).fill = solid(INK2); });
    Object.assign(ws.getCell(r, c0), { value: label, font: { size: 9, bold: true, color: { argb: GOLD } }, alignment: { horizontal: 'center', vertical: 'middle' } });
    const vc = ws.getCell(r + 1, c0);
    vc.value = v; vc.numFmt = fmt; vc.font = { size: 20, bold: true, color: { argb: 'FFFFFFFF' } }; vc.alignment = { horizontal: 'center', vertical: 'middle' };
    Object.assign(ws.getCell(r + 2, c0), { value: sub, font: { size: 8, italic: true, color: { argb: 'FFBDBDBD' } }, alignment: { horizontal: 'center', vertical: 'middle' } });
    for (let c = c0; c < c0 + 4; c++) { ws.getCell(r, c).border = { top: { style: 'medium', color: { argb: GOLD } } }; }
  };
  [6, 7, 8, 10, 11, 12].forEach((r, i) => { ws.getRow(r).height = r === 7 || r === 11 ? 34 : 17; });
  const f = (sheetKey, i, result) => ({ formula: `SUM(${col(sheetKey, i)})`, result });
  card(6, 0, 'INGRESO TOTAL', f('daily', 4, sumOf('daily', 4)), FMT.money, 'Gimnasio + Tienda');
  card(6, 1, 'GIMNASIO', f('daily', 2, sumOf('daily', 2)), FMT.money, 'Membresías y pases diarios');
  card(6, 2, 'TIENDA', f('daily', 3, sumOf('daily', 3)), FMT.money, `Utilidad bruta S/ ${k.utilidad_tienda.toFixed(2)}`);
  card(6, 3, 'GASTOS', f('daily', 5, sumOf('daily', 5)), FMT.money, `Gym S/ ${gastoG.toFixed(2)} · Tienda S/ ${gastoT.toFixed(2)}`);
  card(6, 4, 'UTILIDAD NETA', f('daily', 6, sumOf('daily', 6)), FMT.money, 'Ingresos − gastos');
  card(6, 5, 'EFECTIVO / DIGITAL', { formula: `TEXT(SUMIF(${col('payments', 9)},"Efectivo",${col('payments', 12)}),"#,##0.00")&" / "&TEXT(SUM(${col('payments', 12)})-SUMIF(${col('payments', 9)},"Efectivo",${col('payments', 12)}),"#,##0.00")`, result: `${k.efectivo.toFixed(2)} / ${(k.ingresos - k.efectivo).toFixed(2)}` }, '@', 'S/ efectivo / S/ digital (cuadre de caja)');
  ws.getCell(7, 21).font = { size: 15, bold: true, color: { argb: 'FFFFFFFF' } };

  card(10, 0, 'ENTRADAS', f('daily', 7, sumOf('daily', 7)), FMT.int, `${k.visitas_dia.toFixed(1)} por día · ${k.unicos} personas únicas`);
  card(10, 1, 'SALIDAS REGISTRADAS', f('daily', 8, sumOf('daily', 8)), FMT.int, `${k.sin_salida} entradas sin salida (${k.pct_sin_salida}%)`);
  card(10, 2, 'PERMANENCIA PROM.', k.permanencia_min == null ? 'Sin datos' : { formula: `${k.permanencia_min}/1440`, result: k.permanencia_min / 1440 }, k.permanencia_min == null ? '@' : '[h]:mm', 'Solo sesiones con salida real');
  card(10, 3, 'SOCIOS VIGENTES', k.socios_vigentes, FMT.int, `${k.socios_total} registrados · ${k.vencidos} vencidos`);
  card(10, 4, 'POR VENCER (≤7 DÍAS)', k.por_vencer, FMT.int, `${k.en_riesgo} en riesgo de abandono`);
  card(10, 5, 'STOCK BAJO / AGOTADO', k.stock_bajo, FMT.int, `${k.denegados} accesos denegados en el período`);

  // ---- Utilidad para bloques ----
  const block = (r0, c0, title, headers, nv, rows, opts = {}) => {
    const vSpan = nv === 1 ? 4 : nv === 2 ? 4 : 3, lSpan = 12 - vSpan * nv;
    ws.mergeCells(r0, c0, r0, c0 + 11);
    Object.assign(ws.getCell(r0, c0), { value: '  ' + title, font: { bold: true, size: 11, color: { argb: GOLD } }, fill: solid(INK), alignment: { vertical: 'middle' } });
    for (let c = c0; c < c0 + 12; c++) ws.getCell(r0, c).fill = solid(INK);
    ws.getRow(r0).height = 21;
    const put = (r, vals, style) => {
      let c = c0;
      vals.forEach((v, i) => {
        const span = i === 0 ? lSpan : vSpan;
        ws.mergeCells(r, c, r, c + span - 1);
        const cc = ws.getCell(r, c);
        cc.value = v.v !== undefined ? v.v : v;
        if (v.fmt) cc.numFmt = v.fmt;
        cc.alignment = { horizontal: i === 0 ? 'left' : 'right', vertical: 'middle', indent: i === 0 ? 1 : 0 };
        for (let x = c; x < c + span; x++) { Object.assign(ws.getCell(r, x), style(r)); ws.getCell(r, x).border = border; }
        c += span;
      });
    };
    put(r0 + 1, headers, () => ({ fill: solid('FFEFE6C4'), font: { bold: true, size: 9 } }));
    rows.forEach((row, i) => put(r0 + 2 + i, row, () => ({ fill: solid(i % 2 ? PAPER : 'FFFFFFFF'), font: { size: 10, bold: !!opts.boldLast && i === rows.length - 1 } })));
    // barras de datos por columna de valor
    (opts.bars || []).forEach(([vi, argb]) => {
      const sc = c0 + lSpan + vi * vSpan;
      ws.addConditionalFormatting({ ref: `${colL(sc)}${r0 + 2}:${colL(sc + vSpan - 1)}${r0 + 1 + rows.length}`, rules: [{ type: 'dataBar', cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb } }] });
    });
    return r0 + 2 + rows.length;
  };

  // ---- Columna izquierda ----
  const mRows = T.methods.rows;
  let L = block(14, 1, 'INGRESOS POR MÉTODO DE PAGO', ['Método', 'Total (S/)', '% del total'], 2,
    mRows.map((r, i) => [r[0], { v: { formula: cell('methods', 3, i), result: r[3] }, fmt: FMT.money }, { v: { formula: cell('methods', 5, i), result: r[5] }, fmt: FMT.pct }]), { bars: [[0, GOLD]] });
  L = block(L + 1, 1, 'AFLUENCIA POR HORA — ENTRADAS VS SALIDAS', ['Hora', 'Entradas', 'Salidas registradas'], 2,
    T.hourly.rows.map((r, i) => [r[0], { v: { formula: cell('hourly', 1, i), result: r[1] }, fmt: FMT.int }, { v: { formula: cell('hourly', 2, i), result: r[2] }, fmt: FMT.int }]), { bars: [[0, GOLD], [1, 'FF8FB8DE']] });

  // ---- Columna derecha ----
  const gI = sumOf('daily', 2), tI = sumOf('daily', 3);
  const gv = (ref, res, fmt = FMT.money) => ({ v: { formula: ref, result: res }, fmt });
  const expF = area => `SUMIF(${col('expenses', 3)},"${area}",${col('expenses', 5)})`;
  const dS = `SUM(${col('daily', 2)})`, dT = `SUM(${col('daily', 3)})`;
  let Rr = block(14, 13, 'GIMNASIO vs TIENDA (CAJAS SEPARADAS)', ['Área', 'Ingresos', 'Gastos', 'Utilidad'], 3, [
    ['Gimnasio', gv(dS, gI), gv(expF('Gimnasio'), gastoG), gv(`${dS}-${expF('Gimnasio')}`, gI - gastoG)],
    ['Tienda', gv(dT, tI), gv(expF('Tienda'), gastoT), gv(`${dT}-${expF('Tienda')}`, tI - gastoT)],
    ['TOTAL', gv(`${dS}+${dT}`, gI + tI), gv(`${expF('Gimnasio')}+${expF('Tienda')}`, gastoG + gastoT), gv(`${dS}+${dT}-${expF('Gimnasio')}-${expF('Tienda')}`, gI + tI - gastoG - gastoT)]
  ], { boldLast: true });
  Rr = block(Rr + 1, 13, 'INDICADORES CLAVE', ['Indicador', 'Valor'], 1, [
    ['Operaciones de cobro', { v: k.operaciones, fmt: FMT.int }], ['Ticket promedio', { v: k.ticket, fmt: FMT.money }],
    ['Costo de ventas (Tienda)', { v: k.costo_ventas, fmt: FMT.money }], ['Utilidad bruta (Tienda)', { v: k.utilidad_tienda, fmt: FMT.money }],
    ['Membresías nuevas / renovaciones', `${k.nuevos} / ${k.renovaciones}`], ['Pases diarios vendidos', { v: k.pases, fmt: FMT.int }]
  ]);
  Rr = block(Rr + 1, 13, 'AFLUENCIA POR DÍA DE LA SEMANA', ['Día', 'Entradas', 'Promedio por día'], 2,
    T.weekday.rows.map((r, i) => [r[0], { v: { formula: cell('weekday', 1, i), result: r[1] }, fmt: FMT.int }, { v: { formula: cell('weekday', 3, i), result: r[3] }, fmt: FMT.dec }]), { bars: [[0, GOLD]] });
  const top = T.topProducts.rows.slice(0, 10);
  Rr = block(Rr + 1, 13, 'TOP 10 PRODUCTOS MÁS VENDIDOS', ['Producto', 'Unidades', 'Ingreso (S/)'], 2,
    top.length ? top.map((r, i) => [r[1], { v: { formula: cell('topProducts', 2, i), result: r[2] }, fmt: FMT.int }, { v: { formula: cell('topProducts', 3, i), result: r[3] }, fmt: FMT.money }]) : [['Sin ventas en el período', '', '']],
    { bars: [[0, GOLD], [1, 'FF9BD39B']] });

  // ---- Mapa de calor ancho completo ----
  let r0 = Math.max(L, Rr) + 1;
  ws.mergeCells(r0, 1, r0, COLS);
  Object.assign(ws.getCell(r0, 1), { value: '  MAPA DE CALOR — ENTRADAS POR DÍA Y HORA (más oscuro = más afluencia)', font: { bold: true, size: 11, color: { argb: GOLD } }, alignment: { vertical: 'middle' } });
  for (let c = 1; c <= COLS; c++) ws.getCell(r0, c).fill = solid(INK);
  ws.getRow(r0).height = 21;
  const hdr = r0 + 1;
  ws.mergeCells(hdr, 1, hdr, 3); Object.assign(ws.getCell(hdr, 1), { value: 'Día' });
  ds.hours.forEach((h, i) => { ws.getCell(hdr, 4 + i).value = `${h}h`; });
  ws.mergeCells(hdr, 23, hdr, 24); ws.getCell(hdr, 23).value = 'Total';
  for (let c = 1; c <= COLS; c++) Object.assign(ws.getCell(hdr, c), { fill: solid('FFEFE6C4'), font: { bold: true, size: 8 }, alignment: { horizontal: 'center' }, border });
  ds.heat.forEach((row, di) => {
    const r = hdr + 1 + di;
    ws.mergeCells(r, 1, r, 3); ws.mergeCells(r, 23, r, 24);
    Object.assign(ws.getCell(r, 1), { value: T.heatmap.rows[di][0], font: { bold: true, size: 10 }, alignment: { indent: 1 } });
    row.forEach((v, hi) => { Object.assign(ws.getCell(r, 4 + hi), { value: { formula: cell('heatmap', 1 + hi, di), result: v }, font: { size: 9 }, alignment: { horizontal: 'center' } }); });
    const tot = row.reduce((a, b) => a + b, 0);
    Object.assign(ws.getCell(r, 23), { value: { formula: `SUM(D${r}:V${r})`, result: tot }, font: { bold: true }, alignment: { horizontal: 'center' } });
    for (let c = 1; c <= COLS; c++) ws.getCell(r, c).border = border;
  });
  ws.addConditionalFormatting({ ref: `D${hdr + 1}:V${hdr + 7}`, rules: [{ type: 'colorScale', cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }], color: [{ argb: 'FFFFFFFF' }, { argb: 'FFF6E3A1' }, { argb: 'FFD4AF37' }] }] });

  const nr = hdr + 9;
  ws.mergeCells(nr, 1, nr + 2, COLS);
  Object.assign(ws.getCell(nr, 1), {
    value: 'Notas: Todas las horas están en hora de Lima. «Sin salida registrada» significa que la persona no escaneó su salida: el sistema NO inventa horas ni duraciones. ' +
      'Gimnasio y Tienda tienen cajas y reportes separados; el consolidado es la suma de ambos. Los montos excluyen cobros anulados. Los totales de cada hoja usan SUBTOTAL y se recalculan al filtrar.',
    font: { size: 9, italic: true, color: { argb: GREY } }, alignment: { wrapText: true, vertical: 'top' }
  });
  pageSetup(ws, null);
  ws.pageSetup.fitToHeight = 0;
  return ws;
}

async function buildXlsx(ds, { publicDir } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = ds.meta.gym_name; wb.lastModifiedBy = ds.meta.gym_name; wb.company = ds.meta.gym_name;
  wb.title = `Reporte ${ds.meta.gym_name} ${ds.meta.from} al ${ds.meta.to}`; wb.created = new Date(); wb.modified = new Date();
  wb.calcProperties.fullCalcOnLoad = true;
  const assets = getBrandAssets(publicDir || path.join(__dirname, '..', 'public'));
  const logoId = wb.addImage({ buffer: assets.logo, extension: 'png' });
  const wmId = wb.addImage({ buffer: assets.watermark, extension: 'png' });
  const ctx = { wb, ds, logoId, ranges: {}, totals: {} };

  const keys = ORDER.filter(k => ds.tables[k]);
  wb.addWorksheet('Dashboard');
  keys.forEach(k => wb.addWorksheet(ds.tables[k].name));
  keys.forEach(k => addDataSheet(ctx, k));
  addDashboard(ctx);
  wb.eachSheet(ws => { try { ws.addBackgroundImage(wmId); } catch (e) { /* marca de agua opcional */ } });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { buildXlsx };
