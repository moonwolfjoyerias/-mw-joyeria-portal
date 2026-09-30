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
      } else {
        // Primera vez que este proyecto de Firestore ve Actividades del
        // Staff: solo el catálogo tiene semilla — asignaciones e
        // historial arrancan vacíos, igual que ya pasaba en localStorage.
        await guardarActividadesStaffCatalogoRepo(actividadesStaffCatalogoSemillaLocal());
      }
    } catch (error) {
      ACTIVIDADES_STAFF_CATALOGO_CACHE = actividadesStaffCatalogoDesdeLocalStorage();
      ACTIVIDADES_STAFF_CACHE = actividadesStaffAsignacionesDesdeLocalStorage();
      ACTIVIDADES_STAFF_HISTORIAL_CACHE = actividadesStaffHistorialDesdeLocalStorage();
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
  const snap = await coleccion.get();
  const idsNuevos = new Set(lista.map(item => String(item.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  lista.forEach(item => {
    batch.set(coleccion.doc(String(item.id)), item);
  });
  batch.set(dbFirestore.collection(ACTIVIDADES_STAFF_META_COLECCION).doc(ACTIVIDADES_STAFF_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}
