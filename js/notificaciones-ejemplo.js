// MW JOYERÍA — Notificaciones de ejemplo
// ⚠️ TEMPORAL: se reemplaza por notificaciones reales de Firestore en Fase 3.
// Forma esperada: { id, texto, link, leida, rolDestino }
//
// Dos bandejas distintas de ejemplo en el mismo arreglo — cada una con
// su propia voz y su propio destino, nunca mezcladas:
//
// rolDestino:'admin' — cosas que Administración necesita REVISAR sobre
// una Emprendedora/Líder en particular (apartado por vencer, premio de
// rifa por entregar, hito de constancia por confirmar), en tercera
// persona y con link directo a la ficha de esa persona
// (?persona=ID&tab=apartados|planmw|equipo — ver js/admin-emprendedoras.js).
// NO son avisos para la propia Emprendedora/Líder (antes estaban aquí
// por error, en segunda persona, y ella las veía en su campana sin que
// le correspondiera).
//
// rolDestino:'emprendedora_lider' — avisos para ELLA sobre SU propia
// cuenta (boleto de rifa, evento nuevo, apartado confirmado), en
// segunda persona, con link a su propia página ('cuenta', 'calendario',
// 'apartados' — resuelto por el PORTAL_LINKS de la página que los
// muestra, así que funciona igual desde el portal de Emprendedora que
// desde el de Líder).

const NOTIFICACIONES_EJEMPLO = [
{ id: 1, texto: 'El apartado de 2 piezas de Sofía Hernández está por vencer en 1 día.', link: 'admin-emprendedoras-lideres.html?persona=sofia-hernandez&tab=apartados', leida: false, rolDestino: 'admin' },
{ id: 2, texto: '¡Valeria Ramírez ganó la rifa de agosto! 🎉 Revisa los detalles para entregar su premio.', link: 'admin-emprendedoras-lideres.html?persona=valeria-ramirez&tab=planmw', leida: false, rolDestino: 'admin' },
{ id: 3, texto: 'Daniela Martínez lleva 6 meses cumplidos en su Reto de Constancia — confirma su premio.', link: 'admin-emprendedoras-lideres.html?persona=daniela-martinez&tab=planmw', leida: true, rolDestino: 'admin' },
{ id: 4, texto: '¡Ya tienes tu boleto para la rifa de este mes! 🎟️', link: 'cuenta', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 5, texto: 'Hay un nuevo evento en el calendario: "Actividad de comunidad" el 12 de septiembre.', link: 'calendario', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 6, texto: 'Tu apartado fue confirmado — ya puedes ver tus piezas.', link: 'apartados', leida: true, rolDestino: 'emprendedora_lider' },
];
