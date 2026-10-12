// Utilidades compartidas: fechas (hora de Perú), firmas QR, estado de membresía.
const crypto = require('crypto');

const TZ = 'America/Lima'; // UTC-5, sin horario de verano

const fmtDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const fmtHour = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false });

const limaDay = (d = new Date()) => fmtDay.format(d);               // YYYY-MM-DD
const limaHour = (d = new Date()) => parseInt(fmtHour.format(d), 10) % 24;

const toUTC = s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = t => new Date(t).toISOString().slice(0, 10);
const addDays = (s, n) => fromUTC(toUTC(s) + n * 86400000);
const diffDays = (a, b) => Math.round((toUTC(a) - toUTC(b)) / 86400000); // a - b

function addMonths(s, n) {
  const [y, m, d] = s.split('-').map(Number);
  const tm = m - 1 + n;
  const ty = y + Math.floor(tm / 12);
  const mm = ((tm % 12) + 12) % 12;
  const last = new Date(Date.UTC(ty, mm + 1, 0)).getUTCDate();
  return fromUTC(Date.UTC(ty, mm, Math.min(d, last)));
}

// Fin inclusive de una membresía que empieza en `start` y dura `months` meses (o `days` días).
function membershipEnd(start, months, days) {
  if (days && !months) return addDays(start, days - 1);
  return addDays(addMonths(start, months), -1);
}

// ---------- QR firmado ----------
// Física:  RD1.<codigo>.P<version>.<firma>   (fija; se anula subiendo la versión)
// Digital: RD1.<codigo>.D<ventana60s>.<firma> (rota cada 60 s, se acepta ±1 ventana)
const sign = (key, code, kind, n) =>
  crypto.createHmac('sha256', key).update(`${code}|${kind}${n}`).digest('hex').slice(0, 12);

const physicalPayload = (m) => `RD1.${m.code}.P${m.phys_ver}.${sign(m.qr_key, m.code, 'P', m.phys_ver)}`;
const digitalPayload = (m, nowMs = Date.now()) => {
  const n = Math.floor(nowMs / 60000);
  return `RD1.${m.code}.D${n}.${sign(m.qr_key, m.code, 'D', n)}`;
};

// ---------- Estado de acceso ----------
// m: {status, frozen, end, start}  → {level:'ok'|'warn'|'denied', reason, daysLeft, scheduled, startsIn}
function accessState(m, today, cfg = {}) {
  const warnDays = cfg.warn_days ?? 5;
  const grace = cfg.grace_days ?? 0;
  if (m.status === 'blocked') return { level: 'denied', reason: 'Socio bloqueado', daysLeft: null };
  if (m.status === 'inactive') return { level: 'denied', reason: 'Socio dado de baja', daysLeft: null };
  if (m.frozen) return { level: 'denied', reason: 'Membresía congelada', daysLeft: null };
  if (!m.end) return { level: 'denied', reason: 'Sin membresía', daysLeft: null };

  // Membresía pagada pero con inicio diferido / programado
  if (m.start && m.start > today) {
    const daysToStart = diffDays(m.start, today);
    return {
      level: 'denied',
      reason: `Inicia el ${m.start} (en ${daysToStart} día${daysToStart === 1 ? '' : 's'})`,
      daysLeft: diffDays(m.end, today),
      scheduled: true,
      startsIn: daysToStart
    };
  }

  const left = diffDays(m.end, today);
  if (left >= 0) {
    if (left <= warnDays) return { level: 'warn', reason: left === 0 ? 'Vence HOY' : `Vence en ${left} día${left === 1 ? '' : 's'}`, daysLeft: left };
    return { level: 'ok', reason: 'Membresía vigente', daysLeft: left };
  }
  if (-left <= grace) return { level: 'warn', reason: `Período de gracia (venció hace ${-left} día${-left === 1 ? '' : 's'})`, daysLeft: left };
  return { level: 'denied', reason: `Vencida hace ${-left} día${-left === 1 ? '' : 's'}`, daysLeft: left };
}

// ---------- Generador de Payload Interoperable Yape / Plin (BCRP / EMVCo MPM) ----------
function tlv(id, value) {
  const v = String(value ?? '');
  const len = String(v.length).padStart(2, '0');
  return `${id}${len}${v}`;
}

function crc16Ccitt(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= (str.charCodeAt(i) << 8);
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildYapeQrPayload({ phone = '982404043', amount = 0, merchant = 'RD FITNESS CLUB', city = 'CHIVAY', reference = '' } = {}) {
  const cleanPhone = String(phone).replace(/\D/g, '');
  const sub26 = tlv('00', 'pe.bcrp.qr') + tlv('01', cleanPhone);
  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('01', amount > 0 ? '12' : '11');
  payload += tlv('26', sub26);
  payload += tlv('52', '7997');
  payload += tlv('53', '604');
  if (amount > 0) {
    payload += tlv('54', Number(amount).toFixed(2));
  }
  payload += tlv('58', 'PE');
  payload += tlv('59', merchant.slice(0, 25).toUpperCase());
  payload += tlv('60', city.slice(0, 15).toUpperCase());
  if (reference) {
    const sub62 = tlv('01', reference.slice(0, 20));
    payload += tlv('62', sub62);
  }
  payload += '6304';
  return payload + crc16Ccitt(payload);
}

const dailySign = (code, day, secret = 'rd-daily-secret-2026') =>
  crypto.createHmac('sha256', secret).update(`${code}|${day}`).digest('hex').slice(0, 12);
const dailyPayload = (code, day) => `RD1.DAY.${code}.${day}.${dailySign(code, day)}`;

const randomKey = () => crypto.randomBytes(16).toString('hex');
const randomToken = () => crypto.randomBytes(24).toString('hex');

module.exports = {
  TZ, limaDay, limaHour, addDays, addMonths, diffDays, membershipEnd,
  sign, physicalPayload, digitalPayload, accessState, randomKey, randomToken,
  dailySign, dailyPayload, buildYapeQrPayload
};
