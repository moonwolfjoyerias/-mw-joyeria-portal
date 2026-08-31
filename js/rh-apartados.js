// MW JOYERÍA — Apartados RH
// Mismas capacidades y reglas de negocio que Apartados de Staff (ver
// js/apartados-modelo.js, fuente única de verdad, y
// js/staff-apartados-ejemplo.js, reutilizado tal cual para los datos
// de ejemplo — misma clave de localStorage, mismo "sistema").
//
// Única diferencia respecto a Staff: las acciones sensibles NO piden
// usuario/contraseña de nuevo — muestran un modal de Autorización con
// mensaje dinámico (ver js/rh-comun.js) y quedan en la auditoría de RH.

let ventanas = [];
let filtroEstado = "todos";
let terminoBusqueda = "";
const filasExpandidas = new Set();

const MENSAJE_WHATSAPP_VENCIDO = "Tu apartado venció. Por favor contáctanos para revisar las opciones disponibles.";

// "empleado" que esperan las funciones de apartados-modelo.js.
const RH_EMPLEADO = { nombre: RH_IDENTIDAD.usuarioNombre };


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

    const usuarioId = slugUsuarioId(nombre);
    const tieneCredito = obtenerCreditoDisponible(usuarioId) > 0;

    abrirAutorizacionRH({
      titulo: "Autorizar nueva ventana",
      mensaje: tieneCredito
        ? `Estás a punto de abrir una nueva ventana de apartado para "${nombre}", reutilizando su crédito guardado.`
        : `Estás a punto de abrir una nueva ventana de apartado para "${nombre}" con la pieza "${producto}".`,
      onConfirmar: () => ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, total })
    });

  });

}

function ejecutarNuevaVentana({ nombre, telefono, categoria, producto, variante, total }) {

  const usuarioId = slugUsuarioId(nombre);

  const nuevaVentana = abrirVentanaApartado({ usuarioId, usuarioNombre: nombre, telefono, categoria }, RH_EMPLEADO);
  agregarPiezaAVentana(nuevaVentana, { producto, variante, total }, RH_EMPLEADO);
  ventanas.push(nuevaVentana);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaRH({
    modulo: "apartados",
    accion: "nueva_ventana",
    descripcion: nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta para ${nombre} reutilizando crédito guardado`
      : `Ventana abierta para ${nombre} con la pieza ${producto}`
  });

  mostrarToast(
    nuevaVentana.metodoDeposito === "credito_anterior"
      ? `Ventana abierta con crédito reutilizado por ${RH_IDENTIDAD.usuarioNombre}.`
      : `Ventana creada por ${RH_IDENTIDAD.usuarioNombre}.`
  );

}


// ============================================================
// FILTROS
// ============================================================

function obtenerVentanasFiltradas() {

  return ventanas.filter(v => {

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
        <td colspan="6" class="empty-cell">
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
  const vencidaAviso = v.estado === "activa" && ventanaEstaVencida(v);

  return `
    <tr class="ventana-row">
      <td>
        <button type="button" class="client-cell" style="border:0;background:transparent;text-align:left;cursor:pointer;padding:0;width:100%;" data-toggle="${v.id}">
          <div class="avatar">${obtenerIniciales(v.usuarioNombre)}</div>
          <div>
            <strong>${escapeHTML(v.usuarioNombre)}</strong>
            <small>${escapeHTML(v.telefono || "")}</small>
            <small style="color:#5b1689;font-weight:600;">${expandida ? "▾" : "▸"} Ver piezas (${v.apartados.length})</small>
          </div>
        </button>
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

      <td>
        <span class="status ${estado.clase}">${estado.texto}</span>
        ${v.resolucionDeposito ? `<small style="display:block;margin-top:4px;color:#766d83;">${obtenerTextoResolucion(v.resolucionDeposito)}</small>` : ""}
        ${vencidaAviso ? `<small style="display:block;margin-top:4px;color:#bd4c4c;">⚠ Vencida — pendiente de gestionar</small>` : ""}
      </td>

      <td>${obtenerTextoVencimiento(v)}</td>

      <td>
        <div class="actions-stack">
          ${obtenerAccionesVentana(v)}
        </div>
      </td>
    </tr>

    ${expandida ? crearFilaDetalle(v) : ""}
  `;

}


function crearFilaDetalle(v) {

  const piezas = !v.apartados.length ? "<small>Sin piezas</small>" : v.apartados.map(p => {

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
        </div>
      </div>
    `;

  }).join("");

  const auditoria = v.auditoria.slice().reverse().map(a => `
    <div class="log-box" style="margin-bottom:8px;">
      <strong>${escapeHTML(a.texto)}</strong>
      <small>${escapeHTML(a.usuario)} · ${formatearFechaHora(a.fecha)}</small>
    </div>
  `).join("");

  return `
    <tr class="expand-row">
      <td colspan="6" style="background:#faf8fc;padding:16px 20px;">

        <div class="eyebrow" style="margin-bottom:8px;">Piezas del apartado</div>
        ${piezas}

        <div class="eyebrow" style="margin:14px 0 8px;">Historial de la ventana</div>
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
// ACCIONES DISPONIBLES POR VENTANA
// ============================================================

function obtenerAccionesVentana(v) {

  let html = "";

  if (v.estado === "pendiente_deposito") {
    html += `<button class="action-btn primary-action" data-confirmar-deposito="${v.id}"><span>✓</span> Confirmar depósito</button>`;
  }

  if (v.estado === "activa") {

    if (obtenerPiezasActivas(v).length) {
      html += `<button class="action-btn primary-action" data-liquidar-ventana="${v.id}"><span>✓</span> Liquidar apartado</button>`;
      html += `<button class="action-btn danger-action" data-cancelar-ventana="${v.id}"><span>×</span> Cancelar apartado</button>`;
    }

    if (ventanaEstaVencida(v)) {
      html += `<button class="action-btn detail-action" data-whatsapp-ventana="${v.id}"><span>↗</span> Contactar por Whatsapp</button>`;
      html += `<button class="action-btn danger-action" data-desapartar-ventana="${v.id}"><span>×</span> Desapartar</button>`;
    }

  }

  return html;

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
    <div class="auth-icon">✓</div>
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

    abrirAutorizacionRH({
      titulo: "Autorizar depósito",
      mensaje: `Estás a punto de confirmar el depósito de $${monto} MXN de "${v.usuarioNombre}".`,
      onConfirmar: () => ejecutarConfirmarDeposito(v.id, { monto, metodo, referencia: referencia || null })
    });

  });

}

function ejecutarConfirmarDeposito(ventanaId, datos) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  confirmarDepositoVentana(v, datos, RH_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaRH({ modulo: "apartados", accion: "confirmar_deposito", descripcion: `Depósito de $${datos.monto} confirmado para ${v.usuarioNombre}` });
  mostrarToast(`Depósito confirmado por ${RH_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// LIQUIDAR APARTADO COMPLETO (con resolución del depósito)
// ============================================================

function iniciarLiquidacionVentana(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v || !obtenerPiezasActivas(v).length) return;

  if (v.depositoApartadoDisponible > 0) {
    abrirModalResolucionDeposito(v);
  } else {
    abrirModalLiquidar(v, null);
  }

}


function abrirModalResolucionDeposito(v) {

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">✓</div>
    <h3>¿Qué hacer con el depósito?</h3>
    <p class="modal-sub">Vas a liquidar el apartado completo de ${escapeHTML(v.usuarioNombre)}. Tiene $${v.depositoApartadoDisponible} MXN de depósito disponible.</p>

    <button class="btn btn-primary" style="width:100%;" id="aplicarDepositoBtn">Aplicar a esta compra (−$${v.depositoApartadoDisponible} MXN)</button>
    <button class="btn btn-outline" style="width:100%;" id="guardarCreditoBtn">Guardar como crédito para su próximo apartado</button>
  `;

  overlay.classList.add("open");

  document.getElementById("aplicarDepositoBtn").addEventListener("click", () => abrirModalLiquidar(v, "aplicar"));
  document.getElementById("guardarCreditoBtn").addEventListener("click", () => abrirModalLiquidar(v, "credito"));

}


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
    <div class="auth-icon">✓</div>
    <h3>Liquidar apartado</h3>
    <p class="modal-sub">${escapeHTML(v.usuarioNombre)} · ${piezasActivas.length} pieza${piezasActivas.length === 1 ? "" : "s"}</p>

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

    let mensaje = `Estás a punto de liquidar el apartado de "${v.usuarioNombre}" por $${monto} MXN.`;
    if (decisionDeposito === "aplicar") mensaje += ` Se aplicará su depósito de $${v.depositoApartadoDisponible} MXN a la compra.`;
    if (decisionDeposito === "credito") mensaje += ` Su depósito de $${v.depositoApartadoDisponible} MXN se guardará como crédito.`;

    abrirAutorizacionRH({
      titulo: "Autorizar liquidación",
      mensaje,
      onConfirmar: () => ejecutarLiquidar(v.id, { monto, metodo, referencia }, decisionDeposito)
    });

  });

}

function ejecutarLiquidar(ventanaId, datos, decisionDeposito) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const resultado = liquidarVentanaCompleta(v, datos, RH_EMPLEADO);

  if (resultado?.requiereResolucionDeposito && decisionDeposito) {
    resolverDepositoVentana(v, decisionDeposito, RH_EMPLEADO);
  }

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaRH({ modulo: "apartados", accion: "liquidar_ventana", descripcion: `Apartado de ${v.usuarioNombre} liquidado por $${datos.monto}` });
  mostrarToast(`Apartado liquidado por ${RH_IDENTIDAD.usuarioNombre}.`);

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

  abrirAutorizacionRH({
    titulo: "Autorizar cancelación",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarCancelar(ventanaId)
  });

}

function ejecutarCancelar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  cancelarVentanaCompleta(v, RH_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaRH({ modulo: "apartados", accion: "cancelar_ventana", descripcion: `Apartado de ${v.usuarioNombre} cancelado` });
  mostrarToast(`Apartado cancelado por ${RH_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// CONTACTO WHATSAPP (informativo, no requiere autorización) Y
// DESAPARTAR (ventana vencida — pierde el depósito para siempre)
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
    <p class="modal-sub">El apartado de ${escapeHTML(v.usuarioNombre)} venció. Si no responde, usa "Desapartar" para cerrarlo y liberar las piezas.</p>
    <div class="modal-context">
      <span>Emprendedora</span><strong>${escapeHTML(v.usuarioNombre)}</strong>
      <span>Teléfono</span><strong>${escapeHTML(v.telefono || "Sin teléfono")}</strong>
    </div>
    ${numero ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir Whatsapp</a>` : '<p class="auth-error">Esta persona no tiene un número de teléfono válido.</p>'}
  `;

  overlay.classList.add("open");

}


function confirmarDesapartarVentana(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const mensaje = v.depositoApartadoDisponible > 0
    ? `Estás a punto de desapartar el apartado vencido de "${v.usuarioNombre}". Esto cancelará sus piezas restantes y perderá su depósito de $${v.depositoApartadoDisponible} MXN de forma definitiva.`
    : `Estás a punto de desapartar el apartado vencido de "${v.usuarioNombre}". Esto cancelará sus piezas restantes.`;

  abrirAutorizacionRH({
    titulo: "Autorizar desapartar",
    mensaje,
    peligrosa: true,
    onConfirmar: () => ejecutarDesapartar(ventanaId)
  });

}

function ejecutarDesapartar(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  desapartarVentanaVencida(v, RH_EMPLEADO);

  guardarVentanas();
  actualizarResumen();
  renderTabla();
  cerrarModal();

  registrarAuditoriaRH({ modulo: "apartados", accion: "desapartar_ventana", descripcion: `Apartado vencido de ${v.usuarioNombre} desapartado` });
  mostrarToast(`Apartado desapartado por ${RH_IDENTIDAD.usuarioNombre}.`);

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

  return v.estado === "vencida" || ventanaEstaVencida(v) ? `Venció el ${fecha}` : fecha;

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
    ventanasVencidas: ventanas.filter(v => v.estado === "activa" && ventanaEstaVencida(v)).length,
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

function escapeHTML(texto) {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
