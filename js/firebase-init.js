// MW JOYERÍA — Inicialización de Firebase (Fase 2 del plan de corrección)
//
// Se carga DESPUÉS de los <script> del SDK compat de Firebase
// (firebase-app / firebase-firestore / firebase-auth / firebase-storage,
// vía CDN) y DESPUÉS de js/firebase-config.js — siempre antes de
// cualquier *-modelo.js ya migrado, para que dbFirestore/authFirebase/
// storageFirebase ya existan (aunque sea en null) cuando esos módulos
// los consulten.
//
// Si MODO_DEMO es true o falta configuración real, estas tres variables
// se quedan en null y cada módulo migrado usa automáticamente su
// respaldo de localStorage/IndexedDB — no hay que tocar nada más para
// seguir trabajando en modo demo.
// Texto de un documento con las claves ordenadas — sirve para saber si
// un documento cambió respecto a lo último leído/guardado en el servidor
// y así escribir solo lo que de verdad cambió (el plan gratuito de
// Firestore cobra cada documento leído/escrito contra un límite diario).
function textoEstableFirestore(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(textoEstableFirestore).join(',') + ']';
  if (valor && typeof valor === 'object') {
    return '{' + Object.keys(valor).sort()
      .filter(k => valor[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + textoEstableFirestore(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor === undefined ? null : valor);
}

let dbFirestore = null;
let authFirebase = null;
let storageFirebase = null;

if (typeof firebaseConfigListo === 'function' && firebaseConfigListo() && typeof firebase !== 'undefined') {
  firebase.initializeApp(FIREBASE_CONFIG);
  dbFirestore = firebase.firestore();
  // Las páginas públicas no cargan el SDK de Auth (no hay inicio de sesión ahí).
  authFirebase = typeof firebase.auth === 'function' ? firebase.auth() : null;
  try {
    // Storage es opcional: si el proyecto no lo tiene habilitado (requiere
    // plan Blaze), esto no debe tumbar Auth/Firestore en el resto del portal.
    storageFirebase = firebase.storage();
  } catch (error) {
    storageFirebase = null;
  }
}
