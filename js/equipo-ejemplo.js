// MW JOYERÍA — Equipo de la Líder: datos de ejemplo (árbol)
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.
// leaderId apunta a quién invitó a esa persona (null = la líder misma, la raíz).
// puntos = producción grupal individual acumulada este mes (sin contar Souvenirs).

const EQUIPO_ARBOL_EJEMPLO = [
  { id: 'yo', nombre: 'Tú (Líder)', leaderId: null, puntos: null },

  // Nivel 1 — invitadas directamente por la líder
  { id: 'm1', nombre: 'María Camila Sánchez Calles', leaderId: 'yo', puntos: 4200 },
  { id: 's1', nombre: 'Claudia Elvira Chávez Jurado', leaderId: 'yo', puntos: 3100 },
  { id: 'v1', nombre: 'Ricardo Loredo Morales', leaderId: 'yo', puntos: 2600 },
  { id: 'a1', nombre: 'Aranza Sapphira Gloria Vázquez', leaderId: 'yo', puntos: 1900 },

  // Nivel 2
  { id: 'k1', nombre: 'Karla T.', leaderId: 'm1', puntos: 2200 },
  { id: 'd1', nombre: 'Diana L.', leaderId: 's1', puntos: 1750 },

  // Nivel 3
  { id: 'r1', nombre: 'Renata S.', leaderId: 'k1', puntos: 980 },

  // Nivel 4
  { id: 'x1', nombre: 'Ximena C.', leaderId: 'r1', puntos: 600 },
];
