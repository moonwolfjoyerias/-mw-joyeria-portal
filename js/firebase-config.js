// MW JOYERÍA — Configuración de Firebase (Fase 2 del plan de corrección)
//
// Sustituye estos valores por los de tu proyecto real (Firebase Console →
// Configuración del proyecto → Tus apps → SDK de Firebase → Config) antes
// de poner MODO_DEMO en false. Mientras estén vacíos, el portal ignora
// MODO_DEMO y sigue funcionando 100% con datos de ejemplo — nunca intenta
// conectarse a un proyecto inválido ni deja la app a medias.
//
// Ver AUDITORIA-FIREBASE.md para el detalle completo de por qué la
// migración es obligatoriamente incremental (módulo por módulo) y no un
// simple cambio de bandera.
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};

// Interruptor único de todo el portal (AUDITORIA-FIREBASE.md, secciones
// B.1 y G.1). true = datos de ejemplo en localStorage/IndexedDB, igual
// que hasta ahora. false = intenta usar Firebase Auth + Firestore +
// Storage reales en los módulos que ya estén migrados.
//
// La migración es incremental por módulo: aunque MODO_DEMO sea false,
// solo los módulos ya migrados a Firebase (revisa el comentario de
// cabecera de cada *-modelo.js) leerán/escribirán en Firestore/Storage;
// el resto sigue funcionando en localStorage hasta que se migre, sin que
// esto rompa nada — son fuentes de datos independientes por dominio.
const MODO_DEMO = true;

// Solo se considera "listo" si además de MODO_DEMO=false hay credenciales
// reales cargadas — evita que un despiste (MODO_DEMO=false con config
// vacía) tire la app entera al intentar inicializar Firebase sin project.
function firebaseConfigListo() {
  return !MODO_DEMO && Object.values(FIREBASE_CONFIG).every(v => String(v || '').trim() !== '');
}
