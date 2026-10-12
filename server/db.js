// Base de datos SQLite (node:sqlite, incluido en Node 22+) y datos iniciales.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const L = require('./lib');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'storage');
fs.mkdirSync(path.join(DATA_DIR, 'photos'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'rdfitness.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const clean = a => a.map(v => (v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v)));
const q = {
  get: (sql, ...a) => db.prepare(sql).get(...clean(a)),
  all: (sql, ...a) => db.prepare(sql).all(...clean(a)),
  run: (sql, ...a) => db.prepare(sql).run(...clean(a)),
  tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); db.exec('COMMIT'); return r; }
    catch (e) { db.exec('ROLLBACK'); throw e; }
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','recepcion','entrenador')),
  pass_hash TEXT NOT NULL, active INTEGER DEFAULT 1, must_change INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY, kind TEXT NOT NULL, ref_id INTEGER NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS plans (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, months INTEGER DEFAULT 0, days INTEGER DEFAULT 0,
  price REAL NOT NULL, active INTEGER DEFAULT 1, sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, dni TEXT, phone TEXT, email TEXT,
  birth TEXT, gender TEXT, address TEXT, emergency TEXT, health TEXT, goal TEXT, level TEXT DEFAULT 'principiante',
  photo TEXT, qr_key TEXT NOT NULL, phys_ver INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active', block_reason TEXT, notes TEXT,
  frozen_from TEXT, trainer_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, consent INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_members_dni ON members(dni);
CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);
CREATE TABLE IF NOT EXISTS memberships (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL REFERENCES members(id), plan_id INTEGER, plan_name TEXT,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, price REAL DEFAULT 0, status TEXT DEFAULT 'active',
  created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ms_member ON memberships(member_id, end_date);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY, member_id INTEGER, membership_id INTEGER, concept TEXT NOT NULL, amount REAL NOT NULL,
  method TEXT NOT NULL, note TEXT, day TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER, voided INTEGER DEFAULT 0, void_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_pay_day ON payments(day);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY, concept TEXT NOT NULL, amount REAL NOT NULL, method TEXT DEFAULT 'efectivo',
  day TEXT NOT NULL, user_id INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, voided INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY, uid TEXT UNIQUE, member_id INTEGER, code TEXT, ts TEXT NOT NULL, day TEXT NOT NULL,
  hour INTEGER, result TEXT NOT NULL, reason TEXT, kind TEXT, device TEXT, user_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_att_member ON attendance(member_id, ts);
CREATE INDEX IF NOT EXISTS idx_att_day ON attendance(day);
CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY, nombre TEXT NOT NULL, grupo TEXT, tipo TEXT, equipo TEXT, nivel TEXT, musculos TEXT, efecto TEXT,
  pasos TEXT, errores TEXT, consejo TEXT, variante TEXT, imagenes TEXT, custom INTEGER DEFAULT 0, video TEXT
);
CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, goal TEXT, level TEXT, days_per_week INTEGER, description TEXT,
  template INTEGER DEFAULT 0, member_id INTEGER, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS routine_items (
  id INTEGER PRIMARY KEY, routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  day_index INTEGER NOT NULL, day_title TEXT, pos INTEGER NOT NULL, ex_id TEXT NOT NULL,
  sets INTEGER DEFAULT 3, reps TEXT DEFAULT '10', seconds INTEGER, rest INTEGER DEFAULT 60, note TEXT
);
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, routine_id INTEGER NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  assigned_by INTEGER, assigned_at TEXT DEFAULT CURRENT_TIMESTAMP, active INTEGER DEFAULT 1, note TEXT
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, routine_id INTEGER, day_index INTEGER, title TEXT,
  started TEXT, finished TEXT, duration_sec INTEGER, volume REAL DEFAULT 0, day TEXT, uid TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS set_logs (
  id INTEGER PRIMARY KEY, workout_id INTEGER REFERENCES workouts(id) ON DELETE CASCADE, member_id INTEGER NOT NULL,
  ex_id TEXT NOT NULL, set_no INTEGER, reps INTEGER, weight REAL, day TEXT
);
CREATE INDEX IF NOT EXISTS idx_sl_member ON set_logs(member_id, ex_id);
CREATE TABLE IF NOT EXISTS measurements (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, day TEXT NOT NULL, weight REAL, height REAL,
  chest REAL, waist REAL, hip REAL, arm REAL, thigh REAL, body_fat REAL, note TEXT, by_staff INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL NOT NULL, stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1,
  barcode TEXT, category TEXT DEFAULT 'general', min_stock INTEGER DEFAULT 5
);
CREATE TABLE IF NOT EXISTS daily_passes (
  id INTEGER PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, dni TEXT, phone TEXT,
  price REAL NOT NULL, method TEXT NOT NULL, op_code TEXT, day TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, user_id INTEGER, scans_count INTEGER DEFAULT 1,
  last_scan TEXT, receipt_no TEXT
);
CREATE INDEX IF NOT EXISTS idx_dp_day ON daily_passes(day);
CREATE INDEX IF NOT EXISTS idx_dp_code ON daily_passes(code);
CREATE TABLE IF NOT EXISTS cash_shifts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  user_name TEXT,
  shift_name TEXT DEFAULT 'Turno General',
  day TEXT NOT NULL,
  opened_at TEXT NOT NULL,
  closed_at TEXT,
  initial_cash REAL NOT NULL DEFAULT 0,
  expected_cash REAL DEFAULT 0,
  actual_cash REAL DEFAULT 0,
  diff_cash REAL DEFAULT 0,
  expected_digital REAL DEFAULT 0,
  status TEXT DEFAULT 'open',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shifts_user ON cash_shifts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_day ON cash_shifts(day);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY, user_id INTEGER, action TEXT, detail TEXT, ts TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// Migración segura de columnas en bases de datos existentes
function ensureColumns() {
  const addCol = (tbl, col, def) => {
    const cols = q.all(`PRAGMA table_info(${tbl})`).map(c => c.name);
    if (!cols.includes(col)) {
      try { db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def}`); } catch (e) { console.error(`Error adding ${col} to ${tbl}:`, e.message); }
    }
  };
  addCol('payments', 'op_code', 'TEXT');
  addCol('payments', 'voucher_img', 'TEXT');
  addCol('payments', 'receipt_no', 'TEXT');
  addCol('payments', 'daily_pass_id', 'INTEGER');
  addCol('payments', 'verified', 'INTEGER DEFAULT 0');
  addCol('payments', 'shift_id', 'INTEGER');
  addCol('payments', 'category', 'TEXT');

  addCol('expenses', 'shift_id', 'INTEGER');
  addCol('expenses', 'category', 'TEXT DEFAULT "gym"');

  addCol('products', 'barcode', 'TEXT');
  addCol('products', 'category', 'TEXT DEFAULT "general"');
  addCol('products', 'min_stock', 'INTEGER DEFAULT 5');

  addCol('memberships', 'extra_days', 'INTEGER DEFAULT 0');
  addCol('memberships', 'promo_note', 'TEXT');

  addCol('products', 'cost', 'REAL DEFAULT 0');
  addCol('products', 'promo_price', 'REAL DEFAULT 0');
  addCol('products', 'promo_desc', 'TEXT');
  addCol('products', 'description', 'TEXT');

  addCol('attendance', 'direction', 'TEXT DEFAULT "in"');
  addCol('attendance', 'exit_ts', 'TEXT');
  addCol('attendance', 'duration_min', 'INTEGER');
  addCol('attendance', 'status', 'TEXT DEFAULT "inside"');
  addCol('attendance', 'notes', 'TEXT');

  // Asignar categorías iniciales para pagos existentes
  try {
    q.run("UPDATE payments SET category='gym' WHERE category IS NULL AND (membership_id IS NOT NULL OR daily_pass_id IS NOT NULL)");
    q.run("UPDATE payments SET category='store' WHERE category IS NULL AND concept LIKE 'Venta:%'");
    q.run("UPDATE payments SET category='gym' WHERE category IS NULL");
  } catch (e) { }
}
ensureColumns();

// ---------- Ajustes ----------
const DEFAULT_SETTINGS = {
  gym_name: 'RD Fitness Club',
  gym_slogan: 'Disciplina · Constancia · Resultados',
  gym_phone: '982404043',
  gym_address: 'Calle Antonio José de Sucre Lt. 10, Chivay (al costado de la discoteca Muya)',
  gym_ruc: '10702548911',
  receipt_prefix: 'B001',
  daily_pass_price: '5',
  warn_days: '5',        // aviso amarillo de vencimiento
  grace_days: '0',       // días de gracia tras vencer
  passback_min: '3',     // minutos para considerar un reingreso duplicado
  stay_min: '120',       // minutos que se considera a alguien "dentro" del gimnasio
  opening: 'Lun a Sáb 6:00 a 21:00',
  color: '#f5b400',
  printer_width: '58mm',
  google_sheets_key: 'RD-CHIVAY-2026',
  yape_phone: '982404043',
  yape_name: 'RD FITNESS CLUB'
};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  q.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
}
const getSettings = () => Object.fromEntries(q.all('SELECT key,value FROM settings').map(r => [r.key, r.value]));
const numSettings = () => {
  const s = getSettings();
  return { ...s, warn_days: +s.warn_days, grace_days: +s.grace_days, passback_min: +s.passback_min, stay_min: +s.stay_min, daily_pass_price: +s.daily_pass_price || 5 };
};

// Generador de correlativo de comprobante / boleta
function nextReceiptNo() {
  const prefix = q.get("SELECT value FROM settings WHERE key='receipt_prefix'")?.value || 'B001';
  const last = q.get("SELECT MAX(id) n FROM payments")?.n || 0;
  return `${prefix}-${String(last + 1).padStart(6, '0')}`;
}

// Generador de código único de pase diario
function dailyPassCode(dayLima) {
  const d = dayLima || L.limaDay();
  const clean = d.replace(/-/g, '').slice(2);
  const count = (q.get("SELECT COUNT(*) n FROM daily_passes WHERE day=?", d)?.n || 0) + 1;
  return `RD-DAY-${clean}-${String(count).padStart(3, '0')}`;
}

// ---------- Datos iniciales ----------
if (!q.get('SELECT 1 x FROM users LIMIT 1')) {
  q.run('INSERT INTO users(username,name,role,pass_hash,must_change) VALUES(?,?,?,?,1)',
    'admin', 'Administrador RD', 'admin', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'RD-Admin-2026', 10));
}
if (!q.get('SELECT 1 x FROM plans LIMIT 1')) {
  [['1 mes', 1, 60, 1], ['3 meses', 3, 170, 2], ['6 meses', 6, 300, 3], ['1 año', 12, 500, 4]]
    .forEach(([n, m, p, s]) => q.run('INSERT INTO plans(name,months,price,sort) VALUES(?,?,?,?)', n, m, p, s));
  q.run('INSERT INTO plans(name,days,price,sort) VALUES(?,?,?,?)', 'Pase diario', 1, 5, 5);
}
if (!q.get('SELECT 1 x FROM products LIMIT 1')) {
  [['Agua 625 ml', 2, 50, '7750106001011', 'bebidas'], ['Bebida energética', 5, 24, '7750106002022', 'bebidas'], ['Toalla RD', 15, 10, '7750106003033', 'accesorios'], ['Proteína (porción)', 8, 30, '7750106004044', 'suplementos']]
    .forEach(([n, p, s, bc, cat]) => q.run('INSERT INTO products(name,price,stock,barcode,category) VALUES(?,?,?,?,?)', n, p, s, bc, cat));
} else {
  // Asignar códigos de barra por defecto si están vacíos
  try {
    q.run("UPDATE products SET barcode='7750106001011', category='bebidas' WHERE name LIKE '%Agua%' AND (barcode IS NULL OR barcode='')");
    q.run("UPDATE products SET barcode='7750106002022', category='bebidas' WHERE name LIKE '%energética%' AND (barcode IS NULL OR barcode='')");
    q.run("UPDATE products SET barcode='7750106003033', category='accesorios' WHERE name LIKE '%Toalla%' AND (barcode IS NULL OR barcode='')");
    q.run("UPDATE products SET barcode='7750106004044', category='suplementos' WHERE name LIKE '%Proteína%' AND (barcode IS NULL OR barcode='')");
  } catch (e) { }
}

// Ejercicios (si faltan, se cargan desde data/exercises.json)
function seedExercises() {
  const f = path.join(__dirname, '..', 'data', 'exercises.json');
  if (!fs.existsSync(f)) return console.warn('Falta data/exercises.json. Ejecuta: npm run setup-images');
  const list = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const e of list) {
    q.run(`INSERT INTO exercises(id,nombre,grupo,tipo,equipo,nivel,musculos,efecto,pasos,errores,consejo,variante,imagenes)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, grupo=excluded.grupo, tipo=excluded.tipo, equipo=excluded.equipo,
           nivel=excluded.nivel, musculos=excluded.musculos, efecto=excluded.efecto, pasos=excluded.pasos, errores=excluded.errores,
           consejo=excluded.consejo, variante=excluded.variante, imagenes=excluded.imagenes WHERE exercises.custom=0`,
      e.id, e.nombre, e.grupo, e.tipo, e.equipo, e.nivel, e.musculos, e.efecto,
      JSON.stringify(e.pasos), JSON.stringify(e.errores), e.consejo, e.variante, JSON.stringify(e.imagenes));
  }
}
seedExercises();

// Rutinas plantilla
function seedRoutines() {
  if (q.get('SELECT 1 x FROM routines WHERE template=1 LIMIT 1')) return;
  const exists = id => !!q.get('SELECT 1 x FROM exercises WHERE id=?', id);
  // item: [ex_id, series, reps, descanso, segundos?]
  const T = [
    { name: 'Full Body Principiante', goal: 'Empezar desde cero, aprender técnica y ganar fuerza', level: 'principiante', dpw: 3,
      description: 'Cuerpo completo 3 días por semana (ej. Lun-Mié-Vie), con 1 día de descanso entre sesiones. Usa un peso con el que podrías hacer 2-3 repeticiones más.',
      days: [
        ['Día 1: Full Body A', [['Goblet_Squat',3,'10',60],['Dumbbell_Bench_Press',3,'10',60],['Seated_Cable_Rows',3,'10',60],['Dumbbell_Shoulder_Press',2,'10',60],['Plank',3,'20 s',45,20]]],
        ['Día 2: Full Body B', [['Leg_Press',3,'12',60],['Pushups',3,'8-12',60],['Wide-Grip_Lat_Pulldown',3,'10',60],['Butt_Lift_Bridge',3,'15',45],['Dead_Bug',3,'8 por lado',45]]],
        ['Día 3: Full Body C', [['Dumbbell_Lunges',3,'10 por pierna',60],['Incline_Dumbbell_Press',3,'10',60],['One-Arm_Dumbbell_Row',3,'10 por lado',60],['Side_Lateral_Raise',2,'12',45],['Crunches',3,'15',45]]]
      ] },
    { name: 'Torso–Pierna (4 días)', goal: 'Ganar masa muscular y fuerza', level: 'intermedio', dpw: 4,
      description: 'Dos días de torso y dos de pierna a la semana (ej. Lun-Mar-Jue-Vie). Aumenta peso o repeticiones cada semana si completas todas las series.',
      days: [
        ['Torso A', [['Barbell_Bench_Press_-_Medium_Grip',4,'6-8',120],['Bent_Over_Barbell_Row',4,'8',90],['Dumbbell_Shoulder_Press',3,'10',90],['Wide-Grip_Lat_Pulldown',3,'10',75],['Dumbbell_Bicep_Curl',3,'12',60],['Triceps_Pushdown_-_Rope_Attachment',3,'12',60]]],
        ['Pierna A', [['Barbell_Squat',4,'6-8',150],['Romanian_Deadlift',3,'8-10',120],['Leg_Press',3,'12',90],['Lying_Leg_Curls',3,'12',60],['Standing_Calf_Raises',4,'15',45],['Plank',3,'30 s',45,30]]],
        ['Torso B', [['Incline_Dumbbell_Press',4,'8-10',90],['Seated_Cable_Rows',4,'10',90],['Side_Lateral_Raise',3,'15',45],['Face_Pull',3,'15',45],['Hammer_Curls',3,'12',60],['Cable_Rope_Overhead_Triceps_Extension',3,'12',60]]],
        ['Pierna B', [['Barbell_Hip_Thrust',4,'8-10',90],['Dumbbell_Lunges',3,'10 por pierna',75],['Leg_Extensions',3,'12-15',60],['Lying_Leg_Curls',3,'12',60],['Standing_Calf_Raises',4,'15',45],['Russian_Twist',3,'20',45]]]
      ] },
    { name: 'Empuje–Tirón–Pierna (3 días)', goal: 'Ganar músculo con buen volumen por grupo', level: 'intermedio', dpw: 3,
      description: 'Rotación Empuje (pecho, hombro, tríceps), Tirón (espalda, bíceps) y Pierna. Ideal 3 días por semana; si puedes 6, repite la rotación.',
      days: [
        ['Empuje', [['Barbell_Bench_Press_-_Medium_Grip',4,'8',90],['Incline_Dumbbell_Press',3,'10',75],['Dumbbell_Shoulder_Press',3,'10',75],['Side_Lateral_Raise',3,'15',45],['Cable_Crossover',3,'12',60],['Triceps_Pushdown_-_Rope_Attachment',3,'12',45]]],
        ['Tirón', [['Wide-Grip_Lat_Pulldown',4,'10',75],['Bent_Over_Barbell_Row',4,'8',90],['Seated_Cable_Rows',3,'10',75],['Face_Pull',3,'15',45],['Barbell_Curl',3,'10',60],['Hammer_Curls',3,'12',45]]],
        ['Pierna', [['Barbell_Squat',4,'8',120],['Romanian_Deadlift',3,'10',90],['Leg_Press',3,'12',90],['Leg_Extensions',3,'12',60],['Lying_Leg_Curls',3,'12',60],['Standing_Calf_Raises',4,'15',45]]]
      ] },
    { name: 'Quema de Grasa: Circuito + Cardio', goal: 'Bajar grasa corporal y mejorar condición física', level: 'principiante', dpw: 4,
      description: 'Circuitos de fuerza (1 min de ejercicio, 20-30 s de descanso) más cardio. Para bajar grasa lo que más pesa es el déficit calórico: combina con una alimentación adecuada.',
      days: [
        ['Circuito A + cardio', [['Bodyweight_Squat',3,'15',30],['Pushups',3,'10',30],['Dumbbell_Lunges',3,'10 por pierna',30],['Mountain_Climbers',3,'30 s',30,30],['Plank',3,'30 s',30,30],['Bicycling_Stationary',1,'15 min',0,900]]],
        ['Cardio continuo', [['Walking_Treadmill',1,'30 min',0,1800],['Cat_Stretch',1,'10',0]]],
        ['Circuito B + cardio', [['Goblet_Squat',3,'12',30],['Seated_Cable_Rows',3,'12',30],['Butt_Lift_Bridge',3,'15',30],['Russian_Twist',3,'20',30],['Rope_Jumping',3,'30 s',30,30],['Running_Treadmill',1,'10 min',0,600]]],
        ['Intervalos', [['Bicycling_Stationary',8,'30 s rápido',60,30],['Mountain_Climbers',3,'30 s',30,30],['Crunches',3,'20',30]]]
      ] },
    { name: 'Glúteos y Piernas', goal: 'Tonificar y desarrollar glúteos y piernas', level: 'principiante', dpw: 3,
      description: 'Foco en glúteos, piernas y core. 2 sesiones de pierna por semana y una de core y cardio.',
      days: [
        ['Glúteo y pierna A', [['Barbell_Hip_Thrust',4,'10',90],['Goblet_Squat',3,'12',75],['Romanian_Deadlift',3,'10',90],['Dumbbell_Lunges',3,'10 por pierna',60],['Standing_Calf_Raises',3,'15',45]]],
        ['Core y cardio', [['Dead_Bug',3,'8 por lado',45],['Plank',3,'30 s',45,30],['Air_Bike',3,'20',45],['Bicycling_Stationary',1,'20 min',0,1200]]],
        ['Glúteo y pierna B', [['Leg_Press',4,'12',75],['Butt_Lift_Bridge',3,'15',45],['Lying_Leg_Curls',3,'12',60],['Leg_Extensions',3,'12',60],['Superman',3,'10',45]]]
      ] },
    { name: 'Movilidad y Fuerza Suave', goal: 'Salud general, adultos mayores o retorno al ejercicio', level: 'principiante', dpw: 3,
      description: 'Ejercicios de bajo impacto para mantener fuerza, equilibrio y movilidad. Usa pesos ligeros y avanza despacio. Si tienes alguna condición médica, consulta antes con tu médico.',
      days: [
        ['Sesión suave', [['Walking_Treadmill',1,'10 min',0,600],['Cat_Stretch',2,'8',30],['Butt_Lift_Bridge',2,'10',45],['Seated_Cable_Rows',2,'12',60],['Leg_Press',2,'12',60],['Dead_Bug',2,'6 por lado',45],['Childs_Pose',1,'45 s',0,45]]]
      ] }
  ];
  q.tx(() => {
    for (const t of T) {
      const r = q.run('INSERT INTO routines(name,goal,level,days_per_week,description,template) VALUES(?,?,?,?,?,1)',
        t.name, t.goal, t.level, t.dpw, t.description);
      t.days.forEach(([title, items], di) => items.forEach(([ex, sets, reps, rest, secs], pos) => {
        if (!exists(ex)) return;
        q.run('INSERT INTO routine_items(routine_id,day_index,day_title,pos,ex_id,sets,reps,seconds,rest) VALUES(?,?,?,?,?,?,?,?,?)',
          r.lastInsertRowid, di, title, pos, ex, sets, reps, secs ?? null, rest);
      }));
    }
  });
}
seedRoutines();

// ---------- Respaldo automático diario ----------
function backup() {
  const f = path.join(DATA_DIR, 'backups', `rdfitness-${L.limaDay()}.db`);
  if (fs.existsSync(f)) return f;
  try { db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`); } catch (e) { console.error('Respaldo falló:', e.message); return null; }
  const files = fs.readdirSync(path.join(DATA_DIR, 'backups')).filter(x => x.endsWith('.db')).sort();
  files.slice(0, Math.max(0, files.length - 30)).forEach(x => fs.unlinkSync(path.join(DATA_DIR, 'backups', x)));
  return f;
}

// ---------- Gestión de Turnos de Caja ----------
function getActiveShift(userId) {
  if (userId) {
    const s = q.get("SELECT * FROM cash_shifts WHERE user_id=? AND status='open' ORDER BY id DESC LIMIT 1", userId);
    if (s) return s;
  }
  return q.get("SELECT * FROM cash_shifts WHERE status='open' ORDER BY id DESC LIMIT 1") || null;
}

function computeShiftTotals(shiftId) {
  const shift = q.get('SELECT * FROM cash_shifts WHERE id=?', shiftId);
  if (!shift) return null;
  const pays = q.all('SELECT * FROM payments WHERE shift_id=? AND voided=0', shiftId);
  const exps = q.all('SELECT * FROM expenses WHERE shift_id=? AND voided=0', shiftId);

  let gymCash = 0, storeCash = 0, otherCash = 0;
  let yape = 0, plin = 0, card = 0, transfer = 0;

  pays.forEach(p => {
    const isStore = p.category === 'store' || (p.concept && p.concept.startsWith('Venta:'));
    if (p.method === 'efectivo') {
      if (isStore) storeCash += p.amount;
      else gymCash += p.amount;
    } else if (p.method === 'yape') {
      yape += p.amount;
    } else if (p.method === 'plin') {
      plin += p.amount;
    } else if (p.method === 'tarjeta') {
      card += p.amount;
    } else if (p.method === 'transferencia') {
      transfer += p.amount;
    }
  });

  const cashExpenses = exps.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0);
  const totalExpenses = exps.reduce((a, e) => a + e.amount, 0);
  const totalCashCollected = gymCash + storeCash + otherCash;
  const initialCash = shift.initial_cash || 0;
  const expectedCashInDrawer = initialCash + totalCashCollected - cashExpenses;
  const expectedDigital = yape + plin + card + transfer;

  return {
    shift,
    initialCash,
    gymCash,
    storeCash,
    otherCash,
    totalCashCollected,
    cashExpenses,
    totalExpenses,
    expectedCashInDrawer,
    expectedDigital,
    digitalBreakdown: { yape, plin, card, transfer },
    totalIncome: pays.reduce((a, p) => a + p.amount, 0),
    paymentsCount: pays.length,
    expensesCount: exps.length,
    payments: pays,
    expenses: exps
  };
}

// ---------- Control de Asistencias (Entradas y Salidas) ----------
function getActiveAttendanceSession(code, day) {
  return q.get(`
    SELECT * FROM attendance
    WHERE code=? AND day=? AND result IN ('ok','warn') AND (status='inside' OR exit_ts IS NULL)
    ORDER BY id DESC LIMIT 1
  `, code, day);
}

function closeAttendanceSession(id, exitTime) {
  const row = q.get('SELECT * FROM attendance WHERE id=?', id);
  if (!row) return null;
  const exitDate = exitTime ? new Date(exitTime) : new Date();
  const enterDate = new Date(row.ts);
  const diffMin = Math.max(1, Math.round((exitDate - enterDate) / 60000));
  q.run("UPDATE attendance SET exit_ts=?, duration_min=?, status='completed' WHERE id=?",
    exitDate.toISOString(), diffMin, id);
  return q.get('SELECT * FROM attendance WHERE id=?', id);
}

module.exports = {
  db, q, DATA_DIR, getSettings, numSettings, backup, seedExercises, nextReceiptNo, dailyPassCode,
  getActiveShift, computeShiftTotals, getActiveAttendanceSession, closeAttendanceSession
};
