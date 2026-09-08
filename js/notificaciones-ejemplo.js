// MW JOYERÍA — Notificaciones de ejemplo (portal Emprendedora/Líder)
// ⚠️ TEMPORAL: se reemplaza por notificaciones reales de Firestore en Fase 3.
// Forma esperada: { id, texto, link, leida, rolDestino }
// "link" es relativo a la carpeta portal/ (donde vive este archivo se usa).
// "rolDestino" siempre es 'emprendedora_lider' aquí — es la bandeja a la
// que pertenecen estos tres ejemplos (ver js/notificaciones-modelo.js).

const NOTIFICACIONES_EJEMPLO = [
{ id: 1, texto: 'Tu apartado de 2 piezas está por vencer en 1 día.', link: 'apartados', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 2, texto: '¡Ganaste la rifa de agosto! 🎉 Revisa los detalles en tu cuenta.', link: 'cuenta', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 3, texto: 'Ya llevas 6 meses cumplidos en tu Reto de Constancia.', link: 'cuenta', leida: true, rolDestino: 'emprendedora_lider' },
];
