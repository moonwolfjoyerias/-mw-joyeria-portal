// MW JOYERÍA — Repositorio de Lista de deseos / Resurtido — Fase 2: Firebase
//
// Mismo patrón que apartados-firestore-sync.js (varias piezas
// compartiendo una sola cola de guardado): tres cachés en memoria que
// este archivo llena de forma ASÍNCRONA una sola vez al cargar la
// página — lista-deseos-modelo.js expone encima las mismas funciones
// síncronas de siempre, así ninguna otra página necesita tocarse más
// que para esperar `listaDeseosRepoListo` antes de su primer render.
//
// Antes, "una Emprendedora quiere esta pieza" (creado por Staff) o
// "hay que resurtir este producto" (creado por Staff/Encargado) solo
// quedaba en el localStorage de quien lo creó — con Staff/Encargado/
// Admin en dispositivos distintos (el caso real de la beta), Admin
// nunca veía lo que Staff acababa de registrar, y viceversa.
//
// Tres colecciones, cada una diff-y-resync como ventanasApartado:
// - listaDeseos/{id}
// - solicitudesResurtido/{id}
// - listaDeseosHistorialEstados/{id} — historial append-only de cambios
//   de estado (ver registrarCambioEstadoListaDeseos).

const LISTA_DESEOS_COLECCION_FIRESTORE = 'listaDeseos';
const RESURTIDO_COLECCION_FIRESTORE = 'solicitudesResurtido';
const LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE = 'listaDeseosHistorialEstados';
const LISTA_DESEOS_META_COLECCION = 'listaDeseosMeta';
const LISTA_DESEOS_META_DOC_ID = 'estado';

let LISTA_DESEOS_CACHE = [];
let RESURTIDO_CACHE = [];
let LISTA_DESEOS_HISTORIAL_CACHE = [];

// Opción A + en vivo (convivencia con BRILLO MW, que también maneja la
// Lista de deseos y el resurtido en estas mismas colecciones). Igual que
// apartados-firestore-sync.js:
// - Se recuerda cómo estaba cada documento en el servidor y al guardar
//   se envía SOLO lo que cambió aquí; solo se borra lo que esta página
//   conocía y quitó, nunca un documento que no conoce.
// - onSnapshot aplica lo que cambie BRILLO u otro dispositivo sobre el
//   mismo arreglo en memoria y avisa a la pantalla
//   ('mw:lista-deseos-actualizada') para que se vuelva a pintar sola.
// - Una copia atrasada de un documento no se vuelve a enviar, y lo que
//   llegó en vivo no se borra por no venir en un arreglo viejo.
const _ldEnServidor = new Map();
const _ldVersionesSuperadas = new Map();
const _ldRecibidosEnVivo = new Map();
let _escuchaListaDeseosActiva = false;
let _ldEnServidorCargado = false;

function _ldMapa(mapa, coleccion, crear) {
  if (!mapa.has(coleccion)) mapa.set(coleccion, crear());
  return mapa.get(coleccion);
}

function _ldCache(coleccion) {
  if (coleccion === LISTA_DESEOS_COLECCION_FIRESTORE) return LISTA_DESEOS_CACHE;
  if (coleccion === RESURTIDO_COLECCION_FIRESTORE) return RESURTIDO_CACHE;
  return LISTA_DESEOS_HISTORIAL_CACHE;
}

function _ldRecordarServidor(coleccion, docs) {
  _ldEnServidor.set(coleccion, new Map(docs.map(d => [String(d.id), textoEstableFirestore(d)])));
}

function _ldAplicarEnVivo(coleccion, snap) {
  const enServidor = _ldMapa(_ldEnServidor, coleccion, () => new Map());
  const superadas = _ldMapa(_ldVersionesSuperadas, coleccion, () => new Map());
  const recibidos = _ldMapa(_ldRecibidosEnVivo, coleccion, () => new Set());
  const cache = _ldCache(coleccion);
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
    if (local) cache[i] = item; else cache.unshift(item);
    huboCambios = true;
  });
  if (!huboCambios) return;
  try {
    localStorage.setItem(LISTA_DESEOS_STORAGE_KEY, JSON.stringify(LISTA_DESEOS_CACHE));
    localStorage.setItem(RESURTIDO_STORAGE_KEY, JSON.stringify(RESURTIDO_CACHE));
    localStorage.setItem(LISTA_DESEOS_HISTORIAL_KEY, JSON.stringify(LISTA_DESEOS_HISTORIAL_CACHE));
  } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:lista-deseos-actualizada'));
}

function escucharListaDeseosEnVivo() {
  if (!dbFirestore || _escuchaListaDeseosActiva) return;
  _escuchaListaDeseosActiva = true;
  // Si una escucha falla (sin sesión, o resurtido para Emprendedora/Líder,
  // que no lo puede leer) la página sigue como antes: con lo que cargó.
  [LISTA_DESEOS_COLECCION_FIRESTORE, RESURTIDO_COLECCION_FIRESTORE, LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE].forEach(coleccion => {
    dbFirestore.collection(coleccion).onSnapshot(snap => _ldAplicarEnVivo(coleccion, snap), () => {});
  });
}

// Un arreglo armado antes de que llegara un cambio en vivo: sus copias
// atrasadas se cambian por la versión actual y lo que llegó en vivo y no
// trae se conserva, para que la pantalla no muestre datos viejos.
function _ldConservarRecibidos(coleccion, lista) {
  const cache = _ldCache(coleccion);
  if (lista === cache) return lista;
  const superadas = _ldVersionesSuperadas.get(coleccion);
  const recibidos = _ldRecibidosEnVivo.get(coleccion);
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

function listaDeseosSemillaLocal() {
  return typeof construirListaDeseosEjemplo === 'function' ? construirListaDeseosEjemplo() : [];
}
function resurtidoSemillaLocal() {
  return typeof construirResurtidoEjemplo === 'function' ? construirResurtidoEjemplo() : [];
}

function listaDeseosDesdeLocalStorage() {
  try {
    const guardados = JSON.parse(localStorage.getItem(LISTA_DESEOS_STORAGE_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) { /* sigue abajo */ }
  return listaDeseosSemillaLocal();
}
function resurtidoDesdeLocalStorage() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(RESURTIDO_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) { /* sigue abajo */ }
  return resurtidoSemillaLocal();
}
function historialListaDeseosDesdeLocalStorage() {
  try {
    const registros = JSON.parse(localStorage.getItem(LISTA_DESEOS_HISTORIAL_KEY));
    if (Array.isArray(registros)) return registros;
  } catch (error) { /* sigue abajo */ }
  return [];
}

async function cargarListaDeseosRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(LISTA_DESEOS_META_COLECCION).doc(LISTA_DESEOS_META_DOC_ID).get();
      if (metaSnap.exists) {
        const [snapDeseos, snapResurtido, snapHistorial] = await Promise.all([
          dbFirestore.collection(LISTA_DESEOS_COLECCION_FIRESTORE).get(),
          dbFirestore.collection(RESURTIDO_COLECCION_FIRESTORE).get(),
          dbFirestore.collection(LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE).get()
        ]);
        LISTA_DESEOS_CACHE = snapDeseos.docs.map(d => ({ ...d.data(), id: d.id }));
        RESURTIDO_CACHE = snapResurtido.docs.map(d => ({ ...d.data(), id: d.id }));
        LISTA_DESEOS_HISTORIAL_CACHE = snapHistorial.docs.map(d => ({ ...d.data(), id: d.id }));
        _ldRecordarServidor(LISTA_DESEOS_COLECCION_FIRESTORE, LISTA_DESEOS_CACHE);
        _ldRecordarServidor(RESURTIDO_COLECCION_FIRESTORE, RESURTIDO_CACHE);
        _ldRecordarServidor(LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE, LISTA_DESEOS_HISTORIAL_CACHE);
        _ldEnServidorCargado = true;
        escucharListaDeseosEnVivo();
      } else {
        // Primera vez que este proyecto de Firestore ve Lista de deseos:
        // siembra las dos listas de ejemplo de una vez (el historial
        // arranca vacío — los ejemplos nunca tuvieron cambios de estado
        // registrados).
        await Promise.all([
          guardarListaDeseosRepo(listaDeseosSemillaLocal()),
          guardarResurtidoRepo(resurtidoSemillaLocal())
        ]);
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar solicitudes ya atendidas/
      // eliminadas en otro dispositivo (mismo problema ya corregido en
      // cuentas-firestore-sync.js / personas-firestore-sync.js / etc).
      // Se avisa y se deja vacío en vez de mostrar datos que podrían
      // estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar la Lista de deseos desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      LISTA_DESEOS_CACHE = [];
      RESURTIDO_CACHE = [];
      LISTA_DESEOS_HISTORIAL_CACHE = [];
    }
  } else {
    LISTA_DESEOS_CACHE = listaDeseosDesdeLocalStorage();
    RESURTIDO_CACHE = resurtidoDesdeLocalStorage();
    LISTA_DESEOS_HISTORIAL_CACHE = historialListaDeseosDesdeLocalStorage();
  }
  try {
    localStorage.setItem(LISTA_DESEOS_STORAGE_KEY, JSON.stringify(LISTA_DESEOS_CACHE));
    localStorage.setItem(RESURTIDO_STORAGE_KEY, JSON.stringify(RESURTIDO_CACHE));
    localStorage.setItem(LISTA_DESEOS_HISTORIAL_KEY, JSON.stringify(LISTA_DESEOS_HISTORIAL_CACHE));
  } catch (error) { /* noop */ }
  return { listaDeseos: LISTA_DESEOS_CACHE, resurtido: RESURTIDO_CACHE, historial: LISTA_DESEOS_HISTORIAL_CACHE };
}

// Una sola cola compartida entre las tres piezas — mismo motivo que ya
// documenta apartados-firestore-sync.js (varios guardados casi
// simultáneos no deben pisarse entre sí).
let _colaGuardadoListaDeseos = Promise.resolve();

function avisarErrorGuardadoListaDeseos(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

function guardarListaDeseosRepo(lista) {
  lista = _ldConservarRecibidos(LISTA_DESEOS_COLECCION_FIRESTORE, lista);
  LISTA_DESEOS_CACHE = lista;
  try { localStorage.setItem(LISTA_DESEOS_STORAGE_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoListaDeseos.then(() =>
    sincronizarColeccionListaDeseos(LISTA_DESEOS_COLECCION_FIRESTORE, lista).catch(error => avisarErrorGuardadoListaDeseos(error, 'la lista de deseos'))
  );
  _colaGuardadoListaDeseos = tarea;
  return tarea;
}

function guardarResurtidoRepo(lista) {
  lista = _ldConservarRecibidos(RESURTIDO_COLECCION_FIRESTORE, lista);
  RESURTIDO_CACHE = lista;
  try { localStorage.setItem(RESURTIDO_STORAGE_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoListaDeseos.then(() =>
    sincronizarColeccionListaDeseos(RESURTIDO_COLECCION_FIRESTORE, lista).catch(error => avisarErrorGuardadoListaDeseos(error, 'la solicitud de resurtido'))
  );
  _colaGuardadoListaDeseos = tarea;
  return tarea;
}

function guardarHistorialListaDeseosRepo(lista) {
  lista = _ldConservarRecibidos(LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE, lista);
  LISTA_DESEOS_HISTORIAL_CACHE = lista;
  try { localStorage.setItem(LISTA_DESEOS_HISTORIAL_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoListaDeseos.then(() =>
    sincronizarColeccionListaDeseos(LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE, lista).catch(error => avisarErrorGuardadoListaDeseos(error, 'el historial de la lista de deseos'))
  );
  _colaGuardadoListaDeseos = tarea;
  return tarea;
}

async function sincronizarColeccionListaDeseos(nombreColeccion, lista) {
  const coleccion = dbFirestore.collection(nombreColeccion);

  // SEC-08 de la auditoría: solo aplica a listaDeseos/su historial de
  // estados (resurtido sigue exclusivo de Staff/Encargado/Admin, nunca
  // llamado por una sesión de persona). Mismo motivo que ya se
  // corrigió en notificaciones-firestore-sync.js: el arreglo completo
  // siempre incluye solicitudes ajenas sin ningún cambio real, y la
  // regla ahora exige ser dueña (personaId == su personaId, o
  // usuarioId == su personaId en el historial) para tocar un
  // documento que ya existía — se manda solo lo nuevo o lo que de
  // verdad cambió.
  if (nombreColeccion === LISTA_DESEOS_COLECCION_FIRESTORE || nombreColeccion === LISTA_DESEOS_HISTORIAL_COLECCION_FIRESTORE) {
    const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
    if (sesion && sesion.tipo === 'persona') {
      const snapPersona = await coleccion.get();
      const actuales = new Map(snapPersona.docs.map(d => [d.id, d.data()]));
      const batchPersona = dbFirestore.batch();
      let hayCambios = false;
      lista.forEach(item => {
        const anterior = actuales.get(String(item.id));
        if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) {
          batchPersona.set(coleccion.doc(String(item.id)), item);
          hayCambios = true;
        }
      });
      if (!hayCambios) return;
      await batchPersona.commit();
      return;
    }
  }

  // Opción A: solo lo que cambió aquí; solo se borra lo que esta página
  // conocía y quitó (nunca algo creado en BRILLO u otro dispositivo).
  const enServidor = _ldMapa(_ldEnServidor, nombreColeccion, () => new Map());
  const superadas = _ldVersionesSuperadas.get(nombreColeccion);
  const recibidos = _ldRecibidosEnVivo.get(nombreColeccion);
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
  // El marcador "ya se sembró" solo hace falta la primera vez (cada
  // escritura cuenta contra la cuota diaria).
  const primeraVez = enServidor.size === 0 && !_ldEnServidorCargado;
  if (primeraVez) {
    batch.set(dbFirestore.collection(LISTA_DESEOS_META_COLECCION).doc(LISTA_DESEOS_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritos.size && !borrados.length && !primeraVez) return;
  await batch.commit();
  escritos.forEach((texto, id) => enServidor.set(id, texto));
  borrados.forEach(id => enServidor.delete(id));
}
