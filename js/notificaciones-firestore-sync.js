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
// purgarNotificacionesDeDiasAnteriores en notificaciones-modelo.js), solo
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
      if (metaSnap.exists) {
        const snap = await dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE).get();
        NOTIFICACIONES_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      } else {
        const semilla = notificacionesSemillaLocal();
        await guardarNotificacionesRepo(semilla);
      }
    } catch (error) {
      NOTIFICACIONES_CACHE = notificacionesDesdeLocalStorage();
    }
  } else {
    NOTIFICACIONES_CACHE = notificacionesDesdeLocalStorage();
  }
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
