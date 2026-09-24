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
// 'emprendedora_lider' | 'staff' | 'rh' | 'admin'. Los portales de
// Emprendedora/Líder, Staff y RH solo ven las de su propio rol (se
// detecta automáticamente por la URL, ver portal-common.js). Admin ve
// las tres bandejas divididas (ver admin-comun.js →
// renderNotificacionesAdminAgrupadas). No reemplaza a "paraId" (a
// quién pertenece exactamente) — son cosas distintas: paraId es PARA
// QUIÉN es, rolDestino es EN QUÉ BANDEJA aparece.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3.

const NOTIFICACIONES_STORAGE_KEY = 'mw-notificaciones-v1';
const ROLES_NOTIF_VALIDOS = ['emprendedora_lider', 'staff', 'rh', 'admin'];

function esNotificacionRHExclusiva(notificacion) {
  return notificacion.tipo === 'nomina';
}

function normalizarNotificacion(notificacion) {
  const normalizada = { ...notificacion };

  // Catálogo, apartados, deseos, calendario y actividades generales son
  // funciones compartidas: Admin las clasifica una sola vez como Staff.
  if (normalizada.rolDestino === 'rh' && !esNotificacionRHExclusiva(normalizada)) {
    normalizada.rolDestino = 'staff';
  }

  // Fecha de creación — necesaria para poder borrar automáticamente las
  // notificaciones del día anterior (ver purgarNotificacionesDeDiasAnteriores).
  // Las que ya existían sin este campo (datos de ejemplo, o guardadas
  // antes de este cambio) se sellan con "ahora" la primera vez que se
  // leen, así no se borran de inmediato por no tener fecha.
  if (!normalizada.creadaEn) normalizada.creadaEn = new Date().toISOString();

  return normalizada;
}

// Compara solo año/mes/día (hora local) — una notificación creada hoy
// sigue viva aunque hayan pasado varias horas; una de ayer o antes no.
function esNotificacionDeHoy(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return true;
  const hoy = new Date();
  return fecha.getFullYear() === hoy.getFullYear()
    && fecha.getMonth() === hoy.getMonth()
    && fecha.getDate() === hoy.getDate();
}

// "Borrarlas al final del día": no hay un proceso en segundo plano que
// corra a medianoche (esto es localStorage, no un servidor), así que el
// borrado ocurre en el primer momento en que alguien vuelve a abrir la
// campana de notificaciones en un día distinto al que se crearon —
// desaparecen igual, solo que el "final del día" se detecta la próxima
// vez que se leen en vez de con un temporizador.
function purgarNotificacionesDeDiasAnteriores(lista) {
  return lista.filter(n => esNotificacionDeHoy(n.creadaEn));
}

function claveUnicaNotificacion(notificacion) {
  const link = String(notificacion.link || '').replace(/rh-/g, 'staff-');
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
  try {
    const guardadas = JSON.parse(localStorage.getItem(NOTIFICACIONES_STORAGE_KEY));
    if (Array.isArray(guardadas)) {
      const normalizadas = purgarNotificacionesDeDiasAnteriores(normalizarYDeduplicarNotificaciones(guardadas));
      if (normalizadas.length !== guardadas.length || JSON.stringify(normalizadas) !== JSON.stringify(guardadas)) {
        guardarNotificacionesCompartidas(normalizadas);
      }
      return normalizadas;
    }
  } catch (error) {
    // sigue abajo y reconstruye desde el ejemplo estático
  }

  const base = (typeof NOTIFICACIONES_EJEMPLO !== 'undefined')
    ? NOTIFICACIONES_EJEMPLO.map(n => ({ ...n }))
    : [];

  guardarNotificacionesCompartidas(base);
  return base;
}

function guardarNotificacionesCompartidas(lista) {
  localStorage.setItem(NOTIFICACIONES_STORAGE_KEY, JSON.stringify(lista));
}

// paraId: a quién pertenece (usuarioId de la persona). Es opcional y no
// afecta la campana actual (que siempre muestra la lista completa,
// igual que antes) — queda guardado para cuando el portal tenga sesión
// real y pueda filtrar por usuario.
// rolDestino: en qué bandeja aparece (ver arriba). Si se omite, se
// asume 'emprendedora_lider' (era el único rol con notificaciones
// antes de dividirlas).
// origen: SOLO tiene sentido dentro de la bandeja 'admin' — de dónde
// viene el aviso ('emprendedora_lider' o 'rh'), para que Admin la vea
// dividida en dos grupos separados (ver admin-comun.js →
// renderNotificacionesAdminAgrupadas). Si se omite, se asume
// 'emprendedora_lider' (era el único origen antes de dividirlos).
function agregarNotificacion({ texto, link, paraId, rolDestino, tipo, origen }) {
  const lista = obtenerNotificacionesCompartidas();
  const nueva = normalizarNotificacion({
    id: `NOTIF-${Date.now()}`,
    texto,
    link: link || '',
    leida: false,
    paraId: paraId || null,
    tipo: tipo || null,
    origen: origen || 'emprendedora_lider',
    rolDestino: ROLES_NOTIF_VALIDOS.includes(rolDestino) ? rolDestino : 'emprendedora_lider'
  });

  const claveNueva = claveUnicaNotificacion(nueva);
  if (lista.some(notificacion => claveUnicaNotificacion(notificacion) === claveNueva)) return;

  lista.unshift(nueva);
  guardarNotificacionesCompartidas(lista);
}

// Marca una notificación como leída (clic en la campana) — persiste de
// inmediato para que, al reabrir el panel, ya aparezca atenuada y no
// cuente en el badge de "sin leer".
function marcarNotificacionLeida(id) {
  const lista = obtenerNotificacionesCompartidas();
  const notif = lista.find(n => n.id === id);
  if (!notif || notif.leida) return;
  notif.leida = true;
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
  if (ruta.includes('/portal/rh/')) return 'rh';
  if (ruta.includes('/portal/admin/')) return 'admin';
  if (ruta.includes('/portal/emprendedora/') || ruta.includes('/portal/lider/')) return 'emprendedora_lider';
  return null;
}

// Notificaciones que le tocan a la bandeja de un rol específico —
// usada por la campana de Emprendedora/Líder, Staff y RH. Admin no la
// usa (ve las tres bandejas divididas, no una sola filtrada).
//
// La bandeja 'emprendedora_lider' es personal, no de equipo (a
// diferencia de 'staff'/'rh', que sí son bandejas compartidas a
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
