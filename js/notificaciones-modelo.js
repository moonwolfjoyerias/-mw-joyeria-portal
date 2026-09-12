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

  return normalizada;
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
      const normalizadas = normalizarYDeduplicarNotificaciones(guardadas);
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
function obtenerNotificacionesPorRol(rol) {
  return obtenerNotificacionesCompartidas().filter(n => (n.rolDestino || 'emprendedora_lider') === rol);
}
