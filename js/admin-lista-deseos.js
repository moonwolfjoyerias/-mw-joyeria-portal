// MW JOYERÍA — Admin: Lista de deseos y Solicitudes de resurtido
//
// Dos secciones (ver js/lista-deseos-modelo.js):
// - "💜 Listas de deseos": TODAS las solicitudes creadas por
//   Staff/RH/Admin, filtrables por Emprendedora/público, producto,
//   estado, fecha y usuario que la creó — Administración puede crear
//   solicitudes y cambiar el estado de cualquiera (no solo las suyas).
// - "📦 Solicitudes de resurtido": TODAS las solicitudes de Staff/RH
//   — Administración es el único rol que las administra (ver detalle,
//   marcar revisada/atendida, agregar observaciones).

let ldVista = 'deseos';
let ldFiltroTexto = '';
let ldFiltroDestinatario = '';
let ldFiltroEstado = '';
let ldFiltroCreador = '';
let ldFiltroDesde = '';
let ldFiltroHasta = '';
let resFiltroTexto = '';
let resFiltroEstado = '';

let piezasFormulario = [];
let personaSeleccionadaForm = null; // { id, nombre }

document.addEventListener('DOMContentLoaded', () => {

  renderTablaDeseosAdmin();
  renderTablaResurtidoAdmin();
  inicializarEventosListaDeseosAdmin();

  // Enlace directo desde una notificación de resurtido
  // (?resurtido=ID) — abre esa solicitud de una vez.
  const resurtidoDesdeUrl = new URLSearchParams(window.location.search).get('resurtido');
  if (resurtidoDesdeUrl) {
    ldVista = 'resurtido';
    document.querySelectorAll('#ldNavPrincipal [data-ld-vista]').forEach(b => b.classList.toggle('active', b.getAttribute('data-ld-vista') === 'resurtido'));
    document.getElementById('ldVistaDeseos').hidden = true;
    document.getElementById('ldVistaResurtido').hidden = false;
    abrirDetalleResurtidoAdmin(resurtidoDesdeUrl);
  }

});

// ============================================================
// NAVEGACIÓN ENTRE SECCIONES
// ============================================================

function inicializarEventosListaDeseosAdmin() {

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
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldFilterDestinatario')?.addEventListener('change', (e) => {
    ldFiltroDestinatario = e.target.value;
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldFilterEstado')?.addEventListener('change', (e) => {
    ldFiltroEstado = e.target.value;
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldFilterCreador')?.addEventListener('change', (e) => {
    ldFiltroCreador = e.target.value;
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldFilterDesde')?.addEventListener('change', (e) => {
    ldFiltroDesde = e.target.value;
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldFilterHasta')?.addEventListener('change', (e) => {
    ldFiltroHasta = e.target.value;
    renderTablaDeseosAdmin();
  });
  document.getElementById('ldNuevaSolicitudBtn')?.addEventListener('click', abrirModalNuevaSolicitudDeseos);

  document.getElementById('resSearchInput')?.addEventListener('input', (e) => {
    resFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaResurtidoAdmin();
  });
  document.getElementById('resFilterEstado')?.addEventListener('change', (e) => {
    resFiltroEstado = e.target.value;
    renderTablaResurtidoAdmin();
  });

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
// TABLA: LISTAS DE DESEOS (todas)
// ============================================================

function renderTablaDeseosAdmin() {

  const tbody = document.getElementById('ldTableBody');
  if (!tbody) return;

  let solicitudes = obtenerListaDeseos();

  if (ldFiltroTexto) {
    solicitudes = solicitudes.filter(s =>
      (s.personaNombre || 'público en general').toLowerCase().includes(ldFiltroTexto) ||
      s.piezas.some(p => p.producto.toLowerCase().includes(ldFiltroTexto))
    );
  }
  if (ldFiltroDestinatario) solicitudes = solicitudes.filter(s => s.destinatario === ldFiltroDestinatario);
  if (ldFiltroEstado) solicitudes = solicitudes.filter(s => s.estado === ldFiltroEstado);
  if (ldFiltroCreador) solicitudes = solicitudes.filter(s => s.creadoPorRol === ldFiltroCreador);
  if (ldFiltroDesde) solicitudes = solicitudes.filter(s => s.fechaCreacion.slice(0, 10) >= ldFiltroDesde);
  if (ldFiltroHasta) solicitudes = solicitudes.filter(s => s.fechaCreacion.slice(0, 10) <= ldFiltroHasta);

  const count = document.getElementById('ldResultCount');
  if (count) count.textContent = `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}`;

  if (!solicitudes.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="catalog-empty-cell"><strong>No hay solicitudes</strong><span>Prueba con otro filtro.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td><strong>${s.destinatario === 'emprendedora' ? escapeHTML(s.personaNombre) : 'Público en general'}</strong></td>
      <td><span class="catalog-description">${escapeHTML(resumenPiezasLD(s.piezas))}</span></td>
      <td>${escapeHTML(s.creadoPorNombre)}<div class="catalog-description">${ROLES_CREADOR_DESEOS[s.creadoPorRol] || s.creadoPorRol}</div></td>
      <td><span class="badge ${BADGE_ESTADOS_LISTA_DESEOS[s.estado] || 'badge-pendiente'}">${ESTADOS_LISTA_DESEOS[s.estado] || s.estado}</span></td>
      <td><span class="catalog-description">${formatearFechaHoraLD(s.fechaCreacion)}</span></td>
      <td><button class="action-btn detail-action" data-ld-detalle="${s.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></span> Ver detalle</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-ld-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleSolicitudDeseosAdmin(btn.getAttribute('data-ld-detalle')));
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

    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="ldContinuarBtn">Crear solicitud</button>
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

    abrirAutorizacionAdmin({
      titulo: 'Crear solicitud de lista de deseos',
      mensaje: `Vas a crear una solicitud para <strong>${escapeHTML(resumenPersona)}</strong> con ${piezasValidas.length} pieza${piezasValidas.length === 1 ? '' : 's'}.`,
      onConfirmar: () => {
        const resultado = crearSolicitudListaDeseos({
          destinatario,
          personaId: destinatario === 'emprendedora' ? personaSeleccionadaForm.id : null,
          piezas: piezasValidas,
          creadoPorId: ADMIN_IDENTIDAD.usuarioId,
          creadoPorNombre: ADMIN_IDENTIDAD.usuarioNombre,
          creadoPorRol: 'admin'
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        renderTablaDeseosAdmin();
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
// DETALLE DE SOLICITUD (LISTA DE DESEOS) — Admin puede cambiar
// el estado de CUALQUIER solicitud, sin importar quién la creó.
// ============================================================

function abrirDetalleSolicitudDeseosAdmin(id) {

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
    abrirAutorizacionAdmin({
      titulo: 'Actualizar estado',
      mensaje: `Vas a cambiar el estado de esta solicitud a <strong>${ESTADOS_LISTA_DESEOS[nuevoEstado]}</strong>.`,
      onConfirmar: () => {
        const resultado = actualizarEstadoListaDeseos(s.id, nuevoEstado, {
          usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre, usuarioRol: 'admin', comentario
        });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        renderTablaDeseosAdmin();
        mostrarToast('Estado actualizado.');
      }
    });
  });

}

// ============================================================
// TABLA: SOLICITUDES DE RESURTIDO (todas)
// ============================================================

function renderTablaResurtidoAdmin() {

  const tbody = document.getElementById('resTableBody');
  if (!tbody) return;

  let solicitudes = obtenerSolicitudesResurtido();

  if (resFiltroTexto) solicitudes = solicitudes.filter(s => s.producto.toLowerCase().includes(resFiltroTexto));
  if (resFiltroEstado) solicitudes = solicitudes.filter(s => s.estado === resFiltroEstado);

  const count = document.getElementById('resResultCount');
  if (count) count.textContent = `${solicitudes.length} solicitud${solicitudes.length === 1 ? '' : 'es'}`;

  if (!solicitudes.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="catalog-empty-cell"><strong>No hay solicitudes de resurtido</strong><span>Aquí aparecerán las que envíen Staff y RH.</span></td></tr>`;
    return;
  }

  tbody.innerHTML = solicitudes.map(s => `
    <tr>
      <td><strong>${escapeHTML(s.producto)}</strong></td>
      <td><span class="catalog-description">${escapeHTML(s.variante || '—')}</span></td>
      <td>${s.cantidadSugerida || '—'}</td>
      <td>${escapeHTML(s.solicitadoPorNombre)}<div class="catalog-description">${ROLES_CREADOR_DESEOS[s.solicitadoPorRol] || s.solicitadoPorRol}</div></td>
      <td><span class="badge ${BADGE_ESTADOS_RESURTIDO[s.estado]}">${ESTADOS_RESURTIDO[s.estado]}</span></td>
      <td><span class="catalog-description">${formatearFechaHoraLD(s.fechaSolicitud)}</span></td>
      <td><button class="action-btn detail-action" data-res-detalle="${s.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10" cy="10" r="6"/><path d="M20 20l-5.5-5.5"/></svg></span> Ver detalle</button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-res-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleResurtidoAdmin(btn.getAttribute('data-res-detalle')));
  });

}

function abrirDetalleResurtidoAdmin(id) {

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
      <span>Solicitado por</span><strong>${escapeHTML(s.solicitadoPorNombre)} (${ROLES_CREADOR_DESEOS[s.solicitadoPorRol] || s.solicitadoPorRol})</strong>
      <span>Fecha</span><strong>${formatearFechaHoraLD(s.fechaSolicitud)}</strong>
      <span>Estado</span><span class="badge ${BADGE_ESTADOS_RESURTIDO[s.estado]}">${ESTADOS_RESURTIDO[s.estado]}</span>
      ${s.revisadoPorNombre ? `<span>Revisada por</span><strong>${escapeHTML(s.revisadoPorNombre)} · ${formatearFechaHoraLD(s.fechaRevisado)}</strong>` : ''}
      ${s.atendidoPorNombre ? `<span>Atendida por</span><strong>${escapeHTML(s.atendidoPorNombre)} · ${formatearFechaHoraLD(s.fechaAtendido)}</strong>` : ''}
    </div>

    <div class="eyebrow" style="margin-top:14px;">Observaciones</div>
    <div id="resObservacionesLista">
      ${s.observaciones.length ? s.observaciones.map(o => `
        <div class="log-box" style="margin-bottom:8px;">
          <strong>${escapeHTML(o.texto)}</strong>
          <small>${escapeHTML(o.usuarioNombre)} · ${formatearFechaHoraLD(o.fecha)}</small>
        </div>
      `).join('') : `<p class="bp-sub" style="margin:0;">Todavía sin observaciones.</p>`}
    </div>

    <label for="resNuevaObservacion" style="margin-top:10px;">Agregar observación</label>
    <textarea id="resNuevaObservacion" rows="2" placeholder="Ej. Ya se apartó con el proveedor, llega la próxima semana."></textarea>
    <button class="btn btn-outline" style="width:100%;margin-top:8px;" id="resAgregarObservacionBtn">Agregar observación</button>

    <div style="display:flex;gap:10px;margin-top:14px;">
      ${s.estado === 'pendiente' ? `<button class="btn btn-outline" style="flex:1;" id="resMarcarRevisadaBtn">Marcar como revisada</button>` : ''}
      ${s.estado !== 'atendida' ? `<button class="btn btn-primary" style="flex:1;" id="resMarcarAtendidaBtn">Marcar como atendida</button>` : ''}
    </div>
  `;

  overlay.classList.add('open');

  document.getElementById('resAgregarObservacionBtn')?.addEventListener('click', () => {
    const texto = document.getElementById('resNuevaObservacion').value.trim();
    if (!texto) { mostrarToast('Escribe una observación.'); return; }
    const resultado = agregarObservacionResurtido(s.id, texto, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre });
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    mostrarToast('Observación agregada.');
    renderTablaResurtidoAdmin();
    abrirDetalleResurtidoAdmin(s.id);
  });

  document.getElementById('resMarcarRevisadaBtn')?.addEventListener('click', () => {
    abrirAutorizacionAdmin({
      titulo: 'Marcar como revisada',
      mensaje: `Confirmas que ya revisaste la solicitud de resurtido de <strong>${escapeHTML(s.producto)}</strong>.`,
      onConfirmar: () => {
        const resultado = marcarResurtidoRevisada(s.id, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        mostrarToast('Solicitud marcada como revisada.');
        renderTablaResurtidoAdmin();
        cerrarModalLD();
      }
    });
  });

  document.getElementById('resMarcarAtendidaBtn')?.addEventListener('click', () => {
    abrirAutorizacionAdmin({
      titulo: 'Marcar como atendida',
      mensaje: `Confirmas que el resurtido de <strong>${escapeHTML(s.producto)}</strong> ya se atendió. Se le avisará a quien la solicitó.`,
      onConfirmar: () => {
        const resultado = marcarResurtidoAtendida(s.id, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre });
        if (!resultado.ok) { mostrarToast(resultado.error); return; }
        mostrarToast('Solicitud marcada como atendida.');
        renderTablaResurtidoAdmin();
        cerrarModalLD();
      }
    });
  });

}
