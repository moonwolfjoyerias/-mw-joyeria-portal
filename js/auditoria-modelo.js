// MW JOYERÍA — Bitácora de actividad compartida (Staff / Encargado / Admin)
//
// El almacenamiento real ya no vive aquí — ver js/auditoria-firestore-
// sync.js (AUDITORIA_CACHE, auditoriaRepoListo, registrarAuditoriaRepo).
// Este archivo solo expone las mismas dos funciones de siempre para
// que ninguna página que ya las usa tenga que cambiar cómo las llama.

function registrarAuditoria({ usuarioId, usuarioNombre, rol, modulo, accion, descripcion }) {

  registrarAuditoriaRepo({
    id: `AUD-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    usuarioId,
    usuarioNombre,
    rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

}

function obtenerAuditoriaCompartida() {
  return AUDITORIA_CACHE;
}
