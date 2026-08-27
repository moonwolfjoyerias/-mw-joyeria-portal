// ============================================================
// MW JOYERÍA — Panel de Staff — Apartados
// Depende de:
//   - staff-apartados-ejemplo.js
//
// ⚠️ TEMPORAL:
// La información y autenticación serán reemplazadas por
// Firestore + Firebase Authentication en producción.
// ============================================================


let apartadosStaff = [];

let filtroEstado = 'todos';

let busquedaActual = '';

let paginaActual = 1;

let filasPorPagina = 10;

let accionPendiente = null;


// ============================================================
// INICIO
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  apartadosStaff = APARTADOS_STAFF_EJEMPLO.map(apartado => ({
    ...apartado
  }));

  filasPorPagina =
    CONFIG_STAFF_APARTADOS_EJEMPLO.filasPorPagina || 10;

  renderApartadosStaff();

  inicializarEventos();

});


// ============================================================
// EVENTOS GENERALES
// ============================================================

function inicializarEventos() {

  const filtro = document.getElementById('estadoFilter');

  if (filtro) {

    filtro.addEventListener('change', () => {

      filtroEstado = filtro.value;

      paginaActual = 1;

      renderApartadosStaff();

    });

  }


  const buscador = document.getElementById('buscarApartado');

  if (buscador) {

    buscador.addEventListener('input', () => {

      busquedaActual = buscador.value
        .trim()
        .toLowerCase();

      paginaActual = 1;

      renderApartadosStaff();

    });

  }


  const cerrarModal = document.querySelectorAll('[data-close]');

  cerrarModal.forEach(btn => {

    btn.addEventListener('click', cerrarModalStaff);

  });


  const overlay = document.getElementById('modalOverlay');

  if (overlay) {

    overlay.addEventListener('click', (e) => {

      if (e.target === overlay) {

        cerrarModalStaff();

      }

    });

  }

}


// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderApartadosStaff() {

  const tbody =
    document.getElementById('apartadosTableBody');

  if (!tbody) return;


  const filtrados = obtenerApartadosFiltrados();


  const totalPaginas =
    Math.max(
      1,
      Math.ceil(filtrados.length / filasPorPagina)
    );


  if (paginaActual > totalPaginas) {

    paginaActual = totalPaginas;

  }


  const inicio =
    (paginaActual - 1) * filasPorPagina;


  const pagina =
    filtrados.slice(
      inicio,
      inicio + filasPorPagina
    );


  if (pagina.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-table">
          No se encontraron apartados.
        </td>
      </tr>
    `;

  } else {

    tbody.innerHTML =
      pagina.map(renderFilaApartado).join('');

  }


  actualizarResumen(filtrados);

  renderPaginacion(totalPaginas);

  conectarBotonesAcciones();

}


// ============================================================
// FILTROS
// ============================================================

function obtenerApartadosFiltrados() {

  return apartadosStaff.filter(apartado => {

    const coincideEstado =
      filtroEstado === 'todos' ||
      apartado.estado === filtroEstado;


    const texto =
      [
        apartado.cliente.nombre,
        apartado.cliente.id,
        apartado.pieza.nombre,
        apartado.pieza.codigo,
        apartado.pieza.variante
      ]
      .join(' ')
      .toLowerCase();


    const coincideBusqueda =
      !busquedaActual ||
      texto.includes(busquedaActual);


    return coincideEstado && coincideBusqueda;

  });

}


// ============================================================
// FILA DE TABLA
// ============================================================

function renderFilaApartado(apartado) {

  const estado =
    obtenerConfiguracionEstado(apartado.estado);


  const acciones =
    renderAcciones(apartado);


  return `
    <tr data-apartado-id="${apartado.id}">

      <!-- EMPRENDEDORA -->
      <td>

        <div class="staff-client">

          <div class="staff-avatar">
            ${escaparHTML(apartado.cliente.iniciales)}
          </div>

          <div>

            <strong>
              ${escaparHTML(apartado.cliente.nombre)}
            </strong>

            <span>
              ID: ${escaparHTML(apartado.cliente.id)}
            </span>

          </div>

        </div>

      </td>


      <!-- PIEZA -->
      <td>

        <div class="staff-product">

          <div class="staff-product-image">

            <img
              src="${escaparHTML(apartado.pieza.imagen)}"
              alt=""
            >

          </div>

          <div>

            <strong>
              ${escaparHTML(apartado.pieza.nombre)}
            </strong>

            <span>
              ${escaparHTML(apartado.pieza.codigo)}
            </span>

          </div>

        </div>

      </td>


      <!-- VARIANTE -->
      <td>
        ${escaparHTML(apartado.pieza.variante)}
      </td>


      <!-- FECHA -->
      <td>

        <div class="staff-date">

          <strong>
            ${escaparHTML(apartado.fechaSolicitud)}
          </strong>

          <span>
            ${escaparHTML(apartado.horaSolicitud)}
          </span>

        </div>

      </td>


      <!-- DEPÓSITO -->
      <td>

        <div class="deposit-status ${apartado.deposito.estado}">

          <span class="status-dot"></span>

          <div>

            <strong>
              ${apartado.deposito.estado === 'confirmado'
                ? 'Confirmado'
                : 'Pendiente'}
            </strong>

            <span>
              $${apartado.deposito.monto} MXN
            </span>

          </div>

        </div>

      </td>


      <!-- ESTADO -->
      <td>

        <span class="staff-status ${estado.clase}">
          ${estado.texto}
        </span>

      </td>


      <!-- ACCIONES -->
      <td>

        <div class="staff-actions">

          ${acciones}

        </div>

      </td>


      <!-- ÚLTIMA ACCIÓN -->
      <td>

        <div class="last-action">

          <div class="last-action-avatar">
            ${obtenerIniciales(
              apartado.ultimaAccion.nombre
            )}
          </div>

          <div>

            <strong>
              ${escaparHTML(
                apartado.ultimaAccion.nombre
              )}
            </strong>

            <span>
              ${escaparHTML(
                apartado.ultimaAccion.fecha
              )}
            </span>

            <span>
              ${escaparHTML(
                apartado.ultimaAccion.hora
              )}
            </span>

          </div>

        </div>

      </td>

    </tr>
  `;

}


// ============================================================
// ESTADOS
// ============================================================

function obtenerConfiguracionEstado(estado) {

  const estados = {

    'pendiente-deposito': {
      texto: 'Pendiente de depósito',
      clase: 'status-pending'
    },

    'deposito-confirmado': {
      texto: 'Depósito confirmado',
      clase: 'status-confirmed'
    },

    'apartado-activo': {
      texto: 'Apartado activo',
      clase: 'status-active'
    },

    'vencido': {
      texto: 'Vencido',
      clase: 'status-expired'
    },

    'desapartado': {
      texto: 'Desapartado',
      clase: 'status-cancelled'
    }

  };


  return estados[estado] || {

    texto: 'Sin estado',

    clase: ''

  };

}


// ============================================================
// BOTONES DE ACCIONES
// ============================================================

function renderAcciones(apartado) {

  let html = '';


  // ----------------------------------------------------------
  // CONFIRMAR DEPÓSITO
  // ----------------------------------------------------------

  if (apartado.estado === 'pendiente-deposito') {

    html += `
      <button
        class="staff-btn staff-btn-primary"
        data-action="confirmar-deposito"
        data-id="${apartado.id}"
      >
        <span>✓</span>
        Confirmar depósito
      </button>
    `;

  }


  // ----------------------------------------------------------
  // CONFIRMAR APARTADO
  // Solo disponible cuando el depósito ya está confirmado.
  // ----------------------------------------------------------

  if (apartado.estado === 'deposito-confirmado') {

    html += `
      <button
        class="staff-btn staff-btn-primary"
        data-action="confirmar-apartado"
        data-id="${apartado.id}"
      >
        <span>✓</span>
        Confirmar apartado
      </button>
    `;

  }


  // ----------------------------------------------------------
  // DESAPARTAR
  // Disponible para apartados que todavía pueden liberarse.
  // ----------------------------------------------------------

  if (
    apartado.estado === 'pendiente-deposito' ||
    apartado.estado === 'deposito-confirmado' ||
    apartado.estado === 'apartado-activo'
  ) {

    html += `
      <button
        class="staff-btn staff-btn-danger"
        data-action="desapartar"
        data-id="${apartado.id}"
      >
        <span>×</span>
        Desapartar
      </button>
    `;

  }


  // ----------------------------------------------------------
  // VER DETALLE
  // ----------------------------------------------------------

  html += `
    <button
      class="staff-btn staff-btn-outline"
      data-action="detalle"
      data-id="${apartado.id}"
    >
      <span>◉</span>
      Ver detalle
    </button>
  `;


  return html;

}


// ============================================================
// CONECTAR BOTONES
// ============================================================

function conectarBotonesAcciones() {

  document
    .querySelectorAll('[data-action]')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        const accion =
          btn.getAttribute('data-action');

        const id =
          btn.getAttribute('data-id');


        manejarAccion(accion, id);

      });

    });

}


// ============================================================
// MANEJAR ACCIÓN
// ============================================================

function manejarAccion(accion, id) {

  const apartado =
    apartadosStaff.find(
      item => item.id === id
    );


  if (!apartado) return;


  switch (accion) {

    case 'confirmar-deposito':

      abrirModalAutorizacion(
        'confirmar-deposito',
        apartado
      );

      break;


    case 'confirmar-apartado':

      abrirModalAutorizacion(
        'confirmar-apartado',
        apartado
      );

      break;


    case 'desapartar':

      abrirModalAutorizacion(
        'desapartar',
        apartado
      );

      break;


    case 'detalle':

      abrirModalDetalle(apartado);

      break;

  }

}


// ============================================================
// MODAL DE AUTORIZACIÓN
// ============================================================

function abrirModalAutorizacion(accion, apartado) {

  const overlay =
    document.getElementById('modalOverlay');

  const box =
    document.getElementById('modalBox');


  if (!overlay || !box) return;


  accionPendiente = {

    accion,
    apartadoId: apartado.id

  };


  const configuracion =
    obtenerTextoAccion(accion);


  box.innerHTML = `

    <button
      class="modal-close"
      data-close
      aria-label="Cerrar"
    >
      ×
    </button>


    <div class="authorization-icon">

      <span>🔐</span>

    </div>


    <h3>
      ${configuracion.titulo}
    </h3>


    <p class="modal-sub">

      ${configuracion.descripcion}

    </p>


    <div class="authorization-target">

      <strong>
        ${escaparHTML(apartado.cliente.nombre)}
      </strong>

      <span>
        ${escaparHTML(apartado.pieza.nombre)}
      </span>

    </div>


    <div class="form-group">

      <label for="staffUsuario">
        Usuario del personal
      </label>

      <input
        type="text"
        id="staffUsuario"
        autocomplete="username"
        placeholder="Ej. staff.sofia"
      >

    </div>


    <div class="form-group">

      <label for="staffPassword">
        Contraseña
      </label>

      <input
        type="password"
        id="staffPassword"
        autocomplete="current-password"
        placeholder="Ingresa tu contraseña"
      >

    </div>


    <div
      id="authError"
      class="auth-error"
      style="display:none;"
    >
      Usuario o contraseña incorrectos.
    </div>


    <button
      class="btn btn-primary authorization-submit"
      id="autorizarAccionBtn"
    >
      Autorizar acción
    </button>


    <button
      class="btn btn-secondary"
      data-close
    >
      Cancelar
    </button>

  `;


  overlay.classList.add('open');


  box
    .querySelectorAll('[data-close]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        cerrarModalStaff
      );

    });


  const usuarioInput =
    document.getElementById('staffUsuario');

  const passwordInput =
    document.getElementById('staffPassword');

  const autorizarBtn =
    document.getElementById('autorizarAccionBtn');


  autorizarBtn.addEventListener(
    'click',
    validarAutorizacion
  );


  passwordInput.addEventListener(
    'keydown',
    event => {

      if (event.key === 'Enter') {

        validarAutorizacion();

      }

    }
  );


  setTimeout(() => {

    usuarioInput.focus();

  }, 100);

}


// ============================================================
// TEXTOS DE ACCIONES
// ============================================================

function obtenerTextoAccion(accion) {

  const textos = {

    'confirmar-deposito': {

      titulo: 'Confirmar depósito',

      descripcion:
        'Autoriza esta acción ingresando tus credenciales de personal.'

    },

    'confirmar-apartado': {

      titulo: 'Confirmar apartado',

      descripcion:
        'El apartado pasará a estado “Apartado activo”.'

    },

    'desapartar': {

      titulo: 'Desapartar pieza',

      descripcion:
        'La pieza será liberada y el apartado quedará cancelado.'

    }

  };


  return textos[accion] || {

    titulo: 'Autorizar acción',

    descripcion:
      'Ingresa tus credenciales para continuar.'

  };

}


// ============================================================
// VALIDAR CREDENCIALES
// ============================================================

function validarAutorizacion() {

  if (!accionPendiente) return;


  const usuarioInput =
    document.getElementById('staffUsuario');

  const passwordInput =
    document.getElementById('staffPassword');

  const error =
    document.getElementById('authError');


  const usuario =
    usuarioInput.value.trim();

  const password =
    passwordInput.value;


  const personal =
    PERSONAL_EJEMPLO.find(
      staff =>
        staff.usuario === usuario &&
        staff.password === password
    );


  if (!personal) {

    error.style.display = 'block';

    passwordInput.value = '';

    passwordInput.focus();

    return;

  }


  ejecutarAccionAutorizada(
    accionPendiente.accion,
    accionPendiente.apartadoId,
    personal
  );

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccionAutorizada(
  accion,
  apartadoId,
  personal
) {

  const apartado =
    apartadosStaff.find(
      item => item.id === apartadoId
    );


  if (!apartado) return;


  const ahora =
    obtenerFechaHoraActual();


  // ----------------------------------------------------------
  // CONFIRMAR DEPÓSITO
  // ----------------------------------------------------------

  if (accion === 'confirmar-deposito') {

    if (
      apartado.estado !==
      'pendiente-deposito'
    ) {

      mostrarError(
        'Este apartado ya no está pendiente de depósito.'
      );

      return;

    }


    apartado.deposito.estado =
      'confirmado';

    apartado.estado =
      'deposito-confirmado';


    registrarUltimaAccion(
      apartado,
      personal,
      ahora
    );


    cerrarModalStaff();


    renderApartadosStaff();


    mostrarToast(
      'Depósito confirmado correctamente.'
    );


    return;

  }


  // ----------------------------------------------------------
  // CONFIRMAR APARTADO
  // ----------------------------------------------------------

  if (accion === 'confirmar-apartado') {

    if (
      apartado.estado !==
      'deposito-confirmado'
    ) {

      mostrarError(
        'Primero debes confirmar el depósito.'
      );

      return;

    }


    apartado.estado =
      'apartado-activo';


    registrarUltimaAccion(
      apartado,
      personal,
      ahora
    );


    cerrarModalStaff();


    renderApartadosStaff();


    mostrarToast(
      'Apartado confirmado y activado.'
    );


    return;

  }


  // ----------------------------------------------------------
  // DESAPARTAR
  // ----------------------------------------------------------

  if (accion === 'desapartar') {

    if (
      apartado.estado ===
      'desapartado'
    ) {

      mostrarError(
        'Este apartado ya fue desapartado.'
      );

      return;

    }


    apartado.estado =
      'desapartado';


    registrarUltimaAccion(
      apartado,
      personal,
      ahora
    );


    cerrarModalStaff();


    renderApartadosStaff();


    mostrarToast(
      'La pieza fue desapartada correctamente.'
    );


    return;

  }

}


// ============================================================
// REGISTRAR ÚLTIMA ACCIÓN
// ============================================================

function registrarUltimaAccion(
  apartado,
  personal,
  ahora
) {

  apartado.ultimaAccion = {

    usuario: personal.usuario,

    nombre: personal.nombre,

    fecha: ahora.fecha,

    hora: ahora.hora

  };

}


// ============================================================
// MODAL DETALLE
// ============================================================

function abrirModalDetalle(apartado) {

  const overlay =
    document.getElementById('modalOverlay');

  const box =
    document.getElementById('modalBox');


  if (!overlay || !box) return;


  const estado =
    obtenerConfiguracionEstado(
      apartado.estado
    );


  box.innerHTML = `

    <button
      class="modal-close"
      data-close
    >
      ×
    </button>


    <h3>
      Detalle del apartado
    </h3>


    <p class="modal-sub">
      ${escaparHTML(apartado.id)}
    </p>


    <div class="detail-section">

      <h4>Emprendedora</h4>

      <p>
        <strong>
          ${escaparHTML(apartado.cliente.nombre)}
        </strong>
        <br>
        ID:
        ${escaparHTML(apartado.cliente.id)}
        <br>
        Tel:
        ${escaparHTML(apartado.cliente.telefono)}
      </p>

    </div>


    <div class="detail-section">

      <h4>Pieza</h4>

      <p>
        <strong>
          ${escaparHTML(apartado.pieza.nombre)}
        </strong>
        <br>
        Código:
        ${escaparHTML(apartado.pieza.codigo)}
        <br>
        Variante:
        ${escaparHTML(apartado.pieza.variante)}
      </p>

    </div>


    <div class="detail-section">

      <h4>Estado</h4>

      <span class="staff-status ${estado.clase}">
        ${estado.texto}
      </span>

    </div>


    <div class="detail-section">

      <h4>Última acción</h4>

      <p>
        ${escaparHTML(
          apartado.ultimaAccion.nombre
        )}
        <br>
        ${escaparHTML(
          apartado.ultimaAccion.fecha
        )}
        ·
        ${escaparHTML(
          apartado.ultimaAccion.hora
        )}
      </p>

    </div>


    <button
      class="btn btn-primary"
      style="width:100%;"
      data-close
    >
      Cerrar
    </button>

  `;


  overlay.classList.add('open');


  box
    .querySelectorAll('[data-close]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        cerrarModalStaff
      );

    });

}


// ============================================================
// PAGINACIÓN
// ============================================================

function renderPaginacion(totalPaginas) {

  const container =
    document.getElementById('pagination');

  if (!container) return;


  if (totalPaginas <= 1) {

    container.innerHTML = '';

    return;

  }


  let html = '';


  html += `
    <button
      class="pagination-btn"
      ${paginaActual === 1 ? 'disabled' : ''}
      data-page="${paginaActual - 1}"
    >
      ←
    </button>
  `;


  for (
    let i = 1;
    i <= totalPaginas;
    i++
  ) {

    html += `
      <button
        class="pagination-btn ${i === paginaActual ? 'active' : ''}"
        data-page="${i}"
      >
        ${i}
      </button>
    `;

  }


  html += `
    <button
      class="pagination-btn"
      ${paginaActual === totalPaginas ? 'disabled' : ''}
      data-page="${paginaActual + 1}"
    >
      →
    </button>
  `;


  container.innerHTML = html;


  container
    .querySelectorAll('[data-page]')
    .forEach(btn => {

      btn.addEventListener(
        'click',
        () => {

          const pagina =
            Number(
              btn.getAttribute('data-page')
            );


          if (
            pagina < 1 ||
            pagina > totalPaginas
          ) {

            return;

          }


          paginaActual = pagina;

          renderApartadosStaff();

        }
      );

    });

}


// ============================================================
// RESUMEN
// ============================================================

function actualizarResumen(apartados) {

  const total =
    apartados.length;


  const pendientes =
    apartados.filter(
      a =>
        a.estado ===
        'pendiente-deposito'
    ).length;


  const depositoConfirmado =
    apartados.filter(
      a =>
        a.estado ===
        'deposito-confirmado'
    ).length;


  const activos =
    apartados.filter(
      a =>
        a.estado ===
        'apartado-activo'
    ).length;


  const vencidos =
    apartados.filter(
      a =>
        a.estado ===
        'vencido'
    ).length;


  setText(
    'totalApartados',
    total
  );


  setText(
    'pendientesDeposito',
    pendientes
  );


  setText(
    'depositosConfirmados',
    depositoConfirmado
  );


  setText(
    'apartadosActivos',
    activos
  );


  setText(
    'apartadosVencidos',
    vencidos
  );

}


// ============================================================
// CERRAR MODAL
// ============================================================

function cerrarModalStaff() {

  const overlay =
    document.getElementById('modalOverlay');


  if (overlay) {

    overlay.classList.remove('open');

  }


  accionPendiente = null;

}


// ============================================================
// TOAST
// ============================================================

function mostrarToast(mensaje) {

  let toast =
    document.getElementById(
      'staffToast'
    );


  if (!toast) {

    toast =
      document.createElement('div');

    toast.id =
      'staffToast';

    toast.className =
      'staff-toast';

    document.body.appendChild(toast);

  }


  toast.textContent = mensaje;

  toast.classList.add('show');


  setTimeout(() => {

    toast.classList.remove('show');

  }, 3000);

}


// ============================================================
// ERROR
// ============================================================

function mostrarError(mensaje) {

  mostrarToast(
    mensaje
  );

}


// ============================================================
// FECHA Y HORA
// ============================================================

function obtenerFechaHoraActual() {

  const ahora =
    new Date();


  const dia =
    String(
      ahora.getDate()
    ).padStart(2, '0');


  const mes =
    String(
      ahora.getMonth() + 1
    ).padStart(2, '0');


  const año =
    ahora.getFullYear();


  let horas =
    ahora.getHours();


  const minutos =
    String(
      ahora.getMinutes()
    ).padStart(2, '0');


  const ampm =
    horas >= 12
      ? 'p.m.'
      : 'a.m.';


  horas =
    horas % 12 || 12;


  return {

    fecha:
      `${dia}/${mes}/${año}`,

    hora:
      `${horas}:${minutos} ${ampm}`

  };

}


// ============================================================
// INICIALES
// ============================================================

function obtenerIniciales(nombre) {

  if (!nombre) return 'MW';


  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(
      palabra =>
        palabra.charAt(0)
    )
    .join('')
    .toUpperCase();

}


// ============================================================
// TEXTO SEGURO
// ============================================================

function escaparHTML(valor) {

  if (valor === null ||
      valor === undefined) {

    return '';

  }


  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


// ============================================================
// SET TEXT
// ============================================================

function setText(id, valor) {

  const elemento =
    document.getElementById(id);


  if (elemento) {

    elemento.textContent =
      valor;

  }

}