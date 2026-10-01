// MW JOYERÍA — Lista de deseos (Emprendedora/Líder): textos de estado
//
// Antes este archivo también traía SOLICITUDES_EJEMPLO, un arreglo
// fijo que se recargaba desde cero en cada visita — el formulario de
// "Mi lista de deseos" nunca guardaba nada real, ni siquiera en este
// mismo navegador (ver js/deseos.js). Ahora las solicitudes reales
// viven en el mismo modelo que ya administra Staff/Encargado/Admin
// (js/lista-deseos-modelo.js + js/lista-deseos-firestore-sync.js), así
// que esa semilla ya no hace falta aquí — solo se queda la etiqueta y
// el mensaje de cada estado real (ESTADOS_LISTA_DESEOS en
// lista-deseos-modelo.js), para mostrarlos en "Mis solicitudes".

const ESTADOS_DESEOS = {
  pendiente: { label: 'Pendiente', mensaje: 'En espera de revisión por nuestro equipo.' },
  en_seguimiento: { label: 'En seguimiento', mensaje: 'Nuestro equipo está buscando tu pieza.' },
  disponible: { label: '¡Disponible!', mensaje: '¡Buena noticia! Esta pieza ya está disponible.', cta: true },
  atendida: { label: 'Atendida', mensaje: 'Esta solicitud ya fue atendida.' },
  cancelada: { label: 'Cancelada', mensaje: 'Cancelaste esta solicitud.' }
};
