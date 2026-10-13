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

// Estado de cada notificación en el servidor (id → { texto, paraId }),
// mantenido al día por la suscripción en vivo de abajo. Cada guardado se
// compara contra esto en vez de volver a leer la colección completa, y
// solo escribe/borra lo que de verdad cambió aquí (cuota diaria de
// Firestore), y nunca borra lo que no reconoce — por ejemplo, avisos que
// BRILLO MW crea para una Emprendedora mientras esta página está abierta.
let _notificacionesEnServidor = new Map();

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
        _notificacionesEnServidor = new Map(NOTIFICACIONES_CACHE.map(n => [String(n.id), { texto: textoEstableFirestore(n), paraId: n.paraId }]));
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

  // Solo se pueden borrar notificaciones que ya se conocían al armar esta
  // lista — una que llegue en vivo mientras el guardado espera en la cola
  // no está en `lista` por ser nueva, no porque se haya quitado.
  const idsConocidos = new Set(_notificacionesEnServidor.keys());
  const tarea = _colaGuardadoNotificaciones.then(() =>
    sincronizarNotificacionesConFirestore(lista, idsConocidos).catch(error => {
      // Sin toast aquí a propósito: una notificación que no se pudo
      // sincronizar no debe interrumpir la acción que la disparó (ej.
      // aprobar una solicitud) — se reintenta sola en el siguiente
      // guardado (purga diaria, marcar como leída, etc.).
    })
  );
  _colaGuardadoNotificaciones = tarea;
  return tarea;
}

async function sincronizarNotificacionesConFirestore(lista, idsConocidos) {
  const coleccion = dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE);

  // SEC-08 / BUG-11: una cuenta de Emprendedora/Líder solo puede tocar
  // SUS notificaciones ya existentes (o crear nuevas para quien sea). Un
  // documento ajeno que ya existe nunca se intenta escribir ni borrar —
  // si la regla lo rechaza, Firestore rechaza el batch COMPLETO.
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  const esPersona = !!(sesion && sesion.tipo === 'persona');
  const miPersonaId = esPersona
    ? (sesion.personaId || (typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null))
    : null;
  const esAjena = (anterior) => esPersona && anterior && anterior.paraId != null && anterior.paraId !== miPersonaId;

  const batch = dbFirestore.batch();
  const escritas = new Map();
  const borradas = [];

  lista.forEach(notificacion => {
    const id = String(notificacion.id);
    const anterior = _notificacionesEnServidor.get(id);
    if (esAjena(anterior)) return;
    const texto = textoEstableFirestore(notificacion);
    if (anterior && anterior.texto === texto) return;
    batch.set(coleccion.doc(id), notificacion);
    escritas.set(id, { texto, paraId: notificacion.paraId });
  });

  // Purga / borrado de lo que ya no está en la lista — solo
  // Staff/Encargado/Admin, igual que antes (una Emprendedora/Líder nunca
  // borraba al guardar; ella usa eliminarNotificacionDeFirestore).
  if (!esPersona) {
    const idsLista = new Set(lista.map(n => String(n.id)));
    _notificacionesEnServidor.forEach((anterior, id) => {
      if (idsLista.has(id) || !idsConocidos.has(id)) return;
      batch.delete(coleccion.doc(id));
      borradas.push(id);
    });
  }

  const primeraVez = !esPersona && _notificacionesEnServidor.size === 0;
  if (primeraVez) {
    batch.set(dbFirestore.collection(NOTIFICACIONES_META_COLECCION).doc(NOTIFICACIONES_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritas.size && !borradas.length && !primeraVez) return;

  await batch.commit();
  escritas.forEach((valor, id) => _notificacionesEnServidor.set(id, valor));
  borradas.forEach(id => _notificacionesEnServidor.delete(id));
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

// FEAT-09: mismo motivo que eliminarNotificacionDeFirestore — un
// .set() de UN SOLO documento nuevo, nunca sincronizarNotificacionesConFirestore
// (que compara TODA la lista local contra Firestore). Se necesitaba
// porque crearSolicitudInscripcionPublica (login.html → "Inscribirse")
// corre en una página donde NOTIFICACIONES_CACHE casi nunca está al
// día — nadie ha iniciado sesión todavía, así que el primer intento de
// cargarla (al abrir la página, sin sesión) se rechaza por las reglas y
// se queda vacía. Si esa notificación se agregara por el camino normal
// (agregarNotificacion → guardarNotificacionesCompartidas), el resync
// completo vería la lista local casi vacía y BORRARÍA de Firestore
// cualquier notificación real que no reconociera ahí — de TODOS los
// roles, no solo de esta cuenta. Devuelve true/false para que quien
// llama sepa si de verdad se guardó (ver agregarNotificacionDirecta en
// notificaciones-modelo.js).
async function agregarNotificacionDirectaAFirestore(notificacion) {
  if (!dbFirestore) return false;
  try {
    await dbFirestore.collection(NOTIFICACIONES_COLECCION_FIRESTORE).doc(String(notificacion.id)).set(notificacion);
    return true;
  } catch (error) {
    return false;
  }
}
