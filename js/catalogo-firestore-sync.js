// MW JOYERÍA — Repositorio de Catálogo (Fase 2: Firebase)
//
// Punto único de lectura/escritura para TODO lo que hoy comparte la
// clave localStorage "mw_staff_catalogo_demo": el catálogo de mayoreo
// público (catalogo.js), las 3 páginas de gestión
// (staff/encargado/admin-catalogo.js) y el descuento/restauración de
// stock que usa Apartados (obtenerCatalogoStaffStorage/
// guardarCatalogoStaffStorage en catalogo-variantes-modelo.js).
//
// Se carga DESPUÉS de js/firebase-init.js y del *-catalogo-ejemplo.js
// de cada página (para tener la semilla de respaldo si hace falta) y
// ANTES de catalogo-variantes-modelo.js y de cualquier controlador de
// catálogo — ver el <script> de cada página.
//
// Los consumidores siguen leyendo de forma SÍNCRONA (misma API de
// siempre) contra `CATALOGO_CACHE`, un arreglo en memoria que este
// archivo llena de forma asíncrona apenas se carga (desde Firestore si
// hay config real, si no desde localStorage igual que siempre). Cada
// página espera una vez la promesa `catalogoRepoListo` antes de su
// primer render — igual que ya hace solicitudes-modelo.js con sus
// consultas — así nunca se pinta con el arreglo todavía vacío.
//
// Nota (DUP-01 y DUP-02 de la auditoría, ya corregidos): llegó a haber
// DOS semillas distintas con el mismo nombre CATALOGO_EJEMPLO —catalogo-
// productos-ejemplo.js (catálogo público, forma antigua sin variantes)
// y staff-catalogo-ejemplo.js (gestión Staff/Encargado/Admin, ya en
// forma de variantes)— y admin-portal.html era la única página que
// todavía cargaba la antigua, con su propio conteo leído directo de
// localStorage en vez de esperar a `catalogoRepoListo`. Ahora las 11
// páginas que usan catálogo cargan la MISMA semilla
// (staff-catalogo-ejemplo.js) antes de este archivo, así que si
// Firestore arranca vacío, cualquiera que sea la primera página
// visitada siembra la colección "productos" con la misma forma.
// catalogo-productos-ejemplo.js se eliminó del proyecto al quedar sin
// ninguna página que lo cargara.

const CATALOGO_STORAGE_KEY = 'mw_staff_catalogo_demo';
const CATALOGO_COLECCION_FIRESTORE = 'productos';
const CATALOGO_META_COLECCION = 'catalogoMeta';
const CATALOGO_META_DOC_ID = 'estado';

// Resumen del catálogo (ver "RESUMEN DEL CATÁLOGO" abajo).
const CATALOGO_RESUMEN_COLECCION = 'catalogoResumen';
const CATALOGO_RESUMEN_META_DOC_ID = 'resumen';
const CATALOGO_RESUMEN_PARTES_MIN = 10;
const CATALOGO_RESUMEN_BYTES_POR_PARTE = 400000; // cada documento de Firestore admite ~1 MB

// Campos de foto: nunca van en `productos` ni en el resumen — las fotos
// viven en productosFotos/productosMiniaturas (ver "FOTOS DE PRODUCTO"
// en js/catalogo-variantes-modelo.js). `fotosEditadas` lo pone el
// formulario de producto cuando se guardó la galería.
const CAMPOS_FOTO_PRODUCTO = ['galeria', 'imagen', 'fotosEditadas'];
const MINIATURA_LADO_MAX = 360; // px
const MINIATURA_CALIDAD = 0.7;

let CATALOGO_CACHE = [];

// Opción A acordada para convivir con BRILLO MW (el sistema de caja e
// inventario, repositorio brillomw), que también agrega y edita
// productos en esta misma colección: esta página ya NO reescribe el
// catálogo completo en cada guardado. Recuerda cómo estaba cada producto
// en el servidor la última vez que lo leyó o lo guardó (aquí, como texto
// con las claves ordenadas) y en cada guardado:
// - escribe SOLO los productos que cambiaron en esta página;
// - borra SOLO los que esta página tenía y ya no están (eliminados aquí);
// - NUNCA toca un producto que no conoce (por ejemplo, uno que BRILLO
//   agregó después de que se abrió esta página).
// Así un guardado de aquí no deshace ni borra lo que se hizo en BRILLO.
let _catalogoEnServidor = new Map();

// fotosIds de cada producto según el servidor — el resto de la página
// trabaja con copias que pueden no traerlo (ver productoLigero).
const _fotosIdsEnServidor = new Map();

// { partes, generadoEn } si el resumen del catálogo ya existe.
let _resumenCatalogo = null;
// Productos que vienen en el resumen que leyó esta página.
let _idsEnResumen = new Set();

function _hayFuncionesFotos() {
  return typeof _galeriasProducto !== 'undefined';
}

// El producto tal como se guarda en `productos` y en el resumen: sin
// fotos, con los ids de su galería.
function productoLigero(producto) {
  const ligero = {};
  Object.keys(producto).forEach((campo) => {
    if (!CAMPOS_FOTO_PRODUCTO.includes(campo) && producto[campo] !== undefined) ligero[campo] = producto[campo];
  });
  const id = String(producto.id);
  if (producto.fotosEditadas && Array.isArray(producto.galeria)) ligero.fotosIds = producto.galeria.map(f => f.id);
  else if (_fotosIdsEnServidor.has(id)) ligero.fotosIds = _fotosIdsEnServidor.get(id);
  return ligero;
}

function _recordarCatalogoEnServidor(productos) {
  productos.forEach((p) => {
    const id = String(p.id);
    if (Array.isArray(p.fotosIds)) _fotosIdsEnServidor.set(id, p.fotosIds);
    // Fotos que todavía vienen dentro del documento: ya están en memoria.
    if (_hayFuncionesFotos() && !_galeriasProducto.has(id)) {
      const embebidas = fotosEmbebidasProducto(p);
      if (embebidas.length) _galeriasProducto.set(id, embebidas);
    }
  });
  _catalogoEnServidor = new Map(productos.map(p => [String(p.id), textoEstableFirestore(productoLigero(p))]));
}

function catalogoSemillaLocal() {
  return (typeof CATALOGO_EJEMPLO !== 'undefined' ? CATALOGO_EJEMPLO : []).map(p => ({ ...p }));
}

function catalogoDesdeLocalStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CATALOGO_STORAGE_KEY));
    if (Array.isArray(guardado)) return guardado;
  } catch (error) {
    // sigue abajo
  }
  return catalogoSemillaLocal();
}

// Revisión de cuota de Firestore: "Mis apartados" de Emprendedora/Líder
// solo usa el catálogo para la foto/material de SUS piezas apartadas —
// antes leía el catálogo completo (con 3,000 piezas, 3,000 lecturas por
// visita). Ahí se leen solo esos productos, uno por uno. En cualquier
// otra página regresa null y se carga el catálogo completo como siempre.
async function _productosDeMisApartados() {
  if (!/\/portal\/(emprendedora|lider)\/(emprendedora|lider)-apartados\.html$/.test(window.location.pathname)) return null;
  if (typeof apartadosRepoListo === 'undefined' || typeof obtenerVentanasApartado !== 'function') return null;
  await apartadosRepoListo;
  // En una pestaña nueva la sesión llega un momento después de cargar.
  const inicio = Date.now();
  while (!(typeof obtenerSesionActiva === 'function' && obtenerSesionActiva()) && Date.now() - inicio < 15000) {
    await new Promise(r => setTimeout(r, 150));
  }
  const miId = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const ids = new Set();
  obtenerVentanasApartado()
    .filter(v => v.usuarioId === miId)
    .forEach(v => (v.apartados || []).forEach(p => { if (p.productoId) ids.add(String(p.productoId)); }));
  const docs = await Promise.all([...ids].map(id => dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(id).get()));
  return docs.filter(d => d.exists).map(d => ({ ...d.data(), id: d.id }));
}

// Catálogo de Staff/Encargado/Admin: ahí sí se lee la colección completa
// (para editarla) y, de paso, se mantiene al día el resumen.
function _esPaginaGestionCatalogo() {
  return /\/portal\/(admin|encargado|staff)\/(admin|encargado|staff)-catalogo\.html$/.test(window.location.pathname);
}

async function _leerCatalogoCompleto() {
  const snap = await dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).get();
  if (!snap.empty) return snap.docs.map(d => ({ ...d.data(), id: d.id }));
  // Colección vacía: puede ser la primera vez que este proyecto de
  // Firestore recibe catálogo, O alguien borró todo a propósito.
  // catalogoMeta/estado distingue los dos casos — solo se siembra
  // si ese marcador nunca se ha creado.
  const meta = await dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_META_DOC_ID).get();
  if (meta.exists) return [];
  const semilla = catalogoSemillaLocal();
  await guardarCatalogoRepo(semilla);
  return semilla;
}

async function cargarCatalogoRepo() {
  if (dbFirestore) {
    try {
      const soloSusPiezas = await _productosDeMisApartados();
      if (soloSusPiezas) {
        CATALOGO_CACHE = soloSusPiezas;
        _recordarCatalogoEnServidor(CATALOGO_CACHE);
        return CATALOGO_CACHE;
      }
      if (_esPaginaGestionCatalogo()) {
        const inicioLectura = new Date().toISOString();
        CATALOGO_CACHE = await _leerCatalogoCompleto();
        _recordarCatalogoEnServidor(CATALOGO_CACHE);
        // Sin esperar: la página se pinta ya; esto corre detrás.
        _optimizarCatalogoEnServidor(inicioLectura);
        return CATALOGO_CACHE;
      }
      const resumen = await _leerMetaResumenCatalogo();
      if (resumen) {
        _resumenCatalogo = resumen;
        CATALOGO_CACHE = await _leerCatalogoDesdeResumen(resumen);
      } else {
        // Todavía no hay resumen (nadie de Staff/Encargado/Admin ha
        // abierto su Catálogo desde este cambio): lectura completa.
        CATALOGO_CACHE = await _leerCatalogoCompleto();
      }
      _recordarCatalogoEnServidor(CATALOGO_CACHE);
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar productos ya eliminados en otro
      // dispositivo (mismo problema ya corregido en cuentas-firestore-
      // sync.js / personas-firestore-sync.js / apartados-firestore-
      // sync.js). Se avisa y se deja vacío en vez de mostrar datos que
      // podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar el catálogo desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      CATALOGO_CACHE = [];
    }
  } else {
    CATALOGO_CACHE = catalogoDesdeLocalStorage();
    try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(CATALOGO_CACHE)); } catch (error) { /* noop */ }
  }
  return CATALOGO_CACHE;
}

// ============================================================
// RESUMEN DEL CATÁLOGO
// ============================================================
//
// Cuota de Firestore: leer `productos` completo cuesta una lectura por
// producto (con miles de piezas, miles de lecturas en CADA visita al
// catálogo). El resumen guarda todos los productos (ya sin fotos)
// repartidos en unos pocos documentos — catalogoResumen/p0, p1, … — así
// que abrir el catálogo cuesta ~12 lecturas sin importar cuántas piezas
// haya. catalogoMeta/resumen dice en cuántas partes está y desde cuándo.
//
// Quién lo mantiene al día:
// - cada guardado de esta página (sincronizarCatalogoConFirestore);
// - cada apartado/cancelación (descontar/restaurarStockVariante, en la
//   misma transacción que la existencia);
// - el Catálogo de Staff/Encargado/Admin, que al abrirse lee
//   `productos` completo y corrige el resumen (_optimizarCatalogoEnServidor).
// BRILLO todavía escribe solo en `productos`: lo que agrega o edita
// (trae ultimaAccion.fecha) se suma al leer con una consulta de "lo
// nuevo desde generadoEn"; lo que vende o elimina se refleja la próxima
// vez que alguien abre el Catálogo de Staff/Encargado/Admin.

function parteResumenCatalogo(productoId, partes) {
  const texto = String(productoId);
  let hash = 0;
  for (let i = 0; i < texto.length; i++) hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  return 'p' + (hash % (partes || _resumenCatalogo.partes));
}

function _rutaEnResumen(...campos) {
  return new firebase.firestore.FieldPath('productos', ...campos);
}

async function _leerMetaResumenCatalogo() {
  const doc = await dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_RESUMEN_META_DOC_ID).get();
  return doc.exists && doc.data().partes ? doc.data() : null;
}

async function _leerCatalogoDesdeResumen(resumen) {
  const partes = Array.from({ length: resumen.partes }, (_, i) => 'p' + i);
  const docs = await Promise.all(partes.map(p => dbFirestore.collection(CATALOGO_RESUMEN_COLECCION).doc(p).get()));
  const porId = new Map();
  docs.forEach((doc) => {
    if (!doc.exists) return;
    Object.entries(doc.data().productos || {}).forEach(([id, p]) => porId.set(id, { ...p, id }));
  });
  _idsEnResumen = new Set(porId.keys());
  // Lo agregado/editado (por ejemplo desde BRILLO) después de armar el resumen.
  if (resumen.generadoEn) {
    try {
      const snap = await dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE)
        .where('ultimaAccion.fecha', '>', resumen.generadoEn).get();
      snap.docs.forEach(d => porId.set(d.id, { ...d.data(), id: d.id }));
    } catch (error) {
      // Sin esa consulta se muestra el resumen tal cual.
    }
  }
  // Mismo orden que daba la colección completa (por id).
  return [...porId.values()].sort((a, b) => (String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0));
}

// Escribe (o borra, con ligero = null) un producto en su parte del resumen.
function _escribirEnResumen(lote, id, ligero) {
  if (!_resumenCatalogo) return;
  const ref = dbFirestore.collection(CATALOGO_RESUMEN_COLECCION).doc(parteResumenCatalogo(id));
  const valor = ligero === null ? firebase.firestore.FieldValue.delete() : ligero;
  lote.set(ref, { productos: { [id]: valor } }, { mergeFields: [_rutaEnResumen(id)] });
}

// Dentro de la transacción de existencia (descontar/restaurarStockVariante):
// refleja en el resumen el producto tal como quedó. Staff/Encargado/Admin
// escriben el producto completo; Emprendedora/Líder solo pueden tocar
// `variantes` de un producto que ya esté en el resumen (ver reglas de
// catalogoResumen en firestore.rules).
function escribirProductoEnResumenDesdeTransaccion(tx, productoId, datosProducto) {
  if (!_resumenCatalogo) return;
  const id = String(productoId);
  const ref = dbFirestore.collection(CATALOGO_RESUMEN_COLECCION).doc(parteResumenCatalogo(id));
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.tipo === 'interna') {
    const valor = datosProducto ? productoLigero({ ...datosProducto, id }) : firebase.firestore.FieldValue.delete();
    tx.set(ref, { productos: { [id]: valor } }, { mergeFields: [_rutaEnResumen(id)] });
    return;
  }
  if (!datosProducto || !_idsEnResumen.has(id)) return;
  tx.set(ref, { productos: { [id]: { variantes: datosProducto.variantes } }, ultimoCambio: id },
    { mergeFields: [_rutaEnResumen(id, 'variantes'), 'ultimoCambio'] });
}

// Miniatura (JPEG chico) de una foto en data URL. '' si no se pudo.
function _miniaturaDeFoto(src) {
  if (!src) return Promise.resolve('');
  if (!src.startsWith('data:')) return Promise.resolve(src); // ruta (fotos de ejemplo): ya es ligera
  return new Promise((resolve) => {
    const img = new Image();
    img.onerror = () => resolve('');
    img.onload = () => {
      const escala = Math.min(1, MINIATURA_LADO_MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * escala));
      canvas.height = Math.max(1, Math.round(img.height * escala));
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      try { resolve(canvas.toDataURL('image/jpeg', MINIATURA_CALIDAD)); } catch (error) { resolve(''); }
    };
    img.src = src;
  });
}

// Lotes de escritura que no pasen del tamaño que acepta Firestore por envío.
function _crearLotesPorTamano() {
  const lotes = [];
  let actual = null;
  return {
    agregar(bytes, fn) {
      if (!actual || actual.ops >= 400 || actual.bytes + bytes > 3000000) {
        actual = { lote: dbFirestore.batch(), ops: 0, bytes: 0, alConfirmar: [] };
        lotes.push(actual);
      }
      actual.ops += fn(actual.lote);
      actual.bytes += bytes;
      return actual;
    },
    lotes
  };
}

// Corre al abrir el Catálogo de Staff/Encargado/Admin (cuenta interna,
// que es quien puede escribir fotos y resumen):
// 1. Saca las fotos que todavía vengan dentro de `productos` (todos los
//    productos de antes de este cambio, y los que agregue BRILLO) a
//    productosFotos + productosMiniaturas, y deja en el producto solo
//    `fotosIds`. Es de una sola vez por producto.
// 2. Corrige el resumen contra lo que se acaba de leer de `productos`.
async function _optimizarCatalogoEnServidor(inicioLectura) {
  if (!_hayFuncionesFotos()) return;
  try {
    await _sacarFotosDeProductos();
    await _reconstruirResumenCatalogo(inicioLectura);
  } catch (error) {
    console.warn('No se pudo optimizar el catálogo en el servidor:', error);
  }
}

async function _sacarFotosDeProductos() {
  const productos = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE);
  const fotos = dbFirestore.collection(FOTOS_PRODUCTO_COLECCION);
  const miniaturas = dbFirestore.collection(MINIATURAS_PRODUCTO_COLECCION);
  const borrar = firebase.firestore.FieldValue.delete;
  const lotes = _crearLotesPorTamano();
  let movidos = 0;

  const porMover = CATALOGO_CACHE.filter(p => fotosEmbebidasProducto(p).length).length;
  if (porMover > 20 && typeof mostrarToast === 'function') {
    mostrarToast(`Optimizando las fotos de ${porMover} productos para que el catálogo cargue rápido… deja esta página abierta unos minutos.`);
  }

  for (const p of CATALOGO_CACHE) {
    const id = String(p.id);
    const embebidas = fotosEmbebidasProducto(p);
    const traeCamposFoto = p.galeria !== undefined || p.imagen !== undefined;
    if (!embebidas.length) {
      // Sin fotos: se marca (fotosIds: []) para que nadie intente
      // descargarlas, y se quitan los campos de foto vacíos.
      if (Array.isArray(p.fotosIds) && !traeCamposFoto) continue;
      const cambios = traeCamposFoto ? { galeria: borrar(), imagen: borrar() } : {};
      if (!Array.isArray(p.fotosIds)) cambios.fotosIds = [];
      const fotosIds = Array.isArray(p.fotosIds) ? p.fotosIds : [];
      lotes.agregar(200, (lote) => { lote.update(productos.doc(id), cambios); return 1; })
        .alConfirmar.push(() => { delete p.galeria; delete p.imagen; p.fotosIds = fotosIds; });
      continue;
    }
    // Un producto ya optimizado al que BRILLO le agregó fotos: se suman
    // a las que ya tenía en productosFotos (BRILLO no las ve).
    let galeria = embebidas;
    if (Array.isArray(p.fotosIds) && p.fotosIds.length) {
      _galeriasProducto.delete(id);
      const previas = await cargarGaleriaProducto(id);
      const idsPrevios = new Set(previas.map(f => f.id));
      galeria = [...previas, ...embebidas.filter(f => !idsPrevios.has(f.id))];
    }
    const miniatura = await _miniaturaDeFoto(galeria[0].src);
    const fotosIds = galeria.map(f => f.id);
    const bytes = galeria.reduce((s, f) => s + String(f.src).length, 0) + miniatura.length;
    lotes.agregar(bytes, (lote) => {
      lote.set(fotos.doc(id), { galeria });
      lote.set(miniaturas.doc(id), { src: miniatura });
      lote.update(productos.doc(id), { galeria: borrar(), imagen: borrar(), fotosIds });
      return 3;
    }).alConfirmar.push(() => {
      _galeriasProducto.set(id, galeria);
      _miniaturasProducto.set(id, miniatura);
      delete p.galeria; delete p.imagen; p.fotosIds = fotosIds;
      movidos++;
    });
  }

  for (const { lote, alConfirmar } of lotes.lotes) {
    await lote.commit();
    alConfirmar.forEach((fn) => fn());
  }
  CATALOGO_CACHE.forEach((p) => {
    const id = String(p.id);
    if (Array.isArray(p.fotosIds)) _fotosIdsEnServidor.set(id, p.fotosIds);
    if (_catalogoEnServidor.has(id)) _catalogoEnServidor.set(id, textoEstableFirestore(productoLigero(p)));
  });
  if (movidos) console.info(`Catálogo: fotos de ${movidos} producto(s) separadas del producto.`);
  if (porMover > 20 && typeof mostrarToast === 'function') mostrarToast('Listo: catálogo optimizado.');
}

async function _reconstruirResumenCatalogo(inicioLectura) {
  const ligeros = new Map(CATALOGO_CACHE.map(p => [String(p.id), productoLigero(p)]));
  const bytes = [...ligeros.values()].reduce((s, p) => s + JSON.stringify(p).length, 0);
  const meta = await _leerMetaResumenCatalogo();
  const partes = Math.max(CATALOGO_RESUMEN_PARTES_MIN, Math.ceil(bytes / CATALOGO_RESUMEN_BYTES_POR_PARTE), (meta && meta.partes) || 0);

  const coleccion = dbFirestore.collection(CATALOGO_RESUMEN_COLECCION);
  const docs = await Promise.all(Array.from({ length: partes }, (_, i) => coleccion.doc('p' + i).get()));
  const actuales = new Map(docs.map(d => [d.id, d.exists ? (d.data().productos || {}) : {}]));

  // Diferencias por parte: lo que falta o cambió, y lo que sobra.
  const cambios = new Map(); // parte → Map(id → ligero | null)
  const anotar = (parte, id, valor) => {
    if (!cambios.has(parte)) cambios.set(parte, new Map());
    cambios.get(parte).set(id, valor);
  };
  ligeros.forEach((ligero, id) => {
    const parte = parteResumenCatalogo(id, partes);
    const actual = actuales.get(parte)[id];
    if (!actual || textoEstableFirestore(actual) !== textoEstableFirestore(ligero)) anotar(parte, id, ligero);
  });
  actuales.forEach((productos, parte) => {
    Object.keys(productos).forEach((id) => {
      if (!ligeros.has(id) || parteResumenCatalogo(id, partes) !== parte) anotar(parte, id, null);
    });
  });

  // Lo que ya estaba en el resumen y cambió se vuelve a leer justo antes
  // de escribir: un apartado hecho mientras esta página cargaba ya
  // descontó la existencia en el resumen y no se debe regresar.
  const releer = [];
  cambios.forEach((porId, parte) => porId.forEach((valor, id) => {
    if (valor && actuales.get(parte)[id]) releer.push(id);
  }));
  const frescos = await Promise.all(releer.map(id => dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(id).get()));
  frescos.forEach((doc) => {
    const parte = parteResumenCatalogo(doc.id, partes);
    if (doc.exists) cambios.get(parte).set(doc.id, productoLigero({ ...doc.data(), id: doc.id }));
    else cambios.get(parte).set(doc.id, null);
  });

  const lote = dbFirestore.batch();
  cambios.forEach((porId, parte) => {
    const datos = { productos: {} };
    porId.forEach((valor, id) => { datos.productos[id] = valor === null ? firebase.firestore.FieldValue.delete() : valor; });
    lote.set(coleccion.doc(parte), datos, { mergeFields: [...porId.keys()].map(id => _rutaEnResumen(id)) });
  });
  const nuevaMeta = { partes, generadoEn: inicioLectura };
  lote.set(dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_RESUMEN_META_DOC_ID), nuevaMeta);
  await lote.commit();
  _resumenCatalogo = nuevaMeta;
  _idsEnResumen = new Set(ligeros.keys());
}

// Recibe el catálogo completo (mismo contrato de siempre para todos los
// controladores): guarda siempre en localStorage como caché/respaldo, y
// si hay Firestore real, envía SOLO las diferencias contra lo que esta
// página sabe que hay en el servidor — ver _catalogoEnServidor arriba.
//
// Cada controlador llama esto sin esperar (varios clics seguidos —
// borrar, agregar — disparan varias llamadas casi al mismo tiempo). Si
// cada una leyera Firestore y escribiera por su cuenta, podrían
// terminar en cualquier orden y la más lenta pisaría el resultado de
// una más reciente. `_colaGuardadoCatalogo` fuerza a que se ejecuten
// una a la vez, en el mismo orden en que se llamaron.
let _colaGuardadoCatalogo = Promise.resolve();

async function guardarCatalogoRepo(catalogo) {
  CATALOGO_CACHE = catalogo;
  try {
    // Con Firestore, la copia local va sin fotos (no cabrían).
    localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(dbFirestore ? catalogo.map(productoLigero) : catalogo));
  } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  // Nunca queda en estado "rechazada": si un guardado falla, ya se avisó
  // dentro de sincronizarCatalogoConFirestore (mostrarToast) — que quede
  // rechazada aquí solo bloquearía en silencio los guardados siguientes
  // de la cola y generaría un error sin manejar en la consola, ya que
  // ningún controlador espera ni atrapa el resultado de esta llamada.
  const tarea = _colaGuardadoCatalogo.then(() => sincronizarCatalogoConFirestore(catalogo).catch(() => {}));
  _colaGuardadoCatalogo = tarea;
  return tarea;
}

async function sincronizarCatalogoConFirestore(catalogo) {
  const coleccion = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE);
  const borrar = firebase.firestore.FieldValue.delete;
  const batch = dbFirestore.batch();
  const escritos = new Map();
  const borrados = [];
  const fotosEscritas = [];

  for (const producto of catalogo) {
    const id = String(producto.id);

    // Fotos: solo si el formulario de producto guardó la galería y es
    // distinta de la que hay en el servidor.
    let fotosCambiaron = false;
    if (producto.fotosEditadas && Array.isArray(producto.galeria) && _hayFuncionesFotos()) {
      const galeria = producto.galeria.filter(f => f && f.src);
      const enServidor = _galeriasProducto.get(id);
      if (!enServidor || textoEstableFirestore(enServidor) !== textoEstableFirestore(galeria)) {
        fotosCambiaron = true;
        const miniatura = galeria.length ? await _miniaturaDeFoto(galeria[0].src) : '';
        if (galeria.length) {
          batch.set(dbFirestore.collection(FOTOS_PRODUCTO_COLECCION).doc(id), { galeria });
          batch.set(dbFirestore.collection(MINIATURAS_PRODUCTO_COLECCION).doc(id), { src: miniatura });
        } else {
          batch.delete(dbFirestore.collection(FOTOS_PRODUCTO_COLECCION).doc(id));
          batch.delete(dbFirestore.collection(MINIATURAS_PRODUCTO_COLECCION).doc(id));
        }
        fotosEscritas.push({ producto, id, galeria, miniatura });
      }
    }

    const ligero = productoLigero(producto);
    const texto = textoEstableFirestore(ligero);
    if (!fotosCambiaron && _catalogoEnServidor.get(id) === texto) continue; // sin cambios en esta página
    // merge: no borra campos que esta página no conoce (por ejemplo,
    // fotos que BRILLO haya puesto dentro del producto y que el Catálogo
    // de Staff/Encargado/Admin todavía no separa).
    batch.set(coleccion.doc(id), fotosCambiaron ? { ...ligero, galeria: borrar(), imagen: borrar() } : ligero, { merge: true });
    _escribirEnResumen(batch, id, ligero);
    escritos.set(id, texto);
  }

  const idsNuevos = new Set(catalogo.map(p => String(p.id)));
  _catalogoEnServidor.forEach((texto, id) => {
    if (!idsNuevos.has(id)) {
      batch.delete(coleccion.doc(id)); // lo eliminó esta página
      if (_hayFuncionesFotos()) {
        batch.delete(dbFirestore.collection(FOTOS_PRODUCTO_COLECCION).doc(id));
        batch.delete(dbFirestore.collection(MINIATURAS_PRODUCTO_COLECCION).doc(id));
      }
      _escribirEnResumen(batch, id, null);
      borrados.push(id);
    }
  });

  // Sella que este proyecto ya tuvo catálogo real — así una colección
  // vacía después de esto se sabe que es a propósito, no "sin sembrar".
  batch.set(dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_META_DOC_ID), { inicializado: true }, { merge: true });
  try {
    await batch.commit();
    fotosEscritas.forEach(({ producto, id, galeria, miniatura }) => {
      _galeriasProducto.set(id, galeria);
      _miniaturasProducto.set(id, miniatura);
      _fotosIdsEnServidor.set(id, galeria.map(f => f.id));
      producto.fotosIds = galeria.map(f => f.id);
    });
    escritos.forEach((texto, id) => _catalogoEnServidor.set(id, texto));
    borrados.forEach(id => _catalogoEnServidor.delete(id));
  } catch (error) {
    // Firestore aplica el batch completo o nada: si un solo producto
    // falla (ej. una foto demasiado pesada), NINGÚN cambio de este
    // guardado se aplica. Antes esto quedaba como una promesa rechazada
    // sin manejar — visible solo en la consola del navegador — y parecía
    // que "no pasó nada". Avisamos con un mensaje que sí se ve en pantalla.
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar el catálogo: ' + (error && error.message ? error.message : 'error desconocido') + '. Ningún cambio de este guardado se aplicó.');
    }
    throw error;
  }
}

// Reduce cualquier foto de producto a un tamaño que quepa cómodo en un
// documento de Firestore (límite de ~1 MB por campo). Las fotos de
// Catálogo van embebidas directo en el producto (nunca se suben a
// Storage — ver js/firebase-init.js), así que una foto de cámara/
// celular sin comprimir (varios MB) puede tumbar el guardado COMPLETO
// del catálogo, no solo ese producto (Firestore aplica cada lote de
// escritura completo o nada). Usar SIEMPRE esto al leer un <input
// type="file"> de foto de producto, en vez de FileReader directo.
const CATALOGO_IMAGEN_LADO_MAX = 900; // px del lado más largo
const CATALOGO_IMAGEN_CALIDAD = 0.72;

function comprimirImagenAProductoDataURL(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error || new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > CATALOGO_IMAGEN_LADO_MAX) {
          height = Math.round(height * (CATALOGO_IMAGEN_LADO_MAX / width));
          width = CATALOGO_IMAGEN_LADO_MAX;
        } else if (height > width && height > CATALOGO_IMAGEN_LADO_MAX) {
          width = Math.round(width * (CATALOGO_IMAGEN_LADO_MAX / height));
          height = CATALOGO_IMAGEN_LADO_MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', CATALOGO_IMAGEN_CALIDAD));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// Cada página espera esto UNA vez antes de su primer render.
const catalogoRepoListo = cargarCatalogoRepo();
