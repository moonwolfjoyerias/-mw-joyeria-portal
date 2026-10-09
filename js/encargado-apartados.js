// MW JOYERÍA — Apartados Encargado
// Mismas capacidades y reglas de negocio que Apartados de Staff (ver
// js/apartados-modelo.js, fuente única de verdad, y
// js/staff-apartados-ejemplo.js, reutilizado tal cual para los datos
// de ejemplo — misma clave de localStorage, mismo "sistema"). El
// renderizado de tabla/modales común a los 3 roles vive en
// js/apartados-panel-comun.js.
//
// Única diferencia respecto a Staff: las acciones sensibles NO piden
// usuario/contraseña de nuevo — muestran un modal de Autorización con
// mensaje dinámico (ver js/encargado-comun.js) y quedan en la auditoría de Encargado.

let ventanas = [];
let filtroEstado = "todos";
let terminoBusqueda = "";
const filasExpandidas = new Set();

const MENSAJE_WHATSAPP_VENCIDO = "Tu apartado venció. Por favor contáctanos para revisar las opciones disponibles.";

// "empleado" que esperan las funciones de apartados-modelo.js.
const ENCARGADO_EMPLEADO = { nombre: ENCARGADO_IDENTIDAD.usuarioNombre };


// ============================================================
// INICIO
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

  await apartadosRepoListo; // FASE 2 (Firebase): espera a que obtenerVentanasApartado() tenga datos reales, no un caché vacío

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
    <div class="persona-autocomplete" id="nvNombreWrap">
      <input id="nvNombre" type="text" autocomplete="off" placeholder="Ej. María Fernanda — empieza a escribir para buscarla">
      <div class="persona-autocomplete-list" id="nvNombreList" hidden></div>
    </div>
    <small class="field-help" id="nvPersonaHint" style="display:none;"></small>

    <label for="nvTelefono">Teléfono</label>
    <input id="nvTelefono" type="text" placeholder="Ej. 444 123 4567">

    <label for="nvCategoria">Categoría</label>
    <select id="nvCategoria" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
      <option value="normal">Emprendedora normal (3 días)</option>
      <option value="foranea">Emprendedora foránea (15 días)</option>
      <option value="vip">Líder VIP (sin depósito, sin vencimiento)</option>
    </select>

    <label for="nvProductoId">Producto *</label>
    <select id="nvProductoId" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
      <option value="">Selecciona un producto...</option>
      ${obtenerCatalogoStaffStorage().filter(productoDisponible).map(p => `<option value="${p.id}">${escapeHTML(p.nombre)} — $${Number(precioConDescuento(p)).toLocaleString('es-MX')} MXN</option>`).join('')}
    </select>

    <label for="nvVarianteId">Variante (color / talla) *</label>
    <select id="nvVarianteId" disabled style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
      <option value="">Primero selecciona un producto</option>
    </select>

    <label for="nvTotal">Precio (descuento de mayoreo ya aplicado)</label>
    <input id="nvTotal" type="number" min="0" step="1" placeholder="Se llena al elegir el producto">

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarNuevaVentanaBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  // LOG-10 de la auditoría — ver nota completa en staff-apartados.js.
  let personaSeleccionadaNuevaVentana = null;
  if (typeof crearAutocompletePersonas === 'function' && typeof obtenerPersonas === 'function') {
    crearAutocompletePersonas({
      inputEl: document.getElementById('nvNombre'),
      listEl: document.getElementById('nvNombreList'),
      obtenerCandidatos: (texto) => obtenerPersonas().filter(p =>
        p.estado !== 'baja' && nombreCompletoPersona(p).toLowerCase().includes(texto)
      ),
      onSeleccionar: (p) => {
        personaSeleccionadaNuevaVentana = p;
        const telefonoInput = document.getElementById('nvTelefono');
        const categoriaSelect = document.getElementById('nvCategoria');
        const hint = document.getElementById('nvPersonaHint');
        if (telefonoInput && p.telefono) telefonoInput.value = p.telefono;
        if (categoriaSelect && p.categoria) categoriaSelect.value = p.categoria;
        if (hint) {
          hint.style.display = 'block';
          hint.textContent = 'Cuenta real encontrada — categoría y teléfono se llenaron de su perfil.';
        }
      },
      onLimpiar: () => {
        personaSeleccionadaNuevaVentana = null;
        const hint = document.getElementById('nvPersonaHint');
        if (hint) hint.style.display = 'none';
      }
    });
  }

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
    const colorOro = productoElegido.colorOro || '';

    const personaId = personaSeleccionadaNuevaVentana ? personaSeleccionadaNuevaVentana.id : null;
    const usuarioId = personaId || slugUsuarioId(nombre);
    const tieneCredito = obtenerCreditoDisponible(usuarioId) > 0;

    abrirAutorizacionEncargado({
      titulo: "Autorizar nueva ventana",
      mensaje: tieneCredito
        ? `Estás a punto de abrir una nueva ventana de apartado para "${nombre}", reutilizando su crédito guardado.`
        : `Estás a punto de abrir una nueva ventana de apartado para "${nombre}" con la pieza "${producto}".`,
      onConfirmar: () => ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, colorOro, total, productoId, varianteId, personaId })
    });

  });

}

async function ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, colorOro, total, productoId, varianteId, personaId }) {

  const usuarioId = personaId || slugUsuarioId(nombre);

  // Si la persona ya tiene una ventana activa, la pieza se suma ahí en
  // vez de abrir una segunda ventana con su propio vencimiento aparte
  // (Sección 5.1: "apartar VARIAS piezas sin volver a pagar").
  const ventanaExistente = ventanas.find(v => v.usuarioId === usuarioId && v.estado !== "vencida" && v.estado !== "cerrada");

  if (ventanaExistente) {

    const resultadoPiezaExistente = await agregarPiezaAVentana(ventanaExistente, { producto, variante, colorOro, total, productoId, varianteId }, ENCARGADO_EMPLEADO);

    if (!resultadoPiezaExistente.ok) {
      cerrarModal();
      mostrarToast(resultadoPiezaExistente.error);
      return;
    }

    guardarVentanas();
    actualizarResumen();
    renderTabla();
    cerrarModal();

    registrarAuditoriaEncargado({
      modulo: "apartados",
      accion: "agregar_pieza_ventana_existente",
      descripcion: `Pieza ${producto} agregada a la ventana ya activa de ${nombre}`
    });

    mostrarToast(`Pieza agregada a la ventana activa de ${nombre}.`);
    return;

  }

  const nuevaVentana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombre, telefono, categoria }, ENCARGADO_EMPLEADO);
  const resultadoPieza = await agregarPiezaAVentana(nuevaVentana, { producto, variante, colorOro, total, productoId, varianteId }, ENCARGADO_EMPLEADO);

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

  registrarAuditoriaEncargado({
    modulo: "apartados",
    accion: "nueva_ventana",
    descripcion: nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta para ${nombre} reutilizando crédito guardado`
      : `Ventana abierta para ${nombre} con la pieza ${producto}`
  });

  mostrarToast(
    nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta con crédito reutilizado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`
      : `Ventana creada por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`
  );

}


// ============================================================
// EVENTOS DE FILA (propios de Encargado: no piden credenciales, muestran
// un modal de confirmación con mensaje dinámico vía encargado-comun.js)
// ============================================================

function agregarEventosFilas() {

  document.querySelectorAll("[data-toggle]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.toggle;
      if (filasExpandidas.has(id)) {
        filasExpandidas.delete(id);
      } else {
        filasExpandidas.add(id);
        marcarCambioClienteRevisado(id);
      }
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

  document.querySelectorAll("[data-aplicar-excedente]").forEach(btn => {
    btn.addEventListener("click", () => confirmarAplicarExcedente(btn.dataset.aplicarExcedente));
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
    <select id="depositoMetodo" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
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

    if (metodo === "transferencia" && typeof existeReferenciaDuplicada === 'function' && existeReferenciaDuplicada(referencia)) {
      error.style.display = "block";
      error.textContent = "Ese número de referencia ya existe.";
      return;
    }

    abrirAutorizacionEncargado({
      titulo: "Autorizar depósito",
      mensaje: `Estás a punto de confirmar el depósito de $${monto} MXN de "${v.usuarioNombre}".`,
      onConfirmar: () => ejecutarConfirmarDeposito(v.id, { monto, metodo, referencia: referencia || null })
    });

  });

}

function ejecutarConfirmarDeposito(ventanaId, datos) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  confirmarDepositoVentana(v, datos, ENCARGADO_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "confirmar_deposito", descripcion: `Depósito de $${datos.monto} confirmado para ${v.usuarioNombre}` });
  mostrarToast(`Depósito confirmado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// LIQUIDAR APARTADO (CARRITO) — checkbox por pieza activa; la
// resolución del depósito solo aparece si la selección actual cubre
// TODAS las piezas activas (va a dejar la ventana sin ninguna) — ver
// liquidarPiezasSeleccionadas en apartados-modelo.js. El arranque
// (iniciarLiquidacionVentana) es común y vive en
// apartados-panel-comun.js; solo este modal y la autorización final
// se quedan aquí.
// ============================================================

function abrirModalLiquidar(v) {

  const piezasActivas = obtenerPiezasActivas(v);
  const idsDeclarados = new Set(Array.isArray(v.piezasDeclaradasPago) ? v.piezasDeclaradasPago : []);

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>Liquidar apartado</h3>
    <p class="modal-sub">${escapeHTML(v.usuarioNombre)} · ${piezasActivas.length} pieza${piezasActivas.length === 1 ? "" : "s"}</p>

    ${v.fechaDeclaracionPago ? `<div class="modal-note">${escapeHTML(v.usuarioNombre)} avisó que ya pagó el ${formatearFechaHora(v.fechaDeclaracionPago)}${idsDeclarados.size && idsDeclarados.size < piezasActivas.length ? ` — solo ${idsDeclarados.size} de ${piezasActivas.length} piezas (ya marcadas abajo)` : ''} (informativo — confirma con la hora real del depósito recibido).</div>` : ""}

    <label>Piezas a liquidar</label>
    <div id="piezasLiquidarLista" class="piezas-liquidar-lista">
      ${piezasActivas.map(p => `
        <label class="pieza-liquidar-row">
          <input type="checkbox" data-pieza-liquidar="${p.id}" ${idsDeclarados.size ? (idsDeclarados.has(p.id) ? "checked" : "") : "checked"}>
          <span class="pieza-liquidar-info">${escapeHTML(p.producto)}${p.variante ? ` · ${escapeHTML(p.variante)}` : ""}</span>
          <strong>$${p.saldo} MXN</strong>
        </label>
      `).join("")}
    </div>

    <div id="depositoLiquidarBox" style="display:none;margin-top:10px;">
      <div class="auth-warning">
        <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span>
        <div>
          <strong>Esta selección paga TODO el apartado — ¿qué hacer con el depósito de $${v.depositoApartadoDisponible} MXN?</strong>
          <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-weight:400;">
            <input type="radio" name="decisionDepositoLiquidar" value="aplicar" checked> Aplicarlo a esta compra
          </label>
          <label style="display:flex;align-items:center;gap:8px;margin-top:4px;font-weight:400;">
            <input type="radio" name="decisionDepositoLiquidar" value="credito"> Guardarlo como crédito
          </label>
        </div>
      </div>
    </div>

    <label for="liquidarMonto" style="margin-top:10px;">Monto a cobrar</label>
    <input id="liquidarMonto" type="number" min="0" step="0.01" value="0" readonly>

    <div id="liquidarPagoCampos" style="display:none;">
      <label for="liquidarMetodo">Método de pago</label>
      <select id="liquidarMetodo" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
        <option value="">Selecciona una opción</option>
        <option value="transferencia">Transferencia</option>
        <option value="local">Pago en local</option>
      </select>
      <label for="liquidarReferencia">Número de referencia</label>
      <input id="liquidarReferencia" type="text" placeholder="Obligatoria para transferencia">
    </div>
    <p class="modal-sub" id="liquidarSinPagoNota" style="display:none;">El depósito cubre el total — no se requiere pago adicional.</p>

    <div id="formError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" style="width:100%;" id="continuarLiquidarBtn">Continuar</button>
  `;

  overlay.classList.add("open");

  function recalcularLiquidar() {
    const idsSeleccionados = Array.from(box.querySelectorAll("[data-pieza-liquidar]:checked")).map(cb => cb.getAttribute("data-pieza-liquidar"));
    const seleccionadas = piezasActivas.filter(p => idsSeleccionados.includes(p.id));
    const totalSeleccion = seleccionadas.reduce((suma, p) => suma + p.saldo, 0);
    const cubreTodo = piezasActivas.length > 0 && seleccionadas.length === piezasActivas.length;
    const hayDeposito = cubreTodo && v.depositoApartadoDisponible > 0;

    const depositoBox = document.getElementById("depositoLiquidarBox");
    if (depositoBox) depositoBox.style.display = hayDeposito ? "" : "none";

    const decision = hayDeposito ? (box.querySelector('input[name="decisionDepositoLiquidar"]:checked')?.value || "aplicar") : null;
    const montoEsperado = decision === "aplicar" ? Math.max(0, totalSeleccion - v.depositoApartadoDisponible) : totalSeleccion;

    const montoInput = document.getElementById("liquidarMonto");
    if (montoInput) montoInput.value = montoEsperado;

    const camposPago = document.getElementById("liquidarPagoCampos");
    const sinPagoNota = document.getElementById("liquidarSinPagoNota");
    if (camposPago) camposPago.style.display = montoEsperado > 0 ? "" : "none";
    if (sinPagoNota) sinPagoNota.style.display = montoEsperado > 0 ? "none" : "";

    return { idsSeleccionados, cubreTodo, decision, montoEsperado };
  }

  recalcularLiquidar();

  box.querySelectorAll("[data-pieza-liquidar]").forEach(cb => cb.addEventListener("change", recalcularLiquidar));
  box.querySelectorAll('input[name="decisionDepositoLiquidar"]').forEach(r => r.addEventListener("change", recalcularLiquidar));

  document.getElementById("continuarLiquidarBtn").addEventListener("click", () => {

    const { idsSeleccionados, cubreTodo, decision, montoEsperado } = recalcularLiquidar();
    const metodo = document.getElementById("liquidarMetodo")?.value || null;
    const referencia = document.getElementById("liquidarReferencia")?.value.trim() || null;
    const error = document.getElementById("formError");

    if (!idsSeleccionados.length) {
      error.style.display = "block";
      error.textContent = "Elige al menos una pieza para liquidar.";
      return;
    }

    if (montoEsperado > 0 && (!metodo || (metodo === "transferencia" && !referencia))) {
      error.style.display = "block";
      error.textContent = metodo === "transferencia" && !referencia
        ? "La referencia es obligatoria para una transferencia."
        : "Selecciona el método de pago.";
      return;
    }

    if (metodo === "transferencia" && typeof existeReferenciaDuplicada === 'function' && existeReferenciaDuplicada(referencia)) {
      error.style.display = "block";
      error.textContent = "Ese número de referencia ya existe.";
      return;
    }

    let mensaje = cubreTodo
      ? `Estás a punto de liquidar el apartado completo de "${v.usuarioNombre}" por $${montoEsperado} MXN.`
      : `Estás a punto de liquidar ${idsSeleccionados.length} de ${piezasActivas.length} piezas de "${v.usuarioNombre}" por $${montoEsperado} MXN — el resto sigue apartado con normalidad.`;
    if (decision === "aplicar") mensaje += ` Se aplicará su depósito de $${v.depositoApartadoDisponible} MXN a la compra.`;
    if (decision === "credito") mensaje += ` Su depósito de $${v.depositoApartadoDisponible} MXN se guardará como crédito.`;

    abrirAutorizacionEncargado({
      titulo: "Autorizar liquidación",
      mensaje,
      onConfirmar: () => ejecutarLiquidar(v.id, idsSeleccionados, { monto: montoEsperado, metodo, referencia }, decision)
    });

  });

}

function ejecutarLiquidar(ventanaId, piezaIds, datos, decisionDeposito) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const resultado = liquidarPiezasSeleccionadas(v, piezaIds, datos, ENCARGADO_EMPLEADO);

  if (resultado?.requiereResolucionDeposito && decisionDeposito) {
    resolverDepositoVentana(v, decisionDeposito, ENCARGADO_EMPLEADO);
  }

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "liquidar_ventana", descripcion: `Apartado de ${v.usuarioNombre} liquidado por $${datos.monto} (${piezaIds.length} pieza${piezaIds.length === 1 ? '' : 's'})` });
  mostrarToast(`Apartado liquidado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

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

  abrirAutorizacionEncargado({
    titulo: "Autorizar cancelación",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarCancelar(ventanaId)
  });

}

function ejecutarCancelar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  cancelarVentanaCompleta(v, ENCARGADO_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "cancelar_ventana", descripcion: `Apartado de ${v.usuarioNombre} cancelado` });
  mostrarToast(`Apartado cancelado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}

function confirmarAprobarVip(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  abrirAutorizacionEncargado({
    titulo: "Aprobar apartado VIP",
    mensaje: `Estás a punto de aprobar el apartado VIP de "${v.usuarioNombre}".`,
    onConfirmar: () => ejecutarAprobarVip(ventanaId)
  });

}

function confirmarAplicarExcedente(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  abrirAutorizacionEncargado({
    titulo: "Aplicar excedente de depósito",
    mensaje: `Vas a aplicar el excedente de depósito de "${v.usuarioNombre}" ($${v.depositoExcedente} MXN) al saldo pendiente de sus piezas activas.`,
    onConfirmar: () => ejecutarAplicarExcedente(ventanaId)
  });

}

function ejecutarAplicarExcedente(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const resultado = aplicarExcedenteDeposito(v, ENCARGADO_EMPLEADO);
  if (!resultado.ok) { cerrarModal(); mostrarToast(resultado.error); return; }

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "aplicar_excedente_deposito", descripcion: `Excedente de depósito de ${v.usuarioNombre} aplicado: $${resultado.aplicado}` });
  mostrarToast(`Excedente de $${resultado.aplicado} aplicado.`);

}

function ejecutarAprobarVip(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  aprobarVentanaVip(v, ENCARGADO_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "aprobar_vip_ventana", descripcion: `Apartado VIP de ${v.usuarioNombre} aprobado` });
  mostrarToast(`Apartado VIP aprobado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

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

  abrirAutorizacionEncargado({
    titulo: "Autorizar desapartar",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarDesapartar(ventanaId)
  });

}

function ejecutarDesapartar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  desapartarVentanaVencida(v, ENCARGADO_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaEncargado({ modulo: "apartados", accion: "desapartar_ventana", descripcion: `Apartado vencido de ${v.usuarioNombre} desapartado` });
  mostrarToast(`Apartado desapartado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}
