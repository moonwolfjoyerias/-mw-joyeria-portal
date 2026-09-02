// MW JOYERÍA — Staff: Lista de deseos
//
// Permite:
// - Ver todas las solicitudes de las emprendedoras
// - Avanzar el estado de cada solicitud (pendiente → en revisión → ¡bingo! → disponible)
// - Ver el detalle completo de una solicitud
//
// Toda acción exige usuario y contraseña del empleado, igual que en
// Catálogo, Apartados y Calendario.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida hasta
// integrar Firestore en Fase 3.

let deseosStaff = [];
let accionDeseoPendiente = null;

// La carga inicial (semilla + localStorage) vive en
// cargarDeseosStaffActuales() (staff-deseos-ejemplo.js) para que
// Inicio y Lista de deseos siempre muestren los mismos datos.

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

  const search = document.getElementById('searchInput');

  if (search) {
    search.addEventListener('input', renderTablaDeseos);
  }


  const estado = document.getElementById('filterEstado');

  if (estado) {
    estado.addEventListener('change', renderTablaDeseos);
  }


  const overlay = document.getElementById('modalOverlay');

  if (overlay) {

    overlay.addEventListener('click', (e) => {

      if (e.target === overlay) {
        cerrarModalDeseo();
      }

    });

  }

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

  const search =
    document.getElementById('searchInput')?.value
      .toLowerCase()
      .trim() || '';

  const estado =
    document.getElementById('filterEstado')?.value || '';

  const deseos = deseosStaff.filter(d => {

    if (
      search &&
      !d.emprendedora.toLowerCase().includes(search) &&
      !d.titulo.toLowerCase().includes(search) &&
      !(d.descripcion || '').toLowerCase().includes(search)
    ) {
      return false;
    }

    if (estado && d.estado !== estado) {
      return false;
    }

    return true;

  });


  const count = document.getElementById('resultCount');

  if (count) {
    count.textContent =
      `${deseos.length} solicitud${deseos.length === 1 ? '' : 'es'}`;
  }


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

    btn.addEventListener('click', () => {
      solicitarAutorizacionDeseo(btn.dataset.avanzar, btn.dataset.id);
    });

  });


  tbody.querySelectorAll('[data-detalle]').forEach(btn => {

    btn.addEventListener('click', () => {
      abrirDetalleDeseo(btn.dataset.detalle);
    });

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
// DETALLE
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
// AUTENTICACIÓN PARA ACCIONES
// ============================================================

function solicitarAutorizacionDeseo(nuevoEstado, id) {

  accionDeseoPendiente = { nuevoEstado, id };

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const deseo = deseosStaff.find(d => d.id === id);

  if (!overlay || !box || !deseo) return;

  const etiquetas = {
    en_revision: { titulo: 'Marcar en revisión', descripcion: 'Confirma que tu equipo ya está buscando esta pieza.' },
    bingo: { titulo: 'Marcar ¡Bingo!', descripcion: 'Confirma que encontraron una pieza igual o parecida para pedirla.' },
    disponible: { titulo: 'Marcar disponible', descripcion: 'La pieza ya está disponible — recuerda notificar a la emprendedora.' }
  };

  const info = etiquetas[nuevoEstado] || { titulo: 'Autorizar acción', descripcion: 'Ingresa tus credenciales para continuar.' };

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <div class="auth-icon">✓</div>

    <h3>${info.titulo}</h3>

    <p class="modal-sub">${info.descripcion}</p>

    <div class="modal-context">
      <span>Emprendedora</span><strong>${escapeHTML(deseo.emprendedora)}</strong>
      <span>Pieza deseada</span><strong>${escapeHTML(deseo.titulo)}</strong>
    </div>

    <div class="auth-warning">
      <span>🔐</span>
      <div>
        <strong>Acción registrada</strong>
        <small>El sistema guardará el usuario, fecha y hora de esta modificación.</small>
      </div>
    </div>

    <label for="deseoUsuario">Usuario de empleado</label>
    <input id="deseoUsuario" type="text" autocomplete="username" placeholder="Ej. staff01">

    <label for="deseoPassword">Contraseña</label>
    <div class="password-wrap">
      <input id="deseoPassword" type="password" autocomplete="current-password" placeholder="Contraseña">
      <button type="button" id="mostrarPasswordDeseo">Ver</button>
    </div>

    <div id="authError" style="display:none;" class="auth-error"></div>

    <button class="btn btn-primary" id="autorizarDeseoBtn" style="width:100%;">Autorizar y continuar</button>

    <p class="demo-note">
      Demo: usuario <strong>staff01</strong> · contraseña <strong>1234</strong>
    </p>

  `;

  overlay.classList.add('open');

  document.getElementById('mostrarPasswordDeseo')?.addEventListener('click', () => {
    const input = document.getElementById('deseoPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('autorizarDeseoBtn')?.addEventListener('click', validarAutorizacionDeseo);

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    accionDeseoPendiente = null;
    cerrarModalDeseo();
  });

}


function validarAutorizacionDeseo() {

  const usuario = document.getElementById('deseoUsuario')?.value.trim();
  const password = document.getElementById('deseoPassword')?.value;
  const error = document.getElementById('authError');

  const empleado = STAFF_USUARIOS_EJEMPLO.find(
    u => u.usuario === usuario && u.password === password
  );

  if (!empleado) {

    if (error) {
      error.style.display = 'block';
      error.textContent = 'Usuario o contraseña incorrectos.';
    }

    return;

  }

  ejecutarAccionDeseo(empleado);

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccionDeseo(empleado) {

  if (!accionDeseoPendiente) return;

  const deseo = deseosStaff.find(d => d.id === accionDeseoPendiente.id);

  if (!deseo) return;

  const textos = {
    en_revision: 'Marcada en revisión',
    bingo: 'Coincidencia encontrada',
    disponible: 'Marcada disponible'
  };

  deseo.estado = accionDeseoPendiente.nuevoEstado;

  deseo.ultimaAccion = {
    texto: textos[accionDeseoPendiente.nuevoEstado] || 'Actualizada',
    usuario: empleado.nombre,
    fecha: new Date().toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  };

  guardarDeseosStaff();

  registrarAuditoria({
    usuarioId: empleado.usuario,
    usuarioNombre: empleado.nombre,
    rol: 'staff',
    modulo: 'lista_deseos',
    accion: 'avanzar_estado',
    descripcion: `Solicitud "${deseo.titulo}" → ${textos[accionDeseoPendiente.nuevoEstado] || accionDeseoPendiente.nuevoEstado}`
  });
  cerrarModalDeseo();
  renderTablaDeseos();

  mostrarToast(`Solicitud actualizada por ${empleado.nombre}.`);

  accionDeseoPendiente = null;

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalDeseo() {

  const overlay = document.getElementById('modalOverlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

}


function escapeHTML(texto) {

  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}
