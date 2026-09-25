// MW JOYERÍA — Sesión de acceso (simula el estado de Firebase Auth)
//
// ⚠️ TEMPORAL: sessionStorage simula lo que en Fase 3 sería el listener
// onAuthStateChanged de Firebase Auth. El resto del portal SOLO lee la
// identidad de la persona con sesión abierta a través de
// obtenerSesionActiva() (nunca de un nombre escrito a mano en el HTML),
// así que migrar a Firebase Auth real consiste en cambiar CÓMO se llena
// la sesión (aquí y en js/auth-login.js), no en tocar cada página del
// portal — ver js/admin-comun.js, js/encargado-comun.js y
// obtenerNombrePersonaActualPortal() en js/portal-common.js.
//
// ⚠️ LÍMITE DE SEGURIDAD CONOCIDO: este archivo es SOLO una puerta de
// interfaz — evita que alguien sin sesión vea las páginas por accidente
// y decide a qué nombre/rol atribuir sus acciones. NO es una barrera de
// seguridad real: no hay ningún servidor detrás que la haga cumplir, así
// que cualquiera con conocimientos técnicos puede saltarla desde la
// consola del navegador. La barrera real llega junto con Firebase Auth +
// Firestore Security Rules (ver auditoría de preparación para Firebase,
// sección E — "Riesgo de permisos").
//
// Se carga como PRIMER script en el <head> de cada página del portal
// (antes de que el <body> se pinte) para poder mandar a login.html de
// inmediato si no hay sesión válida para esa carpeta de portal.

const SESION_ACTIVA_STORAGE_KEY = 'mw-sesion-activa-v1';

function guardarSesionActiva(sesion) {
  try {
    sessionStorage.setItem(SESION_ACTIVA_STORAGE_KEY, JSON.stringify(sesion));
  } catch (error) {
    // La demo sigue funcionando aunque el navegador bloquee sessionStorage.
  }
}

function obtenerSesionActiva() {
  try {
    const sesion = JSON.parse(sessionStorage.getItem(SESION_ACTIVA_STORAGE_KEY));
    if (sesion && sesion.rol && sesion.nombre) return sesion;
  } catch (error) {
    // sigue abajo y regresa null
  }
  return null;
}

function cerrarSesion() {
  try {
    sessionStorage.removeItem(SESION_ACTIVA_STORAGE_KEY);
  } catch (error) {
    // noop
  }
}

// A qué carpeta de portal (admin/encargado/staff/emprendedora/lider) pertenece
// la página actual — así ninguna página necesita declarar "quién puede
// entrar", ya lo dice su propia carpeta.
function obtenerCarpetaPortalActual() {
  const match = window.location.pathname.match(/\/portal\/([a-z]+)\//);
  return match ? match[1] : null;
}

// Si no hay sesión válida para esta carpeta, manda a login.html de
// inmediato — se llama sin esperar a DOMContentLoaded (ver abajo) para
// que la redirección ocurra antes de que la página llegue a pintarse.
function exigirSesionPortal() {
  const carpeta = obtenerCarpetaPortalActual();
  if (!carpeta) return; // No es una página de portal (ej. login.html).

  const sesion = obtenerSesionActiva();
  if (!sesion || sesion.rol !== carpeta) {
    window.location.replace('../../login.html');
  }
}

// Reemplaza el nombre/inicial de perfil escritos a mano en el <header>
// de cada página por los de la sesión real. Todas las páginas de portal
// comparten la misma estructura de clases (.profile-btn .profile-avatar
// / .profile-info strong), así que no hace falta tocar el HTML de cada
// una para esto.
//
// EXCEPCIÓN — Staff: la cuenta de Staff es compartida entre varias
// colaboradoras (todas entran con el mismo usuario/contraseña), así
// que la burbuja de perfil se queda en "Staff" genérico en vez del
// nombre de la cuenta interna. Esto es solo visual: la sesión SÍ sigue
// guardando esa identidad (sesion.nombre/cuentaId) para auditoría,
// nómina y todo lo que ya depende de "quién inició sesión" — nada de
// eso cambia. Cuando alguien se identifica individualmente dentro de
// una página (p. ej. Mis actividades → "¿Quién eres?"), esa identidad
// es aparte y se sigue mostrando donde ya se mostraba (el saludo
// dentro del contenido, nunca la burbuja).
function aplicarIdentidadSesionEnHeader() {
  const sesion = obtenerSesionActiva();
  if (!sesion) return;

  if (sesion.tipo === 'interna' && sesion.rol === 'staff') return;

  const avatar = document.querySelector('.profile-btn .profile-avatar');
  const nombreEl = document.querySelector('.profile-btn .profile-info strong');
  if (avatar) avatar.textContent = sesion.nombre.trim().charAt(0).toUpperCase() || '?';
  if (nombreEl) nombreEl.textContent = sesion.nombre;

  // "Bienvenid@, {nombre}" en el dashboard de cada portal (excepto
  // Staff, por la misma razón de cuenta compartida de arriba) — el
  // primer nombre solamente, para que el saludo no se vea tan largo.
  const bienvenidaEl = document.querySelector('.portal-bienvenida-nombre');
  if (bienvenidaEl) bienvenidaEl.textContent = sesion.nombre.trim().split(' ')[0] || sesion.nombre;
}

// "Cerrar sesión" ya existe como un link normal a login.html en las 44
// páginas del portal — aquí se le añade el limpiar la sesión antes de
// navegar, sin tener que tocar ese link en cada archivo.
function wireCerrarSesionLinks() {
  document.querySelectorAll('a.danger').forEach(enlace => {
    if ((enlace.getAttribute('href') || '').includes('login.html')) {
      enlace.addEventListener('click', () => cerrarSesion());
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  aplicarIdentidadSesionEnHeader();
  wireCerrarSesionLinks();
});

exigirSesionPortal();
