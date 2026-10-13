/* RD Fitness Club - Hub del socio
 * Acceso propio (alias + contraseña), sesiones por dispositivo, bandeja de avisos y notificaciones push opt-in.
 * El código RD-xxxx sigue siendo el identificador interno inmutable del socio. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { DATA_DIR } = require('./db');

module.exports = function mountMemberHub(api, ctx) {
  const { q, bad, wrap, num, staff, memberAuth, loadSession, limited, memberPublic, audit, L, bcrypt, memberCode } = ctx;

  let webpush = null;
  try { webpush = require('web-push'); } catch { /* push deshabilitado si falta la dependencia */ }

  // ---------------- Utilidades ----------------
  const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const devId = token => sha(token).slice(0, 14);
  const sqlNow = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const asIso = s => (s ? (String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z') : null);
  const clip = (v, n) => String(v ?? '').trim().slice(0, n);
  const fmtDMY = d => { if (!d) return ''; const [y, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${y}`; };
  const isSecure = req => req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0] === 'https';

  function readCookie(req, name) {
    const raw = req.headers.cookie || '';
    for (const part of raw.split(';')) {
      const i = part.indexOf('=');
      if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
    }
    return null;
  }
  function setRecoveryCookie(req, res, token) {
    res.setHeader('Set-Cookie', `rd_m=${token}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${isSecure(req) ? '; Secure' : ''}`);
  }
  function deviceLabel(ua = '') {
    const os = /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad' : /Android/i.test(ua) ? 'Android' : /Windows/i.test(ua) ? 'Windows' : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Dispositivo';
    const br = /Edg\//i.test(ua) ? 'Edge' : /OPR\//i.test(ua) ? 'Opera' : /SamsungBrowser/i.test(ua) ? 'Samsung Internet' : /Firefox|FxiOS/i.test(ua) ? 'Firefox' : /Chrome|CriOS/i.test(ua) ? 'Chrome' : /Safari/i.test(ua) ? 'Safari' : 'Navegador';
    return `${os} · ${br}`;
  }

  // ---------------- Credenciales propias ----------------
  const RESERVED = new Set(['admin', 'administrador', 'rd', 'rdfitness', 'recepcion', 'soporte', 'gimnasio', 'gym', 'socio', 'usuario', 'root', 'test']);
  const getCred = id => q.get('SELECT * FROM member_credentials WHERE member_id=?', id);

  function findMember(ident) {
    const s = String(ident || '').trim().replace(/\s/g, '');
    if (!s) return null;
    // 1. Prioridad: DNI del socio (identificador vitalicio en Perú o extranjero)
    const byDni = q.get('SELECT * FROM members WHERE dni=? COLLATE NOCASE', s);
    if (byDni) return byDni;
    // 2. Formato código de socio: RD-0001, rd-1, etc.
    if (/^rd-?\d+$/i.test(s)) return q.get('SELECT * FROM members WHERE code=?', memberCode(parseInt(s.replace(/\D/g, ''), 10)));
    // 3. Código numérico corto (1 a 6 dígitos)
    if (/^\d{1,6}$/.test(s)) {
      const byCode = q.get('SELECT * FROM members WHERE code=?', memberCode(parseInt(s, 10)));
      if (byCode) return byCode;
    }
    // 4. Alias o usuario personalizado
    const c = q.get('SELECT member_id FROM member_credentials WHERE alias=?', s);
    if (c) return q.get('SELECT * FROM members WHERE id=?', c.member_id);
    // 5. Correo electrónico como alternativa
    const byEmail = q.get('SELECT * FROM members WHERE email=? COLLATE NOCASE', s);
    if (byEmail) return byEmail;
    return null;
  }
  // Si configuró contraseña propia se valida contra su hash. Si regresa meses después y olvidó su clave,
  // su DNI siempre le permite recuperar acceso inmediato sin quedar bloqueado.
  function verifySecret(m, secret) {
    const raw = String(secret ?? '').trim();
    if (!raw) return false;
    const cr = getCred(m.id);
    if (cr && cr.pass_hash) {
      if (bcrypt.compareSync(raw, cr.pass_hash)) return true;
      // Respaldo de acceso con DNI si olvidó la contraseña personalizada
      if (m.dni && String(m.dni).trim() === raw) return true;
      return false;
    }
    return !!m.dni && String(m.dni).trim() !== '' && String(m.dni).trim() === raw;
  }
  function aliasProblem(alias, selfId) {
    if (!/^[a-z0-9._]{3,20}$/i.test(alias)) return 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto o guion bajo.';
    if (/^\d+$/.test(alias) || /^rd-?\d+$/i.test(alias)) return 'Elige un usuario que no sea solo números ni parecido a tu código RD.';
    if (RESERVED.has(alias.toLowerCase())) return 'Ese usuario no está disponible.';
    const taken = q.get('SELECT member_id FROM member_credentials WHERE alias=?', alias);
    if (taken && taken.member_id !== selfId) return 'Ese usuario ya está en uso. Prueba con otro.';
    return null;
  }

  // Bloqueo por identificador (además del límite por IP): frena adivinar contraseñas de un mismo socio
  const fails = new Map();
  const failKey = s => String(s || '').trim().toLowerCase();
  const isLocked = k => { const f = fails.get(k); return !!f && f.n >= 8 && Date.now() - f.t < 10 * 60000; };
  const addFail = k => { const f = fails.get(k); if (!f || Date.now() - f.t > 10 * 60000) fails.set(k, { n: 1, t: Date.now() }); else { f.n++; f.t = Date.now(); } };

  function openSession(req, res, m, device) {
    const token = L.randomToken();
    const deviceId = clip(device?.device_id, 64) || null;
    const ua = clip(req.headers['user-agent'], 300);
    const label = clip(device?.device_label, 60) || deviceLabel(ua);
    q.tx(() => {
      if (deviceId) q.run("DELETE FROM sessions WHERE kind='member' AND ref_id=? AND device_id=?", m.id, deviceId);
      q.run("INSERT INTO sessions(token,kind,ref_id,device_id,device_label,last_seen,ua) VALUES(?,?,?,?,?,datetime('now'),?)", token, 'member', m.id, deviceId, label, ua);
    });
    setRecoveryCookie(req, res, token);
    return token;
  }

  const DUMMY_HASH = bcrypt.hashSync('rd-fitness-dummy', 8);

  api.post('/auth/member-login', wrap((req, res) => {
    if (limited(req)) return bad(res, 'Demasiados intentos. Espera un minuto.', 429);
    const b = req.body || {};
    const ident = String(b.id ?? b.code ?? '');
    const secret = String(b.secret ?? b.dni ?? '');
    const key = failKey(ident);
    if (isLocked(key)) return bad(res, 'Demasiados intentos con este usuario. Espera 10 minutos o consulta en recepción.', 429);
    const m = findMember(ident);
    if (!m) { bcrypt.compareSync(secret, DUMMY_HASH); addFail(key); return bad(res, 'Usuario o contraseña incorrectos', 401); }
    if (!verifySecret(m, secret)) { addFail(key); return bad(res, 'Usuario o contraseña incorrectos', 401); }
    if (m.status === 'inactive') return bad(res, 'Cuenta dada de baja. Consulta en recepción.', 403);
    fails.delete(key);
    const token = openSession(req, res, m, b);
    const cr = getCred(m.id);
    res.json({ token, member: memberPublic(m, true), needs_setup: !(cr && cr.pass_hash) });
  }));

  // Recupera la sesión de este dispositivo si el navegador borró el almacenamiento local (cookie httpOnly)
  api.post('/auth/resume', wrap((req, res) => {
    const token = readCookie(req, 'rd_m');
    const s = token ? loadSession({ headers: { authorization: 'Bearer ' + token } }) : null;
    const m = s && s.kind === 'member' ? q.get('SELECT * FROM members WHERE id=?', s.ref_id) : null;
    if (!m || m.status === 'inactive') {
      res.setHeader('Set-Cookie', 'rd_m=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
      return bad(res, 'Sin sesión', 401);
    }
    const cr = getCred(m.id);
    res.json({ token, member: memberPublic(m, true), needs_setup: !(cr && cr.pass_hash) });
  }));

  api.get('/member/alias-available', memberAuth, wrap((req, res) => {
    const alias = clip(req.query.alias, 40);
    const why = aliasProblem(alias, req.member.id);
    res.json({ available: !why, reason: why });
  }));

  api.post('/member/credentials', memberAuth, wrap((req, res) => {
    if (limited(req)) return bad(res, 'Demasiados intentos. Espera un minuto.', 429);
    const m = req.member, b = req.body || {};
    if (!verifySecret(m, b.current_secret)) return bad(res, 'Tu contraseña actual no es correcta');
    const cr = getCred(m.id);
    let alias = cr?.alias || null;
    let hash = cr?.pass_hash || null;
    const wantAlias = clip(b.alias, 40);
    if (wantAlias && wantAlias.toLowerCase() !== String(alias || '').toLowerCase()) {
      const why = aliasProblem(wantAlias, m.id); if (why) return bad(res, why);
      alias = wantAlias;
    }
    const np = String(b.new_password ?? '');
    if (np) {
      if (np.length < 6) return bad(res, 'La contraseña debe tener al menos 6 caracteres');
      if (np.length > 72) return bad(res, 'La contraseña es demasiado larga');
      if (m.dni && np.trim() === String(m.dni).trim()) return bad(res, 'Tu contraseña no puede ser igual a tu DNI');
      if (alias && np.toLowerCase() === alias.toLowerCase()) return bad(res, 'Tu contraseña no puede ser igual a tu usuario');
      hash = bcrypt.hashSync(np, 10);
    }
    if (!hash && alias) return bad(res, 'Crea también una contraseña propia para proteger tu usuario');
    if (!alias && !hash) return bad(res, 'No hay cambios que guardar');
    try {
      q.run(`INSERT INTO member_credentials(member_id,alias,pass_hash,updated_at) VALUES(?,?,?,datetime('now'))
        ON CONFLICT(member_id) DO UPDATE SET alias=excluded.alias, pass_hash=excluded.pass_hash, updated_at=excluded.updated_at`, m.id, alias, hash);
    } catch (e) { return bad(res, 'Ese usuario ya está en uso. Prueba con otro.'); }
    if (np) q.run("DELETE FROM sessions WHERE kind='member' AND ref_id=? AND token<>?", m.id, req.token); // cerrar sesión en los demás dispositivos
    audit(null, 'member.credentials', { member: m.code, alias_changed: !!wantAlias, password_changed: !!np });
    res.json({ ok: true, member: memberPublic(m, true) });
  }));

  // ---------------- Dispositivos ----------------
  api.get('/member/devices', memberAuth, wrap((req, res) => {
    const rows = q.all("SELECT token,device_label,created_at,last_seen FROM sessions WHERE kind='member' AND ref_id=? ORDER BY COALESCE(last_seen,created_at) DESC", req.member.id);
    res.json(rows.map(r => ({ id: devId(r.token), label: r.device_label || 'Dispositivo', created_at: asIso(r.created_at), last_seen: asIso(r.last_seen || r.created_at), current: r.token === req.token })));
  }));
  api.delete('/member/devices/:id', memberAuth, wrap((req, res) => {
    const rows = q.all("SELECT token,device_id FROM sessions WHERE kind='member' AND ref_id=?", req.member.id);
    const t = rows.find(r => devId(r.token) === req.params.id);
    if (!t) return bad(res, 'Dispositivo no encontrado', 404);
    if (t.token === req.token) return bad(res, 'Para cerrar este dispositivo usa “Cerrar sesión”');
    q.run('DELETE FROM sessions WHERE token=?', t.token);
    if (t.device_id) q.run('DELETE FROM push_subs WHERE member_id=? AND device_id=?', req.member.id, t.device_id);
    res.json({ ok: true });
  }));
  api.post('/member/devices/logout-others', memberAuth, wrap((req, res) => {
    const r = q.run("DELETE FROM sessions WHERE kind='member' AND ref_id=? AND token<>?", req.member.id, req.token);
    res.json({ ok: true, closed: r.changes });
  }));

  // El personal restablece el acceso (olvidó su contraseña): vuelve a DNI y se cierran todas sus sesiones
  api.post('/members/:id/reset-credentials', staff('admin', 'recepcion'), wrap((req, res) => {
    const id = num(req.params.id);
    const m = q.get('SELECT id,code,name FROM members WHERE id=?', id);
    if (!m) return bad(res, 'Socio no encontrado', 404);
    if (req.body && req.body.clear_alias) q.run('DELETE FROM member_credentials WHERE member_id=?', id);
    else q.run('UPDATE member_credentials SET pass_hash=NULL, updated_at=datetime(\'now\') WHERE member_id=?', id);
    q.run("DELETE FROM sessions WHERE kind='member' AND ref_id=?", id);
    audit(req.user.id, 'member.credentials.reset', { member: m.code, clear_alias: !!(req.body && req.body.clear_alias) });
    res.json({ ok: true });
  }));

  // ---------------- Preferencias ----------------
  const PREF_KEYS = ['show_promos', 'show_reminders', 'push_critical', 'push_news', 'push_promos'];
  function getPrefs(mid) {
    let p = q.get('SELECT * FROM member_prefs WHERE member_id=?', mid);
    if (!p) { q.run('INSERT OR IGNORE INTO member_prefs(member_id) VALUES(?)', mid); p = q.get('SELECT * FROM member_prefs WHERE member_id=?', mid); }
    return p;
  }
  const prefsOut = (mid) => {
    const p = getPrefs(mid);
    const out = {};
    PREF_KEYS.forEach(k => out[k] = !!p[k]);
    out.alert_mode = ['sound', 'vibrate', 'silent'].includes(p.alert_mode) ? p.alert_mode : 'sound';
    out.push_devices = q.get('SELECT COUNT(*) n FROM push_subs WHERE member_id=?', mid).n;
    return out;
  };
  api.get('/member/prefs', memberAuth, wrap((req, res) => res.json(prefsOut(req.member.id))));
  api.put('/member/prefs', memberAuth, wrap((req, res) => {
    getPrefs(req.member.id);
    const b = req.body || {};
    for (const k of PREF_KEYS) if (k in b) q.run(`UPDATE member_prefs SET ${k}=? WHERE member_id=?`, b[k] ? 1 : 0, req.member.id);
    if ('alert_mode' in b) {
      const mode = ['sound', 'vibrate', 'silent'].includes(b.alert_mode) ? b.alert_mode : 'sound';
      q.run('UPDATE member_prefs SET alert_mode=? WHERE member_id=?', mode, req.member.id);
    }
    res.json(prefsOut(req.member.id));
  }));

  // ---------------- Boletas y comprobantes digitales del socio ----------------
  api.get('/member/receipts', memberAuth, wrap((req, res) => {
    const pays = q.all(`
      SELECT p.id, p.concept, p.amount, p.method, p.day, p.created_at, p.receipt_no, p.category, p.op_code,
             ms.plan_name, ms.start_date, ms.end_date
      FROM payments p
      LEFT JOIN memberships ms ON ms.id=p.membership_id
      WHERE p.member_id=? AND p.voided=0
      ORDER BY p.id DESC LIMIT 50`, req.member.id);
    res.json({
      receipts: pays.map(p => ({
        id: p.id,
        receipt_no: p.receipt_no || `B001-${String(p.id).padStart(6, '0')}`,
        concept: p.concept,
        amount: p.amount,
        method: p.method,
        op_code: p.op_code,
        date: p.day || p.created_at?.slice(0, 10),
        created_at: asIso(p.created_at),
        category: p.category,
        plan_name: p.plan_name,
        validity: p.start_date && p.end_date ? `Del ${p.start_date} al ${p.end_date}` : null
      }))
    });
  }));

  // ---------------- Bandeja de avisos ----------------
  const KINDS = { aviso: 'news', evento: 'news', tematica: 'promos', promo: 'promos', mantenimiento: 'critical', cierre: 'critical', pago: 'critical', recordatorio: 'critical' };
  const AUDIENCES = ['all', 'active', 'expiring', 'expired', 'member'];

  const inWindow = (a, now) => (!a.starts_at || new Date(a.starts_at).getTime() <= now) && (!a.ends_at || new Date(a.ends_at).getTime() >= now);
  const matchesAudience = (a, m, mp) => {
    switch (a.audience) {
      case 'all': return true;
      case 'active': return mp.access === 'ok' || mp.access === 'warn';
      case 'expiring': return mp.access === 'warn';
      case 'expired': return mp.access === 'denied' && !!mp.end_date && mp.days_left != null && mp.days_left < 0;
      case 'member': return a.member_id === m.id;
      default: return false;
    }
  };

  function buildInbox(m) {
    const now = Date.now();
    const mp = memberPublic(m);
    const pr = getPrefs(m.id);
    const reads = new Map(q.all('SELECT ref,dismissed FROM inbox_reads WHERE member_id=?', m.id).map(r => [r.ref, r]));
    const items = [];
    const push = (ref, o) => { const r = reads.get(ref); items.push({ ref, read: !!r, dismissed: !!(r && r.dismissed), ...o }); };

    for (const a of q.all('SELECT * FROM announcements WHERE archived=0 ORDER BY id DESC LIMIT 200')) {
      if (!inWindow(a, now) || !matchesAudience(a, m, mp)) continue;
      if (KINDS[a.kind] === 'promos' && !pr.show_promos) continue;
      push('a:' + a.id, {
        source: 'gym', kind: a.kind, title: a.title, body: a.body || '', priority: a.priority, pinned: !!a.pinned,
        image_url: a.image_url || null,
        cta: a.cta_label && a.cta_url ? { label: a.cta_label, url: a.cta_url } : null, created_at: asIso(a.starts_at || a.created_at)
      });
    }

    if (pr.show_reminders) {
      const plan = mp.plan_name ? `Plan ${mp.plan_name} · ` : '';
      if (mp.access === 'warn' && mp.days_left != null && mp.days_left >= 0 && mp.end_date) {
        const when = mp.days_left === 0 ? 'hoy' : mp.days_left === 1 ? 'mañana' : `en ${mp.days_left} días`;
        push('s:exp:' + mp.end_date, { source: 'system', kind: 'recordatorio', title: `Tu membresía vence ${when}`, body: `${plan}vence el ${fmtDMY(mp.end_date)}. Puedes renovar en recepción cuando gustes.`, priority: 'info', pinned: false, cta: null, created_at: new Date(now).toISOString() });
      } else if (mp.access === 'denied' && mp.end_date && mp.days_left != null && mp.days_left < 0 && mp.days_left >= -30 && !mp.frozen) {
        push('s:expd:' + mp.end_date, { source: 'system', kind: 'recordatorio', title: 'Tu membresía venció', body: `${plan}venció el ${fmtDMY(mp.end_date)}. Renueva en recepción para volver a ingresar.`, priority: 'info', pinned: false, cta: null, created_at: new Date(now).toISOString() });
      }
      if (mp.scheduled && mp.start_date) {
        push('s:start:' + mp.start_date, { source: 'system', kind: 'recordatorio', title: `Tu membresía inicia el ${fmtDMY(mp.start_date)}`, body: `${plan}ya está pagada; podrás ingresar desde esa fecha.`, priority: 'info', pinned: false, cta: null, created_at: new Date(now).toISOString() });
      }
      if (mp.frozen) {
        push('s:frozen:' + (m.frozen_from || ''), { source: 'system', kind: 'recordatorio', title: 'Tu membresía está congelada', body: 'Al reanudarla se extiende tu vencimiento por los días congelados.', priority: 'info', pinned: false, cta: null, created_at: new Date(now).toISOString() });
      }
      for (const p of q.all("SELECT id,concept,amount,method,created_at,receipt_no FROM payments WHERE member_id=? AND voided=0 AND created_at > datetime('now','-30 days') ORDER BY id DESC LIMIT 10", m.id)) {
        push('s:pay:' + p.id, {
          source: 'system', kind: 'pago',
          title: `Boleta digital emitida (${p.receipt_no || ('BOL-' + p.id)})`,
          body: `${p.concept} · S/ ${(+p.amount).toFixed(2).replace(/\.00$/, '')} · Método: ${p.method.toUpperCase()}`,
          priority: 'info', pinned: false,
          receipt_id: p.id,
          cta: { label: '🧾 Ver Boleta Digital', url: `#receipt:${p.id}` },
          created_at: asIso(p.created_at)
        });
      }
    }

    items.sort((a, b) => (b.pinned - a.pinned) || String(b.created_at).localeCompare(String(a.created_at)));
    const list = items.slice(0, 60);
    const banner = list.find(i => i.source === 'gym' && i.priority === 'importante' && ['mantenimiento', 'cierre'].includes(i.kind) && !i.dismissed) || null;
    return { items: list, unread: list.filter(i => !i.read).length, banner };
  }

  api.get('/member/inbox', memberAuth, wrap((req, res) => res.json(buildInbox(req.member))));
  api.get('/member/inbox/summary', memberAuth, wrap((req, res) => {
    const b = buildInbox(req.member);
    res.json({ unread: b.unread, banner: b.banner, now: Date.now() });
  }));
  const markRead = (mid, refs, dismiss) => q.tx(() => {
    for (const ref of refs) {
      if (dismiss) q.run('INSERT INTO inbox_reads(member_id,ref,dismissed) VALUES(?,?,1) ON CONFLICT(member_id,ref) DO UPDATE SET dismissed=1', mid, ref);
      else q.run('INSERT INTO inbox_reads(member_id,ref) VALUES(?,?) ON CONFLICT(member_id,ref) DO NOTHING', mid, ref);
    }
  });
  api.post('/member/inbox/read', memberAuth, wrap((req, res) => {
    const b = req.body || {};
    const refs = b.all ? buildInbox(req.member).items.map(i => i.ref) : (Array.isArray(b.refs) ? b.refs : []).map(r => clip(r, 64)).filter(Boolean).slice(0, 100);
    markRead(req.member.id, refs, false);
    res.json({ ok: true });
  }));
  api.post('/member/inbox/dismiss', memberAuth, wrap((req, res) => {
    const ref = clip((req.body || {}).ref, 64); if (!ref) return bad(res, 'Aviso inválido');
    markRead(req.member.id, [ref], true);
    res.json({ ok: true });
  }));

  // ---------------- Web Push (opt-in, gratuito, sin acoso) ----------------
  let vapid = null;
  if (webpush) {
    const f = path.join(DATA_DIR, 'vapid.json');
    try { vapid = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { }
    if (!vapid || !vapid.publicKey || !vapid.privateKey) {
      try { vapid = webpush.generateVAPIDKeys(); fs.writeFileSync(f, JSON.stringify(vapid)); } catch (e) { console.error('VAPID:', e.message); vapid = null; }
    }
    if (vapid) { try { webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@rdfitness.club', vapid.publicKey, vapid.privateKey); } catch (e) { console.error('VAPID:', e.message); vapid = null; } }
  }
  const pushEnabled = () => !!(webpush && vapid);

  api.get('/member/push/config', memberAuth, wrap((req, res) => res.json({ enabled: pushEnabled(), publicKey: pushEnabled() ? vapid.publicKey : null })));
  api.post('/member/push/subscribe', memberAuth, wrap((req, res) => {
    if (!pushEnabled()) return bad(res, 'Las notificaciones no están disponibles en este momento', 503);
    const sub = (req.body || {}).subscription || {};
    const endpoint = clip(sub.endpoint, 600), p256dh = clip(sub.keys?.p256dh, 200), auth = clip(sub.keys?.auth, 100);
    if (!/^https:\/\//.test(endpoint) || !p256dh || !auth) return bad(res, 'Suscripción inválida');
    q.run(`INSERT INTO push_subs(member_id,endpoint,p256dh,auth,device_id) VALUES(?,?,?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET member_id=excluded.member_id, p256dh=excluded.p256dh, auth=excluded.auth, device_id=excluded.device_id`,
      req.member.id, endpoint, p256dh, auth, clip((req.body || {}).device_id, 64) || null);
    res.json({ ok: true, prefs: prefsOut(req.member.id) });
  }));
  api.post('/member/push/unsubscribe', memberAuth, wrap((req, res) => {
    const endpoint = clip((req.body || {}).endpoint, 600);
    if (endpoint) q.run('DELETE FROM push_subs WHERE member_id=? AND endpoint=?', req.member.id, endpoint);
    else q.run('DELETE FROM push_subs WHERE member_id=?', req.member.id);
    res.json({ ok: true, prefs: prefsOut(req.member.id) });
  }));

  const limaHour = () => +new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', hour12: false }).format(new Date());
  // Envía a los socios indicados respetando sus preferencias de horario y alerta (sonido, vibración, silencioso)
  async function sendPush(memberIds, payload, category) {
    if (!pushEnabled()) return { sent: 0, skipped: memberIds.length };
    const hour = limaHour();
    const quiet = hour >= 21 || hour < 7;
    let sent = 0, skipped = 0;
    for (const mid of memberIds) {
      const pr = getPrefs(mid);
      const wants = category === 'critical' ? pr.push_critical : category === 'promos' ? pr.push_promos : pr.push_news;
      const recent = pr.last_push_at && Date.now() - new Date(asIso(pr.last_push_at)).getTime() < 6 * 3600e3;
      if (!wants || (category !== 'critical' && (quiet || recent))) { skipped++; continue; }
      const subs = q.all('SELECT * FROM push_subs WHERE member_id=?', mid);
      let ok = false;
      const alertMode = pr.alert_mode || 'sound';
      const isSilent = alertMode === 'silent';
      const vibratePattern = alertMode === 'silent' ? [] : [200, 100, 200];
      const memberPayload = {
        ...payload,
        silent: isSilent,
        vibrate: vibratePattern,
        alert_mode: alertMode
      };
      for (const s of subs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(memberPayload), { TTL: 6 * 3600, urgency: category === 'critical' ? 'high' : 'low' });
          ok = true;
        } catch (e) {
          if (e && (e.statusCode === 404 || e.statusCode === 410)) q.run('DELETE FROM push_subs WHERE id=?', s.id);
        }
      }
      if (ok) { sent++; if (category !== 'critical') q.run("UPDATE member_prefs SET last_push_at=datetime('now') WHERE member_id=?", mid); } else skipped++;
    }
    return { sent, skipped };
  }
  api.post('/member/push/test', memberAuth, wrap(async (req, res) => {
    if (!q.get('SELECT 1 x FROM push_subs WHERE member_id=?', req.member.id)) return bad(res, 'Activa los avisos en este dispositivo primero');
    const pr = getPrefs(req.member.id);
    const alertMode = pr.alert_mode || 'sound';
    const r = await sendPush([req.member.id], {
      title: 'RD Fitness Club',
      body: 'Avisos configurados con éxito (' + (alertMode === 'sound' ? 'Sonido y vibración' : alertMode === 'vibrate' ? 'Solo vibración' : 'Silencioso') + ') ✔',
      url: '/',
      tag: 'test'
    }, 'critical');
    res.json({ ok: true, ...r });
  }));

  function audienceMembers(a) {
    if (a.audience === 'member') return a.member_id ? [a.member_id] : [];
    const rows = q.all("SELECT * FROM members WHERE status<>'inactive' AND id IN (SELECT DISTINCT member_id FROM push_subs)");
    return rows.filter(m => matchesAudience(a, m, memberPublic(m))).map(m => m.id);
  }
  async function dispatchPush(a) {
    q.run('UPDATE announcements SET push_sent=1 WHERE id=?', a.id);
    const ids = audienceMembers(a);
    if (!ids.length) return { sent: 0, skipped: 0 };
    return sendPush(ids, {
      title: a.title,
      body: String(a.body || '').slice(0, 140),
      image: a.image_url || null,
      url: '/?inbox=1',
      tag: 'a' + a.id
    }, KINDS[a.kind] || 'news');
  }
  // Avisos programados con push: se envían cuando llega su hora de inicio
  const runDue = () => {
    try {
      const now = Date.now();
      for (const a of q.all('SELECT * FROM announcements WHERE archived=0 AND push=1 AND push_sent=0')) {
        if (!a.starts_at || new Date(a.starts_at).getTime() <= now) { if (!a.ends_at || new Date(a.ends_at).getTime() >= now) dispatchPush(a).catch(() => { }); else q.run('UPDATE announcements SET push_sent=1 WHERE id=?', a.id); }
      }
    } catch (e) { console.error('Avisos programados:', e.message); }
  };
  setInterval(runDue, 60000).unref();
  // Limpieza diaria: sesiones de socio inactivas > 1 año
  setInterval(() => { try { q.run("DELETE FROM sessions WHERE kind='member' AND COALESCE(last_seen,created_at) < datetime('now','-400 days')"); } catch { } }, 24 * 3600e3).unref();

  // ---------------- Gestión de avisos (personal) ----------------
  function saveAnnouncementImage(raw) {
    if (!raw) return null;
    const str = String(raw).trim();
    if (!str) return null;
    if (/^https?:\/\//i.test(str) || str.startsWith('/photos/')) return str;
    const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/.exec(str);
    if (!match) return null;
    try {
      const buf = Buffer.from(match[2], 'base64');
      if (buf.length > 3 * 1024 * 1024) return null;
      const ext = match[1] === 'png' ? 'png' : match[1] === 'webp' ? 'webp' : 'jpg';
      const file = `ann-${Date.now()}-${L.randomKey().slice(0, 6)}.${ext}`;
      const photosDir = path.join(DATA_DIR, 'photos');
      if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });
      fs.writeFileSync(path.join(photosDir, file), buf);
      return `/photos/${file}`;
    } catch (e) {
      console.error('Error guardando imagen de aviso:', e.message);
      return null;
    }
  }

  const isoOrNull = v => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? undefined : d.toISOString(); };
  function parseAnn(b, res) {
    const kind = String(b.kind || 'aviso');
    if (!KINDS[kind]) { bad(res, 'Tipo de aviso inválido'); return null; }
    const title = clip(b.title, 80); if (!title) { bad(res, 'Escribe un título'); return null; }
    const audience = AUDIENCES.includes(b.audience) ? b.audience : 'all';
    const member_id = audience === 'member' ? num(b.member_id) : null;
    if (audience === 'member' && !q.get('SELECT 1 x FROM members WHERE id=?', member_id)) { bad(res, 'Elige un socio válido'); return null; }
    const starts_at = isoOrNull(b.starts_at), ends_at = isoOrNull(b.ends_at);
    if (starts_at === undefined || ends_at === undefined) { bad(res, 'Fecha inválida'); return null; }
    if (starts_at && ends_at && ends_at < starts_at) { bad(res, 'La fecha de fin debe ser posterior al inicio'); return null; }
    const cta_label = clip(b.cta_label, 30), cta_url = clip(b.cta_url, 300);
    if (cta_url && !/^(\/|https:\/\/|tel:|mailto:)/i.test(cta_url)) { bad(res, 'El enlace debe empezar con https:// o /'); return null; }
    const image_url = saveAnnouncementImage(b.image_url) || (b.image_url && /^https?:\/\//i.test(b.image_url) ? String(b.image_url).trim() : null);
    return {
      kind, title, body: clip(b.body, 600), audience, member_id, priority: b.priority === 'importante' ? 'importante' : 'info',
      pinned: b.pinned ? 1 : 0, starts_at, ends_at, cta_label: cta_url ? cta_label : '', cta_url,
      image_url, push: b.push ? 1 : 0
    };
  }
  const annStatus = (a, now) => a.archived ? 'archivado' : a.starts_at && new Date(a.starts_at).getTime() > now ? 'programado' : a.ends_at && new Date(a.ends_at).getTime() < now ? 'finalizado' : 'activo';

  api.get('/announcements', staff('admin', 'recepcion'), wrap((req, res) => {
    const now = Date.now();
    const rows = q.all(`SELECT a.*, (SELECT COUNT(*) FROM inbox_reads r WHERE r.ref='a:'||a.id) AS reads,
      (SELECT name FROM users u WHERE u.id=a.created_by) AS author FROM announcements a ${req.query.all ? '' : 'WHERE a.archived=0'} ORDER BY a.id DESC LIMIT 200`);
    res.json(rows.map(a => ({ ...a, status: annStatus(a, now), starts_at: a.starts_at, ends_at: a.ends_at, created_at: asIso(a.created_at) })));
  }));
  api.post('/announcements', staff('admin', 'recepcion'), wrap(async (req, res) => {
    const d = parseAnn(req.body || {}, res); if (!d) return;
    const r = q.run(`INSERT INTO announcements(kind,title,body,audience,member_id,priority,pinned,starts_at,ends_at,cta_label,cta_url,image_url,push,created_by)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, d.kind, d.title, d.body, d.audience, d.member_id, d.priority, d.pinned, d.starts_at, d.ends_at, d.cta_label, d.cta_url, d.image_url, d.push, req.user.id);
    const id = Number(r.lastInsertRowid);
    audit(req.user.id, 'announcement.create', { id, kind: d.kind, title: d.title, audience: d.audience });
    let push = null;
    const a = q.get('SELECT * FROM announcements WHERE id=?', id);
    if (d.push && (!d.starts_at || new Date(d.starts_at).getTime() <= Date.now())) push = await dispatchPush(a);
    res.json({ ok: true, id, push, push_enabled: pushEnabled() });
  }));
  api.put('/announcements/:id', staff('admin', 'recepcion'), wrap((req, res) => {
    const id = num(req.params.id);
    const cur = q.get('SELECT * FROM announcements WHERE id=?', id); if (!cur) return bad(res, 'Aviso no encontrado', 404);
    const d = parseAnn(req.body || {}, res); if (!d) return;
    q.run(`UPDATE announcements SET kind=?,title=?,body=?,audience=?,member_id=?,priority=?,pinned=?,starts_at=?,ends_at=?,cta_label=?,cta_url=?,image_url=?,push=? WHERE id=?`,
      d.kind, d.title, d.body, d.audience, d.member_id, d.priority, d.pinned, d.starts_at, d.ends_at, d.cta_label, d.cta_url, d.image_url, cur.push_sent ? cur.push : d.push, id);
    audit(req.user.id, 'announcement.update', { id });
    res.json({ ok: true });
  }));
  api.delete('/announcements/:id', staff('admin', 'recepcion'), wrap((req, res) => {
    const id = num(req.params.id);
    q.run('UPDATE announcements SET archived=1 WHERE id=?', id);
    audit(req.user.id, 'announcement.archive', { id });
    res.json({ ok: true });
  }));
};
