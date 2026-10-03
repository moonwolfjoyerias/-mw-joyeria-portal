// MW JOYERÍA — Notificaciones internas (persistidas)
//
// Extiende js/notificaciones-ejemplo.js (NOTIFICACIONES_EJEMPLO) en
// lugar de crear un sistema paralelo: la campana de notificaciones
// (js/portal-common.js → initNotifPanel) sigue leyendo exactamente la
// misma forma { id, texto, link, leida }, solo que ahora puede venir
// de localStorage cuando esta página también carga este archivo, para
// poder agregar notificaciones nuevas (por ejemplo, cuando Admin
// aprueba o rechaza una Solicitud de inscripción).
//
// Páginas que NO cargan este archivo siguen mostrando el arreglo
// estático de siempre — cero cambio de comportamiento para ellas.
//
// rolDestino: a qué bandeja pertenece la notificación —
// 'emprendedora_lider' | 'staff' | 'encargado' | 'admin'. Los portales de
// Emprendedora/Líder, Staff y Encargado solo ven las de su propio rol (se
// detecta automáticamente por la URL, ver portal-common.js). Admin ve
// las tres bandejas divididas (ver admin-comun.js →
// renderNotificacionesAdminAgrupadas). No reemplaza a "paraId" (a
// quién pertenece exactamente) — son cosas distintas: paraId es PARA
// QUIÉN es, rolDestino es EN QUÉ BANDEJA aparece.
//
// Fase 2 (Firebase): ya sincroniza con Firestore (colección
// "notificaciones") vía js/notificaciones-firestore-sync.js — ver ese
// archivo para la caché/carga asíncrona. Necesario porque cada rol usa
// su PROPIO dispositivo: sin esto, un aviso generado en el dispositivo
// de quien lo dispara nunca llegaba al de la persona destinataria.

const NOTIFICACIONES_STORAGE_KEY = 'mw-notificaciones-v1';
const ROLES_NOTIF_VALIDOS = ['emprendedora_lider', 'staff', 'encargado', 'admin'];

function esNotificacionEncargadoExclusiva(notificacion) {
  return notificacion.tipo === 'nomina';
}

function normalizarNotificacion(notificacion) {
  const normalizada = { ...notificacion };

  // Catálogo, apartados, deseos, calendario y actividades generales son
  // funciones compartidas: Admin las clasifica una sola vez como Staff.
  if (normalizada.rolDestino === 'encargado' && !esNotificacionEncargadoExclusiva(normalizada)) {
    normalizada.rolDestino = 'staff';
  }

  // Fecha de creación — informativa, ya no decide el borrado (ver
  // purgarNotificacionesLeidasVencidas). Las que ya existían sin este
  // campo se sellan con "ahora" la primera vez que se leen.
  if (!normalizada.creadaEn) normalizada.creadaEn = new Date().toISOString();

  // Ya estaba marcada como leída antes de este cambio (sin leidaEn
  // todavía) — se sella con "ahora" en vez de dejarla sin fecha para
  // siempre (nunca se borraría sola) o borrarla de inmediato (el clic
  // real pudo haber sido hace mucho). Las nuevas siempre la traen desde
  // marcarNotificacionLeida().
  if (normalizada.leida && !normalizada.leidaEn) normalizada.leidaEn = new Date().toISOString();

  return normalizada;
}

// BUG/mejora reportada tras lanzar a producción: antes se borraba TODO
// lo que no fuera de "hoy" (leído o no) — una notificación sin leer
// podía desaparecer sola a medianoche sin que nadie la viera. Ahora solo
// se borra lo que YA se marcó como leída (clic en la campana, ver
// marcarNotificacionLeida) y han pasado 24 horas desde ese momento — una
// sin leer nunca se borra sola, sin importar cuántos días lleve. No hay
// proceso en segundo plano (esto es localStorage/Firestore, no un
// servidor con cron), así que el borrado ocurre la próxima vez que
// alguien abre la campana, igual que antes.
const NOTIF_HORAS_BORRAR_LEIDA = 24;

function notificacionLeidaVencida(notificacion) {
  if (!notificacion.leida) return false;
  if (!notificacion.leidaEn) return false; // se leyó antes de este cambio — se sella la primera vez que se detecta, ver abajo
  const leidaEn = new Date(notificacion.leidaEn).getTime();
  if (Number.isNaN(leidaEn)) return false;
  return (Date.now() - leidaEn) >= NOTIF_HORAS_BORRAR_LEIDA * 60 * 60 * 1000;
}

function purgarNotificacionesLeidasVencidas(lista) {
  return lista.filter(n => !notificacionLeidaVencida(n));
}

function claveUnicaNotificacion(notificacion) {
  const link = String(notificacion.link || '').replace(/encargado-/g, 'staff-');
  return [notificacion.paraId || '', notificacion.texto || '', link].join('|');
}

function normalizarYDeduplicarNotificaciones(lista) {
  const vistas = new Set();
  return lista.map(normalizarNotificacion).filter(notificacion => {
    const clave = claveUnicaNotificacion(notificacion);
    if (vistas.has(clave)) return false;
    vistas.add(clave);
    return true;
  });
}

function obtenerNotificacionesCompartidas() {
  const guardadas = NOTIFICACIONES_CACHE;
  const normalizadas = purgarNotificacionesLeidasVencidas(normalizarYDeduplicarNotificaciones(guardadas));
  if (normalizadas.length !== guardadas.length || JSON.stringify(normalizadas) !== JSON.stringify(guardadas)) {
    guardarNotificacionesCompartidas(normalizadas);
  }
  return normalizadas;
}

function guardarNotificacionesCompartidas(lista) {
  guardarNotificacionesRepo(lista);
}

// paraId: a quién pertenece (usuarioId de la persona). Es opcional y no
// afecta la campana actual (que siempre muestra la lista completa,
// igual que antes) — queda guardado para cuando el portal tenga sesión
// real y pueda filtrar por usuario.
// rolDestino: en qué bandeja aparece (ver arriba). Si se omite, se
// asume 'emprendedora_lider' (era el único rol con notificaciones
// antes de dividirlas).
// origen: SOLO tiene sentido dentro de la bandeja 'admin' — de dónde
// viene el aviso ('emprendedora_lider' o 'encargado'), para que Admin la vea
// dividida en dos grupos separados (ver admin-comun.js →
// renderNotificacionesAdminAgrupadas). Si se omite, se asume
// 'emprendedora_lider' (era el único origen antes de dividirlos).
// productoId: FEAT-03 pedida tras lanzar a producción — cuando el aviso
// es "ya está disponible lo que pediste", lleva el id del producto real
// del catálogo para que el panel de notificaciones (portal-common.js)
// arme el link directo a apartarlo (?apartar=), no solo un aviso
// genérico que la obliga a buscarlo ella misma.
function agregarNotificacion({ texto, link, paraId, rolDestino, tipo, origen, productoId }) {
  const lista = obtenerNotificacionesCompartidas();
  const nueva = normalizarNotificacion({
    id: `NOTIF-${Date.now()}`,
    texto,
    link: link || '',
    leida: false,
    paraId: paraId || null,
    tipo: tipo || null,
    origen: origen || 'emprendedora_lider',
    productoId: productoId || null,
    rolDestino: ROLES_NOTIF_VALIDOS.includes(rolDestino) ? rolDestino : 'emprendedora_lider'
  });

  const claveNueva = claveUnicaNotificacion(nueva);
  if (lista.some(notificacion => claveUnicaNotificacion(notificacion) === claveNueva)) return;

  lista.unshift(nueva);
  guardarNotificacionesCompartidas(lista);
}

// Marca una notificación como leída (clic en la campana) — persiste de
// inmediato para que, al reabrir el panel, ya aparezca atenuada y no
// cuente en el badge de "sin leer". leidaEn sella el momento exacto —
// purgarNotificacionesLeidasVencidas la borra sola 24 horas después.
function marcarNotificacionLeida(id) {
  const lista = obtenerNotificacionesCompartidas();
  const notif = lista.find(n => n.id === id);
  if (!notif || notif.leida) return;
  notif.leida = true;
  notif.leidaEn = new Date().toISOString();
  guardarNotificacionesCompartidas(lista);
}

// Delegado en document (no en cada panel, que se vuelve a pintar
// seguido): cualquier .notif-item con data-notif-id, en cualquier
// portal, se marca como leída al hacer clic — justo antes de que el
// propio <a> navegue a su link.
document.addEventListener('click', (e) => {
  const item = e.target.closest?.('.notif-item[data-notif-id]');
  if (!item || typeof marcarNotificacionLeida !== 'function') return;
  marcarNotificacionLeida(item.getAttribute('data-notif-id'));
});

// Detecta el rol del portal actual a partir de la URL — no depende de
// que la página defina nada extra. Devuelve null fuera de /portal/.
function obtenerRolPortalActual() {
  const ruta = window.location.pathname;
  if (ruta.includes('/portal/staff/')) return 'staff';
  if (ruta.includes('/portal/encargado/')) return 'encargado';
  if (ruta.includes('/portal/admin/')) return 'admin';
  if (ruta.includes('/portal/emprendedora/') || ruta.includes('/portal/lider/')) return 'emprendedora_lider';
  return null;
}

// Notificaciones que le tocan a la bandeja de un rol específico —
// usada por la campana de Emprendedora/Líder, Staff y Encargado. Admin
// no la usa (ve las tres bandejas divididas, no una sola filtrada).
//
// La bandeja 'emprendedora_lider' es personal, no de equipo (a
// diferencia de 'staff'/'encargado', que sí son bandejas compartidas a
// propósito): cada aviso que se genera ahí ya trae paraId puesto por
// quien lo crea (ver todos los agregarNotificacion({ rolDestino:
// 'emprendedora_lider', ... }) del portal), así que además de la
// bandeja hay que exigir que sea PARA la persona con la sesión
// abierta — si no, cualquier Emprendedora o Líder ve los avisos
// privados de todas las demás (premios, ascensos, alertas de equipo
// ajeno, etc.). Los pocos ejemplos sin paraId (NOTIFICACIONES_EJEMPLO)
// se siguen mostrando a cualquiera, igual que siempre.
function obtenerNotificacionesPorRol(rol) {
  const notificaciones = obtenerNotificacionesCompartidas().filter(n => (n.rolDestino || 'emprendedora_lider') === rol);
  if (rol !== 'emprendedora_lider') return notificaciones;
  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  return notificaciones.filter(n => !n.paraId || n.paraId === idActual);
}

// Arranca la carga de notificaciones-firestore-sync.js — tiene que ser
// AQUÍ (no en ese archivo, que se carga primero) porque
// cargarNotificacionesRepo() necesita NOTIFICACIONES_EJEMPLO, definida
// en notificaciones-ejemplo.js, para la semilla (mismo motivo/mismo
// orden que personas-ejemplo.js con personas-firestore-sync.js).
const notificacionesRepoListo = cargarNotificacionesRepo();
