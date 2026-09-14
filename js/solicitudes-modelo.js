// MW JOYERÍA — Solicitudes de inscripción de nuevas Emprendedoras
//
// Regla principal: tanto Emprendedoras como Líderes pueden solicitar la
// inscripción de una nueva persona. Al aprobar, Administración crea una
// cuenta que SIEMPRE nace como Emprendedora, y el solicitante (sin
// importar si es Emprendedora o Líder) queda registrado como su líder
// directa — nunca se crea una cuenta nueva para el solicitante.
//
// Reutiliza (no duplica):
// - js/personas-ejemplo.js — registro de cuentas (crearPersonaEjemplo,
//   obtenerPersonas/guardarPersonas, existePersonaConCorreoOTelefono).
// - js/auditoria-modelo.js — registrarAuditoria (misma bitácora que ya
//   usan Staff/RH/Admin, no se crea un sistema de auditoría aparte).
// - js/notificaciones-modelo.js — agregarNotificacion (extiende la
//   campana de notificaciones existente).
//
// FASE 2 (Firebase): este es el primer módulo migrado al patrón de
// repositorio dual que describe AUDITORIA-FIREBASE.md (sección G.1).
// Todas las funciones públicas son ahora async: si js/firebase-init.js
// dejó `dbFirestore` con valor (MODO_DEMO=false + config real), leen y
// escriben en la colección "solicitudesInscripcion" de Firestore; si no,
// siguen funcionando exactamente igual que antes sobre localStorage —
// mismo comportamiento en modo demo, cero regresión.
//
// personas-ejemplo.js, auditoria-modelo.js y notificaciones-modelo.js
// TODAVÍA no están migrados — por eso aprobarSolicitud() sigue creando
// la persona nueva vía crearPersonaEjemplo() (localStorage) aunque esta
// solicitud ya viva en Firestore. Eso es intencional: la migración es
// incremental por módulo, no todo o nada (ver AUDITORIA-FIREBASE.md).

const SOLICITUDES_STORAGE_KEY = 'mw-solicitudes-inscripcion-v1';
const SOLICITUDES_COLECCION_FIRESTORE = 'solicitudesInscripcion';

const ESTADOS_SOLICITUD = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada'
};

// ============================================================
// ALMACENAMIENTO — respaldo local (localStorage)
// ============================================================

function obtenerSolicitudesLocal() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(SOLICITUDES_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // sigue abajo
  }
  return [];
}

function guardarSolicitudesLocal(lista) {
  localStorage.setItem(SOLICITUDES_STORAGE_KEY, JSON.stringify(lista));
}

// ============================================================
// ALMACENAMIENTO — repositorio (Firestore o localStorage)
// ============================================================

// Convierte un doc de Firestore al mismo shape que ya usa toda la
// interfaz (con "id" incluido, y fechaSolicitud/fechaRevision como ISO
// string igual que produce localStorage) — así ningún renderizador tiene
// que distinguir de dónde vino el dato.
function solicitudDesdeDocFirestore(doc) {
  const datos = doc.data();
  return {
    ...datos,
    id: doc.id,
    fechaSolicitud: datos.fechaSolicitud?.toDate ? datos.fechaSolicitud.toDate().toISOString() : datos.fechaSolicitud,
    fechaRevision: datos.fechaRevision?.toDate ? datos.fechaRevision.toDate().toISOString() : (datos.fechaRevision || null)
  };
}

async function obtenerSolicitudes() {
  if (dbFirestore) {
    const snap = await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE).orderBy('fechaSolicitud', 'desc').get();
    return snap.docs.map(solicitudDesdeDocFirestore);
  }
  return obtenerSolicitudesLocal();
}

async function obtenerSolicitudPorId(id) {
  if (dbFirestore) {
    const doc = await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE).doc(id).get();
    return doc.exists ? solicitudDesdeDocFirestore(doc) : null;
  }
  return obtenerSolicitudesLocal().find(s => s.id === id) || null;
}

// Vista del solicitante: solo sus propias solicitudes (sección 5 y 15
// del documento de requisitos — nunca las de otra persona).
//
// ⚠️ La consulta de Firestore (where + orderBy en campos distintos)
// necesita un índice compuesto — Firestore lo pide la primera vez que se
// ejecute en un proyecto real, con un enlace para crearlo en un clic.
async function obtenerSolicitudesDe(solicitanteId) {
  if (dbFirestore) {
    const snap = await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE)
      .where('solicitanteId', '==', solicitanteId)
      .orderBy('fechaSolicitud', 'desc')
      .get();
    return snap.docs.map(solicitudDesdeDocFirestore);
  }
  return obtenerSolicitudesLocal()
    .filter(s => s.solicitanteId === solicitanteId)
    .sort((a, b) => b.fechaSolicitud.localeCompare(a.fechaSolicitud));
}

// ============================================================
// VALIDACIÓN Y CREACIÓN
// ============================================================

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

// usuario.rol === 'emprendedora' || usuario.rol === 'lider' — NUNCA
// solo 'lider'. Este es el caso obligatorio de la Sección 21: una
// Emprendedora también puede invitar.
function puedeSolicitarInscripcion(rol) {
  return rol === 'emprendedora' || rol === 'lider';
}

async function crearSolicitudInscripcion({ solicitanteId, solicitanteNombre, solicitanteRol, nombreCompleto, telefono, correo, ineUrl }) {

  if (!puedeSolicitarInscripcion(solicitanteRol)) {
    return { ok: false, error: 'Tu cuenta no tiene permiso para enviar solicitudes de inscripción.' };
  }

  nombreCompleto = String(nombreCompleto || '').trim();
  telefono = String(telefono || '').trim();
  correo = String(correo || '').trim();

  if (!nombreCompleto) return { ok: false, error: 'Escribe el nombre completo de la persona.' };
  if (!telefono) return { ok: false, error: 'Escribe su número de celular.' };
  if (!correoValido(correo)) return { ok: false, error: 'Escribe un correo electrónico válido.' };
  if (!ineUrl) return { ok: false, error: 'Adjunta la foto de identificación oficial (INE).' };

  const telefonoNorm = telefono.replace(/\D/g, '');
  const correoNorm = correo.toLowerCase();

  const solicitudesExistentes = await obtenerSolicitudes();
  const yaPendiente = solicitudesExistentes.some(s =>
    s.estado === 'pendiente' &&
    (s.correo.toLowerCase() === correoNorm || s.telefono.replace(/\D/g, '') === telefonoNorm)
  );
  if (yaPendiente) {
    return { ok: false, error: 'Ya existe una solicitud pendiente para esta persona (mismo correo o teléfono).' };
  }

  if (typeof existePersonaConCorreoOTelefono === 'function' && existePersonaConCorreoOTelefono(correo, telefono)) {
    return { ok: false, error: 'Ya existe una cuenta registrada con ese correo o teléfono.' };
  }

  const datosSolicitud = {
    solicitanteId,
    solicitanteNombre,
    solicitanteRol,

    nombreCompleto,
    telefono,
    correo,
    ineUrl,

    estado: 'pendiente',

    revisadoPor: null,
    fechaRevision: null,

    motivoRechazo: null,

    emprendedoraCreadaId: null,
    credenciales: null
  };

  let solicitud;

  if (dbFirestore) {
    const docRef = await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE).add({
      ...datosSolicitud,
      fechaSolicitud: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Marca de tiempo optimista solo para pintar de inmediato en pantalla
    // — la autoritativa es el serverTimestamp() que ya quedó guardado.
    solicitud = { ...datosSolicitud, id: docRef.id, fechaSolicitud: new Date().toISOString() };
  } else {
    solicitud = { ...datosSolicitud, id: `SOL-${Date.now()}`, fechaSolicitud: new Date().toISOString() };
    const solicitudes = obtenerSolicitudesLocal();
    solicitudes.unshift(solicitud);
    guardarSolicitudesLocal(solicitudes);
  }

  if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('solicitud_creada'))) {
    agregarNotificacion({
      texto: `${solicitanteNombre} hizo una solicitud de inscripción para ${nombreCompleto}. Revísala.`,
      link: `admin-solicitudes.html?solicitud=${solicitud.id}`,
      paraId: 'admin01',
      rolDestino: 'admin',
      origen: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud };

}

// ============================================================
// GENERACIÓN DE CUENTA (usuario + contraseña temporal)
// ============================================================

// Iniciales de cada palabra del nombre completo, en mayúsculas.
// "María Concepción Sánchez Cruz" → "MCSC"
function generarIniciales(nombreCompleto) {
  return String(nombreCompleto || '')
    .trim()
    .split(/\s+/)
    .map(palabra => palabra.charAt(0).toUpperCase())
    .join('');
}

// Usuario = "MW" + número de cuenta secuencial (4 dígitos, como los que
// ya existen: MW0001, MW0005...). Nunca repite uno ya usado, ni entre
// cuentas existentes ni entre solicitudes ya aprobadas.
async function generarNumeroCuentaDisponible() {

  const personas = (typeof obtenerPersonas === 'function') ? obtenerPersonas() : [];
  const solicitudes = await obtenerSolicitudes();
  const usuariosExistentes = new Set(
    personas.map(p => p.usuario).concat(
      solicitudes
        .filter(s => s.credenciales?.usuario)
        .map(s => s.credenciales.usuario)
    )
  );

  const numeros = Array.from(usuariosExistentes)
    .map(u => parseInt(String(u).replace(/^MW/i, ''), 10))
    .filter(n => !Number.isNaN(n));

  let siguiente = (numeros.length ? Math.max(...numeros) : 0) + 1;
  let numeroCuenta = String(siguiente).padStart(4, '0');

  while (usuariosExistentes.has(`MW${numeroCuenta}`)) {
    siguiente += 1;
    numeroCuenta = String(siguiente).padStart(4, '0');
  }

  return numeroCuenta;

}

// Contraseña temporal = usuario + iniciales de la nueva Emprendedora.
// Ejemplo: usuario MW0023, nombre "María Concepción Sánchez Cruz" →
// contraseña temporal MW0023MCSC.
async function generarCredenciales(nombreCompleto) {
  const numeroCuenta = await generarNumeroCuentaDisponible();
  const usuario = `MW${numeroCuenta}`;
  const iniciales = generarIniciales(nombreCompleto);
  const passwordTemporal = `${usuario}${iniciales}`;
  return { numeroCuenta, usuario, passwordTemporal };
}

// ============================================================
// APROBAR / RECHAZAR (Administración)
// ============================================================

async function aprobarSolicitud(solicitudId, { adminId, adminNombre }) {

  const solicitud = await obtenerSolicitudPorId(solicitudId);

  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') {
    return { ok: false, error: 'Esta solicitud ya fue resuelta y no puede aprobarse de nuevo.' };
  }

  // Antes de crear la cuenta, se vuelve a verificar que no exista ya
  // una con el mismo correo o teléfono (pudo registrarse después de
  // enviada la solicitud).
  if (typeof existePersonaConCorreoOTelefono === 'function' && existePersonaConCorreoOTelefono(solicitud.correo, solicitud.telefono)) {
    return { ok: false, error: 'Ya existe una cuenta con ese correo o teléfono. No se puede aprobar esta solicitud.' };
  }

  const credenciales = await generarCredenciales(solicitud.nombreCompleto);

  const partesNombre = solicitud.nombreCompleto.trim().split(/\s+/);
  const nombre = partesNombre[0] || solicitud.nombreCompleto;
  const apellidos = partesNombre.slice(1).join(' ');

  // personas-ejemplo.js todavía no está migrado a Firestore (ver
  // comentario de cabecera): la nueva Emprendedora se crea aquí en
  // localStorage sin importar dónde vive la solicitud.
  const nuevaPersona = crearPersonaEjemplo({
    id: `persona-${Date.now()}`,
    nombre,
    apellidos,
    tipo: 'emprendedora', // SIEMPRE Emprendedora, aunque el solicitante sea Líder
    categoria: 'normal',
    estado: 'activa',
    telefono: solicitud.telefono,
    correo: solicitud.correo,
    usuario: credenciales.usuario,
    password: credenciales.passwordTemporal,
    numeroCuenta: credenciales.numeroCuenta,
    fechaAlta: new Date().toISOString(),
    liderId: solicitud.solicitanteId,   // el solicitante queda como su líder directa
    invitadaPor: solicitud.solicitanteId
  });

  const personas = (typeof obtenerPersonas === 'function') ? obtenerPersonas() : [];
  personas.push(nuevaPersona);
  if (typeof guardarPersonas === 'function') guardarPersonas(personas);

  const cambios = {
    estado: 'aprobada',
    revisadoPor: adminId,
    fechaRevision: new Date().toISOString(),
    emprendedoraCreadaId: nuevaPersona.id,
    credenciales
  };

  if (dbFirestore) {
    await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE).doc(solicitudId).update(cambios);
  } else {
    const solicitudes = obtenerSolicitudesLocal();
    const solicitudLocal = solicitudes.find(s => s.id === solicitudId);
    if (solicitudLocal) Object.assign(solicitudLocal, cambios);
    guardarSolicitudesLocal(solicitudes);
  }

  Object.assign(solicitud, cambios);

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      rol: 'admin',
      modulo: 'solicitudes',
      accion: 'aprobacion',
      descripcion: `Solicitud de "${solicitud.nombreCompleto}" aprobada — cuenta ${credenciales.usuario} creada, líder directa: ${solicitud.solicitanteNombre}`
    });
  }

  if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('solicitud_aprobada'))) {
    agregarNotificacion({
      texto: `Solicitud aprobada: la solicitud para inscribir a ${solicitud.nombreCompleto} fue aprobada. La nueva Emprendedora ya tiene una cuenta y ha sido agregada a tu equipo.`,
      link: 'cuenta',
      paraId: solicitud.solicitanteId,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud, persona: nuevaPersona, credenciales };

}

async function rechazarSolicitud(solicitudId, { adminId, adminNombre, motivo }) {

  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, error: 'Escribe el motivo del rechazo.' };

  const solicitud = await obtenerSolicitudPorId(solicitudId);

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
    await dbFirestore.collection(SOLICITUDES_COLECCION_FIRESTORE).doc(solicitudId).update(cambios);
  } else {
    const solicitudes = obtenerSolicitudesLocal();
    const solicitudLocal = solicitudes.find(s => s.id === solicitudId);
    if (solicitudLocal) Object.assign(solicitudLocal, cambios);
    guardarSolicitudesLocal(solicitudes);
  }

  Object.assign(solicitud, cambios);

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId: adminId,
      usuarioNombre: adminNombre,
      rol: 'admin',
      modulo: 'solicitudes',
      accion: 'rechazo',
      descripcion: `Solicitud de "${solicitud.nombreCompleto}" rechazada. Motivo: ${motivo}`
    });
  }

  if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('solicitud_rechazada'))) {
    agregarNotificacion({
      texto: `Solicitud rechazada: la solicitud para inscribir a ${solicitud.nombreCompleto} fue rechazada. Motivo: ${motivo}`,
      link: 'cuenta',
      paraId: solicitud.solicitanteId,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, solicitud };

}
