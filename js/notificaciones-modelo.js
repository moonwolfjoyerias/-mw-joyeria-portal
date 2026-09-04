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
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3.

const NOTIFICACIONES_STORAGE_KEY = 'mw-notificaciones-v1';

function obtenerNotificacionesCompartidas() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(NOTIFICACIONES_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
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
function agregarNotificacion({ texto, link, paraId }) {
  const lista = obtenerNotificacionesCompartidas();
  lista.unshift({
    id: `NOTIF-${Date.now()}`,
    texto,
    link: link || '',
    leida: false,
    paraId: paraId || null
  });
  guardarNotificacionesCompartidas(lista);
}
