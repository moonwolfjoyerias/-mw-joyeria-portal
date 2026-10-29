// MW JOYERÍA — Catálogo: variantes reales Modelo → Color(piedra) → Talla
//
// Antes cada producto era un registro plano con UN solo colorOro, UNA
// sola talla y UN solo stock — imposible reflejar que "Anillo Corazón"
// existe en Amarillo talla 6 (18 piezas) Y en Blanco talla 7 (5 piezas)
// a la vez. Ahora cada producto ("modelo") tiene un arreglo `variantes`:
// cada elemento es una combinación Color(piedra)+Talla con su propio
// stock — la jerarquía Modelo→Color→Talla que pide la Sección 4.3 del
// documento de requisitos ("cantidad por combinación color+talla").
//
// El color de ORO (laminado) es del PRODUCTO, no de la variante
// (producto.colorOro) — llegan piezas con el mismo laminado pero
// zirconias/piedras de distinto color, y esas sí son variantes reales
// (variante.color, texto libre, sin lista fija). El producto también
// tiene una `galeria` (array de {id, src}) — cada variante puede elegir
// cuál foto de esa galería le corresponde (`variante.fotoId`); sin
// elegir ninguna, se usa la primera foto de la galería.
//
// Productos sin color de piedra relevante (acero, exhibidores,
// souvenirs...) o sin talla (la mayoría fuera de Anillos/Cadenas)
// simplemente guardan color/talla vacíos en su(s) variante(s) — la forma
// es la misma para todos, solo cambia si esos campos están vacíos o no.
//
// Comparten este módulo los 3 controladores de catálogo operativo
// (staff/encargado/admin-catalogo.js — casi copias entre sí, ver sus
// propios encabezados) y los 3 controladores de Apartados (staff/
// encargado/admin-apartados.js), que ahora seleccionan la pieza del
// catálogo real en vez de texto libre, y descuentan/restauran el stock
// de la variante exacta al apartar/cancelar.
//
// FASE 2 (Firebase): el almacenamiento real (Firestore o localStorage,
// colección/clave "productos"/"mw_staff_catalogo_demo") ya no vive
// aquí — ver js/catalogo-firestore-sync.js. La forma de `variantes` no
// cambió: cada elemento ya tiene su propio id estable, listo para ser
// un subdocumento o un campo de mapa en Firestore.

// ============================================================
// VARIANTES — crear / consultar
// ============================================================

function crearVarianteProducto(datos = {}) {
  return {
    id: datos.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    color: datos.color || '', // color de la piedra/zirconia (texto libre) — el color de oro ya no vive aquí, ver producto.colorOro
    talla: datos.talla || '',
    stock: Math.max(0, Math.floor(Number(datos.stock) || 0)),
    fotoId: datos.fotoId || null // referencia a una foto de producto.galeria; null = usa la foto principal del producto
  };
}

// Compatibilidad hacia atrás, migración progresiva (nunca se pierde
// información, nunca se escribe a Firestore aquí — solo en memoria al
// leer; el próximo guardado real de este producto persiste la forma
// nueva completa):
// - colorOro pasa de la variante al producto (si el producto no lo
//   tenía ya, lo toma de la primera variante vieja).
// - galeria (array de fotos) se deriva de la antigua foto única
//   `imagen` si el producto no tenía ya un array de galería.
// - cada variante gana un campo `color` (piedra/zirconia) aunque antes
//   solo tuviera colorOro — colorOro de la variante vieja se deja intacto,
//   sin usarse, por si algo no migrado todavía lo lee.
function migrarProductoAVariantes(producto) {
  const variantesOriginales = Array.isArray(producto.variantes)
    ? producto.variantes
    : [crearVarianteProducto({
        colorOro: producto.colorOro || '',
        talla: producto.talla || '',
        stock: producto.stock || 0
      })];

  const colorOro = producto.colorOro !== undefined && producto.colorOro !== null
    ? producto.colorOro
    : (variantesOriginales[0]?.colorOro || '');

  // Sin fotos dentro del documento, usa la galería ya descargada de
  // productosFotos (ver "FOTOS DE PRODUCTO" abajo), si la hay.
  const embebidas = fotosEmbebidasProducto(producto);
  const galeria = embebidas.length
    ? embebidas
    : (_galeriasProducto.get(String(producto.id)) || (Array.isArray(producto.galeria) ? producto.galeria : []));

  const variantes = variantesOriginales.map(v => ({
    ...v,
    color: v.color !== undefined ? v.color : '',
    fotoId: v.fotoId !== undefined ? v.fotoId : null
  }));

  return { ...producto, colorOro, galeria, variantes };
}

function etiquetaVariante(variante) {
  return [variante.color, variante.talla].filter(Boolean).join(' · ') || 'Única';
}

// ============================================================
// FOTOS DE PRODUCTO — carga bajo demanda
// ============================================================
//
// Cuota de Firestore (la página se quedaba en blanco con "Quota
// exceeded"): las fotos iban dentro de cada documento de `productos`
// (125–550 KB por producto), así que abrir un catálogo descargaba TODAS
// las fotos de TODOS los productos. Ahora viven aparte (ver
// js/catalogo-firestore-sync.js):
//   productosFotos/{id}      → { galeria: [{id, src}] } (tamaño completo)
//   productosMiniaturas/{id} → { src } (foto principal chica, ~20 KB)
// y el producto solo guarda `fotosIds` (los ids de su galería; [] = sin
// fotos).
//
// fotoPrincipalProducto()/fotoVarianteProducto() siguen siendo
// síncronas para no tocar cada pantalla: si la foto todavía no se ha
// descargado regresan una "foto pendiente" (un pixel transparente con el
// id del producto después del #). Un observador de la página detecta
// esas <img>, descarga la foto solo cuando la imagen se ve en pantalla y
// la reemplaza. Las fotos que todavía vengan dentro del producto
// (modo demo, productos aún sin optimizar, o guardados desde BRILLO) se
// usan tal cual, sin descargar nada.

const FOTOS_PRODUCTO_COLECCION = 'productosFotos';
const MINIATURAS_PRODUCTO_COLECCION = 'productosMiniaturas';
const FOTO_PENDIENTE_PREFIJO = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7#mwfoto=';

const _galeriasProducto = new Map();   // id → galería completa tal como está en el servidor
const _miniaturasProducto = new Map(); // id → src de la miniatura ('' = sin foto)
const _descargasFotosProducto = new Map();

// Raíz del sitio, resuelta desde la ubicación de este archivo (js/) —
// así las rutas sirven igual en la raíz y en /portal/<rol>/.
const _RAIZ_SITIO_FOTOS = (() => {
  try { return new URL('../', document.currentScript.src).href; } catch (error) { return ''; }
})();
const _FOTO_GENERICA_PRODUCTO = _RAIZ_SITIO_FOTOS + 'assets/images/isotipo-morado.png';

// Fotos que vienen dentro del propio documento del producto.
function fotosEmbebidasProducto(producto) {
  if (!producto) return [];
  if (Array.isArray(producto.galeria) && producto.galeria.some(f => f && f.src)) return producto.galeria.filter(f => f && f.src);
  if (producto.imagen) return [{ id: 'foto-legado', src: producto.imagen }];
  return [];
}

function _hayFotosEnServidor() {
  return typeof dbFirestore !== 'undefined' && !!dbFirestore;
}

function esFotoPendienteProducto(src) {
  return typeof src === 'string' && src.startsWith(FOTO_PENDIENTE_PREFIJO);
}

function _fotoPendiente(productoId, fotoId, completa) {
  return FOTO_PENDIENTE_PREFIJO + [productoId, fotoId || '', completa ? 'c' : ''].map(encodeURIComponent).join('|');
}

function _leerFotoPendiente(src) {
  const [productoId, fotoId, completa] = src.slice(FOTO_PENDIENTE_PREFIJO.length).split('|').map(decodeURIComponent);
  return { productoId, fotoId: fotoId || null, completa: completa === 'c' };
}

// Primera foto del producto, o '' si no tiene ninguna. Con completa =
// false (lo normal en listas y tarjetas) basta la miniatura.
function fotoPrincipalProducto(producto, completa = false) {
  const embebidas = fotosEmbebidasProducto(producto);
  if (embebidas.length) return embebidas[0].src;
  if (!producto || producto.id === undefined || producto.id === null) return '';
  if (Array.isArray(producto.fotosIds) && !producto.fotosIds.length) return '';
  const id = String(producto.id);
  if (_galeriasProducto.has(id)) return _galeriasProducto.get(id)[0]?.src || '';
  if (!completa && _miniaturasProducto.has(id)) return _miniaturasProducto.get(id);
  if (!_hayFotosEnServidor()) return '';
  return _fotoPendiente(id, null, completa);
}

// Foto asignada a esta variante (por fotoId) si existe en la galería del
// producto; si la variante no tiene foto propia, usa la foto principal.
// Siempre en tamaño completo (la usa el detalle del producto).
function fotoVarianteProducto(producto, variante) {
  const fotoId = variante && variante.fotoId;
  if (!fotoId) return fotoPrincipalProducto(producto, true);
  const embebidas = fotosEmbebidasProducto(producto);
  const galeria = embebidas.length ? embebidas : (_galeriasProducto.get(String(producto.id)) || null);
  if (galeria) return (galeria.find(f => f.id === fotoId) || galeria[0] || {}).src || '';
  if (Array.isArray(producto.fotosIds) && !producto.fotosIds.length) return '';
  if (!_hayFotosEnServidor()) return '';
  return _fotoPendiente(String(producto.id), fotoId, true);
}

function _descargarUnaVez(clave, fn) {
  if (!_descargasFotosProducto.has(clave)) {
    _descargasFotosProducto.set(clave, fn().catch((error) => {
      _descargasFotosProducto.delete(clave); // se puede reintentar después
      throw error;
    }));
  }
  return _descargasFotosProducto.get(clave);
}

// Galería completa de un producto (productosFotos/{id}).
function cargarGaleriaProducto(productoId) {
  const id = String(productoId);
  if (_galeriasProducto.has(id)) return Promise.resolve(_galeriasProducto.get(id));
  if (!_hayFotosEnServidor()) return Promise.resolve([]);
  return _descargarUnaVez('g:' + id, async () => {
    const doc = await dbFirestore.collection(FOTOS_PRODUCTO_COLECCION).doc(id).get();
    const galeria = doc.exists && Array.isArray(doc.data().galeria) ? doc.data().galeria : [];
    _galeriasProducto.set(id, galeria);
    return galeria;
  });
}

// Miniatura de la foto principal (productosMiniaturas/{id}); si no hay,
// usa la galería completa.
function cargarMiniaturaProducto(productoId) {
  const id = String(productoId);
  if (_galeriasProducto.has(id)) return Promise.resolve(_galeriasProducto.get(id)[0]?.src || '');
  if (_miniaturasProducto.has(id)) return Promise.resolve(_miniaturasProducto.get(id));
  if (!_hayFotosEnServidor()) return Promise.resolve('');
  return _descargarUnaVez('m:' + id, async () => {
    const doc = await dbFirestore.collection(MINIATURAS_PRODUCTO_COLECCION).doc(id).get();
    const src = doc.exists && doc.data().src
      ? doc.data().src
      : ((await cargarGaleriaProducto(id))[0]?.src || '');
    _miniaturasProducto.set(id, src);
    return src;
  });
}

// Deja la galería del producto lista en memoria — los formularios de
// edición la esperan antes de abrirse (migrarProductoAVariantes la toma
// de aquí si el producto no trae fotos dentro).
async function prepararFotosProducto(producto) {
  if (!producto || fotosEmbebidasProducto(producto).length) return;
  if (Array.isArray(producto.fotosIds) && !producto.fotosIds.length) return;
  try {
    await cargarGaleriaProducto(producto.id);
  } catch (error) {
    if (typeof mostrarToast === 'function') mostrarToast('No se pudieron cargar las fotos de este producto. Revisa tu conexión.');
    throw error;
  }
}

// Convierte una "foto pendiente" en la foto real ('' si no tiene).
// completa = true pide el tamaño completo aunque la pendiente fuera
// de miniatura (para ampliar la foto).
async function resolverFotoPendienteProducto(src, completa = false) {
  if (!esFotoPendienteProducto(src)) return src;
  const pendiente = _leerFotoPendiente(src);
  const { productoId, fotoId } = pendiente;
  if (!completa && !pendiente.completa && !fotoId) return cargarMiniaturaProducto(productoId);
  const galeria = await cargarGaleriaProducto(productoId);
  return ((fotoId && galeria.find(f => f.id === fotoId)) || galeria[0] || {}).src || '';
}

function _rutaFotoProductoParaImg(src) {
  // Fotos de ejemplo antiguas guardan la ruta relativa a /portal/.
  if (src && src.startsWith('../assets/')) return _RAIZ_SITIO_FOTOS + src.slice(3);
  return src;
}

// Foto real lista para un <img> ('' si el producto no tiene foto).
async function resolverFotoProductoParaImg(src, completa = false) {
  const real = await resolverFotoPendienteProducto(src, completa);
  return real && !/isotipo-morado\.png/.test(real) ? _rutaFotoProductoParaImg(real) : '';
}

async function _pintarFotoPendiente(img) {
  const pendiente = img.getAttribute('src');
  if (!esFotoPendienteProducto(pendiente) || img.dataset.fotoCargando === pendiente) return;
  img.dataset.fotoCargando = pendiente;
  let src = '';
  try { src = await resolverFotoPendienteProducto(pendiente); } catch (error) { src = ''; }
  delete img.dataset.fotoCargando;
  if (img.getAttribute('src') !== pendiente) return; // la pantalla ya cambió esta imagen
  const real = src && !/isotipo-morado\.png/.test(src);
  img.src = real ? _rutaFotoProductoParaImg(src) : _FOTO_GENERICA_PRODUCTO;
  img.classList.toggle('foto-generica', !real);
  // Al ampliar se descarga la foto en tamaño completo (ver abrirImagenEnGrande).
  if (img.hasAttribute('data-zoom') && !real) img.removeAttribute('data-zoom');
}

(function observarFotosPendientes() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const visibles = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entradas) => {
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          visibles.unobserve(e.target);
          _pintarFotoPendiente(e.target);
        });
      }, { rootMargin: '300px' })
    : null;
  const revisar = (img) => {
    if (!esFotoPendienteProducto(img.getAttribute('src'))) return;
    if (visibles) visibles.observe(img); else _pintarFotoPendiente(img);
  };
  const revisarNodo = (nodo) => {
    if (nodo.nodeType !== 1) return;
    if (nodo.tagName === 'IMG') revisar(nodo);
    else nodo.querySelectorAll('img').forEach(revisar);
  };
  new MutationObserver((cambios) => {
    cambios.forEach((c) => {
      if (c.type === 'attributes') revisarNodo(c.target);
      else c.addedNodes.forEach(revisarNodo);
    });
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  document.addEventListener('DOMContentLoaded', () => revisarNodo(document.body));
})();

// fechaAlta (ISO) — cuándo se dio de alta el producto. La usa "Nuevas
// piezas" del Inicio de Emprendedora/Líder (js/novedades-inicio.js) para
// pedirle a Firestore SOLO los productos más recientes en vez del
// catálogo completo. Los productos dados de alta antes de este campo la
// recuperan de su id ('prod-' + Date.now() al crearse) la primera vez
// que Staff/Encargado/Admin abre el Catálogo. Regresa true si cambió
// algo (para guardar una sola vez).
function completarFechaAltaCatalogo(catalogo) {
  let cambio = false;
  catalogo.forEach(p => {
    if (p.fechaAlta) return;
    const marca = /^prod-(\d{12,14})$/.exec(String(p.id || ''));
    if (!marca) return;
    p.fechaAlta = new Date(Number(marca[1])).toISOString();
    cambio = true;
  });
  return cambio;
}

// Orden del catálogo (decisión del equipo): lo más nuevo hasta arriba.
// La fecha de alta es fechaAlta; los productos que no la tienen la
// sacan de su id ('prod-' + la hora en que se crearon, igual en BRILLO).
// Los que no tienen ninguna de las dos (semilla de ejemplo) van al final.
function marcaAltaProducto(producto) {
  const fecha = Date.parse((producto && producto.fechaAlta) || '');
  if (!Number.isNaN(fecha)) return fecha;
  const marca = /^prod-(\d{12,14})/.exec(String((producto && producto.id) || ''));
  return marca ? Number(marca[1]) : 0;
}

// Revisión de oct-2026: en TODOS los catálogos (público, e/l, Staff,
// Encargado, Admin) las piezas agotadas o marcadas como no disponibles van
// al final; dentro de cada grupo, las más recientes primero.
function productoSePuedeVender(producto) {
  return producto.disponible !== false && stockTotalProducto(producto) > 0;
}

function ordenarProductosMasRecientes(productos) {
  return [...productos].sort((a, b) =>
    (productoSePuedeVender(b) - productoSePuedeVender(a)) || (marcaAltaProducto(b) - marcaAltaProducto(a))
  );
}

function stockTotalProducto(producto) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.reduce((suma, v) => suma + (Number(v.stock) || 0), 0);
}

function productoDisponible(producto) {
  return stockTotalProducto(producto) > 0;
}

// Variantes con stock > 0 — lo que debe verse al SELECCIONAR una pieza
// (Apartados, catálogo público): "ocultamiento automático de variantes
// agotadas" (Sección 4.3). Staff sigue viendo todas (agotadas incluidas)
// en su propio catálogo para poder restockear.
function variantesDisponibles(producto) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.filter(v => v.stock > 0);
}

function buscarVariante(producto, varianteId) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.find(v => v.id === varianteId) || null;
}

function precioConDescuento(producto) {
  const precio = Number(producto.precioEtiqueta) || 0;
  const descuento = Number(producto.descuento) || 0;
  return Math.round(precio * (1 - descuento / 100));
}

// ============================================================
// CATÁLOGO COMPLETO (localStorage) — usado por Apartados para
// descontar/restaurar stock sin depender del estado en memoria del
// controlador de Catálogo (pueden ser páginas distintas).
// ============================================================

// FASE 2 (Firebase): delega en js/catalogo-firestore-sync.js — mismo
// contrato síncrono de siempre (lee/escribe un arreglo en memoria), pero
// ese arreglo ahora puede venir de Firestore en vez de localStorage. Ver
// el comentario de cabecera de ese archivo para el porqué del caché.
function obtenerCatalogoStaffStorage() {
  return CATALOGO_CACHE.map(migrarProductoAVariantes);
}

// El código del producto es obligatorio y único en todo el catálogo
// (sin distinguir mayúsculas ni espacios). idExcluir es el producto que
// se está editando, para que no choque consigo mismo.
function productoConCodigo(catalogo, codigo, idExcluir) {
  const normalizado = String(codigo || '').trim().toLowerCase();
  if (!normalizado) return null;
  return catalogo.find(p => p.id !== idExcluir && String(p.codigo || '').trim().toLowerCase() === normalizado) || null;
}

function guardarCatalogoStaffStorage(catalogo) {
  guardarCatalogoRepo(catalogo); // async, sin esperar — mismo patrón "fire and forget" que ya tenía este guardado
}

// LOG-01 de la auditoría: antes esto operaba sobre la copia del
// catálogo en memoria de ESTE dispositivo y guardaba con un
// lectura-modificación-escritura optimista de TODO el arreglo — si dos
// cajas tenían abierta la última pieza de una variante casi al mismo
// tiempo, ambas veían éxito y creaban un apartado, dejando dos
// apartados reclamando la misma unidad física. Con Firestore real, el
// descuento ahora ocurre dentro de una transacción (runTransaction)
// SOLO sobre el documento de ese producto — Firestore reintenta la
// transacción si el documento cambió entre la lectura y la escritura,
// así que de dos intentos casi simultáneos sobre la última pieza, la
// segunda transacción vuelve a leer el stock YA en 0 y falla limpio,
// en vez de que ambas crean que tuvieron éxito.
//
// Ahora es asíncrona (regresa una Promise) — quien llama debe esperarla
// antes de crear la pieza del apartado. En modo local/demo (sin
// Firestore real) no hay otro dispositivo con quien pelear el stock, así
// que se queda con el mismo cálculo síncrono de siempre, solo envuelto
// en una Promise para que el contrato sea igual en ambos casos.

// Descuenta 1 pieza de una variante exacta. Falla explícitamente (sin
// tocar nada) si el producto/variante ya no existe o no tiene stock —
// evita apartar una pieza que en realidad ya no hay.
async function descontarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return { ok: true }; // pieza sin producto real vinculado (dato antiguo) — no hay nada que descontar

  if (dbFirestore) {
    try {
      return await dbFirestore.runTransaction(async tx => {
        const ref = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(String(productoId));
        const doc = await tx.get(ref);
        // El resumen del catálogo (catalogoResumen, ver
        // catalogo-firestore-sync.js) se actualiza en la misma
        // transacción — y también cuando no se pudo apartar, para que
        // quien veía la pieza con existencia vieja (por ejemplo, vendida
        // en BRILLO) ya la vea como es.
        const reflejarEnResumen = (datosProducto) => {
          if (typeof escribirProductoEnResumenDesdeTransaccion === 'function') escribirProductoEnResumenDesdeTransaccion(tx, productoId, datosProducto);
        };
        if (!doc.exists) { reflejarEnResumen(null); return { ok: false, error: 'Ese producto ya no existe en el catálogo.' }; }
        const datos = doc.data();
        const variantes = Array.isArray(datos.variantes) ? datos.variantes : [];
        const indice = variantes.findIndex(v => v.id === varianteId);
        if (indice === -1) { reflejarEnResumen(datos); return { ok: false, error: 'Esa variante ya no existe en el catálogo.' }; }
        const variante = variantes[indice];
        if (!variante.stock || variante.stock <= 0) {
          reflejarEnResumen(datos);
          return { ok: false, error: `Ya no hay existencia de ${datos.nombre} (${etiquetaVariante(variante)}).` };
        }
        const variantesActualizadas = variantes.map((v, i) => i === indice ? { ...v, stock: v.stock - 1 } : v);
        tx.update(ref, { variantes: variantesActualizadas });
        reflejarEnResumen({ ...datos, variantes: variantesActualizadas });
        actualizarVarianteEnCacheLocal(productoId, varianteId, variantesActualizadas.find(v => v.id === varianteId).stock);
        return { ok: true };
      });
    } catch (error) {
      return { ok: false, error: 'No se pudo apartar la pieza: ' + (error && error.message ? error.message : 'error de conexión') + '.' };
    }
  }

  const catalogo = obtenerCatalogoStaffStorage();
  const producto = catalogo.find(p => p.id === productoId);
  if (!producto) return { ok: false, error: 'Ese producto ya no existe en el catálogo.' };
  const variante = producto.variantes.find(v => v.id === varianteId);
  if (!variante) return { ok: false, error: 'Esa variante ya no existe en el catálogo.' };
  if (variante.stock <= 0) return { ok: false, error: `Ya no hay existencia de ${producto.nombre} (${etiquetaVariante(variante)}).` };
  variante.stock -= 1;
  guardarCatalogoStaffStorage(catalogo);
  return { ok: true };
}

// Contraparte de descontarStockVariante — se llama al cancelar/desapartar
// una pieza, para que el inventario no quede perdido para siempre. No
// necesita ser transacción (sumar 1 nunca "sobre-restaura" por una
// carrera entre dispositivos de la misma forma en que restar sí puede
// vender de más), pero igual usa FieldValue-free lectura-escritura
// dentro de una transacción corta para no pisar un descuento concurrente
// de la MISMA variante.
async function restaurarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return;

  if (dbFirestore) {
    try {
      await dbFirestore.runTransaction(async tx => {
        const ref = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(String(productoId));
        const doc = await tx.get(ref);
        if (!doc.exists) return;
        const datos = doc.data();
        const variantes = Array.isArray(datos.variantes) ? datos.variantes : [];
        const indice = variantes.findIndex(v => v.id === varianteId);
        if (indice === -1) return;
        const variantesActualizadas = variantes.map((v, i) => i === indice ? { ...v, stock: (v.stock || 0) + 1 } : v);
        tx.update(ref, { variantes: variantesActualizadas });
        if (typeof escribirProductoEnResumenDesdeTransaccion === 'function') {
          escribirProductoEnResumenDesdeTransaccion(tx, productoId, { ...datos, variantes: variantesActualizadas });
        }
        actualizarVarianteEnCacheLocal(productoId, varianteId, variantesActualizadas.find(v => v.id === varianteId).stock);
      });
    } catch (error) {
      if (typeof mostrarToast === 'function') mostrarToast('No se pudo restaurar la existencia en el catálogo: ' + (error && error.message ? error.message : 'error de conexión') + '.');
    }
    return;
  }

  const catalogo = obtenerCatalogoStaffStorage();
  const producto = catalogo.find(p => p.id === productoId);
  if (!producto) return;
  const variante = producto.variantes.find(v => v.id === varianteId);
  if (!variante) return;
  variante.stock += 1;
  guardarCatalogoStaffStorage(catalogo);
}

// Refleja en CATALOGO_CACHE (el arreglo en memoria que todo lo demás
// sigue leyendo de forma síncrona) el stock que la transacción de
// arriba ya confirmó en el servidor — para no disparar un resync
// completo del catálogo (guardarCatalogoRepo) por un solo número, que
// además podría pisar cambios concurrentes de OTROS productos hechos
// por otro dispositivo entre la transacción y ese resync.
function actualizarVarianteEnCacheLocal(productoId, varianteId, nuevoStock) {
  if (typeof CATALOGO_CACHE === 'undefined') return;
  const producto = CATALOGO_CACHE.find(p => p.id === productoId);
  const variante = producto?.variantes?.find(v => v.id === varianteId);
  if (variante) variante.stock = nuevoStock;
  try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(CATALOGO_CACHE)); } catch (error) { /* noop */ }
}

function escapeHTMLCatalogoVariantes(texto) {
  return escapeHTML(texto);
}

// FEAT-03 pedida tras lanzar a producción: al marcar una solicitud de
// Lista de deseos como "disponible", S/E/A eligen el producto REAL del
// catálogo (en vez de solo texto libre) para que la notificación a la
// Emprendedora/Líder la lleve directo a apartarlo — ver
// js/lista-deseos-modelo.js y js/catalogo.js (?apartar=). Mismo patrón
// que crearAutocompletePersonas (personas-ejemplo.js), solo que busca
// en CATALOGO_CACHE en vez del registro de personas.
function crearAutocompleteProductos({ inputEl, listEl, obtenerCandidatos, onSeleccionar, onLimpiar, limpiarInputAlSeleccionar }) {

  if (!inputEl || !listEl) return;

  inputEl.addEventListener('input', () => {

    const texto = inputEl.value.toLowerCase().trim();

    if (onLimpiar) onLimpiar();

    if (!texto) {
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    const candidatos = obtenerCandidatos(texto).slice(0, 8);

    if (!candidatos.length) {
      listEl.innerHTML = `<div class="persona-autocomplete-empty">Sin coincidencias.</div>`;
      listEl.hidden = false;
      return;
    }

    listEl.innerHTML = candidatos.map(p => `
      <button type="button" class="persona-autocomplete-item" data-producto-id="${p.id}">
        <span>${escapeHTML(p.nombre)}</span>
        <small>${stockTotalProducto(p)} piezas disponibles</small>
      </button>
    `).join('');

    listEl.hidden = false;

    listEl.querySelectorAll('[data-producto-id]').forEach(item => {
      item.addEventListener('click', () => {
        const producto = candidatos.find(p => p.id === item.getAttribute('data-producto-id'));
        if (!producto) return;
        onSeleccionar(producto);
        if (limpiarInputAlSeleccionar) {
          inputEl.value = '';
        } else {
          inputEl.value = producto.nombre;
        }
        listEl.hidden = true;
        listEl.innerHTML = '';
      });
    });

  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.hidden = true;
    }
  });

}
