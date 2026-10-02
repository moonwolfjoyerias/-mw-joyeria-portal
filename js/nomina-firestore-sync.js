// MW JOYERÍA — Repositorio de Nómina — Fase 2: Firebase
//
// Última de las 4 piezas pendientes antes de la beta (Notificaciones →
// Lista de deseos → Actividades del Staff → Nómina). Mismo patrón que
// los módulos anteriores: cachés en memoria que este archivo llena de
// forma ASÍNCRONA una sola vez al cargar la página — nomina-modelo.js
// expone encima las mismas funciones síncronas de siempre.
//
// Antes, cuando Encargado capturaba/enviaba a validación una nómina
// semanal, o Administración la validaba/pedía corrección/registraba el
// pago, cada cambio solo quedaba en el localStorage de quien lo hizo —
// con Encargado y Admin en dispositivos distintos (el caso real de la
// beta), Admin nunca veía lo que Encargado acababa de enviar, y
// Encargado nunca se enteraba de que Admin ya validó o pidió corregir.
//
// Cinco piezas:
// - nominaEmpleados/{id} — el roster (diff-y-resync, como
//   ventanasApartado).
// - nominaConceptos/{id} — catálogo de conceptos de nómina.
// - nominaMeta/periodos — el MAPA completo empleadoId__periodoKey →
//   periodo, como UN SOLO documento (igual que apartadosMeta/creditos):
//   periodos nunca se identifica por un id propio, siempre por esa
//   llave compuesta, así que no encaja en el patrón de colección con
//   diff-y-resync por id — se sobrescribe completo en cada guardado,
//   igual que ya hace localStorage hoy. Con la escala de esta beta (una
//   decena de empleados, unas semanas) queda muy por debajo del límite
//   de 1MB por documento de Firestore; si el histórico crece mucho más
//   adelante, ahí sí habría que partirlo por periodo — se deja anotado,
//   no resuelto, mismo criterio que ya se documenta en otras partes de
//   este archivo para gaps conocidos.
// - nominaHistorialAjustes/{id} — antes un arreglo sin id propia (ver
//   registrarAjusteNomina en nomina-modelo.js) — se le agregó uno.
// - nominaHistorialEstados/{id} — mismo caso (ver
//   registrarCambioEstadoNomina).
// - nominaSolicitudes/{id} — solicitudes de alta/baja.
//
// El borrador (NOMINA_BORRADOR_KEY) NO se migra a propósito: es un
// autoguardado de una edición TODAVÍA NO ENVIADA, propio de quien la
// está escribiendo en ESE momento en ESE dispositivo — no hay ningún
// flujo entre roles que dependa de verlo desde otro lado (lo que sí
// necesitan ver los demás es el periodo ya guardado, que es la pieza
// de arriba). Queda igual que hoy, en localStorage.

const NOMINA_EMPLEADOS_COLECCION = 'nominaEmpleados';
const NOMINA_CONCEPTOS_COLECCION = 'nominaConceptos';
const NOMINA_HISTORIAL_AJUSTES_COLECCION = 'nominaHistorialAjustes';
const NOMINA_HISTORIAL_ESTADOS_COLECCION = 'nominaHistorialEstados';
const NOMINA_SOLICITUDES_COLECCION = 'nominaSolicitudes';
const NOMINA_META_COLECCION = 'nominaMeta';
const NOMINA_META_DOC_ID = 'estado';
const NOMINA_PERIODOS_DOC_ID = 'periodos'; // ya no se usa para escribir (ver NOMINA_PERIODOS_COLECCION) — solo para migrar lo viejo al cargar.
const NOMINA_PERIODOS_COLECCION = 'nominaPeriodos';

let NOMINA_EMPLEADOS_CACHE = [];
let NOMINA_CONCEPTOS_CACHE = [];
let NOMINA_PERIODOS_CACHE = {};
let NOMINA_HISTORIAL_AJUSTES_CACHE = [];
let NOMINA_HISTORIAL_ESTADOS_CACHE = [];
let NOMINA_SOLICITUDES_CACHE = [];

function nominaEmpleadosSemillaLocal() {
  return typeof construirEmpleadosNominaEjemplo === 'function' ? construirEmpleadosNominaEjemplo() : [];
}
function nominaConceptosSemillaLocal() {
  return typeof construirConceptosNominaEjemplo === 'function' ? construirConceptosNominaEjemplo() : [];
}

function nominaEmpleadosDesdeLocalStorage() {
  try {
    const guardados = JSON.parse(localStorage.getItem(NOMINA_EMPLEADOS_KEY));
    if (Array.isArray(guardados) && guardados.length) return guardados;
  } catch (error) { /* sigue abajo */ }
  return nominaEmpleadosSemillaLocal();
}
function nominaConceptosDesdeLocalStorage() {
  try {
    const guardados = JSON.parse(localStorage.getItem(NOMINA_CONCEPTOS_KEY));
    if (Array.isArray(guardados) && guardados.length) return guardados;
  } catch (error) { /* sigue abajo */ }
  return nominaConceptosSemillaLocal();
}
function nominaPeriodosDesdeLocalStorage() {
  try {
    const datos = JSON.parse(localStorage.getItem(NOMINA_PERIODOS_KEY));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (error) { return {}; }
}
function nominaHistorialAjustesDesdeLocalStorage() {
  try {
    const registros = JSON.parse(localStorage.getItem(NOMINA_HISTORIAL_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) { return []; }
}
function nominaHistorialEstadosDesdeLocalStorage() {
  try {
    const registros = JSON.parse(localStorage.getItem(NOMINA_HISTORIAL_ESTADOS_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) { return []; }
}
function nominaSolicitudesDesdeLocalStorage() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(NOMINA_SOLICITUDES_KEY));
    return Array.isArray(guardadas) ? guardadas : [];
  } catch (error) { return []; }
}

async function cargarNominaRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(NOMINA_META_COLECCION).doc(NOMINA_META_DOC_ID).get();
      if (metaSnap.exists) {
        const [snapEmpleados, snapConceptos, snapAjustes, snapEstados, snapSolicitudes, snapPeriodos] = await Promise.all([
          dbFirestore.collection(NOMINA_EMPLEADOS_COLECCION).get(),
          dbFirestore.collection(NOMINA_CONCEPTOS_COLECCION).get(),
          dbFirestore.collection(NOMINA_HISTORIAL_AJUSTES_COLECCION).get(),
          dbFirestore.collection(NOMINA_HISTORIAL_ESTADOS_COLECCION).get(),
          dbFirestore.collection(NOMINA_SOLICITUDES_COLECCION).get(),
          dbFirestore.collection(NOMINA_PERIODOS_COLECCION).get()
        ]);
        NOMINA_EMPLEADOS_CACHE = snapEmpleados.docs.map(d => ({ ...d.data(), id: d.id }));
        NOMINA_CONCEPTOS_CACHE = snapConceptos.docs.map(d => ({ ...d.data(), id: d.id }));
        NOMINA_HISTORIAL_AJUSTES_CACHE = snapAjustes.docs.map(d => ({ ...d.data(), id: d.id }));
        NOMINA_HISTORIAL_ESTADOS_CACHE = snapEstados.docs.map(d => ({ ...d.data(), id: d.id }));
        NOMINA_SOLICITUDES_CACHE = snapSolicitudes.docs.map(d => ({ ...d.data(), id: d.id }));
        NOMINA_PERIODOS_CACHE = {};
        snapPeriodos.docs.forEach(d => { NOMINA_PERIODOS_CACHE[d.id] = d.data(); });
      } else {
        // Primera vez que este proyecto de Firestore ve Nómina: solo
        // empleados y conceptos tienen semilla — periodos/historiales/
        // solicitudes arrancan vacíos, igual que ya pasaba en localStorage.
        await Promise.all([
          guardarNominaEmpleadosRepo(nominaEmpleadosSemillaLocal()),
          guardarNominaConceptosRepo(nominaConceptosSemillaLocal())
        ]);
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar empleados/periodos ya eliminados
      // en otro dispositivo (mismo problema ya corregido en cuentas-
      // firestore-sync.js / personas-firestore-sync.js / etc). Se avisa
      // y se deja vacío en vez de mostrar datos que podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar la Nómina desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      NOMINA_EMPLEADOS_CACHE = [];
      NOMINA_CONCEPTOS_CACHE = [];
      NOMINA_PERIODOS_CACHE = {};
      NOMINA_HISTORIAL_AJUSTES_CACHE = [];
      NOMINA_HISTORIAL_ESTADOS_CACHE = [];
      NOMINA_SOLICITUDES_CACHE = [];
    }
  } else {
    NOMINA_EMPLEADOS_CACHE = nominaEmpleadosDesdeLocalStorage();
    NOMINA_CONCEPTOS_CACHE = nominaConceptosDesdeLocalStorage();
    NOMINA_PERIODOS_CACHE = nominaPeriodosDesdeLocalStorage();
    NOMINA_HISTORIAL_AJUSTES_CACHE = nominaHistorialAjustesDesdeLocalStorage();
    NOMINA_HISTORIAL_ESTADOS_CACHE = nominaHistorialEstadosDesdeLocalStorage();
    NOMINA_SOLICITUDES_CACHE = nominaSolicitudesDesdeLocalStorage();
  }
  try {
    localStorage.setItem(NOMINA_EMPLEADOS_KEY, JSON.stringify(NOMINA_EMPLEADOS_CACHE));
    localStorage.setItem(NOMINA_CONCEPTOS_KEY, JSON.stringify(NOMINA_CONCEPTOS_CACHE));
    localStorage.setItem(NOMINA_PERIODOS_KEY, JSON.stringify(NOMINA_PERIODOS_CACHE));
    localStorage.setItem(NOMINA_HISTORIAL_KEY, JSON.stringify(NOMINA_HISTORIAL_AJUSTES_CACHE));
    localStorage.setItem(NOMINA_HISTORIAL_ESTADOS_KEY, JSON.stringify(NOMINA_HISTORIAL_ESTADOS_CACHE));
    localStorage.setItem(NOMINA_SOLICITUDES_KEY, JSON.stringify(NOMINA_SOLICITUDES_CACHE));
  } catch (error) { /* noop */ }
  return {
    empleados: NOMINA_EMPLEADOS_CACHE, conceptos: NOMINA_CONCEPTOS_CACHE, periodos: NOMINA_PERIODOS_CACHE,
    historialAjustes: NOMINA_HISTORIAL_AJUSTES_CACHE, historialEstados: NOMINA_HISTORIAL_ESTADOS_CACHE, solicitudes: NOMINA_SOLICITUDES_CACHE
  };
}

// Una sola cola compartida entre las seis piezas — mismo motivo que ya
// documentan apartados-firestore-sync.js / lista-deseos-firestore-sync.js.
let _colaGuardadoNomina = Promise.resolve();

function avisarErrorGuardadoNomina(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

function guardarNominaEmpleadosRepo(lista) {
  NOMINA_EMPLEADOS_CACHE = lista;
  try { localStorage.setItem(NOMINA_EMPLEADOS_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_EMPLEADOS_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'el empleado'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

function guardarNominaConceptosRepo(lista) {
  NOMINA_CONCEPTOS_CACHE = lista;
  try { localStorage.setItem(NOMINA_CONCEPTOS_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_CONCEPTOS_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'el concepto de nómina'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

// SEC-02: periodos ya no se guarda como un solo documento con el mapa
// completo (nominaMeta/periodos) — cada semana vive en su propio
// documento de nominaPeriodos/{clave}, mismo patrón diff-y-resync que
// el resto de las colecciones de este archivo (ver sincronizarColeccionNomina).
function guardarNominaPeriodosRepo(periodos) {
  NOMINA_PERIODOS_CACHE = periodos;
  try { localStorage.setItem(NOMINA_PERIODOS_KEY, JSON.stringify(periodos)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const lista = Object.keys(periodos).map(clave => ({ ...periodos[clave], id: clave }));
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_PERIODOS_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'la nómina de la semana'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

function guardarNominaHistorialAjustesRepo(lista) {
  NOMINA_HISTORIAL_AJUSTES_CACHE = lista;
  try { localStorage.setItem(NOMINA_HISTORIAL_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_HISTORIAL_AJUSTES_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'el historial de ajustes'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

function guardarNominaHistorialEstadosRepo(lista) {
  NOMINA_HISTORIAL_ESTADOS_CACHE = lista;
  try { localStorage.setItem(NOMINA_HISTORIAL_ESTADOS_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_HISTORIAL_ESTADOS_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'el historial de estados'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

function guardarNominaSolicitudesRepo(lista) {
  NOMINA_SOLICITUDES_CACHE = lista;
  try { localStorage.setItem(NOMINA_SOLICITUDES_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(NOMINA_SOLICITUDES_COLECCION, lista).catch(error => avisarErrorGuardadoNomina(error, 'la solicitud'))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

async function sincronizarColeccionNomina(nombreColeccion, lista) {
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
  batch.set(dbFirestore.collection(NOMINA_META_COLECCION).doc(NOMINA_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}
