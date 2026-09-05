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
    numeroCuenta: datos.numeroCuenta || '',
    fechaAlta: datos.fechaAlta || new Date().toISOString(),
    liderId: datos.liderId || null,
    // Quién la invitó (Solicitudes de inscripción). Casi siempre es la
    // misma persona que liderId, pero se guarda aparte porque liderId
    // puede cambiar más adelante (ver Admin → Emprendedoras/Líderes)
    // mientras que invitadaPor es un dato histórico que no cambia.
    invitadaPor: datos.invitadaPor || null,
    // Solo aplica cuando tipo === 'lider':
    rangoActualKey: datos.rangoActualKey || 'sin_rango',
    stats: datos.stats || {
      personasActivas: 0,
      produccionGrupalMes: 0,
      equipoCalificadoPct: 0,
      compraPersonalPeriodo1: 0,
      compraPersonalPeriodo2: 0
    },
    // Detectado automáticamente por js/plan-mw-admin.js cuando una
    // líder ya cumple los requisitos del siguiente rango. Admin debe
    // confirmarlo — nunca sube sola. { rangoKey, detectadoEn }
    ascensoPendiente: datos.ascensoPendiente || null,
    // Aplica a ambos tipos — mismos campos que usan cuenta-ejemplo.js /
    // lider-cuenta-ejemplo.js (Reto de Constancia + boletos de rifa).
    // hitosOtorgados: hitos del Reto de Constancia ya CONFIRMADOS por
    // Admin ({ meses, premio, fecha }) — distinto de mesesCumplidos
    // (el conteo puede ya alcanzar un hito sin que Admin lo haya
    // confirmado/entregado todavía).
    constancia: { mesesCumplidos: 0, montoMesActual: 0, metaMes: 8000, hitosOtorgados: [], ...(datos.constancia || {}) },
    rifa: datos.rifa || { montoAcumuladoMes: 0, meta: 3000 },
    // Detectado automáticamente cuando mesesCumplidos alcanza un hito
    // todavía no otorgado. { meses, premio, detectadoEn }
    recompensaPendiente: datos.recompensaPendiente || null,
    // Historial de logros ya CONFIRMADOS (ascensos de rango y
    // recompensas de constancia entregadas), con fecha — es la fuente
    // de "Logros del periodo" en Admin → Plan MW. Se llena en el mismo
    // momento en que se confirma cada logro, nunca por captura manual.
    historialLogros: datos.historialLogros || []
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
      // Ya cumple los requisitos de Oro (10 personas / $52,500 / $1,500
      // ambos periodos / 30% calificado) — sirve de ejemplo real para la
      // verificación automática de ascenso de rango en Admin.
      rangoActualKey: 'plata',
      stats: { personasActivas: 10, produccionGrupalMes: 52500, equipoCalificadoPct: 35, compraPersonalPeriodo1: 1800, compraPersonalPeriodo2: 1650 },
      constancia: { mesesCumplidos: 7, montoMesActual: 5200, metaMes: 8000 },
      rifa: { montoAcumuladoMes: 2150, meta: 3000 }
    }),
    // "me-lider": la persona con la sesión abierta en el portal de
    // Líder (ver js/lider-cuenta-ejemplo.js). Mismos datos que ya
    // muestra su Mi cuenta, para que el módulo de Solicitudes de
    // inscripción pueda registrarla como solicitante/líder directa.
    crearPersonaEjemplo({
      id: 'me-lider',
      nombre: 'Líder',
      apellidos: '',
      tipo: 'lider',
      categoria: 'normal',
      estado: 'activa',
      telefono: '444 987 6543',
      correo: 'lider@example.com',
      usuario: 'MW0002',
      fechaAlta: '2023-05-10T00:00:00.000Z',
      liderId: null,
      rangoActualKey: 'plata',
      stats: { personasActivas: 8, produccionGrupalMes: 38000, equipoCalificadoPct: 35, compraPersonalPeriodo1: 1800, compraPersonalPeriodo2: 1650 },
      constancia: { mesesCumplidos: 10, montoMesActual: 6200, metaMes: 8000 },
      rifa: { montoAcumuladoMes: 3400, meta: 3000 }
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

  // "me-emprendedora": la persona con la sesión abierta en el portal
  // de Emprendedora (ver js/cuenta-ejemplo.js). Mismos datos que ya
  // muestra su Mi cuenta.
  const meEmprendedora = crearPersonaEjemplo({
    id: 'me-emprendedora',
    nombre: 'Claudia',
    apellidos: 'Ramírez',
    tipo: 'emprendedora',
    categoria: 'normal',
    estado: 'activa',
    telefono: '444 123 4567',
    correo: 'claudia.ramirez@example.com',
    usuario: 'MW0003',
    fechaAlta: '2023-10-01T00:00:00.000Z',
    liderId: 'ana-torres',
    constancia: { mesesCumplidos: 6, montoMesActual: 5200, metaMes: 8000 },
    rifa: { montoAcumuladoMes: 2150, meta: 3000 }
  });

  return [...lideres, ...emprendedoras, meEmprendedora];

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

// Utilidades genéricas compartidas por todas las páginas que consumen
// este registro (admin-emprendedoras.js, admin-plan-mw.js).
function formatearDineroPersonas(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}

function formatearFechaPersonas(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHTMLPersonas(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttributePersonas(texto) {
  return escapeHTMLPersonas(texto);
}

// Recorre el registro por liderId (equipo por niveles de una persona
// raíz). La usan Admin → Emprendedoras/Líderes (pestaña Equipo) y
// Admin → Comisiones (js/comisiones-modelo.js) — un solo recorrido de
// equipo, no dos árboles paralelos.
function calcularDescendenciaPersona(raizId) {

  const porLider = {};
  obtenerPersonas().forEach(p => {
    if (!p.liderId) return;
    (porLider[p.liderId] = porLider[p.liderId] || []).push(p);
  });

  const conNivel = [];
  (function recorrer(id, nivel) {
    (porLider[id] || []).forEach(hijo => {
      conNivel.push({ persona: hijo, nivel });
      recorrer(hijo.id, nivel + 1);
    });
  })(raizId, 1);

  return { conNivel, porLider };

}

// Usado por el módulo de Solicitudes de inscripción (js/solicitudes-modelo.js)
// para evitar cuentas duplicadas por correo o teléfono, tanto al enviar
// la solicitud como al aprobarla.
function existePersonaConCorreoOTelefono(correo, telefono, excluirId) {
  const correoNorm = String(correo || '').trim().toLowerCase();
  const telefonoNorm = String(telefono || '').replace(/\D/g, '');
  return obtenerPersonas().some(p => {
    if (excluirId && p.id === excluirId) return false;
    const mismoCorreo = correoNorm && String(p.correo || '').trim().toLowerCase() === correoNorm;
    const mismoTelefono = telefonoNorm && String(p.telefono || '').replace(/\D/g, '') === telefonoNorm;
    return mismoCorreo || mismoTelefono;
  });
}
