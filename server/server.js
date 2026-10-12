// RD Fitness Club - Servidor API (Express + SQLite)
const express = require('express');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { q, db, DATA_DIR, getSettings, numSettings, backup, nextReceiptNo, dailyPassCode, getActiveShift, computeShiftTotals, getActiveAttendanceSession, closeAttendanceSession } = require('./db');
const { getScopedReportData, getMemberAttendanceDetail, buildExcelXmlReport, buildCsvLiveFeed } = require('./reports');
const L = require('./lib');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

// ---------------- Utilidades ----------------
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const audit = (uid, action, detail) => q.run('INSERT INTO audit(user_id,action,detail) VALUES(?,?,?)', uid || null, action, typeof detail === 'string' ? detail : JSON.stringify(detail));
const J = s => { try { return JSON.parse(s); } catch { return []; } };
const memberCode = id => 'RD-' + String(id).padStart(4, '0');
const METHODS = ['efectivo', 'yape', 'plin', 'tarjeta', 'transferencia'];

// Rate limit simple para login
const attempts = new Map();
function limited(req) {
  const k = req.ip; const now = Date.now();
  const a = attempts.get(k) || { n: 0, t: now };
  if (now - a.t > 60000) { a.n = 0; a.t = now; }
  a.n++; attempts.set(k, a);
  return a.n > 12;
}

// ---------------- Autenticación ----------------
function loadSession(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  const s = q.get("SELECT * FROM sessions WHERE token=? AND created_at > datetime('now','-90 days')", token);
  return s || null;
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

api.get('/time', (req, res) => res.json({ now: Date.now(), day: L.limaDay() }));
api.get('/public', (req, res) => {
  const s = getSettings();
  res.json({ gym_name: s.gym_name, gym_slogan: s.gym_slogan, gym_phone: s.gym_phone, gym_address: s.gym_address, color: s.color, opening: s.opening });
});

api.post('/auth/login', wrap((req, res) => {
  if (limited(req)) return bad(res, 'Demasiados intentos. Espera un minuto.', 429);
  const { username, password } = req.body || {};
  const u = q.get('SELECT * FROM users WHERE username=? AND active=1', String(username || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(String(password || ''), u.pass_hash)) return bad(res, 'Usuario o contraseña incorrectos', 401);
  const token = L.randomToken();
  q.run("INSERT INTO sessions(token,kind,ref_id) VALUES(?,?,?)", token, 'staff', u.id);
  res.json({ token, user: { id: u.id, username: u.username, name: u.name, role: u.role, must_change: u.must_change } });
}));

api.post('/auth/member-login', wrap((req, res) => {
  if (limited(req)) return bad(res, 'Demasiados intentos. Espera un minuto.', 429);
  let { code, dni } = req.body || {};
  code = String(code || '').trim().toUpperCase().replace(/\s/g, '');
  if (/^\d+$/.test(code)) code = memberCode(parseInt(code, 10));
  dni = String(dni || '').trim();
  const m = q.get('SELECT * FROM members WHERE code=?', code);
  if (!m || !dni || String(m.dni || '').trim() !== dni) return bad(res, 'Código o DNI incorrecto', 401);
  if (m.status === 'inactive') return bad(res, 'Cuenta dada de baja. Consulta en recepción.', 403);
  const token = L.randomToken();
  q.run("INSERT INTO sessions(token,kind,ref_id) VALUES(?,?,?)", token, 'member', m.id);
  res.json({ token, member: memberPublic(m, true) });
}));

api.post('/auth/logout', wrap((req, res) => {
  const s = loadSession(req); if (s) q.run('DELETE FROM sessions WHERE token=?', s.token);
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
    (SELECT MAX(end_date) FROM memberships s WHERE s.member_id=m.id AND s.status='active') AS end_date,
    (SELECT plan_name FROM memberships s WHERE s.member_id=m.id AND s.status='active' ORDER BY end_date DESC, id DESC LIMIT 1) AS plan_name,
    (SELECT MAX(ts) FROM attendance a WHERE a.member_id=m.id AND a.result IN ('ok','warn')) AS last_in
  FROM members m`;

function withState(m, cfg, today) {
  const st = L.accessState({ status: m.status, frozen: !!m.frozen_from, end: m.end_date }, today, cfg);
  return { ...m, access: st.level, access_reason: st.reason, days_left: st.daysLeft, frozen: !!m.frozen_from };
}
function memberPublic(m, includeKey = false) {
  const cfg = numSettings(); const today = L.limaDay();
  const full = q.get(MEMBER_SELECT + ' WHERE m.id=?', m.id);
  const s = withState(full, cfg, today);
  const out = {
    id: s.id, code: s.code, name: s.name, dni: s.dni, phone: s.phone, email: s.email, birth: s.birth, gender: s.gender,
    goal: s.goal, level: s.level, photo: s.photo, status: s.status, plan_name: s.plan_name, end_date: s.end_date,
    access: s.access, access_reason: s.access_reason, days_left: s.days_left, frozen: s.frozen, created_at: s.created_at,
    health: s.health, emergency: s.emergency
  };
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

function activateMembership({ member_id, plan, start, price, userId, method, note, concept, op_code, voucher_img }) {
  const last = q.get("SELECT MAX(end_date) e FROM memberships WHERE member_id=? AND status='active'", member_id);
  const today = L.limaDay();
  let s = start || today;
  if (!start && last && last.e && last.e >= today) s = L.addDays(last.e, 1); // renovación anticipada: se suma a lo que queda
  const end = L.membershipEnd(s, plan.months, plan.days);
  const receipt_no = nextReceiptNo();
  const curShift = getActiveShift(userId);
  const shift_id = curShift ? curShift.id : null;
  const ms = q.run('INSERT INTO memberships(member_id,plan_id,plan_name,start_date,end_date,price,created_by) VALUES(?,?,?,?,?,?,?)',
    member_id, plan.id, plan.name, s, end, price, userId);
  const pay = q.run('INSERT INTO payments(member_id,membership_id,concept,amount,method,note,day,user_id,op_code,voucher_img,receipt_no,shift_id,category) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    member_id, ms.lastInsertRowid, concept || `Membresía ${plan.name}`, price, method, note || null, today, userId, op_code || null, voucher_img || null, receipt_no, shift_id, 'gym');
  return { membership_id: Number(ms.lastInsertRowid), payment_id: Number(pay.lastInsertRowid), start: s, end, receipt_no };
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
    workouts: q.all('SELECT id,title,day,duration_sec,volume FROM workouts WHERE member_id=? ORDER BY id DESC LIMIT 15', id)
  });
}));

api.post('/members', staff('admin', 'recepcion'), wrap((req, res) => {
  const b = req.body || {};
  const name = String(b.name || '').trim().replace(/\s+/g, ' ');
  if (name.length < 3) return bad(res, 'Escribe el nombre completo del socio');
  const dni = String(b.dni || '').trim();
  if (!/^[A-Za-z0-9]{6,12}$/.test(dni)) return bad(res, 'DNI inválido (usa 8 dígitos; extranjeros: documento de 6-12 caracteres)');
  const dup = q.get('SELECT id,code,name FROM members WHERE dni=?', dni);
  if (dup) return res.status(409).json({ error: `Ya existe un socio con ese DNI: ${dup.name} (${dup.code})`, existing: dup });
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
    if (plan) ms = activateMembership({ member_id: id, plan, price, userId: req.user.id, method: b.method, note: b.discount_note, op_code: b.op_code, voucher_img: b.voucher_img });
    return { id, ms };
  });
  audit(req.user.id, 'member.create', { id: result.id, name });
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
  audit(req.user.id, 'member.update', { id });
  res.json({ ok: true });
}));

api.post('/members/:id/photo', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get('SELECT * FROM members WHERE id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/.exec(req.body?.data || '');
  if (!match) return bad(res, 'Imagen inválida');
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 1.5 * 1024 * 1024) return bad(res, 'La foto es muy pesada');
  const file = `${m.code}-${L.randomKey().slice(0, 8)}.${match[1] === 'png' ? 'png' : match[1] === 'webp' ? 'webp' : 'jpg'}`;
  fs.writeFileSync(path.join(DATA_DIR, 'photos', file), buf);
  if (m.photo) { try { fs.unlinkSync(path.join(DATA_DIR, 'photos', path.basename(m.photo))); } catch { } }
  q.run('UPDATE members SET photo=? WHERE id=?', '/photos/' + file, id);
  res.json({ photo: '/photos/' + file });
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
    op_code: req.body.op_code, voucher_img: req.body.voucher_img
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

api.post('/members/:id/checkin', staff('admin', 'recepcion'), wrap((req, res) => {
  const id = num(req.params.id);
  const m = q.get(MEMBER_SELECT + ' WHERE m.id=?', id);
  if (!m) return bad(res, 'Socio no encontrado', 404);
  const today = L.limaDay();
  const now = new Date();

  // Si se solicita registrar salida
  if (req.body?.direction === 'out') {
    const active = getActiveAttendanceSession(m.code, today);
    if (active) {
      const closed = closeAttendanceSession(active.id, now);
      return res.json({ action: 'checkout', duration_min: closed.duration_min, access: 'ok', reason: `Salida registrada (${closed.duration_min} min)` });
    }
  }

  const s = withState(m, numSettings(), today);
  const r = q.run('INSERT INTO attendance(uid,member_id,code,ts,day,hour,result,reason,kind,direction,status,user_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    'srv-' + L.randomKey(), id, m.code, now.toISOString(), L.limaDay(now), L.limaHour(now), s.access, s.access_reason, 'M', 'in', 'inside', req.user.id);
  res.json({ action: 'checkin', id: Number(r.lastInsertRowid), access: s.access, reason: s.access_reason });
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
api.get('/payments/:id/receipt', anyAuth, wrap((req, res) => {
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
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.post('/expenses/:id/void', staff('admin'), wrap((req, res) => {
  q.run('UPDATE expenses SET voided=1 WHERE id=?', num(req.params.id));
  audit(req.user.id, 'expense.void', { id: req.params.id });
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
api.post('/products', staff('admin'), wrap((req, res) => {
  const b = req.body || {}; if (!b.name || num(b.price) < 0) return bad(res, 'Datos incompletos');
  const r = q.run('INSERT INTO products(name,price,stock,barcode,category,min_stock) VALUES(?,?,?,?,?,?)',
    b.name, num(b.price), num(b.stock), b.barcode || null, b.category || 'general', num(b.min_stock, 5));
  res.json({ id: Number(r.lastInsertRowid) });
}));
api.put('/products/:id', staff('admin'), wrap((req, res) => {
  const b = req.body || {}; const p = q.get('SELECT * FROM products WHERE id=?', num(req.params.id));
  if (!p) return bad(res, 'Producto no encontrado', 404);
  q.run('UPDATE products SET name=?, price=?, stock=?, barcode=?, category=?, min_stock=?, active=? WHERE id=?',
    b.name ?? p.name, b.price ?? p.price, b.stock ?? p.stock, b.barcode ?? p.barcode, b.category ?? p.category, b.min_stock ?? p.min_stock, b.active ?? p.active, p.id);
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
  const receipt_no = nextReceiptNo();
  const total = p.price * qty;
  let payId;
  const curShift = getActiveShift(req.user.id);
  const shift_id = curShift ? curShift.id : null;
  q.tx(() => {
    q.run('UPDATE products SET stock=stock-? WHERE id=?', qty, p.id);
    const pay = q.run('INSERT INTO payments(member_id,concept,amount,method,op_code,voucher_img,receipt_no,day,user_id,shift_id,category) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
      b.member_id || null, `Venta: ${p.name} x${qty}`, total, b.method, b.op_code || null, b.voucher_img || null, receipt_no, L.limaDay(), req.user.id, shift_id, 'store');
    payId = Number(pay.lastInsertRowid);
  });
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
    // Canales separados
    gym: {
      income: data.totalGymIncome,
      expenses: data.totalGymExpense,
      net: data.gymNet,
      byMethod: data.gymByMethod,
      payments: data.gymPayments,
      dailyPasses: data.dailyPasses,
      byPlan: data.byPlan
    },
    store: {
      income: data.totalStoreIncome,
      expenses: data.totalStoreExpense,
      net: data.storeNet,
      byMethod: data.storeByMethod,
      payments: data.storePayments,
      productStats: data.productStats,
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
      netProfit: data.netProfit,
      cashInDrawer: data.cashInDrawer,
      digitalTotal: data.digitalTotal,
      dailyComparison: data.dailyComparison,
      shifts: data.shifts
    },
    attendance: data.attendance
  });
}));

// Descarga en formato Microsoft Excel con Fórmulas Nativas
api.get('/reports/export/excel', staff('admin', 'recepcion'), wrap((req, res) => {
  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -29);
  const shift_id = req.query.shift_id ? num(req.query.shift_id) : null;

  const data = getScopedReportData({ from, to, shift_id, q });
  const settings = getSettings();
  const xml = buildExcelXmlReport({ data, settings });

  const filename = `Reporte_RD_Fitness_${from}_al_${to}.xls`;
  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(xml);
}));

// Feed en vivo en formato CSV para Google Sheets (=IMPORTDATA)
api.get('/reports/live-feed.csv', wrap((req, res) => {
  const settings = getSettings();
  const key = req.query.key;
  if (key && key !== settings.google_sheets_key) {
    return bad(res, 'Clave de Google Sheets inválida', 403);
  }

  const today = L.limaDay();
  const to = req.query.to || today;
  const from = req.query.from || L.addDays(to, -30);
  const type = req.query.type || 'consolidated'; // 'consolidated' | 'gym' | 'store' | 'shifts'

  const data = getScopedReportData({ from, to, q });
  const csv = buildCsvLiveFeed({ type, data });

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `inline; filename="rd_fitness_${type}_${today}.csv"`);
  res.send(csv);
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
  const allowed = ['gym_name', 'gym_slogan', 'gym_phone', 'gym_address', 'warn_days', 'grace_days', 'passback_min', 'stay_min', 'opening', 'color'];
  q.tx(() => { for (const k of allowed) if (k in (req.body || {})) q.run('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)', k, String(req.body[k])); });
  audit(req.user.id, 'settings.update', req.body);
  res.json({ ok: true });
}));
api.get('/audit', staff('admin'), wrap((req, res) => res.json(q.all('SELECT a.*, u.name user_name FROM audit a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 200'))));
api.get('/backup', staff('admin'), wrap((req, res) => {
  const f = path.join(DATA_DIR, 'backups', `manual-${Date.now()}.db`);
  db.exec(`VACUUM INTO '${f.replace(/'/g, "''")}'`);
  res.download(f, `rdfitness-${L.limaDay()}.db`, () => { try { fs.unlinkSync(f); } catch { } });
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
  res.json(q.all(`SELECT s.ex_id, e.nombre, MAX(s.weight) weight, s.reps FROM set_logs s JOIN exercises e ON e.id=s.ex_id
    WHERE s.member_id=? AND s.weight>0 GROUP BY s.ex_id ORDER BY weight DESC LIMIT 20`, req.member.id));
}));
api.get('/member/attendance', memberAuth, wrap((req, res) => {
  res.json(q.all("SELECT ts,day FROM attendance WHERE member_id=? AND result IN ('ok','warn') ORDER BY ts DESC LIMIT 90", req.member.id));
}));
api.get('/member/payments', memberAuth, wrap((req, res) => {
  res.json(q.all('SELECT day,concept,amount,method FROM payments WHERE member_id=? AND voided=0 ORDER BY id DESC LIMIT 30', req.member.id));
}));
api.get('/member/measurements', memberAuth, wrap((req, res) => res.json(q.all('SELECT * FROM measurements WHERE member_id=? ORDER BY day, id', req.member.id))));
api.post('/member/measurements', memberAuth, wrap((req, res) => {
  const b = req.body || {};
  const f = k => (b[k] === '' || b[k] == null ? null : num(b[k], null));
  if (f('weight') == null && f('waist') == null && f('chest') == null) return bad(res, 'Ingresa al menos un dato');
  if (f('weight') != null && (f('weight') < 20 || f('weight') > 300)) return bad(res, 'Peso fuera de rango');
  q.run('INSERT INTO measurements(member_id,day,weight,height,chest,waist,hip,arm,thigh,body_fat,note) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
    req.member.id, L.limaDay(), f('weight'), f('height'), f('chest'), f('waist'), f('hip'), f('arm'), f('thigh'), f('body_fat'), b.note);
  res.json({ ok: true });
}));
api.delete('/member/measurements/:id', memberAuth, wrap((req, res) => {
  q.run('DELETE FROM measurements WHERE id=? AND member_id=?', num(req.params.id), req.member.id); res.json({ ok: true });
}));

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
  res.status(500).json({ error: 'Error interno del servidor. Inténtalo otra vez.' });
});

// ---------------- Arranque ----------------
const PORT = process.env.PORT || 3000;
function start() {
  backup();
  setInterval(backup, 6 * 3600 * 1000);
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
