// MW JOYERÍA — Cuentas internas (Staff / RH / Admin)
//
// Antes de este archivo, cada módulo (Apartados, Catálogo, Lista de
// deseos, Mi cuenta/Nómina, Calendario) tenía su PROPIA lista de
// usuario+contraseña de ejemplo, copiada a mano 5 veces con pequeñas
// diferencias entre sí, solo para volver a pedir credenciales antes de
// una acción sensible (ver PERSONAL_EJEMPLO, STAFF_USUARIOS_EJEMPLO x2,
// PERSONAL_STAFF_EJEMPLO, CALENDARIO_USUARIOS_EJEMPLO).
//
// Este archivo es el registro ÚNICO de cuentas internas que Admin
// puede administrar (crear, eliminar, ver/restablecer contraseña)
// desde Configuración → Usuarios y permisos → Cuentas. Las 5 listas
// anteriores NO se tocaron (para no romper nada que ya funcionaba),
// pero los puntos donde se usan ahora TAMBIÉN aceptan cualquier cuenta
// que exista aquí — así una cuenta creada desde Configuración sí sirve
// para iniciar sesión/reautorizar en Apartados, Catálogo, etc.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.
//
// ⚠️ LÍMITE DE SEGURIDAD CONOCIDO: las contraseñas se guardan en texto
// plano porque el admin pidió poder "verlas" para recuperarlas si
// alguien las olvida. Esto es aceptable ÚNICAMENTE porque no existe
// todavía un backend real — en producción, con Firebase Auth, esto se
// reemplaza por un flujo de "restablecer contraseña" (nunca "ver la
// contraseña actual"), y las contraseñas nunca deberían quedar en
// texto plano en ningún almacenamiento persistente real.

const CUENTAS_INTERNAS_STORAGE_KEY = 'mw-cuentas-internas-v1';

const ROLES_CUENTA_INTERNA = { staff: 'Staff', rh: 'RH', admin: 'Admin' };

// Semilla: mismas personas/contraseñas que ya existían en
// PERSONAL_STAFF_EJEMPLO (js/staff-mi-cuenta-ejemplo.js) más las
// identidades fijas de RH y Admin (mismas de CALENDARIO_USUARIOS_EJEMPLO)
// — no se inventan personas nuevas. Se excluye MW0005 porque ya es una
// Líder con su propia cuenta en personas-ejemplo.js; no se duplica aquí.
function construirCuentasInternasEjemplo() {
  return [
    { id: 'staff01', usuario: 'staff01', nombre: 'Ana López', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff02', usuario: 'staff02', nombre: 'Mariana Torres', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff03', usuario: 'staff03', nombre: 'Carlos Reyes', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff04', usuario: 'staff04', nombre: 'Fernanda Ibarra', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff05', usuario: 'staff05', nombre: 'Jorge Salinas', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff06', usuario: 'staff06', nombre: 'Paulina Gómez', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'staff07', usuario: 'staff07', nombre: 'Luis Medina', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'rh01', usuario: 'rh01', nombre: 'Recursos Humanos', rol: 'rh', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' },
    { id: 'admin01', usuario: 'admin01', nombre: 'Claudia', rol: 'admin', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '' }
  ];
}

function obtenerCuentasInternas() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CUENTAS_INTERNAS_STORAGE_KEY));
    if (Array.isArray(guardadas) && guardadas.length) return guardadas;
  } catch (error) {
    // sigue abajo y reconstruye el ejemplo
  }
  const cuentas = construirCuentasInternasEjemplo();
  guardarCuentasInternas(cuentas);
  return cuentas;
}

function guardarCuentasInternas(cuentas) {
  localStorage.setItem(CUENTAS_INTERNAS_STORAGE_KEY, JSON.stringify(cuentas));
}

// Usado por los puntos de reautorización existentes (Apartados,
// Catálogo, Lista de deseos, Mi cuenta/Nómina, Calendario) como
// respaldo ADICIONAL a su propio arreglo fijo de ejemplo — nunca lo
// reemplaza, solo lo complementa.
function verificarCredencialInterna(usuario, password) {
  return obtenerCuentasInternas().find(c => c.usuario === usuario && c.password === password) || null;
}

function crearCuentaInterna({ usuario, nombre, rol, password }) {

  usuario = String(usuario || '').trim();
  nombre = String(nombre || '').trim();

  if (!usuario || !nombre || !password) {
    return { ok: false, error: 'Usuario, nombre y contraseña son obligatorios.' };
  }
  if (!ROLES_CUENTA_INTERNA[rol]) {
    return { ok: false, error: 'El rol no es válido.' };
  }

  const cuentas = obtenerCuentasInternas();
  if (cuentas.some(c => c.usuario.toLowerCase() === usuario.toLowerCase())) {
    return { ok: false, error: 'Ya existe una cuenta interna con ese usuario.' };
  }

  const nueva = {
    id: `int-${Date.now()}`,
    usuario,
    nombre,
    rol,
    password,
    fechaAlta: new Date().toISOString()
  };

  cuentas.push(nueva);
  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'crear_cuenta_interna',
      descripcion: `Cuenta interna creada: ${usuario} (${nombre}) — rol ${ROLES_CUENTA_INTERNA[rol]}`
    });
  }

  return { ok: true, cuenta: nueva };

}

function eliminarCuentaInterna(id) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  guardarCuentasInternas(cuentas.filter(c => c.id !== id));

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'eliminar_cuenta_interna',
      descripcion: `Cuenta interna eliminada: ${cuenta.usuario} (${cuenta.nombre}) — rol ${ROLES_CUENTA_INTERNA[cuenta.rol] || cuenta.rol}`
    });
  }

  return { ok: true, cuenta };

}

// Edición de datos de perfil propios (teléfono, correo, foto) desde
// "Mi cuenta" — nunca toca usuario/password/rol, eso solo se cambia
// desde Configuración → Usuarios y permisos.
function editarCuentaInterna(id, { telefono, correo, fotoUrl } = {}) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  if (telefono !== undefined) cuenta.telefono = telefono;
  if (correo !== undefined) cuenta.correo = correo;
  if (fotoUrl !== undefined) cuenta.fotoUrl = fotoUrl;

  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'editar_perfil_cuenta_interna',
      descripcion: `${cuenta.nombre} (${cuenta.usuario}) actualizó los datos de su cuenta.`
    });
  }

  return { ok: true, cuenta };

}

function restablecerPasswordCuentaInterna(id, nuevoPassword) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };
  if (!nuevoPassword) return { ok: false, error: 'La nueva contraseña no puede estar vacía.' };

  cuenta.password = nuevoPassword;
  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'restablecer_password_interna',
      descripcion: `Contraseña restablecida para la cuenta interna ${cuenta.usuario} (${cuenta.nombre})`
    });
  }

  return { ok: true, cuenta };

}
