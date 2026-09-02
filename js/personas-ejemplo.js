// MW JOYERÍA — Registro de Emprendedoras / Líderes (Admin)
//
// ⚠️ Nota de arquitectura: antes de esta página, cada módulo (apartados,
// equipo, cuenta) guardaba su propio dato de ejemplo aislado y ninguno
// compartía un mismo ID entre sí. Este archivo crea el registro único
// que la página de Admin necesita para buscar/editar personas.
// Para no inventar datos paralelos, reutiliza los MISMOS ids/nombres que
// ya usan los apartados de ejemplo (js/staff-apartados-ejemplo.js) — así
// la sección "Apartados"/"Compras" del perfil muestra datos reales, no
// inventados. El resto de módulos del sistema (Mi equipo, Mi cuenta de
// líder) seguirán usando sus propios datos de ejemplo por separado; no
// se modificaron para no romper Staff/RH ni las vistas de Líder.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3 sin cambiar la forma de este objeto.

const CATEGORIAS_PERSONA = { normal: 'Normal', vip: 'VIP', foranea: 'Foránea' };
const ESTADOS_CUENTA_PERSONA = { activa: 'Activa', inactiva: 'Inactiva', baja: 'Baja' };

const PERSONAS_STORAGE_KEY = 'mw_admin_personas_demo';

function crearPersonaEjemplo(datos) {
  return {
    id: datos.id,
    nombre: datos.nombre || '',
    apellidos: datos.apellidos || '',
    tipo: datos.tipo || 'emprendedora', // 'emprendedora' | 'lider'
    categoria: datos.categoria || 'normal', // normal | vip | foranea
    estado: datos.estado || 'activa', // activa | inactiva | baja
    telefono: datos.telefono || '',
    correo: datos.correo || '',
    usuario: datos.usuario || '',
    fechaAlta: datos.fechaAlta || new Date().toISOString(),
    liderId: datos.liderId || null,
    // Solo aplica cuando tipo === 'lider':
    rangoActualKey: datos.rangoActualKey || 'sin_rango',
    stats: datos.stats || {
      personasActivas: 0,
      produccionGrupalMes: 0,
      equipoCalificadoPct: 0,
      compraPersonalPeriodo1: 0,
      compraPersonalPeriodo2: 0
    },
    // Aplica a ambos tipos — mismos campos que usan cuenta-ejemplo.js /
    // lider-cuenta-ejemplo.js (Reto de Constancia + boletos de rifa).
    constancia: datos.constancia || { mesesCumplidos: 0, montoMesActual: 0, metaMes: 8000 },
    rifa: datos.rifa || { montoAcumuladoMes: 0, meta: 3000 }
  };
}

// Hitos del Reto de Constancia — mismos premios que cuenta-ejemplo.js,
// no se inventan otros.
const HITOS_CONSTANCIA_PERSONA = [
  { meses: 6, premio: 'Tablet' },
  { meses: 8, premio: 'Pantalla 43"' },
  { meses: 10, premio: 'Laptop' },
  { meses: 12, premio: 'Viaje x2' }
];

function construirPersonasEjemplo() {

  const lideres = [
    crearPersonaEjemplo({
      id: 'ana-torres',
      nombre: 'Ana',
      apellidos: 'Torres',
      tipo: 'lider',
      categoria: 'normal',
      estado: 'activa',
      telefono: '444 111 2233',
      correo: 'ana.torres@example.com',
      usuario: 'MW0001',
      fechaAlta: '2023-02-14T00:00:00.000Z',
      liderId: null,
      rangoActualKey: 'oro',
      stats: { personasActivas: 11, produccionGrupalMes: 58000, equipoCalificadoPct: 40, compraPersonalPeriodo1: 1600, compraPersonalPeriodo2: 1550 },
      constancia: { mesesCumplidos: 11, montoMesActual: 6900, metaMes: 8000 },
      rifa: { montoAcumuladoMes: 3100, meta: 3000 }
    }),
    crearPersonaEjemplo({
      id: 'maria-camila-sanchez',
      nombre: 'María Camila',
      apellidos: 'Sánchez Calles',
      tipo: 'lider',
      categoria: 'normal',
      estado: 'activa',
      telefono: '444 222 3344',
      correo: 'maria.sanchez@example.com',
      usuario: 'MW0005',
      fechaAlta: '2023-08-02T00:00:00.000Z',
      liderId: 'ana-torres',
      rangoActualKey: 'plata',
      stats: { personasActivas: 8, produccionGrupalMes: 38000, equipoCalificadoPct: 35, compraPersonalPeriodo1: 1800, compraPersonalPeriodo2: 1650 },
      constancia: { mesesCumplidos: 7, montoMesActual: 5200, metaMes: 8000 },
      rifa: { montoAcumuladoMes: 2150, meta: 3000 }
    })
  ];

  // Emprendedoras — mismos ids que genera slugUsuarioId() sobre los
  // nombres de js/staff-apartados-ejemplo.js, para poder cruzar sus
  // ventanas de apartado reales en la sección "Apartados"/"Compras".
  const emprendedoras = [
    { id: 'maria-fernanda', nombre: 'María Fernanda', apellidos: 'Gómez Ruiz', telefono: '444 123 4567', liderId: 'ana-torres', usuario: 'MW0010', fechaAlta: '2024-01-15T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 3, montoMesActual: 1210, metaMes: 8000 }, rifa: { montoAcumuladoMes: 1210, meta: 3000 } },
    { id: 'sofia-hernandez', nombre: 'Sofía', apellidos: 'Hernández', telefono: '444 234 5678', liderId: 'ana-torres', usuario: 'MW0011', fechaAlta: '2024-02-20T00:00:00.000Z', categoria: 'foranea', estado: 'activa', constancia: { mesesCumplidos: 2, montoMesActual: 650, metaMes: 8000 }, rifa: { montoAcumuladoMes: 650, meta: 3000 } },
    { id: 'valeria-ramirez', nombre: 'Valeria', apellidos: 'Ramírez', telefono: '444 345 6789', liderId: 'maria-camila-sanchez', usuario: 'MW0012', fechaAlta: '2023-11-05T00:00:00.000Z', categoria: 'vip', estado: 'activa', constancia: { mesesCumplidos: 9, montoMesActual: 4300, metaMes: 8000 }, rifa: { montoAcumuladoMes: 430, meta: 3000 } },
    { id: 'daniela-martinez', nombre: 'Daniela', apellidos: 'Martínez', telefono: '444 456 7890', liderId: 'maria-camila-sanchez', usuario: 'MW0013', fechaAlta: '2024-04-18T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 0, montoMesActual: 790, metaMes: 8000 }, rifa: { montoAcumuladoMes: 790, meta: 3000 } },
    { id: 'paola-gonzalez', nombre: 'Paola', apellidos: 'González', telefono: '444 567 8901', liderId: 'ana-torres', usuario: 'MW0014', fechaAlta: '2024-03-01T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 5, montoMesActual: 580, metaMes: 8000 }, rifa: { montoAcumuladoMes: 580, meta: 3000 } },
    { id: 'andrea-castillo', nombre: 'Andrea', apellidos: 'Castillo', telefono: '444 678 9012', liderId: 'maria-camila-sanchez', usuario: 'MW0015', fechaAlta: '2023-09-22T00:00:00.000Z', categoria: 'normal', estado: 'inactiva', constancia: { mesesCumplidos: 4, montoMesActual: 0, metaMes: 8000 }, rifa: { montoAcumuladoMes: 0, meta: 3000 } },
    { id: 'camila-rojas', nombre: 'Camila', apellidos: 'Rojas', telefono: '444 789 0123', liderId: 'ana-torres', usuario: 'MW0016', fechaAlta: '2024-05-30T00:00:00.000Z', categoria: 'foranea', estado: 'baja', constancia: { mesesCumplidos: 1, montoMesActual: 0, metaMes: 8000 }, rifa: { montoAcumuladoMes: 0, meta: 3000 } },
    { id: 'karla-torres', nombre: 'Karla', apellidos: 'Torres Beltrán', telefono: '444 890 1234', liderId: 'maria-camila-sanchez', usuario: 'MW0017', fechaAlta: '2024-06-10T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 300, metaMes: 8000 }, rifa: { montoAcumuladoMes: 300, meta: 3000 } }
  ].map(datos => crearPersonaEjemplo({ ...datos, tipo: 'emprendedora', correo: `${datos.id.replace(/-/g, '.')}@example.com` }));

  return [...lideres, ...emprendedoras];

}

// Igual que el catálogo de Staff: localStorage simula la base de datos.
// La primera vez que se pida el registro, se siembra con el ejemplo.
function obtenerPersonas() {

  try {
    const guardado = JSON.parse(localStorage.getItem(PERSONAS_STORAGE_KEY));
    if (Array.isArray(guardado) && guardado.length) return guardado;
  } catch (error) {
    // sigue abajo y reconstruye el ejemplo
  }

  const personas = construirPersonasEjemplo();
  guardarPersonas(personas);
  return personas;

}

function guardarPersonas(personas) {
  localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(personas));
}

function obtenerPersonaPorId(id) {
  return obtenerPersonas().find(p => p.id === id) || null;
}

function nombreCompletoPersona(p) {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ');
}
