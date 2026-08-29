// MW JOYERÍA — Lista de deseos (Staff)
// DATOS DE EJEMPLO
// ⚠️ TEMPORAL: se reemplazará por Firestore en Fase 3.
//
// estado: 'pendiente' | 'en_revision' | 'bingo' | 'disponible'
//
// IMPORTANTE:
// Las credenciales de abajo son únicamente para simulación.
// En producción se utilizará autenticación real.

const STAFF_USUARIOS_EJEMPLO = [
  {
    usuario: 'staff01',
    nombre: 'Staff MW',
    password: '1234'
  },
  {
    usuario: 'MW0005',
    nombre: 'María Camila Sánchez Calles',
    password: '2896'
  },
  {
    usuario: 'rh01',
    nombre: 'Recursos Humanos',
    password: '1234'
  }
];

const DESEOS_STAFF_EJEMPLO = [
  {
    id: 'd1',
    emprendedora: 'María Fernanda',
    iniciales: 'MF',
    telefono: '444 123 4567',
    titulo: 'Arracadas trenzadas',
    descripcion: 'Arracadas medianas trenzadas, acabado dorado brillante.',
    tieneFoto: true,
    fecha: '12 ago 2026 · 10:24 a.m.',
    estado: 'pendiente',
    ultimaAccion: { texto: 'Solicitud creada', usuario: 'Sistema', fecha: '12 ago 2026 · 10:24 a.m.' }
  },
  {
    id: 'd2',
    emprendedora: 'Sofía Hernández',
    iniciales: 'SH',
    telefono: '444 234 5678',
    titulo: 'Cadena eslabón ovalado',
    descripcion: 'Cadena de eslabones ovalados medianos, acabado dorado.',
    tieneFoto: true,
    fecha: '09 ago 2026 · 04:18 p.m.',
    estado: 'en_revision',
    ultimaAccion: { texto: 'Marcada en revisión', usuario: 'Ana López', fecha: '10 ago 2026 · 09:00 a.m.' }
  },
  {
    id: 'd3',
    emprendedora: 'Valeria Ramírez',
    iniciales: 'VR',
    telefono: '444 345 6789',
    titulo: 'Dije corazón minimalista',
    descripcion: 'Dije de corazón liso pequeño, estilo minimalista.',
    tieneFoto: false,
    fecha: '05 ago 2026 · 09:15 a.m.',
    estado: 'bingo',
    ultimaAccion: { texto: 'Coincidencia encontrada', usuario: 'Ana López', fecha: '06 ago 2026 · 11:00 a.m.' }
  },
  {
    id: 'd4',
    emprendedora: 'Daniela Martínez',
    iniciales: 'DM',
    telefono: '444 456 7890',
    titulo: 'Anillo solitario con circonia',
    descripcion: 'Anillo delgado con circonia central, en talla 7 u 8.',
    tieneFoto: true,
    fecha: '06 ago 2026 · 11:30 a.m.',
    estado: 'disponible',
    ultimaAccion: { texto: 'Marcada disponible', usuario: 'María Camila Sánchez Calles', fecha: '08 ago 2026 · 03:40 p.m.' }
  }
];

const ESTADOS_DESEOS_STAFF = {
  pendiente: { label: 'Pendiente', clase: 'pendiente' },
  en_revision: { label: 'En revisión', clase: 'en_revision' },
  bingo: { label: '¡Bingo!', clase: 'bingo' },
  disponible: { label: 'Disponible', clase: 'disponible' }
};

const DESEOS_STAFF_STORAGE_KEY = 'mw-staff-deseos-v1';

// Fuente única de verdad para la lista de deseos: la usan tanto la
// página de Lista de deseos como el resumen de Inicio.
function cargarDeseosStaffActuales() {

  try {
    const guardados = JSON.parse(localStorage.getItem(DESEOS_STAFF_STORAGE_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) {
    // localStorage inválido: seguimos con la semilla de ejemplo.
  }

  return DESEOS_STAFF_EJEMPLO.map(d => ({ ...d }));

}
