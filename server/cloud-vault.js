// RD Fitness Club - Bóveda Persistente en la Nube (Cloud Vault)
// Permite sincronización permanente en la nube para planes gratuitos como Render Free
// sin requerir tarjetas de crédito ni causar pérdida de datos al apagar/reiniciar el contenedor.

const https = require('https');

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

  // Enviar snapshot completo a la nube
  static async push(vaultData) {
    const provider = CloudVault.getProvider();
    if (!provider) return { ok: false, error: 'Sin proveedor configurado' };

    const payload = JSON.stringify(vaultData);

    if (provider === 'upstash') {
      const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', 'rd_fitness_vault', payload]),
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Upstash SET falló (${res.status}): ${txt}`);
      }
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'upstash', synced_at: CloudVault.lastSync };
    }

    if (provider === 'supabase') {
      const url = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
      const res = await fetch(`${url}/rest/v1/rd_vault?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 1,
          data: vaultData,
          updated_at: new Date().toISOString()
        }),
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Supabase falló (${res.status}): ${txt}`);
      }
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'supabase', synced_at: CloudVault.lastSync };
    }

    if (provider === 'custom') {
      const url = process.env.CLOUD_VAULT_URL;
      const key = process.env.CLOUD_VAULT_KEY || '';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': key ? `Bearer ${key}` : undefined,
          'Content-Type': 'application/json'
        },
        body: payload,
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`Custom Cloud Vault falló: ${res.status}`);
      CloudVault.lastSync = new Date().toISOString();
      return { ok: true, provider: 'custom', synced_at: CloudVault.lastSync };
    }

    return { ok: false, error: 'Proveedor desconocido' };
  }

  // Descargar el último snapshot desde la nube al iniciar el servidor
  static async pull() {
    const provider = CloudVault.getProvider();
    if (!provider) return null;

    if (provider === 'upstash') {
      const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, '');
      const token = process.env.UPSTASH_REDIS_REST_TOKEN;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', 'rd_fitness_vault']),
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) return null;
      const body = await res.json();
      if (!body || body.result === undefined || body.result === null) return null;
      let raw = body.result;
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { return null; }
      }
      if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { return null; }
      }
      if (raw && Array.isArray(raw.members)) {
        CloudVault.lastSync = raw.exported_at || new Date().toISOString();
        return raw;
      }
      return null;
    }

    if (provider === 'supabase') {
      const url = process.env.SUPABASE_URL.replace(/\/+$/, '');
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
      const res = await fetch(`${url}/rest/v1/rd_vault?id=eq.1&select=data,updated_at`, {
        method: 'GET',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const rows = await res.json();
      if (Array.isArray(rows) && rows[0]?.data) {
        CloudVault.lastSync = rows[0].updated_at;
        return rows[0].data;
      }
      return null;
    }

    if (provider === 'custom') {
      const url = process.env.CLOUD_VAULT_URL;
      const key = process.env.CLOUD_VAULT_KEY || '';
      const res = await fetch(url, {
        method: 'GET',
        headers: key ? { 'Authorization': `Bearer ${key}` } : {},
        signal: AbortSignal.timeout(10000)
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (data && Array.isArray(data.members)) {
        CloudVault.lastSync = data.exported_at || new Date().toISOString();
        return data;
      }
      return null;
    }

    return null;
  }

  static status() {
    const provider = CloudVault.getProvider();
    return {
      configured: !!provider,
      provider: provider || 'ninguno (disco local)',
      last_sync: CloudVault.lastSync || null
    };
  }
}

CloudVault.lastSync = null;

module.exports = CloudVault;
