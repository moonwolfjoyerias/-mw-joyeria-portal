// MW JOYERÍA — Rifa del mes: qué se rifa y cómo participan Emprendedoras/Líderes
//
// Esto es DISTINTO de los boletos de la rifa (persona.rifa.boletosPorMes,
// ver js/plan-mw-admin.js) — aquello es "quién gana un boleto por sus
// compras del mes"; esto es "qué premio se va a rifar este mes", decidido
// por Admin en uno de dos modos:
//
//   solicitud — cada persona escribe + sube foto de algo que le gustaría
//               (una solicitud vigente por persona por mes, editable).
//   votacion  — Admin sube opciones (nombre, foto, descripción) y cada
//               persona vota por una (puede cambiar su voto mientras el
//               mes siga abierto).
//
// Admin decide el modo del mes en curso y ve todas las solicitudes o el
// detalle de todos los votos (sección 9 del encargo original — "no crear
// un sistema paralelo" — reutiliza agregarNotificacion cuando aplica).
//
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3 sin
// cambiar la forma de estos objetos.

const RIFA_MENSUAL_CONFIG_KEY = 'mw-rifa-mensual-config-v1';
const RIFA_MENSUAL_SOLICITUDES_KEY = 'mw-rifa-mensual-solicitudes-v1';
const RIFA_MENSUAL_VOTOS_KEY = 'mw-rifa-mensual-votos-v1';

const MODOS_RIFA_MENSUAL = { solicitud: 'Solicitud', votacion: 'Votación' };

function obtenerMesKeyActualRifaMensual() {
  if (typeof mesKeyActualComprasModelo === 'function') return mesKeyActualComprasModelo();
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

// ============================================================
// CONFIGURACIÓN DEL MES (modo + opciones para modo votación)
// ============================================================

function obtenerConfigsRifaMensual() {
  try {
    const guardado = JSON.parse(localStorage.getItem(RIFA_MENSUAL_CONFIG_KEY));
    if (guardado && typeof guardado === 'object') return guardado;
  } catch (error) {
    // sigue abajo con un objeto vacío
  }
  return {};
}

function guardarConfigsRifaMensual(configs) {
  localStorage.setItem(RIFA_MENSUAL_CONFIG_KEY, JSON.stringify(configs));
}

// Config del mes indicado (por defecto, el mes en curso) — nunca null,
// regresa un objeto vacío con modo: null si Admin todavía no decide nada.
function obtenerConfigRifaMes(mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  const configs = obtenerConfigsRifaMensual();
  return configs[mesKey] || { mesKey, modo: null, opciones: [] };
}

function establecerModoRifaMes(mesKey, modo, { usuarioId, usuarioNombre } = {}) {
  if (!MODOS_RIFA_MENSUAL[modo]) return { ok: false, error: 'Ese modo no es válido.' };

  const configs = obtenerConfigsRifaMensual();
  const actual = configs[mesKey] || { mesKey, modo: null, opciones: [] };
  actual.modo = modo;
  actual.actualizadoEn = new Date().toISOString();
  actual.actualizadoPorId = usuarioId || null;
  actual.actualizadoPorNombre = usuarioNombre || null;
  configs[mesKey] = actual;
  guardarConfigsRifaMensual(configs);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'rifa_mensual', accion: 'cambiar_modo', descripcion: `Rifa del mes ${mesKey}: modo cambiado a "${MODOS_RIFA_MENSUAL[modo]}"` });
  }

  return { ok: true, config: actual };
}

function agregarOpcionRifaMes(mesKey, { nombre, fotoUrl, descripcion }, { usuarioId, usuarioNombre } = {}) {
  nombre = String(nombre || '').trim();
  if (!nombre) return { ok: false, error: 'Escribe el nombre del regalo.' };

  const configs = obtenerConfigsRifaMensual();
  const actual = configs[mesKey] || { mesKey, modo: null, opciones: [] };
  actual.opciones = actual.opciones || [];

  const opcion = {
    id: `rifa-op-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    nombre,
    fotoUrl: fotoUrl || '',
    descripcion: String(descripcion || '').trim(),
    creadoEn: new Date().toISOString()
  };
  actual.opciones.push(opcion);
  configs[mesKey] = actual;
  guardarConfigsRifaMensual(configs);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'rifa_mensual', accion: 'agregar_opcion', descripcion: `Rifa del mes ${mesKey}: se agregó la opción "${nombre}"` });
  }

  return { ok: true, opcion };
}

function editarOpcionRifaMes(mesKey, opcionId, { nombre, fotoUrl, descripcion }) {
  const configs = obtenerConfigsRifaMensual();
  const actual = configs[mesKey];
  const opcion = actual && (actual.opciones || []).find(o => o.id === opcionId);
  if (!opcion) return { ok: false, error: 'Esa opción no existe.' };

  if (nombre !== undefined) opcion.nombre = String(nombre).trim();
  if (fotoUrl !== undefined) opcion.fotoUrl = fotoUrl;
  if (descripcion !== undefined) opcion.descripcion = String(descripcion).trim();
  if (!opcion.nombre) return { ok: false, error: 'El nombre del regalo no puede quedar vacío.' };

  guardarConfigsRifaMensual(configs);
  return { ok: true, opcion };
}

function eliminarOpcionRifaMes(mesKey, opcionId, { usuarioId, usuarioNombre } = {}) {
  const configs = obtenerConfigsRifaMensual();
  const actual = configs[mesKey];
  if (!actual) return { ok: false, error: 'Ese mes no tiene configuración.' };

  const antes = (actual.opciones || []).length;
  actual.opciones = (actual.opciones || []).filter(o => o.id !== opcionId);
  if (actual.opciones.length === antes) return { ok: false, error: 'Esa opción no existe.' };
  guardarConfigsRifaMensual(configs);

  // Los votos ya emitidos por esa opción quedan como historial (no se
  // borran) — solo dejan de tener una opción vigente a la que apuntar;
  // el conteo (obtenerConteoVotosRifaMes) ya ignora votos sin opción viva.
  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'rifa_mensual', accion: 'eliminar_opcion', descripcion: `Rifa del mes ${mesKey}: se eliminó una opción` });
  }

  return { ok: true };
}

// ============================================================
// MODO SOLICITUD — "algo que le gustaría"
// ============================================================

function obtenerSolicitudesRifaMensual() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(RIFA_MENSUAL_SOLICITUDES_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // sigue abajo
  }
  return [];
}

function guardarSolicitudesRifaMensual(lista) {
  localStorage.setItem(RIFA_MENSUAL_SOLICITUDES_KEY, JSON.stringify(lista));
}

// Una sola solicitud VIGENTE por persona por mes — volver a enviar
// reemplaza (editable) la anterior de ese mismo mes, no acumula.
function obtenerSolicitudRifaPersona(personaId, mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  return obtenerSolicitudesRifaMensual().find(s => s.personaId === personaId && s.mesKey === mesKey) || null;
}

function guardarSolicitudRifaPersona({ personaId, personaNombre, mesKey, texto, fotoUrl }) {
  texto = String(texto || '').trim();
  if (!texto) return { ok: false, error: 'Escribe qué te gustaría que se rifara este mes.' };

  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  const lista = obtenerSolicitudesRifaMensual();
  const existente = lista.find(s => s.personaId === personaId && s.mesKey === mesKey);

  if (existente) {
    existente.texto = texto;
    if (fotoUrl !== undefined) existente.fotoUrl = fotoUrl;
    existente.actualizadoEn = new Date().toISOString();
    guardarSolicitudesRifaMensual(lista);
    return { ok: true, solicitud: existente };
  }

  const nueva = {
    id: `rifa-sol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    personaId,
    personaNombre: personaNombre || '',
    mesKey,
    texto,
    fotoUrl: fotoUrl || '',
    fecha: new Date().toISOString()
  };
  lista.unshift(nueva);
  guardarSolicitudesRifaMensual(lista);
  return { ok: true, solicitud: nueva };
}

function obtenerSolicitudesRifaMes(mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  return obtenerSolicitudesRifaMensual()
    .filter(s => s.mesKey === mesKey)
    .sort((a, b) => (b.actualizadoEn || b.fecha).localeCompare(a.actualizadoEn || a.fecha));
}

// ============================================================
// MODO VOTACIÓN — cada persona vota por una opción de Admin
// ============================================================

function obtenerVotosRifaMensual() {
  try {
    const guardados = JSON.parse(localStorage.getItem(RIFA_MENSUAL_VOTOS_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) {
    // sigue abajo
  }
  return [];
}

function guardarVotosRifaMensual(lista) {
  localStorage.setItem(RIFA_MENSUAL_VOTOS_KEY, JSON.stringify(lista));
}

// Un solo voto VIGENTE por persona por mes — puede cambiarlo mientras
// el mes siga abierto (vuelve a llamar esta misma función).
function obtenerVotoRifaPersona(personaId, mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  return obtenerVotosRifaMensual().find(v => v.personaId === personaId && v.mesKey === mesKey) || null;
}

function votarOpcionRifaMes({ personaId, personaNombre, mesKey, opcionId }) {
  if (!opcionId) return { ok: false, error: 'Elige una opción para votar.' };

  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  const config = obtenerConfigRifaMes(mesKey);
  if (!(config.opciones || []).some(o => o.id === opcionId)) {
    return { ok: false, error: 'Esa opción ya no está disponible.' };
  }

  const lista = obtenerVotosRifaMensual();
  const existente = lista.find(v => v.personaId === personaId && v.mesKey === mesKey);

  if (existente) {
    existente.opcionId = opcionId;
    existente.actualizadoEn = new Date().toISOString();
    guardarVotosRifaMensual(lista);
    return { ok: true, voto: existente };
  }

  const nuevo = {
    personaId,
    personaNombre: personaNombre || '',
    mesKey,
    opcionId,
    fecha: new Date().toISOString()
  };
  lista.push(nuevo);
  guardarVotosRifaMensual(lista);
  return { ok: true, voto: nuevo };
}

function obtenerVotosRifaMes(mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  return obtenerVotosRifaMensual()
    .filter(v => v.mesKey === mesKey)
    .sort((a, b) => (b.actualizadoEn || b.fecha).localeCompare(a.actualizadoEn || a.fecha));
}

// Conteo por opción (incluye las que van en 0), en el mismo orden en
// que Admin las capturó.
function obtenerConteoVotosRifaMes(mesKey) {
  mesKey = mesKey || obtenerMesKeyActualRifaMensual();
  const config = obtenerConfigRifaMes(mesKey);
  const votos = obtenerVotosRifaMes(mesKey);
  return (config.opciones || []).map(opcion => ({
    opcion,
    votos: votos.filter(v => v.opcionId === opcion.id)
  }));
}
