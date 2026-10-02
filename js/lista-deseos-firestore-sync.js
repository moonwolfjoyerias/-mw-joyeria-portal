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

  const snap = await coleccion.get();
  const idsNuevos = new Set(lista.map(item => String(item.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  lista.forEach(item => {
    batch.set(coleccion.doc(String(item.id)), item);
  });
  batch.set(dbFirestore.collection(LISTA_DESEOS_META_COLECCION).doc(LISTA_DESEOS_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}
