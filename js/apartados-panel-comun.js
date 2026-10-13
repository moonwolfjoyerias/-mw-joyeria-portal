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

// BUG reportado tras lanzar a producción: la fila de detalle de cada
// pieza mostraba un cuadro morado con el texto literal "MW" en vez de
// la foto real del producto — mismo criterio de ruta que ya usa
// normalizarImagenProducto() en staff/encargado/admin-catalogo.js (esta
// página también vive a dos niveles de /portal/).
function normalizarImagenApartadoPanel(imagen) {
  if (!imagen) return '../../assets/images/isotipo-morado.png';
  if (imagen.startsWith('../assets/')) return `../../${imagen.slice(3)}`;
  return imagen;
}

function fotoPiezaApartadoPanel(pieza) {
  const producto = typeof obtenerCatalogoStaffStorage === 'function'
    ? obtenerCatalogoStaffStorage().find(p => p.id === pieza.productoId)
    : null;
  return normalizarImagenApartadoPanel(producto && typeof fotoPrincipalProducto === 'function' ? fotoPrincipalProducto(producto) : producto?.imagen);
}

// LOG-11 de la auditoría: expandir la fila para ver sus piezas ya
// cuenta como "revisar" el cambio que la clienta hizo — quita el aviso
// de la fila sin necesitar un botón aparte. Se llama desde los 3
// controladores (staff/encargado/admin-apartados.js) justo al
// EXPANDIR (nunca al colapsar).
function marcarCambioClienteRevisado(ventanaId) {
  const v = ventanas.find(x => x.id === ventanaId);
  if (v && v.cambioClienteSinRevisar) {
    delete v.cambioClienteSinRevisar;
    guardarVentanas();
  }
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

    // "Quitar de la vista" solo oculta la fila — la ventana, su historial
    // y su crédito siguen intactos, y se pueden ver con el filtro
    // "Quitadas de la vista".
    if (filtroEstado === "ocultas") {
      if (!v.ocultaEnPanel) return false;
    } else {
      if (v.ocultaEnPanel) return false;

      // Una ventana cerrada sin depósito que conservar ya no tiene nada
      // pendiente para Staff — no se muestra (el registro sigue viviendo
      // en los datos, solo no se renderiza como fila).
      if (v.estado === "cerrada" && v.resolucionDeposito !== "credito") return false;
    }

    const coincideEstado = filtroEstado === "todos" || filtroEstado === "ocultas" || v.estado === filtroEstado;

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
  agregarEventosComunesFilas();
  wirearZoomFotos(tbody);

}

// Bolsita, "quitar de la vista"/"volver a mostrar" y "quitar pieza"
// quedan en Actividad con el nombre de quien lo hizo. Cada controlador
// decide cómo se confirma (pedirConfirmacionPanelRol /
// confirmarQuitarPiezaRol): Encargado/Admin con un modal de
// confirmación (su cuenta ya es individual); Staff con usuario/
// contraseña, porque su cuenta es compartida y solo así se sabe qué
// persona lo hizo. onConfirmar recibe al empleado identificado.
function agregarEventosComunesFilas() {

  document.querySelectorAll("[data-bolsita-pieza]").forEach(btn => {
    btn.addEventListener("click", () => confirmarBolsitaPieza(btn.dataset.ventana, btn.dataset.bolsitaPieza));
  });

  document.querySelectorAll("[data-ocultar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => confirmarOcultarVentana(btn.dataset.ocultarVentana, true));
  });

  document.querySelectorAll("[data-mostrar-ventana]").forEach(btn => {
    btn.addEventListener("click", () => confirmarOcultarVentana(btn.dataset.mostrarVentana, false));
  });

  document.querySelectorAll("[data-quitar-pieza]").forEach(btn => {
    btn.addEventListener("click", () => abrirModalQuitarPieza(btn.dataset.ventana, btn.dataset.quitarPieza));
  });

  document.querySelectorAll("[data-pedir-comprobante]").forEach(btn => {
    btn.addEventListener("click", () => iniciarPedirComprobante(btn.dataset.pedirComprobante));
  });

  document.querySelectorAll("[data-no-deposito]").forEach(btn => {
    btn.addEventListener("click", () => confirmarNoDeposito(btn.dataset.noDeposito));
  });

}

// wa.me necesita el número con lada de país: los teléfonos de 10 dígitos
// se guardan sin ella, así que se les antepone 52 (México).
function numeroWhatsapp(telefono) {
  const digitos = String(telefono || "").replace(/\D/g, "");
  if (digitos.length === 10) return "52" + digitos;
  return digitos.length > 10 ? digitos : "";
}

function mensajeComprobanteDeposito(v) {
  const nombre = String(v.usuarioNombre || "").trim().split(/\s+/)[0];
  return `¡Hola${nombre ? `, ${nombre}` : ""}! Vimos que apartaste piezas en la página, pero todavía no recibimos tu comprobante de depósito. Te recordamos que, para asegurar tus piezas, es necesario un depósito mínimo de $${DEPOSITO_BASE}. Cuando lo tengas, envíanos tu comprobante por aquí. ¡Quedamos al pendiente!`;
}

// Staff se identifica primero (cuenta compartida); Encargado/Admin pasan
// directo (sinConfirmacion). Lo que queda en Actividad es abrir el enlace.
function iniciarPedirComprobante(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  if (!numeroWhatsapp(v.telefono)) {
    mostrarToast(`${v.usuarioNombre} no tiene un teléfono válido registrado.`);
    return;
  }

  pedirConfirmacionPanelRol({
    ventanaId,
    titulo: "Pedir comprobante por WhatsApp",
    mensaje: `Identifícate para enviarle a ${escapeHTML(v.usuarioNombre)} el recordatorio de su comprobante de depósito.`,
    sinConfirmacion: true,
    onConfirmar: (empleado) => abrirModalComprobanteWhatsapp(ventanaId, empleado)
  });

}

function abrirModalComprobanteWhatsapp(ventanaId, empleado) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const mensaje = mensajeComprobanteDeposito(v);
  const enlace = `https://wa.me/${numeroWhatsapp(v.telefono)}?text=${encodeURIComponent(mensaje)}`;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon">↗</div>
    <h3>Pedir comprobante por WhatsApp</h3>
    <div class="modal-context">
      <span>Emprendedora/Líder</span><strong>${escapeHTML(v.usuarioNombre)}</strong>
      <span>Teléfono</span><strong>${escapeHTML(v.telefono || "")}</strong>
    </div>
    <label>Mensaje</label>
    <div class="modal-note" style="white-space:pre-wrap;">${escapeHTML(mensaje)}</div>
    <a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;margin-top:12px;" href="${escapeAttribute(enlace)}" target="_blank" rel="noopener" id="abrirWhatsappComprobanteBtn">Abrir WhatsApp</a>
  `;

  overlay.classList.add("open");

  document.getElementById("abrirWhatsappComprobanteBtn").addEventListener("click", () => {
    v.auditoria.push(registrarAuditoriaVentana("Se le pidió el comprobante de depósito por WhatsApp", empleado));
    registrarActividadApartadosRol({ accion: "pedir_comprobante_whatsapp", descripcion: `Pidió por WhatsApp el comprobante de depósito a ${v.usuarioNombre}` }, empleado);
    guardarVentanas();
    cerrarModal();
    renderTabla();
  });

}

function confirmarNoDeposito(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  const piezas = obtenerPiezasActivas(v).length;

  pedirConfirmacionPanelRol({
    ventanaId,
    titulo: "No depositó",
    mensaje: `Se cancelará el apartado de ${escapeHTML(v.usuarioNombre)} porque no se recibió su depósito. ${piezas === 1 ? "Su pieza regresa" : `Sus ${piezas} piezas regresan`} al inventario, desaparece${piezas === 1 ? "" : "n"} de su portal y le llegará una notificación con el motivo.`,
    textoBoton: "Cancelar apartado",
    peligrosa: true,
    onConfirmar: (empleado) => ejecutarNoDeposito(ventanaId, empleado)
  });

}

function ejecutarNoDeposito(ventanaId, empleado) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v || v.estado !== "pendiente_deposito") return;

  const piezas = cancelarVentanaSinDeposito(v, empleado);

  if (typeof agregarNotificacion === "function") {
    agregarNotificacion({
      texto: `Cancelamos tu apartado porque no recibimos tu depósito mínimo de $${DEPOSITO_BASE}. Tus piezas quedaron liberadas; si todavía las quieres, puedes volver a apartarlas desde el catálogo.`,
      link: "apartados",
      paraId: v.usuarioId,
      rolDestino: "emprendedora_lider"
    });
  }

  registrarActividadApartadosRol({
    accion: "cancelar_por_no_deposito",
    descripcion: `Canceló el apartado de ${v.usuarioNombre} porque no depositó (${piezas.length} pieza${piezas.length === 1 ? "" : "s"} regresaron al inventario)`
  }, empleado);

  filasExpandidas.delete(v.id);
  guardarVentanas();
  actualizarResumen();
  renderTabla();
  mostrarToast(`Apartado de ${v.usuarioNombre} cancelado por falta de depósito.`);

}

function abrirConfirmacionPanel({ titulo, mensaje, textoBoton, peligrosa, onConfirmar }) {

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon ${peligrosa ? "danger" : ""}">${peligrosa ? "!" : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg>'}</div>
    <h3>${titulo}</h3>
    <p class="modal-sub">${mensaje}</p>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" type="button" onclick="cerrarModal()">Cancelar</button>
      <button class="btn ${peligrosa ? "btn-danger" : "btn-primary"}" style="flex:1;" type="button" id="confirmarPanelBtn">${textoBoton}</button>
    </div>
  `;

  overlay.classList.add("open");

  document.getElementById("confirmarPanelBtn").addEventListener("click", () => {
    cerrarModal();
    onConfirmar();
  });

}

function confirmarBolsitaPieza(ventanaId, piezaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  const pieza = v?.apartados.find(p => p.id === piezaId);
  if (!pieza) return;

  pedirConfirmacionPanelRol(pieza.enBolsita
    ? {
      ventanaId,
      titulo: "Quitar marca de bolsita",
      mensaje: `"${escapeHTML(pieza.producto)}" de ${escapeHTML(v.usuarioNombre)} dejará de aparecer como guardada en su bolsita.`,
      textoBoton: "Quitar marca",
      peligrosa: true,
      onConfirmar: (empleado) => alternarBolsitaPieza(ventanaId, piezaId, empleado)
    }
    : {
      ventanaId,
      titulo: "Guardar en bolsita",
      mensaje: `¿Confirmas que "${escapeHTML(pieza.producto)}" de ${escapeHTML(v.usuarioNombre)} ya está guardada en su bolsita física en el local?`,
      textoBoton: "Sí, ya está guardada",
      onConfirmar: (empleado) => alternarBolsitaPieza(ventanaId, piezaId, empleado)
    });

}

function confirmarOcultarVentana(ventanaId, ocultar) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  pedirConfirmacionPanelRol(ocultar
    ? {
      ventanaId,
      titulo: "Quitar de la vista",
      mensaje: `La ventana de ${escapeHTML(v.usuarioNombre)} dejará de aparecer en la tabla. No se borra nada: podrás consultarla en el filtro "Quitadas de la vista".`,
      textoBoton: "Quitar de la vista",
      peligrosa: true,
      onConfirmar: (empleado) => alternarVentanaOculta(ventanaId, true, empleado)
    }
    : {
      ventanaId,
      titulo: "Volver a mostrar",
      mensaje: `La ventana de ${escapeHTML(v.usuarioNombre)} volverá a aparecer en la tabla.`,
      textoBoton: "Volver a mostrar",
      onConfirmar: (empleado) => alternarVentanaOculta(ventanaId, false, empleado)
    });

}

const MOTIVO_QUITAR_PIEZA_DEFAULT = "Sin existencia disponible";

function abrirModalQuitarPieza(ventanaId, piezaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  const pieza = v ? obtenerPiezasActivas(v).find(p => p.id === piezaId) : null;
  if (!pieza) return;

  const esUltima = obtenerPiezasActivas(v).length === 1;
  const notaCierre = esUltima
    ? (v.depositoApartadoDisponible > 0
      ? ` Es su última pieza activa: la ventana se cerrará y su depósito de $${v.depositoApartadoDisponible} MXN se guardará como crédito.`
      : " Es su última pieza activa: la ventana se cerrará.")
    : "";

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  box.innerHTML = `
    <button class="modal-close" onclick="cerrarModal()">×</button>
    <div class="auth-icon danger">!</div>
    <h3>Quitar pieza del apartado</h3>
    <p class="modal-sub">"${escapeHTML(pieza.producto)}" se quitará del apartado de ${escapeHTML(v.usuarioNombre)} y le llegará una notificación con el motivo.${notaCierre}</p>

    <label for="motivoQuitarPieza">Motivo</label>
    <textarea id="motivoQuitarPieza" rows="2" style="width:100%;">${escapeHTML(MOTIVO_QUITAR_PIEZA_DEFAULT)}</textarea>

    <div class="modal-note">La existencia del catálogo no cambia. Si el inventario está mal, corrígelo en Catálogo.</div>

    <div id="quitarPiezaError" class="auth-error" style="display:none;"></div>

    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" type="button" onclick="cerrarModal()">Cancelar</button>
      <button class="btn btn-danger" style="flex:1;" type="button" id="confirmarQuitarPiezaBtn">Quitar pieza</button>
    </div>
  `;

  overlay.classList.add("open");

  document.getElementById("confirmarQuitarPiezaBtn").addEventListener("click", () => {
    const motivo = document.getElementById("motivoQuitarPieza").value.trim();
    if (!motivo) {
      const error = document.getElementById("quitarPiezaError");
      error.style.display = "block";
      error.textContent = "Escribe el motivo.";
      return;
    }
    confirmarQuitarPiezaRol(ventanaId, piezaId, motivo);
  });

}

function notificarPiezaQuitada(v, pieza, motivo) {
  if (typeof agregarNotificacion !== "function") return;
  agregarNotificacion({
    texto: `Quitamos "${pieza.producto}" de tu apartado. Motivo: ${motivo.replace(/[.\s]+$/, "")}.`,
    link: "apartados",
    paraId: v.usuarioId,
    rolDestino: "emprendedora_lider"
  });
}

function alternarBolsitaPieza(ventanaId, piezaId, empleado) {

  const v = ventanas.find(x => x.id === ventanaId);
  const pieza = v?.apartados.find(p => p.id === piezaId);
  if (!pieza) return;

  if (pieza.enBolsita) {
    delete pieza.enBolsita;
    v.auditoria.push(registrarAuditoriaVentana(`${pieza.producto}: se quitó la marca de "guardada en bolsita"`, empleado));
    registrarActividadApartadosRol({ accion: "quitar_marca_bolsita", descripcion: `Quitó la marca de bolsita a ${pieza.producto} (apartado de ${v.usuarioNombre})` }, empleado);
  } else {
    pieza.enBolsita = { fecha: new Date().toISOString(), usuario: empleado.nombre };
    v.auditoria.push(registrarAuditoriaVentana(`${pieza.producto}: guardada en la bolsita física`, empleado));
    registrarActividadApartadosRol({ accion: "guardar_en_bolsita", descripcion: `Guardó ${pieza.producto} en la bolsita física (apartado de ${v.usuarioNombre})` }, empleado);
  }

  guardarVentanas();
  renderTabla();
  mostrarToast(pieza.enBolsita ? `Marcada en bolsita por ${empleado.nombre}.` : `Marca de bolsita quitada por ${empleado.nombre}.`);

}

function alternarVentanaOculta(ventanaId, ocultar, empleado) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v) return;

  if (ocultar) {
    v.ocultaEnPanel = { fecha: new Date().toISOString(), usuario: empleado.nombre };
    v.auditoria.push(registrarAuditoriaVentana("Ventana quitada de la vista", empleado));
    registrarActividadApartadosRol({ accion: "quitar_ventana_de_vista", descripcion: `Quitó de la vista la ventana de ${v.usuarioNombre}` }, empleado);
  } else {
    delete v.ocultaEnPanel;
    v.auditoria.push(registrarAuditoriaVentana("Ventana devuelta a la vista", empleado));
    registrarActividadApartadosRol({ accion: "mostrar_ventana_en_vista", descripcion: `Volvió a mostrar la ventana de ${v.usuarioNombre}` }, empleado);
  }

  filasExpandidas.delete(v.id);
  guardarVentanas();
  renderTabla();
  mostrarToast(ocultar
    ? 'Ventana quitada de la vista. Puedes verla en el filtro "Quitadas de la vista".'
    : "La ventana volvió a la vista.");

}


function crearFilaVentana(v) {

  const estado = obtenerEstadoVentana(v);
  const categoria = obtenerReglaCategoria(v.categoria);
  const expandida = filasExpandidas.has(v.id);
  const vencidaAviso = v.estado === "activa" && ventanaEstaVencida(v);
  const piezasActivas = obtenerPiezasActivas(v);
  const sinBolsita = piezasActivas.filter(p => !p.enBolsita).length;

  return `
    <tr class="ventana-row">
      <td>
        <button type="button" class="client-cell" style="border:0;background:transparent;text-align:left;cursor:pointer;padding:0;width:100%;" data-toggle="${v.id}">
          <div>
            <strong>${escapeHTML(v.usuarioNombre)}</strong>
            <small>${escapeHTML(v.telefono || "")}</small>
            <small style="color:#5b1689;font-weight:600;">${expandida ? "▾" : "▸"} Ver piezas (${v.apartados.length})</small>
            ${piezasActivas.length ? (sinBolsita
              ? `<small style="display:block;margin-top:3px;color:#9a6a00;font-weight:600;">${sinBolsita} de ${piezasActivas.length} sin guardar en bolsita</small>`
              : `<small style="display:block;margin-top:3px;color:#3f7a2a;font-weight:600;">✓ Todas en bolsita</small>`) : ""}
            ${v.cambioClienteSinRevisar ? `<small style="display:block;margin-top:3px;color:#9a6a00;background:#fff4da;border-radius:6px;padding:2px 6px;font-weight:600;">⚠ ${escapeHTML(v.cambioClienteSinRevisar.texto)} — sin revisar</small>` : ""}
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
        ${v.resolucionDeposito ? `<small style="display:block;margin-top:4px;color:var(--mwv-766d83);">${obtenerTextoResolucion(v.resolucionDeposito)}</small>` : ""}
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
    const foto = fotoPiezaApartadoPanel(p);
    const generica = /isotipo-morado\.png/.test(foto);

    // Solo las piezas activas siguen apartadas en el local; una liquidada
    // o cancelada conserva su marca de bolsita (si la tuvo) pero ya no se
    // puede cambiar.
    const bolsita = p.estado === "activa"
      ? `<button type="button" class="action-btn ${p.enBolsita ? "primary-action" : "detail-action"} bolsita-btn" data-ventana="${v.id}" data-bolsita-pieza="${p.id}" title="${p.enBolsita ? "Clic para quitar la marca" : "Marcar cuando la pieza ya esté guardada en su bolsita en el local"}">${p.enBolsita ? "✓ En bolsita" : "Guardar en bolsita"}</button>
         <button type="button" class="action-btn danger-action bolsita-btn" data-ventana="${v.id}" data-quitar-pieza="${p.id}" title="Quitar esta pieza del apartado (por ejemplo, si ya no hay existencia)">× Quitar pieza</button>`
      : (p.enBolsita ? `<span class="status status-active">✓ Estuvo en bolsita</span>` : "");

    return `
      <div class="piece-cell" style="margin-bottom:10px;align-items:flex-start;">
        <div class="piece-thumb"><img src="${foto}" alt="${escapeAttribute(p.producto)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;${generica ? 'opacity:.35;' : ''}" ${generica ? '' : `data-zoom="${escapeAttribute(foto)}" data-zoom-alt="${escapeAttribute(p.producto)}"`}></div>
        <div style="flex:1;">
          <strong>${escapeHTML(p.producto)}</strong>
          <small>${escapeHTML([p.colorOro, p.variante].filter(Boolean).join(" · "))} · $${Number(p.total).toLocaleString("es-MX")} MXN</small>
          <div style="margin-top:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <span class="status ${estadoPieza.clase}">${estadoPieza.texto}</span>
            ${bolsita}
          </div>
          ${p.enBolsita ? `<small style="display:block;margin-top:4px;color:var(--mwv-766d83);">En bolsita desde ${formatearFechaHora(p.enBolsita.fecha)} · ${escapeHTML(p.enBolsita.usuario || "")}</small>` : ""}
          ${p.retiro ? `<small style="display:block;margin-top:4px;color:#b94d4d;">Quitada del apartado: ${escapeHTML(p.retiro.motivo)} · ${escapeHTML(p.retiro.usuario || "")} · ${formatearFechaHora(p.retiro.fecha)}</small>` : ""}
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
    html += `<button class="action-btn detail-action" data-pedir-comprobante="${v.id}"><span>↗</span> Pedir comprobante por WhatsApp</button>`;
    html += `<button class="action-btn danger-action" data-no-deposito="${v.id}"><span>×</span> No depositó</button>`;
  }

  if (v.estado === "pendiente_aprobacion") {
    html += `<button class="action-btn primary-action" data-aprobar-vip="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span> Aprobar apartado VIP</button>`;
  }

  if (v.estado === "activa") {

    if (obtenerPiezasActivas(v).length) {
      // Pedido tras lanzar a producción: cuando la propia Emprendedora/
      // Líder ya avisó que pagó todo (botón "Ya envié mi comprobante" en
      // js/apartados.js, que marca v.fechaDeclaracionPago), este MISMO
      // botón se marca como "Ya pagó todo" para que S/E/A lo note sin
      // tener que abrir la fila — sigue abriendo el mismo modal de
      // Liquidar de siempre, exactamente la misma acción, solo cambia la
      // etiqueta como aviso visual.
      const etiquetaLiquidar = v.fechaDeclaracionPago ? 'Ya pagó todo' : 'Liquidar apartado';
      html += `<button class="action-btn primary-action" data-liquidar-ventana="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span> ${etiquetaLiquidar}</button>`;
      html += `<button class="action-btn danger-action" data-cancelar-ventana="${v.id}"><span>×</span> Cancelar apartado</button>`;
      // LOG-06 de la auditoría: antes el excedente del depósito (lo que
      // pasa de $50) quedaba congelado junto con el piso hasta cerrar
      // toda la ventana. Si hay excedente Y saldo pendiente en alguna
      // pieza activa, se puede aplicar ahora mismo, sin esperar al cierre.
      if (Number(v.depositoExcedente) > 0 && obtenerPiezasActivas(v).some(p => p.saldo > 0)) {
        html += `<button class="action-btn detail-action" data-aplicar-excedente="${v.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 2v20M17 7a5 5 0 0 0-5-2 4 4 0 0 0 0 8 4 4 0 0 1 0 8 5 5 0 0 1-5-2"/></svg></span> Aplicar excedente ($${v.depositoExcedente} MXN)</button>`;
      }
    }

    if (ventanaEstaVencida(v)) {
      html += `<button class="action-btn detail-action" data-whatsapp-ventana="${v.id}"><span>↗</span> Contactar por Whatsapp</button>`;
      html += `<button class="action-btn danger-action" data-desapartar-ventana="${v.id}"><span>×</span> Desapartar</button>`;
    }

  }

  // "vencida" es el estado final tras Desapartar; "cerrada" tras liquidar
  // o cancelar — en ambos ya no queda nada pendiente con la ventana.
  if (v.estado === "cerrada" || v.estado === "vencida") {
    html += v.ocultaEnPanel
      ? `<button class="action-btn detail-action" data-mostrar-ventana="${v.id}"><span>↺</span> Volver a mostrar</button>`
      : `<button class="action-btn detail-action" data-ocultar-ventana="${v.id}"><span>×</span> Quitar de la vista</button>`;
  }

  return html;

}


// ============================================================
// LIQUIDAR APARTADO (CARRITO) — la elección de qué hacer con el
// depósito (si aplica) ya vive DENTRO de abrirModalLiquidar, porque
// depende de si la selección de piezas termina cubriendo TODAS las
// activas o no — antes se preguntaba aquí, antes de saber qué se iba
// a pagar, porque el apartado solo se podía liquidar completo.
// ============================================================

function iniciarLiquidacionVentana(ventanaId) {

  const v = ventanas.find(x => x.id === ventanaId);
  if (!v || !obtenerPiezasActivas(v).length) return;

  abrirModalLiquidar(v);

}


// ============================================================
// CONTACTO WHATSAPP (ventana vencida)
// ============================================================

function abrirContactoWhatsapp(v) {

  if (!v) return;

  const overlay = document.getElementById("modalOverlay");
  const box = document.getElementById("modalBox");

  const numero = numeroWhatsapp(v.telefono);
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
  const conReferencia = (texto) => v.referenciaDeposito ? `${texto} · Ref: ${escapeHTML(v.referenciaDeposito)}` : texto;

  if (!regla.requiereDeposito) return v.estado === "pendiente_aprobacion" ? "Esperando aprobación VIP" : "Categoría VIP";
  if (v.estado === "pendiente_deposito") return "Esperando depósito";
  if (v.estado === "vencida" || v.estado === "cerrada") return conReferencia("Ventana finalizada");

  // LOG-06: el piso de $50 (congelado hasta el cierre) y el excedente
  // (usable en cualquier pago mientras siga activa) se muestran por
  // separado solo cuando de verdad hay excedente — si no, el texto de
  // siempre ("Depósito confirmado"/"Crédito reutilizado") ya basta.
  const base = v.metodoDeposito === "credito_anterior" ? "Crédito reutilizado" : conReferencia("Depósito confirmado");
  if (Number(v.depositoExcedente) > 0) {
    return `${base} · Piso $${v.depositoPiso} + excedente $${v.depositoExcedente}`;
  }
  return base;

}

function obtenerTextoResolucion(resolucion) {

  const textos = {
    aplicado: "Depósito aplicado a la compra",
    credito: "Depósito guardado como crédito",
    perdido: "Depósito perdido por vencimiento",
    no_aplica: "Sin depósito que resolver",
    sin_deposito: "Cancelada: no depositó"
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



// ============================================================
// EN VIVO — lo que cambie BRILLO MW u otro dispositivo (depósitos,
// liquidaciones, ventanas nuevas…) se pinta aquí sin recargar la página.
// Ver escucharApartadosEnVivo() en apartados-firestore-sync.js.
// ============================================================

window.addEventListener("mw:apartados-actualizados", () => {
  if (!document.getElementById("apartadosTableBody")) return;
  ventanas = obtenerVentanasApartado();
  actualizarResumen();
  renderTabla();
});
