// MW JOYERÍA — Repositorio de Comisiones (FB-01 de la auditoría del 1
// de octubre de 2026)
//
// Antes, Comisiones era el único módulo grande que seguía 100% en
// localStorage — a diferencia de Catálogo, Apartados, Personas,
// Cuentas, Notificaciones, Lista de deseos, Actividades del Staff,
// Nómina, Eventos y Auditoría (ya migrados). Admin marcaba una
// comisión como "pagada" en la computadora de la tienda y, desde
// cualquier otro dispositivo, seguía viéndose "Pendiente".
//
// Mismo patrón que nomina-firestore-sync.js: cachés en memoria que
// este archivo llena de forma ASÍNCRONA una sola vez al cargar la
// página — comisiones-modelo.js expone encima las mismas funciones
// síncronas de siempre (obtenerAjustes/guardarAjustes,
// obtenerHistorialAjustes/registrarHistorialAjuste,
// obtenerPagos/guardarPagos, obtenerBonos/guardarBonos,
// obtenerRangosManualesComisiones/guardarRangoManualComision), así
// ningún otro archivo necesita tocarse.
//
// Cinco piezas, cada una un documento por "clave" (mismo patrón ya
// corregido para nominaPeriodos en SEC-02 de la auditoría — nunca un
// solo documento con el mapa completo de todas las claves, para no
// bloquear una futura restricción por propietario):
// - comisionesAjustes/{clave} — valor VIGENTE del ajuste manual (clave:
//   liderId__personaId__periodoKey__subPeriodo).
// - comisionesHistorialAjustes/{id} — bitácora completa de ajustes,
//   SOLO se agrega (antes un arreglo sin id propia — se le agregó uno).
// - comisionesPagos/{clave} — estado de pago por líder/periodo/sub-
//   periodo (clave: liderId__periodoKey__subPeriodo).
// - comisionesBonos/{clave} — bono de rango ya pagado (clave:
//   personaId__rangoKey).
// - comisionesRangoManual/{clave} — rango manual de Admin para ESE mes
//   de pago (clave: personaId__periodoKey).
//
// COMISIONES_BORRADOR_KEY (autoguardado de un cálculo TODAVÍA NO
// sincronizado) NO se migra a propósito — mismo motivo que
// NOMINA_BORRADOR_KEY en nomina-firestore-sync.js: es de quien lo está
// escribiendo en ESE momento en ESE dispositivo, ningún flujo entre
// roles depende de verlo desde otro lado. Se queda igual que hoy, en
// localStorage.

const COMISIONES_AJUSTES_COLECCION = 'comisionesAjustes';
const COMISIONES_HISTORIAL_COLECCION = 'comisionesHistorialAjustes';
const COMISIONES_PAGOS_COLECCION = 'comisionesPagos';
const COMISIONES_BONOS_COLECCION = 'comisionesBonos';
const COMISIONES_RANGO_MANUAL_COLECCION = 'comisionesRangoManual';
const COMISIONES_META_COLECCION = 'comisionesMeta';
const COMISIONES_META_DOC_ID = 'estado';

let COMISIONES_AJUSTES_CACHE = {};
let COMISIONES_HISTORIAL_CACHE = [];
let COMISIONES_PAGOS_CACHE = {};
let COMISIONES_BONOS_CACHE = {};
let COMISIONES_RANGO_MANUAL_CACHE = {};

function comisionesMapaDesdeLocalStorage(key) {
  try {
    const datos = JSON.parse(localStorage.getItem(key));
    return (datos && typeof datos === 'object' && !Array.isArray(datos)) ? datos : {};
  } catch (error) {
    return {};
  }
}

function comisionesHistorialDesdeLocalStorage() {
  try {
    const registros = JSON.parse(localStorage.getItem(COMISIONES_HISTORIAL_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function persistirCachesComisionesLocal() {
  try {
    localStorage.setItem(COMISIONES_AJUSTES_KEY, JSON.stringify(COMISIONES_AJUSTES_CACHE));
    localStorage.setItem(COMISIONES_HISTORIAL_KEY, JSON.stringify(COMISIONES_HISTORIAL_CACHE));
    localStorage.setItem(COMISIONES_PAGOS_KEY, JSON.stringify(COMISIONES_PAGOS_CACHE));
    localStorage.setItem(COMISIONES_BONOS_KEY, JSON.stringify(COMISIONES_BONOS_CACHE));
    localStorage.setItem(COMISIONES_RANGO_MANUAL_KEY, JSON.stringify(COMISIONES_RANGO_MANUAL_CACHE));
  } catch (error) { /* noop */ }
}

async function cargarComisionesRepo() {
  // Comisiones es exclusivo de Admin (ni Staff ni Encargado tienen
  // módulo de Comisiones en su portal — a diferencia de Nómina, aquí
  // no hay ningún permiso.comisiones que active un segundo rol). Las
  // páginas de Líder cargan este archivo solo para las constantes de
  // cálculo (COMISIONES_PCT, etc.) — ninguna llama hoy a las funciones
  // que leen pagos/ajustes/bonos reales. Se evita el intento de lectura
  // (y el aviso de error que vendría con él) para cualquier sesión que
  // no sea Admin, en vez de dejar que la regla de Firestore lo rechace.
  const sesionComisiones = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  const esSesionAdmin = sesionComisiones && sesionComisiones.tipo === 'interna' && sesionComisiones.rol === 'admin';

  if (dbFirestore && !esSesionAdmin) {
    COMISIONES_AJUSTES_CACHE = {};
    COMISIONES_HISTORIAL_CACHE = [];
    COMISIONES_PAGOS_CACHE = {};
    COMISIONES_BONOS_CACHE = {};
    COMISIONES_RANGO_MANUAL_CACHE = {};
  } else if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID).get();
      if (metaSnap.exists) {
        const [snapAjustes, snapHistorial, snapPagos, snapBonos, snapRango] = await Promise.all([
          dbFirestore.collection(COMISIONES_AJUSTES_COLECCION).get(),
          dbFirestore.collection(COMISIONES_HISTORIAL_COLECCION).get(),
          dbFirestore.collection(COMISIONES_PAGOS_COLECCION).get(),
          dbFirestore.collection(COMISIONES_BONOS_COLECCION).get(),
          dbFirestore.collection(COMISIONES_RANGO_MANUAL_COLECCION).get()
        ]);
        COMISIONES_AJUSTES_CACHE = {};
        snapAjustes.docs.forEach(d => { COMISIONES_AJUSTES_CACHE[d.id] = d.data(); });
        COMISIONES_HISTORIAL_CACHE = snapHistorial.docs.map(d => ({ ...d.data(), id: d.id }));
        COMISIONES_PAGOS_CACHE = {};
        snapPagos.docs.forEach(d => { COMISIONES_PAGOS_CACHE[d.id] = d.data(); });
        COMISIONES_BONOS_CACHE = {};
        snapBonos.docs.forEach(d => { COMISIONES_BONOS_CACHE[d.id] = d.data(); });
        COMISIONES_RANGO_MANUAL_CACHE = {};
        snapRango.docs.forEach(d => { COMISIONES_RANGO_MANUAL_CACHE[d.id] = d.data().rangoKey; });
        Object.values(_COMISIONES_PIEZAS).forEach(_comisionesRecordarServidor);
        _comisionesEnServidorCargado = true;
        escucharComisionesEnVivo();
      } else {
        // Primera vez que este proyecto de Firestore ve Comisiones — no
        // hay semilla de ejemplo (a diferencia de Catálogo/Personas):
        // arranca vacío, igual que ya arrancaba vacío en localStorage.
        await dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID).set({ inicializado: true });
        _comisionesEnServidorCargado = true;
        escucharComisionesEnVivo();
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: mismo motivo ya corregido en el resto de módulos
      // (podría resucitar/esconder pagos ya registrados en otro
      // dispositivo). Se avisa y se deja vacío en vez de mostrar datos
      // que podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar Comisiones desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      COMISIONES_AJUSTES_CACHE = {};
      COMISIONES_HISTORIAL_CACHE = [];
      COMISIONES_PAGOS_CACHE = {};
      COMISIONES_BONOS_CACHE = {};
      COMISIONES_RANGO_MANUAL_CACHE = {};
    }
  } else {
    COMISIONES_AJUSTES_CACHE = comisionesMapaDesdeLocalStorage(COMISIONES_AJUSTES_KEY);
    COMISIONES_HISTORIAL_CACHE = comisionesHistorialDesdeLocalStorage();
    COMISIONES_PAGOS_CACHE = comisionesMapaDesdeLocalStorage(COMISIONES_PAGOS_KEY);
    COMISIONES_BONOS_CACHE = comisionesMapaDesdeLocalStorage(COMISIONES_BONOS_KEY);
    COMISIONES_RANGO_MANUAL_CACHE = comisionesMapaDesdeLocalStorage(COMISIONES_RANGO_MANUAL_KEY);
  }
  persistirCachesComisionesLocal();
  return {
    ajustes: COMISIONES_AJUSTES_CACHE,
    historial: COMISIONES_HISTORIAL_CACHE,
    pagos: COMISIONES_PAGOS_CACHE,
    bonos: COMISIONES_BONOS_CACHE,
    rangoManual: COMISIONES_RANGO_MANUAL_CACHE
  };
}

// Una sola cola compartida entre las cinco piezas — mismo motivo que ya
// documentan apartados-firestore-sync.js / nomina-firestore-sync.js.
let _colaGuardadoComisiones = Promise.resolve();

function avisarErrorGuardadoComisiones(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

// Opción A + en vivo (convivencia con BRILLO MW, que también registra
// pagos, bonos, ajustes y rangos manuales en estas mismas colecciones).
// Igual que nomina-firestore-sync.js:
// - Se recuerda cómo estaba cada documento en el servidor y al guardar
//   se envía SOLO lo que cambió aquí; solo se borra lo que esta página
//   conocía y quitó, nunca un documento que no conoce. Antes cada
//   guardado leía la colección completa y la reescribía.
// - onSnapshot (solo Admin) aplica lo que cambie BRILLO u otro
//   dispositivo sobre la misma caché y avisa a la pantalla
//   ('mw:comisiones-actualizadas').
// - Una copia atrasada no se vuelve a enviar, y lo que llegó en vivo no
//   se borra por no venir en un mapa viejo.
// - comisionesMeta/estado solo se escribe la primera vez.
let _comisionesEnServidorCargado = false;

// valor (como lo guarda la caché) ↔ documento (como vive en Firestore).
function _comisionesCrearPieza(coleccion, detalle, obtener, asignar, aDoc, deDoc) {
  return {
    coleccion, detalle, obtener, asignar,
    aDoc: aDoc || (v => v),
    deDoc: deDoc || (d => d),
    enServidor: new Map(),
    superadas: new Map(),
    recibidosEnVivo: new Set(),
    escuchando: false
  };
}

const _COMISIONES_PIEZAS = {
  ajustes: _comisionesCrearPieza(COMISIONES_AJUSTES_COLECCION, 'el ajuste de comisión',
    () => COMISIONES_AJUSTES_CACHE, v => { COMISIONES_AJUSTES_CACHE = v; }),
  pagos: _comisionesCrearPieza(COMISIONES_PAGOS_COLECCION, 'el pago de comisión',
    () => COMISIONES_PAGOS_CACHE, v => { COMISIONES_PAGOS_CACHE = v; }),
  bonos: _comisionesCrearPieza(COMISIONES_BONOS_COLECCION, 'el bono de rango',
    () => COMISIONES_BONOS_CACHE, v => { COMISIONES_BONOS_CACHE = v; }),
  rangoManual: _comisionesCrearPieza(COMISIONES_RANGO_MANUAL_COLECCION, 'el rango manual',
    () => COMISIONES_RANGO_MANUAL_CACHE, v => { COMISIONES_RANGO_MANUAL_CACHE = v; },
    rangoKey => ({ rangoKey }), d => d.rangoKey)
};

function _comisionesTexto(pieza, valor) {
  return textoEstableFirestore(pieza.aDoc(valor));
}

function _comisionesRecordarServidor(pieza) {
  pieza.enServidor.clear();
  const mapa = pieza.obtener();
  Object.keys(mapa).forEach(clave => pieza.enServidor.set(clave, _comisionesTexto(pieza, mapa[clave])));
}

function _comisionesSuperar(pieza, clave, texto) {
  if (!texto) return;
  if (!pieza.superadas.has(clave)) pieza.superadas.set(clave, new Set());
  pieza.superadas.get(clave).add(texto);
}

function _comisionesAplicarEnVivo(pieza, snap) {
  let huboCambios = false;
  const mapa = pieza.obtener();
  snap.docChanges().forEach(cambio => {
    const clave = String(cambio.doc.id);
    const antes = pieza.enServidor.get(clave);
    const local = clave in mapa ? _comisionesTexto(pieza, mapa[clave]) : undefined;
    const cambioPendiente = local !== undefined && local !== antes;
    if (cambio.type === 'removed') {
      if (antes === undefined) return;
      _comisionesSuperar(pieza, clave, antes);
      pieza.enServidor.delete(clave);
      if (local !== undefined && !cambioPendiente) { delete mapa[clave]; huboCambios = true; }
      return;
    }
    const valor = pieza.deDoc(cambio.doc.data());
    const texto = _comisionesTexto(pieza, valor);
    if (texto === antes) return;
    if (antes === undefined && local === undefined) pieza.recibidosEnVivo.add(clave);
    _comisionesSuperar(pieza, clave, antes);
    pieza.enServidor.set(clave, texto);
    if (cambioPendiente) return;
    mapa[clave] = valor;
    huboCambios = true;
  });
  if (!huboCambios) return;
  persistirCachesComisionesLocal();
  window.dispatchEvent(new CustomEvent('mw:comisiones-actualizadas', { detail: { coleccion: pieza.coleccion } }));
}

// El historial de ajustes solo se agrega (un documento por registro): en
// vivo solo se suman los registros nuevos que lleguen.
const _comisionesHistorialIds = new Set();
function _comisionesHistorialEnVivo(snap) {
  let huboCambios = false;
  snap.docChanges().forEach(cambio => {
    if (cambio.type !== 'added' || _comisionesHistorialIds.has(cambio.doc.id)) return;
    _comisionesHistorialIds.add(cambio.doc.id);
    COMISIONES_HISTORIAL_CACHE.push({ ...cambio.doc.data(), id: cambio.doc.id });
    huboCambios = true;
  });
  if (!huboCambios) return;
  persistirCachesComisionesLocal();
  window.dispatchEvent(new CustomEvent('mw:comisiones-actualizadas', { detail: { coleccion: COMISIONES_HISTORIAL_COLECCION } }));
}

let _escuchaHistorialComisiones = false;
function escucharComisionesEnVivo() {
  if (!dbFirestore) return;
  Object.values(_COMISIONES_PIEZAS).forEach(pieza => {
    if (pieza.escuchando) return;
    pieza.escuchando = true;
    // Si la escucha falla (sin sesión, sin red) la página sigue como
    // antes: con lo que cargó.
    dbFirestore.collection(pieza.coleccion).onSnapshot(snap => _comisionesAplicarEnVivo(pieza, snap), () => {});
  });
  if (!_escuchaHistorialComisiones) {
    _escuchaHistorialComisiones = true;
    COMISIONES_HISTORIAL_CACHE.forEach(r => _comisionesHistorialIds.add(String(r.id)));
    dbFirestore.collection(COMISIONES_HISTORIAL_COLECCION).onSnapshot(_comisionesHistorialEnVivo, () => {});
  }
}

// Un mapa armado antes de un cambio en vivo: sus copias atrasadas se
// cambian por la versión actual y lo que llegó en vivo y no trae se
// conserva, para que la pantalla no muestre datos viejos.
function _comisionesConservarRecibidos(pieza, mapa) {
  const actual = pieza.obtener();
  if (mapa === actual) return mapa;
  Object.keys(mapa).forEach(clave => {
    if (pieza.superadas.has(clave) && pieza.superadas.get(clave).has(_comisionesTexto(pieza, mapa[clave])) && clave in actual) mapa[clave] = actual[clave];
  });
  pieza.recibidosEnVivo.forEach(clave => {
    if (!(clave in mapa) && clave in actual) mapa[clave] = actual[clave];
  });
  return mapa;
}

async function sincronizarMapaComisiones(pieza, mapa) {
  const coleccion = dbFirestore.collection(pieza.coleccion);
  const batch = dbFirestore.batch();
  const escritos = new Map();
  Object.keys(mapa).forEach(clave => {
    const texto = _comisionesTexto(pieza, mapa[clave]);
    if (pieza.enServidor.get(clave) === texto) return;
    if (pieza.superadas.has(clave) && pieza.superadas.get(clave).has(texto)) return;
    batch.set(coleccion.doc(clave), pieza.aDoc(mapa[clave]));
    escritos.set(clave, texto);
  });
  const borrados = [];
  pieza.enServidor.forEach((texto, clave) => {
    if (!(clave in mapa) && !pieza.recibidosEnVivo.has(clave)) {
      batch.delete(coleccion.doc(clave));
      borrados.push(clave);
    }
  });
  const primeraVez = !_comisionesEnServidorCargado;
  if (primeraVez) {
    batch.set(dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritos.size && !borrados.length && !primeraVez) return;
  await batch.commit();
  escritos.forEach((texto, clave) => pieza.enServidor.set(clave, texto));
  borrados.forEach(clave => pieza.enServidor.delete(clave));
  _comisionesEnServidorCargado = true;
}

function _guardarPiezaComisiones(pieza, mapa) {
  mapa = _comisionesConservarRecibidos(pieza, mapa);
  pieza.asignar(mapa);
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    sincronizarMapaComisiones(pieza, mapa).catch(error => avisarErrorGuardadoComisiones(error, pieza.detalle))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function guardarAjustesRepo(ajustes) {
  return _guardarPiezaComisiones(_COMISIONES_PIEZAS.ajustes, ajustes);
}

function registrarHistorialAjusteRepo(registro) {
  COMISIONES_HISTORIAL_CACHE.push(registro);
  _comisionesHistorialIds.add(String(registro.id));
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    dbFirestore.collection(COMISIONES_HISTORIAL_COLECCION).doc(registro.id).set(registro)
      .catch(error => avisarErrorGuardadoComisiones(error, 'el historial de ajustes'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function guardarPagosRepo(pagos) {
  return _guardarPiezaComisiones(_COMISIONES_PIEZAS.pagos, pagos);
}

function guardarBonosRepo(bonos) {
  return _guardarPiezaComisiones(_COMISIONES_PIEZAS.bonos, bonos);
}

function guardarRangoManualRepo(mapa) {
  return _guardarPiezaComisiones(_COMISIONES_PIEZAS.rangoManual, mapa);
}
