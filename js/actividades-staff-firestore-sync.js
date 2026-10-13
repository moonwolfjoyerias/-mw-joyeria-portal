// MW JOYERÍA — Repositorio de Actividades del Staff — Fase 2: Firebase
//
// Mismo patrón que lista-deseos-firestore-sync.js: tres cachés en
// memoria que este archivo llena de forma ASÍNCRONA una sola vez al
// cargar la página — actividades-staff-modelo.js expone encima las
// mismas funciones síncronas de siempre, así ninguna otra página
// necesita tocarse más que para esperar `actividadesStaffRepoListo`
// antes de su primer render.
//
// Antes, cuando Encargado organizaba/anunciaba la semana, o Staff
// confirmaba que se enteró, o Encargado firmaba que se hizo, cada
// cambio solo quedaba en el localStorage de QUIEN lo hizo — con
// Staff/Encargado/Admin en dispositivos distintos (el caso real de la
// beta), nadie más veía lo que el otro acababa de hacer.
//
// Tres colecciones, cada una diff-y-resync como ventanasApartado:
// - actividadesCatalogoStaff/{id}
// - actividadesStaff/{id} — las asignaciones reales de cada semana.
// - historialActividadesStaff/{id}

const ACTIVIDADES_STAFF_CATALOGO_COLECCION = 'actividadesCatalogoStaff';
const ACTIVIDADES_STAFF_COLECCION = 'actividadesStaff';
const ACTIVIDADES_STAFF_HISTORIAL_COLECCION = 'historialActividadesStaff';
const ACTIVIDADES_STAFF_META_COLECCION = 'actividadesStaffMeta';
const ACTIVIDADES_STAFF_META_DOC_ID = 'estado';

let ACTIVIDADES_STAFF_CATALOGO_CACHE = [];
let ACTIVIDADES_STAFF_CACHE = [];
let ACTIVIDADES_STAFF_HISTORIAL_CACHE = [];

// Opción A + en vivo (convivencia con BRILLO MW, que también maneja la
// las Actividades del Staff en estas mismas colecciones). Igual que
// apartados-firestore-sync.js:
// - Se recuerda cómo estaba cada documento en el servidor y al guardar
//   se envía SOLO lo que cambió aquí; solo se borra lo que esta página
//   conocía y quitó, nunca un documento que no conoce.
// - onSnapshot aplica lo que cambie BRILLO u otro dispositivo sobre el
//   mismo arreglo en memoria y avisa a la pantalla
//   ('mw:actividades-staff-actualizadas') para que se vuelva a pintar sola.
// - Una copia atrasada de un documento no se vuelve a enviar, y lo que
//   llegó en vivo no se borra por no venir en un arreglo viejo.
const _asEnServidor = new Map();
const _asVersionesSuperadas = new Map();
const _asRecibidosEnVivo = new Map();
let _escuchaActividadesStaffActiva = false;
let _asEnServidorCargado = false;

function _asMapa(mapa, coleccion, crear) {
  if (!mapa.has(coleccion)) mapa.set(coleccion, crear());
  return mapa.get(coleccion);
}

function _asCache(coleccion) {
  if (coleccion === ACTIVIDADES_STAFF_CATALOGO_COLECCION) return ACTIVIDADES_STAFF_CATALOGO_CACHE;
  if (coleccion === ACTIVIDADES_STAFF_COLECCION) return ACTIVIDADES_STAFF_CACHE;
  return ACTIVIDADES_STAFF_HISTORIAL_CACHE;
}

function _asRecordarServidor(coleccion, docs) {
  _asEnServidor.set(coleccion, new Map(docs.map(d => [String(d.id), textoEstableFirestore(d)])));
}

function _asAplicarEnVivo(coleccion, snap) {
  const enServidor = _asMapa(_asEnServidor, coleccion, () => new Map());
  const superadas = _asMapa(_asVersionesSuperadas, coleccion, () => new Map());
  const recibidos = _asMapa(_asRecibidosEnVivo, coleccion, () => new Set());
  const cache = _asCache(coleccion);
  const superar = (id, texto) => {
    if (!texto) return;
    if (!superadas.has(id)) superadas.set(id, new Set());
    superadas.get(id).add(texto);
  };
  let huboCambios = false;
  snap.docChanges().forEach(cambio => {
    const id = String(cambio.doc.id);
    const antes = enServidor.get(id);
    const i = cache.findIndex(x => String(x.id) === id);
    const local = i >= 0 ? cache[i] : null;
    const cambioPendiente = local && textoEstableFirestore(local) !== antes;
    if (cambio.type === 'removed') {
      if (antes === undefined) return;
      superar(id, antes);
      enServidor.delete(id);
      if (local && !cambioPendiente) { cache.splice(i, 1); huboCambios = true; }
      return;
    }
    const item = { ...cambio.doc.data(), id: cambio.doc.id };
    const texto = textoEstableFirestore(item);
    if (texto === antes) return;
    if (antes === undefined && !local) recibidos.add(id);
    superar(id, antes);
    enServidor.set(id, texto);
    if (cambioPendiente) return;
    // El catálogo conserva el orden de alta (de ahí sale el orden de las
    // zonas); asignaciones e historial van de la más nueva a la más vieja.
    if (local) cache[i] = item;
    else if (coleccion === ACTIVIDADES_STAFF_CATALOGO_COLECCION) cache.push(item);
    else cache.unshift(item);
    huboCambios = true;
  });
  if (!huboCambios) return;
  try {
    localStorage.setItem(ACTIVIDADES_STAFF_CATALOGO_KEY, JSON.stringify(ACTIVIDADES_STAFF_CATALOGO_CACHE));
    localStorage.setItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY, JSON.stringify(ACTIVIDADES_STAFF_CACHE));
    localStorage.setItem(ACTIVIDADES_STAFF_HISTORIAL_KEY, JSON.stringify(ACTIVIDADES_STAFF_HISTORIAL_CACHE));
  } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:actividades-staff-actualizadas'));
}

function escucharActividadesStaffEnVivo() {
  if (!dbFirestore || _escuchaActividadesStaffActiva) return;
  _escuchaActividadesStaffActiva = true;
  // Si una escucha falla (sin sesión, sin red) la página sigue como antes:
  // con lo que cargó.
  [ACTIVIDADES_STAFF_CATALOGO_COLECCION, ACTIVIDADES_STAFF_COLECCION, ACTIVIDADES_STAFF_HISTORIAL_COLECCION].forEach(coleccion => {
    dbFirestore.collection(coleccion).onSnapshot(snap => _asAplicarEnVivo(coleccion, snap), () => {});
  });
}

// Un arreglo armado antes de que llegara un cambio en vivo: sus copias
// atrasadas se cambian por la versión actual y lo que llegó en vivo y no
// trae se conserva, para que la pantalla no muestre datos viejos.
function _asConservarRecibidos(coleccion, lista) {
  const cache = _asCache(coleccion);
  if (lista === cache) return lista;
  const superadas = _asVersionesSuperadas.get(coleccion);
  const recibidos = _asRecibidosEnVivo.get(coleccion);
  const actuales = new Map(cache.map(x => [String(x.id), x]));
  if (superadas && superadas.size) {
    lista.forEach((x, i) => {
      const id = String(x.id);
      if (superadas.has(id) && superadas.get(id).has(textoEstableFirestore(x)) && actuales.has(id)) lista[i] = actuales.get(id);
    });
  }
  if (recibidos && recibidos.size) {
    const ids = new Set(lista.map(x => String(x.id)));
    cache.forEach(x => {
      if (recibidos.has(String(x.id)) && !ids.has(String(x.id))) lista.push(x);
    });
  }
  return lista;
}


function actividadesStaffCatalogoSemillaLocal() {
  return typeof construirCatalogoActividadesStaffEjemplo === 'function' ? construirCatalogoActividadesStaffEjemplo() : [];
}

function actividadesStaffCatalogoDesdeLocalStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_CATALOGO_KEY));
    if (Array.isArray(guardado) && guardado.length) return guardado;
  } catch (error) { /* sigue abajo */ }
  return actividadesStaffCatalogoSemillaLocal();
}
function actividadesStaffAsignacionesDesdeLocalStorage() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) { /* sigue abajo */ }
  return [];
}
function actividadesStaffHistorialDesdeLocalStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_HISTORIAL_KEY));
    if (Array.isArray(guardado)) return guardado;
  } catch (error) { /* sigue abajo */ }
  return [];
}

async function cargarActividadesStaffRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(ACTIVIDADES_STAFF_META_COLECCION).doc(ACTIVIDADES_STAFF_META_DOC_ID).get();
      if (metaSnap.exists) {
        const [snapCatalogo, snapAsignaciones, snapHistorial] = await Promise.all([
          dbFirestore.collection(ACTIVIDADES_STAFF_CATALOGO_COLECCION).get(),
          dbFirestore.collection(ACTIVIDADES_STAFF_COLECCION).get(),
          dbFirestore.collection(ACTIVIDADES_STAFF_HISTORIAL_COLECCION).get()
        ]);
        ACTIVIDADES_STAFF_CATALOGO_CACHE = snapCatalogo.docs.map(d => ({ ...d.data(), id: d.id }));
        ACTIVIDADES_STAFF_CACHE = snapAsignaciones.docs.map(d => ({ ...d.data(), id: d.id }));
        ACTIVIDADES_STAFF_HISTORIAL_CACHE = snapHistorial.docs.map(d => ({ ...d.data(), id: d.id }));
        _asRecordarServidor(ACTIVIDADES_STAFF_CATALOGO_COLECCION, ACTIVIDADES_STAFF_CATALOGO_CACHE);
        _asRecordarServidor(ACTIVIDADES_STAFF_COLECCION, ACTIVIDADES_STAFF_CACHE);
        _asRecordarServidor(ACTIVIDADES_STAFF_HISTORIAL_COLECCION, ACTIVIDADES_STAFF_HISTORIAL_CACHE);
        _asEnServidorCargado = true;
        escucharActividadesStaffEnVivo();
      } else {
        // Primera vez que este proyecto de Firestore ve Actividades del
        // Staff: solo el catálogo tiene semilla — asignaciones e
        // historial arrancan vacíos, igual que ya pasaba en localStorage.
        await guardarActividadesStaffCatalogoRepo(actividadesStaffCatalogoSemillaLocal());
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar actividades ya eliminadas en
      // otro dispositivo (mismo problema ya corregido en cuentas-
      // firestore-sync.js / personas-firestore-sync.js / etc). Se avisa
      // y se deja vacío en vez de mostrar datos que podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudieron cargar las Actividades del Staff desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      ACTIVIDADES_STAFF_CATALOGO_CACHE = [];
      ACTIVIDADES_STAFF_CACHE = [];
      ACTIVIDADES_STAFF_HISTORIAL_CACHE = [];
    }
  } else {
    ACTIVIDADES_STAFF_CATALOGO_CACHE = actividadesStaffCatalogoDesdeLocalStorage();
    ACTIVIDADES_STAFF_CACHE = actividadesStaffAsignacionesDesdeLocalStorage();
    ACTIVIDADES_STAFF_HISTORIAL_CACHE = actividadesStaffHistorialDesdeLocalStorage();
  }
  try {
    localStorage.setItem(ACTIVIDADES_STAFF_CATALOGO_KEY, JSON.stringify(ACTIVIDADES_STAFF_CATALOGO_CACHE));
    localStorage.setItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY, JSON.stringify(ACTIVIDADES_STAFF_CACHE));
    localStorage.setItem(ACTIVIDADES_STAFF_HISTORIAL_KEY, JSON.stringify(ACTIVIDADES_STAFF_HISTORIAL_CACHE));
  } catch (error) { /* noop */ }
  return { catalogo: ACTIVIDADES_STAFF_CATALOGO_CACHE, asignaciones: ACTIVIDADES_STAFF_CACHE, historial: ACTIVIDADES_STAFF_HISTORIAL_CACHE };
}

// Una sola cola compartida entre las tres piezas — mismo motivo que ya
// documentan apartados-firestore-sync.js / lista-deseos-firestore-sync.js.
let _colaGuardadoActividadesStaff = Promise.resolve();

function avisarErrorGuardadoActividadesStaff(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

function guardarActividadesStaffCatalogoRepo(catalogo) {
  catalogo = _asConservarRecibidos(ACTIVIDADES_STAFF_CATALOGO_COLECCION, catalogo);
  ACTIVIDADES_STAFF_CATALOGO_CACHE = catalogo;
  try { localStorage.setItem(ACTIVIDADES_STAFF_CATALOGO_KEY, JSON.stringify(catalogo)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoActividadesStaff.then(() =>
    sincronizarColeccionActividadesStaff(ACTIVIDADES_STAFF_CATALOGO_COLECCION, catalogo).catch(error => avisarErrorGuardadoActividadesStaff(error, 'el catálogo de actividades'))
  );
  _colaGuardadoActividadesStaff = tarea;
  return tarea;
}

function guardarActividadesStaffAsignacionesRepo(lista) {
  lista = _asConservarRecibidos(ACTIVIDADES_STAFF_COLECCION, lista);
  ACTIVIDADES_STAFF_CACHE = lista;
  try { localStorage.setItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoActividadesStaff.then(() =>
    sincronizarColeccionActividadesStaff(ACTIVIDADES_STAFF_COLECCION, lista).catch(error => avisarErrorGuardadoActividadesStaff(error, 'la actividad'))
  );
  _colaGuardadoActividadesStaff = tarea;
  return tarea;
}

function guardarActividadesStaffHistorialRepo(historial) {
  historial = _asConservarRecibidos(ACTIVIDADES_STAFF_HISTORIAL_COLECCION, historial);
  ACTIVIDADES_STAFF_HISTORIAL_CACHE = historial;
  try { localStorage.setItem(ACTIVIDADES_STAFF_HISTORIAL_KEY, JSON.stringify(historial)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoActividadesStaff.then(() =>
    sincronizarColeccionActividadesStaff(ACTIVIDADES_STAFF_HISTORIAL_COLECCION, historial).catch(error => avisarErrorGuardadoActividadesStaff(error, 'el historial de la actividad'))
  );
  _colaGuardadoActividadesStaff = tarea;
  return tarea;
}

async function sincronizarColeccionActividadesStaff(nombreColeccion, lista) {
  const coleccion = dbFirestore.collection(nombreColeccion);
  // Opción A: solo lo que cambió aquí; solo se borra lo que esta página
  // conocía y quitó (nunca algo creado en BRILLO u otro dispositivo). Así
  // además el guardado ya no crece con todo el historial (un lote de
  // Firestore admite máximo 500 escrituras).
  const enServidor = _asMapa(_asEnServidor, nombreColeccion, () => new Map());
  const superadas = _asVersionesSuperadas.get(nombreColeccion);
  const recibidos = _asRecibidosEnVivo.get(nombreColeccion);
  const batch = dbFirestore.batch();
  const escritos = new Map();
  lista.forEach(item => {
    const id = String(item.id);
    const texto = textoEstableFirestore(item);
    if (enServidor.get(id) === texto) return;
    if (superadas && superadas.has(id) && superadas.get(id).has(texto)) return;
    batch.set(coleccion.doc(id), item);
    escritos.set(id, texto);
  });
  const idsNuevos = new Set(lista.map(item => String(item.id)));
  const borrados = [];
  enServidor.forEach((texto, id) => {
    if (!idsNuevos.has(id) && !(recibidos && recibidos.has(id))) {
      batch.delete(coleccion.doc(id));
      borrados.push(id);
    }
  });
  // El marcador "ya se sembró" solo hace falta la primera vez.
  const primeraVez = enServidor.size === 0 && !_asEnServidorCargado;
  if (primeraVez) {
    batch.set(dbFirestore.collection(ACTIVIDADES_STAFF_META_COLECCION).doc(ACTIVIDADES_STAFF_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritos.size && !borrados.length && !primeraVez) return;
  await batch.commit();
  escritos.forEach((texto, id) => enServidor.set(id, texto));
  borrados.forEach(id => enServidor.delete(id));
}
