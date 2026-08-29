// MW JOYERÍA — Staff: Apartados
// Manejo de apartados, filtros, búsqueda y autorización de acciones.
// ⚠️ TEMPORAL: utiliza datos de staff-apartados-ejemplo.js.

let apartados = [];
let paginaActual = 1;
let filtroEstado = "todos";
let terminoBusqueda = "";

const filasPorPagina =
  CONFIG_STAFF_APARTADOS_EJEMPLO?.filasPorPagina || 6;

let apartadoSeleccionado = null;
let accionPendiente = null;
let datosDepositoPendiente = null;
const APARTADOS_STORAGE_KEY = "mw-staff-apartados-v3";
const MENSAJE_WHATSAPP_VENCIDO = "Tu apartado ya venció. Por favor, contáctanos para revisar las opciones disponibles.";


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  const apartadosEjemploCompartidos = (typeof APARTADOS_EJEMPLO === "undefined" ? [] : APARTADOS_EJEMPLO).map((apartado, index) => ({
    id: `EJ-${apartado.id || index + 1}`,
    emprendedora: apartado.emprendedora || "Usuario de ejemplo",
    iniciales: obtenerIniciales(apartado.emprendedora || "Usuario de ejemplo"),
    telefono: apartado.telefono || "",
    categoria: apartado.categoria || "normal",
    pieza: apartado.nombre,
    variante: apartado.variante,
    precio: apartado.precioEmprendedora,
    fechaSolicitud: "12 mayo 2025",
    horaSolicitud: "09:00 AM",
    fechaConfirmacion: new Date().toISOString(),
    deposito: apartado.categoria === "vip" ? "no_requiere" : "confirmado",
    estado: "activo",
    ultimaAccion: { texto: "Apartado confirmado", fecha: "12 mayo 2025 · 09:00 AM", usuario: "Sistema" }
  }));

  const datosIniciales = [...APARTADOS_STAFF_EJEMPLO, ...apartadosEjemploCompartidos];
  apartados = cargarApartados() || datosIniciales.map(apartado => ({
    ...apartado,
    ultimaAccion: apartado.ultimaAccion
      ? { ...apartado.ultimaAccion }
      : null
  }));

  actualizarVencimientos();

  actualizarResumen();
  renderTabla();
  configurarEventos();

});

function obtenerIniciales(nombre) {
  return nombre.split(" ").map(parte => parte[0]).join("").slice(0, 2).toUpperCase();
}

function cargarApartados() {
  try {
    const guardados = JSON.parse(localStorage.getItem(APARTADOS_STORAGE_KEY));
    return Array.isArray(guardados) ? guardados : null;
  } catch (error) {
    return null;
  }
}

function guardarApartados() {
  localStorage.setItem(APARTADOS_STORAGE_KEY, JSON.stringify(apartados));
}

function diasPermitidos(categoria) {
  return categoria === "foranea" ? 15 : 3;
}

function actualizarVencimientos() {
  const ahora = Date.now();
  apartados.forEach(apartado => {
    if (apartado.estado !== "activo" || apartado.categoria === "vip" || apartado.deposito !== "confirmado" || !apartado.fechaConfirmacion) return;
    const limite = new Date(apartado.fechaConfirmacion).getTime() + diasPermitidos(apartado.categoria) * 24 * 60 * 60 * 1000;
    if (ahora >= limite) apartado.estado = "vencido";
  });
}


// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {

  const statusSelect = document.getElementById("statusSelect");

  if (statusSelect) {
    statusSelect.addEventListener("change", () => {
      filtroEstado = statusSelect.value;
      paginaActual = 1;
      renderTabla();
    });
  }


  const searchInput = document.getElementById("searchInput");

  if (searchInput) {
    searchInput.addEventListener("input", () => {
      terminoBusqueda = searchInput.value.trim().toLowerCase();
      paginaActual = 1;
      renderTabla();
    });
  }


  // Cerrar modal haciendo click fuera
  const overlay = document.getElementById("modalOverlay");

  if (overlay) {
    overlay.addEventListener("click", event => {

      if (event.target === overlay) {
        cerrarModal();
      }

    });
  }

}


// ============================================================
// TABLA
// ============================================================

function renderTabla() {

  const tbody = document.getElementById("apartadosTableBody");

  if (!tbody) return;

  const filtrados = obtenerApartadosFiltrados();

  const totalPaginas = Math.max(
    1,
    Math.ceil(filtrados.length / filasPorPagina)
  );

  if (paginaActual > totalPaginas) {
    paginaActual = totalPaginas;
  }

  const inicio = (paginaActual - 1) * filasPorPagina;

  const pagina = filtrados.slice(
    inicio,
    inicio + filasPorPagina
  );


  if (pagina.length === 0) {

    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="empty-cell">
          <div class="empty-state">
            <div class="empty-icon">✦</div>
            <strong>No se encontraron apartados</strong>
            <span>Prueba con otro filtro o búsqueda.</span>
          </div>
        </td>
      </tr>
    `;

  } else {

    tbody.innerHTML = pagina
      .map(apartado => crearFila(apartado))
      .join("");

  }


  actualizarContador(filtrados.length);
  renderPaginacion(totalPaginas);

  agregarEventosAcciones();

}


// ============================================================
// CREAR FILA
// ============================================================

function crearFila(apartado) {

  const estado = obtenerEstado(apartado.estado);

  const deposito = obtenerDeposito(apartado.deposito, apartado.estado);

  const acciones = obtenerAcciones(apartado);


  return `
    <tr>

      <!-- EMPRENDEDORA -->
      <td>
        <div class="client-cell">

          <div class="avatar">
            ${apartado.iniciales}
          </div>

          <div>
            <strong>${apartado.emprendedora}</strong>
            <small>${apartado.telefono}</small>
            <small>${obtenerCategoria(apartado.categoria)}</small>
          </div>

        </div>
      </td>

      <!-- CATEGORÍA -->
      <td>
        <span class="status status-cancelled">${obtenerCategoria(apartado.categoria)}</span>
      </td>


      <!-- PIEZA -->
      <td>
        <div class="piece-cell">

          <div class="piece-thumb">
            MW
          </div>

          <div>
            <strong>${apartado.pieza}</strong>
            <small>$${apartado.precio.toLocaleString("es-MX")} MXN</small>
          </div>

        </div>
      </td>


      <!-- VARIANTE -->
      <td>
        ${apartado.variante}
      </td>


      <!-- FECHA -->
      <td>
        <div class="date-cell">

          <strong>${apartado.fechaSolicitud}</strong>

          <small>${apartado.horaSolicitud}</small>

        </div>
      </td>


      <!-- DEPÓSITO -->
      <td>

        <div class="deposit-cell">

          <span class="dot ${deposito.dot}"></span>

          <div>
            <strong>${deposito.texto}</strong>
            <small>
              ${deposito.descripcion}
            </small>
          </div>

        </div>

      </td>


      <!-- ESTADO -->
      <td>

        <span class="status ${estado.clase}">
          ${estado.texto}
        </span>

      </td>


      <!-- ACCIONES -->
      <td>

        <div class="actions-stack">

          ${acciones}

          <button
            class="action-btn detail-action"
            data-action="detalle"
            data-id="${apartado.id}">
            <span>⌕</span>
            Ver detalle
          </button>

        </div>

      </td>


      <!-- ÚLTIMA ACCIÓN -->
      <td>

        <div class="last-action">

          <strong>
            ${apartado.ultimaAccion?.texto || "—"}
          </strong>

          <small>
            ${apartado.ultimaAccion?.usuario || ""}
          </small>

          <small>
            ${apartado.ultimaAccion?.fecha || ""}
          </small>

        </div>

      </td>

    </tr>
  `;
}


// ============================================================
// ACCIONES DISPONIBLES
// ============================================================

function obtenerAcciones(apartado) {

  let html = "";

  if (!["cancelado", "liquidado"].includes(apartado.estado)) {
    html += `
      <button
        class="action-btn primary-action"
        data-action="pago-total"
        data-id="${apartado.id}">
        <span>✓</span>
        Pagó en su totalidad
      </button>
    `;
  }


  // PENDIENTE DE DEPÓSITO
  if (apartado.estado === "pendiente_deposito") {

    html += `
      <button
        class="action-btn primary-action"
        data-action="confirmar-deposito"
        data-id="${apartado.id}">
        <span>✓</span>
        Confirmar depósito
      </button>
    `;

  }


  // DEPÓSITO CONFIRMADO
  
  if (apartado.estado === "deposito_confirmado") {
    html += `
      <button
        class="action-btn primary-action"
        data-action="confirmar-apartado"
        data-id="${apartado.id}">
        <span>✓</span>
        Confirmar apartado
      </button>
    `;

  }


  // APARTADO ACTIVO
  if (apartado.estado === "activo") {
    
    html += `
      <button
        class="action-btn danger-action"
        data-action="desapartar"
        data-id="${apartado.id}">
        <span>×</span>
        Desapartar
      </button>
    `;

  }


  // APARTADO VENCIDO
  if (apartado.estado === "vencido") {

    html += `
      <button
        class="action-btn primary-action"
        data-action="contactar-whatsapp"
        data-id="${apartado.id}">
        <span>↗</span>
        Contactar por Whatsapp
      </button>
    `;

  }

  if (apartado.estado === "contactada_whatsapp") {
    html += `
      <button
        class="action-btn danger-action"
        data-action="desapartar"
        data-id="${apartado.id}">
        <span>×</span>
        Desapartar
      </button>
    `;
  }


  return html;
}


// ============================================================
// EVENTOS DE BOTONES
// ============================================================

function agregarEventosAcciones() {

  document
    .querySelectorAll("[data-action]")
    .forEach(button => {

      button.addEventListener("click", () => {

        const id = button.dataset.id;
        const accion = button.dataset.action;

        const apartado = apartados.find(
          item => item.id === id
        );

        if (!apartado) return;

        if (accion === "detalle") {
          abrirDetalle(apartado);
          return;
        }

        if (accion === "confirmar-deposito") {
          abrirAutorizacion(apartado, "confirmar-deposito");
          return;
        }

        if (accion === "confirmar-apartado") {
          abrirAutorizacion(apartado, "confirmar-apartado");
          return;
        }

        if (accion === "desapartar") {
          abrirAutorizacion(apartado, "desapartar");
          return;
        }

        if (accion === "contactar-whatsapp") {
          abrirContactoWhatsapp(apartado);
          return;
        }

        if (accion === "pago-total") {
          abrirAutorizacion(apartado, "pago-total");
          return;
        }

      });

    });

}

function abrirContactoWhatsapp(apartado) {
  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  if (!overlay || !box) return;

  const numero = (apartado.telefono || "").replace(/\D/g, "");
  const enlace = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(MENSAJE_WHATSAPP_VENCIDO)}` : "#";

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">↗</div>
    <h3>Contactar por Whatsapp</h3>
    <p class="modal-sub">Abre la conversación con ${apartado.emprendedora} y confirma el contacto para habilitar la acción de desapartar.</p>
    <div class="modal-context">
      <span>Emprendedora</span><strong>${apartado.emprendedora}</strong>
      <span>Teléfono</span><strong>${apartado.telefono || "Sin teléfono"}</strong>
      <span>Mensaje</span><strong>${MENSAJE_WHATSAPP_VENCIDO}</strong>
    </div>
    ${numero ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir Whatsapp</a>` : '<p class="auth-error">Este apartado no tiene un número de teléfono válido.</p>'}
    <button class="btn btn-outline" style="width:100%;" id="confirmarWhatsappBtn">Confirmar contacto por Whatsapp</button>
  `;

  overlay.classList.add("open");
  document.getElementById("confirmarWhatsappBtn")?.addEventListener("click", () => {
    cerrarModal();
    abrirAutorizacion(apartado, "confirmar-whatsapp");
  });
}


// ============================================================
// MODAL DE AUTORIZACIÓN
// ============================================================

function abrirAutorizacion(apartado, accion) {

  apartadoSeleccionado = apartado;
  accionPendiente = accion;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  if (!overlay || !box) return;


  let titulo = "";
  let descripcion = "";
  let icono = "✓";
  let claseIcono = "";


  if (accion === "confirmar-deposito") {

    titulo = "Confirmar depósito";

    descripcion =
      "Confirma que el depósito de $50 MXN fue recibido antes de continuar.";

  }


  if (accion === "confirmar-apartado") {

    titulo = "Confirmar apartado";

    descripcion =
      "El apartado pasará a estado “Apartado activo”.";

  }


  if (accion === "desapartar") {

    titulo = "Desapartar pieza";

    descripcion =
      "La pieza será liberada nuevamente para su venta.";

    icono = "×";
    claseIcono = "danger";

  }

  if (accion === "confirmar-whatsapp") {
    titulo = "Confirmar contacto por Whatsapp";
    descripcion = "Después de autorizar, el apartado quedará listo para desapartar.";
  }

  if (accion === "pago-total") {
    titulo = "Registrar pago total";
    descripcion = "La pieza quedará liquidada y se registrará el pago completo.";
  }


  box.innerHTML = `

    <button
      class="modal-close"
      onclick="cerrarModal()">
      ×
    </button>


    <div class="auth-icon ${claseIcono}">
      ${icono}
    </div>


    <h3>${titulo}</h3>

    <p class="modal-sub">
      ${descripcion}
    </p>


    <div class="modal-context">

      <span>Emprendedora</span>
      <strong>${apartado.emprendedora}</strong>

      <span>Pieza</span>
      <strong>${apartado.pieza}</strong>

      <span>Variante</span>
      <strong>${apartado.variante}</strong>

      <span>Apartado</span>
      <strong>${apartado.id}</strong>

    </div>

    ${["confirmar-deposito", "pago-total"].includes(accion) ? `
      <label for="depositoMonto">Monto recibido</label>
      <input id="depositoMonto" type="number" min="0" step="0.01" value="${accion === "pago-total" ? Number(apartado.saldo ?? apartado.total ?? apartado.precio ?? 0) : ""}" placeholder="Ej. ${accion === "pago-total" ? Number(apartado.saldo ?? apartado.total ?? apartado.precio ?? 0).toLocaleString("es-MX") : "50"}">
      <label for="depositoMetodo">Método de pago</label>
      <select id="depositoMetodo" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
        <option value="">Selecciona una opción</option>
        <option value="transferencia">Transferencia</option>
        <option value="local">Pago en local</option>
      </select>
      <label for="depositoReferencia">Número de referencia</label>
      <input id="depositoReferencia" type="text" placeholder="Obligatoria para transferencia">
    ` : ""}


    <div class="auth-warning">

      <span>⚠</span>

      <div>

        <strong>Autorización de personal</strong>

        <small>
          Ingresa tus credenciales para registrar esta acción.
        </small>

      </div>

    </div>


    <label for="authUsuario">
      Usuario del personal
    </label>

    <input
      id="authUsuario"
      type="text"
      autocomplete="off"
      placeholder="Ej. staff01"
    >


    <label for="authPassword">
      Contraseña
    </label>

    <div class="password-wrap">

      <input
        id="authPassword"
        type="password"
        placeholder="Contraseña"
      >

      <button
        type="button"
        onclick="togglePassword()">
        Mostrar
      </button>

    </div>


    <div
      id="authError"
      class="auth-error"
      style="display:none;">
    </div>


    <button
      class="btn ${
        accion === "desapartar"
          ? "btn-danger"
          : "btn-primary"
      }"
      style="width:100%;"
      id="autorizarBtn">

      Autorizar acción

    </button>


    <p class="demo-note">
      DEMO · Usuario: staff01 · Contraseña: 1234
    </p>

  `;


  overlay.classList.add("open");


  document
    .getElementById("autorizarBtn")
    .addEventListener("click", validarAutorizacion);


  setTimeout(() => {

    document
      .getElementById("authUsuario")
      ?.focus();

  }, 100);

}


// ============================================================
// VALIDAR USUARIO / CONTRASEÑA
// ============================================================

function validarAutorizacion() {

  if (["confirmar-deposito", "pago-total"].includes(accionPendiente)) {
    const monto = Number(document.getElementById("depositoMonto")?.value);
    const metodo = document.getElementById("depositoMetodo")?.value;
    const referencia = document.getElementById("depositoReferencia")?.value.trim();
    const errorDeposito = document.getElementById("authError");
    const saldo = Number(apartadoSeleccionado?.saldo ?? apartadoSeleccionado?.total ?? apartadoSeleccionado?.precio ?? 0);
    const montoInvalido = accionPendiente === "pago-total"
      ? !Number.isFinite(monto) || monto !== saldo
      : !Number.isFinite(monto) || monto < 50;

    if (montoInvalido || !metodo || (metodo === "transferencia" && !referencia)) {
      if (errorDeposito) {
        errorDeposito.style.display = "block";
        errorDeposito.textContent = metodo === "transferencia" && !referencia
          ? "La referencia es obligatoria para una transferencia."
          : accionPendiente === "pago-total"
            ? `El monto debe ser exactamente el saldo pendiente: $${saldo.toLocaleString("es-MX")} MXN.`
            : "Captura un monto válido y selecciona el método de pago.";
      }
      return;
    }

    datosDepositoPendiente = { monto, metodo, referencia: referencia || null };
  }

  const usuario =
    document
      .getElementById("authUsuario")
      ?.value
      .trim();

  const password =
    document
      .getElementById("authPassword")
      ?.value;


  const error =
    document.getElementById("authError");


  const personal =
    PERSONAL_EJEMPLO.find(persona =>
      persona.usuario === usuario &&
      persona.password === password
    );


  if (!personal) {

    if (error) {

      error.style.display = "block";

      error.textContent =
        "Usuario o contraseña incorrectos.";

    }

    return;
  }


  ejecutarAccion(personal);

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccion(personal) {

  if (!apartadoSeleccionado) return;


  const ahora = new Date();


  const fecha = ahora.toLocaleDateString(
    "es-MX",
    {
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  );


  const hora = ahora.toLocaleTimeString(
    "es-MX",
    {
      hour: "numeric",
      minute: "2-digit"
    }
  );


  // --------------------------------------------
  // CONFIRMAR DEPÓSITO
  // --------------------------------------------

  if (accionPendiente === "confirmar-deposito") {

    apartadoSeleccionado.deposito = apartadoSeleccionado.categoria === "vip" ? "no_requiere" : "confirmado";
    apartadoSeleccionado.montoDeposito = datosDepositoPendiente?.monto || 50;
    apartadoSeleccionado.metodoDeposito = datosDepositoPendiente?.metodo || "local";
    apartadoSeleccionado.referenciaDeposito = datosDepositoPendiente?.referencia || null;
    apartadoSeleccionado.fechaDepositoConfirmado = ahora.toISOString();
    apartadoSeleccionado.excedente = Math.max(0, apartadoSeleccionado.montoDeposito - 50);

    apartadoSeleccionado.estado =
      "deposito_confirmado";

    apartadoSeleccionado.ultimaAccion = {

      texto: "Depósito confirmado",

      fecha: `${fecha} · ${hora}`,

      usuario: personal.nombre

    };

    cerrarModal();

    mostrarToast(
      `Depósito confirmado por ${personal.nombre}`
    );

  }


  // --------------------------------------------
  // CONFIRMAR APARTADO
  // --------------------------------------------

  if (accionPendiente === "confirmar-apartado") {

    apartadoSeleccionado.estado = "activo";
    apartadoSeleccionado.fechaConfirmacion = ahora.toISOString();

    apartadoSeleccionado.ultimaAccion = {

      texto: "Apartado confirmado",

      fecha: `${fecha} · ${hora}`,

      usuario: personal.nombre

    };

    cerrarModal();

    mostrarToast(
      `Apartado activo · ${personal.nombre}`
    );

  }

  if (accionPendiente === "confirmar-whatsapp") {
    apartadoSeleccionado.estado = "contactada_whatsapp";
    apartadoSeleccionado.ultimaAccion = {
      texto: "Contactada por Whatsapp",
      fecha: `${fecha} · ${hora}`,
      usuario: personal.nombre
    };
    guardarApartados();
    cerrarModal();
    mostrarToast(`Contacto por Whatsapp registrado por ${personal.nombre}`);
  }

  if (accionPendiente === "pago-total") {
    const total = Number(apartadoSeleccionado.total || apartadoSeleccionado.precio || 0);
    const pagado = Number(apartadoSeleccionado.pagado || 0);
    const saldo = Math.max(0, total - pagado);
    apartadoSeleccionado.total = total;
    apartadoSeleccionado.pagado = total;
    apartadoSeleccionado.saldo = 0;
    apartadoSeleccionado.pagos = [
      ...(Array.isArray(apartadoSeleccionado.pagos) ? apartadoSeleccionado.pagos : []),
      {
        monto: saldo,
        tipo: "liquidacion",
        metodo: datosDepositoPendiente?.metodo || null,
        referencia: datosDepositoPendiente?.referencia || null,
        fecha: ahora.toISOString()
      }
    ];
    apartadoSeleccionado.metodoPagoTotal = datosDepositoPendiente?.metodo || null;
    apartadoSeleccionado.referenciaPagoTotal = datosDepositoPendiente?.referencia || null;
    apartadoSeleccionado.estado = "liquidado";
    apartadoSeleccionado.ultimaAccion = {
      texto: "Pago total registrado",
      fecha: `${fecha} · ${hora}`,
      usuario: personal.nombre
    };
    cerrarModal();
    mostrarToast(`Pago total registrado por ${personal.nombre}`);
  }


  // --------------------------------------------
  // DESAPARTAR
  // --------------------------------------------

  if (accionPendiente === "desapartar") {

    apartadoSeleccionado.estado = "cancelado";

    apartadoSeleccionado.ultimaAccion = {

      texto: "Desapartado",

      fecha: `${fecha} · ${hora}`,

      usuario: personal.nombre

    };

    cerrarModal();

    mostrarToast(
      `Pieza desapartada por ${personal.nombre}`
    );

  }

  guardarApartados();


  renderTabla();
  actualizarResumen();

  apartadoSeleccionado = null;
  accionPendiente = null;
  datosDepositoPendiente = null;

}


// ============================================================
// DETALLE
// ============================================================

function abrirDetalle(apartado) {

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  if (!overlay || !box) return;


  const estado = obtenerEstado(apartado.estado);


  box.innerHTML = `

    <button
      class="modal-close"
      onclick="cerrarModal()">
      ×
    </button>


    <span class="eyebrow">
      ${apartado.id}
    </span>


    <h3 style="margin-top:5px;">
      Detalle del apartado
    </h3>


    <div class="detail-grid">

      <div>
        <span>Emprendedora</span>
        <strong>
          ${apartado.emprendedora}
        </strong>
      </div>


      <div>
        <span>Estado</span>
        <span class="status ${estado.clase}">
          ${estado.texto}
        </span>
      </div>

      <div>
        <span>Categoría</span>
        <strong>${obtenerCategoria(apartado.categoria)}</strong>
      </div>


      <div>
        <span>Pieza</span>
        <strong>
          ${apartado.pieza}
        </strong>
      </div>


      <div>
        <span>Variante</span>
        <strong>
          ${apartado.variante}
        </strong>
      </div>


      <div>
        <span>Precio</span>
        <strong>
          $${apartado.precio.toLocaleString("es-MX")} MXN
        </strong>
      </div>

      <div>
        <span>Total de la pieza</span>
        <strong>$${Number(apartado.total || apartado.precio || 0).toLocaleString("es-MX")} MXN</strong>
      </div>

      <div>
        <span>Pagado</span>
        <strong>$${Number(apartado.pagado || 0).toLocaleString("es-MX")} MXN</strong>
      </div>

      <div>
        <span>Saldo</span>
        <strong>$${Number(apartado.saldo ?? ((apartado.total || apartado.precio || 0) - (apartado.pagado || 0))).toLocaleString("es-MX")} MXN</strong>
      </div>


      <div>
        <span>Depósito</span>
        <strong>
          ${apartado.estado === "liquidado" ? "Confirmado" : apartado.deposito === "no_requiere" ? "No requiere" : apartado.deposito === "confirmado" ? "Confirmado" : "Pendiente"}
        </strong>
      </div>

      <div>
        <span>Monto recibido</span>
        <strong>${apartado.montoDeposito ? `$${Number(apartado.montoDeposito).toLocaleString("es-MX")} MXN` : "—"}</strong>
      </div>

      <div>
        <span>Método / referencia</span>
        <strong>${apartado.deposito === "no_requiere" ? "No requiere" : `${apartado.metodoDeposito === "transferencia" ? "Transferencia" : apartado.metodoDeposito === "local" ? "Pago en local" : "—"}${apartado.referenciaDeposito ? ` · ${apartado.referenciaDeposito}` : ""}`}</strong>
      </div>

      <div>
        <span>Liquidación</span>
        <strong>${apartado.estado === "liquidado" ? "Pagó en su totalidad" : "Pendiente"}</strong>
      </div>

      <div>
        <span>Método / referencia de liquidación</span>
        <strong>${apartado.metodoPagoTotal === "transferencia" ? "Transferencia" : apartado.metodoPagoTotal === "local" ? "Pago en local" : "—"}${apartado.referenciaPagoTotal ? ` · ${apartado.referenciaPagoTotal}` : ""}</strong>
      </div>


      <div>
        <span>Fecha de solicitud</span>
        <strong>
          ${apartado.fechaSolicitud}
        </strong>
      </div>


      <div>
        <span>Hora</span>
        <strong>
          ${apartado.horaSolicitud}
        </strong>
      </div>

    </div>


    <div class="log-box">

      <span>ÚLTIMA ACCIÓN</span>

      <strong>
        ${apartado.ultimaAccion?.texto || "Sin acciones"}
      </strong>

      <small>
        ${apartado.ultimaAccion?.fecha || ""}
        ·
        ${apartado.ultimaAccion?.usuario || ""}
      </small>

    </div>


    <button
      class="btn btn-outline"
      style="width:100%;"
      onclick="cerrarModal()">

      Cerrar

    </button>

  `;


  overlay.classList.add("open");

}


// ============================================================
// ESTADOS
// ============================================================

function obtenerEstado(estado) {

  const estados = {

    pendiente_deposito: {
      texto: "Pendiente de depósito",
      clase: "status-pending"
    },

    deposito_confirmado: {
      texto: "Depósito confirmado",
      clase: "status-deposit"
    },

    activo: {
      texto: "Apartado activo",
      clase: "status-active"
    },

    contactada_whatsapp: {
      texto: "Contactada por Whatsapp",
      clase: "status-cancelled"
    },

    liquidado: {
      texto: "Liquidada",
      clase: "status-active"
    },

    vencido: {
      texto: "Vencido",
      clase: "status-expired"
    },

    cancelado: {
      texto: "Desapartado",
      clase: "status-cancelled"
    }

  };


  return estados[estado] || {
    texto: "Desconocido",
    clase: ""
  };

}


// ============================================================
// DEPÓSITO
// ============================================================

function obtenerDeposito(deposito, estado = "") {

  if (estado === "liquidado") {
    return {
      texto: "Confirmado",
      descripcion: "Depósito recibido",
      dot: "dot-blue"
    };
  }

  if (deposito === "no_requiere") {
    return {
      texto: "No requiere",
      descripcion: "Categoría VIP",
      dot: "dot-purple"
    };
  }

  if (deposito === "confirmado") {

    return {

      texto: "Confirmado",

      descripcion: "Depósito recibido",

      dot: "dot-blue"

    };

  }


  return {

    texto: "Pendiente",

    descripcion: "Esperando depósito",

    dot: "dot-yellow"

  };

}

function obtenerCategoria(categoria) {
  const categorias = {
    vip: "VIP",
    foranea: "Foránea",
    normal: "Normal"
  };
  return categorias[categoria] || "Normal";
}


// ============================================================
// FILTROS
// ============================================================

function obtenerApartadosFiltrados() {

  return apartados.filter(apartado => {

    const coincideEstado =
      filtroEstado === "todos" ||
      apartado.estado === filtroEstado;


    const texto = [

      apartado.emprendedora,

      apartado.pieza,

      apartado.variante,

      apartado.id

    ]
      .join(" ")
      .toLowerCase();


    const coincideBusqueda =
      !terminoBusqueda ||
      texto.includes(terminoBusqueda);


    return coincideEstado && coincideBusqueda;

  });

}


// ============================================================
// PAGINACIÓN
// ============================================================

function renderPaginacion(totalPaginas) {

  const pagination =
    document.getElementById("pagination");

  if (!pagination) return;


  pagination.innerHTML = "";


  const anterior = document.createElement("button");

  anterior.className = "page-btn";

  anterior.textContent = "‹";

  anterior.disabled = paginaActual === 1;


  anterior.addEventListener("click", () => {

    if (paginaActual > 1) {

      paginaActual--;

      renderTabla();

    }

  });


  pagination.appendChild(anterior);


  for (
    let i = 1;
    i <= totalPaginas;
    i++
  ) {

    const btn =
      document.createElement("button");

    btn.className =
      "page-btn" +
      (i === paginaActual ? " active" : "");

    btn.textContent = i;


    btn.addEventListener("click", () => {

      paginaActual = i;

      renderTabla();

    });


    pagination.appendChild(btn);

  }


  const siguiente =
    document.createElement("button");

  siguiente.className = "page-btn";

  siguiente.textContent = "›";

  siguiente.disabled =
    paginaActual === totalPaginas;


  siguiente.addEventListener("click", () => {

    if (paginaActual < totalPaginas) {

      paginaActual++;

      renderTabla();

    }

  });


  pagination.appendChild(siguiente);

}


// ============================================================
// CONTADOR
// ============================================================

function actualizarContador(total) {

  const resultCount =
    document.getElementById("resultCount");

  if (!resultCount) return;


  if (total === 0) {

    resultCount.textContent =
      "No se encontraron resultados";

    return;

  }


  const inicio =
    (paginaActual - 1) *
    filasPorPagina + 1;


  const fin =
    Math.min(
      paginaActual * filasPorPagina,
      total
    );


  resultCount.textContent =
    `Mostrando ${inicio}-${fin} de ${total} apartados`;

}


// ============================================================
// RESUMEN OPERATIVO
// ============================================================

function actualizarResumen() {

  const activos =
    apartados.filter(
      item => item.estado === "activo"
    ).length;


  const vencidos =
    apartados.filter(
      item => item.estado === "vencido"
    ).length;


  const pendientes =
    apartados.filter(
      item => item.estado === "pendiente_deposito"
    ).length;


  const depositoConfirmado =
    apartados.filter(
      item => item.estado === "deposito_confirmado"
    ).length;


  const tarjetas =
    document.querySelectorAll(".stat-card");


  // En tu HTML:
  // 0 = catálogo
  // 1 = apartados activos
  // 2 = vencidos
  // 3 = pendientes de depósito


  if (tarjetas[1]) {

    const numero =
      tarjetas[1].querySelector(".stat-num");

    if (numero) {
      numero.textContent = activos;
    }

  }


  if (tarjetas[2]) {

    const numero =
      tarjetas[2].querySelector(".stat-num");

    if (numero) {
      numero.textContent = vencidos;
    }

  }


  if (tarjetas[3]) {

    const numero =
      tarjetas[3].querySelector(".stat-num");

    if (numero) {
      numero.textContent = pendientes;
    }

  }

}


// ============================================================
// CERRAR MODAL
// ============================================================

function cerrarModal() {

  const overlay =
    document.getElementById("modalOverlay");

  if (overlay) {

    overlay.classList.remove("open");

  }

}


// ============================================================
// MOSTRAR / OCULTAR PASSWORD
// ============================================================

function togglePassword() {

  const input =
    document.getElementById("authPassword");

  const button =
    document.querySelector(".password-wrap button");


  if (!input) return;


  if (input.type === "password") {

    input.type = "text";

    if (button) {
      button.textContent = "Ocultar";
    }

  } else {

    input.type = "password";

    if (button) {
      button.textContent = "Mostrar";
    }

  }

}


// ============================================================
// TOAST
// ============================================================

function mostrarToast(mensaje) {

  let toast =
    document.getElementById("mwToast");


  if (!toast) {

    toast = document.createElement("div");

    toast.id = "mwToast";

    toast.className = "mw-toast";

    document.body.appendChild(toast);

  }


  toast.textContent = mensaje;

  toast.classList.add("show");


  setTimeout(() => {

    toast.classList.remove("show");

  }, 3000);

}