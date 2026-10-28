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

// Opción A + en vivo (convivencia con BRILLO MW, que también maneja la
// nómina en estas mismas colecciones). Igual que
// eventos-firestore-sync.js, pero para las seis piezas a la vez:
// - Se recuerda cómo estaba cada documento en el servidor y al guardar
//   se envía SOLO lo que cambió aquí; solo se borra lo que esta página
//   conocía y quitó, nunca un documento que no conoce. Así la firma de
//   un recibo desde Staff es un solo documento con un solo campo
//   distinto (lo único que las reglas le permiten a Staff), y un
//   historial largo ya no se reescribe completo en cada guardado.
// - onSnapshot aplica lo que cambie BRILLO u otro dispositivo sobre la
//   misma caché en memoria y avisa a la pantalla
//   ('mw:nomina-actualizada') para que se vuelva a pintar sola.
// - Una copia atrasada no se vuelve a enviar, y lo que llegó en vivo no
//   se borra por no venir en un arreglo viejo.
// - nominaMeta/estado ("ya se sembró") solo se escribe la primera vez.
let _nominaEnServidorCargado = false;

// localKey es una función: las llaves NOMINA_*_KEY viven en
// nomina-modelo.js, que se carga después de este archivo.
function _nominaCrearPieza(coleccion, localKey, detalle, esMapa, obtener, asignar) {
  return {
    coleccion, localKey, detalle, esMapa, obtener, asignar,
    enServidor: new Map(),
    superadas: new Map(),
    recibidosEnVivo: new Set(),
    escuchando: false
  };
}

const _NOMINA_PIEZAS = {
  empleados: _nominaCrearPieza(NOMINA_EMPLEADOS_COLECCION, () => NOMINA_EMPLEADOS_KEY, 'el empleado', false,
    () => NOMINA_EMPLEADOS_CACHE, v => { NOMINA_EMPLEADOS_CACHE = v; }),
  conceptos: _nominaCrearPieza(NOMINA_CONCEPTOS_COLECCION, () => NOMINA_CONCEPTOS_KEY, 'el concepto de nómina', false,
    () => NOMINA_CONCEPTOS_CACHE, v => { NOMINA_CONCEPTOS_CACHE = v; }),
  periodos: _nominaCrearPieza(NOMINA_PERIODOS_COLECCION, () => NOMINA_PERIODOS_KEY, 'la nómina de la semana', true,
    () => NOMINA_PERIODOS_CACHE, v => { NOMINA_PERIODOS_CACHE = v; }),
  historialAjustes: _nominaCrearPieza(NOMINA_HISTORIAL_AJUSTES_COLECCION, () => NOMINA_HISTORIAL_KEY, 'el historial de ajustes', false,
    () => NOMINA_HISTORIAL_AJUSTES_CACHE, v => { NOMINA_HISTORIAL_AJUSTES_CACHE = v; }),
  historialEstados: _nominaCrearPieza(NOMINA_HISTORIAL_ESTADOS_COLECCION, () => NOMINA_HISTORIAL_ESTADOS_KEY, 'el historial de estados', false,
    () => NOMINA_HISTORIAL_ESTADOS_CACHE, v => { NOMINA_HISTORIAL_ESTADOS_CACHE = v; }),
  solicitudes: _nominaCrearPieza(NOMINA_SOLICITUDES_COLECCION, () => NOMINA_SOLICITUDES_KEY, 'la solicitud', false,
    () => NOMINA_SOLICITUDES_CACHE, v => { NOMINA_SOLICITUDES_CACHE = v; })
};

// Periodos es un mapa clave → periodo (la clave es el id del documento);
// el resto son arreglos con id. Estas cuatro funciones esconden esa
// diferencia para que el resto del archivo trate todo como una lista.
function _nominaALista(pieza, valor) {
  if (!pieza.esMapa) return valor;
  return Object.keys(valor).map(clave => ({ ...valor[clave], id: clave }));
}
function _nominaLeerItem(pieza, valor, id) {
  if (pieza.esMapa) return valor[id] ? { ...valor[id], id } : null;
  return valor.find(item => String(item.id) === id) || null;
}
function _nominaPonerItem(pieza, valor, id, item) {
  if (pieza.esMapa) { valor[id] = item; return; }
  const i = valor.findIndex(x => String(x.id) === id);
  if (i >= 0) valor[i] = item; else valor.push(item);
}
function _nominaQuitarItem(pieza, valor, id) {
  if (pieza.esMapa) { delete valor[id]; return; }
  const i = valor.findIndex(x => String(x.id) === id);
  if (i >= 0) valor.splice(i, 1);
}

function _nominaRecordarServidor(pieza) {
  pieza.enServidor.clear();
  _nominaALista(pieza, pieza.obtener()).forEach(item => pieza.enServidor.set(String(item.id), textoEstableFirestore(item)));
}

function _nominaSuperar(pieza, id, texto) {
  if (!texto) return;
  if (!pieza.superadas.has(id)) pieza.superadas.set(id, new Set());
  pieza.superadas.get(id).add(texto);
}

function _nominaAplicarEnVivo(pieza, snap) {
  let huboCambios = false;
  const cache = pieza.obtener();
  snap.docChanges().forEach(cambio => {
    const id = String(cambio.doc.id);
    const antes = pieza.enServidor.get(id);
    const local = _nominaLeerItem(pieza, cache, id);
    const cambioPendiente = local && textoEstableFirestore(local) !== antes;
    if (cambio.type === 'removed') {
      if (antes === undefined) return;
      _nominaSuperar(pieza, id, antes);
      pieza.enServidor.delete(id);
      if (local && !cambioPendiente) { _nominaQuitarItem(pieza, cache, id); huboCambios = true; }
      return;
    }
    const item = { ...cambio.doc.data(), id: cambio.doc.id };
    const texto = textoEstableFirestore(item);
    if (texto === antes) return;
    if (antes === undefined && !local) pieza.recibidosEnVivo.add(id);
    _nominaSuperar(pieza, id, antes);
    pieza.enServidor.set(id, texto);
    if (cambioPendiente) return;
    _nominaPonerItem(pieza, cache, id, item);
    huboCambios = true;
  });
  if (!huboCambios) return;
  try { localStorage.setItem(pieza.localKey(), JSON.stringify(cache)); } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:nomina-actualizada', { detail: { coleccion: pieza.coleccion } }));
}

function escucharNominaEnVivo() {
  if (!dbFirestore) return;
  Object.values(_NOMINA_PIEZAS).forEach(pieza => {
    if (pieza.escuchando) return;
    pieza.escuchando = true;
    // Si la escucha falla (sin sesión, sin red) la página sigue como
    // antes: con lo que cargó.
    dbFirestore.collection(pieza.coleccion).onSnapshot(snap => _nominaAplicarEnVivo(pieza, snap), () => {});
  });
}

// Un valor armado antes de un cambio en vivo: sus copias atrasadas se
// cambian por la versión actual y lo que llegó en vivo y no trae se
// conserva, para que la pantalla no muestre datos viejos.
function _nominaConservarRecibidos(pieza, valor) {
  const cache = pieza.obtener();
  if (valor === cache) return valor;
  _nominaALista(pieza, valor).forEach(item => {
    const id = String(item.id);
    const actual = _nominaLeerItem(pieza, cache, id);
    if (actual && pieza.superadas.has(id) && pieza.superadas.get(id).has(textoEstableFirestore(item))) {
      _nominaPonerItem(pieza, valor, id, pieza.esMapa ? cache[id] : actual);
    }
  });
  pieza.recibidosEnVivo.forEach(id => {
    if (_nominaLeerItem(pieza, valor, id)) return;
    const actual = _nominaLeerItem(pieza, cache, id);
    if (actual) _nominaPonerItem(pieza, valor, id, pieza.esMapa ? cache[id] : actual);
  });
  return valor;
}


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
        Object.values(_NOMINA_PIEZAS).forEach(_nominaRecordarServidor);
        _nominaEnServidorCargado = true;
        escucharNominaEnVivo();
      } else {
        // Primera vez que este proyecto de Firestore ve Nómina: solo
        // empleados y conceptos tienen semilla — periodos/historiales/
        // solicitudes arrancan vacíos, igual que ya pasaba en localStorage.
        await Promise.all([
          guardarNominaEmpleadosRepo(nominaEmpleadosSemillaLocal()),
          guardarNominaConceptosRepo(nominaConceptosSemillaLocal())
        ]);
        escucharNominaEnVivo();
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

// Las seis funciones de siempre (las llama nomina-modelo.js) — ahora
// todas pasan por el mismo guardado de "solo lo que cambió".
function _guardarPiezaNomina(pieza, valor) {
  valor = _nominaConservarRecibidos(pieza, valor);
  pieza.asignar(valor);
  try { localStorage.setItem(pieza.localKey(), JSON.stringify(valor)); } catch (error) { /* noop */ }
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoNomina.then(() =>
    sincronizarColeccionNomina(pieza, valor).catch(error => avisarErrorGuardadoNomina(error, pieza.detalle))
  );
  _colaGuardadoNomina = tarea;
  return tarea;
}

function guardarNominaEmpleadosRepo(lista) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.empleados, lista);
}

function guardarNominaConceptosRepo(lista) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.conceptos, lista);
}

// SEC-02: periodos ya no se guarda como un solo documento con el mapa
// completo (nominaMeta/periodos) — cada semana vive en su propio
// documento de nominaPeriodos/{clave}.
function guardarNominaPeriodosRepo(periodos) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.periodos, periodos);
}

function guardarNominaHistorialAjustesRepo(lista) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.historialAjustes, lista);
}

function guardarNominaHistorialEstadosRepo(lista) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.historialEstados, lista);
}

function guardarNominaSolicitudesRepo(lista) {
  return _guardarPiezaNomina(_NOMINA_PIEZAS.solicitudes, lista);
}

async function sincronizarColeccionNomina(pieza, valor) {
  const coleccion = dbFirestore.collection(pieza.coleccion);
  const lista = _nominaALista(pieza, valor);
  // Opción A: solo lo que cambió aquí; solo se borra lo que esta página
  // conocía y quitó (nunca algo creado en BRILLO u otro dispositivo).
  const batch = dbFirestore.batch();
  const escritos = new Map();
  lista.forEach(item => {
    const id = String(item.id);
    const texto = textoEstableFirestore(item);
    if (pieza.enServidor.get(id) === texto) return;
    if (pieza.superadas.has(id) && pieza.superadas.get(id).has(texto)) return;
    batch.set(coleccion.doc(id), item);
    escritos.set(id, texto);
  });
  const idsNuevos = new Set(lista.map(item => String(item.id)));
  const borrados = [];
  pieza.enServidor.forEach((texto, id) => {
    if (!idsNuevos.has(id) && !pieza.recibidosEnVivo.has(id)) {
      batch.delete(coleccion.doc(id));
      borrados.push(id);
    }
  });
  const primeraVez = !_nominaEnServidorCargado;
  if (primeraVez) {
    batch.set(dbFirestore.collection(NOMINA_META_COLECCION).doc(NOMINA_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritos.size && !borrados.length && !primeraVez) return;
  await batch.commit();
  escritos.forEach((texto, id) => pieza.enServidor.set(id, texto));
  borrados.forEach(id => pieza.enServidor.delete(id));
  _nominaEnServidorCargado = true;
}
