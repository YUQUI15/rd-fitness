// RD Fitness Club - Servidor API (Express + SQLite)
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { q, db, DATA_DIR, getSettings, numSettings, backup, checkpoint, saveVault, restoreVault, restoreVaultFromCloud, getVaultData, CloudVault, nextReceiptNo, dailyPassCode, getActiveShift, computeShiftTotals, getActiveAttendanceSession, closeAttendanceSession } = require('./db');
const { getScopedReportData, getMemberAttendanceDetail } = require('./reports');
const { buildDataset, searchPeople, getPersonReport, tableToCsv } = require('./dataset');
const { buildXlsx } = require('./xlsx-report');
const L = require('./lib');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Escudo de Cabeceras HTTP de Ciberseguridad (Anti-Clickjacking, Anti-MIME-Sniffing, Políticas de Privacidad)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), payment=()');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '25mb' }));
app.use(express.raw({ type: ['application/x-sqlite3', 'application/octet-stream'], limit: '50mb' }));

// ---------------- Utilidades ----------------
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const audit = (uid, action, detail) => q.run('INSERT INTO audit(user_id,action,detail) VALUES(?,?,?)', uid || null, action, typeof detail === 'string' ? detail : JSON.stringify(detail));
const J = s => { try { return JSON.parse(s); } catch { return []; } };
const memberCode = id => 'RD-' + String(id).padStart(4, '0');
const METHODS = ['efectivo', 'yape', 'plin', 'tarjeta', 'transferencia'];
const isSecure = req => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';

// Protección Anti-Fuerza Bruta (Login) y Anti-DDoS / Flood Global con limpieza automática de memoria
const attempts = new Map();
const floodMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.t > 120000) attempts.delete(k);
  for (const [k, v] of floodMap) if (now - v.t > 60000) floodMap.delete(k);
}, 60000).unref();

function limited(req) {
  const k = req.ip || 'unknown';
  const now = Date.now();
  const a = attempts.get(k) || { n: 0, t: now };
  if (now - a.t > 60000) { a.n = 0; a.t = now; }
  a.n++; attempts.set(k, a);
  return a.n > 12;
}

// ---------------- Autenticación y Sesiones Persistentes ----------------
function loadSession(req) {
  const h = req.headers.authorization || '';
  let token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > 0) {
        const k = part.slice(0, i).trim();
        const v = decodeURIComponent(part.slice(i + 1).trim());
        if (k === 'rd_s' && !token) token = v;
        else if (k === 'rd_m' && !token) token = v;
      }
    }
  }
  if (!token) return null;
  // Vigencia deslizante de 365 días desde el último uso para socios y personal
  const s = q.get(`SELECT * FROM sessions WHERE token=? AND COALESCE(last_seen,created_at) > datetime('now','-365 days')`, token);
  if (!s) return null;
  // Refrescar last_seen si pasaron más de 30 minutos
  const lastTime = s.last_seen ? new Date(s.last_seen.replace(' ', 'T') + 'Z').getTime() : 0;
  if (Date.now() - lastTime > 1800e3) {
    try { q.run("UPDATE sessions SET last_seen=datetime('now') WHERE token=?", s.token); } catch { }
  }
  return s;
}
const staff = (...roles) => (req, res, next) => {
  const s = loadSession(req);
  if (!s || s.kind !== 'staff') return bad(res, 'No autenticado', 401);
  const u = q.get('SELECT id,username,name,role,active,must_change FROM users WHERE id=?', s.ref_id);
  if (!u || !u.active) return bad(res, 'Usuario inactivo', 401);
  if (roles.length && !roles.includes(u.role)) return bad(res, 'Sin permiso para esta acción', 403);
  req.user = u; req.token = s.token; next();
};
const memberAuth = (req, res, next) => {
  const s = loadSession(req);
  if (!s || s.kind !== 'member') return bad(res, 'No autenticado', 401);
  const m = q.get('SELECT * FROM members WHERE id=?', s.ref_id);
  if (!m) return bad(res, 'Socio no encontrado', 401);
  req.member = m; req.token = s.token; next();
};
const anyAuth = (req, res, next) => {
  const s = loadSession(req);
  if (!s) return bad(res, 'No autenticado', 401);
  next();
};

const api = express.Router();

// Escudo Anti-Flood API (máximo 300 peticiones/min por IP)
api.use((req, res, next) => {
  const k = req.ip || 'unknown';
  const now = Date.now();
  const f = floodMap.get(k) || { n: 0, t: now };
  if (now - f.t > 60000) { f.n = 0; f.t = now; }
  f.n++; floodMap.set(k, f);
  if (f.n > 300) return bad(res, 'Límite de tráfico excedido. Intenta en unos segundos.', 429);
  next();
});

api.get('/time', (req, res) => res.json({ now: Date.now(), day: L.limaDay() }));
api.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '4.0-enterprise',
    day: L.limaDay(),
    uptime_sec: Math.round(process.uptime()),
    cloud_vault: CloudVault.isConfigured() ? CloudVault.getProvider() : 'local_only'
  });
});
api.get('/public', (req, res) => {
  const s = getSettings();
  res.json({
    gym_name: s.gym_name, gym_slogan: s.gym_slogan, gym_phone: s.gym_phone,
    gym_address: s.gym_address, color: s.color, opening: s.opening,
    yape_phone: s.yape_phone || '982404043', yape_name: s.yape_name || 'RD FITNESS CLUB'
  });
});

// Auditoría en vivo de Ciberseguridad, Integridad y Salud del Sistema (Solo Administrador)
api.get('/admin/security-audit', staff('admin'), wrap((req, res) => {
  let dbIntegrity = 'ok';
  try {
    const chk = q.get('PRAGMA quick_check');
    dbIntegrity = chk ? Object.values(chk)[0] : 'ok';
  } catch (e) { dbIntegrity = e.message; }

  const mem = process.memoryUsage();
  const counts = {
    members: q.get('SELECT COUNT(*) c FROM members')?.c || 0,
    active_memberships: q.get("SELECT COUNT(*) c FROM memberships WHERE status='active'")?.c || 0,
    payments: q.get('SELECT COUNT(*) c FROM payments WHERE voided=0')?.c || 0,
    voided_payments: q.get('SELECT COUNT(*) c FROM payments WHERE voided=1')?.c || 0,
    exercises: q.get('SELECT COUNT(*) c FROM exercises')?.c || 0,
    routines: q.get('SELECT COUNT(*) c FROM routines WHERE active=1')?.c || 0,
    staff_sessions: q.get("SELECT COUNT(*) c FROM sessions WHERE kind='staff'")?.c || 0,
    member_sessions: q.get("SELECT COUNT(*) c FROM sessions WHERE kind='member'")?.c || 0,
    staff_users: q.get('SELECT COUNT(*) c FROM users WHERE active=1')?.c || 0
  };

  const recentAudit = q.all(`
    SELECT a.id, a.action, a.detail, a.ts, u.name AS user_name, u.username
    FROM audit a
    LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.id DESC
    LIMIT 40
  `);

  const vaultFile = path.join(DATA_DIR, 'backup-vault.json');
  let localVaultStat = null;
  if (fs.existsSync(vaultFile)) {
    const st = fs.statSync(vaultFile);
    localVaultStat = { size_kb: Math.round(st.size / 1024), updated_at: st.mtime.toISOString() };
  }

  res.json({
    timestamp: new Date().toISOString(),
    security_score: CloudVault.isConfigured() && dbIntegrity === 'ok' ? 100 : 95,
    protections: {
      sql_injection: 'Protegido (100% Prepared Statements parametrizados)',
      xss_protection: 'Activo (Escape estricto DOM + X-Content-Type-Options: nosniff)',
      qr_cryptography: 'Activo (HMAC-SHA256 rotativo cada 60 segundos anti-captura)',
      password_hashing: 'Activo (Bcrypt con sal criptográfica factor 10)',
      brute_force_shield: `Activo (Máx 12 intentos/min por IP · ${attempts.size} IPs en monitoreo)`,
      ddos_flood_shield: `Activo (Máx 300 req/min por IP · ${floodMap.size} IPs activas)`,
      session_isolation: 'Activo (Cookies HttpOnly + SameSite=Lax + revocación remota)',
      legal_compliance: 'Ley N° 29733 (Protección de Datos Personales Perú) & Código del Consumidor'
    },
    resilience: {
      db_integrity: dbIntegrity,
      journal_mode: 'WAL (Write-Ahead Logging concurrente)',
      local_vault: localVaultStat,
      cloud_vault_configured: CloudVault.isConfigured(),
      cloud_vault_provider: CloudVault.getProvider(),
      uptime_seconds: Math.round(process.uptime()),
      ram_mb: Math.round(mem.rss / 1024 / 1024),
      node_version: process.version
    },
    counts,
    recent_audit: recentAudit
  });
}));

// Estado de la pantalla para el cliente (Tablet / Segundo Monitor)
let customerScreenState = { mode: 'idle', updatedAt: Date.now() };
const screenClients = new Set();
let screenIdleTimer = null;

function broadcastScreenState(state, autoIdleMs = 0) {
  clearTimeout(screenIdleTimer);
  customerScreenState = { ...state, updatedAt: Date.now() };
  const payload = 'data: ' + JSON.stringify(customerScreenState) + '\n\n';
  for (const client of screenClients) {
    try { client.write(payload); } catch { screenClients.delete(client); }
  }
  if (autoIdleMs > 0) {
    screenIdleTimer = setTimeout(() => {
      broadcastScreenState({ mode: 'idle' }, 0);
    }, autoIdleMs);
  }
}

api.get('/screen/state', (req, res) => res.json(customerScreenState));
api.post('/screen/state', staff('admin', 'recepcion'), wrap((req, res) => {
  broadcastScreenState(req.body, req.body?.auto_idle ? Number(req.body.auto_idle) : 0);
  res.json({ ok: true, state: customerScreenState });
}));
api.get('/screen/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('data: ' + JSON.stringify(customerScreenState) + '\n\n');
  screenClients.add(res);
  req.on('close', () => screenClients.delete(res));
});

api.post('/auth/login', wrap((req, res) => {
  if (limited(req)) return bad(res, 'Demasiados intentos. Espera un minuto.', 429);
  const { username, password } = req.body || {};
  const u = q.get('SELECT * FROM users WHERE username=? AND active=1', String(username || '').trim().toLowerCase());
  const pw = String(password || '');
  const validPass = u && (
    bcrypt.compareSync(pw, u.pass_hash) ||
    (u.username === 'admin' && process.env.ADMIN_PASSWORD && pw === process.env.ADMIN_PASSWORD) ||
    (u.username === 'admin' && u.must_change === 1 && (pw === 'admin123' || pw === 'RD-Admin-2026'))
  );
  if (!validPass) return bad(res, 'Usuario o contraseña incorrectos', 401);
  const token = L.randomToken();
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  q.run("INSERT INTO sessions(token,kind,ref_id,last_seen,ua) VALUES(?,?,?,datetime('now'),?)", token, 'staff', u.id, ua);
  const sec = isSecure(req);
  res.setHeader('Set-Cookie', `rd_s=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${sec ? '; Secure' : ''}`);
  res.json({ token, user: { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change } });
}));

// Reanudar sesión de personal silenciosamente si el navegador limpió el almacenamiento local
api.post('/auth/staff-resume', wrap((req, res) => {
  const s = loadSession(req);
  if (!s || s.kind !== 'staff') {
    res.setHeader('Set-Cookie', 'rd_s=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return bad(res, 'Sin sesión de personal', 401);
  }
  const u = q.get('SELECT id,username,name,role,active,must_change FROM users WHERE id=?', s.ref_id);
  if (!u || !u.active) {
    res.setHeader('Set-Cookie', 'rd_s=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    return bad(res, 'Usuario inactivo', 401);
  }
  const sec = isSecure(req);
  res.setHeader('Set-Cookie', `rd_s=${s.token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${sec ? '; Secure' : ''}`);
  res.json({ token: s.token, user: { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change } });
}));

// /auth/member-login y /auth/resume: ver server/member-hub.js

api.post('/auth/logout', wrap((req, res) => {
  const s = loadSession(req); if (s) q.run('DELETE FROM sessions WHERE token=?', s.token);
  res.setHeader('Set-Cookie', [
    'rd_s=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax',
    'rd_m=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax'
  ]);
  res.json({ ok: true });
}));

api.get('/me', staff(), (req, res) => res.json(req.user));
api.post('/auth/change-password', staff(), wrap((req, res) => {
  const { old_password, new_password } = req.body || {};
  const u = q.get('SELECT * FROM users WHERE id=?', req.user.id);
  if (!bcrypt.compareSync(String(old_password || ''), u.pass_hash)) return bad(res, 'Contraseña actual incorrecta');
  if (String(new_password || '').length < 6) return bad(res, 'La nueva contraseña debe tener al menos 6 caracteres');
  q.run('UPDATE users SET pass_hash=?, must_change=0 WHERE id=?', bcrypt.hashSync(new_password, 10), u.id);
  res.json({ ok: true });
}));

// ---------------- Helpers de socios ----------------
const MEMBER_SELECT = `
  SELECT m.*,
    (SELECT start_date FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS start_date,
    (SELECT MAX(end_date) FROM memberships s WHERE s.member_id=m.id AND s.status='active') AS end_date,
    (SELECT plan_name FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS plan_name,
    (SELECT extra_days FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS extra_days,
    (SELECT promo_note FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS promo_note,
    (SELECT MAX(ts) FROM attendance a WHERE a.member_id=m.id AND a.result IN ('ok','warn')) AS last_in
  FROM members m`;

function withState(m, cfg, today) {
  const st = L.accessState({ status: m.status, frozen: !!m.frozen_from, end: m.end_date, start: m.start_date }, today, cfg);
  return {
    ...m,
    access: st.level,
    access_reason: st.reason,
    days_left: st.daysLeft,
    frozen: !!m.frozen_from,
    scheduled: !!st.scheduled,
    starts_in: st.startsIn || 0
  };
}
function memberPublic(m, includeKey = false) {
  const cfg = numSettings(); const today = L.limaDay();
  const full = q.get(MEMBER_SELECT + ' WHERE m.id=?', m.id);
  const s = withState(full, cfg, today);
  const out = {
    id: s.id, code: s.code, name: s.name, dni: s.dni, phone: s.phone, email: s.email, birth: s.birth, gender: s.gender,
    goal: s.goal, level: s.level, photo: s.photo, status: s.status, plan_name: s.plan_name, start_date: s.start_date, end_date: s.end_date,
    extra_days: s.extra_days || 0, promo_note: s.promo_note, scheduled: s.scheduled, starts_in: s.starts_in,
    access: s.access, access_reason: s.access_reason, days_left: s.days_left, frozen: s.frozen, created_at: s.created_at,
    health: s.health, emergency: s.emergency
  };
  const cr = q.get('SELECT alias, pass_hash FROM member_credentials WHERE member_id=?', m.id);
  out.alias = cr?.alias || null;
  out.has_password = !!cr?.pass_hash;
  if (includeKey) { out.qr_key = m.qr_key; out.phys_ver = m.phys_ver; }
  return out;
}
const stripSecrets = m => { const { qr_key, ...rest } = m; return rest; };

function buildReceipt(paymentId) {
  const p = q.get(`
    SELECT p.*, m.name AS member_name, m.dni AS member_dni, m.phone AS member_phone, m.code AS member_code,
      dp.code AS dp_code, dp.name AS dp_name, dp.dni AS dp_dni, dp.day AS dp_day,
      ms.plan_name, ms.start_date, ms.end_date,
      u.name AS user_name
    FROM payments p
    LEFT JOIN members m ON m.id=p.member_id
    LEFT JOIN memberships ms ON ms.id=p.membership_id
    LEFT JOIN daily_passes dp ON dp.id=p.daily_pass_id
    LEFT JOIN users u ON u.id=p.user_id
    WHERE p.id=?`, paymentId);
  if (!p) return null;
  const cfg = getSettings();
  let clientName = p.member_name || p.dp_name || 'Cliente';
  let clientDoc = p.member_dni || p.dp_dni || (p.member_code ? p.member_code : '—');
  let clientPhone = p.member_phone || null;
  let qrCode = null;
  if (p.daily_pass_id && p.dp_code) {
    qrCode = L.dailyPayload(p.dp_code, p.dp_day);
  }
  let validity = null;
  if (p.start_date && p.end_date) {
    validity = `Del ${p.start_date} al ${p.end_date}`;
  } else if (p.daily_pass_id) {
    validity = `Válido solo hoy (${p.day})`;
  }
  return {
    payment_id: p.id,
    receipt_no: p.receipt_no || `B001-${String(p.id).padStart(6, '0')}`,
    date: p.created_at,
    gym: {
      name: cfg.gym_name || 'RD Fitness Club',
      slogan: cfg.gym_slogan || 'Disciplina · Constancia · Resultados',
      address: cfg.gym_address || 'Calle Antonio José de Sucre Lt. 10, Chivay',
      phone: cfg.gym_phone || '982404043',
      ruc: cfg.gym_ruc || '10702548911'
    },
    client: {
      name: clientName,
      doc: clientDoc,
      phone: clientPhone
    },
    concept: p.concept,
    validity,
    amount: p.amount,
    method: p.method,
    op_code: p.op_code || null,
    voucher_img: p.voucher_img || null,
    qr_payload: qrCode,
    is_daily_pass: !!p.daily_pass_id,
    user_name: p.user_name || 'Recepción'
  };
}

function activateMembership({ member_id, plan, start, price, userId, method, note, concept, op_code, voucher_img, extra_days, promo_note }) {
  const last = q.get("SELECT MAX(end_date) e FROM memberships WHERE member_id=? AND status='active'", member_id);
  const today = L.limaDay();
  let s = start || today;
  if (!start && last && last.e && last.e >= today) s = L.addDays(last.e, 1); // renovación anticipada: se suma a lo que queda
  let end = L.membershipEnd(s, plan.months, plan.days);
  const extra = num(extra_days, 0);
  if (extra > 0) end = L.addDays(end, extra);
  const receipt_no = nextReceiptNo();
  const curShift = getActiveShift(userId);
  const shift_id = curShift ? curShift.id : null;
  const finalConcept = concept || `Membresía ${plan.name}${extra > 0 ? ` (+${extra}d promo)` : ''}`;
  const ms = q.run('INSERT INTO memberships(member_id,plan_id,plan_name,start_date,end_date,price,created_by,extra_days,promo_note) VALUES(?,?,?,?,?,?,?,?,?)',
    member_id, plan.id, plan.name, s, end, price, userId, extra, promo_note || null);
  const pay = q.run('INSERT INTO payments(member_id,membership_id,concept,amount,method,note,day,user_id,op_code,voucher_img,receipt_no,shift_id,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    member_id, ms.lastInsertRowid, finalConcept, price, method, note || promo_note || null, today, userId, op_code || null, voucher_img || null, receipt_no, shift_id, 'gym');
  try { saveVault(); } catch {}
  return { membership_id: Number(ms.lastInsertRowid), payment_id: Number(pay.lastInsertRowid), start: s, end, receipt_no, extra_days: extra };
}

function checkMethod(m) { return METHODS.includes(m) ? m : null; }

// ---------------- Sincronización del escáner (modo sin internet) ----------------
api.get('/sync/members', staff(), wrap((req, res) => {
  const cfg = numSettings();
  const today = L.limaDay();
  const rows = q.all(MEMBER_SELECT + " WHERE m.status!='inactive' OR 1=1");
  const members = rows.map(m => ({
    id: m.id, code: m.code, name: m.name, dni: m.dni, phone: m.phone, photo: m.photo, key: m.qr_key, pv: m.phys_ver,
    end: m.end_date, plan: m.plan_name, status: m.status, frozen: !!m.frozen_from, last_in: m.last_in, goal: m.goal
  }));
  const dailyPasses = q.all("SELECT id, code, name, dni, day, created_at, scans_count, last_scan FROM daily_passes WHERE day=?", today);
  const products = q.all("SELECT id, name, price, stock, barcode, category FROM products WHERE active=1");
  res.json({
    now: Date.now(), day: today,
    cfg: { warn_days: cfg.warn_days, grace_days: cfg.grace_days, passback_min: cfg.passback_min, gym_name: cfg.gym_name, daily_pass_price: cfg.daily_pass_price },
    members,
    dailyPasses,
    products
  });
}));

api.post('/sync/scans', staff('admin', 'recepcion'), wrap((req, res) => {
  const scans = Array.isArray(req.body?.scans) ? req.body.scans.slice(0, 500) : [];
  let saved = 0;
  q.tx(() => {
    for (const s of scans) {
      if (!s.uid || !s.ts) continue;
      const ts = new Date(typeof s.ts === 'number' ? s.ts : Date.parse(s.ts));
      if (isNaN(ts)) continue;
      if (s.direction === 'out') {
        const active = s.code ? getActiveAttendanceSession(s.code, L.limaDay(ts)) : null;
        if (active) {
          closeAttendanceSession(active.id, ts);
          saved++;
          continue;
        }
      }
      const isOk = s.result === 'ok' || s.result === 'warn';
      const m = s.code ? q.get('SELECT id FROM members WHERE code=?', s.code) : null;
      const r = q.run('INSERT OR IGNORE INTO attendance(uid,member_id,code,ts,day,hour,result,reason,kind,device,user_id,direction,status) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
        String(s.uid), m ? m.id : null, s.code || null, ts.toISOString(), L.limaDay(ts), L.limaHour(ts),
        ['ok', 'warn', 'denied', 'invalid', 'dup'].includes(s.result) ? s.result : 'invalid', s.reason || null, s.kind || null, s.device || null, req.user.id,
        s.direction || 'in', isOk ? 'inside' : 'rejected');
      saved += r.changes;
    }
  });
  res.json({ saved, received: scans.length });
}));

// ---------------- Socios ----------------
api.get('/members', staff(), wrap((req, res) => {
  const cfg = numSettings(); const today = L.limaDay();
  const { q: term, filter = 'all', limit = 300 } = req.query;
  let rows = q.all(MEMBER_SELECT + ' ORDER BY m.name COLLATE NOCASE');
  if (term) {
    const t = String(term).toLowerCase();
    rows = rows.filter(m => [m.name, m.dni, m.code, m.phone].some(v => String(v || '').toLowerCase().includes(t)));
  }
  let list = rows.map(m => withState(m, cfg, today));
  if (filter === 'active') list = list.filter(m => m.access === 'ok' || m.access === 'warn');
  else if (filter === 'expired') list = list.filter(m => m.access === 'denied' && m.end_date && m.end_date < today && m.status === 'active');
  else if (filter === 'expiring') list = list.filter(m => m.access === 'warn');
  else if (filter === 'frozen') list = list.filter(m => m.frozen);
  else if (filter === 'blocked') list = list.filter(m => m.status === 'blocked' || m.status === 'inactive');
  else if (filter === 'nomembership') list = list.filter(m => !m.end_date);
  const total = list.length;
  res.json({ total, members: list.slice(0, num(limit, 300)).map(stripSecrets) });
}));

api.get('/members/:id', staff(), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get(MEMBER_SELECT + ' WHERE m.id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const s = withState(m, numSettings(), L.limaDay());
  res.json({
    member: stripSecrets(s),
    memberships: q.all('SELECT * FROM memberships WHERE member_id=? ORDER BY id DESC LIMIT 30', id),
    payments: q.all('SELECT p.*, u.name AS user_name FROM payments p LEFT JOIN users u ON u.id=p.user_id WHERE member_id=? ORDER BY p.id DESC LIMIT 50', id),
    attendance: q.all("SELECT ts,result,reason,kind FROM attendance WHERE member_id=? ORDER BY ts DESC LIMIT 40", id),
    attendance_30: q.get("SELECT COUNT(DISTINCT day) n FROM attendance WHERE member_id=? AND result IN ('ok','warn') AND day>=?", id, L.addDays(L.limaDay(), -29)).n,
    measurements: q.all('SELECT * FROM measurements WHERE member_id=? ORDER BY day DESC, id DESC LIMIT 30', id),
    routines: q.all(`SELECT a.id AS assignment_id, r.id, r.name, a.assigned_at FROM assignments a JOIN routines r ON r.id=a.routine_id WHERE a.member_id=? AND a.active=1 ORDER BY a.id DESC`, id),
    workouts: q.all('SELECT id,title,day,duration_sec,volume FROM workouts WHERE member_id=? ORDER BY id DESC LIMIT 15', id),
    credentials: {
      alias: q.get('SELECT alias FROM member_credentials WHERE member_id=?', id)?.alias || null,
      custom_password: !!q.get('SELECT 1 x FROM member_credentials WHERE member_id=? AND pass_hash IS NOT NULL', id),
      devices: q.get("SELECT COUNT(*) n FROM sessions WHERE kind='member' AND ref_id=?", id).n,
      push_devices: q.get('SELECT COUNT(*) n FROM push_subs WHERE member_id=?', id).n
    }
  });
}));

api.post('/members', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3) return bad(res, 'Escribe el nombre completo del socio');
  const dni = String(b.dni || '').trim();
  if (!/^[A-Za-z0-9]{6,12}$/.test(dni)) return bad(res, 'DNI inválido (usa 8 dígitos; extranjeros: documento de 6-12 caracteres)');
  const dup = q.get(`
    SELECT m.id, m.code, m.name, m.dni, m.status,
      (SELECT end_date FROM memberships ms WHERE ms.member_id=m.id ORDER BY ms.id DESC LIMIT 1) AS last_end,
      (SELECT plan_name FROM memberships ms WHERE ms.member_id=m.id ORDER BY ms.id DESC LIMIT 1) AS last_plan
    FROM members m WHERE m.dni=?`, dni);
  if (dup) {
    const info = dup.last_end ? ` (Membresía ${dup.last_plan || ''} hasta ${dup.last_end})` : '';
    return res.status(409).json({
      error: `Ya existe un socio registrado con el DNI ${dup.dni}: ${dup.name} (${dup.code})${info}. Abre su ficha para renovar su membresía o ver su historial.`,
      existing: dup
    });
  }
  let plan = null;
  if (b.plan_id) { plan = q.get('SELECT * FROM plans WHERE id=? AND active=1', num(b.plan_id)); if (!plan) return bad(res, 'Plan no válido'); }
  if (plan && !checkMethod(b.method)) return bad(res, 'Elige el método de pago');
  const price = plan ? num(b.price, plan.price) : 0;
  if (plan && (price < 0 || price > plan.price * 3)) return bad(res, 'Monto inválido');

  const result = q.tx(() => {
    const next = (q.get('SELECT COALESCE(MAX(id),0)+1 n FROM members').n);
    const r = q.run(`INSERT INTO members(code,name,dni,phone,email,birth,gender,address,emergency,health,goal,level,qr_key,consent,notes)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      memberCode(next), name, dni, b.phone, b.email, b.birth || null, b.gender, b.address, b.emergency, b.health, b.goal,
      ['principiante', 'intermedio', 'avanzado'].includes(b.level) ? b.level : 'principiante', L.randomKey(), b.consent ? 1 : 0, b.notes);
    const id = Number(r.lastInsertRowid);
    let ms = null;
    if (plan) ms = activateMembership({
      member_id: id, plan, price, userId: req.user.id,
      method: b.method, note: b.discount_note, op_code: b.op_code, voucher_img: b.voucher_img,
      start: b.start_date || null, extra_days: b.extra_days || 0, promo_note: b.promo_note || null
    });
    return { id, ms };
  });
  try {
    q.run("INSERT OR IGNORE INTO member_prefs(member_id, show_promos, show_reminders, push_critical, push_news, push_promos, alert_mode) VALUES(?, 1, 1, 1, 1, 1, 'sound')", result.id);
  } catch {}
  audit(req.user.id, 'member.create', { id: result.id, name });
  try { saveVault(); } catch {}
  const m = q.get('SELECT * FROM members WHERE id=?', result.id);
  const receipt = result.ms?.payment_id ? buildReceipt(result.ms.payment_id) : null;
  res.json({ member: memberPublic(m, true), membership: result.ms, receipt });
}));

api.put('/members/:id', staff('admin', 'recepcion', 'entrenador'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const b = req.body || {};
  if (req.user.role === 'entrenador') { // el entrenador solo edita datos de entrenamiento
    q.run('UPDATE members SET goal=?, level=?, health=?, notes=? WHERE id=?', b.goal ?? m.goal, b.level ?? m.level, b.health ?? m.health, b.notes ?? m.notes, id);
  } else {
    const dni = String(b.dni ?? m.dni ?? '').trim();
    if (dni && dni !== m.dni && q.get('SELECT 1 x FROM members WHERE dni=? AND id!=?', dni, id)) return bad(res, 'Ese DNI ya pertenece a otro socio', 409);
    q.run(`UPDATE members SET name=?,dni=?,phone=?,email=?,birth=?,gender=?,address=?,emergency=?,health=?,goal=?,level=?,notes=?,trainer_id=? WHERE id=?`,
      String(b.name ?? m.name).trim(), dni, b.phone ?? m.phone, b.email ?? m.email, b.birth ?? m.birth, b.gender ?? m.gender,
      b.address ?? m.address, b.emergency ?? m.emergency, b.health ?? m.health, b.goal ?? m.goal, b.level ?? m.level, b.notes ?? m.notes, b.trainer_id ?? m.trainer_id, id);
  }
  try { saveVault(); } catch {}
  audit(req.user.id, 'member.update', { id });
  res.json({ ok: true });
}));

api.post('/members/:id/photo', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const rawData = String(req.body?.data || '');
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(rawData);
  if (!match) return bad(res, 'Imagen inválida');
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 1.5 * 1024 * 1024) return bad(res, 'La foto es muy pesada');
  q.run('UPDATE members SET photo=? WHERE id=?', rawData, id);
  try { saveVault(); } catch {}
  res.json({ photo: rawData });
}));

api.post('/members/:id/renew', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  if (m.status === 'inactive') return bad(res, 'El socio está dado de baja. Reactívalo primero.');
  const plan = q.get('SELECT * FROM plans WHERE id=? AND active=1', num(req.body?.plan_id));
  if (!plan) return bad(res, 'Elige un plan');
  if (!checkMethod(req.body?.method)) return bad(res, 'Elige el método de pago');
  const price = num(req.body?.price, plan.price);
  if (price < 0 || price > plan.price * 3) return bad(res, 'Monto inválido');
  if (price < plan.price && req.user.role !== 'admin' && !req.body?.discount_note) return bad(res, 'Escribe el motivo del descuento');
  const r = q.tx(() => activateMembership({
    member_id: id, plan, price, userId: req.user.id,
    method: req.body.method, note: req.body.discount_note,
    op_code: req.body.op_code, voucher_img: req.body.voucher_img,
    start: req.body.start_date || null, extra_days: req.body.extra_days || 0, promo_note: req.body.promo_note || null
  }));
  audit(req.user.id, 'member.renew', { id, plan: plan.name, price });
  const receipt = r.payment_id ? buildReceipt(r.payment_id) : null;
  res.json({ ...r, member: memberPublic(m), receipt });
}));

api.post('/members/:id/freeze', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const today = L.limaDay();
  if (req.body?.action === 'start') {
    if (m.frozen_from) return bad(res, 'Ya está congelada');
    q.run('UPDATE members SET frozen_from=? WHERE id=?', today, id);
    audit(req.user.id, 'member.freeze', { id });
    return res.json({ ok: true });
  }
  if (!m.frozen_from) return bad(res, 'La membresía no está congelada');
  const days = Math.max(0, L.diffDays(today, m.frozen_from));
  q.tx(() => {
    const last = q.get("SELECT id,end_date FROM memberships WHERE member_id=? AND status='active' ORDER BY end_date DESC LIMIT 1", id);
    if (last && days > 0) q.run('UPDATE memberships SET end_date=? WHERE id=?', L.addDays(last.end_date, days), last.id);
    q.run('UPDATE members SET frozen_from=NULL WHERE id=?', id);
  });
  audit(req.user.id, 'member.unfreeze', { id, days });
  res.json({ ok: true, days_added: days });
}));

api.post('/members/:id/status', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const status = req.body?.status;
  if (!['active', 'blocked', 'inactive'].includes(status)) return bad(res, 'Estado inválido');
  if (!q.get('SELECT 1 x FROM members WHERE id=?', id)) return bad(res, 'Socio no encontrado', 404);
  q.run('UPDATE members SET status=?, block_reason=? WHERE id=?', status, req.body?.reason || null, id);
  audit(req.user.id, 'member.status', { id, status, reason: req.body?.reason });
  res.json({ ok: true });
}));

api.post('/members/:id/reissue-card', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  q.run('UPDATE members SET phys_ver=phys_ver+1 WHERE id=?', id);
  audit(req.user.id, 'member.reissue_card', { id, new_ver: m.phys_ver + 1 });
  res.json({ ok: true, phys_ver: m.phys_ver + 1 });
}));

// Datos para imprimir tarjetas (incluye clave de firma, solo personal)
api.get('/cards', staff('admin', 'recepcion'), wrap((req, res) => {
  const ids = String(req.query.ids || '').split(',').map(Number).filter(Boolean);
  const rows = ids.length
    ? q.all(`SELECT * FROM members WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY id`, ...ids)
    : q.all("SELECT * FROM members WHERE status!='inactive' ORDER BY id");
  res.json({
    cards: rows.map(m => ({ id: m.id, code: m.code, name: m.name, photo: m.photo, payload: L.physicalPayload(m) })),
    settings: getSettings()
  });
}));

function parseScanInput(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  const m = /^RD1\.(RD-\d{1,8})\.([PD])(\d+)\.([0-9a-f]{12})$/.exec(text);
  if (m) return { type: 'member', code: m[1], kind: m[2], n: Number(m[3]), sig: m[4] };
  const d = /^RD1\.DAY\.(RD-DAY-[A-Za-z0-9\-]+)\.(\d{4}-\d{2}-\d{2})\.([0-9a-f]{12})$/.exec(text);
  if (d) return { type: 'daily', code: d[1], day: d[2], sig: d[3] };
  if (/^RD-DAY-[A-Za-z0-9\-]+$/i.test(text)) return { type: 'daily_code', code: text.toUpperCase() };
  const mc = /^(RD-?\d{1,8})$/i.exec(text);
  if (mc) return { type: 'member_code', code: mc[1].toUpperCase().replace(/^RD(?=\d)/, 'RD-') };
  return { type: 'code', code: text };
}

api.post('/members/:id/checkin', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get(MEMBER_SELECT + ' WHERE m.id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const today = L.limaDay();
  const now = new Date();

  // Si se solicita registrar salida manual
  if (req.body?.direction === 'out') {
    const active = getActiveAttendanceSession(m.code, today);
    if (active) {
      const closed = closeAttendanceSession(active.id, now);
      broadcastScreenState({
        mode: 'goodbye',
        name: m.name,
        code: m.code,
        photo: m.photo,
        plan: m.plan_name,
        duration_min: closed.duration_min,
        reason: `Salida registrada (${closed.duration_min} min)`,
        level: 'ok',
        is_checkout: true
      }, 5500);
      return res.json({ action: 'checkout', duration_min: closed.duration_min, access: 'ok', reason: `Salida registrada (${closed.duration_min} min)` });
    }
  }

  const s = withState(m, numSettings(), today);
  const r = q.run('INSERT INTO attendance(uid,member_id,code,ts,day,hour,result,reason,kind,direction,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    'srv-' + L.randomKey(), id, m.code, now.toISOString(), L.limaDay(now), L.limaHour(now), s.access, s.access_reason, 'M', 'in', s.access === 'denied' ? 'rejected' : 'inside', req.user.id);
  
  if (s.access === 'denied') {
    broadcastScreenState({
      mode: 'denied',
      name: m.name,
      code: m.code,
      photo: m.photo,
      plan: s.plan_name || m.plan_name || 'Sin plan activo',
      end: s.end_date || m.end_date,
      reason: s.access_reason,
      level: 'denied',
      is_daily: false
    }, 6500);
  } else {
    broadcastScreenState({
      mode: 'welcome',
      name: m.name,
      code: m.code,
      photo: m.photo,
      plan: s.plan_name || m.plan_name,
      daysLeft: s.days_left,
      end: s.end_date || m.end_date,
      level: s.access,
      reason: s.access_reason,
      is_checkout: false
    }, 5500);
  }
  res.json({ action: 'checkin', id: Number(r.lastInsertRowid), access: s.access, reason: s.access_reason });
}));

// Escaneo universal de acceso con detección automática de entrada / salida y sincronización de tablet
api.post('/attendance/scan', staff('admin', 'recepcion'), wrap((req, res) => {
  const { text, code: directCode, scanMode = 'auto' } = req.body || {};
  const parsed = parseScanInput(text || directCode);
  if (!parsed) return bad(res, 'Código no reconocido', 400);

  const today = L.limaDay();
  const now = new Date();
  const cfg = numSettings();

  // 1. CÓDIGO DE BARRAS DE TIENDA
  if (parsed.type === 'code') {
    const prod = q.get('SELECT * FROM products WHERE barcode=? AND active=1', parsed.code);
    if (prod) {
      return res.json({ level: 'pos', product: prod });
    }
  }

  // 2. PASE DIARIO
  if (parsed.type === 'daily' || parsed.type === 'daily_code' || String(parsed.code).startsWith('RD-DAY-')) {
    const passCode = parsed.code.toUpperCase();
    let dp = q.get('SELECT * FROM daily_passes WHERE code=?', passCode);
    if (!dp) {
      dp = q.get('SELECT * FROM daily_passes WHERE dni=? AND day=? ORDER BY id DESC LIMIT 1', parsed.code, today);
    }
    if (!dp || dp.day !== today) {
      broadcastScreenState({
        mode: 'denied',
        name: dp ? dp.name : 'Visitante Casual',
        code: passCode,
        reason: dp ? `Pase diario vencido (era del ${dp.day}). Debe abonar un nuevo pase de S/ 5.` : 'Pase diario no registrado hoy. Debe abonar S/ 5.',
        level: 'denied',
        is_daily: true
      }, 6500);
      return res.json({
        level: 'denied',
        is_daily: true,
        code: passCode,
        name: dp ? dp.name : 'Visitante (Pase anterior)',
        reason: dp ? `Pase diario vencido (era válido el ${dp.day}). Debe abonar un nuevo pase de S/ 5.` : 'Pase diario no válido para hoy.'
      });
    }

    // Verificar si ya está dentro hoy
    const active = getActiveAttendanceSession(dp.code, today);
    if (active) {
      const enterDate = new Date(active.ts);
      const minsInside = Math.max(0, Math.round((now - enterDate) / 60000));
      if (scanMode !== 'out' && minsInside < 2) {
        return res.json({
          level: 'ok',
          dup: true,
          is_daily: true,
          code: dp.code,
          name: dp.name,
          mins: minsInside,
          reason: `Pase diario ya registrado hace ${minsInside} min. ¡Buen entrenamiento!`
        });
      }
      // Marcar SALIDA automática
      const closed = closeAttendanceSession(active.id, now);
      broadcastScreenState({
        mode: 'goodbye',
        name: dp.name,
        code: dp.code,
        duration_min: closed.duration_min,
        reason: `Salida completada (${closed.duration_min} min en el gimnasio)`,
        level: 'ok',
        is_checkout: true,
        is_daily: true
      }, 5500);
      return res.json({
        level: 'ok',
        is_checkout: true,
        is_daily: true,
        code: dp.code,
        name: dp.name,
        duration_min: closed.duration_min,
        reason: `Salida completada (${closed.duration_min} min en el gimnasio)`
      });
    }

    if (scanMode === 'out') {
      return res.json({
        level: 'warn',
        code: dp.code,
        is_daily: true,
        name: dp.name,
        reason: 'No se encontró un ingreso activo para este pase hoy.'
      });
    }

    // Marcar ENTRADA de pase diario
    const r = q.run('INSERT INTO attendance(uid,code,ts,day,hour,result,reason,kind,direction,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      'srv-' + L.randomKey(), dp.code, now.toISOString(), L.limaDay(now), L.limaHour(now), 'ok', 'Pase diario vigente', 'D', 'in', 'inside', req.user.id);
    broadcastScreenState({
      mode: 'daily_welcome',
      name: dp.name,
      code: dp.code,
      reason: 'Pase diario válido por hoy (S/ 5 abonados)',
      level: 'ok',
      is_daily: true
    }, 5500);
    return res.json({
      level: 'ok',
      is_daily: true,
      code: dp.code,
      name: dp.name,
      reason: 'Pase diario vigente (Acceso hoy)',
      daily: dp
    });
  }

  // 3. SOCIO REGISTRADO (por código o DNI)
  const lookupCode = parsed.code.toUpperCase();
  let m = q.get(MEMBER_SELECT + ' WHERE m.code=? OR m.dni=?', lookupCode, lookupCode);
  if (!m) {
    const pProd = q.get('SELECT * FROM products WHERE barcode=? AND active=1', parsed.code);
    if (pProd) return res.json({ level: 'pos', product: pProd });

    broadcastScreenState({
      mode: 'denied',
      name: 'Código No Reconocido',
      code: parsed.code,
      reason: `Código ${parsed.code} no registrado en socios ni pases.`,
      level: 'invalid'
    }, 5000);
    return res.json({ level: 'invalid', code: parsed.code, reason: `Código "${parsed.code}" no encontrado. Verifica si el socio está registrado o sincroniza datos.` });
  }

  // Verificar firma si fue firmado
  if (parsed.sig) {
    const expected = L.sign(m.qr_key, m.code, parsed.kind, parsed.n);
    if (expected !== parsed.sig) {
      broadcastScreenState({
        mode: 'denied',
        name: m.name,
        code: m.code,
        photo: m.photo,
        reason: 'Código QR no auténtico o alterado.',
        level: 'denied'
      }, 5000);
      return res.json({ level: 'invalid', code: m.code, reason: 'Código QR falsificado o alterado.' });
    }
    if (parsed.kind === 'P' && parsed.n < m.phys_ver) {
      broadcastScreenState({
        mode: 'denied',
        name: m.name,
        code: m.code,
        photo: m.photo,
        reason: 'Tarjeta anulada o renovada por una versión más reciente.',
        level: 'denied'
      }, 6000);
      return res.json({ level: 'denied', member: memberPublic(m), code: m.code, kind: parsed.kind, reason: 'Tarjeta anulada o reemplazada por nueva emisión.' });
    }
    if (parsed.kind === 'D') {
      const cur = Math.floor(Date.now() / 60000);
      if (Math.abs(cur - parsed.n) > 2) {
        broadcastScreenState({
          mode: 'denied',
          name: m.name,
          code: m.code,
          photo: m.photo,
          reason: 'QR digital expirado. Por favor abre nuevamente tu app de socio.',
          level: 'denied'
        }, 6000);
        return res.json({ level: 'denied', member: memberPublic(m), code: m.code, kind: parsed.kind, reason: 'QR digital caducado. El socio debe reabrir su app.' });
      }
    }
  }

  const s = withState(m, cfg, today);

  // Verificar si ya tiene sesión de asistencia activa hoy
  const active = getActiveAttendanceSession(m.code, today);

  // Si el socio está vencido/bloqueado:
  if (s.access === 'denied') {
    // Si ya estaba dentro y pasa para salir, permitimos marcar salida
    if (active && (scanMode === 'out' || (Date.now() - new Date(active.ts).getTime()) >= 2 * 60000)) {
      const closed = closeAttendanceSession(active.id, now);
      broadcastScreenState({
        mode: 'goodbye',
        name: m.name,
        code: m.code,
        photo: m.photo,
        plan: s.plan_name || m.plan_name,
        duration_min: closed.duration_min,
        reason: `Salida completada (${closed.duration_min} min entrenando)`,
        level: 'ok',
        is_checkout: true
      }, 5500);
      return res.json({
        level: 'ok',
        is_checkout: true,
        member: memberPublic(m),
        code: m.code,
        name: m.name,
        duration_min: closed.duration_min,
        reason: `Salida completada (${closed.duration_min} min entrenando)`
      });
    }

    // Intento de entrada denegado
    q.run('INSERT INTO attendance(uid,member_id,code,ts,day,hour,result,reason,kind,direction,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
      'srv-' + L.randomKey(), m.id, m.code, now.toISOString(), L.limaDay(now), L.limaHour(now), 'denied', s.access_reason, parsed.kind || 'M', 'in', 'rejected', req.user.id);
    broadcastScreenState({
      mode: 'denied',
      name: m.name,
      code: m.code,
      photo: m.photo,
      plan: s.plan_name || m.plan_name || 'Sin plan activo',
      end: s.end_date || m.end_date,
      reason: s.access_reason || 'Tu membresía ha vencido. Acércate a recepción para renovar tu plan.',
      level: 'denied',
      is_daily: false
    }, 6500);
    return res.json({
      level: 'denied',
      reason: s.access_reason,
      daysLeft: s.days_left,
      end: s.end_date,
      member: memberPublic(m),
      code: m.code,
      kind: parsed.kind || 'M'
    });
  }

  // El socio tiene membresía vigente ('ok' o 'warn')
  if (active) {
    const enterDate = new Date(active.ts);
    const minsInside = Math.max(0, Math.round((now - enterDate) / 60000));

    // Si escaneó hace menos de 2 min y no forzó salida, es anti-pase duplicado
    if (scanMode !== 'out' && minsInside < 2) {
      return res.json({
        level: s.access,
        dup: true,
        mins: minsInside,
        member: memberPublic(m),
        code: m.code,
        name: m.name,
        reason: `Ingreso ya registrado hace ${minsInside} min (no se duplica)`
      });
    }

    // AUTOMÁTICO: Si ya estaba dentro hace 2 o más minutos, MARCAR SALIDA
    const closed = closeAttendanceSession(active.id, now);
    broadcastScreenState({
      mode: 'goodbye',
      name: m.name,
      code: m.code,
      photo: m.photo,
      plan: s.plan_name || m.plan_name,
      duration_min: closed.duration_min,
      reason: `Salida completada (${closed.duration_min} min entrenando)`,
      level: 'ok',
      is_checkout: true
    }, 5500);
    return res.json({
      level: 'ok',
      is_checkout: true,
      member: memberPublic(m),
      code: m.code,
      name: m.name,
      duration_min: closed.duration_min,
      reason: `Salida completada (${closed.duration_min} min entrenando)`
    });
  }

  if (scanMode === 'out') {
    return res.json({
      level: 'warn',
      code: m.code,
      name: m.name,
      member: memberPublic(m),
      reason: 'No se encontró un ingreso activo para registrar salida hoy.'
    });
  }

  // AUTOMÁTICO: Si no estaba dentro, MARCAR ENTRADA
  const r = q.run('INSERT INTO attendance(uid,member_id,code,ts,day,hour,result,reason,kind,direction,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    'srv-' + L.randomKey(), m.id, m.code, now.toISOString(), L.limaDay(now), L.limaHour(now), s.access, s.access_reason, parsed.kind || 'M', 'in', 'inside', req.user.id);
  broadcastScreenState({
    mode: 'welcome',
    name: m.name,
    code: m.code,
    photo: m.photo,
    plan: s.plan_name || m.plan_name,
    daysLeft: s.days_left,
    end: s.end_date || m.end_date,
    level: s.access,
    reason: s.access_reason,
    is_checkout: false
  }, 5500);
  return res.json({
    level: s.access,
    is_checkout: false,
    member: memberPublic(m),
    code: m.code,
    name: m.name,
    daysLeft: s.days_left,
    end: s.end_date,
    reason: s.access_reason,
    kind: parsed.kind || 'M'
  });
}));

// Lista de personas actualmente dentro del gimnasio
api.get('/attendance/inside', staff('admin', 'recepcion'), wrap((req, res) => {
  const today = L.limaDay();
  const fourHoursAgo = new Date(Date.now() - 4 * 3600000).toISOString();
  const rows = q.all(`
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
  res.json(rows);
}));

// Registrar salida de una sesión de asistencia
api.post('/attendance/:id/checkout', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const session = closeAttendanceSession(id);
  if (!session) return bad(res, 'Sesión no encontrada', 404);
  audit(req.user.id, 'attendance.checkout', { id, duration_min: session.duration_min });
  const mem = session.member_id ? q.get('SELECT name, photo, code FROM members WHERE id=?', session.member_id) : (session.code ? q.get('SELECT name, photo, code FROM members WHERE code=?', session.code) : null);
  broadcastScreenState({
    mode: 'goodbye',
    name: mem?.name || session.name || 'Socio',
    code: session.code,
    photo: mem?.photo || null,
    duration_min: session.duration_min,
    reason: `Salida registrada (${session.duration_min} min)`,
    level: 'ok',
    is_checkout: true
  }, 5500);
  res.json({ ok: true, session });
}));

// Registrar salida rápida por código de tarjeta o QR
api.post('/attendance/checkout-code', staff('admin', 'recepcion'), wrap((req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const today = L.limaDay();
  const active = getActiveAttendanceSession(code, today);
  if (!active) return bad(res, 'No se encontró un ingreso activo para este código hoy');
  const session = closeAttendanceSession(active.id);
  audit(req.user.id, 'attendance.checkout_code', { code, duration_min: session.duration_min });
  const mem = q.get('SELECT name, photo, code FROM members WHERE code=? OR dni=?', code, code);
  broadcastScreenState({
    mode: 'goodbye',
    name: mem?.name || session.name || 'Socio',
    code: session.code,
    photo: mem?.photo || null,
    duration_min: session.duration_min,
    reason: `Salida registrada (${session.duration_min} min)`,
    level: 'ok',
    is_checkout: true
  }, 5500);
  res.json({ ok: true, session, duration_min: session.duration_min });
}));

// Reporte e historial individual de asistencias de un socio
api.get('/reports/member/:id/attendance', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -30);
  const detail = getMemberAttendanceDetail({ memberId: id, from, to, q });
  if (!detail) return bad(res, 'Socio no encontrado', 404);
  const settings = getSettings();
  res.json({ ...detail, settings });
}));

// ---------------- Planes ----------------
api.get('/plans', anyAuth, wrap((req, res) => {
  res.json(q.all('SELECT * FROM plans ORDER BY active DESC, sort, id'));
}));
api.post('/plans', staff('admin'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.name || num(b.price) < 0) return bad(res, 'Datos del plan incompletos');
  if (!num(b.months) && !num(b.days)) return bad(res, 'Indica la duración en meses o días');
  const r = q.run('INSERT INTO plans(name,months,days,price,sort) VALUES(?,?,?,?,?)', b.name, num(b.months), num(b.days), num(b.price), num(b.sort, 9));
  audit(req.user.id, 'plan.create', b);
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.put('/plans/:id', staff('admin'), wrap((req, res) => {
  const b = req.body || {}; const p = q.get('SELECT * FROM plans WHERE id=?', num(req.params.id));
  if (!p) return bad(res, 'Plan no encontrado', 404);
  q.run('UPDATE plans SET name=?, months=?, days=?, price=?, active=?, sort=? WHERE id=?',
    b.name ?? p.name, b.months ?? p.months, b.days ?? p.days, b.price ?? p.price, b.active ?? p.active, b.sort ?? p.sort, p.id);
  audit(req.user.id, 'plan.update', { id: p.id, ...b });
  res.json({ ok: true });
}));

// ---------------- Pagos, caja, gastos ----------------
// ---------------- Pagos, caja, gastos ----------------
api.get('/payments', staff('admin', 'recepcion'), wrap((req, res) => {
  const day = req.query.day || L.limaDay();
  const from = req.query.from || day, to = req.query.to || day;
  const rows = q.all(`SELECT p.*, m.name AS member_name, m.code AS member_code,
    dp.name AS dp_name, dp.code AS dp_code, u.name AS user_name
    FROM payments p
    LEFT JOIN members m ON m.id=p.member_id
    LEFT JOIN daily_passes dp ON dp.id=p.daily_pass_id
    LEFT JOIN users u ON u.id=p.user_id
    WHERE p.day BETWEEN ? AND ? ORDER BY p.id DESC LIMIT 1000`, from, to);
  res.json(rows);
}));
api.post('/payments', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  if (!checkMethod(b.method)) return bad(res, 'Elige el método de pago');
  if (!b.concept || num(b.amount) <= 0) return bad(res, 'Concepto y monto son obligatorios');
  const receipt_no = nextReceiptNo();
  const curShift = getActiveShift(req.user.id);
  const shift_id = curShift ? curShift.id : null;
  const category = b.category || (b.member_id ? 'gym' : 'other');
  const r = q.run('INSERT INTO payments(member_id,concept,amount,method,note,day,user_id,op_code,voucher_img,receipt_no,shift_id,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    b.member_id || null, b.concept, num(b.amount), b.method, b.note, L.limaDay(), req.user.id, b.op_code || null, b.voucher_img || null, receipt_no, shift_id, category);
  const payId = Number(r.lastInsertRowid);
  try { saveVault(); } catch {}
  const receipt = buildReceipt(payId);
  res.json({ id: payId, receipt_no, receipt });
}));
api.post('/payments/:id/void', staff('admin'), wrap((req, res) => {
  const p = q.get('SELECT * FROM payments WHERE id=?', num(req.params.id));
  if (!p) return bad(res, 'Pago no encontrado', 404);
  if (p.voided) return bad(res, 'Ya está anulado');
  if (!req.body?.reason) return bad(res, 'Escribe el motivo de la anulación');
  q.tx(() => {
    q.run('UPDATE payments SET voided=1, void_reason=? WHERE id=?', req.body.reason, p.id);
    if (p.membership_id) q.run("UPDATE memberships SET status='cancelled' WHERE id=?", p.membership_id);
  });
  audit(req.user.id, 'payment.void', { id: p.id, amount: p.amount, reason: req.body.reason });
  try { saveVault(); } catch {}
  res.json({ ok: true });
}));
api.post('/payments/:id/verify', staff('admin'), wrap((req, res) => {
  const id = num(req.params.id);
  const p = q.get('SELECT * FROM payments WHERE id=?', id);
  if (!p) return bad(res, 'Pago no encontrado', 404);
  const nextVal = p.verified ? 0 : 1;
  q.run('UPDATE payments SET verified=? WHERE id=?', nextVal, id);
  audit(req.user.id, 'payment.verify', { id, verified: nextVal });
  res.json({ ok: true, verified: nextVal });
}));
api.post('/payments/:id/voucher', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const p = q.get('SELECT * FROM payments WHERE id=?', id);
  if (!p) return bad(res, 'Pago no encontrado', 404);
  const { voucher_img, op_code } = req.body || {};
  q.run('UPDATE payments SET voucher_img=COALESCE(?, voucher_img), op_code=COALESCE(?, op_code) WHERE id=?',
    voucher_img || null, op_code || null, id);
  res.json({ ok: true });
}));
api.get('/payments/:id/receipt', wrap((req, res) => {
  const receipt = buildReceipt(num(req.params.id));
  if (!receipt) return bad(res, 'Comprobante no encontrado', 404);
  res.json(receipt);
}));

// ---------------- Pases Diarios (Visitantes S/ 5) ----------------
api.get('/daily-passes', staff('admin', 'recepcion'), wrap((req, res) => {
  const day = req.query.day || L.limaDay();
  const rows = q.all(`SELECT dp.*, u.name AS user_name, p.id AS payment_id, p.voided
    FROM daily_passes dp
    LEFT JOIN payments p ON p.daily_pass_id=dp.id
    LEFT JOIN users u ON u.id=dp.user_id
    WHERE dp.day=? ORDER BY dp.id DESC`, day);
  res.json(rows);
}));
api.post('/daily-passes', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  const cfg = numSettings();
  const name = String(b.name || 'Visitante casual').trim().replace(/\s+/g, ' ');
  const dni = String(b.dni || '').trim() || null;
  const phone = String(b.phone || '').trim() || null;
  const price = num(b.price, cfg.daily_pass_price || 5);
  const method = checkMethod(b.method) || 'efectivo';
  const op_code = b.op_code ? String(b.op_code).trim() : null;
  const voucher_img = b.voucher_img || null;
  const today = L.limaDay();
  const now = new Date();
  const code = dailyPassCode(today);
  const receipt_no = nextReceiptNo();
  const curShift = getActiveShift(req.user.id);
  const shift_id = curShift ? curShift.id : null;

  const result = q.tx(() => {
    const dp = q.run(`INSERT INTO daily_passes(code,name,dni,phone,price,method,op_code,day,user_id,receipt_no,last_scan)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      code, name, dni, phone, price, method, op_code, today, req.user.id, receipt_no, now.toISOString());
    const passId = Number(dp.lastInsertRowid);
    const pay = q.run(`INSERT INTO payments(concept,amount,method,op_code,voucher_img,receipt_no,daily_pass_id,day,user_id,shift_id,category)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      `Pase Diario: ${name}`, price, method, op_code, voucher_img, receipt_no, passId, today, req.user.id, shift_id, 'gym');
    const payId = Number(pay.lastInsertRowid);
    q.run(`INSERT INTO attendance(uid,code,ts,day,hour,result,reason,kind,user_id)
      VALUES(?,?,?,?,?,?,?,?,?)`,
      'dp-' + L.randomKey(), code, now.toISOString(), today, L.limaHour(now), 'ok', 'Pase diario (1er ingreso)', 'D', req.user.id);
    return { passId, payId };
  });

  audit(req.user.id, 'dailypass.create', { code, name, price, method, op_code });
  try { saveVault(); } catch {}
  const receipt = buildReceipt(result.payId);
  res.json({
    ok: true,
    pass: { id: result.passId, code, name, dni, phone, price, method, day: today, receipt_no },
    receipt
  });
}));
api.post('/daily-passes/scan', staff('admin', 'recepcion'), wrap((req, res) => {
  let { code } = req.body || {};
  code = String(code || '').trim();
  const match = /^RD1\.DAY\.([A-Za-z0-9\-]+)\.(\d{4}-\d{2}-\d{2})\.([0-9a-f]{12})$/.exec(code);
  let passCode = match ? match[1] : code;
  const today = L.limaDay();
  const pass = q.get('SELECT * FROM daily_passes WHERE code=?', passCode);
  if (!pass) return bad(res, 'Pase diario no encontrado', 404);
  if (pass.day !== today) {
    return res.status(400).json({ ok: false, level: 'denied', reason: `Pase diario vencido (era válido el ${pass.day})`, pass });
  }
  const now = new Date();
  q.run('UPDATE daily_passes SET scans_count=scans_count+1, last_scan=? WHERE id=?', now.toISOString(), pass.id);
  q.run(`INSERT INTO attendance(uid,code,ts,day,hour,result,reason,kind,user_id)
    VALUES(?,?,?,?,?,?,?,?,?)`,
    'dp-' + L.randomKey(), pass.code, now.toISOString(), today, L.limaHour(now), 'ok', `Pase diario (reingreso #${pass.scans_count + 1})`, 'D', req.user.id);
  res.json({ ok: true, level: 'ok', reason: `Pase diario vigente (reingreso #${pass.scans_count + 1})`, pass });
}));

// ---------------- Gestión de Turnos de Caja (Apertura, Cierre y Arqueo) ----------------
api.get('/shifts/current', staff('admin', 'recepcion'), wrap((req, res) => {
  const shift = getActiveShift(req.user.id);
  if (!shift) return res.json({ active: false });
  const totals = computeShiftTotals(shift.id);
  res.json({ active: true, shift, totals });
}));

api.post('/shifts/open', staff('admin', 'recepcion'), wrap((req, res) => {
  const existing = getActiveShift(req.user.id);
  if (existing) return bad(res, `Ya tienes un turno abierto (#${existing.id} - ${existing.shift_name}). Ciérralo antes de abrir uno nuevo.`);
  const b = req.body || {};
  const initial_cash = Math.max(0, num(b.initial_cash, 0));
  const shift_name = String(b.shift_name || 'Turno General').trim();
  const notes = b.notes ? String(b.notes).trim() : null;
  const today = L.limaDay();
  const now = new Date().toISOString();

  const r = q.run(`INSERT INTO cash_shifts(user_id, user_name, shift_name, day, opened_at, initial_cash, notes, status)
    VALUES(?,?,?,?,?,?,?,?)`,
    req.user.id, req.user.name, shift_name, today, now, initial_cash, notes, 'open');
  const shiftId = Number(r.lastInsertRowid);
  const shift = q.get('SELECT * FROM cash_shifts WHERE id=?', shiftId);
  audit(req.user.id, 'shift.open', { id: shiftId, shift_name, initial_cash });
  res.json({ ok: true, shift, totals: computeShiftTotals(shiftId) });
}));

api.post('/shifts/close', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  const shiftId = num(b.shift_id) || getActiveShift(req.user.id)?.id;
  if (!shiftId) return bad(res, 'No se encontró un turno activo para cerrar');
  const shift = q.get('SELECT * FROM cash_shifts WHERE id=?', shiftId);
  if (!shift || shift.status !== 'open') return bad(res, 'Este turno no está abierto o no existe');

  const totals = computeShiftTotals(shiftId);
  const actual_cash = Math.max(0, num(b.actual_cash, 0));
  const expected_cash = totals.expectedCashInDrawer;
  const diff_cash = +(actual_cash - expected_cash).toFixed(2);
  const expected_digital = totals.expectedDigital;
  const now = new Date().toISOString();
  const notes = b.notes ? String(b.notes).trim() : shift.notes;

  q.run(`UPDATE cash_shifts SET closed_at=?, expected_cash=?, actual_cash=?, diff_cash=?, expected_digital=?, status='closed', notes=? WHERE id=?`,
    now, expected_cash, actual_cash, diff_cash, expected_digital, notes, shiftId);

  audit(req.user.id, 'shift.close', { id: shiftId, expected_cash, actual_cash, diff_cash, expected_digital });
  const updatedShift = q.get('SELECT * FROM cash_shifts WHERE id=?', shiftId);
  res.json({ ok: true, shift: updatedShift, totals, diff_cash });
}));

api.get('/shifts', staff('admin', 'recepcion'), wrap((req, res) => {
  const day = req.query.day;
  const from = req.query.from;
  const to = req.query.to;
  let sql = 'SELECT * FROM cash_shifts';
  const params = [];
  if (day) {
    sql += ' WHERE day=?';
    params.push(day);
  } else if (from && to) {
    sql += ' WHERE day BETWEEN ? AND ?';
    params.push(from, to);
  }
  sql += ' ORDER BY id DESC LIMIT 100';
  const shifts = q.all(sql, ...params);
  res.json(shifts);
}));

api.get('/shifts/:id', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const shift = q.get('SELECT s.*, u.username FROM cash_shifts s JOIN users u ON u.id=s.user_id WHERE s.id=?', id);
  if (!shift) return bad(res, 'Turno no encontrado', 404);
  const totals = computeShiftTotals(id);
  const pays = q.all(`SELECT p.*, m.name member_name, m.code member_code, dp.name dp_name FROM payments p
    LEFT JOIN members m ON m.id=p.member_id
    LEFT JOIN daily_passes dp ON dp.id=p.daily_pass_id
    WHERE p.shift_id=? AND p.voided=0 ORDER BY p.id`, id);
  const exps = q.all('SELECT * FROM expenses WHERE shift_id=? AND voided=0 ORDER BY id', id);
  const settings = getSettings();
  res.json({ shift, totals, payments: pays, expenses: exps, settings });
}));

// ---------------- Caja y Arqueo Diario ----------------
api.get('/cash', staff('admin', 'recepcion'), wrap((req, res) => {
  const day = req.query.day || L.limaDay();
  const pays = q.all(`SELECT p.*, m.name member_name, m.code member_code,
    dp.name dp_name, dp.code dp_code, u.name user_name, s.shift_name
    FROM payments p
    LEFT JOIN members m ON m.id=p.member_id
    LEFT JOIN daily_passes dp ON dp.id=p.daily_pass_id
    LEFT JOIN users u ON u.id=p.user_id
    LEFT JOIN cash_shifts s ON s.id=p.shift_id
    WHERE p.day=? AND p.voided=0 ORDER BY p.id`, day);
  const exps = q.all('SELECT e.*, u.name user_name, s.shift_name FROM expenses e LEFT JOIN users u ON u.id=e.user_id LEFT JOIN cash_shifts s ON s.id=e.shift_id WHERE e.day=? AND e.voided=0 ORDER BY e.id', day);
  const dailyPasses = q.all('SELECT * FROM daily_passes WHERE day=? ORDER BY id DESC', day);
  const byMethod = {};
  METHODS.forEach(m => byMethod[m] = 0);
  pays.forEach(p => byMethod[p.method] = (byMethod[p.method] || 0) + p.amount);
  const income = pays.reduce((a, p) => a + p.amount, 0);
  const expense = exps.reduce((a, e) => a + e.amount, 0);
  const expensesInCash = exps.filter(e => e.method === 'efectivo').reduce((a, e) => a + e.amount, 0);
  const yapeList = pays.filter(p => p.method === 'yape' || p.method === 'plin');
  const yapeVerifiedCount = yapeList.filter(p => p.verified).length;

  // Separación estricta Gym vs Tienda del día
  const gymPays = pays.filter(p => p.category === 'gym' || p.membership_id || p.daily_pass_id);
  const storePays = pays.filter(p => p.category === 'store' || (p.concept && p.concept.startsWith('Venta:')));
  const gymIncome = gymPays.reduce((a, p) => a + p.amount, 0);
  const storeIncome = storePays.reduce((a, p) => a + p.amount, 0);
  const gymExpenses = exps.filter(e => e.category !== 'store').reduce((a, e) => a + e.amount, 0);
  const storeExpenses = exps.filter(e => e.category === 'store').reduce((a, e) => a + e.amount, 0);

  // Turno actual activo
  const activeShift = getActiveShift(req.user.id);
  const activeShiftTotals = activeShift ? computeShiftTotals(activeShift.id) : null;

  res.json({
    day, payments: pays, expenses: exps, dailyPasses, byMethod, income, expense, net: income - expense,
    gym_income: gymIncome,
    store_income: storeIncome,
    other_income: income - (gymIncome + storeIncome),
    gym_expense: gymExpenses,
    store_expense: storeExpenses,
    cash_in_drawer: byMethod.efectivo - expensesInCash,
    digital_total: (byMethod.yape || 0) + (byMethod.plin || 0) + (byMethod.tarjeta || 0) + (byMethod.transferencia || 0),
    active_shift: activeShift,
    active_shift_totals: activeShiftTotals,
    yape_summary: {
      total: (byMethod.yape || 0) + (byMethod.plin || 0),
      count: yapeList.length,
      verified_count: yapeVerifiedCount,
      pending_count: yapeList.length - yapeVerifiedCount
    }
  });
}));
api.post('/expenses', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.concept || num(b.amount) <= 0) return bad(res, 'Concepto y monto son obligatorios');
  const curShift = getActiveShift(req.user.id);
  const shift_id = curShift ? curShift.id : null;
  const category = b.category === 'store' ? 'store' : 'gym';
  const r = q.run('INSERT INTO expenses(concept,amount,method,day,user_id,shift_id,category) VALUES(?,?,?,?,?,?,?)',
    b.concept, num(b.amount), b.method || 'efectivo', L.limaDay(), req.user.id, shift_id, category);
  try { saveVault(); } catch {}
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.post('/expenses/:id/void', staff('admin'), wrap((req, res) => {
  q.run('UPDATE expenses SET voided=1 WHERE id=?', num(req.params.id));
  audit(req.user.id, 'expense.void', { id: req.params.id });
  try { saveVault(); } catch {}
  res.json({ ok: true });
}));

// ---------------- Productos y Tienda (POS con código de barras) ----------------
api.get('/products', staff('admin', 'recepcion'), wrap((req, res) => res.json(q.all('SELECT * FROM products ORDER BY active DESC, name'))));
api.get('/products/by-barcode/:code', staff('admin', 'recepcion'), wrap((req, res) => {
  const code = String(req.params.code).trim();
  const p = q.get('SELECT * FROM products WHERE barcode=? AND active=1', code);
  if (!p) return bad(res, 'Producto no encontrado con este código de barras', 404);
  res.json(p);
}));
api.post('/products', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {}; if (!b.name || num(b.price) < 0) return bad(res, 'Datos incompletos');
  const r = q.run(`INSERT INTO products(name,price,stock,barcode,category,min_stock,cost,promo_price,promo_desc,description)
    VALUES(?,?,?,?,?,?,?,?,?,?)`,
    b.name.trim(), num(b.price), num(b.stock), b.barcode ? String(b.barcode).trim() : null,
    b.category || 'general', num(b.min_stock, 5), num(b.cost, 0), num(b.promo_price, 0),
    b.promo_desc || null, b.description || null);
  audit(req.user.id, 'product.create', { id: r.lastInsertRowid, name: b.name });
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.put('/products/:id', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {}; const p = q.get('SELECT * FROM products WHERE id=?', num(req.params.id));
  if (!p) return bad(res, 'Producto no encontrado', 404);
  q.run(`UPDATE products SET name=?, price=?, stock=?, barcode=?, category=?, min_stock=?, cost=?, promo_price=?, promo_desc=?, description=?, active=? WHERE id=?`,
    b.name ?? p.name, b.price ?? p.price, b.stock ?? p.stock, b.barcode !== undefined ? (b.barcode || null) : p.barcode,
    b.category ?? p.category, b.min_stock ?? p.min_stock, b.cost ?? p.cost, b.promo_price ?? p.promo_price,
    b.promo_desc ?? p.promo_desc, b.description ?? p.description, b.active ?? p.active, p.id);
  audit(req.user.id, 'product.update', { id: p.id, name: b.name ?? p.name });
  res.json({ ok: true });
}));
api.delete('/products/:id', staff('admin'), wrap((req, res) => {
  const id = num(req.params.id);
  q.run('UPDATE products SET active=0 WHERE id=?', id);
  audit(req.user.id, 'product.deactivate', { id });
  res.json({ ok: true });
}));
api.post('/products/:id/stock', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const p = q.get('SELECT * FROM products WHERE id=?', id);
  if (!p) return bad(res, 'Producto no encontrado', 404);
  const qty = num(req.body?.qty);
  if (!qty) return bad(res, 'Indica la cantidad a sumar');
  q.run('UPDATE products SET stock=stock+? WHERE id=?', qty, id);
  audit(req.user.id, 'product.stock', { id, name: p.name, added: qty, note: req.body?.note });
  res.json({ ok: true, stock: p.stock + qty });
}));
api.post('/sales', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  let p = null;
  if (b.product_id) p = q.get('SELECT * FROM products WHERE id=? AND active=1', num(b.product_id));
  else if (b.barcode) p = q.get('SELECT * FROM products WHERE barcode=? AND active=1', String(b.barcode).trim());
  if (!p) return bad(res, 'Producto no encontrado', 404);
  const qty = Math.max(1, Math.floor(num(b.qty, 1)));
  if (!checkMethod(b.method)) return bad(res, 'Elige el método de pago');
  if (p.stock < qty) return bad(res, `Stock insuficiente (quedan ${p.stock})`);
  const unitPrice = num(b.price) > 0 ? num(b.price) : (p.promo_price > 0 ? p.promo_price : p.price);
  const total = +(unitPrice * qty).toFixed(2);
  const receipt_no = nextReceiptNo();
  let payId;
  const curShift = getActiveShift(req.user.id);
  const shift_id = curShift ? curShift.id : null;
  const concept = b.concept || `Venta: ${p.name} x${qty}${unitPrice !== p.price ? ' (Promo)' : ''}`;
  q.tx(() => {
    q.run('UPDATE products SET stock=stock-? WHERE id=?', qty, p.id);
    const pay = q.run('INSERT INTO payments(member_id,concept,amount,method,op_code,voucher_img,receipt_no,day,user_id,shift_id,category,product_id,qty,unit_price,unit_cost) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      b.member_id || null, concept, total, b.method, b.op_code || null, b.voucher_img || null, receipt_no, L.limaDay(), req.user.id, shift_id, 'store',
      p.id, qty, unitPrice, p.cost || 0);
    payId = Number(pay.lastInsertRowid);
  });
  try { saveVault(); } catch {}
  const receipt = buildReceipt(payId);
  res.json({ ok: true, total, receipt_no, payment_id: payId, receipt });
}));

// ---------------- Dashboard y reportes ----------------
api.get('/dashboard', staff(), wrap((req, res) => {
  const cfg = numSettings(); const today = L.limaDay();
  const monthStart = today.slice(0, 8) + '01';
  const members = q.all(MEMBER_SELECT).map(m => withState(m, cfg, today));
  const active = members.filter(m => m.access === 'ok' || m.access === 'warn');
  const expiringSoon = members.filter(m => m.status === 'active' && !m.frozen && m.end_date && m.days_left >= 0 && m.days_left <= 7)
    .sort((a, b) => a.days_left - b.days_left).map(m => ({ id: m.id, code: m.code, name: m.name, phone: m.phone, end_date: m.end_date, days_left: m.days_left, plan_name: m.plan_name }));
  const recentlyExpired = members.filter(m => m.status === 'active' && !m.frozen && m.end_date && m.days_left < 0 && m.days_left >= -30)
    .sort((a, b) => b.days_left - a.days_left).map(m => ({ id: m.id, code: m.code, name: m.name, phone: m.phone, end_date: m.end_date, days_left: m.days_left, plan_name: m.plan_name }));
  const cutoff = new Date(Date.now() - cfg.stay_min * 60000).toISOString();
  const inGym = q.all(`SELECT m.id,m.code,m.name,m.photo,MAX(a.ts) ts FROM attendance a JOIN members m ON m.id=a.member_id
    WHERE a.result IN ('ok','warn') AND a.ts>=? GROUP BY m.id ORDER BY ts DESC`, cutoff);
  const tenAgo = L.addDays(today, -10);
  const atRisk = active.filter(m => {
    if (L.diffDays(today, m.created_at.slice(0, 10)) < 8) return false;
    return !m.last_in || L.limaDay(new Date(m.last_in)) <= tenAgo;
  }).map(m => ({ id: m.id, code: m.code, name: m.name, phone: m.phone, last_in: m.last_in, end_date: m.end_date }));
  const bday = members.filter(m => m.birth && m.birth.slice(5) === today.slice(5) && m.status === 'active').map(m => ({ id: m.id, name: m.name, phone: m.phone }));
  const sum = (sql, ...a) => q.get(sql, ...a).s || 0;
  const days7 = Array.from({ length: 7 }, (_, i) => L.addDays(today, i - 6));
  const inc7 = Object.fromEntries(q.all('SELECT day, SUM(amount) s FROM payments WHERE voided=0 AND day>=? GROUP BY day', days7[0]).map(r => [r.day, r.s]));
  const att7 = Object.fromEntries(q.all("SELECT day, COUNT(DISTINCT CASE WHEN kind='D' THEN code ELSE member_id END) n FROM attendance WHERE result IN ('ok','warn') AND day>=? GROUP BY day", days7[0]).map(r => [r.day, r.n]));
  const hours = q.all("SELECT hour, COUNT(*) n FROM attendance WHERE result IN ('ok','warn') AND day=? GROUP BY hour", today);
  const lastScans = q.all(`SELECT a.ts, a.result, a.reason, a.kind,
    COALESCE(m.name, dp.name, 'Visitante') AS name,
    COALESCE(m.code, a.code) AS code
    FROM attendance a
    LEFT JOIN members m ON m.id=a.member_id
    LEFT JOIN daily_passes dp ON dp.code=a.code
    ORDER BY a.ts DESC LIMIT 12`);

  const visitsMembersToday = q.get("SELECT COUNT(DISTINCT member_id) n FROM attendance WHERE result IN ('ok','warn') AND kind!='D' AND day=?", today).n || 0;
  const visitsDailyToday = q.get("SELECT COUNT(DISTINCT code) n FROM attendance WHERE result IN ('ok','warn') AND kind='D' AND day=?", today).n || 0;

  res.json({
    today,
    income_today: sum('SELECT SUM(amount) s FROM payments WHERE voided=0 AND day=?', today),
    income_month: sum('SELECT SUM(amount) s FROM payments WHERE voided=0 AND day>=?', monthStart),
    income_memberships_today: sum('SELECT SUM(amount) s FROM payments WHERE voided=0 AND membership_id IS NOT NULL AND day=?', today),
    income_daily_today: sum('SELECT SUM(amount) s FROM payments WHERE voided=0 AND daily_pass_id IS NOT NULL AND day=?', today),
    income_store_today: sum("SELECT SUM(amount) s FROM payments WHERE voided=0 AND concept LIKE 'Venta:%' AND day=?", today),
    expense_today: sum('SELECT SUM(amount) s FROM expenses WHERE voided=0 AND day=?', today),
    visits_today: visitsMembersToday + visitsDailyToday,
    visits_members_today: visitsMembersToday,
    visits_daily_today: visitsDailyToday,
    denied_today: q.get("SELECT COUNT(*) n FROM attendance WHERE result IN ('denied','invalid') AND day=?", today).n,
    members_total: members.length,
    members_active: active.length,
    members_expired: members.filter(m => m.status === 'active' && m.end_date && m.days_left < 0).length,
    new_this_month: members.filter(m => m.created_at.slice(0, 10) >= monthStart).length,
    in_gym: inGym, expiring_soon: expiringSoon, recently_expired: recentlyExpired, at_risk: atRisk, birthdays: bday,
    chart7: days7.map(d => ({ day: d, income: inc7[d] || 0, visits: att7[d] || 0 })),
    hours, last_scans: lastScans
  });
}));

api.get('/reports', staff('admin', 'recepcion'), wrap((req, res) => {
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -29);
  const shift_id = req.query.shift_id ? num(req.query.shift_id) : null;
  const scope = req.query.scope || 'consolidated';

  const data = getScopedReportData({ from, to, shift_id, q });

  // Estructura retrocompatible para las vistas existentes
  const income = q.all('SELECT day, SUM(amount) total FROM payments WHERE voided=0 AND day BETWEEN ? AND ? GROUP BY day ORDER BY day', from, to);
  const byConcept = q.all(`SELECT concept, SUM(amount) total, COUNT(*) n FROM payments WHERE voided=0 AND day BETWEEN ? AND ? GROUP BY concept ORDER BY total DESC`, from, to);
  const attDay = q.all("SELECT day, COUNT(DISTINCT CASE WHEN kind='D' THEN code ELSE member_id END) n FROM attendance WHERE result IN ('ok','warn') AND day BETWEEN ? AND ? GROUP BY day ORDER BY day", from, to);
  const dow = q.all("SELECT strftime('%w', day) d, COUNT(*) n FROM attendance WHERE result IN ('ok','warn') AND day BETWEEN ? AND ? GROUP BY d", from, to);

  const catIncome = {
    memberships: data.byPlan.reduce((a, b) => a + (b.total || 0), 0),
    daily_passes: data.dailyPasses.reduce((a, b) => a + b.price, 0),
    store: data.totalStoreIncome,
    others: data.totalOtherIncome
  };

  res.json({
    from, to, scope, shift_id,
    income,
    totalIncome: data.totalIncome,
    expenses: data.totalExpense,
    net: data.netProfit,
    byMethod: Object.entries(data.totalByMethod).filter(([k]) => k !== 'total').map(([m, val]) => ({
      method: m,
      total: val,
      n: data.gymPayments.concat(data.storePayments, data.otherPayments).filter(p => p.method === m).length
    })),
    byConcept,
    byPlan: data.byPlan,
    catIncome,
    attDay,
    peak: data.peak,
    dow,
    newMembers: data.newMembers,
    renewals: data.renewals,
    expiredPeriod: data.expiredPeriod,
    expiringSoon: data.expiringSoon,
    atRiskMembers: data.atRiskMembers,
    // Canales separados
    gym: {
      income: data.totalGymIncome,
      expenses: data.totalGymExpense,
      net: data.gymNet,
      byMethod: data.gymByMethod,
      payments: data.gymPayments,
      dailyPasses: data.dailyPasses,
      byPlan: data.byPlan,
      expiringSoon: data.expiringSoon,
      atRiskMembers: data.atRiskMembers
    },
    store: {
      income: data.totalStoreIncome,
      expenses: data.totalStoreExpense,
      costOfGoods: data.totalStoreCost,
      grossProfit: data.totalStoreGrossProfit,
      net: data.storeNet,
      byMethod: data.storeByMethod,
      payments: data.storePayments,
      productStats: data.productStats,
      topSelling: [...data.productStats].filter(p => (p.sold_qty || 0) > 0).sort((a, b) => (b.sold_total || 0) - (a.sold_total || 0)),
      lowStock: data.productStats.filter(p => p.stock <= p.min_stock)
    },
    consolidated: {
      totalIncome: data.totalIncome,
      totalGymIncome: data.totalGymIncome,
      totalStoreIncome: data.totalStoreIncome,
      totalOtherIncome: data.totalOtherIncome,
      totalExpense: data.totalExpense,
      totalGymExpense: data.totalGymExpense,
      totalStoreExpense: data.totalStoreExpense,
      totalStoreCost: data.totalStoreCost,
      totalStoreGrossProfit: data.totalStoreGrossProfit,
      storeCostOfGoods: data.totalStoreCost,
      storeGrossProfit: data.totalStoreGrossProfit,
      netProfit: data.netProfit,
      marginPct: data.marginPct,
      avgDailyIncome: data.avgDailyIncome,
      txCount: data.gymPayments.length + data.storePayments.length + data.otherPayments.length,
      cashGross: data.totalByMethod.efectivo || 0,
      cashInDrawer: data.cashInDrawer,
      digitalTotal: data.digitalTotal,
      activeDaysCount: data.dailyComparison.filter(x => x.total > 0 || x.visits > 0).length,
      yapeAudit: data.yapeAudit,
      totalByMethod: data.totalByMethod,
      gymByMethod: data.gymByMethod,
      storeByMethod: data.storeByMethod,
      expensesList: data.expenses,
      expensesByCat: Object.entries(
        data.expenses.reduce((acc, e) => {
          const cat = e.category || 'Operativo';
          acc[cat] = (acc[cat] || 0) + Number(e.amount || 0);
          return acc;
        }, {})
      ).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total),
      dailyComparison: data.dailyComparison,
      shifts: data.shifts
    },
    attendance: data.attendance
  });
}));

// Dataset consolidado para frontend, gráficos y dashboards
api.get('/reports/dataset', staff('admin', 'recepcion'), wrap((req, res) => {
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -29);
  const settings = getSettings();
  const ds = buildDataset({ from, to, q, settings });
  res.json(ds);
}));

// Descarga en formato Microsoft Excel (.xlsx) real con Dashboard, Fórmulas Nativas, Tablas, Logo y Marca de agua
api.get('/reports/export/excel', staff('admin', 'recepcion'), wrap(async (req, res) => {
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -29);
  const settings = getSettings();
  const ds = buildDataset({ from, to, q, settings });
  const buf = await buildXlsx(ds, { publicDir: path.join(__dirname, '..', 'public') });
  const filename = `Reporte_RD_Fitness_${from}_al_${to}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}));

// Exportación individual de cualquier tabla del dataset en CSV (UTF-8 con BOM para Excel)
api.get('/reports/export/csv', staff('admin', 'recepcion'), wrap((req, res) => {
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -29);
  const tableKey = req.query.table || 'daily';
  const ds = buildDataset({ from, to, q, settings: getSettings() });
  const table = ds.tables[tableKey] || ds.tables.daily;
  const csv = tableToCsv(table, req.query.sep || ',');
  const filename = `Reporte_${table.name.replace(/\s+/g, '_')}_${from}_al_${to}.csv`;
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}));

// Feed completo en JSON para sincronización en tiempo real con Google Sheets (vía Apps Script)
api.get('/reports/sheets-feed', wrap((req, res) => {
  const settings = getSettings();
  const sess = loadSession(req);
  const isStaff = sess && sess.kind === 'staff';
  const clientKey = req.query.key || req.headers['x-rd-key'];
  if (!isStaff && (!clientKey || clientKey !== settings.google_sheets_key)) {
    return bad(res, 'Clave de Google Sheets inválida o ausente', 403);
  }
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -365);
  const ds = buildDataset({ from, to, q, settings });
  if (isStaff) {
    ds.sheets_key = settings.google_sheets_key;
    ds.google_sheet_url = settings.google_sheet_url || '';
  }
  res.json(ds);
}));

// Feed en formato CSV para Google Sheets (con clave obligatoria)
api.get('/reports/live-feed.csv', wrap((req, res) => {
  const settings = getSettings();
  const clientKey = req.query.key || req.headers['x-rd-key'];
  if (!clientKey || clientKey !== settings.google_sheets_key) {
    return bad(res, 'Clave de Google Sheets requerida y válida', 403);
  }

  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -30);
  const tableKey = req.query.table || req.query.type || 'daily';
  const ds = buildDataset({ from, to, q, settings });
  const table = ds.tables[tableKey] || ds.tables.daily;
  const csv = tableToCsv(table, req.query.sep || ',');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="rd_fitness_${tableKey}_${today}.csv"`);
  res.send(csv);
}));

// Búsqueda unificada de personas (socios y pases diarios) para reportes individuales y seguridad
api.get('/reports/people', staff('admin', 'recepcion'), wrap((req, res) => {
  const list = searchPeople({ term: req.query.q || '', q });
  res.json(list);
}));

// Ficha individual de asistencias / verificación de presencia para seguridad o coartadas
api.get('/reports/person', staff('admin', 'recepcion'), wrap((req, res) => {
  const { kind, id, from, to, day } = req.query;
  if (!id) return bad(res, 'ID requerido');
  const today = L.limaDay();
  const rep = getPersonReport({
    kind: kind || 'M',
    id: num(id),
    from: from || L.addDays(today, -30),
    to: to || today,
    day: day || null,
    q,
    settings: getSettings()
  });
  if (!rep) return bad(res, 'Persona no encontrada', 404);
  res.json(rep);
}));

// ---------------- Ejercicios ----------------
const exRow = e => ({ ...e, pasos: J(e.pasos), errores: J(e.errores), imagenes: J(e.imagenes) });
api.get('/exercises', anyAuth, wrap((req, res) => res.json(q.all('SELECT * FROM exercises ORDER BY grupo, nombre').map(exRow))));
api.post('/exercises', staff('admin', 'entrenador'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.nombre || !Array.isArray(b.pasos) || !b.pasos.length) return bad(res, 'Nombre y pasos son obligatorios');
  const id = 'custom-' + L.randomKey().slice(0, 8);
  q.run(`INSERT INTO exercises(id,nombre,grupo,tipo,equipo,nivel,musculos,efecto,pasos,errores,consejo,variante,imagenes,custom,video)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`, id, b.nombre, b.grupo || 'Otros', b.tipo || 'fuerza', b.equipo, b.nivel || 'principiante', b.musculos, b.efecto,
    JSON.stringify(b.pasos), JSON.stringify(b.errores || []), b.consejo, b.variante, '[]', b.video || null);
  res.json({ id });
}));

// ---------------- Rutinas ----------------
function loadRoutine(id) {
  const r = q.get('SELECT * FROM routines WHERE id=?', id);
  if (!r) return null;
  const items = q.all(`SELECT i.*, e.nombre, e.imagenes, e.grupo, e.tipo, e.equipo FROM routine_items i JOIN exercises e ON e.id=i.ex_id
    WHERE routine_id=? ORDER BY day_index, pos`, id);
  const days = [];
  for (const it of items) {
    let d = days.find(x => x.index === it.day_index);
    if (!d) { d = { index: it.day_index, title: it.day_title, items: [] }; days.push(d); }
    d.items.push({ ex_id: it.ex_id, nombre: it.nombre, imagenes: J(it.imagenes), grupo: it.grupo, tipo: it.tipo, equipo: it.equipo, sets: it.sets, reps: it.reps, seconds: it.seconds, rest: it.rest, note: it.note });
  }
  return { ...r, days };
}
function saveRoutineItems(rid, days) {
  q.run('DELETE FROM routine_items WHERE routine_id=?', rid);
  (days || []).forEach((d, di) => (d.items || []).forEach((it, pos) => {
    if (!q.get('SELECT 1 x FROM exercises WHERE id=?', it.ex_id)) return;
    q.run('INSERT INTO routine_items(routine_id,day_index,day_title,pos,ex_id,sets,reps,seconds,rest,note) VALUES(?,?,?,?,?,?,?,?,?,?)',
      rid, di, d.title || `Día ${di + 1}`, pos, it.ex_id, Math.max(1, num(it.sets, 3)), String(it.reps || '10'), it.seconds ? num(it.seconds) : null, num(it.rest, 60), it.note);
  }));
}
api.get('/routines', staff(), wrap((req, res) => {
  res.json(q.all(`SELECT r.*, (SELECT COUNT(DISTINCT day_index) FROM routine_items WHERE routine_id=r.id) AS days,
    (SELECT COUNT(*) FROM routine_items WHERE routine_id=r.id) AS exercises,
    (SELECT COUNT(*) FROM assignments a WHERE a.routine_id=r.id AND a.active=1) AS assigned
    FROM routines r WHERE r.active=1 AND r.member_id IS NULL ORDER BY r.template DESC, r.name`));
}));
api.get('/routines/:id', anyAuth, wrap((req, res) => {
  const r = loadRoutine(num(req.params.id));
  if (!r || !r.active) return bad(res, 'Rutina no encontrada', 404);
  res.json(r);
}));
api.post('/routines', staff('admin', 'entrenador'), wrap((req, res) => {
  const b = req.body || {};
  if (!b.name) return bad(res, 'Ponle un nombre a la rutina');
  const id = q.tx(() => {
    const r = q.run('INSERT INTO routines(name,goal,level,days_per_week,description,template,created_by) VALUES(?,?,?,?,?,?,?)',
      b.name, b.goal, b.level || 'principiante', num(b.days_per_week, (b.days || []).length), b.description, b.template ? 1 : 0, req.user.id);
    saveRoutineItems(r.lastInsertRowid, b.days); return Number(r.lastInsertRowid);
  });
  res.json({ id });
}));
api.put('/routines/:id', staff('admin', 'entrenador'), wrap((req, res) => {
  const id = num(req.params.id); const b = req.body || {};
  const r = q.get('SELECT * FROM routines WHERE id=?', id);
  if (!r) return bad(res, 'Rutina no encontrada', 404);
  q.tx(() => {
    q.run('UPDATE routines SET name=?, goal=?, level=?, days_per_week=?, description=? WHERE id=?',
      b.name ?? r.name, b.goal ?? r.goal, b.level ?? r.level, b.days ? b.days.length : r.days_per_week, b.description ?? r.description, id);
    if (b.days) saveRoutineItems(id, b.days);
  });
  res.json({ ok: true });
}));
api.delete('/routines/:id', staff('admin', 'entrenador'), wrap((req, res) => {
  q.run('UPDATE routines SET active=0 WHERE id=?', num(req.params.id));
  q.run('UPDATE assignments SET active=0 WHERE routine_id=?', num(req.params.id));
  res.json({ ok: true });
}));
api.post('/routines/:id/assign', staff('admin', 'entrenador'), wrap((req, res) => {
  const rid = num(req.params.id); const ids = (req.body?.member_ids || []).map(Number).filter(Boolean);
  if (!q.get('SELECT 1 x FROM routines WHERE id=? AND active=1', rid)) return bad(res, 'Rutina no encontrada', 404);
  if (!ids.length) return bad(res, 'Elige al menos un socio');
  q.tx(() => ids.forEach(mid => {
    if (!q.get('SELECT 1 x FROM members WHERE id=?', mid)) return;
    if (req.body?.replace) q.run('UPDATE assignments SET active=0 WHERE member_id=?', mid);
    if (!q.get('SELECT 1 x FROM assignments WHERE member_id=? AND routine_id=? AND active=1', mid, rid))
      q.run('INSERT INTO assignments(member_id,routine_id,assigned_by,note) VALUES(?,?,?,?)', mid, rid, req.user.id, req.body?.note);
  }));
  res.json({ ok: true });
}));
api.delete('/assignments/:id', staff('admin', 'entrenador'), wrap((req, res) => {
  q.run('UPDATE assignments SET active=0 WHERE id=?', num(req.params.id)); res.json({ ok: true });
}));

// Mediciones (personal)
api.get('/members/:id/measurements', staff(), wrap((req, res) => res.json(q.all('SELECT * FROM measurements WHERE member_id=? ORDER BY day, id', num(req.params.id)))));
api.post('/members/:id/measurements', staff(), wrap((req, res) => {
  const b = req.body || {};
  q.run(`INSERT INTO measurements(member_id,day,weight,height,chest,waist,hip,arm,thigh,body_fat,note,by_staff) VALUES(?,?,?,?,?,?,?,?,?,?,?,1)`,
    num(req.params.id), b.day || L.limaDay(), b.weight, b.height, b.chest, b.waist, b.hip, b.arm, b.thigh, b.body_fat, b.note);
  res.json({ ok: true });
}));

// ---------------- Usuarios y ajustes ----------------
api.get('/users', staff('admin'), wrap((req, res) => res.json(q.all('SELECT id,username,name,role,active,created_at FROM users ORDER BY id'))));
api.post('/users', staff('admin'), wrap((req, res) => {
  const b = req.body || {};
  const username = String(b.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) return bad(res, 'Usuario: 3-20 caracteres (letras, números, . _ -)');
  if (String(b.password || '').length < 6) return bad(res, 'Contraseña de al menos 6 caracteres');
  if (!['admin', 'recepcion', 'entrenador'].includes(b.role)) return bad(res, 'Rol inválido');
  if (q.get('SELECT 1 x FROM users WHERE username=?', username)) return bad(res, 'Ese usuario ya existe', 409);
  const r = q.run('INSERT INTO users(username,name,role,pass_hash) VALUES(?,?,?,?)', username, b.name || username, b.role, bcrypt.hashSync(b.password, 10));
  audit(req.user.id, 'user.create', { username, role: b.role });
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.put('/users/:id', staff('admin'), wrap((req, res) => {
  const b = req.body || {}; const u = q.get('SELECT * FROM users WHERE id=?', num(req.params.id));
  if (!u) return bad(res, 'Usuario no encontrado', 404);
  if (u.id === req.user.id && (b.active === 0 || (b.role && b.role !== 'admin'))) return bad(res, 'No puedes quitarte tu propio acceso de administrador');
  q.run('UPDATE users SET name=?, role=?, active=? WHERE id=?', b.name ?? u.name, b.role ?? u.role, b.active ?? u.active, u.id);
  if (b.password) {
    if (String(b.password).length < 6) return bad(res, 'Contraseña de al menos 6 caracteres');
    q.run('UPDATE users SET pass_hash=?, must_change=0 WHERE id=?', bcrypt.hashSync(b.password, 10), u.id);
    q.run("DELETE FROM sessions WHERE kind='staff' AND ref_id=?", u.id);
  }
  audit(req.user.id, 'user.update', { id: u.id });
  res.json({ ok: true });
}));
api.get('/settings', staff(), wrap((req, res) => res.json(getSettings())));
api.put('/settings', staff('admin'), wrap((req, res) => {
  const allowed = ['gym_name', 'gym_slogan', 'gym_phone', 'gym_address', 'warn_days', 'grace_days', 'passback_min', 'stay_min', 'opening', 'color', 'google_sheet_url', 'yape_phone', 'yape_name'];
  q.tx(() => { for (const k of allowed) if (k in (req.body || {})) q.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', k, String(req.body[k])); });
  audit(req.user.id, 'settings.update', req.body);
  res.json({ ok: true });
}));
api.get('/audit', staff('admin'), wrap((req, res) => res.json(q.all('SELECT a.*, u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200'))));
api.get('/backup', staff('admin'), wrap((req, res) => {
  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const f = path.join(dir, `manual-${Date.now()}.db`);
  const safePath = f.split(path.sep).join('/');
  db.exec(`VACUUM INTO '${safePath}'`);
  const filename = `rdfitness-${L.limaDay()}.db`;
  res.setHeader('Content-Type', 'application/x-sqlite3');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const stream = fs.createReadStream(f);
  stream.pipe(res);
  stream.on('close', () => {
    try { fs.unlinkSync(f); } catch { }
  });
}));

// Exportar todos los datos estructurados en JSON portátil
api.get('/backup/export-json', staff('admin'), wrap((req, res) => {
  const data = {
    gym_name: getSettings().gym_name || 'RD Fitness Club',
    exported_at: new Date().toISOString(),
    version: '2.7',
    members: q.all('SELECT * FROM members'),
    memberships: q.all('SELECT * FROM memberships'),
    payments: q.all('SELECT * FROM payments'),
    attendance: q.all('SELECT * FROM attendance'),
    daily_passes: q.all('SELECT * FROM daily_passes'),
    products: q.all('SELECT * FROM products'),
    plans: q.all('SELECT * FROM plans'),
    settings: q.all('SELECT * FROM settings'),
    member_credentials: q.all('SELECT * FROM member_credentials'),
    member_prefs: q.all('SELECT * FROM member_prefs'),
    announcements: q.all('SELECT * FROM announcements'),
    workouts: q.all('SELECT * FROM workouts'),
    set_logs: q.all('SELECT * FROM set_logs'),
    measurements: q.all('SELECT * FROM measurements'),
    cash_shifts: q.all('SELECT * FROM cash_shifts')
  };
  const filename = `rdfitness-data-${L.limaDay()}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(data, null, 2));
}));

// Importar / Restaurar datos desde JSON portátil
api.post('/backup/import-json', staff('admin'), wrap((req, res) => {
  const d = (req.body && req.body.data) ? req.body.data : (req.body || {});
  if (!d.members || !Array.isArray(d.members)) {
    return bad(res, 'Formato de archivo inválido. Debe contener el campo "members".');
  }

  const insertOrReplaceRows = (table, rows) => {
    if (!Array.isArray(rows) || rows.length === 0) return 0;
    let colInfo;
    try {
      colInfo = q.all(`PRAGMA table_info(${table})`).map(c => c.name);
    } catch {
      return 0;
    }
    const colSet = new Set(colInfo);
    let count = 0;
    for (const r of rows) {
      if (!r || typeof r !== 'object') continue;
      const row = { ...r };
      if (table === 'members') {
        if (!row.qr_key) row.qr_key = L.randomKey();
        if (!row.code) row.code = memberCode(row.id || (q.get('SELECT COALESCE(MAX(id),0)+1 n FROM members').n));
        if (!row.status) row.status = 'active';
      }
      if (table === 'attendance') {
        if (!row.uid) row.uid = 'att-' + require('crypto').randomBytes(12).toString('hex');
      }
      const keys = Object.keys(row).filter(k => colSet.has(k));
      if (keys.length === 0) continue;
      const placeholders = keys.map(() => '?').join(', ');
      const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
      const vals = keys.map(k => row[k]);
      try {
        q.run(sql, ...vals);
        count++;

        // Si es socio y traía fechas de membresía, asegurar que tenga su membresía activa registrada
        if (table === 'members' && row.end_date) {
          const hasMs = q.get('SELECT 1 x FROM memberships WHERE member_id=?', row.id);
          if (!hasMs) {
            try {
              q.run('INSERT INTO memberships(member_id, plan_name, start_date, end_date, status) VALUES(?,?,?,?,?)',
                row.id, row.plan_name || 'Membresía', row.start_date || L.limaDay(), row.end_date, 'active');
            } catch {}
          }
          try {
            q.run("INSERT OR IGNORE INTO member_prefs(member_id, show_promos, show_reminders, push_critical, push_news, push_promos, alert_mode) VALUES(?, 1, 1, 1, 1, 1, 'sound')", row.id);
          } catch {}
        }
      } catch (e) {
        console.warn(`Aviso importando fila a ${table}:`, e.message);
      }
    }
    return count;
  };

  let restoredMembers = 0, restoredPayments = 0, restoredAttendance = 0;

  q.tx(() => {
    insertOrReplaceRows('settings', d.settings);
    insertOrReplaceRows('plans', d.plans);
    insertOrReplaceRows('products', d.products);
    restoredMembers = insertOrReplaceRows('members', d.members);
    insertOrReplaceRows('memberships', d.memberships);
    restoredPayments = insertOrReplaceRows('payments', d.payments);
    restoredAttendance = insertOrReplaceRows('attendance', d.attendance);
    insertOrReplaceRows('member_credentials', d.member_credentials);
    insertOrReplaceRows('member_prefs', d.member_prefs);
    insertOrReplaceRows('measurements', d.measurements);
    insertOrReplaceRows('workouts', d.workouts);
    insertOrReplaceRows('set_logs', d.set_logs);
    insertOrReplaceRows('cash_shifts', d.cash_shifts);
    insertOrReplaceRows('announcements', d.announcements);
  });

  checkpoint();
  audit(req.user.id, 'backup.import_json', { restoredMembers, restoredPayments, restoredAttendance });
  res.json({ ok: true, restoredMembers, restoredPayments, restoredAttendance });
}));

// Estado y sincronización manual de la Bóveda en la Nube (Cloud Vault)
api.get('/cloud-vault/status', staff('admin'), wrap((req, res) => {
  res.json(CloudVault.status());
}));

api.post('/cloud-vault/sync', staff('admin'), wrap(async (req, res) => {
  if (!CloudVault.isConfigured()) {
    return bad(res, 'No hay Bóveda en la Nube configurada (falta UPSTASH_REDIS_REST_URL o similar en variables de entorno)');
  }
  saveVault();
  const data = getVaultData();
  const r = await CloudVault.push(data);
  audit(req.user.id, 'cloud_vault.sync', r);
  res.json({ ok: true, ...r });
}));

api.post('/cloud-vault/pull', staff('admin'), wrap(async (req, res) => {
  if (!CloudVault.isConfigured()) {
    return bad(res, 'No hay Bóveda en la Nube configurada');
  }
  const restored = await restoreVaultFromCloud();
  audit(req.user.id, 'cloud_vault.pull', { restored });
  res.json({ ok: true, restored });
}));

// Restaurar copia de seguridad binaria (.db SQLite) mediante ATTACH DATABASE
api.post('/backup/restore', staff('admin'), wrap((req, res) => {
  let buf = null;
  if (Buffer.isBuffer(req.body)) {
    buf = req.body;
  } else if (req.body && (req.body.db_base64 || req.body.base64)) {
    buf = Buffer.from(req.body.db_base64 || req.body.base64, 'base64');
  } else {
    return bad(res, 'No se recibió archivo de base de datos');
  }

  if (buf.length < 100 || !buf.subarray(0, 15).toString().startsWith('SQLite format 3')) {
    return bad(res, 'El archivo subido no es una base de datos SQLite válida');
  }

  const dir = path.join(DATA_DIR, 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `restore-tmp-${Date.now()}.db`);
  fs.writeFileSync(tempPath, buf);

  const safePath = tempPath.split(path.sep).join('/');
  let restoredMembers = 0, restoredPayments = 0;

  try {
    db.exec(`ATTACH DATABASE '${safePath}' AS backup_db;`);
    const tables = q.all("SELECT name FROM backup_db.sqlite_master WHERE type='table'").map(t => t.name);
    if (!tables.includes('members')) {
      db.exec('DETACH DATABASE backup_db;');
      try { fs.unlinkSync(tempPath); } catch {}
      return bad(res, 'El archivo de respaldo no contiene la tabla de socios requerida');
    }

    q.tx(() => {
      const copyTable = tbl => {
        if (!tables.includes(tbl)) return;
        try { db.exec(`INSERT OR REPLACE INTO ${tbl} SELECT * FROM backup_db.${tbl};`); }
        catch (e) { console.warn(`Aviso copiando ${tbl}:`, e.message); }
      };

      copyTable('settings');
      copyTable('plans');
      copyTable('products');
      copyTable('members');
      copyTable('memberships');
      copyTable('payments');
      copyTable('attendance');
      copyTable('daily_passes');
      copyTable('member_credentials');
      copyTable('member_prefs');
      copyTable('announcements');
      copyTable('workouts');
      copyTable('set_logs');
      copyTable('measurements');
      copyTable('cash_shifts');

      restoredMembers = q.get('SELECT COUNT(*) c FROM members')?.c || 0;
      restoredPayments = q.get('SELECT COUNT(*) c FROM payments')?.c || 0;
    });

    db.exec('DETACH DATABASE backup_db;');
    try { fs.unlinkSync(tempPath); } catch {}
    checkpoint();
    audit(req.user.id, 'backup.restore_db', { restoredMembers, restoredPayments });
    res.json({ ok: true, restoredMembers, restoredPayments });
  } catch (err) {
    try { db.exec('DETACH DATABASE backup_db;'); } catch {}
    try { fs.unlinkSync(tempPath); } catch {}
    throw err;
  }
}));

// Restaurar / Sincronizar socios desde Google Sheets
api.post('/admin/sync-from-sheets', staff('admin'), wrap(async (req, res) => {
  const settings = getSettings();
  const url = req.body?.url || settings.google_sheet_url;
  if (!url || !/^https?:\/\//i.test(url)) {
    return bad(res, 'No se ha configurado la URL de Google Sheets en los ajustes del gimnasio');
  }

  let csvUrl = url;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) {
    const sheetId = match[1];
    csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=Socios`;
  }

  const response = await fetch(csvUrl);
  if (!response.ok) {
    return bad(res, 'No se pudo conectar a Google Sheets. Verifica que la hoja tenga permisos de lectura o esté compartida.');
  }

  const csvText = await response.text();
  const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) return bad(res, 'La hoja de Google Sheets no contiene filas de socios');

  const parseRow = line => {
    const res = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; }
      else if (c === ',' && !inQ) { res.push(cur.trim()); cur = ''; }
      else { cur += c; }
    }
    res.push(cur.trim());
    return res;
  };

  const header = parseRow(lines[0]).map(h => h.toLowerCase().replace(/["']/g, ''));
  const codeIdx = header.findIndex(h => h.includes('código') || h.includes('codigo') || h === 'code');
  const nameIdx = header.findIndex(h => h.includes('nombre') || h.includes('socio') || h === 'name');
  const dniIdx = header.findIndex(h => h.includes('dni'));
  const phoneIdx = header.findIndex(h => h.includes('tel') || h.includes('celular') || h === 'phone');

  if (nameIdx === -1) return bad(res, 'No se encontró la columna "Nombre" en la hoja de Google Sheets');

  let imported = 0;
  q.tx(() => {
    for (let i = 1; i < lines.length; i++) {
      const row = parseRow(lines[i]);
      const name = (row[nameIdx] || '').replace(/["']/g, '').trim();
      if (!name) continue;
      const code = codeIdx !== -1 && row[codeIdx] ? row[codeIdx].replace(/["']/g, '').trim() : null;
      const dni = dniIdx !== -1 && row[dniIdx] ? row[dniIdx].replace(/["']/g, '').trim() : null;
      const phone = phoneIdx !== -1 && row[phoneIdx] ? row[phoneIdx].replace(/["']/g, '').trim() : null;

      const existing = (code && q.get('SELECT id FROM members WHERE code=?', code)) ||
                       (dni && q.get('SELECT id FROM members WHERE dni=?', dni));

      if (existing) {
        q.run('UPDATE members SET name=?, phone=COALESCE(?, phone), updated_at=? WHERE id=?',
          name, phone, L.limaDay(), existing.id);
      } else {
        const r = q.run("INSERT INTO members(name, dni, phone, created_at, status, qr_key) VALUES(?, ?, ?, ?, 'active', ?)",
          name, dni, phone, L.limaDay(), require('crypto').randomBytes(16).toString('hex'));
        const newCode = code || memberCode(r.lastInsertRowid);
        q.run('UPDATE members SET code=? WHERE id=?', newCode, r.lastInsertRowid);
      }
      imported++;
    }
  });

  checkpoint();
  audit(req.user.id, 'sheets.import_members', { count: imported });
  res.json({ ok: true, imported });
}));

// ---------------- API del socio (app) ----------------
api.get('/member/me', memberAuth, wrap((req, res) => {
  const m = req.member;
  const today = L.limaDay();
  const stats = {
    visits_30: q.get("SELECT COUNT(DISTINCT day) n FROM attendance WHERE member_id=? AND result IN ('ok','warn') AND day>=?", m.id, L.addDays(today, -29)).n,
    workouts_30: q.get('SELECT COUNT(*) n FROM workouts WHERE member_id=? AND day>=?', m.id, L.addDays(today, -29)).n,
    volume_30: q.get('SELECT COALESCE(SUM(volume),0) s FROM workouts WHERE member_id=? AND day>=?', m.id, L.addDays(today, -29)).s,
    streak_weeks: streakWeeks(m.id, today)
  };
  res.json({ member: memberPublic(m, true), stats, settings: pickPublic(getSettings()), now: Date.now() });
}));
const pickPublic = s => ({ gym_name: s.gym_name, gym_phone: s.gym_phone, gym_address: s.gym_address, opening: s.opening, gym_slogan: s.gym_slogan });

function streakWeeks(mid, today) {
  // semanas consecutivas con al menos 2 visitas (semana lunes-domingo)
  const rows = q.all("SELECT DISTINCT day FROM attendance WHERE member_id=? AND result IN ('ok','warn') AND day>=?", mid, L.addDays(today, -400)).map(r => r.day);
  const weekKey = d => { const dt = new Date(d + 'T00:00:00Z'); const dow = (dt.getUTCDay() + 6) % 7; return L.addDays(d, -dow); };
  const counts = {};
  rows.forEach(d => { const k = weekKey(d); counts[k] = (counts[k] || 0) + 1; });
  let k = weekKey(today), n = 0;
  if ((counts[k] || 0) < 2) k = L.addDays(k, -7); // la semana actual aún puede completarse
  while ((counts[k] || 0) >= 2) { n++; k = L.addDays(k, -7); }
  return n;
}

api.get('/member/routines', memberAuth, wrap((req, res) => {
  const mine = q.all(`SELECT r.id,r.name,r.goal,r.level,r.description,a.id AS assignment_id,a.assigned_at,a.note,
    (SELECT COUNT(DISTINCT day_index) FROM routine_items WHERE routine_id=r.id) AS days
    FROM assignments a JOIN routines r ON r.id=a.routine_id WHERE a.member_id=? AND a.active=1 AND r.active=1 ORDER BY a.id DESC`, req.member.id);
  const templates = q.all(`SELECT r.id,r.name,r.goal,r.level,r.description,
    (SELECT COUNT(DISTINCT day_index) FROM routine_items WHERE routine_id=r.id) AS days
    FROM routines r WHERE r.template=1 AND r.active=1 AND r.member_id IS NULL ORDER BY r.name`);
  res.json({ mine, templates });
}));
api.post('/member/routines/:id/follow', memberAuth, wrap((req, res) => {
  const rid = num(req.params.id);
  if (!q.get('SELECT 1 x FROM routines WHERE id=? AND active=1', rid)) return bad(res, 'Rutina no encontrada', 404);
  q.run('UPDATE assignments SET active=0 WHERE member_id=? AND assigned_by IS NULL', req.member.id);
  if (!q.get('SELECT 1 x FROM assignments WHERE member_id=? AND routine_id=? AND active=1', req.member.id, rid))
    q.run('INSERT INTO assignments(member_id,routine_id) VALUES(?,?)', req.member.id, rid);
  res.json({ ok: true });
}));
api.post('/member/workouts', memberAuth, wrap((req, res) => {
  const b = req.body || {}; const m = req.member;
  if (b.uid && q.get('SELECT id FROM workouts WHERE uid=?', String(b.uid))) return res.json({ ok: true, duplicate: true, prs: [] });
  const sets = (Array.isArray(b.sets) ? b.sets : []).filter(s => s.ex_id && num(s.reps) > 0).slice(0, 400);
  const day = b.finished ? L.limaDay(new Date(b.finished)) : L.limaDay();
  const prs = [];
  q.tx(() => {
    const volume = sets.reduce((a, s) => a + num(s.reps) * num(s.weight), 0);
    const w = q.run('INSERT INTO workouts(member_id,routine_id,day_index,title,started,finished,duration_sec,volume,day,uid) VALUES(?,?,?,?,?,?,?,?,?,?)',
      m.id, b.routine_id || null, b.day_index ?? null, b.title, b.started, b.finished, Math.max(0, Math.round(num(b.duration_sec))), volume, day, b.uid || null);
    const best = {};
    for (const s of sets) {
      if (!(s.ex_id in best)) best[s.ex_id] = q.get('SELECT MAX(weight) w FROM set_logs WHERE member_id=? AND ex_id=?', m.id, s.ex_id).w || 0;
    }
    const newBest = {};
    for (const s of sets) {
      q.run('INSERT INTO set_logs(workout_id,member_id,ex_id,set_no,reps,weight,day) VALUES(?,?,?,?,?,?,?)', w.lastInsertRowid, m.id, s.ex_id, num(s.set_no), num(s.reps), num(s.weight), day);
      const wt = num(s.weight);
      if (wt > 0 && wt > best[s.ex_id] && wt > (newBest[s.ex_id] || 0)) newBest[s.ex_id] = wt;
    }
    for (const [ex, wt] of Object.entries(newBest)) {
      if (best[ex] > 0) prs.push({ ex_id: ex, nombre: q.get('SELECT nombre FROM exercises WHERE id=?', ex)?.nombre, weight: wt });
    }
  });
  res.json({ ok: true, prs });
}));
api.get('/member/workouts', memberAuth, wrap((req, res) => {
  res.json(q.all('SELECT id,title,day,duration_sec,volume FROM workouts WHERE member_id=? ORDER BY id DESC LIMIT 50', req.member.id));
}));
api.get('/member/last-weights', memberAuth, wrap((req, res) => {
  // último peso usado por ejercicio (para precargar en el entrenamiento)
  const rows = q.all(`SELECT ex_id, weight, reps FROM set_logs WHERE id IN (SELECT MAX(id) FROM set_logs WHERE member_id=? AND weight>0 GROUP BY ex_id)`, req.member.id);
  res.json(Object.fromEntries(rows.map(r => [r.ex_id, { weight: r.weight, reps: r.reps }])));
}));
api.get('/member/prs', memberAuth, wrap((req, res) => {
  res.json(q.all(`SELECT s.ex_id, e.nombre, e.grupo, MAX(s.weight) weight, s.reps, MAX(s.day) day FROM set_logs s JOIN exercises e ON e.id=s.ex_id
    WHERE s.member_id=? AND s.weight>0 GROUP BY s.ex_id ORDER BY weight DESC LIMIT 25`, req.member.id));
}));
api.get('/member/attendance', memberAuth, wrap((req, res) => {
  res.json(q.all("SELECT id,ts,exit_ts,duration_min,hour,day,status FROM attendance WHERE member_id=? AND result IN ('ok','warn') ORDER BY ts DESC LIMIT 90", req.member.id));
}));
api.get('/member/payments', memberAuth, wrap((req, res) => {
  res.json(q.all('SELECT id,day,concept,amount,method,receipt_no FROM payments WHERE member_id=? AND voided=0 ORDER BY id DESC LIMIT 30', req.member.id));
}));
api.get('/member/measurements', memberAuth, wrap((req, res) => res.json(q.all('SELECT * FROM measurements WHERE member_id=? ORDER BY day, id', req.member.id))));
api.post('/member/measurements', memberAuth, wrap((req, res) => {
  const b = req.body || {};
  const f = k => (b[k] === '' || b[k] == null ? null : num(b[k], null));
  const hasAny = ['weight', 'height', 'chest', 'waist', 'hip', 'arm', 'thigh', 'body_fat'].some(k => f(k) != null);
  if (!hasAny) return bad(res, 'Ingresa al menos un dato (peso, cintura, brazo, etc.)');
  if (f('weight') != null && (f('weight') < 20 || f('weight') > 300)) return bad(res, 'Peso fuera de rango (20-300 kg)');
  const day = b.day && /^\d{4}-\d{2}-\d{2}$/.test(b.day) ? b.day : L.limaDay();
  q.run('INSERT INTO measurements(member_id,day,weight,height,chest,waist,hip,arm,thigh,body_fat,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    req.member.id, day, f('weight'), f('height'), f('chest'), f('waist'), f('hip'), f('arm'), f('thigh'), f('body_fat'), b.note || null);
  res.json({ ok: true });
}));
api.delete('/member/measurements/:id', memberAuth, wrap((req, res) => {
  q.run('DELETE FROM measurements WHERE id=? AND member_id=?', num(req.params.id), req.member.id); res.json({ ok: true });
}));
api.get('/member/analytics', memberAuth, wrap((req, res) => {
  const mid = req.member.id;
  const today = L.limaDay();
  const d30 = L.addDays(today, -29);
  const d90 = L.addDays(today, -89);

  const muscleDistribution = q.all(`
    SELECT e.grupo, COUNT(*) as sets_count, COALESCE(SUM(s.reps * s.weight), 0) as volume
    FROM set_logs s
    JOIN exercises e ON e.id = s.ex_id
    WHERE s.member_id = ?
    GROUP BY e.grupo
    ORDER BY sets_count DESC
  `, mid);

  const weeklyVolume = q.all(`
    SELECT strftime('%Y-W%W', day) as week, COALESCE(SUM(volume), 0) as volume, COUNT(*) as workouts
    FROM workouts
    WHERE member_id = ?
    GROUP BY week
    ORDER BY week DESC
    LIMIT 12
  `, mid).reverse();

  const totalStats = q.get(`
    SELECT COUNT(*) as total_workouts, COALESCE(SUM(volume), 0) as total_volume,
           COALESCE(SUM(duration_sec), 0) as total_duration_sec
    FROM workouts
    WHERE member_id = ?
  `, mid);

  const totalSets = q.get('SELECT COUNT(*) as c FROM set_logs WHERE member_id=?', mid)?.c || 0;

  // Top ejercicios dominados (correlación de fuerza, repeticiones y volumen)
  const topExercises = q.all(`
    SELECT s.ex_id, e.nombre, e.grupo,
           COUNT(*) as sets_count,
           MAX(s.weight) as max_weight,
           MAX(s.reps) as max_reps,
           ROUND(COALESCE(SUM(s.reps * s.weight), 0)) as total_volume
    FROM set_logs s
    JOIN exercises e ON e.id = s.ex_id
    WHERE s.member_id = ?
    GROUP BY s.ex_id
    ORDER BY total_volume DESC, sets_count DESC
    LIMIT 8
  `, mid).map(x => ({
    ...x,
    est_1rm: x.max_weight > 0 ? Math.round(x.max_weight * (1 + Math.min(15, x.max_reps || 1) / 30)) : 0
  }));

  // Rutina activa asignada y adherencia
  const activeRoutine = q.get(`
    SELECT r.id, r.name, r.goal, r.level, r.days_per_week, a.assigned_at, a.note,
           (SELECT COUNT(DISTINCT day_index) FROM routine_items WHERE routine_id=r.id) as routine_days
    FROM assignments a
    JOIN routines r ON r.id = a.routine_id
    WHERE a.member_id = ? AND a.active = 1 AND r.active = 1
    ORDER BY a.id DESC LIMIT 1
  `, mid);

  // Análisis de asistencias, permanencia y horarios
  const attRows = q.all(`
    SELECT day, hour, duration_min, ts, exit_ts
    FROM attendance
    WHERE member_id = ? AND result IN ('ok','warn') AND day >= ?
    ORDER BY ts DESC
  `, mid, d90);

  const totalVisitsAll = q.get("SELECT COUNT(DISTINCT day) c FROM attendance WHERE member_id=? AND result IN ('ok','warn')", mid)?.c || 0;
  const visits30 = new Set(attRows.filter(r => r.day >= d30).map(r => r.day)).size;
  const visits90 = new Set(attRows.map(r => r.day)).size;

  // Inicio de semana actual (Lunes)
  const dtToday = new Date(today + 'T00:00:00Z');
  const dowToday = (dtToday.getUTCDay() + 6) % 7;
  const weekStart = L.addDays(today, -dowToday);
  const visitsThisWeek = new Set(attRows.filter(r => r.day >= weekStart).map(r => r.day)).size;
  const workoutsThisWeek = q.get('SELECT COUNT(*) c FROM workouts WHERE member_id=? AND day>=?', mid, weekStart)?.c || 0;

  const targetDaysPerWeek = activeRoutine?.days_per_week || activeRoutine?.routine_days || 4;
  const weeklyAdherencePct = Math.min(100, Math.round((Math.max(visitsThisWeek, workoutsThisWeek) / Math.max(1, targetDaysPerWeek)) * 100));
  const monthlyTargetDays = targetDaysPerWeek * 4;
  const monthlyAdherencePct = Math.min(100, Math.round((visits30 / Math.max(1, monthlyTargetDays)) * 100));

  // Duración promedio de sesión (combinando asistencia en sala y sesiones registradas)
  const withDur = attRows.filter(r => r.duration_min && r.duration_min > 0);
  const avgAttMin = withDur.length
    ? Math.round(withDur.reduce((a, b) => a + b.duration_min, 0) / withDur.length)
    : (totalStats.total_workouts > 0 ? Math.round((totalStats.total_duration_sec / 60) / totalStats.total_workouts) : 65);
  const totalGymMinutes = withDur.reduce((a, b) => a + b.duration_min, 0) + Math.round((totalStats.total_duration_sec || 0) / 60);

  // Distribución horaria (Mañana / Tarde / Noche) y día de la semana
  let morning = 0, afternoon = 0, evening = 0;
  const hourMap = {};
  const dowCounts = [0, 0, 0, 0, 0, 0, 0]; // Lun..Dom
  attRows.forEach(r => {
    const h = typeof r.hour === 'number' ? r.hour : (r.ts ? new Date(r.ts).getHours() : 18);
    if (h < 12) morning++;
    else if (h < 18) afternoon++;
    else evening++;
    hourMap[h] = (hourMap[h] || 0) + 1;
    if (r.day) {
      const d = new Date(r.day + 'T00:00:00Z');
      const idx = (d.getUTCDay() + 6) % 7;
      if (idx >= 0 && idx < 7) dowCounts[idx]++;
    }
  });

  let peakHour = 18;
  let maxHourCount = 0;
  for (const [h, cnt] of Object.entries(hourMap)) {
    if (cnt > maxHourCount) { maxHourCount = cnt; peakHour = Number(h); }
  }
  const chronotype = morning >= afternoon && morning >= evening && morning > 0
    ? 'Atleta Matutino (6:00 - 12:00)'
    : afternoon >= evening && afternoon > 0
      ? 'Turno Vespertino (12:00 - 18:00)'
      : evening > 0
        ? 'Élite Nocturno (18:00 - 21:00)'
        : 'Horario Flexible';

  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const weekdayDistribution = dayNames.map((label, i) => ({ day: label, count: dowCounts[i] }));

  // Comparativa corporal (Primera medición vs Última medición)
  const measList = q.all('SELECT * FROM measurements WHERE member_id=? ORDER BY day ASC, id ASC', mid);
  let bodyDelta = null;
  if (measList.length >= 1) {
    const first = measList[0];
    const latest = measList[measList.length - 1];
    const diff = k => (first[k] != null && latest[k] != null) ? +(latest[k] - first[k]).toFixed(1) : null;
    bodyDelta = {
      firstDay: first.day,
      latestDay: latest.day,
      count: measList.length,
      latestWeight: latest.weight,
      latestWaist: latest.waist,
      latestArm: latest.arm,
      latestChest: latest.chest,
      latestThigh: latest.thigh,
      latestHip: latest.hip,
      latestFat: latest.body_fat,
      weightDiff: diff('weight'),
      waistDiff: diff('waist'),
      armDiff: diff('arm'),
      chestDiff: diff('chest'),
      thighDiff: diff('thigh'),
      hipDiff: diff('hip'),
      fatDiff: diff('body_fat')
    };
  }

  // Score integral de desarrollo y recomendaciones inteligentes
  const streak = streakWeeks(mid, today);
  const score = Math.min(100, Math.round(
    (monthlyAdherencePct * 0.45) +
    (Math.min(100, (totalStats.total_workouts || 0) * 8) * 0.25) +
    (Math.min(100, muscleDistribution.length * 16) * 0.15) +
    (Math.min(100, streak * 20) * 0.15)
  ));
  const athleteLevel = score >= 80 ? 'Élite Disciplinado' : score >= 55 ? 'Constante Avanzado' : score >= 30 ? 'En Progreso Activo' : 'Iniciando Desarrollo';

  const insights = [];
  if (activeRoutine) {
    insights.push(`Sigues el plan "${activeRoutine.name}" (${targetDaysPerWeek} días/sem). Esta semana llevas ${Math.max(visitsThisWeek, workoutsThisWeek)}/${targetDaysPerWeek} sesiones completadas (${weeklyAdherencePct}%).`);
  } else {
    insights.push('Aún no tienes una rutina activa vinculada. Activa una plantilla en la pestaña Entrenar para correlacionar tus días meta.');
  }
  if (attRows.length > 0) {
    insights.push(`Tu horario predilecto de entrenamiento es alrededor de las ${peakHour}:00 hrs (${chronotype}), con una permanencia media de ${avgAttMin} min por visita.`);
  }
  if (muscleDistribution.length > 0) {
    const topM = muscleDistribution[0].grupo;
    const trainedGroups = new Set(muscleDistribution.map(m => m.grupo));
    const missing = ['Piernas', 'Espalda', 'Pecho', 'Hombros', 'Core'].filter(g => !trainedGroups.has(g));
    insights.push(`Tu grupo muscular más trabajado es ${topM} (${muscleDistribution[0].sets_count} series).${missing.length ? ` Sugerencia: incorpora más series de ${missing.slice(0, 2).join(' y ')} para un desarrollo simétrico.` : ' ¡Excelente balance muscular integral!'}`);
  }

  res.json({
    muscleDistribution,
    weeklyVolume,
    topExercises,
    activeRoutine: activeRoutine || null,
    adherence: {
      targetDaysPerWeek,
      visitsThisWeek,
      workoutsThisWeek,
      weeklyAdherencePct,
      visits30,
      visits90,
      totalVisitsAll,
      monthlyTargetDays,
      monthlyAdherencePct,
      streakWeeks: streak
    },
    schedule: {
      morning,
      afternoon,
      evening,
      peakHour: `${String(peakHour).padStart(2, '0')}:00`,
      chronotype,
      avgDurationMin: avgAttMin,
      totalGymHours: +(totalGymMinutes / 60).toFixed(1),
      weekdayDistribution
    },
    bodyDelta,
    development: {
      score,
      athleteLevel,
      insights
    },
    totalWorkouts: totalStats.total_workouts || 0,
    totalVolume: totalStats.total_volume || 0,
    totalDurationSec: totalStats.total_duration_sec || 0,
    totalSets
  });
}));

// ---------------- Hub del socio: acceso propio, dispositivos, avisos y push ----------------
require('./member-hub')(api, { q, db, bad, wrap, num, staff, memberAuth, loadSession, limited, memberPublic, withState, MEMBER_SELECT, numSettings, getSettings, audit, L, bcrypt, memberCode });

api.use((req, res) => bad(res, 'Ruta no encontrada', 404));
app.use('/api', api);

// ---------------- Archivos estáticos ----------------
app.use('/photos', express.static(path.join(DATA_DIR, 'photos'), { maxAge: '7d', index: false }));
app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: '1h',
  setHeaders: (res, p) => { if (/(sw\.js|\.html|manifest\.json)$/.test(p)) res.setHeader('Cache-Control', 'no-cache'); }
}));
app.get('/admin', (req, res) => res.redirect('/admin/'));

// Errores
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: err.message || 'Error interno del servidor. Inténtalo otra vez.' });
});

// ---------------- Arranque ----------------
const PORT = process.env.PORT || 3000;
async function start() {
  restoreVault();
  if (CloudVault.isConfigured()) {
    try {
      console.log(`[START] Conectando con Bóveda en la Nube (${CloudVault.getProvider()})...`);
      const restored = await restoreVaultFromCloud();
      console.log(`[START] Bóveda en la Nube lista (${restored} socios listos).`);
    } catch (e) {
      console.warn('[START] Error sincronizando bóveda en la nube al arranque:', e.message);
    }
  }
  try { q.run("UPDATE settings SET value='' WHERE key='google_sheet_url' AND value LIKE '%1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms%'"); } catch {}
  backup();
  checkpoint();
  saveVault();
  setInterval(checkpoint, 5 * 60 * 1000).unref();
  setInterval(saveVault, 2 * 60 * 1000).unref();
  setInterval(backup, 6 * 3600 * 1000).unref();
  const gracefulShutdown = async () => {
    try { checkpoint(); saveVault(); await CloudVault.flush(6000); } catch {}
    process.exit(0);
  };
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
  process.on('uncaughtException', err => {
    console.error('[ANTI-CRASH] Excepción no capturada interceptada:', err?.stack || err);
    try { checkpoint(); saveVault(); } catch {}
  });
  process.on('unhandledRejection', reason => {
    console.error('[ANTI-CRASH] Promesa rechazada interceptada:', reason);
  });
  const tls = process.env.HTTPS === '1';
  if (tls) {
    const selfsigned = require('selfsigned');
    const https = require('https');
    const os = require('os');
    const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4').map(i => i.address);
    const keyF = path.join(DATA_DIR, 'tls.key'), crtF = path.join(DATA_DIR, 'tls.crt');
    if (!fs.existsSync(keyF)) {
      const alt = [{ type: 2, value: 'localhost' }, ...ips.map(ip => ({ type: 7, ip }))];
      const pems = selfsigned.generate([{ name: 'commonName', value: 'rd-fitness' }], { days: 3650, keySize: 2048, extensions: [{ name: 'subjectAltName', altNames: alt }] });
      fs.writeFileSync(keyF, pems.private); fs.writeFileSync(crtF, pems.cert);
    }
    https.createServer({ key: fs.readFileSync(keyF), cert: fs.readFileSync(crtF) }, app).listen(PORT, '0.0.0.0', () => {
      console.log(`RD Fitness Club (HTTPS) en https://localhost:${PORT}`);
      ips.forEach(ip => console.log(`  Red local: https://${ip}:${PORT}   Panel: https://${ip}:${PORT}/admin/`));
    });
  } else {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`RD Fitness Club en http://localhost:${PORT}  (panel: /admin/)`);
    });
  }
}
if (require.main === module) start();
module.exports = { app };
