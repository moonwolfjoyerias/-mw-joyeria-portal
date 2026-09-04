// MW JOYERÍA — Equipo de la Líder: datos de ejemplo (árbol)
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.
// leaderId apunta a quién invitó a esa persona (null = la líder misma, la raíz).
// puntos = producción grupal individual acumulada este mes (sin contar Souvenirs).
// compras = desglose de esos puntos por compra individual (monto con IVA
// incluido + fecha), para el desglose por nivel del Ticket de comisiones
// (js/lider-cuenta.js). La suma de "compras" de cada persona es siempre
// igual a su "puntos" — no se inventa producción adicional.

function fechaHaceDias(dias) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
}

const EQUIPO_ARBOL_EJEMPLO = [
  { id: 'yo', nombre: 'Tú (Líder)', leaderId: null, puntos: null },

  // Nivel 1 — invitadas directamente por la líder
  { id: 'm1', nombre: 'María Camila Sánchez Calles', leaderId: 'yo', puntos: 4200, compras: [
    { monto: 2400, fecha: fechaHaceDias(3) },
    { monto: 1800, fecha: fechaHaceDias(11) }
  ] },
  { id: 's1', nombre: 'Claudia Elvira Chávez Jurado', leaderId: 'yo', puntos: 3100, compras: [
    { monto: 1900, fecha: fechaHaceDias(2) },
    { monto: 1200, fecha: fechaHaceDias(9) }
  ] },
  { id: 'v1', nombre: 'Ricardo Loredo Morales', leaderId: 'yo', puntos: 2600, compras: [
    { monto: 1500, fecha: fechaHaceDias(5) },
    { monto: 1100, fecha: fechaHaceDias(14) }
  ] },
  { id: 'a1', nombre: 'Aranza Sapphira Gloria Vázquez', leaderId: 'yo', puntos: 1900, compras: [
    { monto: 1900, fecha: fechaHaceDias(6) }
  ] },

  // Nivel 2
  { id: 'k1', nombre: 'Emmanuel Isidro Pérez Castillo', leaderId: 'm1', puntos: 2200, compras: [
    { monto: 1200, fecha: fechaHaceDias(4) },
    { monto: 1000, fecha: fechaHaceDias(12) }
  ] },
  { id: 'd1', nombre: 'Rodrigo Cruz Tellez', leaderId: 's1', puntos: 1750, compras: [
    { monto: 1750, fecha: fechaHaceDias(7) }
  ] },

  // Nivel 3
  { id: 'r1', nombre: 'Renata López Gonzáles', leaderId: 'k1', puntos: 980, compras: [
    { monto: 980, fecha: fechaHaceDias(8) }
  ] },

  // Nivel 4
  { id: 'x1', nombre: 'Ximena del Carmen Acosta López', leaderId: 'r1', puntos: 600, compras: [
    { monto: 600, fecha: fechaHaceDias(10) }
  ] },
];
