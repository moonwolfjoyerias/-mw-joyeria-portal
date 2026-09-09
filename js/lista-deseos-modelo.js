// MW JOYERÍA — Lista de deseos y Solicitudes de resurtido
//
// Reemplaza al prototipo anterior (js/staff-deseos-ejemplo.js +
// js/staff-lista-deseos.js / rh-lista-deseos.js / admin-lista-deseos.js
// en su forma vieja): antes era una sola pieza por solicitud, "hecha"
// por una emprendedora identificada solo por nombre suelto, con un
// pipeline fijo de 4 estados. Este archivo es el modelo nuevo,
// compartido por Staff/RH/Admin — dos colecciones separadas
// conceptualmente, igual que pide el sistema real:
//
//   listaDeseos          — "una persona quiere esta pieza"
//   solicitudesResurtido — "MW debería volver a surtir esta pieza"
//
// Las notificaciones NO son una tercera colección aparte en este
// archivo: reutilizan el sistema ya existente (js/notificaciones-modelo.js
// → colección "notificaciones"), tal como pide la sección 9 del
// encargo ("no crear un sistema paralelo").
//
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3
// sin cambiar la forma de estos objetos.

const LISTA_DESEOS_STORAGE_KEY = 'mw-lista-deseos-v1';
const RESURTIDO_STORAGE_KEY = 'mw-solicitudes-resurtido-v1';
const LISTA_DESEOS_HISTORIAL_KEY = 'mw-lista-deseos-historial-estados-v1';

const ESTADOS_LISTA_DESEOS = {
  pendiente: 'Pendiente',
  en_seguimiento: 'En seguimiento',
  disponible: 'Disponible',
  atendida: 'Atendida',
  cancelada: 'Cancelada'
};

const ESTADOS_RESURTIDO = {
  pendiente: 'Pendiente',
  revisada: 'Revisada',
  atendida: 'Atendida'
};

const ROLES_CREADOR_DESEOS = { staff: 'Staff', rh: 'RH', admin: 'Admin' };

// Mapeo compartido a las clases de badge ya existentes en el portal
// (ver css/styles.css) — ninguna es nueva, se reutilizan tal cual.
const BADGE_ESTADOS_LISTA_DESEOS = {
  pendiente: 'badge-pendiente',
  en_seguimiento: 'badge-revision',
  disponible: 'badge-validado',
  atendida: 'badge-pagada',
  cancelada: 'badge-correccion'
};

const BADGE_ESTADOS_RESURTIDO = {
  pendiente: 'badge-pendiente',
  revisada: 'badge-revision',
  atendida: 'badge-pagada'
};

// ============================================================
// LISTA DE DESEOS
// ============================================================

function obtenerListaDeseos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(LISTA_DESEOS_STORAGE_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) {
    // sigue abajo y reconstruye la semilla
  }
  const semilla = construirListaDeseosEjemplo();
  guardarListaDeseos(semilla);
  return semilla;
}

function guardarListaDeseos(lista) {
  localStorage.setItem(LISTA_DESEOS_STORAGE_KEY, JSON.stringify(lista));
}

function obtenerSolicitudListaDeseosPorId(id) {
  return obtenerListaDeseos().find(s => s.id === id) || null;
}

// destinatario: 'emprendedora' | 'publico'. Si es 'emprendedora',
// personaId es obligatorio y queda vinculada — si es 'publico', nunca
// se pide ni se guarda una cuenta (sección 1 del encargo).
function crearSolicitudListaDeseos({ destinatario, personaId, piezas, creadoPorId, creadoPorNombre, creadoPorRol }) {

  if (destinatario !== 'emprendedora' && destinatario !== 'publico') {
    return { ok: false, error: 'Indica si la solicitud es para una Emprendedora o para público en general.' };
  }

  let persona = null;
  if (destinatario === 'emprendedora') {
    if (!personaId) return { ok: false, error: 'Busca y selecciona a la Emprendedora.' };
    persona = typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(personaId) : null;
    if (!persona) return { ok: false, error: 'No se encontró a esa Emprendedora.' };
  }

  const piezasLimpias = (piezas || [])
    .map(p => ({
      id: `pz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      producto: String(p.producto || '').trim(),
      variante: String(p.variante || '').trim(),
      cantidad: Math.max(1, parseInt(p.cantidad, 10) || 1),
      observaciones: String(p.observaciones || '').trim()
    }))
    .filter(p => p.producto);

  if (!piezasLimpias.length) {
    return { ok: false, error: 'Agrega al menos una pieza con su producto.' };
  }

  const lista = obtenerListaDeseos();
  const nueva = {
    id: `ld-${Date.now()}`,
    destinatario,
    personaId: persona ? persona.id : null,
    personaNombre: persona ? (typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(persona) : persona.nombre) : null,
    piezas: piezasLimpias,
    estado: 'pendiente',
    creadoPorId,
    creadoPorNombre,
    creadoPorRol,
    fechaCreacion: new Date().toISOString(),
    comentarioEstado: null
  };

  lista.unshift(nueva);
  guardarListaDeseos(lista);

  registrarCambioEstadoListaDeseos({
    listaDeseosId: nueva.id,
    estadoAnterior: null,
    estadoNuevo: 'pendiente',
    usuarioId: creadoPorId,
    usuarioNombre: creadoPorNombre,
    usuarioRol: creadoPorRol
  });

  return { ok: true, solicitud: nueva };

}

// "los roles autorizados" (sección 3) son: quien la creó (Staff/RH
// sobre lo suyo) o Administración (sobre cualquiera) — ver
// puedeGestionarListaDeseos() en cada controlador de página.
function actualizarEstadoListaDeseos(id, nuevoEstado, { usuarioId, usuarioNombre, usuarioRol, comentario } = {}) {

  if (!ESTADOS_LISTA_DESEOS[nuevoEstado]) {
    return { ok: false, error: 'Ese estado no es válido.' };
  }

  const lista = obtenerListaDeseos();
  const solicitud = lista.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };

  const estadoAnterior = solicitud.estado;
  solicitud.estado = nuevoEstado;
  solicitud.comentarioEstado = comentario || null;
  guardarListaDeseos(lista);

  registrarCambioEstadoListaDeseos({
    listaDeseosId: id,
    estadoAnterior,
    estadoNuevo: nuevoEstado,
    usuarioId,
    usuarioNombre,
    usuarioRol,
    comentario
  });

  return { ok: true, solicitud };

}

function obtenerHistorialEstadosListaDeseos() {
  try {
    const registros = JSON.parse(localStorage.getItem(LISTA_DESEOS_HISTORIAL_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function obtenerHistorialEstadosListaDeseosPorId(listaDeseosId) {
  return obtenerHistorialEstadosListaDeseos()
    .filter(r => r.listaDeseosId === listaDeseosId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function registrarCambioEstadoListaDeseos({ listaDeseosId, estadoAnterior, estadoNuevo, usuarioId, usuarioNombre, usuarioRol, comentario }) {

  const registro = {
    listaDeseosId,
    estadoAnterior,
    estadoNuevo,
    usuarioId,
    usuarioNombre,
    usuarioRol,
    fecha: new Date().toISOString(),
    comentario: comentario || null
  };

  const historial = obtenerHistorialEstadosListaDeseos();
  historial.push(registro);
  localStorage.setItem(LISTA_DESEOS_HISTORIAL_KEY, JSON.stringify(historial));

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId, usuarioNombre, rol: usuarioRol,
      modulo: 'lista_deseos',
      accion: estadoAnterior ? 'cambio_estado' : 'crear_solicitud',
      descripcion: estadoAnterior
        ? `Lista de deseos ${listaDeseosId}: ${ESTADOS_LISTA_DESEOS[estadoAnterior] || estadoAnterior} → ${ESTADOS_LISTA_DESEOS[estadoNuevo]}${comentario ? ` — ${comentario}` : ''}`
        : `Solicitud de lista de deseos creada (${listaDeseosId})`
    });
  }

  return registro;

}

// ============================================================
// SOLICITUDES DE RESURTIDO
// ============================================================

function obtenerSolicitudesResurtido() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(RESURTIDO_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // sigue abajo y reconstruye la semilla
  }
  const semilla = construirResurtidoEjemplo();
  guardarSolicitudesResurtido(semilla);
  return semilla;
}

function guardarSolicitudesResurtido(lista) {
  localStorage.setItem(RESURTIDO_STORAGE_KEY, JSON.stringify(lista));
}

function obtenerSolicitudResurtidoPorId(id) {
  return obtenerSolicitudesResurtido().find(s => s.id === id) || null;
}

// Solo Staff/RH pueden crear (sección 4) — el controlador de cada
// página ya restringe qué botones se muestran, pero también se valida
// aquí para no depender únicamente de la UI.
function crearSolicitudResurtido({ producto, variante, cantidadSugerida, comentario, solicitadoPorId, solicitadoPorNombre, solicitadoPorRol }) {

  if (solicitadoPorRol !== 'staff' && solicitadoPorRol !== 'rh') {
    return { ok: false, error: 'Solo Staff o RH pueden solicitar un resurtido.' };
  }

  producto = String(producto || '').trim();
  if (!producto) return { ok: false, error: 'Indica el producto o tipo de pieza.' };

  const lista = obtenerSolicitudesResurtido();
  const nueva = {
    id: `res-${Date.now()}`,
    producto,
    variante: String(variante || '').trim(),
    cantidadSugerida: cantidadSugerida ? Math.max(1, parseInt(cantidadSugerida, 10) || 0) : null,
    comentario: String(comentario || '').trim(),
    estado: 'pendiente',
    solicitadoPorId,
    solicitadoPorNombre,
    solicitadoPorRol,
    fechaSolicitud: new Date().toISOString(),
    observaciones: [],
    revisadoPorId: null,
    revisadoPorNombre: null,
    fechaRevisado: null,
    atendidoPorId: null,
    atendidoPorNombre: null,
    fechaAtendido: null
  };

  lista.unshift(nueva);
  guardarSolicitudesResurtido(lista);

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId: solicitadoPorId, usuarioNombre: solicitadoPorNombre, rol: solicitadoPorRol,
      modulo: 'resurtido',
      accion: 'crear_solicitud',
      descripcion: `Solicitud de resurtido creada: ${producto}${nueva.variante ? ` (${nueva.variante})` : ''}`
    });
  }

  if (typeof agregarNotificacion === 'function') {
    const rolLabel = ROLES_CREADOR_DESEOS[solicitadoPorRol] || solicitadoPorRol;
    agregarNotificacion({
      texto: `Solicitud de resurtido: ${solicitadoPorNombre} (${rolLabel}) solicita revisar el resurtido de ${producto}.${nueva.comentario ? ` Motivo: ${nueva.comentario}` : ''}`,
      link: `admin-lista-deseos.html?resurtido=${nueva.id}`,
      rolDestino: 'admin'
    });
  }

  return { ok: true, solicitud: nueva };

}

function marcarResurtidoRevisada(id, { usuarioId, usuarioNombre }) {

  const lista = obtenerSolicitudesResurtido();
  const solicitud = lista.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') return { ok: false, error: 'Esta solicitud ya fue revisada.' };

  solicitud.estado = 'revisada';
  solicitud.revisadoPorId = usuarioId;
  solicitud.revisadoPorNombre = usuarioNombre;
  solicitud.fechaRevisado = new Date().toISOString();
  guardarSolicitudesResurtido(lista);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'resurtido', accion: 'marcar_revisada', descripcion: `Solicitud de resurtido revisada: ${solicitud.producto}` });
  }

  return { ok: true, solicitud };

}

function marcarResurtidoAtendida(id, { usuarioId, usuarioNombre }) {

  const lista = obtenerSolicitudesResurtido();
  const solicitud = lista.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado === 'atendida') return { ok: false, error: 'Esta solicitud ya está atendida.' };

  solicitud.estado = 'atendida';
  solicitud.atendidoPorId = usuarioId;
  solicitud.atendidoPorNombre = usuarioNombre;
  solicitud.fechaAtendido = new Date().toISOString();
  guardarSolicitudesResurtido(lista);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'resurtido', accion: 'marcar_atendida', descripcion: `Solicitud de resurtido atendida: ${solicitud.producto}` });
  }

  if (typeof agregarNotificacion === 'function' && solicitud.solicitadoPorRol) {
    agregarNotificacion({
      texto: `Tu solicitud de resurtido de ${solicitud.producto} fue marcada como atendida.`,
      link: `${solicitud.solicitadoPorRol}-lista-deseos.html?resurtido=${solicitud.id}`,
      rolDestino: solicitud.solicitadoPorRol
    });
  }

  return { ok: true, solicitud };

}

function agregarObservacionResurtido(id, texto, { usuarioId, usuarioNombre }) {

  texto = String(texto || '').trim();
  if (!texto) return { ok: false, error: 'Escribe una observación.' };

  const lista = obtenerSolicitudesResurtido();
  const solicitud = lista.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };

  solicitud.observaciones = solicitud.observaciones || [];
  solicitud.observaciones.push({ texto, usuarioId, usuarioNombre, fecha: new Date().toISOString() });
  guardarSolicitudesResurtido(lista);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'resurtido', accion: 'agregar_observacion', descripcion: `Observación agregada a la solicitud de resurtido de ${solicitud.producto}` });
  }

  return { ok: true, solicitud };

}

// ============================================================
// BÚSQUEDA DE EMPRENDEDORA (por nombre o número de cuenta)
// ============================================================

// "Número de cuenta" en este portal es el mismo campo `usuario`
// (ej. "MW0012") que ya usa Admin → Emprendedoras/Líderes para
// identificar cuentas — no se inventa un campo paralelo.
function buscarEmprendedorasListaDeseos(texto) {
  if (typeof obtenerPersonas !== 'function') return [];
  const q = String(texto || '').trim().toLowerCase();
  const emprendedoras = obtenerPersonas().filter(p => p.tipo === 'emprendedora');
  if (!q) return emprendedoras.slice(0, 8);
  return emprendedoras.filter(p =>
    (typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(p) : p.nombre).toLowerCase().includes(q) ||
    (p.usuario || '').toLowerCase().includes(q) ||
    (p.numeroCuenta || '').toLowerCase().includes(q)
  ).slice(0, 8);
}

// ============================================================
// DATOS DE EJEMPLO
// ============================================================

function construirListaDeseosEjemplo() {
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'ld-ejemplo-1',
      destinatario: 'emprendedora',
      personaId: 'valeria-ramirez',
      personaNombre: 'Valeria Ramírez',
      piezas: [
        { id: 'pz-ej-1', producto: 'Cadena eslabón ovalado', variante: '45cm · Amarillo', cantidad: 1, observaciones: 'La vio en el catálogo de agosto.' }
      ],
      estado: 'en_seguimiento',
      creadoPorId: 'staff01', creadoPorNombre: 'Ana López', creadoPorRol: 'staff',
      fechaCreacion: new Date(ahora - 3 * dia).toISOString(),
      comentarioEstado: null
    },
    {
      id: 'ld-ejemplo-2',
      destinatario: 'emprendedora',
      personaId: 'sofia-hernandez',
      personaNombre: 'Sofía Hernández',
      piezas: [
        { id: 'pz-ej-2', producto: 'Arracadas trenzadas', variante: 'Doradas, medianas', cantidad: 1, observaciones: '' },
        { id: 'pz-ej-3', producto: 'Dije corazón minimalista', variante: '', cantidad: 2, observaciones: 'Uno para ella y uno para regalo.' }
      ],
      estado: 'disponible',
      creadoPorId: 'rh01', creadoPorNombre: 'Recursos Humanos', creadoPorRol: 'rh',
      fechaCreacion: new Date(ahora - 6 * dia).toISOString(),
      comentarioEstado: null
    },
    {
      id: 'ld-ejemplo-3',
      destinatario: 'publico',
      personaId: null,
      personaNombre: null,
      piezas: [
        { id: 'pz-ej-4', producto: 'Anillo solitario con circonia', variante: 'Talla 7', cantidad: 3, observaciones: 'Varias clientas lo han pedido en el local.' }
      ],
      estado: 'pendiente',
      creadoPorId: 'staff01', creadoPorNombre: 'Ana López', creadoPorRol: 'staff',
      fechaCreacion: new Date(ahora - 1 * dia).toISOString(),
      comentarioEstado: null
    },
    {
      id: 'ld-ejemplo-4',
      destinatario: 'emprendedora',
      personaId: 'daniela-martinez',
      personaNombre: 'Daniela Martínez',
      piezas: [
        { id: 'pz-ej-5', producto: 'Pulsera eslabón', variante: 'Dorada, 17cm', cantidad: 1, observaciones: '' }
      ],
      estado: 'atendida',
      creadoPorId: 'admin01', creadoPorNombre: 'Claudia', creadoPorRol: 'admin',
      fechaCreacion: new Date(ahora - 10 * dia).toISOString(),
      comentarioEstado: 'Entregada en el evento del 22 de agosto.'
    }
  ];
}

function construirResurtidoEjemplo() {
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;
  return [
    {
      id: 'res-ejemplo-1',
      producto: 'Cadenas blancas',
      variante: '',
      cantidadSugerida: 20,
      comentario: 'Varias Emprendedoras han solicitado este modelo y actualmente no hay disponibilidad.',
      estado: 'pendiente',
      solicitadoPorId: 'staff01', solicitadoPorNombre: 'Ana López', solicitadoPorRol: 'staff',
      fechaSolicitud: new Date(ahora - 2 * dia).toISOString(),
      observaciones: [],
      revisadoPorId: null, revisadoPorNombre: null, fechaRevisado: null,
      atendidoPorId: null, atendidoPorNombre: null, fechaAtendido: null
    },
    {
      id: 'res-ejemplo-2',
      producto: 'Pulseras doradas',
      variante: 'Eslabón grueso',
      cantidadSugerida: 12,
      comentario: 'Es de las piezas más pedidas del mes y ya no queda en el local.',
      estado: 'revisada',
      solicitadoPorId: 'rh01', solicitadoPorNombre: 'Recursos Humanos', solicitadoPorRol: 'rh',
      fechaSolicitud: new Date(ahora - 5 * dia).toISOString(),
      observaciones: [{ texto: 'Ya se apartaron con el proveedor, llegan la próxima semana.', usuarioId: 'admin01', usuarioNombre: 'Claudia', fecha: new Date(ahora - 4 * dia).toISOString() }],
      revisadoPorId: 'admin01', revisadoPorNombre: 'Claudia', fechaRevisado: new Date(ahora - 4 * dia).toISOString(),
      atendidoPorId: null, atendidoPorNombre: null, fechaAtendido: null
    }
  ];
}
