// MW JOYERÍA — Eventos de ejemplo (portal, todos los roles)
// ⚠️ TEMPORAL: se reemplaza por eventos reales de Firestore en Fase 3.
// Forma esperada:
//   { id, fecha: 'YYYY-MM-DD', titulo, hora, tipo: 'presencial'|'virtual',
//     lugarTexto, enlace, descripcion, tieneFoto }
//
// tipo determina el color y qué botón de enlace se muestra:
//   presencial -> "Ver ubicación" (Google Maps)
//   virtual    -> "Unirme por Zoom"

const EVENTOS_EJEMPLO = [
  {
    id: 'ev1', fecha: '2026-07-25', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Desayuna, convive con el equipo y participa en la rifa mensual.',
    tieneFoto: true,
  },
  {
    id: 'ev2', fecha: '2026-08-06', titulo: 'Evento MW: Capacitación', hora: '5:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Capacitación para líderes: estrategias que transforman tu equipo.',
    tieneFoto: false,
  },
  {
    id: 'ev3', fecha: '2026-08-08', titulo: 'Actividad de comunidad', hora: '6:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Conferencia especial para toda la comunidad MW.',
    tieneFoto: false,
  },
  {
    id: 'ev4', fecha: '2026-08-15', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Desayuna, convive con el equipo y participa en la rifa mensual.',
    tieneFoto: true,
  },
  {
    id: 'ev5', fecha: '2026-08-22', titulo: 'Gala Anual MW', hora: '7:00 p.m.',
    tipo: 'presencial', lugarTexto: 'Salón Jardín, San Luis Potosí',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Sal%C3%B3n+Jard%C3%ADn+San+Luis+Potosi',
    descripcion: 'Nuestra gran gala anual — cena, reconocimientos y muchas sorpresas.',
    tieneFoto: true,
  },
  {
    id: 'ev6', fecha: '2026-08-29', titulo: 'Desayuno + Rifa', hora: '9:30 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Cerramos el mes con energía y grandes premios.',
    tieneFoto: true,
  },
  {
    id: 'ev7', fecha: '2026-09-05', titulo: 'Evento MW: Nuevas Colecciones', hora: '5:00 p.m.',
    tipo: 'virtual', lugarTexto: 'En línea (Zoom)',
    enlace: 'https://zoom.us/j/1234567890',
    descripcion: 'Presentación en vivo de las piezas que llegan este mes.',
    tieneFoto: false,
  },
  {
    id: 'ev8', fecha: '2026-09-12', titulo: 'Actividad de comunidad', hora: '10:00 a.m.',
    tipo: 'presencial', lugarTexto: 'Centro Joyero San Luis, Local 21',
    enlace: 'https://www.google.com/maps/search/?api=1&query=Centro+Joyero+San+Luis',
    descripcion: 'Encuentro presencial para conocer a otras emprendedoras MW.',
    tieneFoto: true,
  },
];
