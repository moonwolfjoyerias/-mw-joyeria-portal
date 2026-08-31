// MW JOYERÍA — Staff: Apartados
// Una fila por VENTANA de apartado (persona), expandible para ver sus
// piezas. La lógica del depósito compartido vive en apartados-modelo.js.
// ⚠️ TEMPORAL: utiliza datos de staff-apartados-ejemplo.js.

let ventanas = [];
let filtroEstado = "todos";
let terminoBusqueda = "";
const filasExpandidas = new Set();

let accionPendiente = null; // { tipo, ventanaId, piezaId, datos, decisionDeposito }
let datosFormularioPendiente = null;

const MENSAJE_WHATSAPP_VENCIDO = "Tu ventana de apartado venció y las piezas activas se liberaron. Contáctanos si quieres volver a apartar.";


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  ventanas = calcularVentanasStaffActuales();

  actualizarResumen();
  renderTabla();
  configurarEventos();

});

function guardarVentanas() {
  guardarVentanasApartado(ventanas);
}


// ============================================================
// EVENTOS
// ============================================================

function configurarEventos() {

  document.getElementById("statusSelect")?.addEventListener("change", (e) => {
    filtroEstado = e.target.value;
    renderTabla();
  });

  document.getElementById("searchInput")?.addEventListener("input", (e) => {
    terminoBusqueda = e.target.value.trim().toLowerCase();
    renderTabla();
  });

  document.getElementById("modalOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") cerrarModal();
  });

  document.getElementById("nuevaVentanaBtn")?.addEventListener("click", abrirModalNuevaVentana);

}


// ============================================================
// MODAL: NUEVA VENTANA DE APARTADO
// ============================================================

function abrirModalNuevaVentana() {

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">+</div>
    <h3>Nueva ventana de apartado</h3>
    <p class="modal-sub">Si la persona ya tiene crédito guardado de una ventana anterior, se usará automáticamente y no se pedirá otro depósito.</p>

    <label for="nvNombre">Nombre completo</label>
    <input id="nvNombre" type="text" placeholder="Ej. María Fernanda">

    <label for="nvTelefono">Teléfono</label>
    <input id="nvTelefono" type="text" placeholder="Ej. 444 123 4567">

    <label for="nvCategoria">Categoría</label>
    <select id="nvCategoria" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="normal">Emprendedora normal (3 días)</option>
      <option value="foranea">Emprendedora foránea (15 días)</option>
      <option value="vip">Líder VIP (sin depósito, sin vencimiento)</option>
    </select>

    <label for="nvProducto">Código de pieza</label>
    <input id="nvProducto" type="text" placeholder="Ej. AN-0231">

    <label for="nvVariante">Variante</label>
    <input id="nvVariante" type="text" placeholder="Ej. Talla 6 · Rosa">

    <label for="nvTotal">Precio</label>
    <input id="nvTotal" type="number" min="0" step="1" placeholder="Ej. 690">

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarNuevaVentanaBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  document.getElementById("continuarNuevaVentanaBtn").addEventListener("click", () => {

    const nombre = document.getElementById("nvNombre").value.trim();
    const telefono = document.getElementById("nvTelefono").value.trim();
    const categoria = document.getElementById("nvCategoria").value;
    const producto = document.getElementById("nvProducto").value.trim();
    const variante = document.getElementById("nvVariante").value.trim();
    const total = Number(document.getElementById("nvTotal").value);
    const error = document.getElementById("formError");

    if (!nombre || !producto || !Number.isFinite(total) || total <= 0) {
      error.style.display = "block";
      error.textContent = "Escribe el nombre, el código de pieza y un precio válido.";
      return;
    }

    abrirAutorizacion({
      tipo: "nueva-ventana",
      datos: { nombre, telefono, categoria, producto, variante, total }
    });

  });

}


// ============================================================
// FILTROS
// ============================================================

function obtenerVentanasFiltradas() {

  return ventanas.filter(v => {

    // Una ventana cerrada sin depósito que conservar ya no tiene nada
    // pendiente para Staff — no se muestra (el registro sigue viviendo
    // en los datos, solo no se renderiza como fila).
    if (v.estado === "cerrada" && v.resolucionDeposito !== "credito") return false;

    const coincideEstado = filtroEstado === "todos" || v.estado === filtroEstado;

    const texto = [v.usuarioNombre, ...v.apartados.map(p => p.producto)].join(" ").toLowerCase();
    const coincideBusqueda = !terminoBusqueda || texto.includes(terminoBusqueda);

    return coincideEstado && coincideBusqueda;

  });

}


// ============================================================
// TABLA
// ============================================================

function renderTabla() {

  const tbody = document.getElementById("apartadosTableBody");
  if (!tbody) return;

  const filtradas = obtenerVentanasFiltradas();

  if (!filtradas.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-cell">
          <div class="empty-state">
            <div class="empty-icon">✦</div>
            <strong>No se encontraron ventanas de apartado</strong>
            <span>Prueba con otro filtro o búsqueda.</span>
          </div>
        </td>
      </tr>
    `;
  } else {
    tbody.innerHTML = filtradas.map(crearFilaVentana).join("");
  }

  actualizarContador(filtradas.length);
  agregarEventosFilas();

}


function crearFilaVentana(v) {

  const estado = obtenerEstadoVentana(v);
  const categoria = obtenerReglaCategoria(v.categoria);
  const expandida = filasExpandidas.has(v.id);

  return `
    <tr class="ventana-row">
      <td>
        <div class="client-cell">
          <div class="avatar">${obtenerIniciales(v.usuarioNombre)}</div>
          <div>
            <strong>${escapeHTML(v.usuarioNombre)}</strong>
            <small>${escapeHTML(v.telefono || "")}</small>
          </div>
        </div>
      </td>

      <td><span class="status status-cancelled">${categoria.etiqueta}</span></td>

      <td>
        <div class="deposit-cell">
          <span class="dot ${v.depositoApartadoDisponible > 0 ? "dot-blue" : "dot-yellow"}"></span>
          <div>
            <strong>${categoria.requiereDeposito ? `$${v.depositoApartadoDisponible} MXN` : "No requiere"}</strong>
            <small>${obtenerDescripcionDeposito(v)}</small>
          </div>
        </div>
      </td>

      <td>${crearListaPiezas(v)}</td>

      <td>
        <span class="status ${estado.clase}">${estado.texto}</span>
        ${v.resolucionDeposito ? `<small style="display:block;margin-top:4px;color:#766d83;">${obtenerTextoResolucion(v.resolucionDeposito)}</small>` : ""}
      </td>

      <td>${obtenerTextoVencimiento(v)}</td>

      <td>
        <div class="actions-stack">
          ${obtenerAccionesVentana(v)}
          <button class="action-btn detail-action" data-toggle="${v.id}">${expandida ? "▾" : "▸"} Historial</button>
        </div>
      </td>
    </tr>

    ${expandida ? crearFilaHistorial(v) : ""}
  `;

}


function crearListaPiezas(v) {

  if (!v.apartados.length) {
    return `<small style="color:#766d83;">Sin piezas</small>`;
  }

  return v.apartados.map(p => {

    const estadoPieza = obtenerEstadoPieza(p.estado);

    return `
      <div class="piece-cell" style="margin-bottom:10px;align-items:flex-start;">
        <div class="piece-thumb">MW</div>
        <div>
          <strong>${escapeHTML(p.producto)}</strong>
          <small>${escapeHTML(p.variante || "")} · $${Number(p.total).toLocaleString("es-MX")} MXN</small>
          <div style="margin-top:4px;">
            <span class="status ${estadoPieza.clase}">${estadoPieza.texto}</span>
          </div>
          ${p.estado === "activa" && v.estado === "activa" ? `
            <div class="actions-stack" style="width:auto;flex-direction:row;margin-top:6px;">
              <button class="action-btn primary-action" data-liquidar-ventana="${v.id}" data-liquidar-pieza="${p.id}"><span>✓</span> Liquidar</button>
              <button class="action-btn danger-action" data-cancelar-ventana="${v.id}" data-cancelar-pieza="${p.id}"><span>×</span> Cancelar</button>
            </div>
          ` : ""}
          ${p.estado === "activa" && v.estado === "pendiente_deposito" ? `
            <small style="display:block;margin-top:6px;color:#9a6716;">Esperando confirmación de depósito</small>
          ` : ""}
        </div>
      </div>
    `;

  }).join("");

}


function crearFilaHistorial(v) {

  const auditoria = v.auditoria.slice().reverse().map(a => `
    <div class="log-box" style="margin-bottom:8px;">
      <strong>${escapeHTML(a.texto)}</strong>
      <small>${escapeHTML(a.usuario)} · ${formatearFechaHora(a.fecha)}</small>
    </div>
  `).join("");

  return `
    <tr class="expand-row">
      <td colspan="7" style="background:#faf8fc;padding:16px 20px;">
        <div class="eyebrow" style="margin-bottom:8px;">Historial de la ventana</div>
        ${auditoria || "<small>Sin movimientos registrados.</small>"}
      </td>
    </tr>
  `;

}


function agregarEventosFilas() {

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      if (filasExpandidas.has(id)) filasExpandidas.delete(id); else filasExpandidas.add(id);
      renderTabla();
    });
  });

  document.querySelectorAll("[data-confirmar-deposito]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalConfirmarDeposito(btn.dataset.confirmarDeposito));
  });

  document.querySelectorAll("[data-liquidar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => iniciarLiquidacion(btn.dataset.liquidarVentana, btn.dataset.liquidarPieza));
  });

  document.querySelectorAll("[data-cancelar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirAutorizacion({ tipo: "cancelar-pieza", ventanaId: btn.dataset.cancelarVentana, piezaId: btn.dataset.cancelarPieza }));
  });

  document.querySelectorAll("[data-whatsapp-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirContactoWhatsapp(ventanas.find(v => v.id === btn.dataset.whatsappVentana)));
  });

}


// ============================================================
// ACCIONES DISPONIBLES POR VENTANA
// ============================================================

function obtenerAccionesVentana(v) {

  let html = "";

  if (v.estado === "pendiente_deposito") {
    html += `<button class="action-btn primary-action" data-confirmar-deposito="${v.id}"><span>✓</span> Confirmar depósito</button>`;
  }

  if (v.estado === "vencida") {
    html += `<button class="action-btn detail-action" data-whatsapp-ventana="${v.id}"><span>↗</span> Contactar por Whatsapp</button>`;
  }

  return html;

}


// ============================================================
// MODAL: CONFIRMAR DEPÓSITO
// ============================================================

function abrirModalConfirmarDeposito(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">✓</div>
    <h3>Confirmar depósito</h3>
    <p class="modal-sub">Registra el depósito de ${escapeHTML(v.usuarioNombre)}. Algunas personas transfieren más de $50 — anota el monto exacto recibido. Este depósito respalda toda la ventana, no una sola pieza.</p>

    <label for="depositoMonto">Monto recibido</label>
    <input id="depositoMonto" type="number" min="${DEPOSITO_BASE}" step="0.01" value="${DEPOSITO_BASE}" placeholder="Mínimo $${DEPOSITO_BASE}">

    <label for="depositoMetodo">Método de pago</label>
    <select id="depositoMetodo" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="">Selecciona una opción</option>
      <option value="transferencia">Transferencia</option>
      <option value="local">Pago en local</option>
    </select>

    <label for="depositoReferencia">Número de referencia</label>
    <input id="depositoReferencia" type="text" placeholder="Obligatoria para transferencia">

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarDepositoBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  document.getElementById("continuarDepositoBtn").addEventListener("click", () => {

    const monto = Number(document.getElementById("depositoMonto").value);
    const metodo = document.getElementById("depositoMetodo").value;
    const referencia = document.getElementById("depositoReferencia").value.trim();
    const error = document.getElementById("formError");

    if (!Number.isFinite(monto) || monto < DEPOSITO_BASE) {
      error.style.display = "block";
      error.textContent = `El monto mínimo del depósito es $${DEPOSITO_BASE} MXN.`;
      return;
    }

    if (!metodo || (metodo === "transferencia" && !referencia)) {
      error.style.display = "block";
      error.textContent = metodo === "transferencia" && !referencia
        ? "La referencia es obligatoria para una transferencia."
        : "Selecciona el método de pago.";
      return;
    }

    abrirAutorizacion({ tipo: "confirmar-deposito-ventana", ventanaId: v.id, datos: { monto, metodo, referencia: referencia || null } });

  });

}


// ============================================================
// LIQUIDAR PIEZA (con resolución del depósito si es la última)
// ============================================================

function iniciarLiquidacion(ventanaId, piezaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  const pieza = v?.apartados.find(p => p.id === piezaId);
  if (!v || !pieza) return;

  if (necesitaResolucionDeposito(v, piezaId)) {
    abrirModalResolucionDeposito(v, pieza);
  } else {
    abrirModalLiquidar(v, pieza, null);
  }

}


function abrirModalResolucionDeposito(v, pieza) {

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">✓</div>
    <h3>¿Qué hacer con el depósito?</h3>
    <p class="modal-sub">Esta es la última pieza activa de la ventana de ${escapeHTML(v.usuarioNombre)}. Tiene $${v.depositoApartadoDisponible} MXN de depósito disponible.</p>

    <button class="btn btn-primary" style="width:100%;" id="aplicarDepositoBtn">Aplicar a esta compra (−$${v.depositoApartadoDisponible} MXN)</button>
    <button class="btn btn-outline" style="width:100%;" id="guardarCreditoBtn">Guardar como crédito para su próximo apartado</button>
  `;

  overlay.classList.add("open");

  document.getElementById("aplicarDepositoBtn").addEventListener("click", () => abrirModalLiquidar(v, pieza, "aplicar"));
  document.getElementById("guardarCreditoBtn").addEventListener("click", () => abrirModalLiquidar(v, pieza, "credito"));

}


function abrirModalLiquidar(v, pieza, decisionDeposito) {

  const montoEsperado = decisionDeposito === "aplicar"
    ? Math.max(0, pieza.saldo - v.depositoApartadoDisponible)
    : pieza.saldo;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">✓</div>
    <h3>Liquidar pieza</h3>
    <p class="modal-sub">${escapeHTML(pieza.producto)} · ${escapeHTML(v.usuarioNombre)}</p>

    ${decisionDeposito === "aplicar" ? `<div class="auth-warning"><span>✓</span><div><strong>Depósito aplicado</strong><small>Se descontaron $${v.depositoApartadoDisponible} MXN del total.</small></div></div>` : ""}

    <label for="liquidarMonto">Monto a cobrar</label>
    <input id="liquidarMonto" type="number" min="0" step="0.01" value="${montoEsperado}">

    ${montoEsperado > 0 ? `
      <label for="liquidarMetodo">Método de pago</label>
      <select id="liquidarMetodo" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
        <option value="">Selecciona una opción</option>
        <option value="transferencia">Transferencia</option>
        <option value="local">Pago en local</option>
      </select>
      <label for="liquidarReferencia">Número de referencia</label>
      <input id="liquidarReferencia" type="text" placeholder="Obligatoria para transferencia">
    ` : `<p class="modal-sub">El depósito cubre el total — no se requiere pago adicional.</p>`}

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarLiquidarBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  document.getElementById("continuarLiquidarBtn").addEventListener("click", () => {

    const monto = Number(document.getElementById("liquidarMonto").value);
    const metodo = document.getElementById("liquidarMetodo")?.value || null;
    const referencia = document.getElementById("liquidarReferencia")?.value.trim() || null;
    const error = document.getElementById("formError");

    if (!Number.isFinite(monto) || monto !== montoEsperado) {
      error.style.display = "block";
      error.textContent = `El monto debe ser exactamente $${montoEsperado} MXN.`;
      return;
    }

    if (montoEsperado > 0 && (!metodo || (metodo === "transferencia" && !referencia))) {
      error.style.display = "block";
      error.textContent = metodo === "transferencia" && !referencia
        ? "La referencia es obligatoria para una transferencia."
        : "Selecciona el método de pago.";
      return;
    }

    abrirAutorizacion({
      tipo: "liquidar-pieza",
      ventanaId: v.id,
      piezaId: pieza.id,
      decisionDeposito,
      datos: { monto, metodo, referencia }
    });

  });

}


// ============================================================
// CONTACTO WHATSAPP (ventana vencida)
// ============================================================

function abrirContactoWhatsapp(v) {

  if (!v) return;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  const numero = (v.telefono || "").replace(/\D/g, "");
  const enlace = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(MENSAJE_WHATSAPP_VENCIDO)}` : "#";

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">↗</div>
    <h3>Contactar por Whatsapp</h3>
    <p class="modal-sub">La ventana de ${escapeHTML(v.usuarioNombre)} venció y sus piezas activas ya se liberaron.</p>
    <div class="modal-context">
      <span>Emprendedora</span><strong>${escapeHTML(v.usuarioNombre)}</strong>
      <span>Teléfono</span><strong>${escapeHTML(v.telefono || "Sin teléfono")}</strong>
    </div>
    ${numero ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir Whatsapp</a>` : '<p class="auth-error">Esta persona no tiene un número de teléfono válido.</p>'}
  `;

  overlay.classList.add("open");

}


// ============================================================
// AUTORIZACIÓN
// ============================================================

function abrirAutorizacion(accion) {

  accionPendiente = accion;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");
  const v = ventanas.find(x => x.id === accion.ventanaId);

  const titulos = {
    "nueva-ventana": "Autorizar nueva ventana",
    "confirmar-deposito-ventana": "Autorizar depósito",
    "liquidar-pieza": "Autorizar liquidación",
    "cancelar-pieza": "Autorizar cancelación"
  };

  const esPeligrosa = accion.tipo === "cancelar-pieza";
  const nombrePersona = v?.usuarioNombre || accion.datos?.nombre || "";

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon ${esPeligrosa ? "danger" : ""}">${esPeligrosa ? "!" : "✓"}</div>
    <h3>${titulos[accion.tipo] || "Autorizar acción"}</h3>
    <p class="modal-sub">Ingresa tus credenciales para registrar quién realizó este cambio.</p>

    <div class="modal-context">
      <span>Persona</span><strong>${escapeHTML(nombrePersona)}</strong>
      <span>Acción</span><strong>${titulos[accion.tipo] || "Modificación"}</strong>
    </div>

    <div class="auth-warning">
      <span>⚠</span>
      <div>
        <strong>Autorización de personal</strong>
        <small>Ingresa tus credenciales para registrar esta acción.</small>
      </div>
    </div>

    <label for="authUsuario">Usuario del personal</label>
    <input id="authUsuario" type="text" autocomplete="off" placeholder="Ej. staff01">

    <label for="authPassword">Contraseña</label>
    <div class="password-wrap">
      <input id="authPassword" type="password" placeholder="Contraseña">
      <button type="button" onclick="togglePassword()">Mostrar</button>
    </div>

    <div id="authError" class="auth-error" style="display:none;"></div>

    <button class="btn ${esPeligrosa ? "btn-danger" : "btn-primary"}" style="width:100%;" id="autorizarBtn">Autorizar acción</button>

    <p class="demo-note">DEMO · Usuario: staff01 · Contraseña: 1234</p>
  `;

  overlay.classList.add("open");

  document.getElementById("autorizarBtn").addEventListener("click", validarAutorizacion);

  setTimeout(() => document.getElementById("authUsuario")?.focus(), 100);

}


function validarAutorizacion() {

  const usuario = document.getElementById("authUsuario")?.value.trim();
  const password = document.getElementById("authPassword")?.value;
  const error = document.getElementById("authError");

  const personal = PERSONAL_EJEMPLO.find(p => p.usuario === usuario && p.password === password);

  if (!personal) {
    if (error) {
      error.style.display = "block";
      error.textContent = "Usuario o contraseña incorrectos.";
    }
    return;
  }

  ejecutarAccion(personal);

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccion(personal) {

  if (!accionPendiente) return;

  let mensaje = "";

  if (accionPendiente.tipo === "nueva-ventana") {

    const { nombre, telefono, categoria, producto, variante, total } = accionPendiente.datos;
    const usuarioId = slugUsuarioId(nombre);

    const nuevaVentana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombre, telefono, categoria }, personal);
    agregarPiezaAVentana(nuevaVentana, { producto, variante, total }, personal);
    ventanas.push(nuevaVentana);

    guardarVentanas();
    actualizarResumen();
    renderTabla();
    cerrarModal();
    mostrarToast(
      nuevaVentana.metodoDeposito === "credito_anterior"
        ? `Ventana abierta con crédito reutilizado por ${personal.nombre}.`
        : `Ventana creada por ${personal.nombre}.`
    );

    accionPendiente = null;
    return;

  }

  const v = ventanas.find(x => x.id === accionPendiente.ventanaId);
  if (!v) return;

  if (accionPendiente.tipo === "confirmar-deposito-ventana") {

    confirmarDepositoVentana(v, accionPendiente.datos, personal);
    mensaje = `Depósito confirmado por ${personal.nombre}.`;

  } else if (accionPendiente.tipo === "liquidar-pieza") {

    const resultado = liquidarPiezaVentana(v, accionPendiente.piezaId, accionPendiente.datos, personal);

    if (resultado?.esUltimaPieza && accionPendiente.decisionDeposito) {
      resolverDepositoVentana(v, accionPendiente.decisionDeposito, personal, accionPendiente.piezaId);
    }

    mensaje = `Pieza liquidada por ${personal.nombre}.`;

  } else if (accionPendiente.tipo === "cancelar-pieza") {

    cancelarPiezaVentana(v, accionPendiente.piezaId, personal);
    mensaje = `Pieza cancelada por ${personal.nombre}.`;

  }

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();
  mostrarToast(mensaje);

  accionPendiente = null;

}


// ============================================================
// ESTADOS Y TEXTOS
// ============================================================

function obtenerEstadoVentana(v) {

  const estados = {
    pendiente_deposito: { texto: "Pendiente de depósito", clase: "status-pending" },
    activa: { texto: "Activa", clase: "status-active" },
    vencida: { texto: "Vencida", clase: "status-expired" },
    cerrada: { texto: "Cerrada", clase: "status-cancelled" }
  };

  return estados[v.estado] || { texto: v.estado, clase: "" };

}

function obtenerEstadoPieza(estado) {

  const estados = {
    activa: { texto: "Activa", clase: "status-active" },
    liquidada: { texto: "Liquidada", clase: "status-active" },
    cancelada: { texto: "Cancelada", clase: "status-cancelled" }
  };

  return estados[estado] || { texto: estado, clase: "" };

}

function obtenerDescripcionDeposito(v) {

  const regla = obtenerReglaCategoria(v.categoria);

  if (!regla.requiereDeposito) return "Categoría VIP";
  if (v.estado === "pendiente_deposito") return "Esperando depósito";
  if (v.estado === "vencida" || v.estado === "cerrada") return "Ventana finalizada";
  if (v.metodoDeposito === "credito_anterior") return "Crédito reutilizado";
  return "Depósito confirmado";

}

function obtenerTextoResolucion(resolucion) {

  const textos = {
    aplicado: "Depósito aplicado a la compra",
    credito: "Depósito guardado como crédito",
    perdido: "Depósito perdido por vencimiento",
    no_aplica: "Sin depósito que resolver"
  };

  return textos[resolucion] || "";

}

function obtenerTextoVencimiento(v) {

  if (!v.fechaVencimiento) return "Sin vencimiento";

  const fecha = new Date(v.fechaVencimiento).toLocaleDateString("es-MX", { day: "numeric", month: "short" });

  return v.estado === "vencida" ? `Venció el ${fecha}` : fecha;

}

function formatearFechaHora(iso) {

  return new Date(iso).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

}


// ============================================================
// RESUMEN
// ============================================================

function actualizarResumen() {

  const valores = {
    ventanasActivas: ventanas.filter(v => v.estado === "activa").length,
    piezasActivas: ventanas.reduce((total, v) => total + obtenerPiezasActivas(v).length, 0),
    ventanasVencidas: ventanas.filter(v => v.estado === "vencida").length,
    ventanasPendientes: ventanas.filter(v => v.estado === "pendiente_deposito").length
  };

  const tarjetas = document.querySelectorAll(".stat-card .stat-num");
  const orden = ["ventanasActivas", "piezasActivas", "ventanasVencidas", "ventanasPendientes"];

  tarjetas.forEach((el, i) => {
    if (orden[i]) el.textContent = valores[orden[i]];
  });

}

function actualizarContador(total) {

  const resultCount = document.getElementById("resultCount");
  if (resultCount) resultCount.textContent = `${total} ventana${total === 1 ? "" : "s"} de apartado`;

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModal() {
  document.getElementById("modalOverlay")?.classList.remove("open");
}

function togglePassword() {
  const input = document.getElementById("authPassword");
  const button = document.querySelector(".password-wrap button");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  if (button) button.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
}

function mostrarToast(mensaje) {

  let toast = document.getElementById("mwToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "mwToast";
    toast.className = "mw-toast";
    document.body.appendChild(toast);
  }

  toast.textContent = mensaje;
  toast.classList.add("show");

  setTimeout(() => toast.classList.remove("show"), 3000);

}

function escapeHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
