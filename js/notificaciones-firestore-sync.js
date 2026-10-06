// MW JOYERÍA — Repositorio de Notificaciones — Fase 2: Firebase
//
// Mismo patrón que apartados-firestore-sync.js / personas-firestore-sync.js:
// una caché en memoria (NOTIFICACIONES_CACHE) que este archivo llena de
// forma ASÍNCRONA una sola vez al cargar la página — notificaciones-
// modelo.js expone encima las mismas funciones síncronas de siempre
// (obtenerNotificacionesCompartidas/guardarNotificacionesCompartidas),
// así ninguna otra página ni ningún llamador de agregarNotificacion()/
// marcarNotificacionLeida() necesita tocarse.
//
// Antes de este archivo, cada aviso (solicitud aprobada, actividad
// asignada, apartado vencido, etc.) se guardaba solo en el localStorage
// de QUIEN lo generó — la persona destinataria, en SU PROPIO
// dispositivo, nunca lo recibía. Con dispositivos separados por
// persona (el caso real de la beta), la campana de notificaciones
// simplemente nunca se encendía para nadie salvo quien disparó la
// acción.
//
// Una sola colección (notificaciones/{id}), diff-y-resync como
// ventanasApartado — se siguen purgando/deduplicando en el cliente
// exactamente igual que antes (ver normalizarYDeduplicarNotificaciones/
// purgarNotificacionesLeidasVencidas en notificaciones-modelo.js), solo
// que ahora la lista de partida viene de Firestore.

const NOTIFICACIONES_COLECCION_FIRESTORE = 'notificaciones';
const NOTIFICACIONES_META_COLECCION = 'notificacionesMeta';
const NOTIFICACIONES_META_DOC_ID = 'estado';

let NOTIFICACIONES_CACHE = [];

function notificacionesSemillaLocal() {
  return (typeof NOTIFICACIONES_EJEMPLO !== 'undefined') ? NOTIFICACIONES_EJEMPLO.map(n => ({ ...n })) : [];
}

function notificacionesDesdeLocalStorage() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(NOTIFICACIONES_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // sigue abajo
  }
  return notificacionesSemillaLocal();
}

async function cargarNotificacionesRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(NOTIFICACIONES_META_COLECCION).doc(NOTIFICACIONES_META_DOC_ID).get();
      if (!metaSnap.exists) {
        const semilla = notificacionesSemillaLocal();
        await guardarNotificacionesRepo(semilla);
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar avisos ya leídos/purgados en
      // otro dispositivo (mismo problema ya corregido en cuentas-
      // firestore-sync.js / personas-firestore-sync.js / etc). Se deja
      // vacío en vez de mostrar datos que podrían estar mal — sin
      // toast aquí a propósito (mismo motivo que ya documenta
      // guardarNotificacionesRepo: no interrumpir lo que se estaba
      // haciendo por un aviso que no cargó).
    }

    // NOTIF-04 de la auditoría: antes esto era un .get() de una sola
    // vez — una notificación nueva (de otra cuenta, o generada por un
    // "tick" de admin-comun.js) nunca se veía hasta refrescar la
    // página. onSnapshot deja la suscripción abierta: cualquier cambio
    // en la colección completa (de cualquier dispositivo) vuelve a
    // pintar la campana aquí mismo, y si lo que llegó es nuevo y sin
    // leer para ESTA cuenta, suena un aviso (contarNotificacionesRelevantesNoLeidas,
    // ver notificaciones-modelo.js — nunca en el primer snapshot, que es
    // solo la carga inicial de lo que ya existía).
    return new Promise((resolve) => {
      let primerSnapshot = true;
      dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE).onSnapshot((snap) => {
        const noLeidasAntes = (!primerSnapshot && typeof contarNotificacionesRelevantesNoLeidas === 'function')
          ? contarNotificacionesRelevantesNoLeidas()
          : 0;

        NOTIFICACIONES_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        try { localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(NOTIFICACIONES_CACHE)); } catch (error) { /* noop */ }

        if (!primerSnapshot) {
          if (typeof contarNotificacionesRelevantesNoLeidas === 'function' && contarNotificacionesRelevantesNoLeidas() > noLeidasAntes
            && typeof reproducirSonidoNotificacion === 'function') {
            reproducirSonidoNotificacion();
          }
          if (typeof actualizarPanelNotificacionesEnVivo === 'function') actualizarPanelNotificacionesEnVivo();
        } else {
          primerSnapshot = false;
          resolve(NOTIFICACIONES_CACHE);
        }
      }, (error) => {
        // Error de reglas/red en la suscripción (ej. se perdió la
        // sesión) — mismo criterio que el catch de arriba: se deja
        // vacío, nunca se rellena con local.
        if (primerSnapshot) {
          NOTIFICACIONES_CACHE = [];
          primerSnapshot = false;
          resolve(NOTIFICACIONES_CACHE);
        }
      });
    });
  }

  NOTIFICACIONES_CACHE = notificacionesDesdeLocalStorage();
  try { localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(NOTIFICACIONES_CACHE)); } catch (error) { /* noop */ }
  return NOTIFICACIONES_CACHE;
}

// Igual que Apartados/Personas: varias notificaciones pueden dispararse
// casi al mismo tiempo (ej. Admin aprobando varias solicitudes seguidas)
// — una cola evita que se pisen entre sí.
let _colaGuardadoNotificaciones = Promise.resolve();

function guardarNotificacionesRepo(lista) {
  NOTIFICACIONES_CACHE = lista;
  try { localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(lista)); } catch (error) { /* noop */ }

  if (!dbFirestore) return Promise.resolve();

  const tarea = _colaGuardadoNotificaciones.then(() =>
    sincronizarNotificacionesConFirestore(lista).catch(error => {
      // Sin toast aquí a propósito: una notificación que no se pudo
      // sincronizar no debe interrumpir la acción que la disparó (ej.
      // aprobar una solicitud) — se reintenta sola en el siguiente
      // guardado (purga diaria, marcar como leída, etc.).
    })
  );
  _colaGuardadoNotificaciones = tarea;
  return tarea;
}

async function sincronizarNotificacionesConFirestore(lista) {
  const coleccion = dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE);

  // SEC-08 de la auditoría: una cuenta de Emprendedora/Líder no puede
  // re-escribir el arreglo COMPLETO de notificaciones (de todo mundo)
  // en un solo batch — la regla ahora exige ser dueña (paraId ==
  // su personaId) para TOCAR un documento que ya existía, y ese
  // arreglo completo siempre trae de vuelta notificaciones ajenas sin
  // ningún cambio real. En vez de repetir el patrón de "guardar solo lo
  // propio" (aquí ella también puede estar CREANDO avisos para otra
  // persona/bandeja, ej. avisar a Staff al cancelar una pieza — eso
  // sigue permitido para cualquier autenticado), se manda solo lo que
  // de verdad cambió: documentos nuevos (siempre permitido) o
  // documentos existentes que SÍ son distintos a lo ya guardado — los
  // que no cambiaron simplemente no se tocan, así nunca disparan la
  // regla de propietario por algo que ni siquiera se está editando.
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.tipo === 'persona') {
    const snapPersona = await coleccion.get();
    const actuales = new Map(snapPersona.docs.map(d => [d.id, d.data()]));
    const miPersonaId = sesion.personaId || (typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null);
    const batchPersona = dbFirestore.batch();
    let hayCambios = false;
    lista.forEach(notificacion => {
      const anterior = actuales.get(String(notificacion.id));
      // BUG reportado tras lanzar a producción: "marcar como leída" de
      // SU PROPIA notificación tronaba el batch COMPLETO (nunca se
      // marcaba) cuando este arreglo local también traía, de paso, una
      // notificación AJENA (otro rol/otra persona) cuya copia local no
      // coincidía con la de Firestore — la regla rechaza esa escritura
      // ajena, y al ser un batch, Firestore rechaza TODO el batch, no
      // solo esa línea. Si el documento ya existe y es de otra persona
      // (paraId puesto y distinto al propio), ni siquiera se compara/
      // intenta escribir — nunca es algo que esta cuenta pueda cambiar
      // de verdad, así que incluirlo solo arriesga tronar el resto.
      if (anterior && anterior.paraId != null && anterior.paraId !== miPersonaId) return;
      if (!anterior || JSON.stringify(anterior) !== JSON.stringify(notificacion)) {
        batchPersona.set(coleccion.doc(String(notificacion.id)), notificacion);
        hayCambios = true;
      }
    });
    if (!hayCambios) return;
    await batchPersona.commit();
    return;
  }

  const snap = await coleccion.get();
  const idsNuevos = new Set(lista.map(n => String(n.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  lista.forEach(notificacion => {
    batch.set(coleccion.doc(String(notificacion.id)), notificacion);
  });
  batch.set(dbFirestore.collection(NOTIFICACIONES_META_COLECCION).doc(NOTIFICACIONES_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}

// FEAT-07: borrado manual de UNA notificación — deliberadamente un
// .delete() de un solo documento, nunca el diff-y-resync de arriba
// (sincronizarNotificacionesConFirestore), que reconstruye/reescribe en
// batch TODA la lista y por eso puede tronar entera por un documento
// ajeno (mismo bug ya corregido en BUG-11/BUG-06). Si la regla la
// rechaza o ya no existía, no hay nada más que hacer: la suscripción en
// vivo es la fuente de verdad, así que si de verdad seguía ahí,
// reaparece sola.
async function eliminarNotificacionDeFirestore(id) {
  if (!dbFirestore) return;
  try {
    await dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE).doc(String(id)).delete();
  } catch (error) {
    // noop — ver comentario de arriba.
  }
}
