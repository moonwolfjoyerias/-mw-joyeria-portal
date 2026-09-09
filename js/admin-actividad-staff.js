// MW JOYERÍA — Admin: Actividades del Staff
//
// Dos vistas (ver js/rh-actividad-staff.js para la versión de RH, con
// las mismas capacidades de organizar/sortear/anunciar/firmar — las
// actividades base ya están precargadas, ver asegurarAsignacionesBaseSemana
// en el modelo):
// - "Semana en organización": mismo flujo operativo que ya tiene RH.
// - "Todas las actividades": supervisión — historial completo de TODAS
//   las semanas, filtrable por semana/empleado/zona/estado (sección 9
//   del prompt), con acceso al detalle e historial de cada actividad.
//
// Mismo patrón de autorización sin credenciales que el resto de Admin
// (ver js/admin-comun.js → abrirAutorizacionAdmin / registrarAuditoriaAdmin).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida.

let actSemanaKey = semanaKeyActualActividadStaff ? semanaKeyActualActividadStaff() : '';
let actFiltroTexto = '';
let actFiltroEstado = '';
let sorteoResultadoPreview = null;

let actVistaActual = 'semana';
let actTodasFiltroTexto = '';
let actTodasFiltroEmpleado = '';
let actTodasFiltroZona = '';
let actTodasFiltroEstado = '';
let actTodasDesde = '';
let actTodasHasta = '';

document.addEventListener('DOMContentLoaded', () => {

  const hoy = new Date();
  const input = document.getElementById('actSemanaInput');
  if (input) input.value = formatearFechaISOActividadStaff(hoy);

  asegurarAsignacionesBaseSemana(actSemanaKey);
  actualizarEtiquetaSemanaAct();
  renderTablaActividadesAdmin();
  inicializarEventosActividadStaffAdmin();
  inicializarVistaTodasAct();

});

// ============================================================
// NAVEGACIÓN ENTRE VISTAS
// ============================================================

function inicializarEventosActividadStaffAdmin() {

  document.querySelectorAll('#actNavPrincipal [data-act-vista]').forEach(btn => {
    btn.addEventListener('click', () => {
      actVistaActual = btn.getAttribute('data-act-vista');
      document.querySelectorAll('#actNavPrincipal [data-act-vista]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('actVistaSemana').hidden = actVistaActual !== 'semana';
      document.getElementById('actVistaTodas').hidden = actVistaActual !== 'todas';
      if (actVistaActual === 'todas') renderTablaTodasAct();
    });
  });

  document.getElementById('actSemanaInput')?.addEventListener('change', (e) => {
    actSemanaKey = semanaKeyDesdeFechaActividadStaff(e.target.value);
    asegurarAsignacionesBaseSemana(actSemanaKey);
    actualizarEtiquetaSemanaAct();
    renderTablaActividadesAdmin();
  });

  document.getElementById('actSearchInput')?.addEventListener('input', (e) => {
    actFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaActividadesAdmin();
  });

  document.getElementById('actFilterEstado')?.addEventListener('change', (e) => {
    actFiltroEstado = e.target.value;
    renderTablaActividadesAdmin();
  });

  document.getElementById('actCrearBtn')?.addEventListener('click', abrirModalCrearActividad);
  document.getElementById('actSortearBtn')?.addEventListener('click', abrirModalSorteo);
  document.getElementById('actReporteBtn')?.addEventListener('click', generarReporteSemanalAct);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalAct();
  });

}

// ============================================================
// VISTA: TODAS LAS ACTIVIDADES (supervisión — sección 9 del prompt)
// ============================================================

function inicializarVistaTodasAct() {

  const empleadoSelect = document.getElementById('actTodasFilterEmpleado');
  if (empleadoSelect) {
    empleadosStaffActivosActividad().forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.id;
      opt.textContent = e.nombre;
      empleadoSelect.appendChild(opt);
    });
  }

  const zonaSelect = document.getElementById('actTodasFilterZona');
  if (zonaSelect) {
    zonasCatalogoActividadesStaff().forEach(z => {
      const opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z;
      zonaSelect.appendChild(opt);
    });
  }

  document.getElementById('actTodasSearchInput')?.addEventListener('input', (e) => {
    actTodasFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaTodasAct();
  });
  document.getElementById('actTodasFilterEmpleado')?.addEventListener('change', (e) => {
    actTodasFiltroEmpleado = e.target.value;
    renderTablaTodasAct();
  });
  document.getElementById('actTodasFilterZona')?.addEventListener('change', (e) => {
    actTodasFiltroZona = e.target.value;
    renderTablaTodasAct();
  });
  document.getElementById('actTodasFilterEstado')?.addEventListener('change', (e) => {
    actTodasFiltroEstado = e.target.value;
    renderTablaTodasAct();
  });
  document.getElementById('actTodasDesde')?.addEventListener('change', (e) => {
    actTodasDesde = e.target.value;
    renderTablaTodasAct();
  });
  document.getElementById('actTodasHasta')?.addEventListener('change', (e) => {
    actTodasHasta = e.target.value;
    renderTablaTodasAct();
  });

}

function renderTablaTodasAct() {

  const tbody = document.getElementById('actTodasTableBody');
  if (!tbody) return;

  let lista = obtenerAsignacionesActividadStaff().filter(a => a.estado !== 'borrador');

  if (actTodasFiltroTexto) {
    lista = lista.filter(a => a.nombre.toLowerCase().includes(actTodasFiltroTexto) || a.zona.toLowerCase().includes(actTodasFiltroTexto));
  }
  if (actTodasFiltroEmpleado) lista = lista.filter(a => a.encargadoId === actTodasFiltroEmpleado);
  if (actTodasFiltroZona) lista = lista.filter(a => a.zona === actTodasFiltroZona);
  if (actTodasFiltroEstado) lista = lista.filter(a => a.estado === actTodasFiltroEstado);
  if (actTodasDesde) lista = lista.filter(a => a.semanaKey >= actTodasDesde);
  if (actTodasHasta) lista = lista.filter(a => a.semanaKey <= actTodasHasta);

  lista = [...lista].sort((a, b) => b.semanaKey.localeCompare(a.semanaKey));

  const count = document.getElementById('actTodasResultCount');
  if (count) count.textContent = `${lista.length} actividad${lista.length === 1 ? '' : 'es'}`;

  if (!lista.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="catalog-empty-cell"><strong>No hay actividades con estos filtros</strong><span>Prueba con otro criterio.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = lista.map(a => `
    <tr>
      <td><strong>${escapeHTMLAct(a.nombre)}</strong></td>
      <td><span class="catalog-description">${escapeHTMLAct(a.zona)}</span></td>
      <td><span class="catalog-description">${formatearRangoSemanaActividadStaff(a.semanaKey)}</span></td>
      <td>${escapeHTMLAct(formatearDiasAsignacionActividadStaff(a))}</td>
      <td>${escapeHTMLAct(a.encargadoNombre || 'Sin asignar')}</td>
      <td><span class="badge ${BADGE_ESTADOS_ACTIVIDAD_STAFF[a.estado]}">${ESTADOS_ACTIVIDAD_STAFF[a.estado]}</span></td>
      <td><button class="action-btn detail-action" data-act-detalle="${a.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></span> Ver detalle</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-act-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleActividad(btn.getAttribute('data-act-detalle')));
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
// CAMPOS DE PERIODICIDAD (compartidos entre Crear y Editar)
// ============================================================
//
// Solo tres periodicidades (sección 3 del prompt): Diaria (sin días),
// X días (varios días de la semana, checkboxes) y Semanalmente (un
// único día, select). El bloque de días se muestra/oculta según lo
// que se elija.

function construirCamposPeriodicidadAct(prefix, periodicidadActual, diasActuales) {
  const dias = diasActuales || [];
  return `
    <label for="${prefix}Periodicidad">Periodicidad</label>
    <select id="${prefix}Periodicidad">
      <option value="">Sin definir</option>
      ${Object.entries(PERIODICIDADES_ACTIVIDAD_STAFF).map(([k, v]) => `<option value="${k}" ${k === periodicidadActual ? 'selected' : ''}>${v}</option>`).join('')}
    </select>

    <div id="${prefix}DiaSemanalWrap" style="display:${periodicidadActual === 'semanal' ? 'block' : 'none'};margin-top:8px;">
      <label for="${prefix}DiaSemana">Día de la semana</label>
      <select id="${prefix}DiaSemana">
        <option value="">Selecciona...</option>
        ${ORDEN_DIAS_ACTIVIDAD_STAFF.map(d => `<option value="${d}" ${dias[0] === d ? 'selected' : ''}>${DIAS_SEMANA_ACTIVIDAD_STAFF[d]}</option>`).join('')}
      </select>
    </div>

    <div id="${prefix}DiasMultiWrap" style="display:${periodicidadActual === 'x_dias' ? 'block' : 'none'};margin-top:8px;">
      <label>Días de la semana</label>
      <div class="act-dias-grid">
        ${ORDEN_DIAS_ACTIVIDAD_STAFF.map(d => `
          <label class="act-dia-check">
            <input type="checkbox" data-dia-multi="${prefix}" value="${d}" ${dias.includes(d) ? 'checked' : ''}>
            ${DIAS_SEMANA_ACTIVIDAD_STAFF[d]}
          </label>
        `).join('')}
      </div>
    </div>
  `;
}

function wireCamposPeriodicidadAct(prefix) {
  document.getElementById(`${prefix}Periodicidad`)?.addEventListener('change', (e) => {
    const val = e.target.value;
    document.getElementById(`${prefix}DiaSemanalWrap`).style.display = val === 'semanal' ? 'block' : 'none';
    document.getElementById(`${prefix}DiasMultiWrap`).style.display = val === 'x_dias' ? 'block' : 'none';
  });
}

function leerCamposPeriodicidadAct(prefix) {
  const periodicidad = document.getElementById(`${prefix}Periodicidad`).value || null;
  let dias = [];
  if (periodicidad === 'semanal') {
    const d = document.getElementById(`${prefix}DiaSemana`).value;
    dias = d ? [d] : [];
  } else if (periodicidad === 'x_dias') {
    dias = Array.from(document.querySelectorAll(`[data-dia-multi="${prefix}"]:checked`)).map(el => el.value);
  }
  return { periodicidad, dias };
}

// ============================================================
// TABLA PRINCIPAL
// ============================================================

function renderTablaActividadesAdmin() {

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
    tbody.innerHTML = `<tr><td colspan="8" class="catalog-empty-cell"><strong>No hay actividades para esta semana</strong><span>Prueba con otro filtro.</span></td></tr>`;
  } else {

    const grupos = agruparPorZonaAct(lista);

    tbody.innerHTML = grupos.map(g => `
      <tr class="act-zona-row"><td colspan="8" style="background:#faf7fb;font-weight:700;color:var(--mw-purple);font-size:0.8rem;">${escapeHTMLAct(g.zona)}</td></tr>
      ${g.items.map(filaActividadAdmin).join('')}
    `).join('');

    tbody.querySelectorAll('[data-act-editar]').forEach(btn => btn.addEventListener('click', () => abrirModalEditarActividad(btn.getAttribute('data-act-editar'))));
    tbody.querySelectorAll('[data-act-detalle]').forEach(btn => btn.addEventListener('click', () => abrirDetalleActividad(btn.getAttribute('data-act-detalle'))));
    tbody.querySelectorAll('[data-act-firmar]').forEach(btn => btn.addEventListener('click', () => confirmarFirmarAdmin(btn.getAttribute('data-act-firmar'))));

  }

  actualizarBotonAnunciarAct();

}

function filaActividadAdmin(a) {
  return `
    <tr>
      <td></td>
      <td><strong>${escapeHTMLAct(a.nombre)}</strong></td>
      <td><span class="catalog-description">${escapeHTMLAct(a.zona)}</span></td>
      <td>${a.periodicidad ? PERIODICIDADES_ACTIVIDAD_STAFF[a.periodicidad] : '<span class="catalog-description">Sin definir</span>'}</td>
      <td>${escapeHTMLAct(formatearDiasAsignacionActividadStaff(a))}</td>
      <td>${escapeHTMLAct(a.encargadoNombre || 'Sin asignar')}</td>
      <td><span class="badge ${BADGE_ESTADOS_ACTIVIDAD_STAFF[a.estado]}">${ESTADOS_ACTIVIDAD_STAFF[a.estado]}</span></td>
      <td style="white-space:nowrap;">
        <button type="button" class="comm-icon-btn" data-act-editar="${a.id}" title="Editar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg></button>
        <button type="button" class="comm-icon-btn" data-act-detalle="${a.id}" title="Ver detalle e historial"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></button>
        ${a.estado === 'enterado' ? `<button type="button" class="comm-icon-btn" data-act-firmar="${a.id}" title="Firmar por RH"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></button>` : ''}
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
  abrirAutorizacionAdmin({
    titulo: 'Anunciar actividades',
    mensaje: `Vas a anunciar ${pendientes.length} actividad${pendientes.length === 1 ? '' : 'es'} para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}. Aparecerán de inmediato en "Mis actividades" de cada encargado.`,
    onConfirmar: () => {
      const ids = pendientes.map(a => a.id);
      const resultado = anunciarAsignacionesActividadStaff(ids, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre, usuarioRol: 'admin' });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'anunciar_actividades', descripcion: `${resultado.cantidad} actividad(es) anunciadas para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
      renderTablaActividadesAdmin();
      mostrarToast('Actividades anunciadas.');
    }
  });
}

function confirmarFirmarAdmin(id) {
  const a = obtenerAsignacionActividadStaffPorId(id);
  if (!a) return;
  abrirAutorizacionAdmin({
    titulo: 'Firmar por RH',
    mensaje: `Confirmas que revisaste físicamente que "${escapeHTMLAct(a.nombre)}" (${escapeHTMLAct(a.zona)}) fue realizada por ${escapeHTMLAct(a.encargadoNombre)}.`,
    onConfirmar: () => {
      const resultado = firmarRHAsignacionActividadStaff(id, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre, usuarioRol: 'admin' });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'firmar_actividad', descripcion: `Actividad verificada y firmada: ${a.nombre} (${a.zona}) — encargado ${a.encargadoNombre}.` });
      renderTablaActividadesAdmin();
      mostrarToast('Actividad firmada por RH.');
    }
  });
}

// ============================================================
// MODAL: CREAR ACTIVIDAD (nombre libre — sin dropdown de catálogo)
// ============================================================

function abrirModalCrearActividad() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const zonas = zonasCatalogoActividadesStaff();
  const staff = empleadosStaffActivosActividad();

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon">＋</div>
    <h3>Crear actividad</h3>
    <p class="modal-sub">Para agregar una actividad nueva que no está en la lista base — escribe su nombre.</p>

    <label for="actNombre">Nombre de la actividad</label>
    <input type="text" id="actNombre" placeholder="Ej. Limpiar puerta de entrada">

    <label for="actZonaSelect">Zona / vitrina</label>
    <select id="actZonaSelect">
      ${zonas.map(z => `<option value="${escapeHTMLAct(z)}">${escapeHTMLAct(z)}</option>`).join('')}
      <option value="__nueva__">+ Otra zona (especificar)</option>
    </select>
    <div id="actZonaNuevaWrap" style="display:none;margin-top:8px;">
      <label for="actZonaNueva">Nombre de la nueva zona</label>
      <input type="text" id="actZonaNueva" placeholder="Ej. Vitrina de relojes">
    </div>

    <div style="margin-top:10px;">
      ${construirCamposPeriodicidadAct('actCrear', '', [])}
    </div>

    <label for="actEncargadoSelect" style="margin-top:10px;">Encargado</label>
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
  wireCamposPeriodicidadAct('actCrear');

  document.getElementById('actZonaSelect').addEventListener('change', (e) => {
    document.getElementById('actZonaNuevaWrap').style.display = e.target.value === '__nueva__' ? 'block' : 'none';
  });

  document.getElementById('actGuardarBtn').addEventListener('click', () => {

    const nombre = document.getElementById('actNombre').value.trim();
    const zonaValue = document.getElementById('actZonaSelect').value;
    const zonaNueva = zonaValue === '__nueva__' ? document.getElementById('actZonaNueva').value.trim() : zonaValue;
    const { periodicidad, dias } = leerCamposPeriodicidadAct('actCrear');
    const encargadoId = document.getElementById('actEncargadoSelect').value || null;
    const semanaFecha = document.getElementById('actSemanaSelect').value;
    const observaciones = document.getElementById('actObservaciones').value.trim();
    const error = document.getElementById('actFormError');

    if (!nombre) { mostrarErrorAct(error, 'Escribe el nombre de la actividad.'); return; }
    if (!zonaNueva) { mostrarErrorAct(error, 'Indica la zona/vitrina.'); return; }
    if (!semanaFecha) { mostrarErrorAct(error, 'Indica a qué semana corresponde.'); return; }
    if (periodicidad) {
      const validacion = validarPeriodicidadYDiasActividadStaff(periodicidad, dias);
      if (!validacion.ok) { mostrarErrorAct(error, validacion.error); return; }
    }

    const datos = {
      nombreNuevo: nombre,
      zonaNueva,
      periodicidad,
      dias,
      encargadoId,
      semanaKey: semanaKeyDesdeFechaActividadStaff(semanaFecha),
      observaciones
    };

    abrirAutorizacionAdmin({
      titulo: 'Crear actividad',
      mensaje: `Vas a crear "${escapeHTMLAct(nombre)}" para la semana del ${formatearRangoSemanaActividadStaff(datos.semanaKey)}.`,
      onConfirmar: () => {
        const resultado = crearAsignacionActividadStaff({
          ...datos,
          creadoPorId: ADMIN_IDENTIDAD.usuarioId,
          creadoPorNombre: ADMIN_IDENTIDAD.usuarioNombre,
          creadoPorRol: 'admin'
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'crear_actividad', descripcion: `Actividad creada: ${resultado.asignacion.nombre} (${resultado.asignacion.zona}) — semana del ${formatearRangoSemanaActividadStaff(resultado.asignacion.semanaKey)}.` });
        if (resultado.asignacion.semanaKey === actSemanaKey) renderTablaActividadesAdmin();
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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg></div>
    <h3>Editar actividad</h3>
    <p class="modal-sub">${escapeHTMLAct(a.nombre)} — ${escapeHTMLAct(a.zona)}</p>

    ${construirCamposPeriodicidadAct('actEdit', a.periodicidad || '', a.dias || [])}

    <label for="actEditEncargado" style="margin-top:10px;">Encargado</label>
    <select id="actEditEncargado">
      <option value="">Sin asignar</option>
      ${staff.map(e => `<option value="${e.id}" ${e.id === a.encargadoId ? 'selected' : ''}>${escapeHTMLAct(e.nombre)}</option>`).join('')}
    </select>

    <label for="actEditSemana">Semana</label>
    <input type="date" id="actEditSemana" value="${a.semanaKey}">

    <label for="actEditObservaciones">Observaciones</label>
    <textarea id="actEditObservaciones" rows="2">${escapeHTMLAct(a.observaciones)}</textarea>

    ${a.estado !== 'borrador' ? '<div class="modal-note">Esta actividad ya fue anunciada — cualquier cambio quedará registrado en el historial.</div>' : ''}

    <div id="actEditFormError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="actGuardarEdicionBtn">Guardar cambios</button>
  `;

  overlay.classList.add('open');
  wireCamposPeriodicidadAct('actEdit');

  document.getElementById('actGuardarEdicionBtn').addEventListener('click', () => {

    const { periodicidad, dias } = leerCamposPeriodicidadAct('actEdit');
    const error = document.getElementById('actEditFormError');

    const validacion = validarPeriodicidadYDiasActividadStaff(periodicidad, dias);
    if (!validacion.ok) { mostrarErrorAct(error, validacion.error); return; }

    const cambios = {
      periodicidad,
      dias,
      encargadoId: document.getElementById('actEditEncargado').value || null,
      semanaKey: semanaKeyDesdeFechaActividadStaff(document.getElementById('actEditSemana').value),
      observaciones: document.getElementById('actEditObservaciones').value.trim()
    };

    abrirAutorizacionAdmin({
      titulo: 'Guardar cambios',
      mensaje: `Vas a actualizar "${escapeHTMLAct(a.nombre)}".`,
      onConfirmar: () => {
        const resultado = actualizarAsignacionActividadStaff(a.id, cambios, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre, usuarioRol: 'admin' });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'editar_actividad', descripcion: `Actividad editada: ${a.nombre} (${a.zona}).` });
        renderTablaActividadesAdmin();
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
      <span>Periodicidad</span><strong>${a.periodicidad ? PERIODICIDADES_ACTIVIDAD_STAFF[a.periodicidad] : 'Sin definir'}</strong>
      <span>Día</span><strong>${escapeHTMLAct(formatearDiasAsignacionActividadStaff(a))}</strong>
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
// SORTEO POR ZONA/VITRINA
// ============================================================

function abrirModalSorteo() {
  sorteoResultadoPreview = null;
  document.getElementById('modalOverlay')?.classList.add('open');
  renderPasoSeleccionSorteo();
}

function renderPasoSeleccionSorteo() {

  const box = document.getElementById('modalBox');
  if (!box) return;

  const zonas = zonasCatalogoActividadesStaff();
  const asignacionesSemana = obtenerAsignacionesPorSemanaActividadStaff(actSemanaKey);
  const zonasDisponibles = zonas.filter(z => asignacionesSemana.some(a => a.zona === z && a.estado === 'borrador'));

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalAct()">×</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg></div>
    <h3>Sortear actividades</h3>
    <p class="modal-sub">El sorteo reparte ZONAS/VITRINAS completas entre el Staff activo para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)} — todas las actividades de una misma zona quedan con el mismo encargado.</p>

    <label class="act-checklist-item act-checklist-todo">
      <input type="checkbox" id="actSorteoTodo" ${zonasDisponibles.length ? '' : 'disabled'}>
      <strong>Seleccionar todo</strong>
    </label>

    <div style="max-height:280px;overflow-y:auto;margin-top:6px;">
      ${zonasDisponibles.length ? zonasDisponibles.map(z => `
        <label class="act-checklist-item">
          <input type="checkbox" data-sorteo-zona="${escapeHTMLAct(z)}">
          ${escapeHTMLAct(z)}
        </label>
      `).join('') : '<p class="bp-sub">No hay zonas con actividades pendientes de organizar esta semana.</p>'}
    </div>

    <div id="actSorteoError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:12px;" id="actSortearAhoraBtn" ${zonasDisponibles.length ? '' : 'disabled'}><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg></span> Sortear</button>
  `;

  document.getElementById('actSorteoTodo')?.addEventListener('change', (e) => {
    box.querySelectorAll('[data-sorteo-zona]').forEach(chk => { chk.checked = e.target.checked; });
  });

  document.getElementById('actSortearAhoraBtn')?.addEventListener('click', () => {
    const zonasElegidas = Array.from(box.querySelectorAll('[data-sorteo-zona]:checked')).map(chk => chk.getAttribute('data-sorteo-zona'));
    const error = document.getElementById('actSorteoError');
    if (!zonasElegidas.length) { mostrarErrorAct(error, 'Selecciona al menos una zona/vitrina.'); return; }
    ejecutarSorteoYMostrarPreview(zonasElegidas);
  });

}

function ejecutarSorteoYMostrarPreview(zonasElegidas) {
  const resultado = sortearZonasActividadStaff(actSemanaKey, zonasElegidas);
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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg></div>
    <h3>Resultado del sorteo</h3>
    <p class="modal-sub">Revisa el reparto por zona antes de guardarlo. Puedes cambiar cualquier encargado a mano.</p>

    <div style="max-height:320px;overflow-y:auto;margin-top:8px;">
      ${sorteoResultadoPreview.map((grupo, i) => `
        <div class="act-sorteo-zona-card">
          <div class="act-sorteo-zona-header">
            <strong>${escapeHTMLAct(grupo.zona)}</strong>
            <select data-sorteo-zona-fila="${i}">
              ${staff.map(e => `<option value="${e.id}" ${e.id === grupo.encargadoId ? 'selected' : ''}>${escapeHTMLAct(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <ul class="act-sorteo-zona-lista">
            ${grupo.actividades.map(act => `<li>${escapeHTMLAct(act.nombre)}</li>`).join('')}
          </ul>
        </div>
      `).join('')}
    </div>

    <div style="display:flex;gap:10px;margin-top:12px;">
      <button class="btn btn-outline" style="flex:1;" id="actRepetirSorteoBtn" type="button"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1" fill="currentColor" stroke="none"/></svg></span> Repetir sorteo</button>
      <button class="btn btn-primary" style="flex:1;" id="actGuardarRepartoBtn" type="button">Guardar reparto</button>
    </div>
  `;

  box.querySelectorAll('[data-sorteo-zona-fila]').forEach(sel => {
    sel.addEventListener('change', () => {
      const i = parseInt(sel.getAttribute('data-sorteo-zona-fila'), 10);
      const empleado = staff.find(e => e.id === sel.value);
      if (empleado) {
        sorteoResultadoPreview[i].encargadoId = empleado.id;
        sorteoResultadoPreview[i].encargadoNombre = empleado.nombre;
      }
    });
  });

  document.getElementById('actRepetirSorteoBtn').addEventListener('click', () => {
    ejecutarSorteoYMostrarPreview(sorteoResultadoPreview.map(g => g.zona));
  });

  document.getElementById('actGuardarRepartoBtn').addEventListener('click', () => {
    const cantidadZonas = sorteoResultadoPreview.length;
    const resultado = aplicarResultadoSorteoZonasActividadStaff(sorteoResultadoPreview, {
      usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre, usuarioRol: 'admin'
    });
    registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'sorteo_actividades', descripcion: `Reparto de ${cantidadZonas} zona(s) (${resultado.cantidad} actividad(es)) guardado para la semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
    cerrarModalAct();
    renderTablaActividadesAdmin();
    mostrarToast('Reparto guardado. Actividades listas para anunciar.');
  });

}

// ============================================================
// REPORTE SEMANAL (PDF Carta) — agrupado por Zona → Actividad →
// Encargado → Estado
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

    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({ modulo: 'actividades_staff', accion: 'generar_reporte', descripcion: `Reporte semanal generado — semana del ${formatearRangoSemanaActividadStaff(actSemanaKey)}.` });
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
  const grupos = agruparPorZonaAct(filas);

  const filaActividad = (f) => `
    <tr>
      <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.nombre)}</td>
      <td style="border:1px solid #000;padding:5px;">${f.periodicidad ? PERIODICIDADES_ACTIVIDAD_STAFF[f.periodicidad] : 'Sin definir'}</td>
      <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(formatearDiasAsignacionActividadStaff(f))}</td>
      <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.encargadoNombre || '—')}</td>
      <td style="border:1px solid #000;padding:5px;font-weight:700;${f.estadoReporteLabel === 'No se realizó' ? 'color:#a3272f;' : 'color:#1f7a34;'}">${f.estadoReporteLabel}</td>
      <td style="border:1px solid #000;padding:5px;">${f.fechaEnterado ? formatearFechaHoraAct(f.fechaEnterado) : '—'}</td>
      <td style="border:1px solid #000;padding:5px;">${escapeHTMLAct(f.firmadoPorNombre || '—')}</td>
    </tr>
  `;

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
            <th style="border:1px solid #000;padding:5px;text-align:left;">Periodicidad</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Día</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Encargado</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Estado final</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">Fecha de confirmación</th>
            <th style="border:1px solid #000;padding:5px;text-align:left;">RH que verificó</th>
          </tr>
        </thead>
        <tbody>
          ${grupos.length ? grupos.map(g => `
            <tr><td colspan="7" style="border:1px solid #000;padding:5px;background:#f3ecf7;font-weight:700;">${escapeHTMLAct(g.zona)}</td></tr>
            ${g.items.map(filaActividad).join('')}
          `).join('') : `<tr><td colspan="7" style="border:1px solid #000;padding:10px;text-align:center;">No se anunciaron actividades esta semana.</td></tr>`}
        </tbody>
      </table>

      <div style="margin-top:14px;font-size:9px;color:#555;line-height:1.5;">
        <strong>Enterado</strong> = el empleado confirmó que conocía la actividad. <strong>Firmado por RH</strong> = RH confirmó que la actividad fue realizada. <strong>No se realizó</strong> = al cierre de la semana no existía confirmación de cumplimiento por RH.
      </div>
    </div>
  `;

}
