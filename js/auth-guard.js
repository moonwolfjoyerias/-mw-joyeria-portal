// MW JOYERÍA — Sesión de acceso
//
// FASE 2 (Firebase): cuando js/firebase-init.js deja `authFirebase` con
// valor (MODO_DEMO=false + config real), este archivo escucha
// onAuthStateChanged y construye la misma `sesion` de siempre (ver
// js/auth-service.js) a partir del usuario real de Firebase Auth + su
// perfil en Firestore (colección "users") — sessionStorage sigue siendo
// el caché de lectura rápida que ya usa el resto del portal a través de
// obtenerSesionActiva() (nunca de un nombre escrito a mano en el HTML),
// así que ninguna otra página necesita tocarse — ver js/admin-comun.js,
// js/encargado-comun.js y obtenerNombrePersonaActualPortal() en
// js/portal-common.js.
//
// Si no hay Firebase configurado (MODO_DEMO=true, el caso de hoy),
// sessionStorage sigue siendo la única fuente de sesión, exactamente
// como antes — cero cambio de comportamiento.
//
// ⚠️ LÍMITE DE SEGURIDAD EN MODO DEMO: mientras MODO_DEMO sea true, este
// archivo es SOLO una puerta de interfaz — evita que alguien sin sesión
// vea las páginas por accidente, pero no hay ningún servidor detrás que
// lo haga cumplir. La barrera real llega con Firebase Auth + Firestore
// Security Rules, activa en cuanto MODO_DEMO es false (ver auditoría de
// preparación para Firebase, sección E — "Riesgo de permisos").
//
// Se carga como PRIMER script en el <head> de cada página del portal
// (antes de que el <body> se pinte) para poder mandar a login.html de
// inmediato si no hay sesión válida para esa carpeta de portal. En modo
// Firebase, el SDK + firebase-config.js + firebase-init.js se cargan
// justo ANTES de este archivo (ver el bloque "Fase 2" al inicio del
// <head>) para que `authFirebase` ya exista cuando este script corre.

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
  if (typeof authFirebase !== 'undefined' && authFirebase) {
    cerrarSesionFirebase(); // async, no se espera — la navegación a login.html ya está en curso
  }
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
//
// SEC-04 de la auditoría: en modo Firebase, exigirSesionPortal() solo
// puede decidir DENTRO del callback asíncrono de onAuthStateChanged —
// mientras tanto, el controlador de datos de la propia página (p. ej.
// admin-nomina.js) dispara en el evento síncrono DOMContentLoaded sin
// esperar esa decisión, así que una cuenta sin permiso podía alcanzar a
// iniciar la carga real de datos de ese rol antes de ser regresada a su
// propio portal. En vez de retocar cada controlador de cada página (30+
// archivos), se oculta el documento completo (ocultarDocumentoMientrasSeDecideSesion,
// llamado síncronamente al final de este archivo, antes que cualquier
// otro script) hasta que exigirSesionPortal() ya haya corrido — así
// ningún controlador de página llega a pintar NADA, suyo o ajeno,
// mientras la guardia todavía no decide.
function exigirSesionPortal() {
  const carpeta = obtenerCarpetaPortalActual();
  if (!carpeta) { mostrarDocumento(); return; } // No es una página de portal (ej. login.html).

  const sesion = obtenerSesionActiva();
  if (!sesion || sesion.rol !== carpeta) {
    window.location.replace('../../login.html');
    return; // La página está navegando fuera — no hace falta mostrarla.
  }
  mostrarDocumento();
}

function ocultarDocumentoMientrasSeDecideSesion() {
  if (obtenerCarpetaPortalActual()) document.documentElement.style.visibility = 'hidden';
}

function mostrarDocumento() {
  document.documentElement.style.visibility = '';
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

// ============================================================
// TEMA (claro/oscuro) — botón "Tema" en la burbuja de perfil
// (ver js/portal-common.js). Se aplica aquí, ANTES de que el <body> se
// pinte, para que la página nunca haga un destello en claro antes de
// cambiar a oscuro. Solo vive en el portal — el sitio público nunca
// carga este archivo, así que nunca hereda un tema oscuro elegido aquí.
// ============================================================

const TEMA_STORAGE_KEY = 'mw-tema-v1';

function obtenerTemaGuardado() {
  try {
    const tema = localStorage.getItem(TEMA_STORAGE_KEY);
    return tema === 'oscuro' ? 'oscuro' : 'claro';
  } catch (error) {
    return 'claro';
  }
}

function aplicarTemaAlDocumento(tema) {
  if (tema === 'oscuro') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

function establecerTema(tema) {
  aplicarTemaAlDocumento(tema);
  try {
    localStorage.setItem(TEMA_STORAGE_KEY, tema);
  } catch (error) {
    // La demo sigue funcionando aunque el navegador bloquee localStorage —
    // el tema simplemente no persiste entre recargas.
  }
}

document.addEventListener('DOMContentLoaded', () => {
  wireCerrarSesionLinks();
  // En modo Firebase, aplicarIdentidadSesionEnHeader() se llama desde el
  // listener de onAuthStateChanged (abajo) en cuanto la sesión esté
  // lista — puede resolver antes o después de DOMContentLoaded según
  // qué tan rápido responda Firebase, así que se intenta aquí también
  // por si ya estaba lista (no hace daño llamarla dos veces).
  aplicarIdentidadSesionEnHeader();
});

// FASE 2 (Firebase): onAuthStateChanged resuelve de forma asíncrona
// incluso para una sesión ya persistida (a diferencia de sessionStorage,
// que es síncrono) — por eso exigirSesionPortal() debe esperar a la
// PRIMERA respuesta de Firebase antes de decidir si redirige a
// login.html, o cerraría la sesión de alguien que sí tiene una válida.
// En modo demo (el caso de hoy) nada de esto corre: exigirSesionPortal()
// se llama de inmediato, igual que siempre.
ocultarDocumentoMientrasSeDecideSesion();

if (typeof authFirebase !== 'undefined' && authFirebase) {
  authFirebase.onAuthStateChanged(async (user) => {
    try {
      if (user) {
        const sesion = await construirSesionDesdeUsuarioFirebase(user);
        if (sesion) {
          guardarSesionActiva(sesion);
        } else {
          cerrarSesion();
        }
      } else {
        cerrarSesion();
      }
    } catch (error) {
      // Si construirSesionDesdeUsuarioFirebase truena, se trata igual
      // que "sin sesión" — exigirSesionPortal() abajo decide y, si toca
      // quedarse, mostrarDocumento() de todos modos revela la página
      // (nunca se queda oculta para siempre por un error inesperado).
      cerrarSesion();
    }
    exigirSesionPortal();
    if (document.readyState !== 'loading') {
      aplicarIdentidadSesionEnHeader();
    }
  });
} else {
  exigirSesionPortal();
}

aplicarTemaAlDocumento(obtenerTemaGuardado());
