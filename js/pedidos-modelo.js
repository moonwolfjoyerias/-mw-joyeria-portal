// MW JOYERÍA — Carrito y Pedidos pagados (e/l y Staff/Encargado/Admin)
//
// Dinámica de pedidos (nov 2026):
// 1. La e/l elige piezas en el Catálogo → van a su CARRITO
//    (carritos/{personaId}). No se descuenta existencia ni se avisa a
//    nadie. El carrito se vacía solo al terminar el día.
// 2. Cuando termina de elegir, en Mi pedido escoge:
//    - APARTAR: las piezas pasan a su apartado con las reglas de siempre
//      (depósito, ventana) — ver apartarCarrito en js/apartados.js.
//    - PAGAR: transfiere y sube su comprobante. Las piezas se le guardan
//      (se descuenta la existencia) y nace un pedido en pedidosPagados
//      "Por confirmar". La foto del comprobante vive aparte, en
//      comprobantesPedidos/{id}, para no cargarla en cada lista.
// 3. Staff/Encargado/Admin lo siguen en Pedidos → Pagados (aquí y en
//    BRILLO): Confirmar pago (Encargado/Admin: registra la venta en la
//    "Caja en línea" de BRILLO y cuenta como su compra) o Rechazar
//    (tiene hasta el fin del día para subir otro comprobante; si no,
//    las piezas regresan al catálogo). Después: guardar en bolsita
//    (normal) o empaquetar (foránea) → dejar en la caja de pagados /
//    enviar con guía → entregado.
// Un apartado que se liquida también pasa a Pagados (ya pagado).

const CARRITOS_COLECCION = 'carritos';
const PEDIDOS_PAGADOS_COLECCION = 'pedidosPagados';
const COMPROBANTES_PEDIDOS_COLECCION = 'comprobantesPedidos';

// Estados de un pedido pagado (mismo texto en BRILLO: src/pedidos/pagados.ts).
const ESTADOS_PEDIDO_PAGADO = {
  por_confirmar: { texto: 'Por confirmar pago', clase: 'status-pending' },
  rechazado: { texto: 'Comprobante rechazado', clase: 'status-cancelled' },
  confirmado: { texto: 'Pago confirmado', clase: 'status-active' },
  en_bolsita: { texto: 'En bolsita · caja de pagados', clase: 'status-active' },
  empaquetado: { texto: 'Empaquetado', clase: 'status-active' },
  enviado: { texto: 'Enviado', clase: 'status-active' },
  entregado: { texto: 'Entregado', clase: 'status-closed' },
  vencido: { texto: 'Sin comprobante · piezas liberadas', clase: 'status-closed' },
  cancelado: { texto: 'Cancelado', clase: 'status-closed' }
};
const ESTADOS_PEDIDO_TERMINADOS = ['entregado', 'vencido', 'cancelado'];

// Día de la tienda (San Luis Potosí), 'AAAA-MM-DD'.
function hoyTiendaISO(fecha) {
  try { return new Date(fecha || Date.now()).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' }); }
  catch (e) { return new Date(fecha || Date.now()).toISOString().slice(0, 10); }
}

function _idPedido(prefijo) {
  return `${prefijo}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
}

function _sesionPedidos() {
  return typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
}
function _esInternaPedidos() {
  const s = _sesionPedidos();
  return !!(s && s.tipo === 'interna');
}
function _miPersonaIdPedidos() {
  return (typeof obtenerIdPersonaActualPortal === 'function' && obtenerIdPersonaActualPortal()) || '';
}
function _quienPedidos() {
  const s = _sesionPedidos() || {};
  return { nombre: s.nombre || s.usuarioNombre || s.usuario || 'Equipo MW', rol: s.rol || '', uid: s.uid || '' };
}
function _avisarCambioPedidos(nombre) {
  window.dispatchEvent(new CustomEvent(nombre));
}

// ============================================================
// CARRITO
// ============================================================
let CARRITO_CACHE = { piezas: [], dia: hoyTiendaISO() };
let _carritoCancelar = null;

const carritoRepoListo = (async () => {
  const personaId = _miPersonaIdPedidos();
  if (!personaId || _esInternaPedidos()) return;
  if (typeof dbFirestore === 'undefined' || !dbFirestore) {
    try { CARRITO_CACHE = JSON.parse(localStorage.getItem('mw_carrito_' + personaId)) || CARRITO_CACHE; } catch (e) { /* sin carrito local */ }
    _limpiarCarritoViejo();
    return;
  }
  await new Promise((resolve) => {
    let primera = true;
    _carritoCancelar = dbFirestore.collection(CARRITOS_COLECCION).doc(personaId).onSnapshot((doc) => {
      CARRITO_CACHE = doc.exists ? { piezas: [], ...doc.data() } : { piezas: [], dia: hoyTiendaISO() };
      const vacio = _limpiarCarritoViejo();
      if (vacio && doc.exists) _guardarCarrito(); // se vació por ser de otro día
      if (primera) { primera = false; resolve(); }
      _avisarCambioPedidos('mw:carrito-actualizado');
    }, () => { if (primera) { primera = false; resolve(); } });
  });
})();

// El carrito es del día: si es de otro día, se vacía.
function _limpiarCarritoViejo() {
  const hoy = hoyTiendaISO();
  if (CARRITO_CACHE.dia !== hoy) {
    const habia = (CARRITO_CACHE.piezas || []).length > 0;
    CARRITO_CACHE = { piezas: [], dia: hoy };
    return habia;
  }
  if (!Array.isArray(CARRITO_CACHE.piezas)) CARRITO_CACHE.piezas = [];
  return false;
}

async function _guardarCarrito() {
  const personaId = _miPersonaIdPedidos();
  if (!personaId) return;
  const datos = { personaId, dia: CARRITO_CACHE.dia || hoyTiendaISO(), piezas: CARRITO_CACHE.piezas || [], actualizadoEn: new Date().toISOString() };
  if (typeof dbFirestore === 'undefined' || !dbFirestore) {
    try { localStorage.setItem('mw_carrito_' + personaId, JSON.stringify(datos)); } catch (e) { /* noop */ }
    _avisarCambioPedidos('mw:carrito-actualizado');
    return;
  }
  _avisarCambioPedidos('mw:carrito-actualizado');
  await dbFirestore.collection(CARRITOS_COLECCION).doc(personaId).set(datos);
}

function obtenerCarrito() {
  _limpiarCarritoViejo();
  return CARRITO_CACHE.piezas || [];
}

function cantidadEnCarrito(productoId) {
  return obtenerCarrito().filter(p => p.productoId === productoId).length;
}

// Existencia de una variante según el catálogo cargado.
function _stockVariantePedidos(productoId, varianteId) {
  const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  const p = catalogo.find(x => x.id === productoId);
  const v = p && (p.variantes || []).find(x => x.id === varianteId);
  return { producto: p || null, variante: v || null, stock: v ? Number(v.stock) || 0 : 0 };
}

// Cada pieza del carrito con si todavía se puede (la existencia no se
// guarda mientras está en el carrito: otra persona pudo ganarla).
function piezasCarritoConDisponibilidad() {
  const usados = new Map();
  return obtenerCarrito().map((pieza) => {
    const { producto, stock } = _stockVariantePedidos(pieza.productoId, pieza.varianteId);
    const clave = `${pieza.productoId}|${pieza.varianteId}`;
    const n = (usados.get(clave) || 0) + 1;
    usados.set(clave, n);
    return { ...pieza, disponible: !!producto && n <= stock };
  });
}

function agregarAlCarrito(producto, variante) {
  if (!producto || !variante) return { ok: false, error: 'Elige color y talla.' };
  const enCarrito = obtenerCarrito().filter(p => p.productoId === producto.id && p.varianteId === variante.id).length;
  if (enCarrito >= (Number(variante.stock) || 0)) return { ok: false, error: 'Ya tienes en tu carrito todas las piezas disponibles de esta opción.' };
  const pieza = {
    id: _idPedido('C'),
    productoId: producto.id,
    varianteId: variante.id,
    producto: producto.nombre,
    variante: typeof etiquetaVariante === 'function' ? etiquetaVariante(variante) : '',
    colorOro: producto.colorOro || '',
    material: producto.material || '',
    categoria: producto.categoria || '',
    codigo: producto.codigo || '',
    precioEtiqueta: Number(producto.precioEtiqueta) || 0,
    total: Number(typeof precioConDescuento === 'function' ? precioConDescuento(producto) : producto.precioEtiqueta) || 0,
    agregadoEn: new Date().toISOString()
  };
  CARRITO_CACHE.piezas = [...obtenerCarrito(), pieza];
  CARRITO_CACHE.dia = hoyTiendaISO();
  _guardarCarrito();
  return { ok: true, pieza };
}

function quitarDelCarrito(piezaIds) {
  const ids = new Set([].concat(piezaIds));
  CARRITO_CACHE.piezas = obtenerCarrito().filter(p => !ids.has(p.id));
  return _guardarCarrito();
}

// La última que agregó de ese modelo.
function quitarUnaDelCarrito(productoId) {
  const ultima = obtenerCarrito().filter(p => p.productoId === productoId).pop();
  if (ultima) quitarDelCarrito(ultima.id);
  return ultima || null;
}

// ============================================================
// ENVÍO DE FORÁNEAS (Configuración → Pedidos)
// ============================================================
function costoEnvioForanea() {
  const v = typeof obtenerValorVigente === 'function' ? obtenerValorVigente('pedidos', 'envio_foranea') : undefined;
  return typeof v === 'number' && v >= 0 ? v : null; // null = sin configurar
}
function envioGratisDesde() {
  const v = typeof obtenerValorVigente === 'function' ? obtenerValorVigente('pedidos', 'envio_gratis_desde') : undefined;
  return typeof v === 'number' && v > 0 ? v : 4000;
}
// { envio, gratis, sinConfigurar }
function calcularEnvioPedido(categoria, subtotal) {
  if (categoria !== 'foranea') return { envio: 0, gratis: false, sinConfigurar: false, aplica: false };
  if (subtotal >= envioGratisDesde()) return { envio: 0, gratis: true, sinConfigurar: false, aplica: true };
  const costo = costoEnvioForanea();
  return { envio: costo || 0, gratis: false, sinConfigurar: costo === null, aplica: true };
}

// ============================================================
// PEDIDOS PAGADOS
// ============================================================
let PEDIDOS_PAGADOS_CACHE = [];

const pedidosPagadosRepoListo = (async () => {
  if (typeof dbFirestore === 'undefined' || !dbFirestore) return;
  const sesion = _sesionPedidos();
  if (!sesion) return;
  const interna = sesion.tipo === 'interna';
  const personaId = _miPersonaIdPedidos();
  if (!interna && !personaId) return;
  const consulta = interna
    ? dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION)
    : dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).where('personaId', '==', personaId);
  await new Promise((resolve) => {
    let primera = true;
    consulta.onSnapshot((snap) => {
      PEDIDOS_PAGADOS_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        .sort((a, b) => String(b.creadoEn || '').localeCompare(String(a.creadoEn || '')));
      if (primera) { primera = false; resolve(); }
      _avisarCambioPedidos('mw:pedidos-pagados-actualizados');
      revisarPedidosVencidos();
    }, () => { if (primera) { primera = false; resolve(); } });
  });
})();

function obtenerPedidosPagados() {
  return PEDIDOS_PAGADOS_CACHE;
}

function _historial(estado, nota) {
  const q = _quienPedidos();
  return { estado, por: q.nombre, rol: q.rol, en: new Date().toISOString(), ...(nota ? { nota } : {}) };
}

function _notificarEquipoPedidos(texto, persona) {
  if (typeof agregarNotificacion !== 'function') return;
  const query = persona ? `?pagados=1&buscar=${encodeURIComponent(persona)}` : '?pagados=1';
  agregarNotificacion({ texto, link: `staff-apartados.html${query}`, rolDestino: 'staff', origen: 'emprendedora_lider' });
}
function _notificarPersonaPedido(pedido, texto) {
  if (typeof agregarNotificacion !== 'function' || !pedido.personaId) return;
  agregarNotificacion({ texto, link: 'apartados', paraId: pedido.personaId, rolDestino: 'emprendedora_lider', origen: 'interno' });
}

function _montoTexto(n) {
  return `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 2 })}`;
}

// Comprobante: foto JPEG reducida (data URL) — mismo criterio que las
// fotos de perfil (js/foto-perfil.js): solo JPEG en base64, < 250 KB.
function esComprobanteValido(url) {
  return typeof url === 'string' && url.length < 250000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(url);
}

// Reduce una foto elegida a JPEG de máximo 1400 px, bajando calidad hasta caber.
function prepararFotoComprobante(archivo) {
  return new Promise((resolve, reject) => {
    if (!archivo || !/^image\//.test(archivo.type)) { reject(new Error('Elige una foto (JPG o PNG) de tu comprobante.')); return; }
    const lector = new FileReader();
    lector.onerror = () => reject(new Error('No se pudo leer la foto.'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo abrir la foto.'));
      img.onload = () => {
        let lado = 1400;
        for (let intento = 0; intento < 6; intento++) {
          const escala = Math.min(1, lado / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(img.width * escala));
          c.height = Math.max(1, Math.round(img.height * escala));
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          for (const q of [0.8, 0.65, 0.5]) {
            const url = c.toDataURL('image/jpeg', q);
            if (url.length < 240000) { resolve(url); return; }
          }
          lado = Math.round(lado * 0.75);
        }
        reject(new Error('La foto es demasiado pesada. Prueba con una captura de pantalla.'));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// La e/l paga su carrito: guarda las piezas (descuenta existencia una por
// una — las reglas solo dejan a una e/l tocar un producto a la vez) y
// crea el pedido. Si alguna ya no está, se regresan las que sí se
// guardaron y no se crea nada.
async function crearPedidoPagado({ piezas, fotoUrl, referencia }) {
  const personaId = _miPersonaIdPedidos();
  if (!personaId) return { ok: false, error: 'No se pudo identificar tu cuenta. Vuelve a iniciar sesión.' };
  if (!piezas.length) return { ok: false, error: 'Tu carrito está vacío.' };
  if (!esComprobanteValido(fotoUrl)) return { ok: false, error: 'Sube la foto de tu comprobante.' };
  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(personaId) : null;
  const categoria = persona?.categoria || 'normal';
  const subtotal = Math.round(piezas.reduce((s, p) => s + Number(p.total || 0), 0) * 100) / 100;
  const envio = calcularEnvioPedido(categoria, subtotal);

  const guardadas = [];
  for (const pieza of piezas) {
    const r = typeof descontarStockVariante === 'function' ? await descontarStockVariante(pieza.productoId, pieza.varianteId) : { ok: true };
    if (!r.ok) {
      for (const g of guardadas) if (typeof restaurarStockVariante === 'function') await restaurarStockVariante(g.productoId, g.varianteId);
      return { ok: false, error: `"${pieza.producto}" (${pieza.variante}) ya no está disponible. Quítala de tu carrito e inténtalo otra vez.`, piezaId: pieza.id };
    }
    guardadas.push(pieza);
  }

  const ahora = new Date().toISOString();
  const id = _idPedido('PG');
  const nombre = (typeof obtenerNombrePersonaActualPortal === 'function' && obtenerNombrePersonaActualPortal()) || persona?.nombre || '';
  const pedido = {
    id,
    personaId,
    personaNombre: nombre,
    usuario: persona?.usuario || '',
    tipoPersona: persona?.tipo === 'lider' ? 'lider' : 'emprendedora',
    telefono: persona?.telefono || '',
    categoria,
    origen: 'carrito',
    piezas: piezas.map(p => ({
      id: p.id, productoId: p.productoId, varianteId: p.varianteId, producto: p.producto, variante: p.variante,
      colorOro: p.colorOro || '', material: p.material || '', categoria: p.categoria || '', codigo: p.codigo || '',
      precioEtiqueta: Number(p.precioEtiqueta) || 0, total: Number(p.total) || 0
    })),
    subtotal,
    envio: envio.envio,
    envioGratis: envio.gratis,
    envioPorConfirmar: envio.sinConfigurar,
    total: Math.round((subtotal + envio.envio) * 100) / 100,
    estado: 'por_confirmar',
    comprobante: { referencia: String(referencia || '').trim().slice(0, 60), subidoEn: ahora },
    historial: [{ estado: 'por_confirmar', por: nombre, rol: 'emprendedora_lider', en: ahora }],
    dia: hoyTiendaISO(),
    creadoEn: ahora,
    actualizadoEn: ahora
  };
  try {
    const lote = dbFirestore.batch();
    lote.set(dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(id), pedido);
    lote.set(dbFirestore.collection(COMPROBANTES_PEDIDOS_COLECCION).doc(id), { personaId, fotoUrl, subidoEn: ahora });
    await lote.commit();
  } catch (error) {
    for (const g of guardadas) if (typeof restaurarStockVariante === 'function') await restaurarStockVariante(g.productoId, g.varianteId);
    return { ok: false, error: 'No se pudo enviar tu pago. Revisa tu conexión e inténtalo de nuevo; tus piezas siguen en tu carrito.' };
  }
  await quitarDelCarrito(piezas.map(p => p.id));
  _notificarEquipoPedidos(`${nombre} pagó ${piezas.length} pieza${piezas.length === 1 ? '' : 's'} (${_montoTexto(pedido.total)}) y subió su comprobante — revisa y confirma el pago.`, nombre);
  return { ok: true, pedido };
}

// Comprobante rechazado: la e/l sube otro (hasta el fin del día del rechazo).
async function reenviarComprobantePedido(pedido, { fotoUrl, referencia }) {
  if (pedido.estado !== 'rechazado') return { ok: false, error: 'Este pedido ya no espera comprobante.' };
  if (pedidoRechazoVencido(pedido)) return { ok: false, error: 'Se terminó el plazo para mandar otro comprobante.' };
  if (!esComprobanteValido(fotoUrl)) return { ok: false, error: 'Sube la foto de tu comprobante.' };
  const ahora = new Date().toISOString();
  const nombre = pedido.personaNombre;
  try {
    const lote = dbFirestore.batch();
    lote.set(dbFirestore.collection(COMPROBANTES_PEDIDOS_COLECCION).doc(pedido.id), { personaId: pedido.personaId, fotoUrl, subidoEn: ahora });
    lote.update(dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(pedido.id), {
      estado: 'por_confirmar',
      comprobante: { referencia: String(referencia || '').trim().slice(0, 60), subidoEn: ahora },
      historial: [...(pedido.historial || []), { estado: 'por_confirmar', por: nombre, rol: 'emprendedora_lider', en: ahora, nota: 'Mandó otro comprobante' }],
      actualizadoEn: ahora
    });
    await lote.commit();
  } catch (error) {
    return { ok: false, error: 'No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.' };
  }
  _notificarEquipoPedidos(`${nombre} mandó otro comprobante de pago (${_montoTexto(pedido.total)}) — revisa y confirma.`, nombre);
  return { ok: true };
}

function pedidoRechazoVencido(pedido) {
  if (pedido.estado !== 'rechazado' || !pedido.rechazo) return false;
  return hoyTiendaISO() > (pedido.rechazo.plazo || hoyTiendaISO(pedido.rechazo.en));
}

// Rechazado y sin otro comprobante al terminar el día: las piezas
// regresan al catálogo. Lo hace quien vea el pedido primero (la e/l o el
// equipo); la transacción evita regresarlas dos veces.
let _revisandoVencidos = false;
async function revisarPedidosVencidos() {
  if (_revisandoVencidos || typeof dbFirestore === 'undefined' || !dbFirestore) return;
  const vencidos = PEDIDOS_PAGADOS_CACHE.filter(pedidoRechazoVencido);
  if (!vencidos.length) return;
  _revisandoVencidos = true;
  try {
    for (const p of vencidos) {
      const ref = dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(p.id);
      const ok = await dbFirestore.runTransaction(async (tx) => {
        const d = await tx.get(ref);
        if (!d.exists || d.data().estado !== 'rechazado') return false;
        const ahora = new Date().toISOString();
        tx.update(ref, {
          estado: 'vencido',
          historial: [...(d.data().historial || []), { estado: 'vencido', por: 'Sistema', rol: '', en: ahora, nota: 'No llegó otro comprobante a tiempo' }],
          actualizadoEn: ahora
        });
        return true;
      }).catch(() => false);
      if (ok && typeof restaurarStockVariante === 'function') {
        for (const pieza of p.piezas || []) await restaurarStockVariante(pieza.productoId, pieza.varianteId);
      }
    }
  } finally {
    _revisandoVencidos = false;
  }
}

async function leerComprobantePedido(pedidoId) {
  try {
    const d = await dbFirestore.collection(COMPROBANTES_PEDIDOS_COLECCION).doc(pedidoId).get();
    return d.exists && esComprobanteValido(d.data().fotoUrl) ? d.data().fotoUrl : '';
  } catch (e) {
    return '';
  }
}

// ---------- Equipo: rechazar, avanzar ----------
async function rechazarPagoPedido(pedido, motivo) {
  if (pedido.estado !== 'por_confirmar') return { ok: false, error: 'Este pago ya se revisó.' };
  const ahora = new Date().toISOString();
  const q = _quienPedidos();
  const rechazo = { motivo: String(motivo || '').trim().slice(0, 200) || 'El comprobante no es válido', por: q.nombre, en: ahora, plazo: hoyTiendaISO() };
  try {
    await dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(pedido.id).update({
      estado: 'rechazado', rechazo, historial: [...(pedido.historial || []), _historial('rechazado', rechazo.motivo)], actualizadoEn: ahora
    });
  } catch (e) {
    return { ok: false, error: 'No se pudo guardar. Revisa tu conexión.' };
  }
  _notificarPersonaPedido(pedido, `Tu comprobante de pago (${_montoTexto(pedido.total)}) no se pudo validar: ${rechazo.motivo}. Sube otro hoy antes de las 11:59 p.m. o tus piezas regresarán al catálogo.`);
  return { ok: true };
}

// Pasos después de confirmar el pago.
const PASOS_PEDIDO_PAGADO = {
  en_bolsita: { desde: ['confirmado'], soloCategoria: 'no_foranea', boton: 'Guardar en bolsita', aviso: 'Tu pedido pagado ya está en tu bolsita, en la caja de pagados del local. ¡Pasa por él cuando quieras!' },
  empaquetado: { desde: ['confirmado'], soloCategoria: 'foranea', boton: 'Empaquetar', aviso: null },
  enviado: { desde: ['empaquetado'], soloCategoria: 'foranea', boton: 'Marcar enviado', aviso: null },
  entregado: { desde: ['en_bolsita', 'enviado'], boton: 'Ya se entregó', aviso: null }
};

function pasosDisponiblesPedido(pedido) {
  const foranea = pedido.categoria === 'foranea';
  return Object.entries(PASOS_PEDIDO_PAGADO)
    .filter(([, paso]) => paso.desde.includes(pedido.estado))
    .filter(([, paso]) => !paso.soloCategoria || (paso.soloCategoria === 'foranea') === foranea)
    .map(([estado, paso]) => ({ estado, ...paso }));
}

async function avanzarPedidoPagado(pedido, estado, datos = {}) {
  const paso = PASOS_PEDIDO_PAGADO[estado];
  if (!paso || !paso.desde.includes(pedido.estado)) return { ok: false, error: 'Ese paso ya no aplica a este pedido.' };
  const ahora = new Date().toISOString();
  const cambios = { estado, actualizadoEn: ahora };
  let nota = '';
  if (estado === 'enviado') {
    const paqueteria = String(datos.paqueteria || '').trim().slice(0, 40);
    const guia = String(datos.guia || '').trim().slice(0, 60);
    if (!guia) return { ok: false, error: 'Escribe el número de guía.' };
    cambios.envioInfo = { paqueteria, guia, en: ahora, por: _quienPedidos().nombre };
    nota = `${paqueteria} ${guia}`.trim();
  }
  cambios.historial = [...(pedido.historial || []), _historial(estado, nota)];
  try {
    await dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(pedido.id).update(cambios);
  } catch (e) {
    return { ok: false, error: 'No se pudo guardar. Revisa tu conexión.' };
  }
  if (estado === 'en_bolsita') _notificarPersonaPedido(pedido, paso.aviso);
  if (estado === 'enviado') _notificarPersonaPedido(pedido, `¡Tu pedido va en camino! ${cambios.envioInfo.paqueteria ? cambios.envioInfo.paqueteria + ', ' : ''}guía ${cambios.envioInfo.guia}.`);
  return { ok: true };
}

// ---------- Confirmar pago: venta en la "Caja en línea" de BRILLO ----------
// Mismo documento que arma BRILLO (src/pedidos/ventaEnLinea.ts):
// brilloVentas/{folio} con caja 'en_linea', folio y orden de la tienda
// (brilloContadores), su compra para Plan MW (comprasBrillo/vt__folio) y
// el ticket en su historial (brilloTicketsPersona). La existencia ya se
// descontó cuando subió el comprobante.
const IVA_TASA_PEDIDOS = 0.16;
const OPERACION_VENTA_PEDIDOS = 200;
const r2Pedidos = n => Math.round(Number(n || 0) * 100) / 100;

function lineasVentaPedido(pedido) {
  const lineas = (pedido.piezas || []).map((p) => {
    const precioEtiqueta = Number(p.precioEtiqueta) || Number(p.total) || 0;
    const precio = Number(p.total) || 0;
    return {
      productoId: p.productoId || null, varianteId: p.varianteId || null,
      descripcion: [p.producto, p.variante].filter(Boolean).join(' '), nombre: p.producto || '',
      categoria: p.categoria || '', colorOro: p.colorOro || '', variante: p.variante || '', codigo: p.codigo || '',
      material: p.material || '', cantidad: 1, precioEtiqueta,
      descuentoAplicado: precioEtiqueta > 0 ? Math.round((1 - precio / precioEtiqueta) * 100) : 0,
      precioUnitario: precio, importe: precio, esServicio: false
    };
  });
  if (Number(pedido.envio) > 0) {
    lineas.push({
      productoId: null, varianteId: null, descripcion: 'Envío (paquetería)', nombre: 'Envío', categoria: '', colorOro: '', variante: '',
      codigo: '', material: '', cantidad: 1, precioEtiqueta: Number(pedido.envio), descuentoAplicado: 0,
      precioUnitario: Number(pedido.envio), importe: Number(pedido.envio), esServicio: true, tipoServicio: 'envio'
    });
  }
  return lineas;
}

function totalesVentaPedido(lineas) {
  const total = r2Pedidos(lineas.reduce((s, l) => s + l.importe, 0));
  const totalEtiqueta = r2Pedidos(lineas.reduce((s, l) => s + l.precioEtiqueta * l.cantidad, 0));
  const baseSinIva = r2Pedidos(total / (1 + IVA_TASA_PEDIDOS));
  return {
    piezas: lineas.filter(l => !l.esServicio).reduce((s, l) => s + l.cantidad, 0),
    totalEtiqueta, total, descuentoMayoreo: r2Pedidos(totalEtiqueta - total),
    baseSinIva, iva: r2Pedidos(total - baseSinIva),
    totalSouvenirs: r2Pedidos(lineas.filter(l => l.material === 'souvenirs').reduce((s, l) => s + l.importe, 0))
  };
}

// Lo que cuenta como su compra (Plan MW, recompensas): piezas, sin envío.
function compraDeVentaPedido(lineas) {
  let normal = 0;
  let souvenir = 0;
  lineas.forEach((l) => {
    if (l.esServicio) return;
    if (l.material === 'souvenirs') souvenir += l.importe; else normal += l.importe;
  });
  return { normal: r2Pedidos(normal), souvenir: r2Pedidos(souvenir) };
}

function puedeConfirmarPagos() {
  const s = _sesionPedidos();
  return !!(s && s.tipo === 'interna' && ['encargado', 'admin'].includes(s.rol));
}

async function confirmarPagoPedido(pedido, { referencia } = {}) {
  if (!puedeConfirmarPagos()) return { ok: false, error: 'Solo Encargado y Administración confirman pagos (registran la venta).' };
  if (pedido.estado !== 'por_confirmar') return { ok: false, error: 'Este pago ya se revisó.' };
  const q = _quienPedidos();
  const ref = String(referencia ?? pedido.comprobante?.referencia ?? '').trim();
  const refNorm = ref.replace(/\s+/g, '').toUpperCase();
  const fechaDia = hoyTiendaISO();
  const lineas = lineasVentaPedido(pedido);
  const totales = totalesVentaPedido(lineas);
  const pedidoRef = dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(pedido.id);
  const recibosRef = dbFirestore.collection('brilloContadores').doc('recibos');
  const ordenesRef = dbFirestore.collection('brilloContadores').doc('ordenes');
  const indiceRef = dbFirestore.collection('brilloTicketsPersona').doc(`${pedido.personaId}__${fechaDia.slice(0, 7)}`);
  const refPagoRef = refNorm ? dbFirestore.collection('brilloReferenciasPago').doc(`transferencia_${refNorm}`) : null;
  try {
    const venta = await dbFirestore.runTransaction(async (tx) => {
      const actual = await tx.get(pedidoRef);
      const recibos = await tx.get(recibosRef);
      const ordenes = await tx.get(ordenesRef);
      const indice = await tx.get(indiceRef);
      const usada = refPagoRef ? await tx.get(refPagoRef) : null;
      if (!actual.exists || actual.data().estado !== 'por_confirmar') throw new Error('YA_REVISADO');
      if (usada && usada.exists) throw new Error('REF_USADA:' + (usada.data().folio || '?'));
      const numero = Number(recibos.exists ? recibos.data().siguiente : 1) || 1;
      const orden = Number(ordenes.exists ? ordenes.data().siguiente : 1) || 1;
      const folio = `${fechaDia.slice(2, 4)}-${OPERACION_VENTA_PEDIDOS}-${String(numero).padStart(6, '0')}`;
      const ahora = new Date().toISOString();
      const v = {
        id: folio, folio, orden, caja: 'en_linea', turnoId: 'en_linea', fechaDia, fechaLocal: ahora,
        cliente: { tipo: pedido.tipoPersona === 'lider' ? 'lider' : 'emprendedora', personaId: pedido.personaId, nombre: pedido.personaNombre, membresia: pedido.usuario || null },
        lineas, totales,
        pagos: [{ metodo: 'transferencia', monto: totales.total, ...(refNorm ? { referencia: refNorm } : {}) }],
        recibido: totales.total, cambio: 0,
        cobradoPor: { uid: q.uid, nombre: q.nombre, rol: q.rol },
        equipo: 'Página', estado: 'completada', origen: 'en_linea', pedidoId: pedido.id,
        comentarios: `Pedido en línea ${pedido.id}`
      };
      tx.set(dbFirestore.collection('brilloVentas').doc(folio), { ...v, fecha: firebase.firestore.FieldValue.serverTimestamp() });
      tx.set(recibosRef, { siguiente: numero + 1 }, { merge: true });
      tx.set(ordenesRef, { siguiente: orden + 1 }, { merge: true });
      const compra = compraDeVentaPedido(lineas);
      if (compra.normal + compra.souvenir > 0) {
        tx.set(dbFirestore.collection('comprasBrillo').doc(`vt__${folio}`), {
          tipo: 'venta', folio, personaId: pedido.personaId, personaNombre: pedido.personaNombre, ...compra,
          estado: 'confirmada', fechaCuenta: ahora, origen: 'brillo', por: q.nombre, porRol: q.rol, en: ahora
        });
      }
      const previos = indice.exists ? (indice.data().tickets || []) : [];
      tx.set(indiceRef, {
        personaId: pedido.personaId, mes: fechaDia.slice(0, 7),
        tickets: [...previos, {
          folio, fechaDia, fechaLocal: ahora, total: totales.total, estado: 'completada',
          piezas: lineas.map(l => ({ productoId: l.productoId, codigo: l.codigo, nombre: l.nombre, variante: l.variante, cantidad: l.cantidad, importe: l.importe })),
          cambioFisico: 0, garantias: []
        }]
      });
      if (refPagoRef) tx.set(refPagoRef, { metodo: 'transferencia', referencia: refNorm, monto: totales.total, folio, fechaDia, fecha: firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(pedidoRef, {
        estado: 'confirmado',
        venta: { folio, en: ahora, por: q.nombre },
        historial: [...(actual.data().historial || []), { estado: 'confirmado', por: q.nombre, rol: q.rol, en: ahora, nota: `Venta ${folio} · Caja en línea` }],
        actualizadoEn: ahora
      });
      return v;
    });
    _notificarPersonaPedido(pedido, `¡Tu pago de ${_montoTexto(pedido.total)} quedó confirmado! Ticket ${venta.folio}. ${pedido.categoria === 'foranea' ? 'Te avisamos cuando tu paquete vaya en camino.' : 'Te avisamos cuando esté en tu bolsita, en la caja de pagados.'}`);
    return { ok: true, venta };
  } catch (error) {
    const m = String(error && error.message || '');
    if (m === 'YA_REVISADO') return { ok: false, error: 'Este pago ya se revisó (quizá desde BRILLO). Recarga la lista.' };
    if (m.startsWith('REF_USADA:')) return { ok: false, error: `Esa referencia de transferencia ya se registró antes (folio ${m.split(':')[1]}). Revisa el comprobante.` };
    return { ok: false, error: 'No se pudo confirmar el pago. Revisa tu conexión e inténtalo otra vez.' };
  }
}

// ---------- Apartado liquidado → Pagados ----------
// Las piezas ya se pagaron en el apartado (y ya cuentan como compra): el
// pedido nace confirmado y sigue los pasos de bolsita/empaque y entrega.
async function crearPagadoDesdeApartado(ventana, piezas) {
  if (!piezas || !piezas.length || typeof dbFirestore === 'undefined' || !dbFirestore) return;
  const persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(ventana.usuarioId) : null;
  const categoria = ventana.categoria === 'foranea' ? 'foranea' : (persona?.categoria === 'foranea' ? 'foranea' : 'normal');
  const ahora = new Date().toISOString();
  const id = `PA-${ventana.id}-${piezas.map(p => p.id).join('').slice(-12)}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  const q = _quienPedidos();
  const subtotal = r2Pedidos(piezas.reduce((s, p) => s + Number(p.total || 0), 0));
  const pedido = {
    id, personaId: ventana.usuarioId, personaNombre: ventana.usuarioNombre || '', usuario: persona?.usuario || '',
    tipoPersona: persona?.tipo === 'lider' ? 'lider' : 'emprendedora', telefono: ventana.telefono || persona?.telefono || '',
    categoria, origen: 'apartado', ventanaId: ventana.id,
    piezas: piezas.map(p => ({ id: p.id, productoId: p.productoId || null, varianteId: p.varianteId || null, producto: p.producto || '', variante: p.variante || '', colorOro: p.colorOro || '', material: p.material || '', precioEtiqueta: Number(p.precioEtiqueta) || 0, total: Number(p.total) || 0 })),
    subtotal, envio: 0, envioGratis: false, total: subtotal,
    // Para pagar un apartado las piezas ya debían estar en su bolsita.
    estado: categoria === 'foranea' ? 'confirmado' : 'en_bolsita',
    historial: [{ estado: 'confirmado', por: q.nombre, rol: q.rol, en: ahora, nota: `Apartado ${ventana.id} liquidado` }],
    dia: hoyTiendaISO(), creadoEn: ahora, actualizadoEn: ahora
  };
  try {
    await dbFirestore.collection(PEDIDOS_PAGADOS_COLECCION).doc(id).set(pedido);
  } catch (e) { /* si falla, el apartado ya quedó liquidado igual */ }
}
