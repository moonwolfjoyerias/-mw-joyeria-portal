// MW JOYERÍA — Notificaciones de ejemplo (bandeja de Administración)
// ⚠️ TEMPORAL: se reemplaza por notificaciones reales de Firestore en Fase 3.
// Forma esperada: { id, texto, link, leida, rolDestino }
//
// Estos tres ejemplos son cosas que Administración necesita revisar
// sobre una Emprendedora/Líder en particular (apartado por vencer,
// premio de rifa por entregar, hito de constancia por confirmar) — NO
// son avisos para la propia Emprendedora/Líder, por eso van con
// rolDestino:'admin' y no 'emprendedora_lider' (antes estaban aquí por
// error: se veían en la bandeja de Admin con texto en segunda persona
// como si le hablaran a ella, y además la propia Emprendedora los veía
// en su campana sin que le correspondiera saberlo).
//
// "link" usa el mismo patrón que el resto del sistema de notificaciones
// (admin-nomina.html?empleado=..., etc.): una ruta relativa a
// portal/admin/ con query string, para aterrizar directo en la ficha
// de esa persona y, cuando aplica, en la pestaña correcta
// (?persona=ID&tab=apartados|planmw|equipo — ver js/admin-emprendedoras.js).

const NOTIFICACIONES_EJEMPLO = [
{ id: 1, texto: 'El apartado de 2 piezas de Sofía Hernández está por vencer en 1 día.', link: 'admin-emprendedoras-lideres.html?persona=sofia-hernandez&tab=apartados', leida: false, rolDestino: 'admin' },
{ id: 2, texto: '¡Valeria Ramírez ganó la rifa de agosto! 🎉 Revisa los detalles para entregar su premio.', link: 'admin-emprendedoras-lideres.html?persona=valeria-ramirez&tab=planmw', leida: false, rolDestino: 'admin' },
{ id: 3, texto: 'Daniela Martínez lleva 6 meses cumplidos en su Reto de Constancia — confirma su premio.', link: 'admin-emprendedoras-lideres.html?persona=daniela-martinez&tab=planmw', leida: true, rolDestino: 'admin' },
];
