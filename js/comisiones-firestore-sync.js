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
      } else {
        // Primera vez que este proyecto de Firestore ve Comisiones — no
        // hay semilla de ejemplo (a diferencia de Catálogo/Personas):
        // arranca vacío, igual que ya arrancaba vacío en localStorage.
        await dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID).set({ inicializado: true });
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

async function sincronizarMapaComisiones(nombreColeccion, mapa, transformarValor) {
  const coleccion = dbFirestore.collection(nombreColeccion);
  const snap = await coleccion.get();
  const clavesNuevas = new Set(Object.keys(mapa));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!clavesNuevas.has(doc.id)) batch.delete(doc.ref);
  });
  Object.keys(mapa).forEach(clave => {
    const valor = transformarValor ? transformarValor(mapa[clave]) : mapa[clave];
    batch.set(coleccion.doc(clave), valor);
  });
  batch.set(dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}

function guardarAjustesRepo(ajustes) {
  COMISIONES_AJUSTES_CACHE = ajustes;
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    sincronizarMapaComisiones(COMISIONES_AJUSTES_COLECCION, ajustes).catch(error => avisarErrorGuardadoComisiones(error, 'el ajuste de comisión'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function registrarHistorialAjusteRepo(registro) {
  COMISIONES_HISTORIAL_CACHE.push(registro);
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    dbFirestore.collection(COMISIONES_HISTORIAL_COLECCION).doc(registro.id).set(registro)
      .then(() => dbFirestore.collection(COMISIONES_META_COLECCION).doc(COMISIONES_META_DOC_ID).set({ inicializado: true }, { merge: true }))
      .catch(error => avisarErrorGuardadoComisiones(error, 'el historial de ajustes'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function guardarPagosRepo(pagos) {
  COMISIONES_PAGOS_CACHE = pagos;
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    sincronizarMapaComisiones(COMISIONES_PAGOS_COLECCION, pagos).catch(error => avisarErrorGuardadoComisiones(error, 'el pago de comisión'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function guardarBonosRepo(bonos) {
  COMISIONES_BONOS_CACHE = bonos;
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    sincronizarMapaComisiones(COMISIONES_BONOS_COLECCION, bonos).catch(error => avisarErrorGuardadoComisiones(error, 'el bono de rango'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}

function guardarRangoManualRepo(mapa) {
  COMISIONES_RANGO_MANUAL_CACHE = mapa;
  persistirCachesComisionesLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoComisiones.then(() =>
    sincronizarMapaComisiones(COMISIONES_RANGO_MANUAL_COLECCION, mapa, (rangoKey) => ({ rangoKey })).catch(error => avisarErrorGuardadoComisiones(error, 'el rango manual'))
  );
  _colaGuardadoComisiones = tarea;
  return tarea;
}
