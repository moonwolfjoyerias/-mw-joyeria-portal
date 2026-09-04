// MW JOYERÍA — Mi cuenta (Líder): datos de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.

const PERFIL_LIDER_EJEMPLO = {
  // id: identifica a "quien tiene la sesión abierta" en el registro
  // compartido de personas (js/personas-ejemplo.js) — lo usa el módulo
  // de Solicitudes de inscripción para saber quién es el solicitante.
  id: 'me-lider',
  nombre: 'Líder',
  telefono: '444 987 6543',
  correo: 'lider@example.com',
};

const RIFA_LIDER_EJEMPLO = {
  montoAcumuladoMes: 3400, // ejemplo: ya pasó la meta, para ver el caso de boletos extra
  meta: 3000,
};

const CONSTANCIA_LIDER_EJEMPLO = {
  comprasCumplidas: 10,
  montoMesActual: 6200,
  metaMes: 8000,
  hitos: [
    { compras: 6, premio: 'Tablet' },
    { compras: 8, premio: 'Pantalla 43"' },
    { compras: 10, premio: 'Laptop' },
    { compras: 12, premio: 'Viaje x2' },
  ],
};

// % de comisión por nivel, según el rango vigente — Fase 1, Sección 7.3 (valores reales, no inventar otros)
const COMISIONES_PCT = {
  sin_rango: [10, 5, 0, 0, 0],
  plata:     [10, 10, 0, 0, 0],
  oro:       [10, 10, 5, 0, 0],
  diamante:  [10, 10, 5, 2, 0],
  corona:    [10, 10, 5, 3, 1],
};
