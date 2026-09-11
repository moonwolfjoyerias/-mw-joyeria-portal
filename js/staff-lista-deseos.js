// MW JOYERÍA — Staff: Lista de deseos y Solicitud de resurtido
//
// Dos pestañas independientes (ver js/lista-deseos-modelo.js):
// - "Mis solicitudes": listaDeseos creadas por Staff (piezas para una
//   Emprendedora o para público en general).
// - "Solicitar resurtido": solicitudesResurtido creadas por Staff,
//   avisando a Administración — Staff nunca las administra (eso es
//   exclusivo de Administración, ver js/admin-lista-deseos.js).
//
// No existe una sesión individual de Staff (ver js/staff-apartados.js):
// cada acción sensible vuelve a pedir usuario/contraseña de empleado,
// y "mis solicitudes" en la práctica es "las que creó el equipo de
// Staff" (rol, no persona) — mismo criterio que ya usa Apartados, donde
// cualquier Staff puede actuar sobre cualquier ventana del equipo.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida.

let ldVista = 'deseos';
let ldFiltroTexto = '';
let ldFiltroEstado = '';
let resFiltroTexto = '';
let resFiltroEstado = '';

let piezasFormulario = [];
let personaSeleccionadaForm = null; // { id, nombre }
let accionPendiente = null; // { tipo, datos }

document.addEventListener('DOMContentLoaded', () => {

  renderTablaDeseosStaff();
  renderTablaResurtidoStaff();
  inicializarEventosListaDeseos();

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.sc-menu.open').forEach(menu => menu.classList.remove('open'));
  });

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
    renderTablaDeseosStaff();
  });
  document.getElementById('ldFilterEstado')?.addEventListener('change', (e) => {
    ldFiltroEstado = e.target.value;
    renderTablaDeseosStaff();
  });
  document.getElementById('ldNuevaSolicitudBtn')?.addEventListener('click', abrirModalNuevaSolicitudDeseos);

  document.getElementById('resSearchInput')?.addEventListener('input', (e) => {
    resFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaResurtidoStaff();
  });
  document.getElementById('resFilterEstado')?.addEventListener('change', (e) => {
    resFiltroEstado = e.target.value;
    renderTablaResurtidoStaff();
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

function renderTablaDeseosStaff() {

  const tbody = document.getElementById('ldTableBody');
  if (!tbody) return;

  let solicitudes = obtenerListaDeseos().filter(s => s.creadoPorRol === 'staff');

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
      <td><button class="action-btn detail-action" data-ld-detalle="${s.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></span> Ver detalle</button></td>
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

    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="ldContinuarBtn">Continuar</button>
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

    abrirAutorizacionListaDeseos({
      tipo: 'crear_deseo',
      datos: { destinatario, personaId: destinatario === 'emprendedora' ? personaSeleccionadaForm.id : null, piezas: piezasValidas },
      resumenPersona: destinatario === 'emprendedora' ? personaSeleccionadaForm.nombre : 'Público en general'
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
      <input type="text" placeholder="Descripción del producto" class="ld-pieza-producto" value="${escapeHTML(p.producto)}">
      <input type="number" min="1" placeholder="Piezas" class="ld-pieza-cantidad" value="${p.cantidad}">
      ${piezasFormulario.length > 1 ? `<button type="button" class="comm-icon-btn" data-quitar-pieza="${i}" title="Quitar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>` : ''}
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
      variante: '',
      cantidad: parseInt(row.querySelector('.ld-pieza-cantidad')?.value, 10) || 1,
      observaciones: ''
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
    abrirAutorizacionListaDeseos({
      tipo: 'cambiar_estado_deseo',
      datos: { id: s.id, nuevoEstado, comentario },
      resumenPersona: s.destinatario === 'emprendedora' ? s.personaNombre : 'Público en general'
    });
  });

}

// ============================================================
// TABLA: SOLICITUDES DE RESURTIDO
// ============================================================

function renderTablaResurtidoStaff() {

  const tbody = document.getElementById('resTableBody');
  if (!tbody) return;

  let solicitudes = obtenerSolicitudesResurtido().filter(s => s.solicitadoPorRol === 'staff');

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
      <td><button class="action-btn detail-action" data-res-detalle="${s.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></span> Ver detalle</button></td>
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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 8l9-5 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8"/><path d="M12 13v9"/></svg></div>
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

    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="resContinuarBtn">Continuar</button>
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
    const datos = {
      producto,
      variante: document.getElementById('resVariante').value.trim(),
      cantidadSugerida: document.getElementById('resCantidad').value,
      comentario: document.getElementById('resComentario').value.trim()
    };
    abrirAutorizacionListaDeseos({ tipo: 'crear_resurtido', datos, resumenPersona: producto });
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

// ============================================================
// AUTORIZACIÓN (usuario + contraseña de empleado — igual que Apartados)
// ============================================================

function abrirAutorizacionListaDeseos(accion) {

  accionPendiente = accion;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const titulos = {
    crear_deseo: 'Autorizar nueva solicitud',
    crear_resurtido: 'Autorizar solicitud de resurtido',
    cambiar_estado_deseo: 'Autorizar cambio de estado'
  };

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModalLD()">×</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>${titulos[accion.tipo] || 'Autorizar acción'}</h3>
    <p class="modal-sub">Ingresa tus credenciales para registrar quién realizó este cambio.</p>

    <div class="modal-context">
      <span>Para / Producto</span><strong>${escapeHTML(accion.resumenPersona || '')}</strong>
    </div>

    <label for="ldAuthUsuario">Usuario del personal</label>
    <input id="ldAuthUsuario" type="text" autocomplete="off" placeholder="Ej. staff01">

    <label for="ldAuthPassword">Contraseña</label>
    <div class="password-wrap">
      <input id="ldAuthPassword" type="password" placeholder="Contraseña">
      <button type="button" id="ldTogglePassword">Mostrar</button>
    </div>

    <div id="ldAuthError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="ldAutorizarBtn">Autorizar acción</button>

    <p class="demo-note">DEMO · Usuario: staff01 · Contraseña: 1234</p>
  `;

  overlay.classList.add('open');

  document.getElementById('ldTogglePassword')?.addEventListener('click', () => {
    const input = document.getElementById('ldAuthPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('ldAutorizarBtn')?.addEventListener('click', validarAutorizacionListaDeseos);

  setTimeout(() => document.getElementById('ldAuthUsuario')?.focus(), 100);

}

function validarAutorizacionListaDeseos() {

  const usuario = document.getElementById('ldAuthUsuario')?.value.trim();
  const password = document.getElementById('ldAuthPassword')?.value;
  const error = document.getElementById('ldAuthError');

  const personal = PERSONAL_EJEMPLO.find(p => p.usuario === usuario && p.password === password)
    || (typeof verificarCredencialInterna === 'function' ? verificarCredencialInterna(usuario, password) : null);

  if (!personal) {
    if (error) {
      error.style.display = 'block';
      error.textContent = 'Usuario o contraseña incorrectos.';
    }
    return;
  }

  ejecutarAccionListaDeseos(personal);

}

function ejecutarAccionListaDeseos(personal) {

  if (!accionPendiente) return;

  const identidad = { usuarioId: personal.usuario, usuarioNombre: personal.nombre, usuarioRol: 'staff' };
  let resultado;

  if (accionPendiente.tipo === 'crear_deseo') {

    resultado = crearSolicitudListaDeseos({
      ...accionPendiente.datos,
      creadoPorId: identidad.usuarioId,
      creadoPorNombre: identidad.usuarioNombre,
      creadoPorRol: 'staff'
    });
    if (!resultado.ok) { mostrarErrorAutorizacionLD(resultado.error); return; }
    cerrarModalLD();
    renderTablaDeseosStaff();
    mostrarToast('Solicitud creada.');

  } else if (accionPendiente.tipo === 'crear_resurtido') {

    resultado = crearSolicitudResurtido({
      ...accionPendiente.datos,
      solicitadoPorId: identidad.usuarioId,
      solicitadoPorNombre: identidad.usuarioNombre,
      solicitadoPorRol: 'staff'
    });
    if (!resultado.ok) { mostrarErrorAutorizacionLD(resultado.error); return; }
    cerrarModalLD();
    renderTablaResurtidoStaff();
    mostrarToast('Solicitud de resurtido enviada — se notificó a Administración.');

  } else if (accionPendiente.tipo === 'cambiar_estado_deseo') {

    resultado = actualizarEstadoListaDeseos(accionPendiente.datos.id, accionPendiente.datos.nuevoEstado, {
      usuarioId: identidad.usuarioId, usuarioNombre: identidad.usuarioNombre, usuarioRol: 'staff', comentario: accionPendiente.datos.comentario
    });
    if (!resultado.ok) { mostrarErrorAutorizacionLD(resultado.error); return; }
    cerrarModalLD();
    renderTablaDeseosStaff();
    mostrarToast('Estado actualizado.');

  }

  accionPendiente = null;

}

function mostrarErrorAutorizacionLD(mensaje) {
  const error = document.getElementById('ldAuthError');
  if (error) {
    error.style.display = 'block';
    error.textContent = mensaje;
  }
}
