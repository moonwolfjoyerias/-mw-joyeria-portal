// MW JOYERÍA — Servicio de Firebase Auth (Fase 2 del plan de corrección)
//
// Reemplaza la comparación de usuario/contraseña en texto plano
// (verificarCredencialInterna / verificarCredencialPersona) por
// Firebase Auth real, SIN cambiar la forma del objeto `sesion` que ya
// usa el resto del portal (ver js/auth-guard.js) — así ninguna otra
// página necesita tocarse.
//
// Firebase Auth solo entiende email+password, pero el login del
// portal siempre ha pedido "usuario" (MW0001, staff01, admin01…), no
// correo. Para no cambiar esa experiencia ni tener que re-emitir
// credenciales a nadie, cada usuario se registra en Firebase Auth con
// un correo sintético `{usuario}@EMAIL_SUFFIX` — invisible para la
// persona, que sigue escribiendo su mismo usuario de siempre.
//
// Este archivo solo actúa cuando `authFirebase` existe (MODO_DEMO
// false + configuración real, ver js/firebase-init.js). Si no, sus
// funciones nunca se llaman — js/auth-login.js y js/auth-guard.js
// siguen usando el camino de siempre sobre localStorage.

const AUTH_EMAIL_SUFFIX = '@mw-joyeria-demo.app';

function usuarioAEmailAuth(usuario) {
  return String(usuario || '').trim().toLowerCase() + AUTH_EMAIL_SUFFIX;
}

// El documento users/{uid} es la ÚNICA fuente de rol e identidad de
// negocio de una cuenta real — ver AUDITORIA-FIREBASE.md sección F.
// personaId/cuentaId enlazan con los registros que YA existen en
// localStorage (personas-ejemplo.js / cuentas-internas-modelo.js,
// todavía no migrados) para que Comisiones, Plan MW, Mi equipo, etc.
// sigan funcionando exactamente igual tras iniciar sesión con Firebase.
async function obtenerPerfilUsuarioFirebase(uid) {
  const doc = await dbFirestore.collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return doc.data();
}

// Construye el mismo objeto `sesion` que ya produce js/auth-login.js,
// a partir de un usuario autenticado de Firebase + su perfil en
// Firestore. Devuelve null si el perfil no existe o su rol no es válido
// — una cuenta de Auth sin perfil en Firestore no debe poder "entrar".
async function construirSesionDesdeUsuarioFirebase(user) {
  const perfil = await obtenerPerfilUsuarioFirebase(user.uid);
  if (!perfil || !perfil.rol || perfil.activa === false) return null;

  const esInterna = perfil.rol === 'staff' || perfil.rol === 'encargado' || perfil.rol === 'admin';

  return {
    tipo: esInterna ? 'interna' : 'persona',
    cuentaId: esInterna ? (perfil.cuentaId || user.uid) : null,
    personaId: esInterna ? null : (perfil.personaId || user.uid),
    usuario: perfil.usuario || '',
    nombre: perfil.nombre || perfil.usuario || '',
    rol: perfil.rol,
    iniciadaEn: new Date().toISOString(),
    uid: user.uid,
  };
}

// Intenta iniciar sesión vía Firebase Auth. Regresa { ok:true, sesion }
// o { ok:false, error } — misma forma que iniciarSesion() en
// js/auth-login.js, para que esa función pueda usar este resultado sin
// cambiar su contrato con el formulario de login.
async function iniciarSesionFirebase(usuario, password) {
  try {
    const credencial = await authFirebase.signInWithEmailAndPassword(usuarioAEmailAuth(usuario), password);
    const perfil = await obtenerPerfilUsuarioFirebase(credencial.user.uid);
    if (perfil && perfil.activa === false) {
      await authFirebase.signOut();
      return { ok: false, error: 'Esta cuenta fue desactivada. Contacta a Administración.' };
    }
    const sesion = await construirSesionDesdeUsuarioFirebase(credencial.user);
    if (!sesion) {
      await authFirebase.signOut();
      return { ok: false, error: 'Tu cuenta no tiene un perfil configurado. Contacta a Administración.' };
    }
    return { ok: true, sesion };
  } catch (error) {
    return { ok: false, error: 'Usuario o contraseña incorrectos.' };
  }
}

// Crea una cuenta NUEVA de Firebase Auth sin cerrar la sesión de quien
// la está creando (Admin). firebase.initializeApp() con un nombre
// aparte abre una instancia de la app totalmente independiente — con
// su propio Auth — así createUserWithEmailAndPassword() no toca ni
// reemplaza la sesión real de authFirebase (la del Admin). Se cierra y
// se destruye la instancia aparte apenas termina.
async function crearUsuarioFirebaseSinPerderSesion(usuario, password, nombre) {
  const nombreAppTemporal = 'crear-cuenta-' + Date.now();
  const appTemporal = firebase.initializeApp(FIREBASE_CONFIG, nombreAppTemporal);
  try {
    const credencial = await appTemporal.auth().createUserWithEmailAndPassword(usuarioAEmailAuth(usuario), password);
    if (nombre) {
      await credencial.user.updateProfile({ displayName: nombre });
    }
    return credencial.user.uid;
  } finally {
    await appTemporal.auth().signOut().catch(() => {});
    await appTemporal.delete().catch(() => {});
  }
}

async function cerrarSesionFirebase() {
  try {
    await authFirebase.signOut();
  } catch (error) {
    // noop — igual se limpia la sesión local en cerrarSesion()
  }
}
