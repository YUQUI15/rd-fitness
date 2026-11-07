/* RED GYM Club - Módulo de Gestión de Avisos y Notificaciones (Panel Admin / Recepción) */
(function () {
  const RD = window.RD = window.RD || {};
  const { esc } = RD;

  const KINDS = [
    ['aviso', 'Aviso General', 'Comunicado regular para los socios'],
    ['mantenimiento', 'Mantenimiento', 'Aparece como franja de aviso en la cabecera'],
    ['cierre', 'Cierre / Horario Especial', 'Avisos de feriado o cierre temporal'],
    ['promo', 'Promoción o Descuento', 'Ofertas y beneficios especiales'],
    ['evento', 'Evento o Clase Especial', 'Actividades, temáticas o retos']
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

  RD.views = RD.views || {};
  RD.views.announcements = {
    async render(view) {
      view.innerHTML = `
        <div class="row between wrap gap mb">
          <div>
            <h2 style="margin:0;display:flex;align-items:center;gap:8px">${RD.icon('megaphone', '', 22)} Avisos para Socios (App) y Publicidad Web</h2>
            <p class="muted small" style="margin:.2rem 0 0">
              Administra desde un solo lugar las notificaciones preferenciales para <b>Socios en la App</b> (sin invadirlos con publicidad) y las campañas comerciales, carruseles y anuncios destacados para el <b>Público General en la Web</b>.
            </p>
          </div>
          <button class="btn primary" id="btnnewann">＋ Nuevo Aviso / Anuncio</button>
        </div>

        <div class="grid g4 gap mb" id="annkpis">
          <div class="stat"><div class="v" id="kpiactive">—</div><div class="l">Publicaciones activas</div></div>
          <div class="stat"><div class="v" id="kpibanner">—</div><div class="l">Destacados / Lightbox</div></div>
          <div class="stat"><div class="v" id="kpireads">—</div><div class="l">Lecturas en App</div></div>
          <div class="stat"><div class="v" id="kpipush">—</div><div class="l">Con aviso Push</div></div>
        </div>

        <div class="chips mb" id="anntabs">
          <span class="chip on" data-t="all">Todos</span>
          <span class="chip" data-t="app_only">🔒 Exclusivo Socios (App)</span>
          <span class="chip" data-t="web_only">🌐 Publicidad Sitio Web</span>
          <span class="chip" data-t="both_ch">📢 Ambos (App + Web)</span>
          <span class="chip" data-t="promos">🔥 Promociones</span>
          <span class="chip" data-t="archived">Archivados</span>
        </div>

        <div id="annlist"><div class="empty">Cargando comunicados…</div></div>
      `;

      view.querySelector('#btnnewann').onclick = () => openAnnModal(null, () => loadData(view));

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
    const banners = active.filter(a => a.priority === 'importante' && ['mantenimiento', 'cierre'].includes(a.kind));
    const reads = listCache.reduce((sum, a) => sum + (Number(a.reads) || 0), 0);
    const withPush = listCache.filter(a => a.push).length;

    const sA = view.querySelector('#kpiactive'); if (sA) sA.textContent = active.length;
    const sB = view.querySelector('#kpibanner'); if (sB) sB.textContent = banners.length;
    const sR = view.querySelector('#kpireads'); if (sR) sR.textContent = reads;
    const sP = view.querySelector('#kpipush'); if (sP) sP.textContent = withPush;
  }

  function renderList(view) {
    const host = view.querySelector('#annlist');
    if (!host) return;

    let items = listCache.slice();
    if (currentTab === 'app_only') items = items.filter(a => a.channel === 'app' && !a.archived);
    else if (currentTab === 'web_only') items = items.filter(a => a.channel === 'web' && !a.archived);
    else if (currentTab === 'both_ch') items = items.filter(a => (!a.channel || a.channel === 'both') && !a.archived);
    else if (currentTab === 'promos') items = items.filter(a => a.kind === 'promo' && !a.archived);
    else if (currentTab === 'archived') items = items.filter(a => a.archived);
    else items = items.filter(a => !a.archived);

    if (!items.length) {
      host.innerHTML = `<div class="empty">No hay comunicados en esta sección.<br><span class="small muted">Haz clic en <b>＋ Nuevo Aviso / Anuncio</b> para redactar uno.</span></div>`;
      return;
    }

    const CH_BADGE = {
      app: '<span class="badge info">🔒 Exclusivo Socios (App)</span>',
      web: '<span class="badge warn">🌐 Exclusivo Público Web</span>',
      both: '<span class="badge ok">📢 Socios App + Público Web</span>'
    };
    const SPOT_BADGE = {
      normal: '<span class="badge ghost">📌 Panel Izquierdo (Avisos)</span>',
      carousel: '<span class="badge info">🎠 Carrusel Publicitario (Derecha)</span>',
      lightbox: '<span class="badge bad">✨ Lightbox Destacado al Ingresar</span>'
    };

    host.innerHTML = `
      <div class="list">
        ${items.map(a => {
          const kindLbl = (KINDS.find(k => k[0] === a.kind) || [])[1] || a.kind;
          const audLbl = a.channel === 'web' ? 'Visitantes del Sitio Web Público' : ((AUDIENCES.find(k => k[0] === a.audience) || [])[1] || a.audience);
          const ch = a.channel || 'both';
          const spot = a.web_spot || 'normal';
          return `
          <div class="card mb item" style="padding:1rem;align-items:flex-start">
            <div style="margin-right:.6rem;color:var(--gold);display:flex;align-items:center">${RD.icon(KIND_ICON[a.kind] || 'megaphone', '', 26)}</div>
            <div class="grow" style="min-width:0">
              <div class="row between wrap gap">
                <div>
                  <h3 style="margin:0 0 .2rem">${esc(a.title)}</h3>
                  <div class="row gap wrap">
                    <span class="badge ${a.status === 'activo' ? 'ok' : a.status === 'programado' ? 'warn' : 'ghost'}">${esc(a.status.toUpperCase())}</span>
                    ${CH_BADGE[ch] || CH_BADGE.both}
                    ${ch !== 'app' ? (SPOT_BADGE[spot] || SPOT_BADGE.normal) : ''}
                    <span class="badge">${esc(kindLbl)}</span>
                    ${a.pinned ? '<span class="badge ok">Fijado</span>' : ''}
                    ${a.push && ch !== 'web' ? '<span class="badge info">Push ' + (a.push_sent ? 'enviado' : 'programado') + '</span>' : ''}
                  </div>
                </div>
                <div class="row gap">
                  ${!a.archived && ch !== 'web' ? `<button class="btn sm" data-send-push="${a.id}" title="Enviar o reenviar notificación push al celular de los socios">${RD.icon('smartphone', '', 14)} Enviar Push</button>` : ''}
                  ${!a.archived ? `<button class="btn sm" data-edit="${a.id}">${RD.icon('edit', '', 14)} Editar</button>` : ''}
                  <button class="btn sm ${a.archived ? 'ok' : 'danger'}" data-archive="${a.id}">${a.archived ? 'Desarchivar' : 'Archivar'}</button>
                </div>
              </div>
              ${a.image_url ? `
                <div style="margin:8px 0;max-height:160px;overflow:hidden;border-radius:8px;border:1px solid var(--line);cursor:pointer;background:var(--bg3)" onclick="RD.zoomImage('${esc(a.image_url)}')">
                  <img src="${esc(a.image_url)}" style="width:100%;max-height:160px;object-fit:cover;display:block" alt="${esc(a.title)}">
                </div>
              ` : ''}

              ${a.body ? `<p style="margin:.6rem 0;line-height:1.45;color:var(--text)">${esc(a.body)}</p>` : ''}

              <div class="row between wrap gap small muted mt2">
                <div>
                  Destinatarios: <b>${esc(audLbl)}</b> · Publicado por: <b>${esc(a.author || 'Administración')}</b>
                  ${a.starts_at ? ` · Desde: <b>${RD.fmtDate(a.starts_at)}</b>` : ''}
                  ${a.ends_at ? ` · Hasta: <b>${RD.fmtDate(a.ends_at)}</b>` : ''}
                </div>
                <div style="display:flex;align-items:center;gap:5px">
                  ${RD.icon('eye', '', 14)} <b>${a.reads || 0}</b> socios leyeron este aviso en su app
                </div>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `;

    host.querySelectorAll('[data-send-push]').forEach(b => {
      b.onclick = async () => {
        const id = b.dataset.sendPush;
        const item = listCache.find(x => String(x.id) === id);
        if (!item) return;
        await RD.busy(b, async () => {
          try {
            const res = await RD.api.post(`/announcements/${id}/send-push`);
            const p = res.push || {};
            RD.toast(`Notificaciones enviadas: ${p.sent || 0} entregadas (${p.skipped || 0} sin dispositivo suscrito)`, 'ok', 5000);
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
            RD.toast('Comunicado reactivado');
            loadData(view);
          } catch (err) { RD.toast(err.message, 'err'); }
        } else {
          if (await RD.confirm('Archivar comunicado', `¿Deseas archivar "${item.title}"? Dejará de mostrarse en la app de los socios.`, 'Archivar', true)) {
            try {
              await RD.api.del(`/announcements/${id}`);
              RD.toast('Comunicado archivado');
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
    const curChannel = item?.channel || 'both';
    const curSpot = item?.web_spot || 'normal';
    const m = RD.openModal(isEdit ? 'Editar Aviso o Anuncio Publicitario' : '＋ Nuevo Aviso para Socios / Publicidad Web', `
      <form id="annform">
        <div class="card flat mb" style="background:var(--bg2);border:1px solid var(--line);padding:12px">
          <div class="grid g2 keep gap">
            <label class="field">
              <span>1. Canal de Destino (Segmentación Inteligente) *</span>
              <select name="channel" id="selchannel" required>
                <option value="both" ${curChannel === 'both' ? 'selected' : ''}>📢 Ambos (App de Socios + Sitio Web Público)</option>
                <option value="app" ${curChannel === 'app' ? 'selected' : ''}>🔒 Exclusivo Socios (Solo en App Móvil · Sin publicidad invasiva)</option>
                <option value="web" ${curChannel === 'web' ? 'selected' : ''}>🌐 Exclusivo Público General (Solo Publicidad en Sitio Web)</option>
              </select>
            </label>
            <label class="field" id="webspot_field">
              <span>2. Ubicación Elegante en el Sitio Web Público *</span>
              <select name="web_spot" id="selwebspot">
                <option value="normal" ${curSpot === 'normal' ? 'selected' : ''}>📌 Lado Izquierdo — Muro de Avisos y Noticias</option>
                <option value="carousel" ${curSpot === 'carousel' ? 'selected' : ''}>🎠 Lado Derecho — Carrusel / Slider Publicitario</option>
                <option value="lightbox" ${curSpot === 'lightbox' ? 'selected' : ''}>✨ Destacado Principal al Ingresar (Lightbox con ✕ y Tiempo)</option>
              </select>
            </label>
          </div>
          <div class="tiny muted mt2">
            💡 <b>Regla de Oro:</b> A los socios activos en su App solo se les envían avisos importantes del club (mantenimiento, feriados, recordatorios), nunca spam publicitario. La publicidad comercial se exhibe de forma elegante en el Sitio Web Público.
          </div>
        </div>

        <label class="field">
          <span>Categoría del Comunicado / Anuncio *</span>
          <select name="kind" required>
            ${KINDS.map(k => `<option value="${k[0]}" ${item?.kind === k[0] ? 'selected' : ''}>${k[1]} — ${k[2]}</option>`).join('')}
          </select>
        </label>

        <label class="field">
          <span>Título del Aviso o Campaña * (hasta 80 caracteres)</span>
          <input name="title" required maxlength="80" value="${esc(item?.title || '')}" placeholder="Ej. Hoy atención en horario especial / Promo Verano 2x1">
        </label>

        <label class="field">
          <span>Contenido / Detalle del Comunicado</span>
          <textarea name="body" rows="3" placeholder="Escribe el mensaje claro y detallado...">${esc(item?.body || '')}</textarea>
        </label>

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
          <span>ID o Código del Socio destinatario</span>
          <input name="member_id" type="number" placeholder="Ej. 1" value="${item?.member_id || ''}">
        </div>

        <div class="grid g2 keep gap">
          <label class="field">
            <span>Mostrar desde (opcional)</span>
            <input name="starts_at" type="datetime-local" value="${toLocalInput(item?.starts_at)}">
            <small class="tiny muted">Vacío = publicar de inmediato</small>
          </label>
          <label class="field">
            <span>Mostrar hasta (opcional)</span>
            <input name="ends_at" type="datetime-local" value="${toLocalInput(item?.ends_at)}">
            <small class="tiny muted">Vacío = permanente hasta archivar</small>
          </label>
        </div>

        <div class="grid g2 keep gap">
          <label class="field">
            <span>Texto del botón de acción (opcional)</span>
            <input name="cta_label" placeholder="Ej. Consultar por WhatsApp" value="${esc(item?.cta_label || '')}">
          </label>
          <label class="field">
            <span>Enlace del botón (opcional)</span>
            <input name="cta_url" placeholder="Ej. https://wa.me/... o /?tab=pass" value="${esc(item?.cta_url || '')}">
          </label>
        </div>

        <div class="card flat mt mb" style="background:var(--bg2);border:1px solid var(--line);padding:12px">
          <label class="field mb">
            <span>Imagen / Banner Multimedia (Opcional)</span>
            <div class="row gap wrap">
              <input name="image_url" id="ann_image_url" class="grow" placeholder="https://... o sube una imagen de tu dispositivo" value="${esc(item?.image_url || '')}">
              <label class="btn sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                ${RD.icon('camera', '', 14)} Subir Imagen
                <input type="file" id="ann_file_inp" accept="image/*" class="hidden">
              </label>
              <button type="button" class="btn sm ghost ${item?.image_url ? '' : 'hidden'}" id="btn_clear_img">${RD.icon('x', '', 14)} Quitar</button>
            </div>
            <small class="tiny muted">Ideal para banners de promociones, eventos o afiches informativos. Se muestra en la app del socio y en notificaciones push.</small>
          </label>
          <div id="ann_img_preview" class="${item?.image_url ? '' : 'hidden'}" style="text-align:center;margin-top:8px">
            <img id="ann_preview_el" src="${item?.image_url ? esc(item.image_url) : ''}" style="max-height:160px;max-width:100%;border-radius:8px;object-fit:cover;border:1px solid var(--line)" alt="">
          </div>
        </div>

        <div class="card flat mt mb" style="background:var(--bg3)">
          <label class="check">
            <input type="checkbox" name="pinned" ${item?.pinned ? 'checked' : ''}>
            <span><b>Fijar al inicio de la bandeja</b> del socio</span>
          </label>
          <label class="check mt2">
            <input type="checkbox" name="push" ${item ? (item.push ? 'checked' : '') : 'checked'}>
            <span><b>Enviar notificación Push al celular</b> de los socios suscritos (respeta horario nocturno y preferencias)</span>
          </label>
        </div>

        <div class="row end gap">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${isEdit ? 'Guardar Cambios' : 'Publicar Comunicado'}</button>
        </div>
      </form>
    `, { wide: true });

    const f = m.el.querySelector('#annform');
    const audSel = f.querySelector('#selaudience');
    const smBox = f.querySelector('#singlememberbox');
    const chSel = f.querySelector('#selchannel');
    const webSpotField = f.querySelector('#webspot_field');
    const appTargetBox = f.querySelector('#app_targeting_box');

    const syncChannelUI = () => {
      const ch = chSel.value;
      webSpotField.classList.toggle('hidden', ch === 'app');
      appTargetBox.classList.toggle('hidden', ch === 'web');
      if (ch === 'web') smBox.classList.add('hidden');
      else smBox.classList.toggle('hidden', audSel.value !== 'member');
    };
    chSel.onchange = syncChannelUI;
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
        RD.toast('Imagen cargada con éxito');
      } catch (err) {
        RD.toast('Error cargando imagen: ' + err.message, 'err');
      }
    };

    clearBtn.onclick = () => {
      imgUrlInp.value = '';
      fileInp.value = '';
      updatePreview('');
    };

    audSel.onchange = () => {
      smBox.classList.toggle('hidden', audSel.value !== 'member');
    };

    f.onsubmit = async e => {
      e.preventDefault();
      const payload = {
        kind: f.kind.value,
        channel: f.channel.value,
        web_spot: f.web_spot.value,
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
        pinned: f.pinned.checked ? 1 : 0,
        push: (f.channel.value !== 'web' && f.push.checked) ? 1 : 0
      };

      const btn = f.querySelector('button[type=submit]');
      await RD.busy(btn, async () => {
        try {
          if (isEdit) {
            await RD.api.put(`/announcements/${item.id}`, payload);
            RD.toast('Comunicado actualizado con éxito');
          } else {
            const res = await RD.api.post('/announcements', payload);
            RD.toast('Comunicado publicado' + (payload.push ? ' (notificaciones enviadas)' : ''));
          }
          m.close();
          onDone && onDone();
        } catch (err) {
          RD.toast(err.message, 'err');
        }
      });
    };
  }
})();
