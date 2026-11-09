/* Centro Omnicanal de Avisos, Publicidad Multimedia Web y Comunidad de WhatsApp (Panel Admin / Recepción) */
(function () {
  const RD = window.RD = window.RD || {};
  const { esc } = RD;

  const KINDS = [
    ['aviso', 'Aviso Oficial', 'Comunicado informativo o novedad del gimnasio'],
    ['mantenimiento', 'Mantenimiento', 'Aviso operativo o de mantenimiento de equipos'],
    ['cierre', 'Horario Especial / Feriado', 'Avisos de horarios especiales o feriados'],
    ['promo', 'Promoción / Campaña', 'Ofertas, descuentos o campañas comerciales'],
    ['evento', 'Evento / Guía / Reto', 'Actividades, guías en PDF, videos o eventos especiales']
  ];

  const AUDIENCES = [
    ['all', 'Todos los socios'],
    ['active', 'Solo socios con membresía activa'],
    ['expiring', 'Socios por vencer (en alerta)'],
    ['expired', 'Socios con membresía vencida'],
    ['member', 'Un socio específico']
  ];

  const KIND_ICON = { aviso: 'megaphone', mantenimiento: 'wrench', cierre: 'shield-alert', promo: 'tag', evento: 'party', pago: 'receipt', recordatorio: 'clock' };

  let currentTab = 'all';
  let listCache = [];
  let settingsCache = {};

  function parseChannels(chStr) {
    const s = String(chStr || 'app,web').toLowerCase();
    if (s === 'both') return ['app', 'web'];
    return s.split(',').map(x => x.trim()).filter(Boolean);
  }

  function hasCh(chStr, target) {
    return parseChannels(chStr).includes(target);
  }

  function formatWhatsAppPost(a) {
    const gymName = RD.pub?.gym_name || settingsCache.gym_name || 'GIMNASIO';
    const emoji = a.kind === 'promo' ? '🔥' : a.kind === 'evento' ? '🏆' : a.kind === 'cierre' ? '⏰' : '📢';
    let lines = [
      `${emoji} *${String(a.title || '').toUpperCase()}* — *${gymName}*`,
      ''
    ];
    if (a.body) lines.push(String(a.body).trim(), '');
    if (a.video_url) {
      const vUrl = a.video_url.startsWith('/') ? (location.origin + a.video_url) : a.video_url;
      lines.push(`🎬 *Video Multimedia:* ${vUrl}`);
    }
    if (a.doc_url) {
      const dUrl = a.doc_url.startsWith('/') ? (location.origin + a.doc_url) : a.doc_url;
      lines.push(`📄 *${a.doc_label || 'Documento / PDF'}:* ${dUrl}`);
    }
    if (a.image_url && !a.image_url.startsWith('data:')) {
      const iUrl = a.image_url.startsWith('/') ? (location.origin + a.image_url) : a.image_url;
      lines.push(`🖼️ *Afiche / Imagen:* ${iUrl}`);
    }
    if (a.cta_url) {
      const cUrl = a.cta_url.startsWith('/') ? (location.origin + a.cta_url) : a.cta_url;
      lines.push(`👉 *${a.cta_label || 'Más información'}:* ${cUrl}`);
    }
    lines.push('', `📲 _Portal & App Oficial:_ ${location.origin}`);
    return lines.join('\n');
  }

  async function shareToWhatsAppChannel(a) {
    const text = formatWhatsAppPost(a);
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    const waGroupUrl = settingsCache.whatsapp_community_url || RD.pub?.whatsapp_community_url || '';

    const d = RD.openModal('💬 Publicación Entrelazada con WhatsApp del Gimnasio', `
      <div class="card flat mb" style="border-left:3px solid #22c55e;background:rgba(34,197,94,0.08)">
        <div class="bold" style="color:#4ade80;margin-bottom:4px">✔ Publicación copiada y lista para el WhatsApp del Gimnasio</div>
        <div class="small muted">
          El comunicado con sus enlaces multimedia, documentos o promociones ya está formateado para enviarse directamente en el grupo o comunidad de WhatsApp del gimnasio.
        </div>
      </div>
      <label class="field">
        <span>Vista previa del comunicado para WhatsApp:</span>
        <textarea id="wa_preview_txt" rows="7" style="font-family:monospace;font-size:.85rem">${esc(text)}</textarea>
      </label>
      <div class="row wrap gap mt">
        <button type="button" class="btn ok" id="btn_copy_wa_again">📋 Copiar Texto</button>
        ${waGroupUrl ? `<a class="btn primary" href="${esc(waGroupUrl)}" target="_blank" rel="noopener">💬 Abrir Grupo / Comunidad de WhatsApp</a>` : ''}
        <a class="btn ghost" href="https://api.whatsapp.com/send?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">📲 Enviar en WhatsApp</a>
      </div>
    `);
    d.el.querySelector('#btn_copy_wa_again').onclick = async () => {
      const val = d.el.querySelector('#wa_preview_txt').value;
      try { await navigator.clipboard.writeText(val); RD.toast('Texto copiado listo para pegar en WhatsApp'); } catch {}
    };
    if (waGroupUrl) {
      RD.toast('Comunicado copiado · Listo para publicar en WhatsApp', 'ok');
    }
  }

  RD.views = RD.views || {};
  RD.views.announcements = {
    async render(view) {
      try { settingsCache = await RD.api.get('/settings'); } catch { settingsCache = {}; }

      view.innerHTML = `
        <div class="row between wrap gap mb">
          <div>
            <h2 style="margin:0;display:flex;align-items:center;gap:8px">${RD.icon('megaphone', '', 22)} Sistema Entrelazado: App de Socios, Página Web y WhatsApp</h2>
            <p class="muted small" style="margin:.2rem 0 0">
              Publica imágenes, videos, documentos PDF, enlaces y comunicados seleccionando un canal individual (<b>App</b>, <b>Web</b> o <b>WhatsApp</b>), combinados (<b>App + Web</b>, <b>App + WhatsApp</b>, <b>Web + WhatsApp</b>) o <b>General en los 3 canales</b>.
            </p>
          </div>
          <div class="row gap wrap">
            <button class="btn ghost" id="btnwaconfig">💬 Vincular WhatsApp del Gimnasio</button>
            <button class="btn primary" id="btnnewann">＋ Nueva Publicación</button>
          </div>
        </div>

        <!-- PANEL DE VINCULACIÓN CON EL WHATSAPP DEL GIMNASIO -->
        <div class="card mb hidden" id="wa_config_box" style="border:1px solid rgba(34,197,94,0.35);background:rgba(34,197,94,0.05)">
          <div class="row between wrap gap mb">
            <div>
              <h3 style="margin:0;color:#4ade80">💬 Integración con el Grupo / Comunidad de WhatsApp del Gimnasio</h3>
              <p class="small muted" style="margin:4px 0 0">
                Ingresa el enlace del grupo o comunidad de WhatsApp del gimnasio para entrelazarlo con el sistema y difundir las publicaciones directamente desde el Panel Admin.
              </p>
              <div class="tiny" style="margin-top:6px;padding:6px 10px;border-radius:6px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.35);color:var(--fg)">
                🔒 <b>Privacidad Operativa en Recepción:</b> El WhatsApp abierto en la computadora o laptop del gimnasio debe ser una <b>cuenta exclusiva del negocio (WhatsApp Business)</b> y nunca el WhatsApp personal del propietario, ya que el personal de recepción también utiliza el equipo para atender consultas de socios y difundir comunicados.
              </div>
            </div>
          </div>
          <form id="waconfigform" class="row wrap gap" style="align-items:flex-end">
            <label class="field grow" style="margin:0">
              <span>💬 Enlace del Grupo / Comunidad de WhatsApp del Gimnasio</span>
              <input name="whatsapp_community_url" placeholder="https://chat.whatsapp.com/..." value="${esc(settingsCache.whatsapp_community_url || '')}">
            </label>
            <div class="row gap">
              <button type="submit" class="btn ok">Guardar Enlace WhatsApp</button>
              ${settingsCache.whatsapp_community_url ? `<a href="${esc(settingsCache.whatsapp_community_url)}" target="_blank" rel="noopener" class="btn ghost">↗ Abrir WhatsApp</a>` : ''}
            </div>
          </form>
        </div>

        <div class="grid g4 gap mb" id="annkpis">
          <div class="stat"><div class="v" id="kpiactive">—</div><div class="l">Publicaciones activas</div></div>
          <div class="stat"><div class="v" id="kpibanner">—</div><div class="l">Destacados / Multimedia</div></div>
          <div class="stat"><div class="v" id="kpireads">—</div><div class="l">Lecturas en App</div></div>
          <div class="stat"><div class="v" id="kpipush">—</div><div class="l">Con aviso Push</div></div>
        </div>

        <div class="chips mb" id="anntabs">
          <span class="chip on" data-t="all">Todos</span>
          <span class="chip" data-t="app_ch">📱 En App Socios</span>
          <span class="chip" data-t="web_ch">🌐 En Sitio Web</span>
          <span class="chip" data-t="wa_ch">💬 En WhatsApp</span>
          <span class="chip" data-t="media">🎬 Con Video / PDF</span>
          <span class="chip" data-t="promos">🔥 Promociones</span>
          <span class="chip" data-t="archived">Archivados</span>
        </div>

        <div id="annlist"><div class="empty">Cargando publicaciones…</div></div>
      `;

      view.querySelector('#btnnewann').onclick = () => openAnnModal(null, () => loadData(view));
      const waBox = view.querySelector('#wa_config_box');
      view.querySelector('#btnwaconfig').onclick = () => waBox.classList.toggle('hidden');

      const waForm = view.querySelector('#waconfigform');
      if (waForm) {
        waForm.onsubmit = async e => {
          e.preventDefault();
          try {
            const body = {
              whatsapp_community_url: waForm.whatsapp_community_url.value.trim()
            };
            await RD.api.put('/settings', body);
            settingsCache = { ...settingsCache, ...body };
            RD.pub = { ...(RD.pub || {}), ...body };
            RD.toast('Enlace de WhatsApp del gimnasio guardado');
            waBox.classList.add('hidden');
          } catch (err) {
            RD.toast(err.message, 'err');
          }
        };
      }

      view.querySelectorAll('#anntabs .chip').forEach(c => {
        c.onclick = () => {
          view.querySelectorAll('#anntabs .chip').forEach(x => x.classList.remove('on'));
          c.classList.add('on');
          currentTab = c.dataset.t;
          renderList(view);
        };
      });

      await loadData(view);
    }
  };

  async function loadData(view) {
    try {
      const data = await RD.api.get('/announcements?all=1');
      listCache = data || [];
      updateKpis(view);
      renderList(view);
    } catch (e) {
      const el = view.querySelector('#annlist');
      if (el) el.innerHTML = `<div class="empty">${e.offline ? 'Sin conexión.' : esc(e.message)}</div>`;
    }
  }

  function updateKpis(view) {
    const active = listCache.filter(a => a.status === 'activo');
    const rich = active.filter(a => a.web_spot === 'lightbox' || a.video_url || a.doc_url || a.image_url);
    const reads = listCache.reduce((sum, a) => sum + (Number(a.reads) || 0), 0);
    const withPush = listCache.filter(a => a.push).length;

    const sA = view.querySelector('#kpiactive'); if (sA) sA.textContent = active.length;
    const sB = view.querySelector('#kpibanner'); if (sB) sB.textContent = rich.length;
    const sR = view.querySelector('#kpireads'); if (sR) sR.textContent = reads;
    const sP = view.querySelector('#kpipush'); if (sP) sP.textContent = withPush;
  }

  function renderChannelBadges(chStr) {
    const chs = parseChannels(chStr);
    return chs.map(c => {
      if (c === 'app') return '<span class="badge info">📱 App Socios</span>';
      if (c === 'web') return '<span class="badge warn">🌐 Sitio Web</span>';
      if (c === 'whatsapp') return '<span class="badge ok">💬 WhatsApp</span>';
      return '';
    }).join(' ');
  }

  function renderList(view) {
    const host = view.querySelector('#annlist');
    if (!host) return;

    let items = listCache.slice();
    if (currentTab === 'app_ch') items = items.filter(a => hasCh(a.channel, 'app') && !a.archived);
    else if (currentTab === 'web_ch') items = items.filter(a => hasCh(a.channel, 'web') && !a.archived);
    else if (currentTab === 'wa_ch') items = items.filter(a => hasCh(a.channel, 'whatsapp') && !a.archived);
    else if (currentTab === 'media') items = items.filter(a => (a.video_url || a.doc_url || a.image_url) && !a.archived);
    else if (currentTab === 'promos') items = items.filter(a => a.kind === 'promo' && !a.archived);
    else if (currentTab === 'archived') items = items.filter(a => a.archived);
    else items = items.filter(a => !a.archived);

    if (!items.length) {
      host.innerHTML = `<div class="empty">No hay publicaciones en esta vista.<br><span class="small muted">Haz clic en <b>＋ Nueva Publicación Multimedia</b> para crear una.</span></div>`;
      return;
    }

    const SPOT_BADGE = {
      normal: '<span class="badge ghost">📌 Web: Muro de Comunicados</span>',
      carousel: '<span class="badge info">🎠 Web: Vitrina / Slider Multimedia</span>',
      lightbox: '<span class="badge bad">✨ Web: Spotlight Destacado al Abrir</span>'
    };

    host.innerHTML = `
      <div class="list">
        ${items.map(a => {
          const kindLbl = (KINDS.find(k => k[0] === a.kind) || [])[1] || a.kind;
          const includesApp = hasCh(a.channel, 'app');
          const includesWeb = hasCh(a.channel, 'web');
          const audLbl = !includesApp ? 'Público General / Comunidad' : ((AUDIENCES.find(k => k[0] === a.audience) || [])[1] || a.audience);
          const spot = a.web_spot || 'normal';
          return `
          <div class="card mb item" style="padding:1rem;align-items:flex-start">
            <div style="margin-right:.6rem;color:var(--gold);display:flex;align-items:center">${RD.icon(KIND_ICON[a.kind] || 'megaphone', '', 26)}</div>
            <div class="grow" style="min-width:0">
              <div class="row between wrap gap">
                <div>
                  <h3 style="margin:0 0 .25rem">${esc(a.title)}</h3>
                  <div class="row gap wrap">
                    <span class="badge ${a.status === 'activo' ? 'ok' : a.status === 'programado' ? 'warn' : 'ghost'}">${esc(a.status.toUpperCase())}</span>
                    ${renderChannelBadges(a.channel)}
                    ${includesWeb ? (SPOT_BADGE[spot] || SPOT_BADGE.normal) : ''}
                    <span class="badge">${esc(kindLbl)}</span>
                    ${a.video_url ? '<span class="badge info">🎬 Video</span>' : ''}
                    ${a.doc_url ? '<span class="badge warn">📄 Documento PDF</span>' : ''}
                    ${a.pinned ? '<span class="badge ok">📌 Fijado</span>' : ''}
                  </div>
                </div>
                <div class="row gap wrap">
                  <button class="btn sm ok" data-share-wa="${a.id}" title="Copiar comunicado formateado y abrir Comunidad o Grupo de WhatsApp">💬 Difundir en WhatsApp</button>
                  ${!a.archived && includesApp ? `<button class="btn sm" data-send-push="${a.id}" title="Enviar notificación push al celular de los socios">${RD.icon('smartphone', '', 14)} Push App</button>` : ''}
                  ${!a.archived ? `<button class="btn sm" data-edit="${a.id}">${RD.icon('edit', '', 14)} Editar</button>` : ''}
                  <button class="btn sm ${a.archived ? 'ok' : 'danger'}" data-archive="${a.id}">${a.archived ? 'Reactivar' : 'Archivar'}</button>
                </div>
              </div>

              ${a.image_url ? `
                <div style="margin:8px 0;max-height:170px;overflow:hidden;border-radius:10px;border:1px solid var(--line);cursor:pointer;background:var(--bg3)" onclick="RD.zoomImage('${esc(a.image_url)}')">
                  <img src="${esc(a.image_url)}" style="width:100%;max-height:170px;object-fit:cover;display:block" alt="${esc(a.title)}">
                </div>
              ` : ''}

              ${a.body ? `<p style="margin:.6rem 0;line-height:1.45;color:var(--text)">${esc(a.body)}</p>` : ''}

              <div class="row gap wrap mt">
                ${a.video_url ? `<a href="${esc(a.video_url)}" target="_blank" rel="noopener" class="btn sm ghost">🎬 Ver Video Multimedia</a>` : ''}
                ${a.doc_url ? `<a href="${esc(a.doc_url)}" target="_blank" rel="noopener" download class="btn sm ghost">${esc(a.doc_label || '📄 Descargar Documento / PDF')}</a>` : ''}
                ${a.cta_url ? `<a href="${esc(a.cta_url)}" target="_blank" rel="noopener" class="btn sm ghost">🔗 ${esc(a.cta_label || 'Abrir Enlace')}</a>` : ''}
              </div>

              <div class="row between wrap gap small muted mt2">
                <div>
                  Audiencia: <b>${esc(audLbl)}</b> · Autor: <b>${esc(a.author || 'Administración')}</b>
                  ${a.starts_at ? ` · Desde: <b>${RD.fmtDate(a.starts_at)}</b>` : ''}
                  ${a.ends_at ? ` · Hasta: <b>${RD.fmtDate(a.ends_at)}</b>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  ${RD.icon('eye', '', 14)} <b>${a.reads || 0}</b> lecturas en App
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    host.querySelectorAll('[data-share-wa]').forEach(b => {
      b.onclick = () => {
        const item = listCache.find(x => String(x.id) === b.dataset.shareWa);
        if (item) shareToWhatsAppChannel(item);
      };
    });

    host.querySelectorAll('[data-send-push]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.sendPush;
        const item = listCache.find(x => String(x.id) === id);
        if (!item) return;
        await RD.busy(b, async () => {
          try {
            const res = await RD.api.post(`/announcements/${id}/send-push`);
            const p = res.push || {};
            RD.toast(`Notificaciones enviadas: ${p.sent || 0} entregadas`, 'ok', 4000);
            loadData(view);
          } catch (err) {
            RD.toast(err.message, 'err');
          }
        });
      };
    });

    host.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => {
        const item = listCache.find(x => String(x.id) === b.dataset.edit);
        if (item) openAnnModal(item, () => loadData(view));
      };
    });

    host.querySelectorAll('[data-archive]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.archive;
        const item = listCache.find(x => String(x.id) === id);
        if (!item) return;
        if (item.archived) {
          try {
            await RD.api.put(`/announcements/${id}`, { ...item, archived: 0 });
            RD.toast('Publicación reactivada');
            loadData(view);
          } catch (err) { RD.toast(err.message, 'err'); }
        } else {
          if (await RD.confirm('Archivar publicación', `¿Deseas archivar "${item.title}"?`, 'Archivar', true)) {
            try {
              await RD.api.del(`/announcements/${id}`);
              RD.toast('Publicación archivada');
              loadData(view);
            } catch (err) { RD.toast(err.message, 'err'); }
          }
        }
      };
    });
  }

  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openAnnModal(item, onDone) {
    const isEdit = !!item;
    const chList = parseChannels(item?.channel || 'app,web,whatsapp');
    const curSpot = item?.web_spot || 'carousel';

    const m = RD.openModal(isEdit ? 'Editar Publicación Multimedia' : '＋ Nueva Publicación (App / Página Web / WhatsApp)', `
      <form id="annform">
        <!-- 1. ENTRELAZADO DE CANALES: INDIVIDUAL, COMBINADO O GENERAL -->
        <div class="card flat mb" style="background:var(--bg2);border:1px solid var(--line);padding:14px">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:8px;color:var(--gold)">
            1. Entrelazado de Canales de Difusión (Individual, Combinado o General):
          </div>
          <div class="chips mb" id="ch_preset_chips" style="gap:6px">
            <span class="chip" data-preset="app,web,whatsapp">🌐📱💬 General (Los 3 Canales)</span>
            <span class="chip" data-preset="app">📱 Solo App de Socios</span>
            <span class="chip" data-preset="web">🌐 Solo Página Web</span>
            <span class="chip" data-preset="whatsapp">💬 Solo WhatsApp</span>
            <span class="chip" data-preset="app,web">📱+🌐 App + Web</span>
            <span class="chip" data-preset="app,whatsapp">📱+💬 App + WhatsApp</span>
            <span class="chip" data-preset="web,whatsapp">🌐+💬 Web + WhatsApp</span>
          </div>
          <div class="grid g3 keep gap mb">
            <label class="card flat" style="cursor:pointer;padding:10px;border:1px solid var(--line);display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" id="ch_app" ${chList.includes('app') ? 'checked' : ''} style="margin-top:3px">
              <div>
                <div style="font-weight:700;font-size:.85rem">📱 App de Socios</div>
                <div class="tiny muted">Bandeja interna preferencial para miembros inscritos</div>
              </div>
            </label>
            <label class="card flat" style="cursor:pointer;padding:10px;border:1px solid var(--line);display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" id="ch_web" ${chList.includes('web') ? 'checked' : ''} style="margin-top:3px">
              <div>
                <div style="font-weight:700;font-size:.85rem">🌐 Página Web del Gimnasio</div>
                <div class="tiny muted">Vitrina multimedia, muro de avisos o Spotlight</div>
              </div>
            </label>
            <label class="card flat" style="cursor:pointer;padding:10px;border:1px solid var(--line);display:flex;align-items:flex-start;gap:8px">
              <input type="checkbox" id="ch_wa" ${chList.includes('whatsapp') ? 'checked' : ''} style="margin-top:3px">
              <div>
                <div style="font-weight:700;font-size:.85rem">💬 WhatsApp del Gimnasio</div>
                <div class="tiny muted">Publicación directa en el grupo/comunidad del gimnasio</div>
              </div>
            </label>
          </div>

          <label class="field" id="webspot_field">
            <span>Ubicación Visual en la Página Web del Gimnasio</span>
            <select name="web_spot" id="selwebspot">
              <option value="carousel" ${curSpot === 'carousel' ? 'selected' : ''}>🎠 Vitrina Multimedia / Slider Interactivo (Derecha)</option>
              <option value="normal" ${curSpot === 'normal' ? 'selected' : ''}>📌 Muro de Comunicados y Documentos (Izquierda)</option>
              <option value="lightbox" ${curSpot === 'lightbox' ? 'selected' : ''}>✨ Spotlight de Portada al Abrir (Ventana Cristal con ✕ y Tiempo)</option>
            </select>
          </label>
        </div>

        <!-- 2. CONTENIDO PRINCIPAL -->
        <div class="grid g2 keep gap">
          <label class="field">
            <span>Categoría de la Publicación *</span>
            <select name="kind" required>
              ${KINDS.map(k => `<option value="${k[0]}" ${item?.kind === k[0] ? 'selected' : ''}>${k[1]} — ${k[2]}</option>`).join('')}
            </select>
          </label>
          <label class="field">
            <span>Título * (hasta 80 caracteres)</span>
            <input name="title" required maxlength="80" value="${esc(item?.title || '')}" placeholder="Ej. Nuevo Horario en PDF / Promo Dúo / Guía de Entrenamiento">
          </label>
        </div>

        <label class="field">
          <span>Descripción / Contenido del Comunicado</span>
          <textarea name="body" rows="3" placeholder="Redacta los detalles de la campaña, comunicado o guía...">${esc(item?.body || '')}</textarea>
        </label>

        <!-- 3. MULTIMEDIA RICA: IMAGEN, VIDEO, DOCUMENTO PDF Y ENLACE -->
        <div class="card flat mt mb" style="background:var(--bg2);border:1px solid var(--line);padding:14px">
          <div style="font-weight:800;font-size:.88rem;margin-bottom:8px;color:var(--gold)">
            2. Recursos Multimedia y Documentación Adjunta (Imagen, Video, PDF y Enlaces):
          </div>

          <label class="field mb">
            <span>🖼️ Imagen o Afiche en Alta Definición (Opcional)</span>
            <div class="row gap wrap">
              <input name="image_url" id="ann_image_url" class="grow" placeholder="https://... o sube una imagen desde tu equipo" value="${esc(item?.image_url || '')}">
              <label class="btn sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                ${RD.icon('camera', '', 14)} Subir Imagen
                <input type="file" id="ann_file_inp" accept="image/*" class="hidden">
              </label>
              <button type="button" class="btn sm ghost ${item?.image_url ? '' : 'hidden'}" id="btn_clear_img">${RD.icon('x', '', 14)} Quitar</button>
            </div>
          </label>
          <div id="ann_img_preview" class="${item?.image_url ? '' : 'hidden'}" style="text-align:center;margin-bottom:10px">
            <img id="ann_preview_el" src="${item?.image_url ? esc(item.image_url) : ''}" style="max-height:140px;max-width:100%;border-radius:8px;object-fit:cover;border:1px solid var(--line)" alt="">
          </div>

          <div class="grid g2 keep gap">
            <label class="field">
              <span>🎬 Enlace de Video (MP4, YouTube, Reel o TikTok)</span>
              <input name="video_url" placeholder="https://www.youtube.com/watch?v=... o archivo .mp4" value="${esc(item?.video_url || '')}">
            </label>
            <label class="field">
              <span>📄 Documento / PDF Descargable (Horario, Guía, Reglamento)</span>
              <div class="row gap">
                <input name="doc_url" id="ann_doc_url" class="grow" placeholder="https://... o sube un PDF" value="${esc(item?.doc_url || '')}">
                <label class="btn sm" style="cursor:pointer;white-space:nowrap">
                  📎 Subir PDF
                  <input type="file" id="ann_doc_inp" accept="application/pdf,image/*" class="hidden">
                </label>
              </div>
            </label>
          </div>

          <div class="grid g3 keep gap mt">
            <label class="field">
              <span>Texto del Botón de Documento</span>
              <input name="doc_label" placeholder="Ej. 📄 Descargar Horario PDF" value="${esc(item?.doc_label || '')}">
            </label>
            <label class="field">
              <span>Texto del Botón de Enlace / Acción</span>
              <input name="cta_label" placeholder="Ej. Inscribirme por WhatsApp" value="${esc(item?.cta_label || '')}">
            </label>
            <label class="field">
              <span>URL del Enlace de Acción</span>
              <input name="cta_url" placeholder="https://wa.me/... o enlace externo" value="${esc(item?.cta_url || '')}">
            </label>
          </div>
        </div>

        <!-- 4. SEGMENTACIÓN INTERNA EN APP Y FECHAS -->
        <div class="grid g2 keep gap" id="app_targeting_box">
          <label class="field">
            <span>Prioridad en App de Socios</span>
            <select name="priority">
              <option value="info" ${item?.priority === 'info' ? 'selected' : ''}>Normal (Bandeja de avisos)</option>
              <option value="importante" ${item?.priority === 'importante' ? 'selected' : ''}>Importante (Franja destacada superior)</option>
            </select>
          </label>
          <label class="field">
            <span>Filtro de Socios en App</span>
            <select name="audience" id="selaudience">
              ${AUDIENCES.map(a => `<option value="${a[0]}" ${item?.audience === a[0] ? 'selected' : ''}>${a[1]}</option>`).join('')}
            </select>
          </label>
        </div>

        <div id="singlememberbox" class="field ${item?.audience === 'member' ? '' : 'hidden'}">
          <span>ID del Socio destinatario</span>
          <input name="member_id" type="number" placeholder="Ej. 1" value="${item?.member_id || ''}">
        </div>

        <div class="grid g2 keep gap">
          <label class="field">
            <span>Mostrar desde (opcional)</span>
            <input name="starts_at" type="datetime-local" value="${toLocalInput(item?.starts_at)}">
          </label>
          <label class="field">
            <span>Mostrar hasta (opcional)</span>
            <input name="ends_at" type="datetime-local" value="${toLocalInput(item?.ends_at)}">
          </label>
        </div>

        <div class="card flat mt mb" style="background:var(--bg3)">
          <label class="check">
            <input type="checkbox" name="pinned" ${item?.pinned ? 'checked' : ''}>
            <span><b>Destacar / Fijar</b> al inicio de la vitrina y bandeja</span>
          </label>
          <label class="check mt2" id="push_check_wrap">
            <input type="checkbox" name="push" ${item ? (item.push ? 'checked' : '') : 'checked'}>
            <span><b>Enviar notificación Push al celular</b> de los socios en la App</span>
          </label>
        </div>

        <div class="row end gap">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${isEdit ? 'Guardar Cambios' : 'Publicar Ahora'}</button>
        </div>
      </form>
    `, { wide: true });

    const f = m.el.querySelector('#annform');
    const chApp = f.querySelector('#ch_app');
    const chWeb = f.querySelector('#ch_web');
    const chWa = f.querySelector('#ch_wa');
    const webSpotField = f.querySelector('#webspot_field');
    const appTargetBox = f.querySelector('#app_targeting_box');
    const pushCheckWrap = f.querySelector('#push_check_wrap');
    const audSel = f.querySelector('#selaudience');
    const smBox = f.querySelector('#singlememberbox');
    const presetChips = f.querySelectorAll('#ch_preset_chips .chip');

    const syncChannelUI = () => {
      webSpotField.classList.toggle('hidden', !chWeb.checked);
      appTargetBox.classList.toggle('hidden', !chApp.checked);
      pushCheckWrap.classList.toggle('hidden', !chApp.checked);
      if (!chApp.checked) smBox.classList.add('hidden');
      else smBox.classList.toggle('hidden', audSel.value !== 'member');

      const curCombo = [
        chApp.checked ? 'app' : '',
        chWeb.checked ? 'web' : '',
        chWa.checked ? 'whatsapp' : ''
      ].filter(Boolean).join(',');
      presetChips.forEach(chip => {
        chip.classList.toggle('on', chip.dataset.preset === curCombo);
      });
    };

    presetChips.forEach(chip => {
      chip.onclick = () => {
        const parts = (chip.dataset.preset || '').split(',');
        chApp.checked = parts.includes('app');
        chWeb.checked = parts.includes('web');
        chWa.checked = parts.includes('whatsapp');
        syncChannelUI();
      };
    });

    chApp.onchange = syncChannelUI;
    chWeb.onchange = syncChannelUI;
    chWa.onchange = syncChannelUI;
    audSel.onchange = syncChannelUI;
    syncChannelUI();

    let currentImage = item?.image_url || '';
    const imgUrlInp = f.querySelector('#ann_image_url');
    const fileInp = f.querySelector('#ann_file_inp');
    const prevWrap = f.querySelector('#ann_img_preview');
    const prevImg = f.querySelector('#ann_preview_el');
    const clearBtn = f.querySelector('#btn_clear_img');

    const updatePreview = (src) => {
      currentImage = src || '';
      if (currentImage) {
        prevImg.src = currentImage;
        prevWrap.classList.remove('hidden');
        clearBtn.classList.remove('hidden');
      } else {
        prevImg.src = '';
        prevWrap.classList.add('hidden');
        clearBtn.classList.add('hidden');
      }
    };

    imgUrlInp.oninput = () => updatePreview(imgUrlInp.value.trim());
    fileInp.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const b64 = await RD.resizeImage(file, 1200, 0.85);
        imgUrlInp.value = b64;
        updatePreview(b64);
        RD.toast('Imagen cargada');
      } catch (err) {
        RD.toast('Error cargando imagen: ' + err.message, 'err');
      }
    };
    clearBtn.onclick = () => { imgUrlInp.value = ''; fileInp.value = ''; updatePreview(''); };

    const docUrlInp = f.querySelector('#ann_doc_url');
    const docFileInp = f.querySelector('#ann_doc_inp');
    docFileInp.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 4.5 * 1024 * 1024) {
        RD.toast('El archivo PDF no debe superar 4.5 MB', 'err');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        docUrlInp.value = reader.result;
        if (!f.doc_label.value.trim()) f.doc_label.value = '📄 ' + file.name;
        RD.toast('Documento adjuntado correctamente');
      };
      reader.readAsDataURL(file);
    };

    f.onsubmit = async e => {
      e.preventDefault();
      const selectedChannels = [];
      if (chApp.checked) selectedChannels.push('app');
      if (chWeb.checked) selectedChannels.push('web');
      if (chWa.checked) selectedChannels.push('whatsapp');
      if (!selectedChannels.length) {
        RD.toast('Selecciona al menos un canal de destino (App, Web o WhatsApp)', 'err');
        return;
      }

      const payload = {
        kind: f.kind.value,
        channel: selectedChannels.join(','),
        web_spot: f.web_spot.value,
        whatsapp_target: chWa.checked ? 'community' : 'none',
        title: f.title.value.trim(),
        body: f.body.value.trim(),
        priority: f.priority.value,
        audience: f.audience.value,
        member_id: f.audience.value === 'member' ? Number(f.member_id.value) : null,
        starts_at: f.starts_at.value ? new Date(f.starts_at.value).toISOString() : null,
        ends_at: f.ends_at.value ? new Date(f.ends_at.value).toISOString() : null,
        cta_label: f.cta_label.value.trim(),
        cta_url: f.cta_url.value.trim(),
        image_url: currentImage || null,
        video_url: f.video_url.value.trim() || null,
        doc_url: docUrlInp.value.trim() || null,
        doc_label: f.doc_label.value.trim() || null,
        pinned: f.pinned.checked ? 1 : 0,
        push: (chApp.checked && f.push.checked) ? 1 : 0
      };

      const btn = f.querySelector('button[type=submit]');
      await RD.busy(btn, async () => {
        try {
          if (isEdit) {
            await RD.api.put(`/announcements/${item.id}`, payload);
            RD.toast('Publicación actualizada con éxito');
          } else {
            await RD.api.post('/announcements', payload);
            RD.toast('Publicación activa en los canales seleccionados');
          }
          m.close();
          onDone && onDone();
          if (chWa.checked) {
            setTimeout(() => shareToWhatsAppChannel(payload), 250);
          }
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      });
    };
  }
})();
