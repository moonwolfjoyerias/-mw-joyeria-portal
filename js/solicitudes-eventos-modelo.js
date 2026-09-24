// MW JOYERÍA — Solicitudes de evento (Emprendedora/Líder -> Admin)
//
// Una Emprendedora/Líder que quiere invitar a la comunidad a un evento
// que ella organiza (p. ej. una presentación en otra ciudad) manda una
// "Solicitud de evento" con título/fecha/hora/descripción. Admin la
// aprueba (se publica en el calendario compartido, origen:
// 'emprendedora_lider') o la rechaza con motivo.
//
// Colección separada de js/solicitudes-modelo.js (inscripción) a
// propósito — mismo patrón de "solicitud pendiente -> Admin resuelve",
// pero datos y validaciones distintas; se unen solo en la vista de
// Admin (admin-solicitudes.js), nunca en el almacenamiento.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos hasta integrar
// Firestore en Fase 3 — igual que js/eventos-modelo.js, del que depende
// para publicar el evento ya aprobado.

const SOLICITUDES_EVENTOS_STORAGE_KEY = 'mw-solicitudes-eventos-v1';

const ESTADOS_SOLICITUD_EVENTO = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada'
};

function obtenerSolicitudesEventos() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(SOLICITUDES_EVENTOS_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // localStorage inválido: seguimos con la lista vacía.
  }
  return [];
}

function guardarSolicitudesEventos(lista) {
  localStorage.setItem(SOLICITUDES_EVENTOS_STORAGE_KEY, JSON.stringify(lista));
}

function obtenerSolicitudEventoPorId(id) {
  return obtenerSolicitudesEventos().find(s => s.id === id) || null;
}

// Vista del solicitante: solo sus propias solicitudes de evento.
function obtenerSolicitudesEventosDe(solicitanteId) {
  return obtenerSolicitudesEventos()
    .filter(s => s.solicitanteId === solicitanteId)
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
}

// ============================================================
// CREAR
// ============================================================

function crearSolicitudEvento({ solicitanteId, solicitanteNombre, titulo, fecha, hora, tipo, lugarTexto, enlace, descripcion }) {

  titulo = String(titulo || '').trim();
  fecha = String(fecha || '').trim();
  hora = String(hora || '').trim();
  lugarTexto = String(lugarTexto || '').trim();
  descripcion = String(descripcion || '').trim();
  enlace = String(enlace || '').trim();

  if (!titulo) return { ok: false, error: 'Escribe el título del evento.' };
  if (!fecha) return { ok: false, error: 'Elige la fecha del evento.' };
  if (!hora) return { ok: false, error: 'Escribe la hora del evento.' };
  if (tipo !== 'presencial' && tipo !== 'virtual') return { ok: false, error: 'Elige si el evento es presencial o virtual.' };
  if (!lugarTexto) return { ok: false, error: tipo === 'presencial' ? 'Escribe el lugar del evento.' : 'Escribe cómo se conectarán (por ejemplo, un enlace de Zoom).' };
  if (!descripcion) return { ok: false, error: 'Escribe una descripción para invitar a las demás.' };

  const solicitud = {
    id: `SOLEV-${Date.now()}`,
    solicitanteId,
    solicitanteNombre,

    titulo, fecha, hora, tipo, lugarTexto, enlace, descripcion,

    estado: 'pendiente',
    fechaSolicitud: new Date().toISOString(),

    revisadoPor: null,
    fechaRevision: null,
    motivoRechazo: null,

    eventoCreadoId: null
  };

  const solicitudes = obtenerSolicitudesEventos();
  solicitudes.unshift(solicitud);
  guardarSolicitudesEventos(solicitudes);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `${solicitanteNombre} solicitó publicar el evento "${titulo}" en el calendario. Revísalo.`,
      link: `admin-solicitudes.html?solicitud=${solicitud.id}&tipo=evento`,
      paraId: 'admin01',
      rolDestino: 'admin',
      origen: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud };

}

// ============================================================
// APROBAR / RECHAZAR (Administración)
// ============================================================

function aprobarSolicitudEvento(solicitudId, { adminId, adminNombre }) {

  const solicitudes = obtenerSolicitudesEventos();
  const solicitud = solicitudes.find(s => s.id === solicitudId);

  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') {
    return { ok: false, error: 'Esta solicitud ya fue resuelta y no puede aprobarse de nuevo.' };
  }

  const nuevoEvento = {
    id: `ev-${Date.now()}`,
    fecha: solicitud.fecha,
    titulo: solicitud.titulo,
    hora: solicitud.hora,
    tipo: solicitud.tipo,
    lugarTexto: solicitud.lugarTexto,
    enlace: solicitud.enlace || (solicitud.tipo === 'presencial'
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(solicitud.lugarTexto)}`
      : '#'),
    descripcion: solicitud.descripcion,
    tieneFoto: false,
    origen: 'emprendedora_lider',
    solicitanteId: solicitud.solicitanteId,
    solicitanteNombre: solicitud.solicitanteNombre,
    asistentes: []
  };

  const eventos = typeof cargarEventosCompartidos === 'function' ? cargarEventosCompartidos() : [];
  eventos.push(nuevoEvento);
  if (typeof guardarEventosCompartidos === 'function') guardarEventosCompartidos(eventos);

  solicitud.estado = 'aprobada';
  solicitud.revisadoPor = adminId;
  solicitud.fechaRevision = new Date().toISOString();
  solicitud.eventoCreadoId = nuevoEvento.id;
  guardarSolicitudesEventos(solicitudes);

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      rol: 'admin',
      modulo: 'solicitudes',
      accion: 'aprobacion',
      descripcion: `Solicitud de evento "${solicitud.titulo}" de ${solicitud.solicitanteNombre} aprobada — publicada en el calendario.`
    });
  }

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Tu solicitud de evento "${solicitud.titulo}" fue aprobada — ya está publicada en el calendario.`,
      link: 'calendario',
      paraId: solicitud.solicitanteId,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud, evento: nuevoEvento };

}

function rechazarSolicitudEvento(solicitudId, { adminId, adminNombre, motivo }) {

  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, error: 'Escribe el motivo del rechazo.' };

  const solicitudes = obtenerSolicitudesEventos();
  const solicitud = solicitudes.find(s => s.id === solicitudId);

  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') {
    return { ok: false, error: 'Esta solicitud ya fue resuelta y no puede rechazarse.' };
  }

  solicitud.estado = 'rechazada';
  solicitud.revisadoPor = adminId;
  solicitud.fechaRevision = new Date().toISOString();
  solicitud.motivoRechazo = motivo;
  guardarSolicitudesEventos(solicitudes);

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      rol: 'admin',
      modulo: 'solicitudes',
      accion: 'rechazo',
      descripcion: `Solicitud de evento "${solicitud.titulo}" de ${solicitud.solicitanteNombre} rechazada. Motivo: ${motivo}`
    });
  }

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Tu solicitud de evento "${solicitud.titulo}" fue rechazada. Motivo: ${motivo}`,
      link: 'calendario',
      paraId: solicitud.solicitanteId,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud };

}
