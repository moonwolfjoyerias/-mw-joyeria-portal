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
// FB-04 de la auditoría: mismo patrón de repositorio dual que ya usa
// js/solicitudes-modelo.js (FASE 2, AUDITORIA-FIREBASE.md sección G.1)
// — todas las funciones públicas son async: si dbFirestore tiene valor
// (MODO_DEMO=false + config real), leen/escriben la colección
// "solicitudesEventos" de Firestore; si no, siguen igual que antes
// sobre localStorage. Sigue dependiendo de js/eventos-modelo.js (ya
// migrado) para publicar el evento una vez aprobada la solicitud.

const SOLICITUDES_EVENTOS_STORAGE_KEY = 'mw-solicitudes-eventos-v1';
const SOLICITUDES_EVENTOS_COLECCION_FIRESTORE = 'solicitudesEventos';

const ESTADOS_SOLICITUD_EVENTO = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada'
};

function obtenerSolicitudesEventosLocal() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(SOLICITUDES_EVENTOS_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // localStorage inválido: seguimos con la lista vacía.
  }
  return [];
}

function guardarSolicitudesEventosLocal(lista) {
  localStorage.setItem(SOLICITUDES_EVENTOS_STORAGE_KEY, JSON.stringify(lista));
}

// Mismo mapeo que solicitudDesdeDocFirestore en solicitudes-modelo.js —
// "id" incluido, fechaSolicitud/fechaRevision como ISO string igual que
// produce localStorage, así ningún renderizador distingue de dónde vino.
function solicitudEventoDesdeDocFirestore(doc) {
  const datos = doc.data();
  return {
    ...datos,
    id: doc.id,
    fechaSolicitud: datos.fechaSolicitud?.toDate ? datos.fechaSolicitud.toDate().toISOString() : datos.fechaSolicitud,
    fechaRevision: datos.fechaRevision?.toDate ? datos.fechaRevision.toDate().toISOString() : (datos.fechaRevision || null)
  };
}

async function obtenerSolicitudesEventos() {
  if (dbFirestore) {
    const snap = await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE).orderBy('fechaSolicitud', 'desc').get();
    return snap.docs.map(solicitudEventoDesdeDocFirestore);
  }
  return obtenerSolicitudesEventosLocal();
}

async function obtenerSolicitudEventoPorId(id) {
  if (dbFirestore) {
    const doc = await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE).doc(id).get();
    return doc.exists ? solicitudEventoDesdeDocFirestore(doc) : null;
  }
  return obtenerSolicitudesEventosLocal().find(s => s.id === id) || null;
}

// Vista del solicitante: solo sus propias solicitudes de evento.
//
// ⚠️ La consulta de Firestore (where + orderBy en campos distintos)
// necesita un índice compuesto — Firestore lo pide la primera vez que se
// ejecute en un proyecto real, con un enlace para crearlo en un clic
// (mismo aviso que ya documenta obtenerSolicitudesDe en
// solicitudes-modelo.js).
async function obtenerSolicitudesEventosDe(solicitanteId) {
  if (dbFirestore) {
    const snap = await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE)
      .where('solicitanteId', '==', solicitanteId)
      .orderBy('fechaSolicitud', 'desc')
      .get();
    return snap.docs.map(solicitudEventoDesdeDocFirestore);
  }
  return obtenerSolicitudesEventosLocal()
    .filter(s => s.solicitanteId === solicitanteId)
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
}

// ============================================================
// CREAR
// ============================================================

async function crearSolicitudEvento({ solicitanteId, solicitanteNombre, titulo, fecha, hora, tipo, lugarTexto, enlace, descripcion }) {

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

  const datosSolicitud = {
    solicitanteId,
    solicitanteNombre,

    titulo, fecha, hora, tipo, lugarTexto, enlace, descripcion,

    estado: 'pendiente',

    revisadoPor: null,
    fechaRevision: null,
    motivoRechazo: null,

    eventoCreadoId: null
  };

  let solicitud;

  if (dbFirestore) {
    const docRef = await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE).add({
      ...datosSolicitud,
      fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Marca de tiempo optimista solo para pintar de inmediato en pantalla
    // — la autoritativa es el serverTimestamp() que ya quedó guardado.
    solicitud = { ...datosSolicitud, id: docRef.id, fechaSolicitud: new Date().toISOString() };
  } else {
    solicitud = { ...datosSolicitud, id: `SOLEV-${Date.now()}`, fechaSolicitud: new Date().toISOString() };
    const solicitudes = obtenerSolicitudesEventosLocal();
    solicitudes.unshift(solicitud);
    guardarSolicitudesEventosLocal(solicitudes);
  }

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

async function aprobarSolicitudEvento(solicitudId, { adminId, adminNombre }) {

  const solicitud = await obtenerSolicitudEventoPorId(solicitudId);

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

  const cambios = {
    estado: 'aprobada',
    revisadoPor: adminId,
    fechaRevision: new Date().toISOString(),
    eventoCreadoId: nuevoEvento.id
  };

  if (dbFirestore) {
    await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE).doc(solicitudId).update(cambios);
  } else {
    const solicitudes = obtenerSolicitudesEventosLocal();
    const solicitudLocal = solicitudes.find(s => s.id === solicitudId);
    if (solicitudLocal) Object.assign(solicitudLocal, cambios);
    guardarSolicitudesEventosLocal(solicitudes);
  }

  Object.assign(solicitud, cambios);

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

async function rechazarSolicitudEvento(solicitudId, { adminId, adminNombre, motivo }) {

  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, error: 'Escribe el motivo del rechazo.' };

  const solicitud = await obtenerSolicitudEventoPorId(solicitudId);

  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') {
    return { ok: false, error: 'Esta solicitud ya fue resuelta y no puede rechazarse.' };
  }

  const cambios = {
    estado: 'rechazada',
    revisadoPor: adminId,
    fechaRevision: new Date().toISOString(),
    motivoRechazo: motivo
  };

  if (dbFirestore) {
    await dbFirestore.collection(SOLICITUDES_EVENTOS_COLECCION_FIRESTORE).doc(solicitudId).update(cambios);
  } else {
    const solicitudes = obtenerSolicitudesEventosLocal();
    const solicitudLocal = solicitudes.find(s => s.id === solicitudId);
    if (solicitudLocal) Object.assign(solicitudLocal, cambios);
    guardarSolicitudesEventosLocal(solicitudes);
  }

  Object.assign(solicitud, cambios);

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
