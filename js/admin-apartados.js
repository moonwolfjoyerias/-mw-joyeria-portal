// MW JOYERÍA — Apartados Admin
// Mismas capacidades y reglas de negocio que Apartados de Staff/Encargado
// (ver js/apartados-modelo.js, fuente única de verdad, y
// js/staff-apartados-ejemplo.js, reutilizado tal cual para los datos
// de ejemplo — misma clave de localStorage, mismo "sistema"). El
// renderizado de tabla/modales común a los 3 roles vive en
// js/apartados-panel-comun.js.
//
// Igual que Encargado: las acciones sensibles NO piden usuario/contraseña de
// nuevo — muestran un modal de Autorización con mensaje dinámico (ver
// js/admin-comun.js) y quedan en la auditoría (rol "admin").

let ventanas = [];
let filtroEstado = "todos";
let terminoBusqueda = "";
const filasExpandidas = new Set();

const MENSAJE_WHATSAPP_VENCIDO = "Tu apartado venció. Por favor contáctanos para revisar las opciones disponibles.";

// "empleado" que esperan las funciones de apartados-modelo.js.
const ADMIN_EMPLEADO = { nombre: ADMIN_IDENTIDAD.usuarioNombre };


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  ventanas = calcularVentanasStaffActuales();
  verificarApartadosVencidosPendientes();

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
// MODAL: NUEVA VENTANA DE APARTADO (abrir el formulario no es
// sensible; la autorización se pide al confirmar, con los datos ya
// conocidos — sección 17 vs. 15-16)
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
      ${obtenerCatalogoStaffStorage().filter(productoDisponible).map(p => `<option value="${p.id}">${escapeHTML(p.nombre)} — $${Number(precioConDescuento(p)).toLocaleString('es-MX')} MXN</option>`).join('')}
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

    const producto = productoElegido.nombre;
    const variante = etiquetaVariante(varianteElegida);

    const usuarioId = slugUsuarioId(nombre);
    const tieneCredito = obtenerCreditoDisponible(usuarioId) > 0;

    abrirAutorizacionAdmin({
      titulo: "Autorizar nueva ventana",
      mensaje: tieneCredito
        ? `Estás a punto de abrir una nueva ventana de apartado para "${nombre}", reutilizando su crédito guardado.`
        : `Estás a punto de abrir una nueva ventana de apartado para "${nombre}" con la pieza "${producto}".`,
      onConfirmar: () => ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, total, productoId, varianteId })
    });

  });

}

function ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, total, productoId, varianteId }) {

  const usuarioId = slugUsuarioId(nombre);

  // Si la persona ya tiene una ventana activa, la pieza se suma ahí en
  // vez de abrir una segunda ventana con su propio vencimiento aparte
  // (Sección 5.1: "apartar VARIAS piezas sin volver a pagar").
  const ventanaExistente = ventanas.find(v => v.usuarioId === usuarioId && v.estado !== "vencida" && v.estado !== "cerrada");

  if (ventanaExistente) {

    const resultadoPiezaExistente = agregarPiezaAVentana(ventanaExistente, { producto, variante, total, productoId, varianteId }, ADMIN_EMPLEADO);

    if (!resultadoPiezaExistente.ok) {
      cerrarModal();
      mostrarToast(resultadoPiezaExistente.error);
      return;
    }

    guardarVentanas();
    actualizarResumen();
    renderTabla();
    cerrarModal();

    registrarAuditoriaAdmin({
      modulo: "apartados",
      accion: "agregar_pieza_ventana_existente",
      descripcion: `Pieza ${producto} agregada a la ventana ya activa de ${nombre}`
    });

    mostrarToast(`Pieza agregada a la ventana activa de ${nombre}.`);
    return;

  }

  const nuevaVentana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombre, telefono, categoria }, ADMIN_EMPLEADO);
  const resultadoPieza = agregarPiezaAVentana(nuevaVentana, { producto, variante, total, productoId, varianteId }, ADMIN_EMPLEADO);

  if (!resultadoPieza.ok) {
    cerrarModal();
    mostrarToast(resultadoPieza.error);
    return;
  }

  ventanas.push(nuevaVentana);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({
    modulo: "apartados",
    accion: "nueva_ventana",
    descripcion: nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta para ${nombre} reutilizando crédito guardado`
      : `Ventana abierta para ${nombre} con la pieza ${producto}`
  });

  mostrarToast(
    nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta con crédito reutilizado por ${ADMIN_IDENTIDAD.usuarioNombre}.`
      : `Ventana creada por ${ADMIN_IDENTIDAD.usuarioNombre}.`
  );

}


// ============================================================
// EVENTOS DE FILA (propios de Admin: no piden credenciales, muestran
// un modal de confirmación con mensaje dinámico vía admin-comun.js)
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
    btn.addEventListener("click", () => confirmarAprobarVip(btn.dataset.aprobarVip));
  });

  document.querySelectorAll("[data-liquidar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => iniciarLiquidacionVentana(btn.dataset.liquidarVentana));
  });

  document.querySelectorAll("[data-cancelar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => confirmarCancelarVentana(btn.dataset.cancelarVentana));
  });

  document.querySelectorAll("[data-whatsapp-ventana]").forEach(btn => {
    btn.addEventListener("click", () => abrirContactoWhatsapp(ventanas.find(v => v.id === btn.dataset.whatsappVentana)));
  });

  document.querySelectorAll("[data-desapartar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => confirmarDesapartarVentana(btn.dataset.desapartarVentana));
  });

}


// ============================================================
// CONFIRMAR DEPÓSITO
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

    abrirAutorizacionAdmin({
      titulo: "Autorizar depósito",
      mensaje: `Estás a punto de confirmar el depósito de $${monto} MXN de "${v.usuarioNombre}".`,
      onConfirmar: () => ejecutarConfirmarDeposito(v.id, { monto, metodo, referencia: referencia || null })
    });

  });

}

function ejecutarConfirmarDeposito(ventanaId, datos) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  confirmarDepositoVentana(v, datos, ADMIN_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({ modulo: "apartados", accion: "confirmar_deposito", descripcion: `Depósito de $${datos.monto} confirmado para ${v.usuarioNombre}` });
  mostrarToast(`Depósito confirmado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

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

    let mensaje = `Estás a punto de liquidar el apartado de "${v.usuarioNombre}" por $${monto} MXN.`;
    if (decisionDeposito === "aplicar") mensaje += ` Se aplicará su depósito de $${v.depositoApartadoDisponible} MXN a la compra.`;
    if (decisionDeposito === "credito") mensaje += ` Su depósito de $${v.depositoApartadoDisponible} MXN se guardará como crédito.`;

    abrirAutorizacionAdmin({
      titulo: "Autorizar liquidación",
      mensaje,
      onConfirmar: () => ejecutarLiquidar(v.id, { monto, metodo, referencia }, decisionDeposito)
    });

  });

}

function ejecutarLiquidar(ventanaId, datos, decisionDeposito) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const resultado = liquidarVentanaCompleta(v, datos, ADMIN_EMPLEADO);

  if (resultado?.requiereResolucionDeposito && decisionDeposito) {
    resolverDepositoVentana(v, decisionDeposito, ADMIN_EMPLEADO);
  }

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({ modulo: "apartados", accion: "liquidar_ventana", descripcion: `Apartado de ${v.usuarioNombre} liquidado por $${datos.monto}` });
  mostrarToast(`Apartado liquidado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// CANCELAR APARTADO COMPLETO
// ============================================================

function confirmarCancelarVentana(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const mensaje = v.depositoApartadoDisponible > 0
    ? `Estás a punto de cancelar el apartado de "${v.usuarioNombre}". Su depósito de $${v.depositoApartadoDisponible} MXN se guardará como crédito para su próximo apartado.`
    : `Estás a punto de cancelar el apartado de "${v.usuarioNombre}".`;

  abrirAutorizacionAdmin({
    titulo: "Autorizar cancelación",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarCancelar(ventanaId)
  });

}

function ejecutarCancelar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  cancelarVentanaCompleta(v, ADMIN_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({ modulo: "apartados", accion: "cancelar_ventana", descripcion: `Apartado de ${v.usuarioNombre} cancelado` });
  mostrarToast(`Apartado cancelado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}

function confirmarAprobarVip(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  abrirAutorizacionAdmin({
    titulo: "Aprobar apartado VIP",
    mensaje: `Estás a punto de aprobar el apartado VIP de "${v.usuarioNombre}".`,
    onConfirmar: () => ejecutarAprobarVip(ventanaId)
  });

}

function ejecutarAprobarVip(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  aprobarVentanaVip(v, ADMIN_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({ modulo: "apartados", accion: "aprobar_vip_ventana", descripcion: `Apartado VIP de ${v.usuarioNombre} aprobado` });
  mostrarToast(`Apartado VIP aprobado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// DESAPARTAR (ventana vencida — pierde el depósito para siempre).
// El modal de contacto por WhatsApp es común y vive en
// apartados-panel-comun.js.
// ============================================================

function confirmarDesapartarVentana(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const mensaje = v.depositoApartadoDisponible > 0
    ? `Estás a punto de desapartar el apartado vencido de "${v.usuarioNombre}". Esto cancelará sus piezas restantes y perderá su depósito de $${v.depositoApartadoDisponible} MXN de forma definitiva.`
    : `Estás a punto de desapartar el apartado vencido de "${v.usuarioNombre}". Esto cancelará sus piezas restantes.`;

  abrirAutorizacionAdmin({
    titulo: "Autorizar desapartar",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarDesapartar(ventanaId)
  });

}

function ejecutarDesapartar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  desapartarVentanaVencida(v, ADMIN_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaAdmin({ modulo: "apartados", accion: "desapartar_ventana", descripcion: `Apartado vencido de ${v.usuarioNombre} desapartado` });
  mostrarToast(`Apartado desapartado por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

}
