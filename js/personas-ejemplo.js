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
// se modificaron para no romper Staff/Encargado ni las vistas de Líder.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3 sin cambiar la forma de este objeto.

const CATEGORIAS_PERSONA = { normal: 'Normal', vip: 'VIP', foranea: 'Foránea' };
const ESTADOS_CUENTA_PERSONA = { activa: 'Activa', inactiva: 'Inactiva', baja: 'Baja' };

// persona.alertaInactividad ({ desde: ISO } | null): bandera de
// "seguimiento" para líderes, calculada por
// js/alertas-inactividad-modelo.js cuando una Emprendedora lleva varias
// semanas sin compra mínima. NO es lo mismo que `estado` (activa/
// inactiva/baja) de arriba — esta bandera nunca bloquea el login ni
// afecta comisiones/rango, es solo una señal para que su línea de
// líderes la contacte y vea qué pasa.

const PERSONAS_STORAGE_KEY = 'mw_admin_personas_demo';

// Contraseñas guardadas APARTE del registro de personas (mapa id →
// password), no dentro de cada persona. Antes vivían como campo
// `password` en el mismo objeto que se lee para resolver un nombre en
// una búsqueda o para cruzar apartados — así, cualquier página que solo
// necesitaba "el nombre de María" (ej. Staff buscando a quién pertenece
// una lista de deseos) también recibía la contraseña en texto plano de
// TODAS las personas. Separarlas no oculta el dato de alguien que ya
// tiene la página abierta en devtools (localStorage sigue siendo del
// mismo origen — la barrera real llega con Firebase Auth), pero sí evita
// que la contraseña viaje junto con cada búsqueda/listado de nombres.
const PERSONAS_CREDENCIALES_STORAGE_KEY = 'mw_admin_personas_credenciales_demo';

function obtenerCredencialesPersonas() {
  try {
    const cred = JSON.parse(localStorage.getItem(PERSONAS_CREDENCIALES_STORAGE_KEY));
    return (cred && typeof cred === 'object' && !Array.isArray(cred)) ? cred : {};
  } catch (error) {
    return {};
  }
}

function guardarCredencialesPersonas(cred) {
  localStorage.setItem(PERSONAS_CREDENCIALES_STORAGE_KEY, JSON.stringify(cred));
}

// Único lugar que debe leer la contraseña real de una persona (Admin →
// Configuración → Usuarios y permisos → "Mostrar/ocultar").
function obtenerPasswordPersona(id) {
  return obtenerCredencialesPersonas()[id] || '';
}

function establecerPasswordPersona(id, nuevoPassword) {
  const cred = obtenerCredencialesPersonas();
  cred[id] = nuevoPassword;
  guardarCredencialesPersonas(cred);
}

function crearPersonaEjemplo(datos) {
  // La contraseña (si viene) se guarda aparte, nunca en el objeto que
  // regresa esta función — ver PERSONAS_CREDENCIALES_STORAGE_KEY arriba.
  if (datos.id && datos.password) establecerPasswordPersona(datos.id, datos.password);
  return {
    id: datos.id,
    nombre: datos.nombre || '',
    apellidos: datos.apellidos || '',
    tipo: datos.tipo || 'emprendedora', // 'emprendedora' | 'lider'
    categoria: datos.categoria || 'normal', // normal | vip | foranea
    estado: datos.estado || 'activa', // activa | inactiva | baja
    telefono: datos.telefono || '',
    correo: datos.correo || '',
    fotoUrl: datos.fotoUrl || '',
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
      personasCalificadas: 0,
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
      password: 'MW0001AT',
      fechaAlta: '2023-02-14T00:00:00.000Z',
      liderId: null,
      rangoActualKey: 'oro',
      stats: { personasActivas: 11, produccionGrupalMes: 58000, personasCalificadas: 6, compraPersonalPeriodo1: 1600, compraPersonalPeriodo2: 1550 },
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
      password: 'MW0005MCSC',
      fechaAlta: '2023-08-02T00:00:00.000Z',
      liderId: 'ana-torres',
      // Ejemplo real de ascenso de rango: en agosto 2026 su equipo real
      // (ver js/apartados-modelo.js → construirVentanasApartadoEjemplo)
      // solo alcanza los requisitos de Plata; en septiembre 2026 ya
      // alcanza los de Oro (10 personas activas / 52,500 puntos /
      // $1,500 ambos periodos / 6 personas calificadas) y el ascenso queda confirmado con
      // fecha de septiembre — así Comisiones muestra el bono de rango
      // sin pagar ese mes y Plan MW ya el nuevo rango vigente.
      rangoActualKey: 'oro',
      historialLogros: [
        { tipo: 'ascenso_rango', fecha: '2026-09-20T18:00:00.000Z', rangoAnterior: 'plata', rangoNuevo: 'oro' }
      ],
      stats: { personasActivas: 10, produccionGrupalMes: 52500, personasCalificadas: 4, compraPersonalPeriodo1: 1800, compraPersonalPeriodo2: 1650 },
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
      password: 'MW0002L',
      fechaAlta: '2023-05-10T00:00:00.000Z',
      liderId: null,
      rangoActualKey: 'plata',
      stats: { personasActivas: 8, produccionGrupalMes: 38000, personasCalificadas: 1, compraPersonalPeriodo1: 1800, compraPersonalPeriodo2: 1650 },
      constancia: { mesesCumplidos: 10, montoMesActual: 6200, metaMes: 8000 },
      rifa: { montoAcumuladoMes: 3400, meta: 3000 }
    })
  ];

  // Emprendedoras — mismos ids que genera slugUsuarioId() sobre los
  // nombres de js/staff-apartados-ejemplo.js, para poder cruzar sus
  // ventanas de apartado reales en la sección "Apartados"/"Compras".
  const emprendedoras = [
    { id: 'maria-fernanda', nombre: 'María Fernanda', apellidos: 'Gómez Ruiz', telefono: '444 123 4567', liderId: 'ana-torres', usuario: 'MW0010', password: 'MW0010MFGR', fechaAlta: '2024-01-15T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 3, montoMesActual: 1210, metaMes: 8000 }, rifa: { montoAcumuladoMes: 1210, meta: 3000 } },
    { id: 'sofia-hernandez', nombre: 'Sofía', apellidos: 'Hernández', telefono: '444 234 5678', liderId: 'ana-torres', usuario: 'MW0011', password: 'MW0011SH', fechaAlta: '2024-02-20T00:00:00.000Z', categoria: 'foranea', estado: 'activa', constancia: { mesesCumplidos: 2, montoMesActual: 650, metaMes: 8000 }, rifa: { montoAcumuladoMes: 650, meta: 3000 } },
    { id: 'valeria-ramirez', nombre: 'Valeria', apellidos: 'Ramírez', telefono: '444 345 6789', liderId: 'maria-camila-sanchez', usuario: 'MW0012', password: 'MW0012VR', fechaAlta: '2023-11-05T00:00:00.000Z', categoria: 'vip', estado: 'activa', constancia: { mesesCumplidos: 9, montoMesActual: 4300, metaMes: 8000 }, rifa: { montoAcumuladoMes: 430, meta: 3000 } },
    { id: 'daniela-martinez', nombre: 'Daniela', apellidos: 'Martínez', telefono: '444 456 7890', liderId: 'maria-camila-sanchez', usuario: 'MW0013', password: 'MW0013DM', fechaAlta: '2024-04-18T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 0, montoMesActual: 790, metaMes: 8000 }, rifa: { montoAcumuladoMes: 790, meta: 3000 } },
    { id: 'paola-gonzalez', nombre: 'Paola', apellidos: 'González', telefono: '444 567 8901', liderId: 'ana-torres', usuario: 'MW0014', password: 'MW0014PG', fechaAlta: '2024-03-01T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 5, montoMesActual: 580, metaMes: 8000 }, rifa: { montoAcumuladoMes: 580, meta: 3000 } },
    { id: 'andrea-castillo', nombre: 'Andrea', apellidos: 'Castillo', telefono: '444 678 9012', liderId: 'maria-camila-sanchez', usuario: 'MW0015', password: 'MW0015AC', fechaAlta: '2023-09-22T00:00:00.000Z', categoria: 'normal', estado: 'inactiva', constancia: { mesesCumplidos: 4, montoMesActual: 0, metaMes: 8000 }, rifa: { montoAcumuladoMes: 0, meta: 3000 } },
    { id: 'camila-rojas', nombre: 'Camila', apellidos: 'Rojas', telefono: '444 789 0123', liderId: 'ana-torres', usuario: 'MW0016', password: 'MW0016CR', fechaAlta: '2024-05-30T00:00:00.000Z', categoria: 'foranea', estado: 'baja', constancia: { mesesCumplidos: 1, montoMesActual: 0, metaMes: 8000 }, rifa: { montoAcumuladoMes: 0, meta: 3000 } },
    { id: 'karla-torres', nombre: 'Karla', apellidos: 'Torres Beltrán', telefono: '444 890 1234', liderId: 'maria-camila-sanchez', usuario: 'MW0017', password: 'MW0017KTB', fechaAlta: '2024-06-10T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 300, metaMes: 8000 }, rifa: { montoAcumuladoMes: 300, meta: 3000 } },
    // Las siguientes 6 se agregaron para que el equipo real de María
    // Camila alcance los 10 integrantes que exige Oro (ver nota de
    // ascenso arriba y js/apartados-modelo.js para sus compras reales
    // de agosto/septiembre 2026).
    { id: 'regina-flores', nombre: 'Regina', apellidos: 'Flores', telefono: '444 901 2345', liderId: 'maria-camila-sanchez', usuario: 'MW0018', password: 'MW0018RF', fechaAlta: '2025-01-10T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 4, montoMesActual: 3200, metaMes: 8000 }, rifa: { montoAcumuladoMes: 3200, meta: 3000 } },
    { id: 'itzel-navarro', nombre: 'Itzel', apellidos: 'Navarro', telefono: '444 902 3456', liderId: 'maria-camila-sanchez', usuario: 'MW0019', password: 'MW0019IN', fechaAlta: '2025-02-14T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 3, montoMesActual: 6500, metaMes: 8000 }, rifa: { montoAcumuladoMes: 6500, meta: 3000 } },
    { id: 'monica-diaz', nombre: 'Mónica', apellidos: 'Díaz', telefono: '444 903 4567', liderId: 'maria-camila-sanchez', usuario: 'MW0020', password: 'MW0020MD', fechaAlta: '2025-03-05T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 700, metaMes: 8000 }, rifa: { montoAcumuladoMes: 700, meta: 3000 } },
    { id: 'brenda-salazar', nombre: 'Brenda', apellidos: 'Salazar', telefono: '444 904 5678', liderId: 'maria-camila-sanchez', usuario: 'MW0021', password: 'MW0021BS', fechaAlta: '2025-04-18T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 700, metaMes: 8000 }, rifa: { montoAcumuladoMes: 700, meta: 3000 } },
    { id: 'cynthia-mora', nombre: 'Cynthia', apellidos: 'Mora', telefono: '444 905 6789', liderId: 'maria-camila-sanchez', usuario: 'MW0022', password: 'MW0022CM', fechaAlta: '2025-05-22T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 700, metaMes: 8000 }, rifa: { montoAcumuladoMes: 700, meta: 3000 } },
    { id: 'leslie-pineda', nombre: 'Leslie', apellidos: 'Pineda', telefono: '444 906 7890', liderId: 'maria-camila-sanchez', usuario: 'MW0023', password: 'MW0023LP', fechaAlta: '2025-06-30T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 700, metaMes: 8000 }, rifa: { montoAcumuladoMes: 700, meta: 3000 } },
    // Equipo de "me-lider" — a propósito se queda corto de los 5
    // integrantes que exige Plata, para servir de ejemplo real de una
    // líder que NO alcanza el mínimo de su rango (ver Comisiones).
    { id: 'gabriela-vega', nombre: 'Gabriela', apellidos: 'Vega', telefono: '444 907 8901', liderId: 'me-lider', usuario: 'MW0024', password: 'MW0024GV', fechaAlta: '2025-07-12T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 2, montoMesActual: 3900, metaMes: 8000 }, rifa: { montoAcumuladoMes: 3900, meta: 3000 } },
    { id: 'renata-campos', nombre: 'Renata', apellidos: 'Campos', telefono: '444 908 9012', liderId: 'me-lider', usuario: 'MW0025', password: 'MW0025RC', fechaAlta: '2025-08-19T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 1, montoMesActual: 2500, metaMes: 8000 }, rifa: { montoAcumuladoMes: 2500, meta: 3000 } },
    { id: 'ximena-duarte', nombre: 'Ximena', apellidos: 'Duarte', telefono: '444 909 0123', liderId: 'me-lider', usuario: 'MW0026', password: 'MW0026XD', fechaAlta: '2025-09-02T00:00:00.000Z', categoria: 'normal', estado: 'activa', constancia: { mesesCumplidos: 0, montoMesActual: 600, metaMes: 8000 }, rifa: { montoAcumuladoMes: 600, meta: 3000 } }
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
    password: 'MW0003CR',
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

// Elimina la cuenta por completo (no es lo mismo que "estado: baja",
// que es reversible y no borra nada). Usado desde Configuración →
// Usuarios y permisos → Cuentas. Quien llame a esta función es
// responsable de mostrar la advertencia y registrar la auditoría —
// este archivo no depende de admin-comun.js.
function eliminarPersona(id) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  guardarPersonas(personas.filter(p => p.id !== id));
  const cred = obtenerCredencialesPersonas();
  if (id in cred) {
    delete cred[id];
    guardarCredencialesPersonas(cred);
  }
  return { ok: true, persona };
}

// ============================================================
// SOLICITUD DE CAMBIO DE RAMA (primeros 5 días desde la inscripción)
// ============================================================
//
// Antes "Gestionar equipo" era solo solicitudes de baja — ahora es
// esto: si una emprendedora nueva quedó bajo la líder equivocada por
// error, cualquiera de las dos líderes involucradas (la que la tiene
// actualmente, o la que considera que debía quedar bajo ella) puede
// solicitar el cambio dentro de los primeros 5 días desde su alta.
// Solo aplica a Emprendedoras (nunca a Líderes) — Admin siempre
// confirma o rechaza, nunca se mueve de rama sola. Dar de baja a una
// persona sigue existiendo aparte, vía Configuración → editar cuenta.

const DIAS_LIMITE_CAMBIO_RAMA = 5;

function puedeSolicitarCambioRama(persona) {
  if (!persona || persona.tipo !== 'emprendedora' || persona.estado === 'baja') return false;
  if (persona.solicitudCambioRamaPendiente) return false;
  const limite = new Date(persona.fechaAlta).getTime() + DIAS_LIMITE_CAMBIO_RAMA * 24 * 60 * 60 * 1000;
  return Date.now() <= limite;
}

function crearSolicitudCambioRama(personaId, { liderPropuestaId, motivo, solicitadoPorId, solicitadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona) return { ok: false, error: 'La persona no existe.' };
  if (!puedeSolicitarCambioRama(persona)) return { ok: false, error: 'Ya pasaron los 5 días desde su inscripción, o ya hay una solicitud pendiente para ella.' };

  const liderPropuesta = personas.find(p => p.id === liderPropuestaId && p.tipo === 'lider' && p.estado !== 'baja');
  if (!liderPropuesta) return { ok: false, error: 'Elige a la líder a la que debería pasar.' };
  if (liderPropuesta.id === persona.liderId) return { ok: false, error: 'Ya está bajo esa líder.' };

  persona.solicitudCambioRamaPendiente = {
    liderActualId: persona.liderId || null,
    liderPropuestaId: liderPropuesta.id,
    motivo: motivo || '',
    solicitadoPorId: solicitadoPorId || null,
    solicitadoPorNombre: solicitadoPorNombre || '',
    fecha: new Date().toISOString()
  };
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `${solicitadoPorNombre} solicitó cambiar a ${nombreCompletoPersona(persona)} a la rama de ${nombreCompletoPersona(liderPropuesta)}${motivo ? `: "${motivo}"` : ''}. Revisa y confirma.`,
      link: `admin-emprendedoras-lideres.html?persona=${persona.id}`,
      paraId: 'admin01',
      rolDestino: 'admin',
      origen: 'emprendedora_lider'
    });
  }

  return { ok: true, persona };

}

function cancelarSolicitudCambioRama(personaId) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona || !persona.solicitudCambioRamaPendiente) return { ok: false, error: 'No hay una solicitud de cambio de rama pendiente.' };
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Ejecuta el cambio: mueve a la persona a la líder propuesta. No
// reasigna ni comprime nada más — una emprendedora recién inscrita
// (única elegible para este flujo) no tiene equipo propio todavía.
function ejecutarCambioRama(personaId, { ejecutadoPorId, ejecutadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona || !persona.solicitudCambioRamaPendiente) return { ok: false, error: 'No hay una solicitud de cambio de rama pendiente.' };

  const { liderActualId, liderPropuestaId } = persona.solicitudCambioRamaPendiente;
  persona.liderId = liderPropuestaId;
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Tu rama cambió — ahora perteneces al equipo de ${nombreCompletoPersona(obtenerPersonaPorId(liderPropuestaId))}.`,
      link: 'cuenta',
      paraId: persona.id,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, persona, liderActualId, liderPropuestaId };

}

// ============================================================
// CAMBIAR LÍDER — DIRECTO POR ADMIN (Lista A, fusión con mi-equipo)
// ============================================================
//
// A diferencia del flujo de arriba (solicitud, solo emprendedoras
// dentro de sus primeros 5 días, alguien tiene que aprobarla), esto es
// exclusivo de Admin: cambia de líder a cualquier emprendedora en el
// momento, sin solicitud ni aprobación — es un botón adicional, no
// reemplaza ni modifica el flujo de solicitud existente. Como el árbol
// se guarda por liderId (cada persona apunta a su líder, no al revés),
// cambiar SOLO el liderId de esta persona ya mueve automáticamente todo
// su subárbol con ella — sus descendientes siguen apuntándole a ELLA,
// no a la raíz.
function cambiarLiderDirectoAdmin(personaId, { liderNuevoId, ejecutadoPorId, ejecutadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona) return { ok: false, error: 'La persona no existe.' };

  const liderNuevo = personas.find(p => p.id === liderNuevoId && p.tipo === 'lider' && p.estado !== 'baja');
  if (!liderNuevo) return { ok: false, error: 'Elige a la líder a la que debería pasar.' };
  if (liderNuevo.id === persona.id) return { ok: false, error: 'No puede ser su propia líder.' };
  if (liderNuevo.id === persona.liderId) return { ok: false, error: 'Ya está bajo esa líder.' };

  // No permitir moverla bajo alguien de su propio equipo (evita un
  // ciclo: quedaría siendo líder de su propia líder).
  if (typeof calcularDescendenciaPersona === 'function') {
    const { conNivel } = calcularDescendenciaPersona(personaId);
    if (conNivel.some(n => n.persona.id === liderNuevo.id)) {
      return { ok: false, error: 'No puede pasar a la rama de alguien que está dentro de su propio equipo.' };
    }
  }

  const liderAnteriorId = persona.liderId || null;
  persona.liderId = liderNuevo.id;
  // Si tenía una solicitud de cambio de rama pendiente, esta acción de
  // Admin la vuelve obsoleta — se descarta en vez de dejarla colgada
  // apuntando a una líder que ya no aplica.
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Administración cambió tu equipo — ahora perteneces a la rama de ${nombreCompletoPersona(liderNuevo)}.`,
      link: 'cuenta',
      paraId: persona.id,
      rolDestino: 'emprendedora_lider'
    });
  }

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'personas',
      accion: 'cambiar_lider_directo',
      descripcion: `${nombreCompletoPersona(persona)} pasó de ${liderAnteriorId ? nombreCompletoPersona(obtenerPersonaPorId(liderAnteriorId) || {}) : 'sin líder'} a ${nombreCompletoPersona(liderNuevo)}`
    });
  }

  return { ok: true, persona, liderAnteriorId, liderNuevoId: liderNuevo.id };

}

function restablecerPasswordPersona(id, nuevoPassword) {
  const persona = obtenerPersonaPorId(id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  if (!nuevoPassword) return { ok: false, error: 'La nueva contraseña no puede estar vacía.' };
  establecerPasswordPersona(id, nuevoPassword);
  return { ok: true, persona };
}

function obtenerPersonaPorId(id) {
  return obtenerPersonas().find(p => p.id === id) || null;
}

// Usado por "Mi cuenta" de Emprendedora/Líder para guardar su propia
// foto de perfil (misma idea que editarCuentaInterna() para Staff/Encargado/
// Admin en cuentas-internas-modelo.js, pero sobre el registro de
// personas).
function actualizarFotoPersona(id, fotoUrl) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  persona.fotoUrl = fotoUrl || '';
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Datos para que Administración le deposite sus comisiones — solo
// tiene sentido para Líderes (Emprendedoras no cobran comisión), pero
// se deja disponible para cualquier persona por si algún día cambia.
// caratulaClabeUrl es una ruta de js/documentos-modelo.js (mismo patrón
// que la INE de Solicitudes) — nunca se guarda el archivo aquí, solo la
// referencia. Se deja fuera si no cambia (quien llama solo la manda
// cuando el usuario subió un archivo nuevo).
function actualizarDatosBancariosPersona(id, { titular, banco, clabe, caratulaClabeUrl }) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  persona.datosBancarios = {
    titular: (titular || '').trim(),
    banco: (banco || '').trim(),
    clabe: (clabe || '').trim(),
    caratulaClabeUrl: caratulaClabeUrl !== undefined ? caratulaClabeUrl : (persona.datosBancarios?.caratulaClabeUrl || null)
  };
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Usado por js/auth-login.js para iniciar sesión como Emprendedora/Líder.
// Una persona 'inactiva' o 'baja' no puede iniciar sesión aunque conozca
// la contraseña, igual que una cuenta interna desactivada.
function verificarCredencialPersona(usuario, password) {
  const persona = obtenerPersonas().find(p => p.usuario === usuario && p.estado === 'activa');
  if (!persona) return null;
  return obtenerPasswordPersona(persona.id) === password ? persona : null;
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

// Inversa de calcularDescendenciaPersona: camina liderId hacia ARRIBA
// desde una persona, hasta maxNiveles líderes (o hasta llegar a la raíz
// del árbol, lo que pase primero). Usada por
// js/alertas-inactividad-modelo.js para avisarle a la línea de líderes
// de una Emprendedora — no filtra por estado, la propia líder decide si
// actúa aunque su cuenta esté marcada inactiva.
function calcularCadenaLideresHaciaArriba(personaId, maxNiveles) {
  const cadena = [];
  let actual = obtenerPersonaPorId(personaId);
  while (actual?.liderId && cadena.length < maxNiveles) {
    const lider = obtenerPersonaPorId(actual.liderId);
    if (!lider) break;
    cadena.push(lider);
    actual = lider;
  }
  return cadena;
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
