// MW JOYERÍA — Apartados: renderizado y utilidades comunes a los 3
// controladores por rol (Staff/Encargado/Admin).
//
// Se carga como <script> global igual que los tres, así que las
// funciones de aquí abajo referencian variables declaradas en el
// archivo del controlador de cada página (`ventanas`, `filtroEstado`,
// `terminoBusqueda`, `filasExpandidas`, `MENSAJE_WHATSAPP_VENCIDO`) y
// funciones que sí difieren por rol y por eso se quedaron en cada
// controlador (`agregarEventosFilas`, `abrirModalNuevaVentana`,
// `abrirModalConfirmarDeposito`, `abrirModalLiquidar`) — todas
// resueltas en tiempo de ejecución vía el ámbito global compartido
// entre <script> clásicos, no en tiempo de declaración.
//
// La diferencia real entre roles es solo el flujo de autorización
// (Staff pide usuario/contraseña de nuevo; Encargado/Admin muestran un
// modal de confirmación con mensaje dinámico) — eso permanece en
// cada controlador.

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
        <td colspan="6" class="empty-cell">
          <div class="empty-state">
            <div class="empty-icon"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg></span></div>
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
        ${vencidaAviso ? `<small style="display:block;margin-top:4px;color:#bd4c4c;"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span> Vencida — pendiente de gestionar</small>` : ""}
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


// ============================================================
// ACCIONES DISPONIBLES POR VENTANA
// ============================================================

function obtenerAccionesVentana(v) {

  let html = "";

  if (v.estado === "pendiente_deposito") {
    html += `<button class="action-btn primary-action" data-confirmar-deposito="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span> Confirmar depósito</button>`;
  }

  if (v.estado === "pendiente_aprobacion") {
    html += `<button class="action-btn primary-action" data-aprobar-vip="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span> Aprobar apartado VIP</button>`;
  }

  if (v.estado === "activa") {

    if (obtenerPiezasActivas(v).length) {
      html += `<button class="action-btn primary-action" data-liquidar-ventana="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span> Liquidar apartado</button>`;
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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>¿Qué hacer con el depósito?</h3>
    <p class="modal-sub">Vas a liquidar el apartado completo de ${escapeHTML(v.usuarioNombre)}. Tiene $${v.depositoApartadoDisponible} MXN de depósito disponible.</p>

    <button class="btn btn-primary" style="width:100%;" id="aplicarDepositoBtn">Aplicar a esta compra (−$${v.depositoApartadoDisponible} MXN)</button>
    <button class="btn btn-outline" style="width:100%;" id="guardarCreditoBtn">Guardar como crédito para su próximo apartado</button>
  `;

  overlay.classList.add("open");

  document.getElementById("aplicarDepositoBtn").addEventListener("click", () => abrirModalLiquidar(v, "aplicar"));
  document.getElementById("guardarCreditoBtn").addEventListener("click", () => abrirModalLiquidar(v, "credito"));

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
    <p class="modal-sub">El apartado de ${escapeHTML(v.usuarioNombre)} venció. Si no responde, usa "Desapartar" para cerrarlo y liberar las piezas.</p>
    <div class="modal-context">
      <span>Emprendedora</span><strong>${escapeHTML(v.usuarioNombre)}</strong>
      <span>Teléfono</span><strong>${escapeHTML(v.telefono || "Sin teléfono")}</strong>
    </div>
    ${numero ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir Whatsapp</a>` : '<p class="auth-error">Esta persona no tiene un número de teléfono válido.</p>'}
  `;

  overlay.classList.add("open");

}


// ============================================================
// ESTADOS Y TEXTOS
// ============================================================

function obtenerEstadoVentana(v) {

  const estados = {
    pendiente_deposito: { texto: "Pendiente de depósito", clase: "status-pending" },
    pendiente_aprobacion: { texto: "Pendiente de aprobación VIP", clase: "status-pending" },
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

  if (!regla.requiereDeposito) return v.estado === "pendiente_aprobacion" ? "Esperando aprobación VIP" : "Categoría VIP";
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
