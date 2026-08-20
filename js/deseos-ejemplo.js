// MW JOYERÍA — Lista de deseos: solicitudes de ejemplo
// ⚠️ TEMPORAL: se reemplaza por Firestore en Fase 3.
// estado: 'pendiente' | 'en_revision' | 'bingo' | 'disponible'

const SOLICITUDES_EJEMPLO = [
  {
    id: 'd1',
    titulo: 'Arracadas trenzadas',
    descripcion: 'Arracadas medianas trenzadas, acabado dorado brillante.',
    fecha: '12 ago 2026 · 10:24 a.m.',
    estado: 'pendiente',
    tieneFoto: true,
  },
  {
    id: 'd2',
    titulo: 'Cadena eslabón ovalado',
    descripcion: 'Cadena de eslabones ovalados medianos, acabado dorado.',
    fecha: '09 ago 2026 · 04:18 p.m.',
    estado: 'en_revision',
    tieneFoto: true,
  },
  {
    id: 'd3',
    titulo: 'Dije corazón minimalista',
    descripcion: 'Dije de corazón liso pequeño, estilo minimalista.',
    fecha: '05 ago 2026 · 09:15 a.m.',
    estado: 'bingo',
    tieneFoto: false,
  },
  {
    id: 'd4',
    titulo: 'Anillo solitario con circonia',
    descripcion: 'Anillo delgado con circonia central, en talla 7 u 8.',
    fecha: '06 ago 2026 · 11:30 a.m.',
    estado: 'disponible',
    tieneFoto: true,
  },
];

const ESTADOS_DESEOS = {
  pendiente: { label: 'Pendiente', mensaje: 'En espera de revisión por nuestro equipo.' },
  en_revision: { label: 'En revisión', mensaje: 'Nuestro equipo está buscando tu pieza.' },
  bingo: { label: '¡BINGO!', mensaje: 'Encontramos una pieza igual o parecida — ya se hizo el pedido.' },
  disponible: { label: 'Disponible', mensaje: '¡Buena noticia! Esta pieza ya está disponible.', cta: true },
};
