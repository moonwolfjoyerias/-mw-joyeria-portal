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
// ⚠️ TEMPORAL: localStorage simula la colección "solicitudesInscripcion"
// de Firestore. La forma de cada documento es exactamente la que se
// necesitaría en Firestore, para que migrar sea un cambio de capa de
// almacenamiento, no de lógica.

const SOLICITUDES_STORAGE_KEY = 'mw-solicitudes-inscripcion-v1';

const ESTADOS_SOLICITUD = {
  pendiente: 'Pendiente',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada'
};

// ============================================================
// ALMACENAMIENTO
// ============================================================

function obtenerSolicitudes() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(SOLICITUDES_STORAGE_KEY));
    if (Array.isArray(guardadas)) return guardadas;
  } catch (error) {
    // sigue abajo
  }
  return [];
}

function guardarSolicitudes(lista) {
  localStorage.setItem(SOLICITUDES_STORAGE_KEY, JSON.stringify(lista));
}

function obtenerSolicitudPorId(id) {
  return obtenerSolicitudes().find(s => s.id === id) || null;
}

// Vista del solicitante: solo sus propias solicitudes (sección 5 y 15
// del documento de requisitos — nunca las de otra persona).
function obtenerSolicitudesDe(solicitanteId) {
  return obtenerSolicitudes()
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

function crearSolicitudInscripcion({ solicitanteId, solicitanteNombre, solicitanteRol, nombreCompleto, telefono, correo, ineUrl }) {

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

  const yaPendiente = obtenerSolicitudes().some(s =>
    s.estado === 'pendiente' &&
    (s.correo.toLowerCase() === correoNorm || s.telefono.replace(/\D/g, '') === telefonoNorm)
  );
  if (yaPendiente) {
    return { ok: false, error: 'Ya existe una solicitud pendiente para esta persona (mismo correo o teléfono).' };
  }

  if (typeof existePersonaConCorreoOTelefono === 'function' && existePersonaConCorreoOTelefono(correo, telefono)) {
    return { ok: false, error: 'Ya existe una cuenta registrada con ese correo o teléfono.' };
  }

  const solicitud = {
    id: `SOL-${Date.now()}`,

    solicitanteId,
    solicitanteNombre,
    solicitanteRol,

    nombreCompleto,
    telefono,
    correo,
    ineUrl,

    estado: 'pendiente',

    fechaSolicitud: new Date().toISOString(),

    revisadoPor: null,
    fechaRevision: null,

    motivoRechazo: null,

    emprendedoraCreadaId: null,
    credenciales: null
  };

  const solicitudes = obtenerSolicitudes();
  solicitudes.unshift(solicitud);
  guardarSolicitudes(solicitudes);

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
function generarNumeroCuentaDisponible() {

  const personas = (typeof obtenerPersonas === 'function') ? obtenerPersonas() : [];
  const usuariosExistentes = new Set(
    personas.map(p => p.usuario).concat(
      obtenerSolicitudes()
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
function generarCredenciales(nombreCompleto) {
  const numeroCuenta = generarNumeroCuentaDisponible();
  const usuario = `MW${numeroCuenta}`;
  const iniciales = generarIniciales(nombreCompleto);
  const passwordTemporal = `${usuario}${iniciales}`;
  return { numeroCuenta, usuario, passwordTemporal };
}

// ============================================================
// APROBAR / RECHAZAR (Administración)
// ============================================================

function aprobarSolicitud(solicitudId, { adminId, adminNombre }) {

  const solicitudes = obtenerSolicitudes();
  const solicitud = solicitudes.find(s => s.id === solicitudId);

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

  const credenciales = generarCredenciales(solicitud.nombreCompleto);

  const partesNombre = solicitud.nombreCompleto.trim().split(/\s+/);
  const nombre = partesNombre[0] || solicitud.nombreCompleto;
  const apellidos = partesNombre.slice(1).join(' ');

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
    numeroCuenta: credenciales.numeroCuenta,
    fechaAlta: new Date().toISOString(),
    liderId: solicitud.solicitanteId,   // el solicitante queda como su líder directa
    invitadaPor: solicitud.solicitanteId
  });

  const personas = (typeof obtenerPersonas === 'function') ? obtenerPersonas() : [];
  personas.push(nuevaPersona);
  if (typeof guardarPersonas === 'function') guardarPersonas(personas);

  solicitud.estado = 'aprobada';
  solicitud.revisadoPor = adminId;
  solicitud.fechaRevision = new Date().toISOString();
  solicitud.emprendedoraCreadaId = nuevaPersona.id;
  solicitud.credenciales = credenciales;

  guardarSolicitudes(solicitudes);

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

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Solicitud aprobada: la solicitud para inscribir a ${solicitud.nombreCompleto} fue aprobada. La nueva Emprendedora ya tiene una cuenta y ha sido agregada a tu equipo.`,
      link: 'cuenta',
      paraId: solicitud.solicitanteId
    });
  }

  return { ok: true, solicitud, persona: nuevaPersona, credenciales };

}

function rechazarSolicitud(solicitudId, { adminId, adminNombre, motivo }) {

  motivo = String(motivo || '').trim();
  if (!motivo) return { ok: false, error: 'Escribe el motivo del rechazo.' };

  const solicitudes = obtenerSolicitudes();
  const solicitud = solicitudes.find(s => s.id === solicitudId);

  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') {
    return { ok: false, error: 'Esta solicitud ya fue resuelta y no puede rechazarse.' };
  }

  solicitud.estado = 'rechazada';
  solicitud.revisadoPor = adminId;
  solicitud.fechaRevision = new Date().toISOString();
  solicitud.motivoRechazo = motivo;

  guardarSolicitudes(solicitudes);

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

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Solicitud rechazada: la solicitud para inscribir a ${solicitud.nombreCompleto} fue rechazada. Motivo: ${motivo}`,
      link: 'cuenta',
      paraId: solicitud.solicitanteId
    });
  }

  return { ok: true, solicitud };

}
