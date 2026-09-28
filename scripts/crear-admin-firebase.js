#!/usr/bin/env node
// MW JOYERÍA — Crear UNA cuenta de Admin real en Firebase Auth + Firestore
//
// A diferencia de scripts/seed-firebase.js (que siembra las 30 cuentas
// de EJEMPLO del repo), este script crea una sola cuenta real, con los
// datos que tú le des — pensado para tener un primer login real con el
// que entrar a la beta, sin mezclar datos de prueba en tu Firebase.
//
// Requisitos: los mismos que seed-firebase.js (ver ese archivo).
//
// Uso:
//   node scripts/crear-admin-firebase.js ruta/a/tu-service-account.json <usuario> <password> "<Nombre completo>" [correo-de-contacto]
//
// Ejemplo:
//   node scripts/crear-admin-firebase.js ./service-account.json carla.admin MiClaveSegura2026 "Carla Ramírez" carla@mwjoyeria.com
//
// El <usuario> es lo que se escribe en el campo "Usuario" de login.html
// (no un correo) — tú eliges cuál usar. El [correo-de-contacto] es
// opcional y solo se guarda como dato de referencia, no se usa para
// iniciar sesión.
//
// Es seguro volver a correrlo con el mismo <usuario>: solo actualiza la
// contraseña/nombre, no duplica la cuenta.

const path = require('path');

const [serviceAccountPath, usuario, password, nombre, correo] = process.argv.slice(2);

if (!serviceAccountPath || !usuario || !password || !nombre) {
  console.error(
    'Uso: node scripts/crear-admin-firebase.js ruta/a/tu-service-account.json <usuario> <password> "<Nombre completo>" [correo-de-contacto]'
  );
  process.exit(1);
}

if (password.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres (requisito de Firebase Auth).');
  process.exit(1);
}

let admin;
try {
  admin = require('firebase-admin');
} catch (error) {
  console.error('Falta la dependencia "firebase-admin". Instálala primero:\n  npm install firebase-admin');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(require(path.resolve(serviceAccountPath))),
});

const AUTH_EMAIL_SUFFIX = '@mw-joyeria-demo.app'; // debe coincidir con AUTH_EMAIL_SUFFIX en js/auth-service.js

async function main() {
  const email = `${usuario.toLowerCase()}${AUTH_EMAIL_SUFFIX}`;

  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
    await admin.auth().updateUser(user.uid, { password, displayName: nombre });
    console.log(`↻ Cuenta actualizada: ${usuario}`);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await admin.auth().createUser({ email, password, displayName: nombre });
    console.log(`✓ Cuenta creada: ${usuario}`);
  }

  await admin.firestore().collection('users').doc(user.uid).set({
    usuario,
    nombre,
    rol: 'admin',
    personaId: null,
    cuentaId: null,
    correo: correo || null,
  }, { merge: true });

  console.log(`\nListo. Entra en login.html con:\n  Usuario:    ${usuario}\n  Contraseña: (la que escribiste)`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nError creando la cuenta:', err);
  process.exit(1);
});
