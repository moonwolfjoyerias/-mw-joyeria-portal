// MW JOYERÍA — Mis apartados (Emprendedora / Líder)
//
// Las piezas y el estado del depósito que se muestran aquí vienen de
// apartados-modelo.js — la MISMA fuente de datos que usan Staff/Encargado/Admin
// para crear, liquidar y cancelar ventanas de apartado — filtrados a las
// ventanas de la persona con sesión abierta (usuarioId = el id REAL de
// personas-ejemplo.js, vía obtenerIdPersonaActualPortal(); antes usaba
// slugUsuarioId(nombre), que para 'me-lider'/'me-emprendedora' generaba
// un id distinto al real y nunca cruzaba con lo que Catálogo → Apartar
// crea con el mismo id real). Antes esta vista usaba un arreglo estático
// (APARTADOS_EJEMPLO) totalmente desconectado del sistema real: una pieza
// apartada por Staff nunca aparecía aquí. DATOS_BANCARIOS_EJEMPLO
// (apartados-ejemplo.js) sigue usándose solo para los datos bancarios a
// mostrar, y reutiliza el modal genérico (#modalOverlay/#modalBox).
//
// CARRITO (decisión de negocio): antes el apartado se pagaba completo,
// no por pieza. Ahora la persona puede elegir, con un checkbox por
// pieza, cuáles paga ahora — las que elige se liquidan y salen del
// apartado (igual que siempre al liquidar), las que no elige siguen
// apartadas con normalidad, con el mismo plazo/depósito de siempre.
// Solo las piezas de la ventana PAGABLE (obtenerVentanaActivaPrincipal
// — la que ya tiene depósito confirmado y corre su plazo) muestran
// checkbox; piezas de una ventana todavía pendiente de depósito no son
// pagables aún. seleccionCarrito/piezasVistasCarrito viven solo en
// memoria de esta pestaña (se reinician al recargar la página) — toda
// pieza pagable nueva nace preseleccionada (como un carrito normal,
// donde todo lo que tienes ya está "en el carrito" por default) y se
// respeta si la persona la desmarca, mientras siga existiendo.
let seleccionCarrito = new Set();
let piezasVistasCarrito = new Set();

let usuarioIdActual = '';

// Emprendedoras/Líderes foráneas: el envío sale gratis desde este monto
// de compra (decisión de negocio).
const ENVIO_GRATIS_MINIMO = 4000;

document.addEventListener('DOMContentLoaded', async () => {
  usuarioIdActual = (typeof obtenerIdPersonaActualPortal === 'function' && obtenerIdPersonaActualPortal()) || '';

  await apartadosRepoListo; // FASE 2 (Firebase): espera a que obtenerVentanasApartado() tenga datos reales, no un caché vacío
  if (typeof personasRepoListo !== 'undefined') await personasRepoListo; // para saber si la cuenta es foránea (aviso de envío gratis)
  if (typeof catalogoRepoListo !== 'undefined') await catalogoRepoListo; // BUG reportado: sin esto, renderApartados() buscaba la foto real antes de que el catálogo cargara y siempre caía al isologo

  renderApartados();
  iniciarReloj();

  const barBtn = document.getElementById('pagarSeleccionadasBtn');
  if (barBtn) barBtn.addEventListener('click', abrirModalPago);
});

// ---------- Datos propios (leídos del modelo real, no de ejemplo) ----------
function obtenerVentanasPropias() {
  if (!usuarioIdActual) return [];
  return obtenerVentanasApartado().filter(v => v.usuarioId === usuarioIdActual && v.estado !== 'cerrada');
}

// Piezas activas de todas las ventanas propias, cada una junto a su
// ventana (para poder editarla/quitarla y guardarla de vuelta).
function obtenerPiezasPropiasConVentana() {
  return obtenerVentanasPropias().flatMap(ventana =>
    obtenerPiezasActivas(ventana).map(pieza => ({ pieza, ventana }))
  );
}

// La ventana con depósito ya confirmado (estado 'activa') que vence más
// pronto — es la única contra la que tiene sentido correr un cronómetro o
// aceptar un pago. Una ventana 'pendiente_deposito' todavía no tiene un
// vencimiento real corriendo (empieza a correr hasta que Staff confirma el
// depósito), así que no cuenta aquí aunque sus piezas sí se muestren en la
// lista.
function obtenerVentanaActivaPrincipal() {
  const activas = obtenerVentanasPropias().filter(v => v.estado === 'activa' && v.fechaVencimiento);
  if (!activas.length) return null;
  return activas.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0];
}

// Aplica un cambio a una ventana propia y lo persiste en el almacén
// compartido (una sola lectura/escritura para evitar pisar datos con una
// segunda lectura desincronizada).
function mutarVentanaPropia(ventanaId, mutador) {
  const ventanas = obtenerVentanasApartado();
  const ventana = ventanas.find(v => v.id === ventanaId);
  if (!ventana) return null;
  mutador(ventana);
  guardarVentanasApartado(ventanas);
  return ventana;
}

// ---------- Reloj compartido ----------
function iniciarReloj() {
  actualizarReloj();
  setInterval(actualizarReloj, 1000);
}

function actualizarReloj() {
  const ventana = obtenerVentanaActivaPrincipal();
  const box = document.querySelector('.countdown-box');
  if (!box) return;

  if (!ventana) {
    // Sin ventana activa: si lo que tiene es una ventana pendiente de
    // confirmar el depósito, hay que avisarle que ya se registró y que
    // el tiempo empieza a correr hasta que Staff confirme — antes esto
    // simplemente ocultaba la caja sin decir nada. Las VIP no pasan por
    // depósito (quedan 'pendiente_aprobacion'), así que no aplica este
    // aviso — a ellas solo les llega una notificación cuando Staff
    // aprueba su apartado (ver aprobarVentanaVip en apartados-modelo.js).
    const pendiente = obtenerVentanasPropias().find(v => v.estado === 'pendiente_deposito' || v.estado === 'pendiente_aprobacion');
    if (pendiente && pendiente.categoria !== 'vip') {
      box.style.display = '';
      box.classList.remove('countdown-box--vencida');
      const timer = box.querySelector('.countdown-timer');
      if (timer) timer.style.display = 'none';
      const label = box.querySelector('.countdown-label');
      const nota = box.querySelector('.countdown-note');
      if (label) label.textContent = 'Confirmando tu depósito';
      if (nota) nota.textContent = pendiente.estado === 'pendiente_deposito'
        ? `Tu apartado ya se registró. Tu depósito mínimo es de $${depositoFaltanteVentana(pendiente)}; en cuanto lo confirmemos tus piezas quedarán aseguradas y empezará a correr el tiempo.`
        : 'Tu apartado ya se registró. En cuanto confirmemos tu depósito tus piezas quedarán aseguradas y empezará a correr el tiempo.';
    } else {
      box.style.display = 'none';
    }
    return;
  }

  box.style.display = '';
  const timer = box.querySelector('.countdown-timer');
  if (timer) timer.style.display = '';

  // Vencida = solo la etiqueta (Sección 5.3b, decisión de negocio
  // confirmada): nada se pierde todavía, pero la persona debe ver con
  // claridad que su ventana venció y que necesita pasar a pagar/recoger
  // antes de que Staff decida "Desapartar" (lo que sí perdería la
  // pieza y el depósito).
  if (typeof ventanaEstaVencida === 'function' && ventanaEstaVencida(ventana)) {
    setText('cdDias', '00');
    setText('cdHoras', '00');
    setText('cdMin', '00');
    setText('cdSeg', '00');
    box.classList.add('countdown-box--vencida');
    const label = box.querySelector('.countdown-label');
    const nota = box.querySelector('.countdown-note');
    if (label) label.textContent = 'Tu ventana de depósito venció';
    if (nota) nota.textContent = 'Pasa a pagar o recoger tus piezas lo antes posible — Staff puede liberarlas en cualquier momento.';
    return;
  }
  box.classList.remove('countdown-box--vencida');
  const label = box.querySelector('.countdown-label');
  const nota = box.querySelector('.countdown-note');
  if (label) label.textContent = 'Tu ventana de depósito vence en';
  if (nota) nota.textContent = 'Paga en este plazo o pasa a tienda por tus piezas — de lo contrario se liberan.';

  const restante = Math.max(0, new Date(ventana.fechaVencimiento).getTime() - Date.now());
  const dias = Math.floor(restante / (1000 * 60 * 60 * 24));
  const horas = Math.floor((restante / (1000 * 60 * 60)) % 24);
  const min = Math.floor((restante / (1000 * 60)) % 60);
  const seg = Math.floor((restante / 1000) % 60);

  setText('cdDias', String(dias).padStart(2, '0'));
  setText('cdHoras', String(horas).padStart(2, '0'));
  setText('cdMin', String(min).padStart(2, '0'));
  setText('cdSeg', String(seg).padStart(2, '0'));
}

// Avisa a Staff y Encargado de una acción que ellos deben revisar/confirmar
// (quitar pieza, cambiar variante, avisar transferencia). El link lleva
// directo a la fila de esa persona en la tabla operativa de Staff/Encargado
// (?buscar=NOMBRE — ver js/staff-apartados.js / js/encargado-apartados.js).
function notificarEquipoOperativo(texto, nombrePersona) {
  if (typeof agregarNotificacion !== 'function') return;
  const query = nombrePersona ? `?buscar=${encodeURIComponent(nombrePersona)}` : '';
  agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff', origen: 'emprendedora_lider' });
}

// BUG reportado tras lanzar a producción: esta vista siempre mostraba el
// isologo sin importar qué pieza se hubiera apartado — nunca resolvía la
// foto real del producto. Mismo criterio de ruta que ya usa catalogo.js
// (normalizarImagenProducto) para esta misma carpeta de portal (dos
// niveles de profundidad), copiado aquí porque ese archivo no se carga
// en esta página.
function normalizarImagenApartado(imagen) {
  if (!imagen) return '../../assets/images/isotipo-morado.png';
  if (imagen.startsWith('../assets/')) return `../../${imagen.slice(3)}`;
  return imagen;
}

function fotoPiezaApartado(pieza) {
  const producto = typeof obtenerCatalogoStaffStorage === 'function'
    ? obtenerCatalogoStaffStorage().find(p => p.id === pieza.productoId)
    : null;
  return normalizarImagenApartado(producto && typeof fotoPrincipalProducto === 'function' ? fotoPrincipalProducto(producto) : producto?.imagen);
}

function esFotoGenericaApartado(foto) {
  return /isotipo-morado\.png/.test(foto);
}

// La categoría vive en la cuenta, pero también se revisa la de sus
// ventanas por si se le abrió un apartado como foránea desde Staff.
function esForaneaActual() {
  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(usuarioIdActual) : null;
  return persona?.categoria === 'foranea' || obtenerVentanasPropias().some(v => v.categoria === 'foranea');
}

function formatearPesos(monto) {
  return '$' + Number(monto || 0).toLocaleString('es-MX');
}

// ---------- Render de la lista ----------
// "Canceladas recientemente": piezas que la TIENDA le canceló en los
// últimos 30 días, con el motivo y qué pasó con su depósito, para que
// no solo dependa de la notificación. Las que ella misma quitó no salen.
const DIAS_CANCELADAS_RECIENTES = 30;

function piezasCanceladasRecientes() {
  if (!usuarioIdActual || typeof motivoCancelacionPieza !== 'function') return [];
  const limite = Date.now() - DIAS_CANCELADAS_RECIENTES * 86400000;
  return obtenerVentanasApartado()
    .filter(v => v.usuarioId === usuarioIdActual)
    .flatMap(ventana => ventana.apartados.map(pieza => ({ pieza, ventana, causa: motivoCancelacionPieza(pieza, ventana) })))
    .filter(({ pieza, causa }) => causa && !(pieza.cancelacion && pieza.cancelacion.propia) && causa.fecha && new Date(causa.fecha).getTime() >= limite)
    .sort((a, b) => b.causa.fecha.localeCompare(a.causa.fecha));
}

function textoDepositoCancelado(ventana) {
  if (ventana.estado === 'activa' || ventana.estado === 'pendiente_deposito') return 'Tu apartado sigue abierto con tus otras piezas.';
  if (ventana.resolucionDeposito === 'credito') {
    const monto = Number(ventana.creditoAlQuitarPieza ?? (typeof creditoDeCierreEnAuditoria === 'function' ? creditoDeCierreEnAuditoria(ventana) : 0)) || 0;
    return monto > 0
      ? `Tu depósito de ${formatearPesos(monto)} quedó como crédito para tu próximo apartado.`
      : 'Tu depósito quedó como crédito para tu próximo apartado.';
  }
  if (ventana.resolucionDeposito === 'perdido') return 'El depósito no se pudo conservar porque el apartado venció.';
  return '';
}

function renderCanceladasRecientes() {
  const cont = document.getElementById('apartadosCanceladas');
  if (!cont) return;
  const lista = piezasCanceladasRecientes();
  cont.hidden = !lista.length;
  if (!lista.length) { cont.innerHTML = ''; return; }
  cont.innerHTML = `
    <h3>Canceladas recientemente</h3>
    <p class="apartados-canceladas-ayuda">Piezas que se cancelaron de tus apartados en los últimos ${DIAS_CANCELADAS_RECIENTES} días y por qué.</p>
    ${lista.map(({ pieza, ventana, causa }) => {
      const foto = fotoPiezaApartado(pieza);
      const fecha = new Date(causa.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      const deposito = textoDepositoCancelado(ventana);
      return `<article class="cancelada-item">
        <img src="${escapeAttribute(foto)}" alt="" class="${esFotoGenericaApartado(foto) ? 'generica' : ''}">
        <div>
          <strong>${escapeHTML(pieza.producto)}</strong>
          <small>${escapeHTML([pieza.colorOro, pieza.variante].filter(Boolean).join(' · '))} · cancelada el ${fecha}</small>
          <p class="cancelada-motivo"><span>Motivo:</span> ${escapeHTML(String(causa.motivo).replace(/[.\s]+$/, ''))}.</p>
          ${deposito ? `<p class="cancelada-deposito">${escapeHTML(deposito)}</p>` : ''}
        </div>
      </article>`;
    }).join('')}`;
}

function renderApartados() {
  renderCanceladasRecientes();
  const banner = document.getElementById('envioGratisBanner');
  if (banner) banner.hidden = !esForaneaActual();

  const list = document.getElementById('apartadosList');
  const wrap = document.getElementById('apartadosWrap');
  const empty = document.getElementById('apartadosEmpty');
  if (!list) return;

  const items = obtenerPiezasPropiasConVentana();

  if (items.length === 0) {
    if (wrap) wrap.style.display = 'none';
    if (empty) empty.style.display = 'block';
    seleccionCarrito.clear();
    piezasVistasCarrito.clear();
    actualizarResumen();
    return;
  }
  if (wrap) wrap.style.display = '';
  if (empty) empty.style.display = 'none';

  const ventanaPago = obtenerVentanaActivaPrincipal();
  const idsPagables = new Set(ventanaPago ? obtenerPiezasActivas(ventanaPago).map(p => p.id) : []);

  // Toda pieza pagable nueva nace preseleccionada; una ya quitada/pagada
  // se limpia de ambos sets. Una pieza que la persona desmarcó a mano
  // sigue sin seleccionarse mientras exista (ya está en piezasVistasCarrito).
  idsPagables.forEach(id => {
    if (!piezasVistasCarrito.has(id)) {
      seleccionCarrito.add(id);
      piezasVistasCarrito.add(id);
    }
  });
  Array.from(seleccionCarrito).forEach(id => { if (!idsPagables.has(id)) seleccionCarrito.delete(id); });
  Array.from(piezasVistasCarrito).forEach(id => { if (!idsPagables.has(id)) piezasVistasCarrito.delete(id); });

  // Piezas iguales (mismo artículo, variante, precio y ventana) van en una
  // sola fila con su cantidad: − quita una, + aparta otra si hay existencia.
  gruposActuales = agruparPiezasApartado(items, idsPagables);

  list.innerHTML = gruposActuales.map((grupo, i) => {
    const pieza = grupo.piezas[0];
    const n = grupo.piezas.length;
    const foto = fotoPiezaApartado(pieza);
    const generica = esFotoGenericaApartado(foto);
    const etiqueta = precioEtiquetaApartado(pieza);
    const unitario = Number(pieza.total) || 0;
    const seleccionadas = grupo.piezas.filter(p => seleccionCarrito.has(p.id)).length;
    const hayMas = existenciaDisponibleApartado(pieza) > 0;
    return `
    <div class="apartado-row" data-grupo="${i}">
      ${grupo.pagable ? `<input type="checkbox" data-seleccionar-grupo="${i}" ${seleccionadas === n ? 'checked' : ''} title="Pagar ${n === 1 ? 'esta pieza' : 'estas piezas'} ahora">` : ''}
      <div class="apartado-photo"><img src="${foto}" alt="${escapeAttribute(pieza.producto)}" class="${generica ? 'foto-generica' : ''}" ${generica ? '' : `data-zoom="${escapeAttribute(foto)}" data-zoom-alt="${escapeAttribute(pieza.producto)}"`}></div>
      <div class="apartado-info">
        <h4>${escapeHTML(pieza.producto)}</h4>
        <span class="variant">${escapeHTML([pieza.colorOro, pieza.variante].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="apartado-cantidad" role="group" aria-label="Cantidad de ${escapeAttribute(pieza.producto)}">
        <button type="button" data-menos="${i}" aria-label="Quitar una pieza">−</button>
        <span class="apartado-cantidad-num">${n}</span>
        <button type="button" data-mas="${i}" aria-label="Apartar otra pieza" ${pieza.productoId && hayMas ? '' : 'disabled'} title="${pieza.productoId && hayMas ? 'Apartar otra pieza igual' : 'Ya no hay más piezas de esta variante'}">+</button>
      </div>
      <div class="apartado-prices">
        ${etiqueta > unitario ? `<span class="price-public">$${etiqueta.toLocaleString('es-MX')} MXN</span>` : ''}
        <span class="price-emprendedora">$${unitario.toLocaleString('es-MX')} MXN</span>
        ${n > 1 ? `<span class="price-subtotal">Subtotal $${(unitario * n).toLocaleString('es-MX')} MXN</span>` : ''}
      </div>
      <div class="apartado-actions">
        ${n === 1 ? `<button data-editar="${pieza.id}">Editar</button>` : ''}
        <button class="quitar" data-quitar-grupo="${i}">Quitar${n > 1 ? ' todas' : ''}</button>
      </div>
    </div>
  `;
  }).join('');

  wirearZoomFotos(list);

  list.querySelectorAll('[data-quitar-grupo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const grupo = gruposActuales[Number(btn.getAttribute('data-quitar-grupo'))];
      if (!grupo) return;
      if (grupo.piezas.length > 1 && !confirm(`¿Quitar las ${grupo.piezas.length} piezas de "${grupo.piezas[0].producto}"?`)) return;
      quitarPiezas(grupo.piezas.map(p => p.id));
    });
  });
  list.querySelectorAll('[data-menos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const grupo = gruposActuales[Number(btn.getAttribute('data-menos'))];
      if (!grupo) return;
      // Se quita la que no tiene abonos (si hay), empezando por la última.
      const pieza = grupo.piezas.slice().reverse().find(p => !(p.pagos || []).length) || grupo.piezas[grupo.piezas.length - 1];
      quitarPiezas([pieza.id]);
    });
  });
  list.querySelectorAll('[data-mas]').forEach(btn => {
    btn.addEventListener('click', () => {
      const grupo = gruposActuales[Number(btn.getAttribute('data-mas'))];
      if (grupo) apartarOtraPieza(grupo, btn);
    });
  });
  list.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalEditar(btn.getAttribute('data-editar')));
  });
  list.querySelectorAll('[data-seleccionar-grupo]').forEach(cb => {
    cb.addEventListener('change', () => {
      const grupo = gruposActuales[Number(cb.getAttribute('data-seleccionar-grupo'))];
      if (!grupo) return;
      grupo.piezas.forEach(p => { if (cb.checked) seleccionCarrito.add(p.id); else seleccionCarrito.delete(p.id); });
      actualizarResumen();
    });
  });

  actualizarResumen();
}

// ---------- Cantidad (piezas iguales agrupadas) ----------
let gruposActuales = [];
let agregandoPieza = false;

function agruparPiezasApartado(items, idsPagables) {
  const grupos = new Map();
  items.forEach(({ pieza, ventana }) => {
    const pagable = idsPagables.has(pieza.id);
    const clave = [ventana.id, pieza.productoId || `nombre:${pieza.producto}`, pieza.varianteId || pieza.variante || '', Number(pieza.total) || 0, pagable].join('|');
    if (!grupos.has(clave)) grupos.set(clave, { ventana, pagable, piezas: [] });
    grupos.get(clave).piezas.push(pieza);
  });
  return Array.from(grupos.values());
}

function productoDePiezaApartado(pieza) {
  const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  return catalogo.find(p => p.id === pieza.productoId) || null;
}

// Precio etiqueta guardado al apartar; si es una pieza vieja, el del catálogo.
function precioEtiquetaApartado(pieza) {
  if (Number(pieza.precioEtiqueta) > 0) return Number(pieza.precioEtiqueta);
  return Number(productoDePiezaApartado(pieza)?.precioEtiqueta) || 0;
}

function existenciaDisponibleApartado(pieza) {
  const producto = productoDePiezaApartado(pieza);
  const variante = producto && Array.isArray(producto.variantes) ? producto.variantes.find(v => v.id === pieza.varianteId) : null;
  return variante ? Number(variante.stock) || 0 : 0;
}

// "+": aparta otra pieza igual en la MISMA ventana, como "Apartar" en el
// catálogo (descuenta la existencia en una transacción; si ya no hay, avisa).
async function apartarOtraPieza(grupo, boton) {
  if (agregandoPieza) return;
  const pieza = grupo.piezas[0];
  const producto = productoDePiezaApartado(pieza);
  const variante = producto ? producto.variantes.find(v => v.id === pieza.varianteId) : null;
  if (!producto || !variante) { mostrarToast('Esa pieza ya no está en el catálogo.'); return; }
  const ventana = obtenerVentanasApartado().find(v => v.id === grupo.ventana.id);
  if (!ventana || ventana.estado === 'cerrada' || ventana.estado === 'vencida') { mostrarToast('Este apartado ya no admite piezas nuevas.'); return; }

  agregandoPieza = true;
  if (boton) boton.disabled = true;
  try {
    const datosPieza = {
      producto: producto.nombre, variante: etiquetaVariante(variante), colorOro: producto.colorOro || '',
      total: precioConDescuento(producto), productoId: producto.id, varianteId: variante.id
    };
    const resultado = await agregarPiezaAVentana(ventana, datosPieza, null);
    if (!resultado.ok) { mostrarToast(resultado.error || 'Ya no hay más piezas de esta variante.'); return; }
    guardarVentanasApartado(obtenerVentanasApartado().map(v => v.id === ventana.id ? ventana : v));
    notificarEquipoOperativo(`${ventana.usuarioNombre} apartó otra pieza de "${producto.nombre}" (${datosPieza.variante}).`, ventana.usuarioNombre);
    mostrarToast('Se apartó otra pieza');
  } finally {
    agregandoPieza = false;
    renderApartados();
  }
}

function actualizarResumen() {
  const items = obtenerPiezasPropiasConVentana();
  const seleccionadas = items.filter(({ pieza }) => seleccionCarrito.has(pieza.id));
  const total = seleccionadas.reduce((sum, { pieza }) => sum + Number(pieza.total || 0), 0);
  setText('summaryCount', `${seleccionadas.length} pieza${seleccionadas.length === 1 ? '' : 's'} seleccionada${seleccionadas.length === 1 ? '' : 's'}`);
  setText('summaryTotal', `$${total} MXN`);
  const envio = document.getElementById('summaryEnvio');
  if (envio) {
    const foranea = esForaneaActual();
    envio.hidden = !foranea;
    if (foranea) {
      const falta = ENVIO_GRATIS_MINIMO - total;
      envio.classList.toggle('summary-envio--logrado', falta <= 0);
      envio.textContent = falta > 0
        ? `Te faltan ${formatearPesos(falta)} para tener tu envío gratis`
        : '¡Tu envío es gratis!';
    }
  }
  const btn = document.getElementById('pagarSeleccionadasBtn');
  if (btn) {
    btn.disabled = seleccionadas.length === 0;
    btn.textContent = seleccionadas.length
      ? `Pagar ${seleccionadas.length} pieza${seleccionadas.length === 1 ? '' : 's'}`
      : 'Pagar piezas seleccionadas';
  }
}

// ---------- Quitar / Editar ----------
function quitarPieza(id) {
  quitarPiezas([id]);
}

// Quita una o varias piezas iguales (botón − o "Quitar todas") con un solo
// guardado y un solo aviso al equipo.
function quitarPiezas(ids) {
  const encontradas = obtenerPiezasPropiasConVentana().filter(({ pieza }) => ids.includes(pieza.id));
  if (!encontradas.length) return;
  const { pieza, ventana } = encontradas[0];
  const nombrePersona = ventana.usuarioNombre;
  const n = encontradas.length;
  const nombrePieza = n > 1 ? `${pieza.producto} ×${n}` : pieza.producto;
  const variantePieza = pieza.variante;

  mutarVentanaPropia(ventana.id, v => {
    v.apartados.filter(x => ids.includes(x.id) && x.estado === 'activa').forEach(p => {
      p.estado = 'cancelada';
      // La quitó ella: no sale en "Canceladas recientemente" (ver abajo).
      p.cancelacion = { motivo: 'La quitaste tú', fecha: new Date().toISOString(), propia: true };
      if (typeof restaurarStockVariante === 'function') restaurarStockVariante(p.productoId, p.varianteId);
    });
    // LOG-11 de la auditoría: la clienta decide qué piezas quedan y
    // cuáles quita — Staff/Encargado/Admin no deciden eso por ella,
    // pero sí necesitan ver con claridad qué cambió para ir a liberar
    // la pieza física en la tienda. Antes esto solo quedaba en la
    // notificación y en el historial de la ventana (había que
    // expandir la fila para verlo); ahora también queda marcado en la
    // propia fila hasta que alguien del equipo la revise (ver
    // crearFilaVentana en apartados-panel-comun.js).
    v.cambioClienteSinRevisar = { texto: `Quitó "${nombrePieza}" (${variantePieza})`, fecha: new Date().toISOString() };
  });

  renderApartados();
  notificarEquipoOperativo(`Se quitó "${nombrePieza}" (${variantePieza}) del apartado de ${nombrePersona} — revisa si hay que liberar la pieza.`, nombrePersona);
  mostrarToast('Se le notificó al equipo de tus cambios');
}

// La edición ofrece solo variantes REALES del producto (igual que
// "Apartar" desde el catálogo) para que la persona elija entre lo que
// de verdad hay disponible — nunca un campo de texto libre. La variante
// que ya tiene la pieza siempre se incluye (aunque su existencia esté en
// 0, porque esa unidad ya está reservada para ella).
function abrirModalEditar(id) {
  const encontrado = obtenerPiezasPropiasConVentana().find(({ pieza }) => pieza.id === id);
  if (!encontrado) return;
  const { pieza, ventana } = encontrado;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  const producto = catalogo.find(p => p.id === pieza.productoId);
  const opciones = producto ? producto.variantes.filter(v => v.id === pieza.varianteId || v.stock > 0) : [];

  if (!producto || !opciones.length) {
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <h3>Editar: ${pieza.producto}</h3>
      <p class="modal-sub">Ya no hay variantes disponibles de esta pieza en el catálogo. Escríbenos por WhatsApp si necesitas cambiarla.</p>
    `;
    overlay.classList.add('open');
    return;
  }

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Editar: ${pieza.producto}</h3>
    <p class="modal-sub">Elige la nueva variante de esta pieza.</p>
    <label for="editVarianteSelect">Color / talla</label>
    <select id="editVarianteSelect" style="width:100%;height:42px;border:1px solid #ddd5e3;border-radius:7px;padding:0 12px;color:var(--mw-heading-d);">
      ${opciones.map(v => `<option value="${v.id}" ${v.id === pieza.varianteId ? 'selected' : ''}>${etiquetaVariante(v)}</option>`).join('')}
    </select>
    <button class="btn btn-primary" style="width:100%;margin-top:12px;" id="guardarEdicionBtn">Guardar cambios</button>
  `;
  overlay.classList.add('open');

  document.getElementById('guardarEdicionBtn').addEventListener('click', async () => {
    const nuevaVarianteId = document.getElementById('editVarianteSelect').value;
    if (!nuevaVarianteId || nuevaVarianteId === pieza.varianteId) {
      overlay.classList.remove('open');
      return;
    }
    const resultado = await cambiarVariantePiezaApartada(ventana.id, id, nuevaVarianteId);
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    overlay.classList.remove('open');
    renderApartados();
    notificarEquipoOperativo(`Se cambió la variante de "${pieza.producto}" a "${resultado.etiqueta}" en el apartado de ${ventana.usuarioNombre} — confirma que la pieza esté disponible.`, ventana.usuarioNombre);
    mostrarToast('Se le notificó al equipo de tus cambios');
  });
}

async function cambiarVariantePiezaApartada(ventanaId, piezaId, nuevaVarianteId) {
  const encontrado = obtenerPiezasPropiasConVentana().find(({ pieza }) => pieza.id === piezaId);
  if (!encontrado) return { ok: false, error: 'No se encontró la pieza.' };
  const { pieza } = encontrado;

  const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  const producto = catalogo.find(p => p.id === pieza.productoId);
  const nuevaVariante = producto ? producto.variantes.find(v => v.id === nuevaVarianteId) : null;
  if (!producto || !nuevaVariante) return { ok: false, error: 'Esa variante ya no existe en el catálogo.' };

  // LOG-01: primero se intenta descontar la variante NUEVA (transacción
  // real contra el servidor) — si falla (otro dispositivo se adelantó
  // entre que se abrió este modal y se guardó), se aborta sin tocar
  // nada: la pieza se queda exactamente como estaba, con la variante
  // vieja todavía reservada. Solo si el descuento de la nueva variante
  // tiene éxito se libera la vieja — nunca al revés, o una variante
  // podría quedar "liberada" sin que la pieza en realidad haya cambiado.
  if (typeof descontarStockVariante === 'function') {
    const resultado = await descontarStockVariante(pieza.productoId, nuevaVarianteId);
    if (!resultado.ok) return resultado;
  }
  if (typeof restaurarStockVariante === 'function') await restaurarStockVariante(pieza.productoId, pieza.varianteId);

  const etiqueta = etiquetaVariante(nuevaVariante);
  const varianteAnterior = pieza.variante;
  mutarVentanaPropia(ventanaId, v => {
    const p = v.apartados.find(x => x.id === piezaId);
    if (p) { p.varianteId = nuevaVarianteId; p.variante = etiqueta; }
    // LOG-11 de la auditoría: mismo motivo que quitarPieza arriba.
    v.cambioClienteSinRevisar = { texto: `Cambió "${pieza.producto}" de ${varianteAnterior} a ${etiqueta}`, fecha: new Date().toISOString() };
  });

  return { ok: true, etiqueta };
}

// ---------- Pago ----------
// pagaTodo = la selección cubre TODAS las piezas activas de la ventana
// (va a dejarla sin ninguna pieza activa) — solo en ese caso el
// depósito se resuelve (ver abrirModalPago); si es una selección
// parcial, el depósito sigue intacto y la ventana no se cierra.
function mostrarModalPagoConMonto(ventana, piezas, totalFinal, notaExtra, decisionDeposito, pagaTodo) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const mensajeWa = encodeURIComponent('¡Hola! Te envío mi comprobante de pago');
  const nombrePersona = ventana.usuarioNombre;
  const totalActivas = obtenerPiezasActivas(ventana).length;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>${pagaTodo
      ? `Pagar tu apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'})`
      : `Pagar ${piezas.length} de ${totalActivas} piezas de tu apartado`}</h3>
    <p class="modal-sub">Total a pagar: <strong style="color:var(--mw-accent-text)">$${totalFinal} MXN</strong></p>
    ${!pagaTodo ? `<p class="modal-sub" style="margin-top:-.35rem;">Las piezas que no elegiste se quedan apartadas con normalidad, con el mismo plazo de siempre.</p>` : ''}
    ${notaExtra ? `<p class="modal-sub" style="margin-top:-.35rem; color:var(--mw-accent-text); font-weight:600;">${notaExtra}</p>` : ''}

    <div class="bank-details-box">
      <div class="copy-field">
        <span><span class="cf-label">Banco</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.banco}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">Titular</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.titular}</span></span>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">CLABE</span><span class="cf-value">${DATOS_BANCARIOS_EJEMPLO.clabe}</span></span>
        <button data-copy="${DATOS_BANCARIOS_EJEMPLO.clabe}">Copiar</button>
      </div>
      <div class="copy-field">
        <span><span class="cf-label">Concepto</span><span class="cf-value">Tu nombre completo</span></span>
    </div>

    <p class="whatsapp-note">
      Manda tu comprobante a este WhatsApp:<br>
      <a href="https://wa.me/524448100805?text=${mensajeWa}" target="_blank" rel="noopener">444 810 0805</a>
    </p>

    <button class="btn btn-primary" style="width:100%;" id="yaEnvieBtn">Ya envié mi comprobante</button>
  `;
  overlay.classList.add('open');

  box.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard?.writeText(btn.getAttribute('data-copy'));
      const original = btn.textContent;
      btn.innerHTML = 'Copiado <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span>';
      setTimeout(() => { btn.textContent = original; }, 1500);
    });
  });

  document.getElementById('yaEnvieBtn').addEventListener('click', () => {
    const notaDeposito = decisionDeposito === 'aplicar'
      ? ' — decidió aplicar su depósito a esta compra'
      : decisionDeposito === 'credito'
        ? ' — decidió guardar su depósito como crédito'
        : '';
    // Se guarda la hora en que la persona declaró haber pagado y
    // EXACTAMENTE qué piezas eligió (piezasDeclaradasPago) — es una
    // señal informativa para Staff/Encargado/Admin (por ejemplo, si dos
    // personas reclaman la misma pieza, quién avisó primero, o cuáles
    // de las piezas activas son las que debe marcar en el carrito al
    // liquidar), pero nunca sustituye la confirmación manual de Staff
    // con la hora real en que se recibió el depósito (eso se registra
    // aparte al liquidar).
    mutarVentanaPropia(ventana.id, v => {
      v.fechaDeclaracionPago = new Date().toISOString();
      v.montoDeclaradoPago = totalFinal;
      v.piezasDeclaradasPago = piezas.map(p => p.id);
    });
    const descripcionPiezas = pagaTodo
      ? `su apartado completo (${piezas.length} pieza${piezas.length === 1 ? '' : 's'})`
      : `${piezas.length} de ${totalActivas} piezas de su apartado`;
    notificarEquipoOperativo(`${nombrePersona} avisó que ya transfirió el pago de ${descripcionPiezas} ($${totalFinal} MXN)${notaDeposito} — confirma el depósito y liquida en el sistema.`, nombrePersona);
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="confirm-box">
        <div class="check-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>
        </div>
        <h3>¡Listo!</h3>
        <p class="modal-sub">Ya se notificó al equipo, en breve confirmarán tu pago.</p>
        <button class="btn btn-primary" style="width:100%;" data-close>Cerrar</button>
      </div>
    `;
  });
}

function abrirModalPago() {
  const ventana = obtenerVentanaActivaPrincipal();
  if (!ventana) return;
  const piezasActivas = obtenerPiezasActivas(ventana);
  const piezas = piezasActivas.filter(p => seleccionCarrito.has(p.id));
  if (!piezas.length) return;

  const total = piezas.reduce((sum, p) => sum + Number(p.total || 0), 0);
  const esVip = ventana.categoria === 'vip';
  // El depósito respalda TODA la ventana — solo tiene sentido
  // preguntar qué hacer con él cuando este pago la deja sin NINGUNA
  // pieza activa (ver liquidarPiezasSeleccionadas en
  // apartados-modelo.js). Si es una selección parcial del carrito, el
  // depósito sigue intacto y no hay nada que decidir todavía.
  const pagaTodo = piezas.length === piezasActivas.length;

  if (esVip || !ventana.depositoApartadoDisponible || !pagaTodo) {
    mostrarModalPagoConMonto(ventana, piezas, total, esVip ? 'Este apartado es VIP, así que no aplica depósito.' : null, null, pagaTodo);
    return;
  }

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const nombrePersona = ventana.usuarioNombre;
  const montoDeposito = ventana.depositoApartadoDisponible;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Tu depósito</h3>
    <p class="modal-sub">Antes de confirmar el pago, decide qué quieres hacer con tu depósito de $${montoDeposito}.</p>
    <div style="display:grid;gap:12px;">
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="guardar" checked>
        <span><strong>Guardar mi depósito</strong><br><small>Se mantiene como crédito para tu próximo apartado y pago el total completo.</small></span>
      </label>
      <label style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #ddd5e3;border-radius:10px;cursor:pointer;">
        <input type="radio" name="decisionDeposito" value="usar">
        <span><strong>Usarlo en este pago</strong><br><small>Se descuenta $${montoDeposito} de mi cuenta y el resto se liquida normal.</small></span>
      </label>
    </div>
    <button class="btn btn-primary" style="width:100%; margin-top:16px;" id="confirmarDepositoDecisionBtn">Continuar</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarDepositoDecisionBtn').addEventListener('click', () => {
    const decision = document.querySelector('input[name="decisionDeposito"]:checked')?.value || 'guardar';
    const usarDeposito = decision === 'usar';
    const totalFinal = usarDeposito ? Math.max(0, total - montoDeposito) : total;

    if (usarDeposito) {
      notificarEquipoOperativo(`${nombrePersona} decidió usar su depósito de $${montoDeposito} en este pago (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${totalFinal} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(ventana, piezas, totalFinal, `Se descontará tu depósito de $${montoDeposito} y se notificó al equipo.`, 'aplicar', true);
    } else {
      notificarEquipoOperativo(`${nombrePersona} guardará su depósito de $${montoDeposito} como crédito y pagará el total completo de su apartado (${piezas.length} pieza${piezas.length === 1 ? '' : 's'}, $${total} MXN).`, nombrePersona);
      mostrarModalPagoConMonto(ventana, piezas, total, 'Tu depósito quedó guardado como crédito y se notificó al equipo.', 'credito', true);
    }
  });
}

// En vivo: si Staff mueve el apartado (en la página o en BRILLO MW), esta
// vista se actualiza sola, sin recargar.
window.addEventListener('mw:apartados-actualizados', () => {
  if (typeof renderApartados === 'function') renderApartados();
});
