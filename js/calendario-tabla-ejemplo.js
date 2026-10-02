// MW JOYERÍA — Calendario editable (Staff / Encargado / Admin)
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// Según el documento de requisitos (Sección 9), el calendario de
// actividades es editable por Staff, Encargado y Administrativos.
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

// SEC-03 de la auditoría: igual que PERSONAL_EJEMPLO en
// staff-apartados-ejemplo.js — credenciales de ejemplo duplicadas, ya
// vaciadas por el mismo motivo (ver cuentas-internas-modelo.js).
const CALENDARIO_USUARIOS_EJEMPLO = [];

const TIPOS_EVENTO_CALENDARIO = [
  { key: 'presencial', label: 'Presencial' },
  { key: 'virtual', label: 'Virtual' }
];

const ORIGENES_EVENTO_CALENDARIO = [
  { key: 'mw', label: 'MW' },
  { key: 'emprendedora_lider', label: 'Emprendedora/Líder' }
];
