// MW JOYERÍA — Bitácora de actividad compartida (Staff / RH / Admin)
//
// Los 3 portales internos escriben en la misma llave de localStorage para
// que cualquiera de los 3 roles pueda ver, desde su pestaña "Actividad",
// quién hizo qué y cuándo — sin importar en qué portal ocurrió la acción.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.

const AUDITORIA_STORAGE_KEY = 'mw-auditoria-v1';

function registrarAuditoria({ usuarioId, usuarioNombre, rol, modulo, accion, descripcion }) {

  const registros = obtenerAuditoriaCompartida();

  registros.unshift({
    id: `AUD-${Date.now()}`,
    usuarioId,
    usuarioNombre,
    rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(AUDITORIA_STORAGE_KEY, JSON.stringify(registros));

}

function obtenerAuditoriaCompartida() {
  try {
    const registros = JSON.parse(localStorage.getItem(AUDITORIA_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}
