/* RD Fitness Club - Módulo de Gestión de Avisos y Notificaciones (Panel Admin / Recepción) */
(function () {
  const RD = window.RD = window.RD || {};
  const { esc } = RD;

  const KINDS = [
    ['aviso', '📢 Aviso General', 'Comunicado regular para los socios'],
    ['mantenimiento', '🛠️ Mantenimiento', 'Aparece como franja de aviso en la cabecera'],
    ['cierre', '⛔ Cierre / Horario Especial', 'Avisos de feriado o cierre temporal'],
    ['promo', '🏷️ Promoción o Descuento', 'Ofertas y beneficios especiales'],
    ['evento', '🎉 Evento o Clase Especial', 'Actividades, temáticas o retos']
  ];

  const AUDIENCES = [
    ['all', '👥 Todos los socios'],
    ['active', '🟢 Solo socios con membresía activa'],
    ['expiring', '⚠️ Socios por vencer (en alerta)'],
    ['expired', '❌ Socios con membresía vencida'],
    ['member', '👤 Un socio específico']
  ];

  const KIND_ICON = { aviso: '📢', mantenimiento: '🛠️', cierre: '⛔', promo: '🏷️', evento: '🎉', pago: '🧾', recordatorio: '⏰' };

  let currentTab = 'all';
  let listCache = [];

  RD.views = RD.views || {};
  RD.views.announcements = {
    async render(view) {
      view.innerHTML = `
        <div class="row between wrap gap mb">
          <div>
            <h2 style="margin:0">📢 Avisos, Novedades y Notificaciones</h2>
            <p class="muted small" style="margin:.2rem 0 0">
              Publica comunicados oficiales, avisos de mantenimiento, horarios especiales y promociones. Se reflejan en tiempo real en la app del socio.
            </p>
          </div>
          <button class="btn primary" id="btnnewann">＋ Nuevo Comunicado</button>
        </div>

        <div class="grid g4 gap mb" id="annkpis">
          <div class="stat"><div class="v" id="kpiactive">—</div><div class="l">Avisos activos</div></div>
          <div class="stat"><div class="v" id="kpibanner">—</div><div class="l">Franjas de atención</div></div>
          <div class="stat"><div class="v" id="kpireads">—</div><div class="l">Lecturas en app</div></div>
          <div class="stat"><div class="v" id="kpipush">—</div><div class="l">Con aviso Push</div></div>
        </div>

        <div class="chips mb" id="anntabs">
          <span class="chip on" data-t="all">Todos</span>
          <span class="chip" data-t="active">🟢 Activos</span>
          <span class="chip" data-t="scheduled">⏳ Programados</span>
          <span class="chip" data-t="maintenance">🛠️ Cierres / Mantenimiento</span>
          <span class="chip" data-t="promos">🏷️ Promociones</span>
          <span class="chip" data-t="archived">📦 Archivados</span>
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
      if (el) el.innerHTML = `<div class="empty">${e.offline ? '📡 Sin conexión.' : esc(e.message)}</div>`;
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
    if (currentTab === 'active') items = items.filter(a => a.status === 'activo');
    else if (currentTab === 'scheduled') items = items.filter(a => a.status === 'programado');
    else if (currentTab === 'maintenance') items = items.filter(a => ['mantenimiento', 'cierre'].includes(a.kind) && !a.archived);
    else if (currentTab === 'promos') items = items.filter(a => a.kind === 'promo' && !a.archived);
    else if (currentTab === 'archived') items = items.filter(a => a.archived);
    else items = items.filter(a => !a.archived);

    if (!items.length) {
      host.innerHTML = `<div class="empty">No hay comunicados en esta sección.<br><span class="small muted">Haz clic en <b>＋ Nuevo Comunicado</b> para redactar uno.</span></div>`;
      return;
    }

    host.innerHTML = `
      <div class="list">
        ${items.map(a => {
          const kindLbl = (KINDS.find(k => k[0] === a.kind) || [])[1] || a.kind;
          const audLbl = (AUDIENCES.find(k => k[0] === a.audience) || [])[1] || a.audience;
          const isBanner = a.priority === 'importante' && ['mantenimiento', 'cierre'].includes(a.kind);
          return `
          <div class="card mb item" style="padding:1rem;align-items:flex-start">
            <div style="font-size:1.8rem;line-height:1;margin-right:.4rem">${KIND_ICON[a.kind] || '📢'}</div>
            <div class="grow" style="min-width:0">
              <div class="row between wrap gap">
                <div>
                  <h3 style="margin:0 0 .2rem">${esc(a.title)}</h3>
                  <div class="row gap wrap">
                    <span class="badge ${a.status === 'activo' ? 'ok' : a.status === 'programado' ? 'warn' : 'ghost'}">${esc(a.status.toUpperCase())}</span>
                    <span class="badge">${esc(kindLbl)}</span>
                    <span class="badge ${isBanner ? 'bad' : 'ghost'}">${isBanner ? '⚠️ Franja Destacada' : 'ℹ️ Normal'}</span>
                    ${a.pinned ? '<span class="badge ok">📌 Fijado</span>' : ''}
                    ${a.push ? '<span class="badge info">📲 Push ' + (a.push_sent ? 'enviado' : 'programado') + '</span>' : ''}
                  </div>
                </div>
                <div class="row gap">
                  ${!a.archived ? `<button class="btn sm" data-send-push="${a.id}" title="Enviar o reenviar notificación push al celular de los socios">📲 Enviar Push</button>` : ''}
                  ${!a.archived ? `<button class="btn sm" data-edit="${a.id}">✏️ Editar</button>` : ''}
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
                <div>
                  👁️ <b>${a.reads || 0}</b> socios leyeron este aviso en su app
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
            RD.toast(`📲 Notificaciones enviadas: ${p.sent || 0} entregadas (${p.skipped || 0} sin dispositivo suscrito)`, 'ok', 5000);
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
    const m = RD.openModal(isEdit ? 'Editar Comunicado' : '＋ Nuevo Comunicado / Aviso', `
      <form id="annform">
        <label class="field">
          <span>Tipo de Comunicado *</span>
          <select name="kind" required>
            ${KINDS.map(k => `<option value="${k[0]}" ${item?.kind === k[0] ? 'selected' : ''}>${k[1]} — ${k[2]}</option>`).join('')}
          </select>
        </label>

        <label class="field">
          <span>Título del Aviso * (hasta 80 caracteres)</span>
          <input name="title" required maxlength="80" value="${esc(item?.title || '')}" placeholder="Ej. Hoy atención en horario especial hasta las 6:00 pm">
        </label>

        <label class="field">
          <span>Contenido / Detalle del Comunicado</span>
          <textarea name="body" rows="4" placeholder="Escribe el mensaje claro y detallado para los socios...">${esc(item?.body || '')}</textarea>
        </label>

        <div class="grid g2 keep gap">
          <label class="field">
            <span>Prioridad</span>
            <select name="priority">
              <option value="info" ${item?.priority === 'info' ? 'selected' : ''}>ℹ️ Normal (Solo en bandeja 🔔)</option>
              <option value="importante" ${item?.priority === 'importante' ? 'selected' : ''}>⚠️ Importante (Franja destacada en la app)</option>
            </select>
          </label>
          <label class="field">
            <span>Destinatarios</span>
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
            <span>🖼️ Imagen / Banner Multimedia (Opcional)</span>
            <div class="row gap wrap">
              <input name="image_url" id="ann_image_url" class="grow" placeholder="https://... o sube una imagen de tu dispositivo" value="${esc(item?.image_url || '')}">
              <label class="btn sm" style="cursor:pointer">
                📷 Subir Imagen
                <input type="file" id="ann_file_inp" accept="image/*" class="hidden">
              </label>
              <button type="button" class="btn sm ghost ${item?.image_url ? '' : 'hidden'}" id="btn_clear_img">✕ Quitar</button>
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
            <span>📌 <b>Fijar al inicio de la bandeja</b> del socio</span>
          </label>
          <label class="check mt2">
            <input type="checkbox" name="push" ${item ? (item.push ? 'checked' : '') : 'checked'}>
            <span>📲 <b>Enviar notificación Push al celular</b> de los socios suscritos (respeta horario nocturno y preferencias)</span>
          </label>
        </div>

        <div class="row end gap">
          <button type="button" class="btn ghost" data-close>Cancelar</button>
          <button type="submit" class="btn primary">${isEdit ? 'Guardar Cambios' : '📢 Publicar Comunicado'}</button>
        </div>
      </form>
    `, { wide: true });

    const f = m.el.querySelector('#annform');
    const audSel = f.querySelector('#selaudience');
    const smBox = f.querySelector('#singlememberbox');

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
        RD.toast('Imagen cargada ✔');
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
        push: f.push.checked ? 1 : 0
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
