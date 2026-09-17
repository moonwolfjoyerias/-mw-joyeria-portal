// MW JOYERÍA — Staff: Apartados
// Una fila por VENTANA de apartado (persona). El nombre abre un
// desplegable con sus piezas e historial — no van en columnas propias.
// El apartado se liquida o cancela completo (todas las piezas activas
// juntas), no por pieza. La lógica del depósito compartido vive en
// apartados-modelo.js. El renderizado de tabla/modales común a los 3
// roles vive en js/apartados-panel-comun.js — aquí solo queda lo
// propio de Staff: el flujo de autorización con usuario/contraseña.
// ⚠️ TEMPORAL: utiliza datos de staff-apartados-ejemplo.js.

let ventanas = [];
let filtroEstado = "todos";
let terminoBusqueda = "";
const filasExpandidas = new Set();

let accionPendiente = null; // { tipo, ventanaId, datos, decisionDeposito }

const MENSAJE_WHATSAPP_VENCIDO = "Tu apartado venció. Por favor contáctanos para revisar las opciones disponibles.";


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  ventanas = calcularVentanasStaffActuales();

  // Enlace directo desde una notificación (?buscar=NOMBRE) — precarga
  // el buscador y, si hay una sola coincidencia, la abre expandida.
  const buscarDesdeUrl = new URLSearchParams(window.location.search).get("buscar");
  if (buscarDesdeUrl) {
    terminoBusqueda = buscarDesdeUrl.trim().toLowerCase();
    const inputBusqueda = document.getElementById("searchInput");
    if (inputBusqueda) inputBusqueda.value = buscarDesdeUrl;
    const coincidencias = ventanas.filter(v => v.usuarioNombre.toLowerCase().includes(terminoBusqueda));
    if (coincidencias.length === 1) filasExpandidas.add(coincidencias[0].id);
  }

  actualizarResumen();
  renderTabla();
  configurarEventos();

});


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

    <label for="nvProductoId">Producto *</label>
    <select id="nvProductoId" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="">Selecciona un producto...</option>
      ${obtenerCatalogoStaffStorage().filter(productoDisponible).map(p => `<option value="${p.id}">${escapeHTML(p.nombre)} — $${formatearPrecioNv(precioConDescuento(p))} MXN</option>`).join('')}
    </select>

    <label for="nvVarianteId">Variante (color / talla) *</label>
    <select id="nvVarianteId" disabled style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:#312044;">
      <option value="">Primero selecciona un producto</option>
    </select>

    <label for="nvTotal">Precio (descuento de mayoreo ya aplicado)</label>
    <input id="nvTotal" type="number" min="0" step="1" placeholder="Se llena al elegir el producto">

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarNuevaVentanaBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  document.getElementById("nvProductoId").addEventListener("change", (e) => {

    const varianteSelect = document.getElementById("nvVarianteId");
    const producto = obtenerCatalogoStaffStorage().find(p => p.id === e.target.value);

    if (!producto) {
      varianteSelect.innerHTML = `<option value="">Primero selecciona un producto</option>`;
      varianteSelect.disabled = true;
      document.getElementById("nvTotal").value = "";
      return;
    }

    const disponibles = variantesDisponibles(producto);

    if (!disponibles.length) {
      varianteSelect.innerHTML = `<option value="">Sin existencia disponible</option>`;
      varianteSelect.disabled = true;
      document.getElementById("nvTotal").value = "";
      return;
    }

    varianteSelect.innerHTML = `<option value="">Selecciona...</option>` +
      disponibles.map(v => `<option value="${v.id}">${escapeHTML(etiquetaVariante(v))} — ${v.stock} disponibles</option>`).join('');
    varianteSelect.disabled = false;
    document.getElementById("nvTotal").value = precioConDescuento(producto);

  });

  document.getElementById("continuarNuevaVentanaBtn").addEventListener("click", () => {

    const nombre = document.getElementById("nvNombre").value.trim();
    const telefono = document.getElementById("nvTelefono").value.trim();
    const categoria = document.getElementById("nvCategoria").value;
    const productoId = document.getElementById("nvProductoId").value;
    const varianteId = document.getElementById("nvVarianteId").value;
    const total = Number(document.getElementById("nvTotal").value);
    const error = document.getElementById("formError");

    const productoElegido = obtenerCatalogoStaffStorage().find(p => p.id === productoId);
    const varianteElegida = productoElegido ? buscarVariante(productoElegido, varianteId) : null;

    if (!nombre || !productoElegido || !varianteElegida || !Number.isFinite(total) || total <= 0) {
      error.style.display = "block";
      error.textContent = "Escribe el nombre y selecciona un producto, una variante y un precio válido.";
      return;
    }

    abrirAutorizacion({
      tipo: "nueva-ventana",
      datos: {
        nombre, telefono, categoria, total,
        productoId, varianteId,
        producto: productoElegido.nombre,
        variante: etiquetaVariante(varianteElegida)
      }
    });

  });

}

function formatearPrecioNv(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}


// ============================================================
// EVENTOS DE FILA (propios de Staff: piden usuario/contraseña de
// nuevo en cada acción sensible, vía abrirAutorizacion())
// ============================================================

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

  document.querySelectorAll("[data-aprobar-vip]").forEach(btn => {
    btn.addEventListener("click", () => abrirAutorizacion({ tipo: "aprobar-vip-ventana", ventanaId: btn.dataset.aprobarVip }));
  });

  document.querySelectorAll("[data-liquidar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => iniciarLiquidacionVentana(btn.dataset.liquidarVentana));
  });

  document.querySelectorAll("[data-cancelar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirAutorizacion({ tipo: "cancelar-ventana", ventanaId: btn.dataset.cancelarVentana }));
  });

  document.querySelectorAll("[data-whatsapp-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirContactoWhatsapp(ventanas.find(v => v.id === btn.dataset.whatsappVentana)));
  });

  document.querySelectorAll("[data-desapartar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirAutorizacion({ tipo: "desapartar-ventana", ventanaId: btn.dataset.desapartarVentana }));
  });

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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>Confirmar depósito</h3>
    <p class="modal-sub">Registra el depósito de ${escapeHTML(v.usuarioNombre)}. Algunas personas transfieren más de $50 — anota el monto exacto recibido. Este depósito respalda toda la ventana, no una sola pieza. El plazo de vencimiento empieza a contar a partir de ahora.</p>

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
// LIQUIDAR APARTADO COMPLETO (con resolución del depósito) — el
// arranque del flujo (iniciarLiquidacionVentana/
// abrirModalResolucionDeposito) es común y vive en
// apartados-panel-comun.js; solo el paso final que pide la
// autorización se queda aquí.
// ============================================================

function abrirModalLiquidar(v, decisionDeposito) {

  const piezasActivas = obtenerPiezasActivas(v);
  const totalActivas = piezasActivas.reduce((suma, p) => suma + p.saldo, 0);

  const montoEsperado = decisionDeposito === "aplicar"
    ? Math.max(0, totalActivas - v.depositoApartadoDisponible)
    : totalActivas;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>Liquidar apartado</h3>
    <p class="modal-sub">${escapeHTML(v.usuarioNombre)} · ${piezasActivas.length} pieza${piezasActivas.length === 1 ? "" : "s"}</p>

    ${v.fechaDeclaracionPago ? `<div class="modal-note">${escapeHTML(v.usuarioNombre)} avisó que ya pagó el ${formatearFechaHora(v.fechaDeclaracionPago)} (informativo — confirma con la hora real del depósito recibido).</div>` : ""}

    ${decisionDeposito === "aplicar" ?`<div class="auth-warning"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span><div><strong>Depósito aplicado</strong><small>Se descontaron $${v.depositoApartadoDisponible} MXN del total.</small></div></div>` : ""}

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
      tipo: "liquidar-ventana",
      ventanaId: v.id,
      decisionDeposito,
      datos: { monto, metodo, referencia }
    });

  });

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
    "aprobar-vip-ventana": "Aprobar apartado VIP",
    "liquidar-ventana": "Autorizar liquidación",
    "cancelar-ventana": "Autorizar cancelación",
    "desapartar-ventana": "Autorizar desapartar"
  };

  const esPeligrosa = accion.tipo === "cancelar-ventana" || accion.tipo === "desapartar-ventana";
  const nombrePersona = v?.usuarioNombre || accion.datos?.nombre || "";

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon ${esPeligrosa ? "danger" : ""}">${esPeligrosa ? "!" : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg>'}</div>
    <h3>${titulos[accion.tipo] || "Autorizar acción"}</h3>
    <p class="modal-sub">Ingresa tus credenciales para registrar quién realizó este cambio.</p>

    <div class="modal-context">
      <span>Persona</span><strong>${escapeHTML(nombrePersona)}</strong>
      <span>Acción</span><strong>${titulos[accion.tipo] || "Modificación"}</strong>
    </div>

    <div class="auth-warning">
      <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span>
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

  // También acepta cuentas creadas desde Admin → Configuración →
  // Usuarios y permisos → Cuentas (js/cuentas-internas-modelo.js).
  const personal = PERSONAL_EJEMPLO.find(p => p.usuario === usuario && p.password === password)
    || (typeof verificarCredencialInterna === 'function' ? verificarCredencialInterna(usuario, password) : null);

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

    const { nombre, telefono, categoria, producto, variante, total, productoId, varianteId } = accionPendiente.datos;
    const usuarioId = slugUsuarioId(nombre);

    // Si la persona ya tiene una ventana activa, la pieza se suma ahí en
    // vez de abrir una segunda ventana con su propio vencimiento aparte
    // (Sección 5.1: "apartar VARIAS piezas sin volver a pagar").
    const ventanaExistente = ventanas.find(v => v.usuarioId === usuarioId && v.estado !== "vencida" && v.estado !== "cerrada");

    if (ventanaExistente) {

      const resultadoPiezaExistente = agregarPiezaAVentana(ventanaExistente, { producto, variante, total, productoId, varianteId }, personal);

      if (!resultadoPiezaExistente.ok) {
        cerrarModal();
        mostrarToast(resultadoPiezaExistente.error);
        accionPendiente = null;
        return;
      }

      guardarVentanas();

      registrarAuditoria({
        usuarioId: personal.usuario,
        usuarioNombre: personal.nombre,
        rol: 'staff',
        modulo: 'apartados',
        accion: 'agregar_pieza_ventana_existente',
        descripcion: `Pieza ${producto} agregada a la ventana ya activa de ${nombre}`
      });

      actualizarResumen();
      renderTabla();
      cerrarModal();
      mostrarToast(`Pieza agregada a la ventana activa de ${nombre}.`);
      accionPendiente = null;
      return;

    }

    const nuevaVentana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombre, telefono, categoria }, personal);
    const resultadoPieza = agregarPiezaAVentana(nuevaVentana, { producto, variante, total, productoId, varianteId }, personal);

    if (!resultadoPieza.ok) {
      cerrarModal();
      mostrarToast(resultadoPieza.error);
      accionPendiente = null;
      return;
    }

    ventanas.push(nuevaVentana);

    guardarVentanas();

    registrarAuditoria({
      usuarioId: personal.usuario,
      usuarioNombre: personal.nombre,
      rol: 'staff',
      modulo: 'apartados',
      accion: 'nueva_ventana',
      descripcion: nuevaVentana.metodoDeposito === "credito_anterior"
        ? `Ventana abierta para ${nombre} reutilizando crédito guardado`
        : `Ventana abierta para ${nombre} con la pieza ${producto}`
    });

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

  let auditoriaAccion = null;
  let auditoriaDescripcion = '';

  if (accionPendiente.tipo === "confirmar-deposito-ventana") {

    confirmarDepositoVentana(v, accionPendiente.datos, personal);
    mensaje = `Depósito confirmado por ${personal.nombre}.`;
    auditoriaAccion = 'confirmar_deposito';
    auditoriaDescripcion = `Depósito de $${accionPendiente.datos.monto} confirmado para ${v.usuarioNombre}`;

  } else if (accionPendiente.tipo === "liquidar-ventana") {

    const resultado = liquidarVentanaCompleta(v, accionPendiente.datos, personal);

    if (resultado?.requiereResolucionDeposito && accionPendiente.decisionDeposito) {
      resolverDepositoVentana(v, accionPendiente.decisionDeposito, personal);
    }

    mensaje = `Apartado liquidado por ${personal.nombre}.`;
    auditoriaAccion = 'liquidar_ventana';
    auditoriaDescripcion = `Apartado de ${v.usuarioNombre} liquidado por $${accionPendiente.datos.monto}`;

  } else if (accionPendiente.tipo === "aprobar-vip-ventana") {

    aprobarVentanaVip(v, personal);
    mensaje = `Apartado VIP aprobado por ${personal.nombre}.`;
    auditoriaAccion = 'aprobar_vip_ventana';
    auditoriaDescripcion = `Apartado VIP de ${v.usuarioNombre} aprobado`;

  } else if (accionPendiente.tipo === "cancelar-ventana") {

    cancelarVentanaCompleta(v, personal);
    mensaje = `Apartado cancelado por ${personal.nombre}.`;
    auditoriaAccion = 'cancelar_ventana';
    auditoriaDescripcion = `Apartado de ${v.usuarioNombre} cancelado`;

  } else if (accionPendiente.tipo === "desapartar-ventana") {

    desapartarVentanaVencida(v, personal);
    mensaje = `Apartado desapartado por ${personal.nombre}.`;
    auditoriaAccion = 'desapartar_ventana';
    auditoriaDescripcion = `Apartado vencido de ${v.usuarioNombre} desapartado`;

  }

  guardarVentanas();

  if (auditoriaAccion) {
    registrarAuditoria({
      usuarioId: personal.usuario,
      usuarioNombre: personal.nombre,
      rol: 'staff',
      modulo: 'apartados',
      accion: auditoriaAccion,
      descripcion: auditoriaDescripcion
    });
  }

  actualizarResumen();
  renderTabla();
  cerrarModal();
  mostrarToast(mensaje);

  accionPendiente = null;

}


// ============================================================
// UTILIDADES (propio de Staff: mostrar/ocultar la contraseña en el
// modal de autorización con usuario/contraseña)
// ============================================================

function togglePassword() {
  const input = document.getElementById("authPassword");
  const button = document.querySelector(".password-wrap button");
  if (!input) return;
  input.type = input.type === "password" ? "text" : "password";
  if (button) button.textContent = input.type === "password" ? "Mostrar" : "Ocultar";
}
