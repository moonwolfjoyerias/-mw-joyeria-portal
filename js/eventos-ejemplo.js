// MW JOYERÍA — Eventos de ejemplo (portal, todos los roles)
// ⚠️ TEMPORAL: se reemplaza por eventos reales de Firestore en Fase 3.
// Forma esperada:
//   { id, fecha: 'YYYY-MM-DD', titulo, hora, tipo: 'presencial'|'virtual',
//     lugarTexto, enlace, descripcion, tieneFoto,
//     origen: 'mw' | 'emprendedora_lider', asistentes: [] }
//
// tipo determina el color y qué botón de enlace se muestra:
//   presencial -> "Ver ubicación" (Google Maps)
//   virtual    -> "Unirme por Zoom"
//
// origen distingue un evento oficial de MW ('mw', la mayoría) de uno
// que una Emprendedora/Líder organizó e invitó a las demás (nace de
// una Solicitud de evento aprobada — ver solicitudes-eventos-modelo.js)
// — el calendario de Emprendedora/Líder los muestra en una sección
// aparte ("Invitaciones de tu comunidad").
//
// asistentes: lista de quienes confirmaron asistencia (Sección de
// lista de asistencia) — { personaId, nombre, fecha }, se llena con el
// botón "Confirmar asistencia" del modal del evento, nunca a mano.

const EVENTOS_EJEMPLO = [
  {
    id: 'ev1', fecha: '2026-07-25', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Desayuna, convive con el equipo y participa en la rifa mensual.',
    tieneFoto: true, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev2', fecha: '2026-08-06', titulo: 'Evento MW: Capacitación', hora: '5:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Capacitación para líderes: estrategias que transforman tu equipo.',
    tieneFoto: false, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev3', fecha: '2026-08-08', titulo: 'Actividad de comunidad', hora: '6:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Conferencia especial para toda la comunidad MW.',
    tieneFoto: false, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev4', fecha: '2026-08-15', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Desayuna, convive con el equipo y participa en la rifa mensual.',
    tieneFoto: true, origen: 'mw',
    asistentes: [
      { personaId: 'maria-fernanda', nombre: 'María Fernanda Gómez Ruiz', fecha: '2026-08-10T14:00:00.000Z' },
      { personaId: 'sofia-hernandez', nombre: 'Sofía Hernández', fecha: '2026-08-11T09:00:00.000Z' }
    ],
  },
  {
    id: 'ev5', fecha: '2026-08-22', titulo: 'Gala Anual MW', hora: '7:00 p.m.',
    tipo: 'presencial', lugarTexto: 'Salón Jardín, San Luis Potosí',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+Jard%C3%ADn+San+Luis+Potosi',
    descripcion: 'Nuestra gran gala anual — cena, reconocimientos y muchas sorpresas.',
    tieneFoto: true, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev6', fecha: '2026-08-29', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Cerramos el mes con energía y grandes premios.',
    tieneFoto: true, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev7', fecha: '2026-09-05', titulo: 'Evento MW: Nuevas Colecciones', hora: '5:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Presentación en vivo de las piezas que llegan este mes.',
    tieneFoto: false, origen: 'mw', asistentes: [],
  },
  {
    id: 'ev8', fecha: '2026-09-12', titulo: 'Actividad de comunidad', hora: '10:00 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Encuentro presencial para conocer a otras emprendedoras MW.',
    tieneFoto: true, origen: 'mw', asistentes: [],
  },
  // Ejemplo de evento de Emprendedora/Líder (nació de una Solicitud de
  // evento ya aprobada) — se muestra aparte en "Invitaciones de tu
  // comunidad" en el calendario de Emprendedora/Líder.
  {
    id: 'ev9', fecha: '2026-10-03', titulo: 'Presentación MW en Rioverde', hora: '6:00 p.m.',
    tipo: 'presencial', lugarTexto: 'Plaza Principal, Rioverde, S.L.P.',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Plaza+Principal+Rioverde+SLP',
    descripcion: '¡Las invito a todas! Voy a presentar el catálogo y el Plan MW en Rioverde — ven a conocer las piezas nuevas y trae a quien quieras invitar.',
    tieneFoto: false, origen: 'emprendedora_lider',
    solicitanteId: 'ana-torres', solicitanteNombre: 'Ana Torres',
    asistentes: [
      { personaId: 'valeria-ramirez', nombre: 'Valeria Ramírez', fecha: '2026-09-20T18:30:00.000Z' }
    ],
  },
];
