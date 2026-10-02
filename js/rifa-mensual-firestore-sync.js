// MW JOYERÍA — Repositorio de Rifa del mes (FB-03 de la auditoría del 1
// de octubre de 2026)
//
// Mismo patrón que comisiones-firestore-sync.js: cachés en memoria que
// este archivo llena de forma ASÍNCRONA una sola vez al cargar la
// página — rifa-mensual-modelo.js expone encima las mismas funciones
// síncronas de siempre (obtenerConfigsRifaMensual/guardarConfigsRifaMensual,
// obtenerSolicitudesRifaMensual/guardarSolicitudesRifaMensual,
// obtenerVotosRifaMensual/guardarVotosRifaMensual), así ningún otro
// archivo necesita tocarse.
//
// Tres piezas, cada una un documento por "clave" (mismo motivo ya
// corregido en comisionesPagos/nominaPeriodos — nunca un solo documento
// con el mapa completo, para no bloquear la restricción por propietario
// que sí hace falta aquí):
// - rifaMensualConfigs/{mesKey} — modo del mes, opciones (modo
//   votación), ganadora — exclusivo de Admin.
// - rifaMensualSolicitudes/{personaId__mesKey} — solicitud VIGENTE de
//   esa persona ese mes (modo solicitud) — cada persona solo escribe la
//   suya.
// - rifaMensualVotos/{personaId__mesKey} — voto VIGENTE de esa persona
//   ese mes (modo votación) — cada persona solo escribe el suyo.
//
// No hay semilla de ejemplo (igual que Comisiones): arranca vacío tanto
// en localStorage como en Firestore, así que no hace falta un marcador
// "ya se sembró alguna vez" — una colección vacía siempre significa
// "nadie ha configurado/solicitado/votado todavía este mes".

const RIFA_MENSUAL_CONFIGS_COLECCION = 'rifaMensualConfigs';
const RIFA_MENSUAL_SOLICITUDES_COLECCION = 'rifaMensualSolicitudes';
const RIFA_MENSUAL_VOTOS_COLECCION = 'rifaMensualVotos';

let RIFA_MENSUAL_CONFIGS_CACHE = {};
let RIFA_MENSUAL_SOLICITUDES_CACHE = [];
let RIFA_MENSUAL_VOTOS_CACHE = [];

function rifaMensualClavePersonaMes(personaId, mesKey) {
  return `${personaId}__${mesKey}`;
}

function rifaMensualMapaDesdeLocalStorage(key) {
  try {
    const datos = JSON.parse(localStorage.getItem(key));
    return (datos && typeof datos === 'object' && !Array.isArray(datos)) ? datos : {};
  } catch (error) {
    return {};
  }
}

function rifaMensualListaDesdeLocalStorage(key) {
  try {
    const datos = JSON.parse(localStorage.getItem(key));
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    return [];
  }
}

function persistirCachesRifaMensualLocal() {
  try {
    localStorage.setItem(RIFA_MENSUAL_CONFIG_KEY, JSON.stringify(RIFA_MENSUAL_CONFIGS_CACHE));
    localStorage.setItem(RIFA_MENSUAL_SOLICITUDES_KEY, JSON.stringify(RIFA_MENSUAL_SOLICITUDES_CACHE));
    localStorage.setItem(RIFA_MENSUAL_VOTOS_KEY, JSON.stringify(RIFA_MENSUAL_VOTOS_CACHE));
  } catch (error) { /* noop */ }
}

async function cargarRifaMensualRepo() {
  if (dbFirestore) {
    try {
      const [snapConfigs, snapSolicitudes, snapVotos] = await Promise.all([
        dbFirestore.collection(RIFA_MENSUAL_CONFIGS_COLECCION).get(),
        dbFirestore.collection(RIFA_MENSUAL_SOLICITUDES_COLECCION).get(),
        dbFirestore.collection(RIFA_MENSUAL_VOTOS_COLECCION).get()
      ]);
      RIFA_MENSUAL_CONFIGS_CACHE = {};
      snapConfigs.docs.forEach(d => { RIFA_MENSUAL_CONFIGS_CACHE[d.id] = d.data(); });
      RIFA_MENSUAL_SOLICITUDES_CACHE = snapSolicitudes.docs.map(d => d.data());
      RIFA_MENSUAL_VOTOS_CACHE = snapVotos.docs.map(d => d.data());
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: mismo motivo ya corregido en el resto de módulos
      // (podría resucitar/esconder una solicitud o un voto ya
      // actualizado en otro dispositivo). Se avisa y se deja vacío en
      // vez de mostrar datos que podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar la Rifa del mes desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      RIFA_MENSUAL_CONFIGS_CACHE = {};
      RIFA_MENSUAL_SOLICITUDES_CACHE = [];
      RIFA_MENSUAL_VOTOS_CACHE = [];
    }
  } else {
    RIFA_MENSUAL_CONFIGS_CACHE = rifaMensualMapaDesdeLocalStorage(RIFA_MENSUAL_CONFIG_KEY);
    RIFA_MENSUAL_SOLICITUDES_CACHE = rifaMensualListaDesdeLocalStorage(RIFA_MENSUAL_SOLICITUDES_KEY);
    RIFA_MENSUAL_VOTOS_CACHE = rifaMensualListaDesdeLocalStorage(RIFA_MENSUAL_VOTOS_KEY);
  }
  persistirCachesRifaMensualLocal();
  return {
    configs: RIFA_MENSUAL_CONFIGS_CACHE,
    solicitudes: RIFA_MENSUAL_SOLICITUDES_CACHE,
    votos: RIFA_MENSUAL_VOTOS_CACHE
  };
}

// Una sola cola compartida entre las tres piezas — mismo motivo que ya
// documentan apartados-firestore-sync.js / comisiones-firestore-sync.js.
let _colaGuardadoRifaMensual = Promise.resolve();

function avisarErrorGuardadoRifaMensual(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

function guardarConfigsRifaMensualRepo(configs) {
  RIFA_MENSUAL_CONFIGS_CACHE = configs;
  persistirCachesRifaMensualLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoRifaMensual.then(() => {
    const batch = dbFirestore.batch();
    Object.keys(configs).forEach(mesKey => {
      batch.set(dbFirestore.collection(RIFA_MENSUAL_CONFIGS_COLECCION).doc(mesKey), configs[mesKey]);
    });
    return batch.commit().catch(error => avisarErrorGuardadoRifaMensual(error, 'la configuración de la Rifa del mes'));
  });
  _colaGuardadoRifaMensual = tarea;
  return tarea;
}

// Listas con diff-antes-de-escribir (mismo patrón que SEC-08 de la
// auditoría en notificaciones-firestore-sync.js/lista-deseos-firestore-
// sync.js): cada sesión de persona solo puede escribir SU propio
// documento (personaId__mesKey) — comparar contra lo que ya hay en
// Firestore evita mandar en el mismo batch los documentos de otras
// personas que no cambiaron, que la regla de propiedad rechazaría.
async function sincronizarListaRifaMensualPorPersonaMes(nombreColeccion, lista) {
  const coleccion = dbFirestore.collection(nombreColeccion);
  const snap = await coleccion.get();
  const actuales = new Map(snap.docs.map(d => [d.id, d.data()]));
  const batch = dbFirestore.batch();
  let hayCambios = false;
  lista.forEach(item => {
    const clave = rifaMensualClavePersonaMes(item.personaId, item.mesKey);
    const anterior = actuales.get(clave);
    if (!anterior || JSON.stringify(anterior) !== JSON.stringify(item)) {
      batch.set(coleccion.doc(clave), item);
      hayCambios = true;
    }
  });
  if (!hayCambios) return;
  await batch.commit();
}

function guardarSolicitudesRifaMensualRepo(lista) {
  RIFA_MENSUAL_SOLICITUDES_CACHE = lista;
  persistirCachesRifaMensualLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoRifaMensual.then(() =>
    sincronizarListaRifaMensualPorPersonaMes(RIFA_MENSUAL_SOLICITUDES_COLECCION, lista)
      .catch(error => avisarErrorGuardadoRifaMensual(error, 'tu solicitud de la Rifa del mes'))
  );
  _colaGuardadoRifaMensual = tarea;
  return tarea;
}

function guardarVotosRifaMensualRepo(lista) {
  RIFA_MENSUAL_VOTOS_CACHE = lista;
  persistirCachesRifaMensualLocal();
  if (!dbFirestore) return Promise.resolve();
  const tarea = _colaGuardadoRifaMensual.then(() =>
    sincronizarListaRifaMensualPorPersonaMes(RIFA_MENSUAL_VOTOS_COLECCION, lista)
      .catch(error => avisarErrorGuardadoRifaMensual(error, 'tu voto de la Rifa del mes'))
  );
  _colaGuardadoRifaMensual = tarea;
  return tarea;
}
