// MW JOYERÍA — Modelo compartido de eventos del calendario
// Depende de EVENTOS_EJEMPLO (eventos-ejemplo.js), que se usa como
// semilla inicial. A partir de ahí, todos los roles leen/escriben el
// mismo calendario vía localStorage.
// ⚠️ TEMPORAL: localStorage simula la base de datos compartida hasta
// integrar Firestore en Fase 3.

const EVENTOS_STORAGE_KEY = 'mw-eventos-v1';

function cargarEventosCompartidos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(EVENTOS_STORAGE_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) {
    // localStorage inválido: seguimos con la semilla de ejemplo.
  }
  return (typeof EVENTOS_EJEMPLO === 'undefined' ? [] : EVENTOS_EJEMPLO).map(ev => ({ ...ev }));
}

function guardarEventosCompartidos(eventos) {
  localStorage.setItem(EVENTOS_STORAGE_KEY, JSON.stringify(eventos));
}
