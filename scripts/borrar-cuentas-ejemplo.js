#!/usr/bin/env node
// MW JOYERÍA — Borra del proyecto REAL de Firebase las cuentas de
// ejemplo que el portal traía antes (SEC-03 de la auditoría del 1 de
// octubre de 2026).
//
// Qué hace, por cada cuenta de la lista de abajo:
//   1. Busca su cuenta de Firebase Auth por el correo sintético
//      {usuario}@mw-joyeria-demo.app (mismo que usa scripts/seed-firebase.js).
//   2. Si existe, la BORRA de Firebase Auth (ya nadie podrá iniciar
//      sesión con usuario/contraseña de ejemplo, ni siquiera
//      conociendo la contraseña '1234').
//   3. Borra su perfil en Firestore "users/{uid}".
//   4. Borra también su documento "personas/{id}" o "cuentas
//      internas" (users/{uid} ya cubre esto si rol/personaId estaban
//      bien enlazados — se revisa por las dudas).
//
// Es seguro correrlo más de una vez: si una cuenta ya no existe,
// simplemente se omite con un aviso, no truena.
//
// Requisitos (iguales a scripts/seed-firebase.js):
//   1. npm install firebase-admin
//   2. Descarga tu clave de cuenta de servicio: Firebase Console →
//      ⚙️ Configuración del proyecto → Cuentas de servicio → Generar
//      nueva clave privada. Guarda el .json fuera del repo.
//
// Uso:
//   node scripts/borrar-cuentas-ejemplo.js ruta/a/tu-service-account.json

const path = require('path');

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error('Uso: node scripts/borrar-cuentas-ejemplo.js ruta/a/tu-service-account.json');
  process.exit(1);
}

let initializeApp, cert, getAuth, getFirestore;
try {
  ({ initializeApp, cert } = require('firebase-admin/app'));
  ({ getAuth } = require('firebase-admin/auth'));
  ({ getFirestore } = require('firebase-admin/firestore'));
} catch (error) {
  console.error('Falta la dependencia "firebase-admin". Instálala primero:\n  npm install firebase-admin');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(require(path.resolve(serviceAccountPath))),
});
const auth = getAuth(app);
const firestore = getFirestore(app);

const AUTH_EMAIL_SUFFIX = '@mw-joyeria-demo.app'; // debe coincidir con AUTH_EMAIL_SUFFIX en js/auth-service.js

// Mismas ~9 cuentas internas que traía construirCuentasInternasEjemplo()
// en js/cuentas-internas-modelo.js antes de vaciarse (usuario == id de
// su documento "personas"/"users").
const CUENTAS_INTERNAS_EJEMPLO = [
  'staff01', 'staff02', 'staff03', 'staff04', 'staff05', 'staff06', 'staff07', 'encargado01', 'admin01'
];

// Mismas ~21 Emprendedoras/Líderes que traía construirPersonasEjemplo()
// en js/personas-ejemplo.js antes de vaciarse. personaId (el id del
// documento "personas/{id}") es distinto de usuario (el que de verdad
// sirve para iniciar sesión / para el correo sintético) — se listan
// ambos.
const PERSONAS_EJEMPLO = [
  { personaId: 'ana-torres', usuario: 'MW0001' },
  { personaId: 'me-lider', usuario: 'MW0002' },
  { personaId: 'me-emprendedora', usuario: 'MW0003' },
  { personaId: 'maria-camila-sanchez', usuario: 'MW0005' },
  { personaId: 'maria-fernanda', usuario: 'MW0010' },
  { personaId: 'sofia-hernandez', usuario: 'MW0011' },
  { personaId: 'valeria-ramirez', usuario: 'MW0012' },
  { personaId: 'daniela-martinez', usuario: 'MW0013' },
  { personaId: 'paola-gonzalez', usuario: 'MW0014' },
  { personaId: 'andrea-castillo', usuario: 'MW0015' },
  { personaId: 'camila-rojas', usuario: 'MW0016' },
  { personaId: 'karla-torres', usuario: 'MW0017' },
  { personaId: 'regina-flores', usuario: 'MW0018' },
  { personaId: 'itzel-navarro', usuario: 'MW0019' },
  { personaId: 'monica-diaz', usuario: 'MW0020' },
  { personaId: 'brenda-salazar', usuario: 'MW0021' },
  { personaId: 'cynthia-mora', usuario: 'MW0022' },
  { personaId: 'leslie-pineda', usuario: 'MW0023' },
  { personaId: 'gabriela-vega', usuario: 'MW0024' },
  { personaId: 'renata-campos', usuario: 'MW0025' },
  { personaId: 'ximena-duarte', usuario: 'MW0026' }
];

async function borrarCuentaPorUsuario(usuario) {
  const email = `${String(usuario).toLowerCase()}${AUTH_EMAIL_SUFFIX}`;
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
    await firestore.collection('users').doc(user.uid).delete();
    console.log(`✓ Borrada de Firebase Auth + users/{uid}: ${usuario}`);
    return true;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.log(`— ${usuario}: no existe en Firebase Auth (nada que borrar ahí).`);
      return false;
    }
    console.error(`✗ Error borrando ${usuario}:`, error.message);
    return false;
  }
}

async function borrarDocumentoSiExiste(coleccion, id) {
  const ref = firestore.collection(coleccion).doc(id);
  const doc = await ref.get();
  if (doc.exists) {
    await ref.delete();
    console.log(`  · también se borró ${coleccion}/${id}`);
  }
}

async function main() {
  console.log('Borrando cuentas internas de ejemplo (Staff/Encargado/Admin)...\n');
  for (const usuario of CUENTAS_INTERNAS_EJEMPLO) {
    await borrarCuentaPorUsuario(usuario);
    // El documento "users/{uid}" ya se borró arriba; aquí no hay un
    // documento "personas" aparte para cuentas internas.
  }

  console.log('\nBorrando Emprendedoras/Líderes de ejemplo...\n');
  for (const { personaId, usuario } of PERSONAS_EJEMPLO) {
    await borrarCuentaPorUsuario(usuario);
    await borrarDocumentoSiExiste('personas', personaId);
    await borrarDocumentoSiExiste('personasFinanciero', personaId);
  }

  console.log('\nListo.');
  process.exit(0);
}

main().catch(err => {
  console.error('\nError borrando cuentas de ejemplo:', err);
  process.exit(1);
});
