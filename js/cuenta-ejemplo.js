// MW JOYERÍA — Mi cuenta: datos de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.

const CUENTA_EJEMPLO = {
  // id: identifica a "quien tiene la sesión abierta" en el registro
  // compartido de personas (js/personas-ejemplo.js) — lo usa el módulo
  // de Solicitudes de inscripción para saber quién es el solicitante.
  id: 'me-emprendedora',
  nombre: 'Claudia Ramírez',
  lider: 'Ana Torres',
  telefono: '444 123 4567',
  correo: 'claudia.ramirez@example.com',
};

const RIFA_EJEMPLO = {
  montoAcumuladoMes: 2150, // precio emprendedora, mes en curso
  meta: 3000,
};

const CONSTANCIA_EJEMPLO = {
  mesesCumplidos: 7, // de por vida, no necesariamente consecutivos
  montoMesActual: 5200,
  metaMes: 8000,
  hitos: [
    { meses: 6, premio: 'Tablet' },
    { meses: 8, premio: 'Pantalla 43"' },
    { meses: 10, premio: 'Laptop' },
    { meses: 12, premio: 'Viaje x2' },
  ],
};
