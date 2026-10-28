// RD Fitness Club - Bóveda Persistente en la Nube (Cloud Vault)
// Permite persistencia permanente en planes gratuitos como Render Free (disco efímero):
// cada cambio se sube a la nube y, al reiniciar/redesplegar, el servidor recupera todo automáticamente.

const crypto = require('crypto');

class CloudVault {
  static getProvider() {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) return 'upstash';
    if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY)) return 'supabase';
    if (process.env.CLOUD_VAULT_URL) return 'custom';
    return null;
  }

  static isConfigured() {
    return !!CloudVault.getProvider();
  }

  static vaultKey() {
    return CloudVault.cleanStr(process.env.VAULT_KEY) || 'rd_fitness_vault';
  }

  static cleanStr(s) {
    if (!s) return '';
    return String(s).trim().replace(/^["']|["']$/g, '').trim();
  }

  static cleanToken(s) {
    if (!s) return '';
    let t = String(s).trim().replace(/^["']|["']$/g, '').trim();
    t = t.replace(/^UPSTASH_REDIS_REST_TOKEN\s*=\s*/i, '');
    t = t.replace(/^Bearer\s+/i, '');
    return t.trim().replace(/^["']|["']$/g, '').trim();
  }

  static cleanUrl(s) {
    if (!s) return '';
    let u = String(s).trim().replace(/^["']|["']$/g, '').trim();
    u = u.replace(/^UPSTASH_REDIS_REST_URL\s*=\s*/i, '');
    u = u.trim().replace(/^["']|["']$/g, '').trim();
    return u.replace(/\/+$/, '');
  }

  static getUpstashConfig() {
    const rawUrl = process.env.UPSTASH_REDIS_REST_URL;
    const rawToken = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!rawUrl || !rawToken) return null;
    return { url: CloudVault.cleanUrl(rawUrl), token: CloudVault.cleanToken(rawToken) };
  }

  static getSupabaseConfig() {
    const rawUrl = process.env.SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
    if (!rawUrl || !rawKey) return null;
    return { url: CloudVault.cleanUrl(rawUrl), key: CloudVault.cleanToken(rawKey) };
  }

  static async push(vaultData) {
    const provider = CloudVault.getProvider();
    if (!provider) return { ok: false, error: 'Sin proveedor configurado' };

    const payload = JSON.stringify(vaultData);

    if (provider === 'upstash') {
      const cfg = CloudVault.getUpstashConfig();
      if (!cfg || !cfg.url || !cfg.token) throw new Error('Credenciales de Upstash incompletas');
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['SET', CloudVault.vaultKey(), payload]),
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Upstash SET falló (${res.status}): ${txt}`);
      }
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'upstash', synced_at: CloudVault.lastSync };
    }

    if (provider === 'supabase') {
      const cfg = CloudVault.getSupabaseConfig();
      if (!cfg || !cfg.url || !cfg.key) throw new Error('Credenciales de Supabase incompletas');
      const res = await fetch(`${cfg.url}/rest/v1/rd_vault?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': cfg.key,
          'Authorization': `Bearer ${cfg.key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({ id: 1, data: vaultData, updated_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Supabase falló (${res.status}): ${txt}`);
      }
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'supabase', synced_at: CloudVault.lastSync };
    }

    if (provider === 'custom') {
      const url = CloudVault.cleanStr(process.env.CLOUD_VAULT_URL);
      const key = CloudVault.cleanStr(process.env.CLOUD_VAULT_KEY || '');
      const headers = { 'Content-Type': 'application/json' };
      if (key) headers['Authorization'] = `Bearer ${key}`;
      const res = await fetch(url, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`Custom Cloud Vault falló: ${res.status}`);
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'custom', synced_at: CloudVault.lastSync };
    }

    return { ok: false, error: 'Proveedor desconocido' };
  }

  static _validShape(raw) {
    return !!(raw && (Array.isArray(raw.members) || Array.isArray(raw.users)));
  }

  static async pull() {
    const provider = CloudVault.getProvider();
    if (!provider) return null;

    if (provider === 'upstash') {
      const cfg = CloudVault.getUpstashConfig();
      if (!cfg || !cfg.url || !cfg.token) throw new Error('Credenciales de Upstash incompletas');
      const res = await fetch(cfg.url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(['GET', CloudVault.vaultKey()]),
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Upstash GET falló (${res.status}): ${txt}`);
      }
      const body = await res.json();
      if (!body || body.result === undefined || body.result === null) return null;
      let raw = body.result;
      for (let i = 0; i < 2 && typeof raw === 'string'; i++) {
        try { raw = JSON.parse(raw); } catch { throw new Error('La bóveda en la nube está corrupta (JSON inválido)'); }
      }
      if (!CloudVault._validShape(raw)) throw new Error('La bóveda en la nube tiene un formato inesperado');
      CloudVault.lastSync = raw.exported_at || new Date().toISOString();
      return raw;
    }

    if (provider === 'supabase') {
      const cfg = CloudVault.getSupabaseConfig();
      if (!cfg || !cfg.url || !cfg.key) throw new Error('Credenciales de Supabase incompletas');
      const res = await fetch(`${cfg.url}/rest/v1/rd_vault?id=eq.1&select=data,updated_at`, {
        method: 'GET',
        headers: { 'apikey': cfg.key, 'Authorization': `Bearer ${cfg.key}` },
        signal: AbortSignal.timeout(20000)
      });
      if (!res.ok) throw new Error(`Supabase GET falló (${res.status})`);
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.data) {
        if (!CloudVault._validShape(rows[0].data)) throw new Error('La bóveda en la nube tiene un formato inesperado');
        CloudVault.lastSync = rows[0].updated_at;
        return rows[0].data;
      }
      return null;
    }

    if (provider === 'custom') {
      const url = CloudVault.cleanStr(process.env.CLOUD_VAULT_URL);
      const key = CloudVault.cleanStr(process.env.CLOUD_VAULT_KEY || '');
      const res = await fetch(url, {
        method: 'GET',
        headers: key ? { 'Authorization': `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(20000)
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`Custom Cloud Vault GET falló (${res.status})`);
      const data = await res.json();
      if (!data) return null;
      if (!CloudVault._validShape(data)) throw new Error('La bóveda en la nube tiene un formato inesperado');
      CloudVault.lastSync = data.exported_at || new Date().toISOString();
      return data;
    }

    return null;
  }

  static _sig(data) {
    const { exported_at, ...rest } = data || {};
    return crypto.createHash('sha1').update(JSON.stringify(rest)).digest('hex');
  }

  static schedule(getData, delayMs = 1500) {
    CloudVault._getData = getData;
    if (CloudVault._timer) return;
    CloudVault._timer = setTimeout(() => { CloudVault._timer = null; CloudVault._drain(); }, delayMs);
    if (CloudVault._timer.unref) CloudVault._timer.unref();
  }

  static async _drain() {
    if (CloudVault._busy) { CloudVault._again = true; return; }
    CloudVault._busy = true;
    try {
      do {
        CloudVault._again = false;
        const data = CloudVault._getData && CloudVault._getData();
        if (!data) break;
        const sig = CloudVault._sig(data);
        if (sig === CloudVault._lastSig) continue;
        await CloudVault.push(data);
        CloudVault._lastSig = sig;
      } while (CloudVault._again);
      CloudVault.lastError = null;
    } catch (e) {
      CloudVault.lastError = e.message;
      console.warn('[CLOUD VAULT] Sync error (se reintentará en 10 s):', e.message);
      if (!CloudVault._timer) {
        CloudVault._timer = setTimeout(() => { CloudVault._timer = null; CloudVault._drain(); }, 10000);
        if (CloudVault._timer.unref) CloudVault._timer.unref();
      }
    } finally {
      CloudVault._busy = false;
    }
  }

  static async flush(timeoutMs = 8000) {
    if (!CloudVault.isConfigured() || !CloudVault._getData) return;
    if (CloudVault._timer) { clearTimeout(CloudVault._timer); CloudVault._timer = null; }
    const started = Date.now();
    await Promise.race([
      (async () => {
        await CloudVault._drain();
        while (CloudVault._busy && Date.now() - started < timeoutMs) await new Promise(r => setTimeout(r, 100));
      })(),
      new Promise(r => setTimeout(r, timeoutMs))
    ]);
  }

  static status() {
    const provider = CloudVault.getProvider();
    let diag = {};
    if (provider === 'upstash') {
      const cfg = CloudVault.getUpstashConfig();
      diag = {
        url: cfg?.url || null,
        key: CloudVault.vaultKey(),
        token_len: cfg?.token?.length || 0
      };
    }
    return {
      configured: !!provider,
      provider: provider || 'ninguno (disco local)',
      last_sync: CloudVault.lastSync || null,
      last_error: CloudVault.lastError || null,
      ...diag
    };
  }
}

CloudVault.lastSync = null;
CloudVault.lastError = null;
CloudVault._timer = null;
CloudVault._busy = false;
CloudVault._again = false;
CloudVault._lastSig = null;
CloudVault._getData = null;

module.exports = CloudVault;
