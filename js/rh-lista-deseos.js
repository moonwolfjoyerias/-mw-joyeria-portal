// MW JOYERÍA — RH: Lista de deseos y Solicitud de resurtido
//
// Mismo comportamiento que Staff (ver js/staff-lista-deseos.js y
// js/lista-deseos-modelo.js), pero "mis solicitudes" filtra por
// creadoPorRol==='rh' / solicitadoPorRol==='rh' en vez de 'staff'.
//
// Única diferencia respecto a Staff: las acciones sensibles NO piden
// usuario/contraseña de nuevo — muestran el modal de Autorización de
// RH con mensaje dinámico (ver js/rh-comun.js) y quedan en la
// auditoría de RH.

let ldVista = 'deseos';
let ldFiltroTexto = '';
let ldFiltroEstado = '';
let resFiltroTexto = '';
let resFiltroEstado = '';

let piezasFormulario = [];
let personaSeleccionadaForm = null; // { id, nombre }

document.addEventListener('DOMContentLoaded', () => {

  renderTablaDeseosRH();
  renderTablaResurtidoRH();
  inicializarEventosListaDeseos();

});

// ============================================================
// NAVEGACIÓN ENTRE PESTAÑAS
// ============================================================

function inicializarEventosListaDeseos() {

  document.querySelectorAll('#ldNavPrincipal [data-ld-vista]').forEach(btn => {
    btn.addEventListener('click', () => {
      ldVista = btn.getAttribute('data-ld-vista');
      document.querySelectorAll('#ldNavPrincipal [data-ld-vista]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('ldVistaDeseos').hidden = ldVista !== 'deseos';
      document.getElementById('ldVistaResurtido').hidden = ldVista !== 'resurtido';
    });
  });

  document.getElementById('ldSearchInput')?.addEventListener('input', (e) => {
    ldFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaDeseosRH();
  });
  document.getElementById('ldFilterEstado')?.addEventListener('change', (e) => {
    ldFiltroEstado = e.target.value;
    renderTablaDeseosRH();
  });
  document.getElementById('ldNuevaSolicitudBtn')?.addEventListener('click', abrirModalNuevaSolicitudDeseos);

  document.getElementById('resSearchInput')?.addEventListener('input', (e) => {
    resFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaResurtidoRH();
  });
  document.getElementById('resFilterEstado')?.addEventListener('change', (e) => {
    resFiltroEstado = e.target.value;
    renderTablaResurtidoRH();
  });
  document.getElementById('resNuevaSolicitudBtn')?.addEventListener('click', abrirModalNuevaResurtido);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalLD();
  });

}

function cerrarModalLD() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

// ============================================================
// FORMATO
// ============================================================

function formatearFechaHoraLD(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function resumenPiezasLD(piezas) {
  if (!piezas.length) return '—';
  const primera = piezas[0].producto;
  return piezas.length === 1 ? primera : `${primera} (+${piezas.length - 1} más)`;
}

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// TABLA: LISTA DE DESEOS
// ============================================================

function renderTablaDeseosRH() {

  const tbody = document.getElementById('ldTableBody');
  if (!tbody) return;

  let solicitudes = obtenerListaDeseos().filter(s => s.creadoPorRol === 'rh');

  if (ldFiltroTexto) {
    solicitudes = solicitudes.filter(s =>
      (s.personaNombre || 'público en general').toLowerCase().includes(ldFiltroTexto) ||
      s.piezas.some(p => p.producto.toLowerCase().includes(ldFiltroTexto))
    );
  }
  if (ldFiltroEstado) solicitudes = solicitudes.filter(s => s.estado === ldFiltroEstado);

  const count = document.getElementById('ldResultCount');
  if (count) count.textContent = `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}`;

  if (!solicitudes.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="catalog-empty-cell"><strong>No hay solicitudes</strong><span>Prueba con otro filtro o crea una nueva.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td><strong>${s.destinatario === 'emprendedora' ? escapeHTML(s.personaNombre) : 'Público en general'}</strong></td>
      <td><span class="catalog-description">${escapeHTML(resumenPiezasLD(s.piezas))}</span></td>
      <td><span class="badge ${BADGE_ESTADOS_LISTA_DESEOS[s.estado] || 'badge-pendiente'}">${ESTADOS_LISTA_DESEOS[s.estado] || s.estado}</span></td>
      <td><span class="catalog-description">${formatearFechaHoraLD(s.fechaCreacion)}</span></td>
      <td><button class="action-btn detail-action" data-ld-detalle="${s.id}"><span>⌕</span> Ver detalle</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-ld-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleSolicitudDeseos(btn.getAttribute('data-ld-detalle')));
  });

}

// ============================================================
// MODAL: NUEVA SOLICITUD DE LISTA DE DESEOS
// ============================================================

function abrirModalNuevaSolicitudDeseos() {

  personaSeleccionadaForm = null;
  piezasFormulario = [{ producto: '', variante: '', cantidad: 1, observaciones: '' }];

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalLD()">×</button>
    <div class="auth-icon">＋</div>
    <h3>Nueva solicitud de lista de deseos</h3>

    <label for="ldDestinatario">¿Para quién es esta solicitud?</label>
    <select id="ldDestinatario" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="emprendedora">Para una Emprendedora</option>
      <option value="publico">Público en general</option>
    </select>

    <div id="ldBuscarEmprendedoraWrap" style="margin-top:10px;">
      <label for="ldBuscarEmprendedora">Buscar Emprendedora (nombre o número de cuenta)</label>
      <input type="text" id="ldBuscarEmprendedora" placeholder="Ej. Valeria Ramírez o MW0012">
      <div id="ldResultadosBusqueda" class="ld-search-results"></div>
      <div id="ldPersonaSeleccionada"></div>
    </div>

    <div class="eyebrow" style="margin-top:16px;">Piezas solicitadas</div>
    <div id="ldPiezasWrap"></div>
    <button type="button" class="btn btn-outline" style="width:100%;margin-top:6px;" id="ldAgregarPiezaBtn">＋ Agregar otra pieza</button>

    <div id="ldFormError" class="auth-error" style="display:none;margin-top:10px;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="ldContinuarBtn">Enviar solicitud</button>
  `;

  overlay.classList.add('open');
  renderPiezasFormularioLD();

  document.getElementById('ldDestinatario').addEventListener('change', (e) => {
    document.getElementById('ldBuscarEmprendedoraWrap').style.display = e.target.value === 'emprendedora' ? 'block' : 'none';
    if (e.target.value === 'publico') personaSeleccionadaForm = null;
  });

  document.getElementById('ldBuscarEmprendedora')?.addEventListener('input', (e) => {
    const resultados = buscarEmprendedorasListaDeseos(e.target.value);
    const cont = document.getElementById('ldResultadosBusqueda');
    if (!e.target.value.trim()) { cont.innerHTML = ''; return; }
    cont.innerHTML = resultados.length
      ? resultados.map(p => `<button type="button" class="ld-search-result" data-persona="${p.id}">${escapeHTML(nombreCompletoPersona(p))} <span>${escapeHTML(p.usuario || 'sin cuenta')}</span></button>`).join('')
      : '<div class="ld-search-empty">Sin coincidencias.</div>';
    cont.querySelectorAll('[data-persona]').forEach(b => {
      b.addEventListener('click', () => {
        const persona = obtenerPersonaPorId(b.getAttribute('data-persona'));
        if (!persona) return;
        personaSeleccionadaForm = { id: persona.id, nombre: nombreCompletoPersona(persona) };
        document.getElementById('ldBuscarEmprendedora').value = '';
        cont.innerHTML = '';
        pintarPersonaSeleccionadaLD();
      });
    });
  });

  document.getElementById('ldAgregarPiezaBtn')?.addEventListener('click', () => {
    leerPiezasFormularioLD();
    piezasFormulario.push({ producto: '', variante: '', cantidad: 1, observaciones: '' });
    renderPiezasFormularioLD();
  });

  document.getElementById('ldContinuarBtn')?.addEventListener('click', () => {

    const destinatario = document.getElementById('ldDestinatario').value;
    const error = document.getElementById('ldFormError');

    leerPiezasFormularioLD();
    const piezasValidas = piezasFormulario.filter(p => p.producto.trim());

    if (destinatario === 'emprendedora' && !personaSeleccionadaForm) {
      error.style.display = 'block';
      error.textContent = 'Busca y selecciona a la Emprendedora.';
      return;
    }
    if (!piezasValidas.length) {
      error.style.display = 'block';
      error.textContent = 'Agrega al menos una pieza con su producto.';
      return;
    }

    const resumenPersona = destinatario === 'emprendedora' ? personaSeleccionadaForm.nombre : 'Público en general';

    abrirAutorizacionRH({
      titulo: 'Crear solicitud de lista de deseos',
      mensaje: `Vas a crear una solicitud para <strong>${escapeHTML(resumenPersona)}</strong> con ${piezasValidas.length} pieza${piezasValidas.length === 1 ? '' : 's'}.`,
      onConfirmar: () => {
        const resultado = crearSolicitudListaDeseos({
          destinatario,
          personaId: destinatario === 'emprendedora' ? personaSeleccionadaForm.id : null,
          piezas: piezasValidas,
          creadoPorId: RH_IDENTIDAD.usuarioId,
          creadoPorNombre: RH_IDENTIDAD.usuarioNombre,
          creadoPorRol: 'rh'
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        renderTablaDeseosRH();
        mostrarToast('Solicitud creada.');
      }
    });

  });

}

function pintarPersonaSeleccionadaLD() {
  const cont = document.getElementById('ldPersonaSeleccionada');
  if (!cont) return;
  cont.innerHTML = personaSeleccionadaForm
    ? `<div class="ld-persona-chip">${escapeHTML(personaSeleccionadaForm.nombre)} <button type="button" id="ldQuitarPersonaBtn">×</button></div>`
    : '';
  document.getElementById('ldQuitarPersonaBtn')?.addEventListener('click', () => {
    personaSeleccionadaForm = null;
    pintarPersonaSeleccionadaLD();
  });
}

function renderPiezasFormularioLD() {
  const cont = document.getElementById('ldPiezasWrap');
  if (!cont) return;
  cont.innerHTML = piezasFormulario.map((p, i) => `
    <div class="ld-pieza-row" data-pieza-index="${i}">
      <input type="text" placeholder="Producto" class="ld-pieza-producto" value="${escapeHTML(p.producto)}">
      <input type="text" placeholder="Variante (opcional)" class="ld-pieza-variante" value="${escapeHTML(p.variante)}">
      <input type="number" min="1" placeholder="Cantidad" class="ld-pieza-cantidad" value="${p.cantidad}">
      <input type="text" placeholder="Observaciones (opcional)" class="ld-pieza-observaciones" value="${escapeHTML(p.observaciones)}">
      ${piezasFormulario.length > 1 ? `<button type="button" class="comm-icon-btn" data-quitar-pieza="${i}" title="Quitar">🗑</button>` : ''}
    </div>
  `).join('');
  cont.querySelectorAll('[data-quitar-pieza]').forEach(btn => {
    btn.addEventListener('click', () => {
      leerPiezasFormularioLD();
      piezasFormulario.splice(parseInt(btn.getAttribute('data-quitar-pieza'), 10), 1);
      renderPiezasFormularioLD();
    });
  });
}

function leerPiezasFormularioLD() {
  document.querySelectorAll('#ldPiezasWrap .ld-pieza-row').forEach((row, i) => {
    if (!piezasFormulario[i]) return;
    piezasFormulario[i] = {
      producto: row.querySelector('.ld-pieza-producto')?.value.trim() || '',
      variante: row.querySelector('.ld-pieza-variante')?.value.trim() || '',
      cantidad: parseInt(row.querySelector('.ld-pieza-cantidad')?.value, 10) || 1,
      observaciones: row.querySelector('.ld-pieza-observaciones')?.value.trim() || ''
    };
  });
}

// ============================================================
// DETALLE DE SOLICITUD (LISTA DE DESEOS)
// ============================================================

function abrirDetalleSolicitudDeseos(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const s = obtenerSolicitudListaDeseosPorId(id);
  if (!overlay || !box || !s) return;

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalLD()">×</button>
    <span class="eyebrow">${escapeHTML(s.id)}</span>
    <h3 style="margin-top:5px;">Detalle de la solicitud</h3>

    <div class="modal-context">
      <span>Para</span><strong>${s.destinatario === 'emprendedora' ? escapeHTML(s.personaNombre) : 'Público en general'}</strong>
      <span>Creada por</span><strong>${escapeHTML(s.creadoPorNombre)} (${ROLES_CREADOR_DESEOS[s.creadoPorRol] || s.creadoPorRol})</strong>
      <span>Fecha</span><strong>${formatearFechaHoraLD(s.fechaCreacion)}</strong>
      <span>Estado</span><span class="badge ${BADGE_ESTADOS_LISTA_DESEOS[s.estado]}">${ESTADOS_LISTA_DESEOS[s.estado]}</span>
    </div>

    <div class="eyebrow" style="margin-top:14px;">Piezas</div>
    ${s.piezas.map(p => `
      <div class="log-box" style="margin-bottom:8px;">
        <strong>${escapeHTML(p.producto)}${p.variante ? ` — ${escapeHTML(p.variante)}` : ''}</strong>
        <small>Cantidad: ${p.cantidad}${p.observaciones ? ` · ${escapeHTML(p.observaciones)}` : ''}</small>
      </div>
    `).join('')}

    ${s.comentarioEstado ? `<div class="modal-note"><strong>Comentario:</strong> ${escapeHTML(s.comentarioEstado)}</div>` : ''}

    <div class="eyebrow" style="margin-top:14px;">Actualizar estado</div>
    <select id="ldNuevoEstado" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      ${Object.entries(ESTADOS_LISTA_DESEOS).map(([k, label]) => `<option value="${k}" ${k === s.estado ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
    <input type="text" id="ldComentarioEstado" placeholder="Comentario (opcional)" style="margin-top:8px;">
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="ldGuardarEstadoBtn">Guardar estado</button>
  `;

  overlay.classList.add('open');

  document.getElementById('ldGuardarEstadoBtn')?.addEventListener('click', () => {
    const nuevoEstado = document.getElementById('ldNuevoEstado').value;
    const comentario = document.getElementById('ldComentarioEstado').value.trim();
    abrirAutorizacionRH({
      titulo: 'Actualizar estado',
      mensaje: `Vas a cambiar el estado de esta solicitud a <strong>${ESTADOS_LISTA_DESEOS[nuevoEstado]}</strong>.`,
      onConfirmar: () => {
        const resultado = actualizarEstadoListaDeseos(s.id, nuevoEstado, {
          usuarioId: RH_IDENTIDAD.usuarioId, usuarioNombre: RH_IDENTIDAD.usuarioNombre, usuarioRol: 'rh', comentario
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        renderTablaDeseosRH();
        mostrarToast('Estado actualizado.');
      }
    });
  });

}

// ============================================================
// TABLA: SOLICITUDES DE RESURTIDO
// ============================================================

function renderTablaResurtidoRH() {

  const tbody = document.getElementById('resTableBody');
  if (!tbody) return;

  let solicitudes = obtenerSolicitudesResurtido().filter(s => s.solicitadoPorRol === 'rh');

  if (resFiltroTexto) solicitudes = solicitudes.filter(s => s.producto.toLowerCase().includes(resFiltroTexto));
  if (resFiltroEstado) solicitudes = solicitudes.filter(s => s.estado === resFiltroEstado);

  const count = document.getElementById('resResultCount');
  if (count) count.textContent = `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}`;

  if (!solicitudes.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="catalog-empty-cell"><strong>No hay solicitudes de resurtido</strong><span>Crea una cuando haga falta avisar a Administración.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.producto)}</strong></td>
      <td><span class="catalog-description">${escapeHTML(s.variante || '—')}</span></td>
      <td>${s.cantidadSugerida || '—'}</td>
      <td><span class="badge ${BADGE_ESTADOS_RESURTIDO[s.estado]}">${ESTADOS_RESURTIDO[s.estado]}</span></td>
      <td><span class="catalog-description">${formatearFechaHoraLD(s.fechaSolicitud)}</span></td>
      <td><button class="action-btn detail-action" data-res-detalle="${s.id}"><span>⌕</span> Ver detalle</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-res-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleResurtido(btn.getAttribute('data-res-detalle')));
  });

}

function abrirModalNuevaResurtido() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalLD()">×</button>
    <div class="auth-icon">📦</div>
    <h3>Solicitar resurtido</h3>
    <p class="modal-sub">Avisa a Administración que hace falta resurtir una pieza o tipo de pieza — puede ser por categoría, sin necesidad de una persona específica.</p>

    <label for="resProducto">Producto o tipo de pieza</label>
    <input type="text" id="resProducto" placeholder="Ej. Cadenas blancas">

    <label for="resVariante">Variante (opcional)</label>
    <input type="text" id="resVariante" placeholder="Ej. 45cm eslabón fino">

    <label for="resCantidad">Cantidad sugerida (opcional)</label>
    <input type="number" min="1" id="resCantidad" placeholder="Ej. 20">

    <label for="resComentario">Motivo / comentario</label>
    <textarea id="resComentario" rows="3" placeholder="Ej. Varias Emprendedoras han solicitado este modelo y actualmente no hay disponibilidad."></textarea>

    <div id="resFormError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="resContinuarBtn">Enviar solicitud</button>
  `;

  overlay.classList.add('open');

  document.getElementById('resContinuarBtn')?.addEventListener('click', () => {
    const producto = document.getElementById('resProducto').value.trim();
    const error = document.getElementById('resFormError');
    if (!producto) {
      error.style.display = 'block';
      error.textContent = 'Indica el producto o tipo de pieza.';
      return;
    }

    // Se capturan los valores ANTES de abrir el modal de autorización:
    // ese modal reemplaza el contenido de #modalBox, así que estos
    // campos ya no existirían si se leyeran dentro de onConfirmar.
    const datos = {
      producto,
      variante: document.getElementById('resVariante').value.trim(),
      cantidadSugerida: document.getElementById('resCantidad').value,
      comentario: document.getElementById('resComentario').value.trim()
    };

    abrirAutorizacionRH({
      titulo: 'Solicitar resurtido',
      mensaje: `Vas a avisar a Administración que hace falta resurtir <strong>${escapeHTML(producto)}</strong>.`,
      onConfirmar: () => {
        const resultado = crearSolicitudResurtido({
          ...datos,
          solicitadoPorId: RH_IDENTIDAD.usuarioId,
          solicitadoPorNombre: RH_IDENTIDAD.usuarioNombre,
          solicitadoPorRol: 'rh'
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        renderTablaResurtidoRH();
        mostrarToast('Solicitud de resurtido enviada — se notificó a Administración.');
      }
    });

  });

}

function abrirDetalleResurtido(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const s = obtenerSolicitudResurtidoPorId(id);
  if (!overlay || !box || !s) return;

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalLD()">×</button>
    <span class="eyebrow">${escapeHTML(s.id)}</span>
    <h3 style="margin-top:5px;">Solicitud de resurtido</h3>

    <div class="modal-context">
      <span>Producto</span><strong>${escapeHTML(s.producto)}</strong>
      <span>Variante</span><strong>${escapeHTML(s.variante || '—')}</strong>
      <span>Cantidad sugerida</span><strong>${s.cantidadSugerida || '—'}</strong>
      <span>Motivo</span><strong>${escapeHTML(s.comentario || '—')}</strong>
      <span>Solicitado por</span><strong>${escapeHTML(s.solicitadoPorNombre)}</strong>
      <span>Fecha</span><strong>${formatearFechaHoraLD(s.fechaSolicitud)}</strong>
      <span>Estado</span><span class="badge ${BADGE_ESTADOS_RESURTIDO[s.estado]}">${ESTADOS_RESURTIDO[s.estado]}</span>
    </div>

    ${s.observaciones.length ? `
      <div class="eyebrow" style="margin-top:14px;">Observaciones de Administración</div>
      ${s.observaciones.map(o => `
        <div class="log-box" style="margin-bottom:8px;">
          <strong>${escapeHTML(o.texto)}</strong>
          <small>${escapeHTML(o.usuarioNombre)} · ${formatearFechaHoraLD(o.fecha)}</small>
        </div>
      `).join('')}
    ` : `<p class="bp-sub" style="margin-top:10px;">Todavía sin observaciones de Administración.</p>`}

    <button class="btn btn-outline" style="width:100%;margin-top:10px;" onclick="cerrarModalLD()">Cerrar</button>
  `;

  overlay.classList.add('open');

}
