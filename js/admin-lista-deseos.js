// MW JOYERÍA — Lista de deseos Admin
//
// Mismo comportamiento que Staff/RH: ver todas las solicitudes de las
// emprendedoras, avanzar el estado de cada una (pendiente → en
// revisión → ¡bingo! → disponible) y ver el detalle completo. Misma
// fuente de datos que Staff (cargarDeseosStaffActuales(),
// staff-deseos-ejemplo.js) — misma clave de localStorage
// (mw-staff-deseos-v1), sin lista independiente para Admin.
//
// Igual que RH: avanzar el estado NO pide usuario/contraseña de nuevo
// — muestra el modal de Autorización (ver js/admin-comun.js) y queda
// en la auditoría (rol "admin"). Ver detalle es informativo, no
// requiere autorización.

let deseosStaff = [];

document.addEventListener('DOMContentLoaded', () => {

  deseosStaff = cargarDeseosStaffActuales();
  renderResumenDeseos();
  renderTablaDeseos();
  inicializarEventosDeseos();

});


// ============================================================
// GUARDAR
// ============================================================

function guardarDeseosStaff() {
  localStorage.setItem(DESEOS_STAFF_STORAGE_KEY, JSON.stringify(deseosStaff));
}


// ============================================================
// EVENTOS
// ============================================================

function inicializarEventosDeseos() {

  document.getElementById('searchInput')?.addEventListener('input', renderTablaDeseos);
  document.getElementById('filterEstado')?.addEventListener('change', renderTablaDeseos);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalDeseo();
  });

}


// ============================================================
// RESUMEN
// ============================================================

function renderResumenDeseos() {

  const valores = {
    totalDeseos: deseosStaff.length,
    deseosPendientes: deseosStaff.filter(d => d.estado === 'pendiente').length,
    deseosEnRevision: deseosStaff.filter(d => d.estado === 'en_revision').length,
    deseosDisponibles: deseosStaff.filter(d => d.estado === 'disponible').length
  };

  Object.entries(valores).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });

}


// ============================================================
// TABLA
// ============================================================

function renderTablaDeseos() {

  const tbody = document.getElementById('deseosTableBody');
  if (!tbody) return;

  renderResumenDeseos();

  const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const estado = document.getElementById('filterEstado')?.value || '';

  const deseos = deseosStaff.filter(d => {

    if (
      search &&
      !d.emprendedora.toLowerCase().includes(search) &&
      !d.titulo.toLowerCase().includes(search) &&
      !(d.descripcion || '').toLowerCase().includes(search)
    ) return false;

    if (estado && d.estado !== estado) return false;

    return true;

  });

  const count = document.getElementById('resultCount');
  if (count) count.textContent = `${deseos.length} solicitud${deseos.length === 1 ? '' : 'es'}`;

  if (!deseos.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="catalog-empty-cell">
          <strong>No encontramos solicitudes</strong>
          <span>Prueba con otro filtro o búsqueda.</span>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = deseos.map(renderFilaDeseo).join('');

  tbody.querySelectorAll('[data-avanzar]').forEach(btn => {
    btn.addEventListener('click', () => confirmarAvanzarDeseo(btn.dataset.avanzar, btn.dataset.id));
  });

  tbody.querySelectorAll('[data-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleDeseo(btn.dataset.detalle));
  });

}


function renderFilaDeseo(d) {

  const estado = ESTADOS_DESEOS_STAFF[d.estado] || { label: d.estado, clase: '' };

  return `
    <tr>
      <td>
        <div class="catalog-product-cell">
          <span class="profile-avatar">${escapeHTML(d.iniciales || '')}</span>
          <div>
            <strong>${escapeHTML(d.emprendedora)}</strong>
            <div class="catalog-description">${escapeHTML(d.telefono || '')}</div>
          </div>
        </div>
      </td>

      <td><strong>${escapeHTML(d.titulo)}</strong></td>

      <td><span class="catalog-description">${escapeHTML(d.descripcion || 'Sin descripción')}</span></td>

      <td>
        ${d.tieneFoto
          ? `<div class="catalog-product-cell"><img src="../../assets/images/isotipo-morado.png" alt=""><span class="catalog-description">Adjunta</span></div>`
          : `<span class="catalog-description">Sin foto</span>`
        }
      </td>

      <td><span class="catalog-description">${escapeHTML(d.fecha || '')}</span></td>

      <td><span class="wishlist-status ${estado.clase}">${escapeHTML(estado.label)}</span></td>

      <td>
        <div class="catalog-actions">
          ${obtenerAccionDeseo(d)}
          <button class="action-btn detail-action" data-detalle="${d.id}"><span>⌕</span> Ver detalle</button>
        </div>
      </td>

      <td>
        <strong>${escapeHTML(d.ultimaAccion?.texto || 'Sin registro')}</strong>
        <div class="catalog-description">${escapeHTML(d.ultimaAccion?.usuario || '')}${d.ultimaAccion?.fecha ? ` · ${escapeHTML(d.ultimaAccion.fecha)}` : ''}</div>
      </td>
    </tr>
  `;

}


function obtenerAccionDeseo(d) {

  if (d.estado === 'pendiente') {
    return `<button class="action-btn primary-action" data-avanzar="en_revision" data-id="${d.id}"><span>✓</span> Marcar en revisión</button>`;
  }

  if (d.estado === 'en_revision') {
    return `<button class="action-btn primary-action" data-avanzar="bingo" data-id="${d.id}"><span>✓</span> Marcar ¡Bingo!</button>`;
  }

  if (d.estado === 'bingo') {
    return `<button class="action-btn primary-action" data-avanzar="disponible" data-id="${d.id}"><span>✓</span> Marcar disponible</button>`;
  }

  return '';

}


// ============================================================
// DETALLE (informativo, no requiere autorización)
// ============================================================

function abrirDetalleDeseo(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const d = deseosStaff.find(item => item.id === id);

  if (!overlay || !box || !d) return;

  const estado = ESTADOS_DESEOS_STAFF[d.estado] || { label: d.estado, clase: '' };

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <span class="eyebrow">${escapeHTML(d.id)}</span>

    <h3 style="margin-top:5px;">Detalle de la solicitud</h3>

    <div class="modal-context">
      <span>Emprendedora</span><strong>${escapeHTML(d.emprendedora)}</strong>
      <span>Teléfono</span><strong>${escapeHTML(d.telefono || 'Sin teléfono')}</strong>
      <span>Pieza deseada</span><strong>${escapeHTML(d.titulo)}</strong>
      <span>Descripción</span><strong>${escapeHTML(d.descripcion || 'Sin descripción')}</strong>
      <span>Foto de referencia</span><strong>${d.tieneFoto ? 'Adjunta' : 'Sin foto'}</strong>
      <span>Fecha de solicitud</span><strong>${escapeHTML(d.fecha || '')}</strong>
      <span>Estado</span><span class="wishlist-status ${estado.clase}">${escapeHTML(estado.label)}</span>
    </div>

    <div class="modal-note">
      <strong>Última acción:</strong>
      ${escapeHTML(d.ultimaAccion?.texto || 'Sin registro')}
      ${d.ultimaAccion?.usuario ? ` · ${escapeHTML(d.ultimaAccion.usuario)}` : ''}
      ${d.ultimaAccion?.fecha ? ` · ${escapeHTML(d.ultimaAccion.fecha)}` : ''}
    </div>

    <button class="btn btn-outline" style="width:100%;" data-close>Cerrar</button>

  `;

  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModalDeseo);

}


// ============================================================
// AVANZAR ESTADO (acción sensible: cambia estado — sí requiere
// autorización, pero sin volver a pedir credenciales)
// ============================================================

function confirmarAvanzarDeseo(nuevoEstado, id) {

  const deseo = deseosStaff.find(d => d.id === id);
  if (!deseo) return;

  const etiquetas = {
    en_revision: { titulo: 'Marcar en revisión', mensaje: `Estás a punto de marcar "${deseo.titulo}" de ${deseo.emprendedora} como en revisión.` },
    bingo: { titulo: 'Marcar ¡Bingo!', mensaje: `Estás a punto de marcar "${deseo.titulo}" de ${deseo.emprendedora} como ¡Bingo! — ya encontraron una pieza para pedir.` },
    disponible: { titulo: 'Marcar disponible', mensaje: `Estás a punto de marcar "${deseo.titulo}" de ${deseo.emprendedora} como disponible. Recuerda notificar a la emprendedora.` }
  };

  const info = etiquetas[nuevoEstado] || { titulo: 'Autorización', mensaje: `Estás a punto de actualizar la solicitud de ${deseo.emprendedora}.` };

  abrirAutorizacionAdmin({
    titulo: info.titulo,
    mensaje: info.mensaje,
    onConfirmar: () => avanzarDeseo(id, nuevoEstado)
  });

}

function avanzarDeseo(id, nuevoEstado) {

  const deseo = deseosStaff.find(d => d.id === id);
  if (!deseo) return;

  const textos = {
    en_revision: 'Marcada en revisión',
    bingo: 'Coincidencia encontrada',
    disponible: 'Marcada disponible'
  };

  deseo.estado = nuevoEstado;

  deseo.ultimaAccion = {
    texto: textos[nuevoEstado] || 'Actualizada',
    usuario: ADMIN_IDENTIDAD.usuarioNombre,
    fecha: new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  };

  guardarDeseosStaff();
  cerrarModalDeseo();
  renderTablaDeseos();

  registrarAuditoriaAdmin({ modulo: 'lista_deseos', accion: 'avanzar_estado', descripcion: `Solicitud "${deseo.titulo}" de ${deseo.emprendedora} → ${textos[nuevoEstado] || nuevoEstado}` });
  mostrarToast(`Solicitud actualizada por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalDeseo() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
