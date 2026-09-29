// MW JOYERÍA — Sincronización de Cuentas internas con Firestore (Fase 2)
//
// Mismo patrón que catalogo-firestore-sync.js / apartados-firestore-sync.js:
// una caché en memoria (CUENTAS_INTERNAS_CACHE) que este archivo llena
// de forma ASÍNCRONA una sola vez al cargar la página — cuentas-internas-
// modelo.js expone encima las mismas funciones síncronas de siempre.
//
// A diferencia de Catálogo/Apartados, aquí NO hay una colección propia:
// se reutiliza users/{uid} (la misma que ya usa js/auth-service.js para
// saber el rol de quien inició sesión, y que crearCuentaInterna ya
// escribe ahí). Antes, la tabla "Cuentas" (Configuración → Usuarios y
// permisos) solo leía el arreglo local — una cuenta real creada en OTRO
// dispositivo nunca aparecía ahí, aunque su login sí funcionara (el
// login lee users/{uid} directo, sin pasar por esta caché). Ahora esa
// misma tabla también refleja lo que haya en Firestore.
//
// La CONTRASEÑA nunca se guarda en users/{uid} — solo vive en Firebase
// Auth (cifrada) y, para "poder verla luego", en el localStorage del
// dispositivo donde se creó o se vio por última vez. Por eso una cuenta
// real que llega desde OTRO dispositivo no trae password: la fila se ve
// igual, pero "ver contraseña"/restablecerla solo funciona desde el
// dispositivo original (ver restablecerPasswordCuentaInterna).
//
// Solo Admin puede leer perfiles ajenos en users/{uid} (ver
// firestore.rules) — esta pantalla ya es exclusiva de Admin, así que
// no hace falta ningún caso especial aquí.

let CUENTAS_INTERNAS_CACHE = [];

function cuentasInternasSemillaLocal() {
  return typeof construirCuentasInternasEjemplo === 'function' ? construirCuentasInternasEjemplo() : [];
}

function cuentasInternasDesdeLocalStorage() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(CUENTAS_INTERNAS_STORAGE_KEY));
    if (Array.isArray(guardadas) && guardadas.length) return guardadas;
  } catch (error) {
    // sigue abajo
  }
  return cuentasInternasSemillaLocal();
}

function firestoreUserACuentaInterna(uid, datos) {
  return {
    id: datos.cuentaId || uid,
    firebaseUid: uid,
    usuario: datos.usuario || '',
    nombre: datos.nombre || '',
    rol: datos.rol,
    telefono: datos.telefono || '',
    correo: datos.correo || '',
    fotoUrl: datos.fotoUrl || '',
    empleadoNominaId: datos.empleadoNominaId || null,
    fechaAlta: datos.fechaAlta || null,
    activa: datos.activa !== false,
    ...(datos.rol === 'encargado' ? { permisos: datos.permisos || permisosEncargadoPorDefecto() } : {})
    // Sin password a propósito — ver nota de cabecera.
  };
}

async function cargarCuentasInternasRepo() {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection('users').where('rol', 'in', ['staff', 'encargado', 'admin']).get();
      const remotas = snap.docs.map(d => firestoreUserACuentaInterna(d.id, d.data()));
      // Lo local que YA vino de Firestore (mismo firebaseUid) no se
      // duplica; lo puramente local (nunca tuvo Firebase, ej. datos de
      // ejemplo previos a conectar el proyecto) se conserva tal cual.
      const remotosUids = new Set(remotas.map(r => r.firebaseUid));
      const localesSinDuplicar = cuentasInternasDesdeLocalStorage().filter(c => !c.firebaseUid || !remotosUids.has(c.firebaseUid));
      CUENTAS_INTERNAS_CACHE = [...remotas, ...localesSinDuplicar];
    } catch (error) {
      // Si la consulta falla (ej. reglas, red), no se rompe la pantalla
      // — se sigue con lo que haya en local en vez de dejarla en blanco.
      CUENTAS_INTERNAS_CACHE = cuentasInternasDesdeLocalStorage();
    }
  } else {
    CUENTAS_INTERNAS_CACHE = cuentasInternasDesdeLocalStorage();
  }
  try { localStorage.setItem(CUENTAS_INTERNAS_STORAGE_KEY, JSON.stringify(CUENTAS_INTERNAS_CACHE)); } catch (error) { /* noop */ }
  return CUENTAS_INTERNAS_CACHE;
}

// Empuja a Firestore los campos de perfil (nunca password) de una
// cuenta ya real — usado por crear/editar/permisos/activar/desactivar.
async function sincronizarPerfilCuentaInterna(cuenta) {
  if (!cuenta.firebaseUid || !dbFirestore) return;
  const datos = {
    usuario: cuenta.usuario,
    nombre: cuenta.nombre,
    rol: cuenta.rol,
    personaId: null,
    cuentaId: cuenta.id,
    telefono: cuenta.telefono || '',
    correo: cuenta.correo || '',
    fotoUrl: cuenta.fotoUrl || '',
    empleadoNominaId: cuenta.empleadoNominaId || null,
    activa: cuenta.activa !== false,
  };
  if (cuenta.rol === 'encargado') datos.permisos = cuenta.permisos || permisosEncargadoPorDefecto();
  await dbFirestore.collection('users').doc(cuenta.firebaseUid).set(datos, { merge: true });
}
