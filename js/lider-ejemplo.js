// MW JOYERÍA — Dashboard de Líder: datos de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.
// Los umbrales de rango son los REALES del documento de Fase 1 (Sección 7.2) —
// no inventar otros ni agregar rangos que no existen (no hay "Bronce").

const RANGOS_MW = [
  { key: 'sin_rango', label: 'Sin Rango', personas: 0, produccion: 0, compra: 0, calificado: 0 },
  { key: 'plata', label: 'Plata', personas: 5, produccion: 22500, compra: 1500, calificado: 30 },
  { key: 'oro', label: 'Oro', personas: 10, produccion: 52500, compra: 1500, calificado: 30 },
  { key: 'diamante', label: 'Diamante', personas: 15, produccion: 75000, compra: 3000, calificado: 50 },
  { key: 'corona', label: 'Corona', personas: 30, produccion: 180000, compra: 3000, calificado: 50 },
];

const LIDER_EJEMPLO = {
  nombre: 'Líder',
  rangoActualKey: 'plata', // el rango vigente este mes (se fija con el cierre del mes anterior)
  stats: {
    personasActivas: 8,
    produccionGrupalMes: 38000,
    equipoCalificadoPct: 35,
    compraPersonalPeriodo1: 1800,
    compraPersonalPeriodo2: 1650,
  },
};

// Estructura del equipo por nivel (solo para vista previa en Inicio)
const EQUIPO_NIVELES_EJEMPLO = [
  { nivel: 1, personasActivas: 4, nombres: ['María G.', 'Sofía R.', 'Valeria M.', 'Ana P.'] },
  { nivel: 2, personasActivas: 2, nombres: ['Karla T.', 'Diana L.'] },
  { nivel: 3, personasActivas: 1, nombres: ['Renata S.'] },
  { nivel: 4, personasActivas: 1, nombres: ['Ximena C.'] },
  { nivel: 5, personasActivas: 0, nombres: [] },
];
