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
let dbFirestore = null;
let authFirebase = null;
let storageFirebase = null;

if (typeof firebaseConfigListo === 'function' && firebaseConfigListo() && typeof firebase !== 'undefined') {
  firebase.initializeApp(FIREBASE_CONFIG);
  dbFirestore = firebase.firestore();
  authFirebase = firebase.auth();
  storageFirebase = firebase.storage();
}
