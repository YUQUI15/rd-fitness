// Base de datos SQLite (node:sqlite, incluido en Node 22+) y datos iniciales.
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

// Cargar .env automáticamente si existe
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(l => {
      const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = (m[2] || '').trim().replace(/^["']|["']$/g, '');
      }
    });
  }
} catch {}

const bcrypt = require('bcryptjs');
const L = require('./lib');
const CloudVault = require('./cloud-vault');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'storage');
fs.mkdirSync(path.join(DATA_DIR, 'photos'), { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'rdfitness.db');

const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA cache_size = -16000; PRAGMA temp_store = MEMORY;');

const clean = a => a.map(v => (v === undefined ? null : (typeof v === 'boolean' ? (v ? 1 : 0) : v)));
let isBooting = true;
let isRestoring = false;
let cloudReady = !CloudVault.isConfigured();
let localVaultTimer = null;

function scheduleAutoVault(sql) {
  if (isBooting || isRestoring) return;
  const s = String(sql || '').trim().toUpperCase();
  if (!s || s.startsWith('SELECT') || s.startsWith('PRAGMA') || s.startsWith('CREATE') || s.startsWith('ALTER')) return;
  if (s.includes('INTO AUDIT') || s.includes('SET LAST_SEEN=')) return;
  if (localVaultTimer) clearTimeout(localVaultTimer);
  localVaultTimer = setTimeout(() => {
    localVaultTimer = null;
    saveVault();
  }, 800);
  if (localVaultTimer.unref) localVaultTimer.unref();
}

const q = {
  get: (sql, ...a) => db.prepare(sql).get(...clean(a)),
  all: (sql, ...a) => db.prepare(sql).all(...clean(a)),
  run: (sql, ...a) => {
    const r = db.prepare(sql).run(...clean(a));
    scheduleAutoVault(sql);
    return r;
  },
  tx(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const r = fn();
      db.exec('COMMIT');
      scheduleAutoVault('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
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

// ---------- Hub del socio: credenciales propias, avisos, preferencias y notificaciones push ----------
// Las credenciales viven en su propia tabla: el código RD-xxxx (identificador interno) nunca cambia.
db.exec(`
CREATE TABLE IF NOT EXISTS member_credentials (
  member_id INTEGER PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  alias TEXT UNIQUE COLLATE NOCASE, pass_hash TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY, kind TEXT NOT NULL DEFAULT 'aviso', title TEXT NOT NULL, body TEXT,
  audience TEXT NOT NULL DEFAULT 'all', member_id INTEGER, priority TEXT NOT NULL DEFAULT 'info',
  pinned INTEGER DEFAULT 0, starts_at TEXT, ends_at TEXT, cta_label TEXT, cta_url TEXT,
  image_url TEXT,
  push INTEGER DEFAULT 0, push_sent INTEGER DEFAULT 0, archived INTEGER DEFAULT 0,
  created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ann_active ON announcements(archived, starts_at, ends_at);
CREATE TABLE IF NOT EXISTS inbox_reads (
  member_id INTEGER NOT NULL, ref TEXT NOT NULL, read_at TEXT DEFAULT CURRENT_TIMESTAMP, dismissed INTEGER DEFAULT 0,
  PRIMARY KEY (member_id, ref)
);
CREATE TABLE IF NOT EXISTS member_prefs (
  member_id INTEGER PRIMARY KEY, show_promos INTEGER DEFAULT 1, show_reminders INTEGER DEFAULT 1,
  push_critical INTEGER DEFAULT 1, push_news INTEGER DEFAULT 1, push_promos INTEGER DEFAULT 1,
  alert_mode TEXT DEFAULT 'sound', last_push_at TEXT
);
CREATE TABLE IF NOT EXISTS push_subs (
  id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL, endpoint TEXT UNIQUE NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  device_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_push_member ON push_subs(member_id);
`);

// Migración segura de columnas en bases de datos existentes
function ensureColumns() {
  // Sesiones por dispositivo (sesión persistente con vigencia deslizante)
  try {
    const sc = q.all('PRAGMA table_info(sessions)').map(c => c.name);
    for (const [col, def] of [['device_id', 'TEXT'], ['device_label', 'TEXT'], ['last_seen', 'TEXT'], ['ua', 'TEXT']]) {
      if (!sc.includes(col)) db.exec(`ALTER TABLE sessions ADD COLUMN ${col} ${def}`);
    }
  } catch (e) { console.error('Migración sesiones:', e.message); }
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
  addCol('expenses', 'category', "TEXT DEFAULT 'gym'");

  addCol('products', 'barcode', 'TEXT');
  addCol('products', 'category', "TEXT DEFAULT 'general'");
  addCol('products', 'min_stock', 'INTEGER DEFAULT 5');

  addCol('memberships', 'extra_days', 'INTEGER DEFAULT 0');
  addCol('memberships', 'promo_note', 'TEXT');

  addCol('products', 'cost', 'REAL DEFAULT 0');
  addCol('products', 'promo_price', 'REAL DEFAULT 0');
  addCol('products', 'promo_desc', 'TEXT');
  addCol('products', 'description', 'TEXT');

  addCol('attendance', 'direction', "TEXT DEFAULT 'in'");
  addCol('attendance', 'exit_ts', 'TEXT');
  addCol('attendance', 'duration_min', 'INTEGER');
  addCol('attendance', 'status', "TEXT DEFAULT 'inside'");
  addCol('attendance', 'notes', 'TEXT');

  // Líneas de venta estructuradas (producto, cantidad, precio y costo unitarios) para reportes de rentabilidad
  addCol('payments', 'product_id', 'INTEGER');
  addCol('payments', 'qty', 'INTEGER');
  addCol('payments', 'unit_price', 'REAL');
  addCol('payments', 'unit_cost', 'REAL');

  // Hub del socio: multimedia en avisos y preferencia de sonido/vibración
  addCol('announcements', 'image_url', 'TEXT');
  addCol('member_prefs', 'alert_mode', "TEXT DEFAULT 'sound'");

  // Asegurar que por defecto todas las notificaciones estén activas para todos los socios
  try {
    q.run("UPDATE member_prefs SET push_news=1, push_promos=1, show_promos=1, show_reminders=1, push_critical=1 WHERE (push_news=0 AND push_promos=0)");
  } catch (e) { }

  // Asignar categorías iniciales para pagos existentes
  try {
    q.run("UPDATE payments SET category='gym' WHERE category IS NULL AND (membership_id IS NOT NULL OR daily_pass_id IS NOT NULL)");
    q.run("UPDATE payments SET category='store' WHERE category IS NULL AND concept LIKE 'Venta:%'");
    q.run("UPDATE payments SET category='gym' WHERE category IS NULL");
  } catch (e) { }

  // Reconstruir las líneas de venta antiguas a partir del concepto "Venta: <producto> x<cantidad>"
  try {
    const legacy = q.all("SELECT id, concept, amount FROM payments WHERE category='store' AND product_id IS NULL AND concept LIKE 'Venta:%'");
    for (const p of legacy) {
      const m = p.concept.match(/^Venta:\s*(.+?)\s*x(\d+)/i);
      if (!m) continue;
      const prod = q.get('SELECT id, cost FROM products WHERE name=?', m[1].trim());
      if (!prod) continue;
      const qty = parseInt(m[2], 10) || 1;
      q.run('UPDATE payments SET product_id=?, qty=?, unit_price=?, unit_cost=? WHERE id=?',
        prod.id, qty, +(p.amount / qty).toFixed(2), prod.cost || 0, p.id);
    }
  } catch (e) { console.error('Backfill de ventas:', e.message); }

  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_att_exit ON attendance(exit_ts);
      CREATE INDEX IF NOT EXISTS idx_pay_product ON payments(product_id);
      CREATE INDEX IF NOT EXISTS idx_pay_shift ON payments(shift_id, voided);
      CREATE INDEX IF NOT EXISTS idx_exp_shift ON expenses(shift_id, voided);
      CREATE INDEX IF NOT EXISTS idx_exp_day ON expenses(day, voided);
      CREATE INDEX IF NOT EXISTS idx_workouts_member ON workouts(member_id, day);
      CREATE INDEX IF NOT EXISTS idx_ri_routine ON routine_items(routine_id, day_index, pos);
      CREATE INDEX IF NOT EXISTS idx_assign_member ON assignments(member_id, active);
      CREATE INDEX IF NOT EXISTS idx_meas_member ON measurements(member_id, day);
      CREATE INDEX IF NOT EXISTS idx_sessions_ref ON sessions(kind, ref_id);
    `);
  } catch (e) { }
}
ensureColumns();

// ---------- Ajustes ----------
const CLEAN_GYM_ADDRESS = 'Calle Antonio José de Sucre Lt. 10, Chivay';
const sanitizeGymAddress = val => {
  const s = String(val || CLEAN_GYM_ADDRESS)
    .replace(/\s*\(?\s*al costado de\s+(la\s+)?discoteca\s+muya\s*\)?/gi, '')
    .trim();
  return s || CLEAN_GYM_ADDRESS;
};

const DEFAULT_SETTINGS = {
  gym_name: 'RD Fitness Club',
  gym_slogan: 'Disciplina · Constancia · Resultados',
  gym_phone: '982404043',
  gym_address: CLEAN_GYM_ADDRESS,
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
  google_sheets_key: require('crypto').randomBytes(12).toString('hex'),
  google_sheet_url: '',
  yape_phone: '982404043',
  yape_name: 'RD FITNESS CLUB'
};
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
  q.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
}
// Limpieza permanente de referencias comerciales externas en dirección oficial
q.run("UPDATE settings SET value=? WHERE key='gym_address' AND LOWER(value) LIKE '%muya%'", CLEAN_GYM_ADDRESS);
// La clave antigua era adivinable y daba acceso a datos financieros y personales: se reemplaza por una aleatoria
q.run("UPDATE settings SET value=? WHERE key='google_sheets_key' AND (value='RD-CHIVAY-2026' OR value IS NULL OR value='')",
  require('crypto').randomBytes(12).toString('hex'));
const getSettings = () => {
  const map = Object.fromEntries(q.all('SELECT key,value FROM settings').map(r => [r.key, r.value]));
  if (map.gym_address) map.gym_address = sanitizeGymAddress(map.gym_address);
  return map;
};
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
      ] },
    { name: 'PPL Hipertrofia Pro (6 días)', goal: 'Hipertrofia muscular acelerada y volumen óptimo', level: 'avanzado', dpw: 6,
      description: 'Esquema de Empuje/Tirón/Pierna frecuencia 2 (Push-Pull-Legs). Ideal para intermedios y avanzados que buscan maximizar ganancias musculares dividiendo fuerza e hipertrofia.',
      days: [
        ['Empuje 1: Fuerza', [['Barbell_Bench_Press_-_Medium_Grip',4,'6-8',120],['Overhead_Press_Barbell',3,'8-10',90],['Incline_Dumbbell_Press',3,'10',75],['Dips_-_Triceps_Version',3,'10-12',60],['Side_Lateral_Raise',4,'12-15',45],['Triceps_Pushdown_-_Rope_Attachment',3,'12',45]]],
        ['Tirón 1: Fuerza', [['Pullups',4,'8-10',90],['Bent_Over_Barbell_Row',4,'6-8',120],['Seated_Cable_Rows',3,'10',75],['Face_Pull',3,'15',45],['Barbell_Curl',3,'8-10',60],['Hammer_Curls',3,'10-12',45]]],
        ['Pierna 1: Cuádriceps', [['Barbell_Squat',4,'6-8',150],['Leg_Press',4,'10-12',90],['Romanian_Deadlift',3,'8-10',90],['Leg_Extensions',3,'12-15',60],['Standing_Calf_Raises',4,'15',45],['Plank',3,'40 s',45,40]]],
        ['Empuje 2: Hipertrofia', [['Incline_Dumbbell_Press',4,'8-10',90],['Dumbbell_Bench_Press',3,'10-12',75],['Arnold_Dumbbell_Press',3,'10-12',75],['Cable_Crossover',3,'12-15',60],['Skull_Crushers',3,'12',60],['Lu_Raises',3,'12-15',45]]],
        ['Tirón 2: Hipertrofia', [['Wide-Grip_Lat_Pulldown',4,'10-12',75],['T_Bar_Row',4,'8-10',90],['Chest_Supported_Row',3,'10-12',75],['Lat_Prayer_Cable',3,'12-15',60],['Preacher_Curl',3,'10-12',60],['Cable_Bicep_Curl',3,'12-15',45]]],
        ['Pierna 2: Glúteo & Isquios', [['Barbell_Hip_Thrust',4,'8-10',90],['Bulgarian_Split_Squat',3,'10 por pierna',75],['Lying_Leg_Curls',4,'10-12',60],['Hack_Squat',3,'10-12',75],['Seated_Calf_Raise',4,'15',45],['Ab_Wheel_Rollout',3,'12',45]]]
      ] },
    { name: 'Arnold Split Clásico (6 días)', goal: 'Desarrollo muscular completo con superseries antagonistas', level: 'avanzado', dpw: 6,
      description: 'El clásico esquema de Arnold Schwarzenegger: Pecho y Espalda, Hombros y Brazos, Piernas. Permite entrenar cada músculo dos veces por semana con bombeo legendario.',
      days: [
        ['Pecho & Espalda 1', [['Barbell_Bench_Press_-_Medium_Grip',4,'8-10',90],['Bent_Over_Barbell_Row',4,'8-10',90],['Incline_Dumbbell_Press',3,'10',75],['Wide-Grip_Lat_Pulldown',3,'10',75],['Dumbbell_Pullover',3,'12',60]]],
        ['Hombros & Brazos 1', [['Overhead_Press_Barbell',4,'8-10',90],['Side_Lateral_Raise',4,'12-15',45],['Barbell_Curl',3,'10',60],['Close_Grip_Bench_Press',3,'10',60],['Preacher_Curl',3,'12',45],['Triceps_Pushdown_-_Rope_Attachment',3,'12',45]]],
        ['Piernas & Core 1', [['Barbell_Squat',4,'8',120],['Romanian_Deadlift',3,'10',90],['Leg_Press',4,'12',90],['Lying_Leg_Curls',3,'12',60],['Standing_Calf_Raises',4,'15',45],['Hanging_Leg_Raise',3,'15',45]]],
        ['Pecho & Espalda 2', [['Dumbbell_Bench_Press',4,'10',75],['Seated_Cable_Rows',4,'10',75],['Incline_Chest_Cable_Fly',3,'12-15',60],['Pullups',3,'8-10',75],['Chest_Supported_Row',3,'12',60]]],
        ['Hombros & Brazos 2', [['Arnold_Dumbbell_Press',4,'10',75],['Face_Pull',3,'15',45],['Hammer_Curls',3,'12',60],['EZ-Bar_Skullcrusher',3,'12',60],['Bicep_Curl_21s',2,'21',60],['Bench_Dips',3,'15',45]]],
        ['Piernas & Core 2', [['Barbell_Hip_Thrust',4,'10',90],['Bulgarian_Split_Squat',3,'10 por pierna',75],['Leg_Extensions',3,'12-15',60],['Seated_Calf_Raise',4,'15',45],['Russian_Twist',3,'20',45],['Dragon_Flag',3,'8-10',60]]]
      ] },
    { name: 'Fuerza Máxima 5x5 (3 días)', goal: 'Ganar fuerza bruta en levantamientos multiarticulares', level: 'intermedio', dpw: 3,
      description: 'Programa lineal enfocado en sentadilla, press de banca, peso muerto y press militar con 5 series pesadas de 5 repeticiones. Descansos completos de 2 a 3 minutos.',
      days: [
        ['Fuerza A', [['Barbell_Squat',5,'5',150],['Barbell_Bench_Press_-_Medium_Grip',5,'5',150],['Bent_Over_Barbell_Row',5,'5',120],['Plank',3,'45 s',45,45]]],
        ['Fuerza B', [['Barbell_Squat',5,'5',150],['Overhead_Press_Barbell',5,'5',150],['Barbell_Deadlift',1,'5 (pesado)',180],['Pullups',3,'6-8',90]]],
        ['Fuerza C', [['Barbell_Squat',5,'5',150],['Barbell_Bench_Press_-_Medium_Grip',5,'5',150],['Romanian_Deadlift',3,'8',120],['Barbell_Curl',3,'8-10',60]]]
      ] },
    { name: 'Booty Builder & Curvas Elite (4 días)', goal: 'Desarrollo supremo de glúteos y piernas con cintura estética', level: 'intermedio', dpw: 4,
      description: 'Especialización en tren inferior y glúteos con activación neuromuscular, cargas progresivas y tensión metabólica. Ideal para moldear curvas con respaldo científico.',
      days: [
        ['Glúteos Máxima Carga', [['Barbell_Hip_Thrust',4,'8-10',90],['Bulgarian_Split_Squat',3,'10 por pierna',75],['Romanian_Deadlift',3,'10',90],['Cable_Glute_Kickback',3,'12-15 por pierna',45],['Abductor_Machine',4,'15-20',45]]],
        ['Tren Superior & Cintura', [['Wide-Grip_Lat_Pulldown',3,'10-12',60],['Dumbbell_Shoulder_Press',3,'10-12',60],['Seated_Cable_Rows',3,'12',60],['Side_Lateral_Raise',3,'15',45],['Plank',3,'30 s',45,30],['Dead_Bug',3,'10 por lado',45]]],
        ['Femorales & Glúteos', [['Romanian_Deadlift',4,'10',90],['Leg_Press',4,'12 (pies altos)',75],['Lying_Leg_Curls',4,'12',60],['Butt_Lift_Bridge',3,'15',45],['Seated_Calf_Raise',3,'15',45]]],
        ['Pump Glúteos & Acondicionamiento', [['Barbell_Hip_Thrust',3,'12 con pausa 2s',75],['Goblet_Squat',3,'12',60],['Adductor_Machine',3,'15',45],['Kettlebell_Swing',3,'15-20',60],['Mountain_Climbers',3,'30 s',30,30]]]
      ] },
    { name: 'Definición & HIIT Atlético (5 días)', goal: 'Quema de grasa acelerada, resistencia cardiovascular y tono muscular', level: 'intermedio', dpw: 5,
      description: 'Fusión de fuerza en superseries con bloques HIIT (alta intensidad). Mantiene el músculo mientras maximiza el gasto calórico diario.',
      days: [
        ['Torso Fuerza + HIIT', [['Dumbbell_Bench_Press',3,'10-12',45],['Wide-Grip_Lat_Pulldown',3,'10-12',45],['Pushups',3,'12',45],['Dumbbell_Shoulder_Press',3,'12',45],['Burpees',3,'10',60]]],
        ['Piernas Potencia + Cardio', [['Goblet_Squat',3,'12',45],['Leg_Press',3,'15',60],['Romanian_Deadlift',3,'12',45],['Rope_Jumping',4,'45 s',30,45],['Running_Treadmill',1,'12 min',0,720]]],
        ['Core de Acero & HIIT', [['Mountain_Climbers',4,'30 s',30,30],['Russian_Twist',4,'20',30],['Hanging_Knee_Raise',3,'15',45],['Air_Bike',4,'30 s intenso',45,30],['Bicycling_Stationary',1,'15 min',0,900]]],
        ['Circuito Full Body', [['Dumbbell_Lunges',3,'10 por pierna',30],['Seated_Cable_Rows',3,'12',30],['Incline_Dumbbell_Press',3,'12',30],['Farmers_Walk',3,'40 s',45,40],['Plank',3,'45 s',30,45]]],
        ['Quema Grasa Final', [['Kettlebell_Swing',4,'20',45],['Running_Treadmill',6,'1 min rápido / 1 min suave',60,60],['Air_Bike',3,'45 s',45,45],['Superman',3,'12',30]]]
      ] },
    { name: 'Hipertrofia Torso–Pierna Pro (4 días)', goal: 'Volumen hipertrófico estructurado y ganancias musculares puras', level: 'intermedio', dpw: 4,
      description: 'División de 4 días enfocada en estímulo mecánico directo (RPE 8-9) combinando barras, mancuernas y poleas para máximo crecimiento.',
      days: [
        ['Torso 1: Fuerza & Grosor', [['Barbell_Bench_Press_-_Medium_Grip',4,'6-8',120],['T_Bar_Row',4,'8-10',90],['Overhead_Press_Barbell',3,'8-10',90],['Pullups',3,'8-10',90],['Close_Grip_Bench_Press',3,'10',60]]],
        ['Pierna 1: Fuerza & Cuádriceps', [['Barbell_Squat',4,'6-8',150],['Hack_Squat',3,'10-12',90],['Romanian_Deadlift',3,'8-10',90],['Standing_Calf_Raises',4,'15',45],['Ab_Wheel_Rollout',3,'10-12',45]]],
        ['Torso 2: Densidad & Detalle', [['Incline_Dumbbell_Press',4,'8-10',90],['Seated_Cable_Rows',4,'10-12',75],['Incline_Chest_Cable_Fly',3,'12-15',60],['Face_Pull',3,'15',45],['Preacher_Curl',3,'10-12',60],['Triceps_Katana_Extension',3,'12-15',45]]],
        ['Pierna 2: Glúteo & Cadena Posterior', [['Barbell_Hip_Thrust',4,'8-10',90],['Bulgarian_Split_Squat',3,'10 por pierna',75],['Lying_Leg_Curls',4,'10-12',60],['Leg_Extensions',3,'12-15',60],['Seated_Calf_Raise',4,'15',45],['Hanging_Leg_Raise',3,'12-15',45]]]
      ] },
    { name: 'Especialización Brazos de Acero & Antebrazos (4 días)', goal: 'Maximizar tamaño de bíceps, tríceps y antebrazos sin descuidar torso y pierna', level: 'intermedio', dpw: 4,
      description: 'Programa de especialización para brazos rezagados: incluye un día exclusivo de bombeo de brazos y antebrazos con ángulos de máximo estiramiento y contracción.',
      days: [
        ['Día 1: Brazos & Antebrazos (Fuerza)', [['EZ-Bar_Curl',4,'8-10',75],['Close_Grip_Bench_Press',4,'8-10',90],['Alternate_Incline_Dumbbell_Curl',3,'10-12',60],['Skull_Crushers',3,'10-12',60],['Cable_Hammer_Curls_-_Rope_Attachment',3,'12-15',45],['Barbell_Wrist_Curl',4,'15-20',45],['Reverse_Barbell_Curl',3,'12-15',45]]],
        ['Día 2: Piernas & Core', [['Barbell_Squat',4,'8',120],['Romanian_Deadlift',3,'10',90],['Leg_Press',3,'12',75],['Seated_Leg_Curl',3,'12',60],['Calf_Press_On_The_Leg_Press_Machine',4,'15',45],['Ab_Wheel_Rollout',3,'12',45]]],
        ['Día 3: Pecho, Espalda & Hombros', [['Barbell_Incline_Bench_Press_-_Medium_Grip',4,'8-10',90],['Chin-Up',4,'8-10',90],['Butterfly',3,'12-15',60],['T_Bar_Row',3,'10',75],['Arnold_Dumbbell_Press',3,'10-12',75],['Side_Lateral_Raise',4,'15',45]]],
        ['Día 4: Brazos & Agarre (Hipertrofia)', [['Preacher_Curl',4,'10-12',60],['Cable_Incline_Triceps_Extension',4,'10-12',60],['Bayesian_Cable_Curl',3,'12-15',45],['Cable_One_Arm_Tricep_Extension',3,'12-15',45],['Drag_Curl',3,'12',45],['Palms-Down_Wrist_Curl_Over_A_Bench',3,'15-20',45],['Plate_Pinch',3,'35 s',45,35]]]
      ] },
    { name: 'Espalda en V & Hombros 3D (4 días)', goal: 'Ensanchar clavículas y dorsales para lograr una silueta estética en V', level: 'intermedio', dpw: 4,
      description: 'Enfocado en amplitud dorsal, deltoides laterales/posteriores y trapecios con soporte completo de pierna y empuje.',
      days: [
        ['Día 1: Amplitud Dorsal & Hombro Lateral', [['Pullups',4,'8-10',90],['Wide-Grip_Lat_Pulldown',4,'10-12',75],['Kneeling_Single-Arm_High_Pulley_Row',3,'12 por lado',60],['Overhead_Press_Barbell',4,'8',90],['Side_Lateral_Raise',4,'15',45],['Bent_Over_Low-Pulley_Side_Lateral',3,'15',45]]],
        ['Día 2: Pierna Completa & Glúteo', [['Hack_Squat',4,'8-10',90],['Barbell_Hip_Thrust',4,'10',90],['Barbell_Walking_Lunge',3,'10 por pierna',75],['Seated_Leg_Curl',3,'12',60],['Standing_Calf_Raises',4,'15',45]]],
        ['Día 3: Pecho, Densidad de Espalda & Trapecio', [['Barbell_Bench_Press_-_Medium_Grip',4,'8',90],['Incline_Dumbbell_Row',4,'10-12',75],['Low_Cable_Crossover',3,'12-15',60],['Straight_Arm_Cable_Pulldown',3,'15',45],['Barbell_Shrug',4,'12',60],['Band_Pull_Apart',3,'20',30]]],
        ['Día 4: Hombros 3D, Brazos & Core', [['Arnold_Dumbbell_Press',4,'10',75],['Upright_Cable_Row',3,'12',60],['Cable_Rear_Delt_Fly',4,'15',45],['EZ-Bar_Curl',3,'10-12',60],['Triceps_Pushdown_-_Rope_Attachment',3,'12',60],['Cable_Russian_Twists',3,'15 por lado',45]]]
      ] },
    { name: 'Calistenia & Peso Corporal Pro (4 días)', goal: 'Dominio del peso corporal, fuerza relativa y definición atlética', level: 'intermedio', dpw: 4,
      description: 'Entrenamiento funcional basado en dominadas, fondos, flexiones avanzadas, core gimnástico y potencia de piernas.',
      days: [
        ['Día 1: Empuje Calisténico & Core', [['Dips_Chest',4,'8-12',90],['Pushups',4,'15-20',60],['Body_Tricep_Press',3,'12',60],['Bench_Dips',3,'15',45],['Hanging_Leg_Raise',4,'12',60],['Plank',3,'45 s',45,45]]],
        ['Día 2: Tirón Calisténico & Agarre', [['Pullups',4,'8-10',90],['Chin-Up',4,'8-10',90],['Inverted_Row',4,'12-15',60],['Band_Pull_Apart',3,'20',30],['Farmers_Walk',3,'45 s',60,45]]],
        ['Día 3: Pierna Atlética & Pliometría', [['Bulgarian_Split_Squat',4,'10 por pierna',75],['Glute_Ham_Raise',3,'8-10',90],['Front_Box_Jump',4,'8',60],['Single_Leg_Hip_Thrust',3,'12 por pierna',60],['Standing_Calf_Raises',4,'20',45]]],
        ['Día 4: Full Body Metabólico', [['Burpees',4,'12',60],['Battling_Ropes',4,'30 s',45,30],['Mountain_Climbers',4,'40 s',30,40],['Dragon_Flag',3,'8',60],['Alternate_Heel_Touchers',3,'20',30]]]
      ] },
    { name: 'Glúteos & Abdomen Esculpido (5 días)', goal: 'Máxima hipertrofia de glúteo mayor/medio y cintura compacta', level: 'intermedio', dpw: 5,
      description: 'Frecuencia 3 de tren inferior enfocada en diferentes vectores de carga (horizontal, vertical, abducción) más 2 sesiones de torso estilizado y core.',
      days: [
        ['Día 1: Vector Horizontal (Glúteo Mayor)', [['Monster_Walk',2,'15 pasos',30],['Barbell_Hip_Thrust',4,'8-10',90],['Kneeling_Squat',3,'12',75],['Cable_Glute_Kickback',3,'15 por pierna',45],['Abductor_Machine',4,'15-20',45],['Ab_Crunch_Machine',3,'15',45]]],
        ['Día 2: Espalda, Hombros & Postura', [['Close_Grip_Lat_Pulldown',4,'10-12',60],['Seated_Cable_Rows',3,'12',60],['Alternating_Deltoid_Raise',3,'12',45],['Band_Pull_Apart',3,'20',30],['Cable_Rope_Crunch',3,'15',45]]],
        ['Día 3: Vector Vertical (Cuádriceps & Glúteo)', [['Sumo_Deadlift',4,'8-10',90],['Bulgarian_Split_Squat',3,'10 por pierna',75],['Dumbbell_Step_Up',3,'12 por pierna',60],['Adductor_Machine',3,'15',45],['Seated_Calf_Raise',4,'15',45]]],
        ['Día 4: Brazos Tonificados & Core', [['Butterfly',3,'12-15',60],['Cable_Bicep_Curl',3,'12-15',45],['Cable_One_Arm_Tricep_Extension',3,'12-15',45],['Cable_Russian_Twists',3,'15 por lado',45],['Alternate_Heel_Touchers',3,'20',30],['Bicycling',1,'15 min',0,900]]],
        ['Día 5: Isquiotibiales & Bombeo Glúteo', [['Romanian_Deadlift',4,'10',90],['Seated_Leg_Curl',4,'12',60],['Physioball_Hip_Bridge',3,'15',45],['Abductor_Machine',3,'20',45],['IT_Band_and_Glute_Stretch',2,'30 s',15,30]]]
      ] },
    { name: 'Postura, Core & Movilidad Articular (3 días)', goal: 'Eliminar dolores de espalda, mejorar flexibilidad y fortalecer el centro', level: 'principiante', dpw: 3,
      description: 'Ideal para quienes trabajan muchas horas sentados, buscan prevenir lesiones o desean complementar su rutina de pesas con movilidad consciente.',
      days: [
        ['Día 1: Columna, Escápulas & Core', [['Cat_Stretch',3,'10',30],['Band_Pull_Apart',3,'20',30],['Face_Pull',3,'15',45],['Dead_Bug',3,'10 por lado',45],['Plank',3,'30 s',45,30],['Childs_Pose',2,'45 s',15,45]]],
        ['Día 2: Cadera, Isquios & Glúteo Medio', [['90_90_Hamstring',3,'10 por pierna',30],['Monster_Walk',3,'15 pasos',30],['Physioball_Hip_Bridge',3,'12',45],['Goblet_Squat',3,'10 (pausa abajo)',60],['IT_Band_and_Glute_Stretch',2,'35 s',15,35]]],
        ['Día 3: Estabilidad Total & Cardio Suave', [['Inverted_Row',3,'10',60],['Cable_Russian_Twists',3,'12 por lado',45],['Farmers_Walk',3,'40 s',45,40],['Superman',3,'12',30],['Bicycling',1,'15 min',0,900]]]
      ] }
  ];
  q.tx(() => {
    for (const t of T) {
      let existing = q.get('SELECT id FROM routines WHERE name=? AND template=1', t.name);
      let rid = existing?.id;
      if (!rid) {
        const r = q.run('INSERT INTO routines(name,goal,level,days_per_week,description,template) VALUES(?,?,?,?,?,1)',
          t.name, t.goal, t.level, t.dpw, t.description);
        rid = r.lastInsertRowid;
      } else {
        const itemCount = q.get('SELECT COUNT(*) c FROM routine_items WHERE routine_id=?', rid)?.c || 0;
        if (itemCount > 0) continue;
      }
      t.days.forEach(([title, items], di) => items.forEach(([ex, sets, reps, rest, secs], pos) => {
        if (!exists(ex)) return;
        q.run('INSERT INTO routine_items(routine_id,day_index,day_title,pos,ex_id,sets,reps,seconds,rest) VALUES(?,?,?,?,?,?,?,?,?)',
          rid, di, title, pos, ex, sets, reps, secs ?? null, rest);
      }));
    }
  });
}
seedRoutines();

// ---------- Bóveda Automática Persistente (JSON Vault & Cloud Vault Sync) ----------
function getVaultData() {
  return {
    gym_name: getSettings().gym_name || 'RD Fitness Club',
    exported_at: new Date().toISOString(),
    version: '3.0',
    users: q.all('SELECT id, username, name, role, pass_hash, active, must_change, created_at FROM users'),
    sessions: q.all('SELECT * FROM sessions'),
    members: q.all('SELECT * FROM members'),
    memberships: q.all('SELECT * FROM memberships'),
    payments: q.all('SELECT * FROM payments'),
    expenses: q.all('SELECT * FROM expenses'),
    attendance: q.all('SELECT * FROM attendance'),
    daily_passes: q.all('SELECT * FROM daily_passes'),
    products: q.all('SELECT * FROM products'),
    plans: q.all('SELECT * FROM plans'),
    settings: q.all('SELECT * FROM settings'),
    member_credentials: q.all('SELECT * FROM member_credentials'),
    member_prefs: q.all('SELECT * FROM member_prefs'),
    announcements: q.all('SELECT * FROM announcements'),
    inbox_reads: q.all('SELECT * FROM inbox_reads'),
    push_subs: q.all('SELECT * FROM push_subs'),
    routines: q.all('SELECT * FROM routines'),
    routine_items: q.all('SELECT * FROM routine_items'),
    assignments: q.all('SELECT * FROM assignments'),
    workouts: q.all('SELECT * FROM workouts'),
    set_logs: q.all('SELECT * FROM set_logs'),
    measurements: q.all('SELECT * FROM measurements'),
    cash_shifts: q.all('SELECT * FROM cash_shifts')
  };
}

function saveVault() {
  if (isRestoring) return false;
  try {
    const data = getVaultData();
    const targetPaths = [
      path.join(DATA_DIR, 'backup-vault.json'),
      path.join(__dirname, '..', 'storage', 'backup-vault.json')
    ];

    for (const p of targetPaths) {
      try {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
      } catch {}
    }

    if (CloudVault.isConfigured() && cloudReady) {
      CloudVault.schedule(() => getVaultData(), 1000);
    }

    return true;
  } catch (e) {
    console.warn('[VAULT] Error guardando bóveda JSON:', e.message);
    return false;
  }
}

function applyVaultData(d) {
  if (!d || (!Array.isArray(d.members) && !Array.isArray(d.users))) return 0;
  let restored = 0;
  isRestoring = true;
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    q.tx(() => {
      const replaceTable = (tbl, rows, { keepIfEmpty = false } = {}) => {
        if (!Array.isArray(rows)) return 0;
        if (keepIfEmpty && rows.length === 0) return 0;
        try { q.run(`DELETE FROM ${tbl}`); } catch (e) {}
        let c = 0;
        for (const r of rows) {
          const keys = Object.keys(r);
          const cols = keys.join(', ');
          const ph = keys.map(() => '?').join(', ');
          const vals = Object.values(r);
          try {
            q.run(`INSERT OR REPLACE INTO ${tbl} (${cols}) VALUES (${ph})`, ...vals);
            c++;
          } catch (e) {}
        }
        return c;
      };

      if (Array.isArray(d.settings)) {
        d.settings.forEach(s => {
          if (s && s.key === 'gym_address') s.value = sanitizeGymAddress(s.value);
        });
      }
      replaceTable('settings', d.settings, { keepIfEmpty: true });
      for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
        q.run('INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)', k, v);
      }
      q.run("UPDATE settings SET value=? WHERE key='gym_address' AND LOWER(value) LIKE '%muya%'", CLEAN_GYM_ADDRESS);
      replaceTable('users', d.users, { keepIfEmpty: true });
      if (Array.isArray(d.sessions) && d.sessions.length > 0) {
        replaceTable('sessions', d.sessions);
      }
      replaceTable('plans', d.plans, { keepIfEmpty: true });
      replaceTable('products', d.products, { keepIfEmpty: true });
      restored = replaceTable('members', d.members);
      replaceTable('memberships', d.memberships);
      replaceTable('payments', d.payments);
      replaceTable('expenses', d.expenses);
      replaceTable('attendance', d.attendance);
      replaceTable('daily_passes', d.daily_passes);
      replaceTable('member_credentials', d.member_credentials);
      replaceTable('member_prefs', d.member_prefs);
      replaceTable('announcements', d.announcements);
      replaceTable('inbox_reads', d.inbox_reads);
      replaceTable('push_subs', d.push_subs);
      replaceTable('routines', d.routines, { keepIfEmpty: true });
      replaceTable('routine_items', d.routine_items, { keepIfEmpty: true });
      replaceTable('assignments', d.assignments);
      replaceTable('workouts', d.workouts);
      replaceTable('set_logs', d.set_logs);
      replaceTable('measurements', d.measurements);
      replaceTable('cash_shifts', d.cash_shifts);
    });
    try {
      seedExercises();
      seedRoutines();
    } catch (e) {}
  } finally {
    try { db.exec('PRAGMA foreign_keys = ON;'); } catch {}
    isRestoring = false;
  }
  checkpoint();
  return restored;
}

function restoreVault() {
  const memberCount = q.get('SELECT COUNT(*) c FROM members')?.c || 0;
  if (memberCount > 0) return memberCount;

  const vaultPaths = [
    path.join(DATA_DIR, 'backup-vault.json'),
    path.join(__dirname, '..', 'storage', 'backup-vault.json')
  ];

  const vaultFile = vaultPaths.find(p => fs.existsSync(p));
  if (!vaultFile) return 0;

  try {
    const raw = fs.readFileSync(vaultFile, 'utf8');
    const d = JSON.parse(raw);
    const restored = applyVaultData(d);
    console.log(`[VAULT] Restauración de bóveda completada: ${restored} socios recuperados desde ${path.basename(vaultFile)}.`);
    return restored;
  } catch (err) {
    console.error('[VAULT] Error restaurando bóveda automática:', err.message);
    return 0;
  }
}

async function restoreVaultFromCloud() {
  if (!CloudVault.isConfigured()) {
    cloudReady = true;
    return 0;
  }
  try {
    const d = await CloudVault.pull();
    if (!d) {
      cloudReady = true;
      await CloudVault.push(getVaultData()).catch(() => {});
      return q.get('SELECT COUNT(*) c FROM members')?.c || 0;
    }
    const restored = applyVaultData(d);
    try {
      const fresh = getVaultData();
      CloudVault._lastSig = CloudVault._sig(fresh);
      const targetPaths = [
        path.join(DATA_DIR, 'backup-vault.json'),
        path.join(__dirname, '..', 'storage', 'backup-vault.json')
      ];
      for (const p of targetPaths) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(fresh, null, 2), 'utf8');
      }
    } catch {}
    cloudReady = true;
    console.log(`[CLOUD VAULT] Sincronización desde la nube completada (${CloudVault.getProvider()}): ${restored} socios restaurados.`);
    return restored;
  } catch (err) {
    console.warn('[CLOUD VAULT] Error en restoreVaultFromCloud (se reintentará en 15s sin sobrescribir la nube):', err.message);
    const t = setTimeout(() => { restoreVaultFromCloud().catch(() => {}); }, 15000);
    if (t.unref) t.unref();
    return 0;
  }
}

restoreVault();
isBooting = false;

// ---------- Consolidación WAL y Respaldo automático ----------
function checkpoint() {
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    console.error('WAL checkpoint falló:', e.message);
  }
}

function backup() {
  checkpoint();
  saveVault();
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `rdfitness-${L.limaDay()}.db`);
  if (fs.existsSync(f)) return f;
  try {
    const safePath = f.replace(/\\/g, '/').replace(/'/g, "''");
    db.exec(`VACUUM INTO '${safePath}'`);
  } catch (e) { console.error('Respaldo falló:', e.message); return null; }
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
  db, q, DATA_DIR, getSettings, numSettings, backup, checkpoint, saveVault, restoreVault, restoreVaultFromCloud, getVaultData, CloudVault,
  seedExercises, nextReceiptNo, dailyPassCode, getActiveShift, computeShiftTotals, getActiveAttendanceSession, closeAttendanceSession
};
