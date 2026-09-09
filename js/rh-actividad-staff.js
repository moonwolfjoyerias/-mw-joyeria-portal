// MW JOYERÍA — RH: Actividades del Staff
//
// RH organiza la semana (crea actividades, sortea encargados, anuncia),
// revisa lo que Staff ya confirmó y firma que sí se realizó. Mismo
// patrón de autorización sin credenciales que el resto de RH (ver
// js/rh-comun.js → abrirAutorizacionRH / registrarAuditoriaRH).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida.

let actSemanaKey = semanaKeyActualActividadStaff ? semanaKeyActualActividadStaff() : '';
let actFiltroTexto = '';
let actFiltroEstado = '';
let sorteoSeleccionCatalogo = new Set();
let sorteoResultadoPreview = null;

document.addEventListener('DOMContentLoaded', () => {

  const hoy = new Date();
  const input = document.getElementById('actSemanaInput');
  if (input) input.value = formatearFechaISOActividadStaff(hoy);

  actualizarEtiquetaSemanaAct();
  renderTablaActividadesRH();
  inicializarEventosActividadStaffRH();

});

// ============================================================
// EVENTOS GENERALES
// ============================================================

function inicializarEventosActividadStaffRH() {

  document.getElementById('actSemanaInput')?.addEventListener('change', (e) => {
    actSemanaKey = semanaKeyDesdeFechaActividadStaff(e.target.value);
    actualizarEtiquetaSemanaAct();
    renderTablaActividadesRH();
  });

  document.getElementById('actSearchInput')?.addEventListener('input', (e) => {
    actFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaActividadesRH();
  });

  document.getElementById('actFilterEstado')?.addEventListener('change', (e) => {
    actFiltroEstado = e.target.value;
    renderTablaActividadesRH();
  });

  document.getElementById('actCrearBtn')?.addEventListener('click', abrirModalCrearActividad);
  document.getElementById('actSortearBtn')?.addEventListener('click', abrirModalSorteo);
  document.getElementById('actReporteBtn')?.addEventListener('click', generarReporteSemanalAct);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalAct();
  });

}

function cerrarModalAct() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function actualizarEtiquetaSemanaAct() {
  const label = document.getElementById('actSemanaLabel');
  if (label) label.textContent = `Semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}`;
}

// ============================================================
// FORMATO / UTILIDADES
// ============================================================

function escapeHTMLAct(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatearFechaHoraAct(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function mostrarErrorAct(elemento, mensaje) {
  if (!elemento) return;
  elemento.style.display = 'block';
  elemento.textContent = mensaje;
}

function sanitizarNombreArchivoAct(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function agruparPorZonaAct(asignaciones) {
  const zonasOrden = zonasCatalogoActividadesStaff();
  const grupos = new Map();
  asignaciones.forEach(a => {
    if (!grupos.has(a.zona)) grupos.set(a.zona, []);
    grupos.get(a.zona).push(a);
  });
  const zonasFinal = [...zonasOrden.filter(z => grupos.has(z)), ...[...grupos.keys()].filter(z => !zonasOrden.includes(z))];
  return zonasFinal.map(z => ({ zona: z, items: grupos.get(z) }));
}

// ============================================================
// TABLA PRINCIPAL
// ============================================================

function renderTablaActividadesRH() {

  const tbody = document.getElementById('actTableBody');
  if (!tbody) return;

  let lista = obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey);

  if (actFiltroTexto) {
    lista = lista.filter(a =>
      a.nombre.toLowerCase().includes(actFiltroTexto) ||
      a.zona.toLowerCase().includes(actFiltroTexto) ||
      (a.encargadoNombre || '').toLowerCase().includes(actFiltroTexto)
    );
  }
  if (actFiltroEstado) lista = lista.filter(a => a.estado === actFiltroEstado);

  const count = document.getElementById('actResultCount');
  if (count) count.textContent = `${lista.length} actividad${lista.length === 1 ? '' : 'es'}`;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="catalog-empty-cell"><strong>No hay actividades para esta semana</strong><span>Crea una o sortea desde el catálogo.</span></td></tr>`;
  } else {

    const grupos = agruparPorZonaAct(lista);

    tbody.innerHTML = grupos.map(g => `
      <tr class="act-zona-row"><td colspan="7" style="background:#faf7fb;font-weight:700;color:var(--mw-purple);font-size:0.8rem;">${escapeHTMLAct(g.zona)}</td></tr>
      ${g.items.map(filaActividadRH).join('')}
    `).join('');

    tbody.querySelectorAll('[data-act-editar]').forEach(btn => btn.addEventListener('click', () => abrirModalEditarActividad(btn.getAttribute('data-act-editar'))));
    tbody.querySelectorAll('[data-act-detalle]').forEach(btn => btn.addEventListener('click', () => abrirDetalleActividad(btn.getAttribute('data-act-detalle'))));
    tbody.querySelectorAll('[data-act-firmar]').forEach(btn => btn.addEventListener('click', () => confirmarFirmarRH(btn.getAttribute('data-act-firmar'))));

  }

  actualizarBotonAnunciarAct();

}

function filaActividadRH(a) {
  return `
    <tr>
      <td></td>
      <td><strong>${escapeHTMLAct(a.nombre)}</strong></td>
      <td><span class="catalog-description">${escapeHTMLAct(a.zona)}</span></td>
      <td>${PERIODICIDADES_ACTIVIDAD_STAFF[a.periodicidad] || '—'}</td>
      <td>${escapeHTMLAct(a.encargadoNombre || 'Sin asignar')}</td>
      <td><span class="badge ${BADGE_ESTADOS_ACTIVIDAD_STAFF[a.estado]}">${ESTADOS_ACTIVIDAD_STAFF[a.estado]}</span></td>
      <td style="white-space:nowrap;">
        <button type="button" class="comm-icon-btn" data-act-editar="${a.id}" title="Editar">✎</button>
        <button type="button" class="comm-icon-btn" data-act-detalle="${a.id}" title="Ver detalle e historial">⌕</button>
        ${a.estado === 'enterado' ? `<button type="button" class="comm-icon-btn" data-act-firmar="${a.id}" title="Firmar como realizada">✓</button>` : ''}
      </td>
    </tr>
  `;
}

function actualizarBotonAnunciarAct() {
  const btn = document.getElementById('actAnunciarBtn');
  if (!btn) return;
  const pendientes = obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey).filter(a => a.estado === 'borrador' && a.encargadoId);
  btn.hidden = pendientes.length === 0;
  btn.onclick = () => confirmarAnunciarActividadesAct(pendientes);
}

function confirmarAnunciarActividadesAct(pendientes) {
  abrirAutorizacionRH({
    titulo: 'Anunciar actividades',
    mensaje: `Vas a anunciar ${pendientes.length} actividad${pendientes.length === 1 ? '' : 'es'} para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}. Aparecerán de inmediato en "Mis actividades" de cada encargado.`,
    onConfirmar: () => {
      const ids = pendientes.map(a => a.id);
      const resultado = anunciarAsignacionesActividadStaff(ids, { usuarioId: RH_IDENTIDAD.usuarioId, usuarioNombre: RH_IDENTIDAD.usuarioNombre, usuarioRol: 'rh' });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'anunciar_actividades', descripcion: `${resultado.cantidad} actividad(es) anunciadas para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
      renderTablaActividadesRH();
      mostrarToast('Actividades anunciadas.');
    }
  });
}

function confirmarFirmarRH(id) {
  const a = obtenerAsignacionActividadStaffPorId(id);
  if (!a) return;
  abrirAutorizacionRH({
    titulo: 'Firmar como realizada',
    mensaje: `Confirmas que revisaste físicamente que "${escapeHTMLAct(a.nombre)}" (${escapeHTMLAct(a.zona)}) fue realizada por ${escapeHTMLAct(a.encargadoNombre)}.`,
    onConfirmar: () => {
      const resultado = firmarRHAsignacionActividadStaff(id, { usuarioId: RH_IDENTIDAD.usuarioId, usuarioNombre: RH_IDENTIDAD.usuarioNombre, usuarioRol: 'rh' });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'firmar_actividad', descripcion: `Actividad verificada y firmada: ${a.nombre} (${a.zona}) — encargado ${a.encargadoNombre}.` });
      renderTablaActividadesRH();
      mostrarToast('Actividad firmada como realizada.');
    }
  });
}

// ============================================================
// MODAL: CREAR ACTIVIDAD
// ============================================================

function abrirModalCrearActividad() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const catalogo = obtenerCatalogoActividadesStaff();
  const zonas = zonasCatalogoActividadesStaff();
  const staff = empleadosStaffActivosActividad();

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon">＋</div>
    <h3>Crear actividad</h3>

    <label for="actCatalogoSelect">Actividad</label>
    <select id="actCatalogoSelect">
      ${zonas.map(z => `
        <optgroup label="${escapeHTMLAct(z)}">
          ${catalogo.filter(c => c.zona === z).map(c => `<option value="${c.id}">${escapeHTMLAct(c.nombre)}</option>`).join('')}
        </optgroup>
      `).join('')}
      <option value="__nueva__">➕ Otra actividad (especificar)</option>
    </select>

    <div id="actNuevaWrap" style="display:none;margin-top:10px;">
      <label for="actNombreNuevo">Nombre de la actividad nueva</label>
      <input type="text" id="actNombreNuevo" placeholder="Ej. Limpiar espejos">
      <label for="actZonaNueva">Zona / vitrina</label>
      <input type="text" id="actZonaNueva" placeholder="Ej. Vitrina de relojes">
    </div>

    <label for="actPeriodicidadSelect" style="margin-top:10px;">Periodicidad</label>
    <select id="actPeriodicidadSelect">
      <option value="">Selecciona...</option>
      ${Object.entries(PERIODICIDADES_ACTIVIDAD_STAFF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
    </select>

    <label for="actEncargadoSelect">Encargado</label>
    <select id="actEncargadoSelect">
      <option value="">Sin asignar (se definirá después)</option>
      ${staff.map(e => `<option value="${e.id}">${escapeHTMLAct(e.nombre)}</option>`).join('')}
    </select>

    <label for="actSemanaSelect">Semana</label>
    <input type="date" id="actSemanaSelect" value="${document.getElementById('actSemanaInput')?.value || ''}">

    <label for="actObservaciones">Observaciones (opcional)</label>
    <textarea id="actObservaciones" rows="2" placeholder="Ej. Revisar con cuidado las charolas de exhibición."></textarea>

    <div id="actFormError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="actGuardarBtn">Crear actividad</button>
  `;

  overlay.classList.add('open');

  document.getElementById('actCatalogoSelect').addEventListener('change', (e) => {
    document.getElementById('actNuevaWrap').style.display = e.target.value === '__nueva__' ? 'block' : 'none';
  });

  document.getElementById('actGuardarBtn').addEventListener('click', () => {

    const catalogoValue = document.getElementById('actCatalogoSelect').value;
    const periodicidad = document.getElementById('actPeriodicidadSelect').value;
    const encargadoId = document.getElementById('actEncargadoSelect').value || null;
    const semanaFecha = document.getElementById('actSemanaSelect').value;
    const observaciones = document.getElementById('actObservaciones').value.trim();
    const nombreNuevo = document.getElementById('actNombreNuevo')?.value.trim() || '';
    const zonaNueva = document.getElementById('actZonaNueva')?.value.trim() || '';
    const error = document.getElementById('actFormError');

    if (!periodicidad) { mostrarErrorAct(error, 'Selecciona una periodicidad.'); return; }
    if (!semanaFecha) { mostrarErrorAct(error, 'Indica a qué semana corresponde.'); return; }
    if (catalogoValue === '__nueva__' && !nombreNuevo) { mostrarErrorAct(error, 'Escribe el nombre de la nueva actividad.'); return; }

    const datos = {
      actividadCatalogoId: catalogoValue !== '__nueva__' ? catalogoValue : null,
      nombreNuevo: catalogoValue === '__nueva__' ? nombreNuevo : null,
      zonaNueva: catalogoValue === '__nueva__' ? zonaNueva : null,
      periodicidad,
      encargadoId,
      semanaKey: semanaKeyDesdeFechaActividadStaff(semanaFecha),
      observaciones
    };

    abrirAutorizacionRH({
      titulo: 'Crear actividad',
      mensaje: `Vas a crear la actividad para la semana del ${formatearRangoSemanaActividadStaff(datos.semanaKey)}.`,
      onConfirmar: () => {
        const resultado = crearAsignacionActividadStaff({
          ...datos,
          creadoPorId: RH_IDENTIDAD.usuarioId,
          creadoPorNombre: RH_IDENTIDAD.usuarioNombre,
          creadoPorRol: 'rh'
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'crear_actividad', descripcion: `Actividad creada: ${resultado.asignacion.nombre} (${resultado.asignacion.zona}) — semana del ${formatearRangoSemanaActividadStaff(resultado.asignacion.semanaKey)}.` });
        if (resultado.asignacion.semanaKey === actSemanaKey) renderTablaActividadesRH();
        mostrarToast('Actividad creada.');
      }
    });

  });

}

// ============================================================
// MODAL: EDITAR ACTIVIDAD
// ============================================================

function abrirModalEditarActividad(id) {

  const a = obtenerAsignacionActividadStaffPorId(id);
  if (!a) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const staff = empleadosStaffActivosActividad();

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon">✎</div>
    <h3>Editar actividad</h3>
    <p class="modal-sub">${escapeHTMLAct(a.nombre)} — ${escapeHTMLAct(a.zona)}</p>

    <label for="actEditPeriodicidad">Periodicidad</label>
    <select id="actEditPeriodicidad">
      ${Object.entries(PERIODICIDADES_ACTIVIDAD_STAFF).map(([k, v]) => `<option value="${k}" ${k === a.periodicidad ? 'selected' : ''}>${v}</option>`).join('')}
    </select>

    <label for="actEditEncargado">Encargado</label>
    <select id="actEditEncargado">
      <option value="">Sin asignar</option>
      ${staff.map(e => `<option value="${e.id}" ${e.id === a.encargadoId ? 'selected' : ''}>${escapeHTMLAct(e.nombre)}</option>`).join('')}
    </select>

    <label for="actEditSemana">Semana</label>
    <input type="date" id="actEditSemana" value="${a.semanaKey}">

    <label for="actEditObservaciones">Observaciones</label>
    <textarea id="actEditObservaciones" rows="2">${escapeHTMLAct(a.observaciones)}</textarea>

    ${a.estado !== 'borrador' ? '<div class="modal-note">Esta actividad ya fue anunciada — cualquier cambio quedará registrado en el historial.</div>' : ''}

    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="actGuardarEdicionBtn">Guardar cambios</button>
  `;

  overlay.classList.add('open');

  document.getElementById('actGuardarEdicionBtn').addEventListener('click', () => {

    const cambios = {
      periodicidad: document.getElementById('actEditPeriodicidad').value,
      encargadoId: document.getElementById('actEditEncargado').value || null,
      semanaKey: semanaKeyDesdeFechaActividadStaff(document.getElementById('actEditSemana').value),
      observaciones: document.getElementById('actEditObservaciones').value.trim()
    };

    abrirAutorizacionRH({
      titulo: 'Guardar cambios',
      mensaje: `Vas a actualizar "${escapeHTMLAct(a.nombre)}".`,
      onConfirmar: () => {
        const resultado = actualizarAsignacionActividadStaff(a.id, cambios, { usuarioId: RH_IDENTIDAD.usuarioId, usuarioNombre: RH_IDENTIDAD.usuarioNombre, usuarioRol: 'rh' });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'editar_actividad', descripcion: `Actividad editada: ${a.nombre} (${a.zona}).` });
        renderTablaActividadesRH();
        mostrarToast('Actividad actualizada.');
      }
    });

  });

}

// ============================================================
// MODAL: DETALLE + HISTORIAL
// ============================================================

function abrirDetalleActividad(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const a = obtenerAsignacionActividadStaffPorId(id);
  if (!overlay || !box || !a) return;

  const historial = obtenerHistorialPorActividadStaff(id);

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <span class="eyebrow">${escapeHTMLAct(a.id)}</span>
    <h3 style="margin-top:5px;">${escapeHTMLAct(a.nombre)}</h3>

    <div class="modal-context">
      <span>Zona</span><strong>${escapeHTMLAct(a.zona)}</strong>
      <span>Periodicidad</span><strong>${PERIODICIDADES_ACTIVIDAD_STAFF[a.periodicidad] || '—'}</strong>
      <span>Encargado</span><strong>${escapeHTMLAct(a.encargadoNombre || 'Sin asignar')}</strong>
      <span>Semana</span><strong>${formatearRangoSemanaActividadStaff(a.semanaKey)}</strong>
      <span>Estado</span><span class="badge ${BADGE_ESTADOS_ACTIVIDAD_STAFF[a.estado]}">${ESTADOS_ACTIVIDAD_STAFF[a.estado]}</span>
      ${a.observaciones ? `<span>Observaciones</span><strong>${escapeHTMLAct(a.observaciones)}</strong>` : ''}
      ${a.fechaEnterado ? `<span>Se enteró</span><strong>${escapeHTMLAct(a.enteradoPorNombre)} · ${formatearFechaHoraAct(a.fechaEnterado)}</strong>` : ''}
      ${a.fechaFirmaRH ? `<span>Firmado por RH</span><strong>${escapeHTMLAct(a.firmadoPorNombre)} · ${formatearFechaHoraAct(a.fechaFirmaRH)}</strong>` : ''}
    </div>

    <div class="eyebrow" style="margin-top:14px;">Historial</div>
    <div style="max-height:220px;overflow-y:auto;margin-top:6px;">
      ${historial.length ? historial.map(h => `
        <div class="act-historial-item">
          <strong>${escapeHTMLAct(h.comentario)}</strong>
          <small>${escapeHTMLAct(h.usuarioNombre || '—')} · ${formatearFechaHoraAct(h.fecha)}</small>
        </div>
      `).join('') : '<p class="bp-sub">Sin cambios registrados todavía.</p>'}
    </div>

    <button class="btn btn-outline" style="width:100%;margin-top:12px;" onclick="cerrarModalAct()">Cerrar</button>
  `;

  overlay.classList.add('open');

}

// ============================================================
// SORTEO ALEATORIO
// ============================================================

function abrirModalSorteo() {
  sorteoSeleccionCatalogo = new Set(
    obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey)
      .filter(a => a.estado === 'borrador')
      .map(a => a.actividadCatalogoId)
  );
  sorteoResultadoPreview = null;
  document.getElementById('modalOverlay')?.classList.add('open');
  renderPasoSeleccionSorteo();
}

function renderPasoSeleccionSorteo() {

  const box = document.getElementById('modalBox');
  if (!box) return;

  const catalogo = obtenerCatalogoActividadesStaff();
  const zonas = zonasCatalogoActividadesStaff();
  const asignacionesSemana = obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey);
  const yaOcupadas = new Set(asignacionesSemana.filter(a => a.estado !== 'borrador').map(a => a.actividadCatalogoId));

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon">🎲</div>
    <h3>Sortear actividades</h3>
    <p class="modal-sub">Elige qué actividades entran al sorteo de la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}. Las ya anunciadas no pueden volver a sortearse.</p>

    <label for="actSorteoPeriodicidad">Periodicidad para las actividades nuevas de este sorteo</label>
    <select id="actSorteoPeriodicidad">
      <option value="">Selecciona...</option>
      ${Object.entries(PERIODICIDADES_ACTIVIDAD_STAFF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
    </select>

    <div class="eyebrow" style="margin-top:14px;">Actividades a sortear</div>
    <div style="max-height:280px;overflow-y:auto;margin-top:6px;">
      ${zonas.map(z => `
        <div class="act-zona-group">
          <div class="act-zona-title">${escapeHTMLAct(z)}</div>
          ${catalogo.filter(c => c.zona === z).map(c => {
            const bloqueada = yaOcupadas.has(c.id);
            return `
              <label class="act-checklist-item ${bloqueada ? 'ya-anunciada' : ''}">
                <input type="checkbox" data-sorteo-cat="${c.id}" ${sorteoSeleccionCatalogo.has(c.id) ? 'checked' : ''} ${bloqueada ? 'disabled' : ''}>
                ${escapeHTMLAct(c.nombre)}
                ${bloqueada ? '<span class="act-checklist-tag">ya anunciada</span>' : ''}
              </label>
            `;
          }).join('')}
        </div>
      `).join('')}
    </div>

    <div id="actSorteoError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:12px;" id="actSortearAhoraBtn">🎲 Sortear</button>
  `;

  box.querySelectorAll('[data-sorteo-cat]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.getAttribute('data-sorteo-cat');
      if (chk.checked) sorteoSeleccionCatalogo.add(id); else sorteoSeleccionCatalogo.delete(id);
    });
  });

  document.getElementById('actSortearAhoraBtn').addEventListener('click', () => {

    const periodicidad = document.getElementById('actSorteoPeriodicidad').value;
    const error = document.getElementById('actSorteoError');

    if (!periodicidad) { mostrarErrorAct(error, 'Selecciona la periodicidad para este sorteo.'); return; }
    if (!sorteoSeleccionCatalogo.size) { mostrarErrorAct(error, 'Selecciona al menos una actividad.'); return; }

    const idsParaSortear = [];
    sorteoSeleccionCatalogo.forEach(catId => {
      let existente = obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey).find(a => a.actividadCatalogoId === catId && a.estado === 'borrador');
      if (!existente) {
        const resultado = crearAsignacionActividadStaff({
          actividadCatalogoId: catId,
          periodicidad,
          encargadoId: null,
          semanaKey: actSemanaKey,
          creadoPorId: RH_IDENTIDAD.usuarioId,
          creadoPorNombre: RH_IDENTIDAD.usuarioNombre,
          creadoPorRol: 'rh'
        });
        if (resultado.ok) existente = resultado.asignacion;
      }
      if (existente) idsParaSortear.push(existente.id);
    });

    ejecutarSorteoYMostrarPreview(idsParaSortear);

  });

}

function ejecutarSorteoYMostrarPreview(idsParaSortear) {
  const resultado = sortearActividadesStaff(idsParaSortear);
  if (!resultado.ok) { mostrarToast(resultado.error); return; }
  sorteoResultadoPreview = resultado.resultado;
  renderPasoPreviewSorteo();
}

function renderPasoPreviewSorteo() {

  const box = document.getElementById('modalBox');
  if (!box) return;

  const staff = empleadosStaffActivosActividad();

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon">🎲</div>
    <h3>Resultado del sorteo</h3>
    <p class="modal-sub">Revisa el reparto antes de guardarlo. Puedes cambiar cualquier encargado a mano.</p>

    <div style="max-height:300px;overflow-y:auto;margin-top:8px;">
      ${sorteoResultadoPreview.map((fila, i) => `
        <div class="act-sorteo-row">
          <span><strong>${escapeHTMLAct(fila.actividadNombre)}</strong><br><small style="color:var(--mw-text-muted);">${escapeHTMLAct(fila.zona)}</small></span>
          <select data-sorteo-fila="${i}">
            ${staff.map(e => `<option value="${e.id}" ${e.id === fila.encargadoId ? 'selected' : ''}>${escapeHTMLAct(e.nombre)}</option>`).join('')}
          </select>
        </div>
      `).join('')}
    </div>

    <div style="display:flex;gap:10px;margin-top:12px;">
      <button class="btn btn-outline" style="flex:1;" id="actRepetirSorteoBtn" type="button">🎲 Repetir sorteo</button>
      <button class="btn btn-primary" style="flex:1;" id="actGuardarRepartoBtn" type="button">Guardar reparto</button>
    </div>
  `;

  box.querySelectorAll('[data-sorteo-fila]').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = parseInt(sel.getAttribute('data-sorteo-fila'), 10);
      const empleado = staff.find(e => e.id === sel.value);
      if (empleado) {
        sorteoResultadoPreview[i].encargadoId = empleado.id;
        sorteoResultadoPreview[i].encargadoNombre = empleado.nombre;
      }
    });
  });

  document.getElementById('actRepetirSorteoBtn').addEventListener('click', () => {
    const ids = sorteoResultadoPreview.map(f => f.asignacionId);
    ejecutarSorteoYMostrarPreview(ids);
  });

  document.getElementById('actGuardarRepartoBtn').addEventListener('click', () => {
    const cantidad = sorteoResultadoPreview.length;
    aplicarResultadoSorteoActividadStaff(sorteoResultadoPreview, {
      usuarioId: RH_IDENTIDAD.usuarioId, usuarioNombre: RH_IDENTIDAD.usuarioNombre, usuarioRol: 'rh'
    });
    registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'sorteo_actividades', descripcion: `Reparto de ${cantidad} actividad(es) guardado para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
    cerrarModalAct();
    renderTablaActividadesRH();
    mostrarToast('Reparto guardado. Actividades listas para anunciar.');
  });

}

// ============================================================
// REPORTE SEMANAL (PDF Carta)
// ============================================================

async function generarReporteSemanalAct() {

  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el reporte — intenta de nuevo en un momento.');
    return;
  }

  const filas = obtenerFilasReporteSemanalActividadStaff(actSemanaKey);
  const contenedor = document.getElementById('actPdfTemplate');
  contenedor.innerHTML = construirHTMLReporteSemanalAct(filas, actSemanaKey);

  try {

    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(contenedor, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
    agregarCanvasPaginadoAct(pdf, canvas);
    pdf.save(`MW_Actividades_Staff_${sanitizarNombreArchivoAct(actSemanaKey)}.pdf`);

    if (typeof registrarAuditoriaRH === 'function') {
      registrarAuditoriaRH({ modulo: 'actividades_staff', accion: 'generar_reporte', descripcion: `Reporte semanal generado — semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
    }

    mostrarToast('Reporte generado.');

  } catch (error) {
    mostrarToast('No se pudo generar el reporte — intenta de nuevo en un momento.');
  } finally {
    contenedor.innerHTML = '';
  }

}

// Reparte un canvas alto en tantas páginas Carta como haga falta —
// nunca deforma ni recorta el ancho, solo divide el alto en franjas
// completas (usado también por Admin, ver admin-actividad-staff.js).
function agregarCanvasPaginadoAct(pdf, canvas) {

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margen = 24;
  const anchoDisponible = pageWidth - margen * 2;
  const altoDisponible = pageHeight - margen * 2;

  const escala = anchoDisponible / canvas.width;
  const altoTotalEscalado = canvas.height * escala;

  if (altoTotalEscalado <= altoDisponible) {
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margen, margen, anchoDisponible, altoTotalEscalado);
    return;
  }

  const altoDisponibleEnPx = altoDisponible / escala;
  let restante = canvas.height;
  let offset = 0;
  let primera = true;

  while (restante > 0) {
    const alturaFranja = Math.min(altoDisponibleEnPx, restante);
    const franja = document.createElement('canvas');
    franja.width = canvas.width;
    franja.height = alturaFranja;
    franja.getContext('2d').drawImage(canvas, 0, offset, canvas.width, alturaFranja, 0, 0, canvas.width, alturaFranja);

    if (!primera) pdf.addPage();
    pdf.addImage(franja.toDataURL('image/png'), 'PNG', margen, margen, anchoDisponible, alturaFranja * escala);

    offset += alturaFranja;
    restante -= alturaFranja;
    primera = false;
  }

}

function construirHTMLReporteSemanalAct(filas, semanaKey) {

  const fechaGeneracion = new Date().toLocaleString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' });

  return `
    <div style="font-family:Calibri,Arial,sans-serif;color:#000;padding:20px;background:#fff;width:720px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #DAC2EC;padding-bottom:10px;">
        <div>
          <h1 style="margin:0;font-size:18px;color:#5b3a73;">Reporte semanal de actividades del Staff</h1>
          <p style="margin:4px 0 0;font-size:11px;">Semana del ${formatearRangoSemanaActividadStaff(semanaKey)}</p>
          <p style="margin:2px 0 0;font-size:9.5px;color:#666;">Generado el ${fechaGeneracion}</p>
        </div>
        <img src="../../assets/images/imagotipo-completo-negro.png" alt="MW JOYERÍA" style="width:90px;height:auto;object-fit:contain;">
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:10px;">
        <thead>
          <tr style="background:#DAC2EC;">
            <th style="border:1px solid #000;padding:5px;text-align:left;">Actividad</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Zona</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Periodicidad</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Encargado</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Estado final</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Fecha de confirmación</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">RH que verificó</th>
          </tr>
        </thead>
        <tbody>
          ${filas.length ? filas.map(f => `
            <tr>
              <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.nombre)}</td>
              <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.zona)}</td>
              <td style="border:1px solid #000;padding:5px;">${PERIODICIDADES_ACTIVIDAD_STAFF[f.periodicidad] || '—'}</td>
              <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.encargadoNombre || '—')}</td>
              <td style="border:1px solid #000;padding:5px;font-weight:700;${f.estadoReporteLabel === 'No se realizó' ? 'color:#a3272f;' : 'color:#1f7a34;'}">${f.estadoReporteLabel}</td>
              <td style="border:1px solid #000;padding:5px;">${f.fechaEnterado ? formatearFechaHoraAct(f.fechaEnterado) : '—'}</td>
              <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.firmadoPorNombre || '—')}</td>
            </tr>
          `).join('') : `<tr><td colspan="7" style="border:1px solid #000;padding:10px;text-align:center;">No se anunciaron actividades esta semana.</td></tr>`}
        </tbody>
      </table>

      <div style="margin-top:14px;font-size:9px;color:#555;line-height:1.5;">
        <strong>Enterado</strong> = el empleado confirmó que conocía la actividad. <strong>Firmado por RH</strong> = RH confirmó que la actividad fue realizada. <strong>No se realizó</strong> = al cierre de la semana no existía confirmación de cumplimiento por RH.
      </div>
    </div>
  `;

}
