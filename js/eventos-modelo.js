// MW JOYERÍA — Modelo compartido de eventos del calendario
//
// El almacenamiento real ya no vive aquí — ver js/eventos-firestore-
// sync.js (EVENTOS_CACHE, eventosRepoListo). Este archivo solo expone
// las mismas dos funciones de siempre para que ninguna página que ya
// las usa tenga que cambiar cómo las llama.

function cargarEventosCompartidos() {
  return EVENTOS_CACHE;
}

function guardarEventosCompartidos(eventos) {
  guardarEventosRepo(eventos);
}
