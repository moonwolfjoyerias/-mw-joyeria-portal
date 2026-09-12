// MW JOYERÍA — Notificaciones de ejemplo
// ⚠️ TEMPORAL: se reemplaza por notificaciones reales de Firestore en Fase 3.
// Forma esperada: { id, texto, link, leida, rolDestino, origen }
//
// Tres voces distintas de ejemplo en el mismo arreglo, nunca mezcladas:
//
// rolDestino:'admin', origen:'emprendedora_lider' — cosas que
// Administración necesita REVISAR sobre una Emprendedora/Líder en
// particular (apartado vencido, premio de rifa por entregar, hito de
// constancia por confirmar, solicitud de inscripción nueva), en tercera
// persona y con link directo a la ficha de esa persona
// (?persona=ID&tab=apartados|planmw|equipo — ver js/admin-emprendedoras.js).
// Admin las ve en su propio grupo "Emprendedoras/Líderes" — NUNCA la
// bandeja rolDestino:'emprendedora_lider' de abajo (esos son avisos para
// ELLA, con links que solo tienen sentido dentro de su propio portal).
//
// rolDestino:'admin', origen:'rh' — lo que RH le hace llegar a
// Administración (nómina lista para validar, solicitud de alta/baja de
// personal). Admin las ve en su propio grupo "De Recursos Humanos".
//
// rolDestino:'emprendedora_lider' — avisos para ELLA sobre SU propia
// cuenta (boleto de rifa, evento nuevo, apartado confirmado), en
// segunda persona, con link a su propia página ('cuenta', 'calendario',
// 'apartados' — resuelto por el PORTAL_LINKS de la página que los
// muestra, así que funciona igual desde el portal de Emprendedora que
// desde el de Líder).

const NOTIFICACIONES_EJEMPLO = [
{ id: 1, texto: 'El apartado de 2 piezas de Sofía Hernández está por vencer en 1 día.', link: 'admin-emprendedoras-lideres.html?persona=sofia-hernandez&tab=apartados', leida: false, rolDestino: 'admin', origen: 'emprendedora_lider' },
{ id: 2, texto: '¡Valeria Ramírez ganó la rifa de agosto! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l5-13"/><path d="M9 7l2 2M13 4l1 2M6 15l2 1"/><circle cx="17" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="11" r="1" fill="currentColor" stroke="none"/></svg></span> Revisa los detalles para entregar su premio.', link: 'admin-emprendedoras-lideres.html?persona=valeria-ramirez&tab=planmw', leida: false, rolDestino: 'admin', origen: 'emprendedora_lider' },
{ id: 3, texto: 'Daniela Martínez lleva 6 meses cumplidos en su Reto de Constancia — confirma su premio.', link: 'admin-emprendedoras-lideres.html?persona=daniela-martinez&tab=planmw', leida: true, rolDestino: 'admin', origen: 'emprendedora_lider' },
{ id: 4, texto: '¡Ya tienes tu boleto para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>', link: 'cuenta', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 5, texto: 'Hay un nuevo evento en el calendario: "Actividad de comunidad" el 12 de septiembre.', link: 'calendario', leida: false, rolDestino: 'emprendedora_lider' },
{ id: 6, texto: 'Tu apartado fue confirmado — ya puedes ver tus piezas.', link: 'apartados', leida: true, rolDestino: 'emprendedora_lider' },
{ id: 7, texto: 'La nómina de Ana López (semana del 1 al 7) está lista para validación.', link: 'admin-nomina.html', leida: false, rolDestino: 'admin', origen: 'rh' },
];
