// MW JOYERÍA — Cuentas internas (Staff / Encargado / Admin)
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
//
// FASE 2 (Firebase): si hay Firebase real conectado (dbFirestore +
// authFirebase), crearCuentaInterna/desactivarCuentaInterna/
// activarCuentaInterna/eliminarCuentaInterna TAMBIÉN crean/actualizan
// el acceso real en Firebase Auth + el perfil en Firestore
// (users/{uid}) — ver crearUsuarioFirebaseSinPerderSesion en
// js/auth-service.js. El campo `firebaseUid` en el registro local
// enlaza ambos lados. Si no hay Firebase configurado, todo sigue
// funcionando 100% en localStorage como hasta ahora.
//
// ⚠️ LÍMITE CONOCIDO: restablecerPasswordCuentaInterna NO puede
// cambiar la contraseña real de una cuenta ya creada en Firebase Auth
// — eso requiere el SDK de administración (server-side), que este
// portal no tiene sin pagar Cloud Functions. Para esas cuentas, la
// función devuelve un error explicando que hay que pedirlo aparte
// (por ahora, un script que corre quien tenga la llave de servicio).

const CUENTAS_INTERNAS_STORAGE_KEY = 'mw-cuentas-internas-v1';

const ROLES_CUENTA_INTERNA = { staff: 'Staff', encargado: 'Encargado', admin: 'Admin' };

// Encargado (antes "RH") es de cuenta INDIVIDUAL — cada persona tiene su
// propio usuario/contraseña, a diferencia de Staff (cuenta compartida
// entre varias colaboradoras, con mini-login aparte para identificarse
// en acciones puntuales — ver js/staff-actividad-staff.js). Por eso cada
// cuenta de Encargado tiene su propio objeto `permisos`: qué módulos
// puede usar. Todos los módulos vienen habilitados por default salvo
// Nómina — Admin decide caso por caso quién sí la maneja. Staff/Admin no
// usan este campo (Staff no tiene módulos restringibles por cuenta;
// Admin siempre tiene acceso completo).
const MODULOS_PERMISO_ENCARGADO = {
  nomina: 'Nómina',
  actividadesStaff: 'Actividades del Staff',
  catalogo: 'Catálogo',
  apartados: 'Apartados',
  listaDeseos: 'Lista de deseos',
  calendario: 'Calendario',
  actividad: 'Actividad'
};

function permisosEncargadoPorDefecto(overrides = {}) {
  return {
    nomina: false,
    actividadesStaff: true,
    catalogo: true,
    apartados: true,
    listaDeseos: true,
    calendario: true,
    actividad: true,
    ...overrides
  };
}

// true si esta cuenta puede usar ese módulo. Para roles que no son
// 'encargado' siempre regresa true — el permiso por módulo solo aplica
// a Encargado (Staff/Admin no tienen este campo).
function tienePermisoEncargado(cuenta, modulo) {
  if (!cuenta || cuenta.rol !== 'encargado') return true;
  return !!(cuenta.permisos && cuenta.permisos[modulo]);
}

async function actualizarPermisosCuentaInterna(id, permisos) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };
  if (cuenta.rol !== 'encargado') return { ok: false, error: 'Los permisos por módulo solo aplican a cuentas de Encargado.' };

  cuenta.permisos = permisosEncargadoPorDefecto(permisos);

  try {
    await sincronizarPerfilCuentaInterna(cuenta);
  } catch (error) {
    return { ok: false, error: 'No se pudieron guardar los permisos en el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
  }

  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    const modulosActivos = Object.keys(cuenta.permisos).filter(m => cuenta.permisos[m]).map(m => MODULOS_PERMISO_ENCARGADO[m]).join(', ');
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'actualizar_permisos_encargado',
      descripcion: `Permisos actualizados para ${cuenta.nombre} (${cuenta.usuario}): ${modulosActivos || 'ninguno'}`
    });
  }

  return { ok: true, cuenta };

}

// Semilla: mismas personas/contraseñas que ya existían en
// PERSONAL_STAFF_EJEMPLO (js/staff-mi-cuenta-ejemplo.js) más las
// identidades fijas de Encargado y Admin (mismas de
// CALENDARIO_USUARIOS_EJEMPLO) — no se inventan personas nuevas. Se
// excluye MW0005 porque ya es una Líder con su propia cuenta en
// personas-ejemplo.js; no se duplica aquí.
function construirCuentasInternasEjemplo() {
  return [
    { id: 'staff01', usuario: 'staff01', nombre: 'Ana López', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff02', usuario: 'staff02', nombre: 'Mariana Torres', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff03', usuario: 'staff03', nombre: 'Carlos Reyes', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff04', usuario: 'staff04', nombre: 'Fernanda Ibarra', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff05', usuario: 'staff05', nombre: 'Jorge Salinas', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff06', usuario: 'staff06', nombre: 'Paulina Gómez', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'staff07', usuario: 'staff07', nombre: 'Luis Medina', rol: 'staff', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true },
    { id: 'encargado01', usuario: 'encargado01', nombre: 'Valentina Cruz', rol: 'encargado', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true, permisos: permisosEncargadoPorDefecto({ nomina: true }) },
    { id: 'admin01', usuario: 'admin01', nombre: 'Claudia', rol: 'admin', password: '1234', fechaAlta: '2023-01-01T00:00:00.000Z', telefono: '', correo: '', fotoUrl: '', activa: true }
  ];
}

function obtenerCuentasInternas() {
  return CUENTAS_INTERNAS_CACHE;
}

function guardarCuentasInternas(cuentas) {
  CUENTAS_INTERNAS_CACHE = cuentas;
  try { localStorage.setItem(CUENTAS_INTERNAS_STORAGE_KEY, JSON.stringify(cuentas)); } catch (error) { /* noop */ }
}

// Usado por los puntos de reautorización existentes (Apartados,
// Catálogo, Lista de deseos, Mi cuenta/Nómina, Calendario) como
// respaldo ADICIONAL a su propio arreglo fijo de ejemplo — nunca lo
// reemplaza, solo lo complementa.
// Una cuenta desactivada (ver desactivarCuentaInterna) nunca puede
// iniciar sesión ni reautorizar, aunque conozca la contraseña — así
// se "desactiva su acceso al portal" en una baja de empleado sin
// borrar la cuenta ni su historial.
function verificarCredencialInterna(usuario, password) {
  return obtenerCuentasInternas().find(c => c.usuario === usuario && c.password === password && c.activa !== false) || null;
}

async function crearCuentaInterna({ usuario, nombre, rol, password, empleadoNominaId, permisos }) {

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
    fechaAlta: new Date().toISOString(),
    activa: true,
    empleadoNominaId: empleadoNominaId || null,
    ...(rol === 'encargado' ? { permisos: permisosEncargadoPorDefecto(permisos) } : {})
  };

  if (typeof dbFirestore !== 'undefined' && dbFirestore && typeof crearUsuarioFirebaseSinPerderSesion === 'function') {
    try {
      nueva.firebaseUid = await crearUsuarioFirebaseSinPerderSesion(usuario, password, nombre);
      await sincronizarPerfilCuentaInterna(nueva);
    } catch (error) {
      if (error && error.code === 'auth/email-already-in-use') {
        // Antes de rendirse: puede ser un acceso huérfano de un intento
        // anterior interrumpido a medias por una conexión lenta (se
        // alcanzó a crear el acceso real de Firebase Auth, pero nunca
        // se terminó de guardar su perfil) — ver
        // intentarRecuperarUsuarioFirebaseExistente en auth-service.js.
        const uidRecuperado = typeof intentarRecuperarUsuarioFirebaseExistente === 'function'
          ? await intentarRecuperarUsuarioFirebaseExistente(usuario, password)
          : null;

        if (!uidRecuperado) {
          // El usuario ya se usó ANTES para una cuenta real de Firebase
          // con OTRA contraseña — aunque esa cuenta se haya "eliminado"
          // (eso solo borra su perfil, ver eliminarCuentaInterna), el
          // acceso de Firebase Auth en sí sigue existiendo y no se puede
          // borrar desde aquí (hace falta el SDK de administración,
          // server-side). Ese usuario ya no se puede volver a usar sin
          // borrar antes esa cuenta desde un script — mientras tanto hay
          // que elegir otro usuario.
          return { ok: false, error: `El usuario "${usuario}" ya se usó antes para una cuenta real con otra contraseña y no se puede reutilizar todavía (su acceso anterior no se pudo borrar por completo). Usa un usuario distinto, o pide que se borre ese acceso desde el script de administración.` };
        }

        nueva.firebaseUid = uidRecuperado;
        try {
          await sincronizarPerfilCuentaInterna(nueva);
        } catch (error2) {
          return { ok: false, error: 'Se encontró el acceso anterior pero no se pudo terminar de crear su perfil: ' + (error2 && error2.message ? error2.message : 'error desconocido') };
        }
      } else {
        return { ok: false, error: 'No se pudo crear el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
      }
    }
  }

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

// Baja de empleado (sección 6 del flujo de alta/baja): nunca se borra
// la cuenta, solo se le quita el acceso — conserva su historial.
async function desactivarCuentaInterna(id) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  cuenta.activa = false;

  try {
    await sincronizarPerfilCuentaInterna(cuenta);
  } catch (error) {
    return { ok: false, error: 'No se pudo desactivar el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
  }

  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'desactivar_cuenta_interna',
      descripcion: `Acceso desactivado para la cuenta interna ${cuenta.usuario} (${cuenta.nombre})`
    });
  }

  return { ok: true, cuenta };

}

async function activarCuentaInterna(id) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  cuenta.activa = true;

  try {
    await sincronizarPerfilCuentaInterna(cuenta);
  } catch (error) {
    return { ok: false, error: 'No se pudo reactivar el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
  }

  guardarCuentasInternas(cuentas);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'cuentas',
      accion: 'activar_cuenta_interna',
      descripcion: `Acceso reactivado para la cuenta interna ${cuenta.usuario} (${cuenta.nombre})`
    });
  }

  return { ok: true, cuenta };

}

function obtenerCuentaInternaPorEmpleadoNomina(empleadoNominaId) {
  return obtenerCuentasInternas().find(c => c.empleadoNominaId === empleadoNominaId) || null;
}

// El acceso real en Firebase Auth (el registro en sí) no se puede
// borrar desde el navegador — eso requiere el SDK de administración,
// que este portal no tiene. En su lugar, se borra su perfil en
// Firestore (users/{uid}): sin perfil, iniciarSesionFirebase() ya no
// deja entrar a esa cuenta aunque conozca la contraseña — el efecto
// práctico es el mismo que "eliminar" el acceso.
async function eliminarCuentaInterna(id) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  if (cuenta.firebaseUid && typeof dbFirestore !== 'undefined' && dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(cuenta.firebaseUid).delete();
    } catch (error) {
      return { ok: false, error: 'No se pudo eliminar el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
    }
  }

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
async function editarCuentaInterna(id, { telefono, correo, fotoUrl } = {}) {

  const cuentas = obtenerCuentasInternas();
  const cuenta = cuentas.find(c => c.id === id);
  if (!cuenta) return { ok: false, error: 'La cuenta no existe.' };

  if (telefono !== undefined) cuenta.telefono = telefono;
  if (correo !== undefined) cuenta.correo = correo;
  if (fotoUrl !== undefined) cuenta.fotoUrl = fotoUrl;

  try {
    await sincronizarPerfilCuentaInterna(cuenta);
  } catch (error) {
    return { ok: false, error: 'No se pudieron guardar los datos en el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
  }

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
  if (cuenta.firebaseUid) {
    return { ok: false, error: 'Esta cuenta ya tiene acceso real — su contraseña no se puede cambiar desde aquí. Pide el cambio directamente a quien administra Firebase.' };
  }

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

// Arranca la carga real (Firestore + local combinados, o solo local si
// no hay Firebase conectado) — al final del archivo porque necesita
// construirCuentasInternasEjemplo/permisosEncargadoPorDefecto, definidas
// arriba. Cada página que use la lista de cuentas internas debe esperar
// esto una vez antes de su primer render.
const cuentasInternasRepoListo = cargarCuentasInternasRepo();
