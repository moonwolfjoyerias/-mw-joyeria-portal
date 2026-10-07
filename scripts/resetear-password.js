#!/usr/bin/env node
// MW JOYERÍA — Restablecer la contraseña REAL de una cuenta en Firebase Auth
//
// BUG reportado tras lanzar a producción: una vez que una cuenta (de
// Emprendedora/Líder o de Staff/Encargado/Admin) ya tiene acceso real
// en Firebase Auth (campo firebaseUid), el botón "Restablecer
// contraseña" de Configuración → Usuarios y permisos ya NO puede
// cambiar la contraseña de verdad — eso requiere el SDK de
// administración (server-side), que el navegador nunca tiene acceso a
// sin pagar Cloud Functions/Blaze. Antes esto se quedaba en un mensaje
// de error sin salida; ahora ese mismo mensaje apunta aquí.
//
// Este script SÍ puede hacerlo porque corre con tu clave de cuenta de
// servicio (el mismo archivo que ya usas para scripts/seed-firebase.js),
// no desde el navegador — exactamente el mismo patrón que ya usa
// scripts/crear-admin-firebase.js, pero sin tocar su perfil/rol en
// Firestore (aquí solo se cambia la contraseña).
//
// Requisitos: los mismos que seed-firebase.js (ver ese archivo:
// npm install firebase-admin + tu service-account.json).
//
// Uso:
//   node scripts/resetear-password.js ruta/a/tu-service-account.json <usuario> <nueva-contraseña>
//
// Ejemplo:
//   node scripts/resetear-password.js ./service-account.json MW0023 NuevaClave2026
//
// El <usuario> es el mismo que se escribe en login.html (MW0023,
// staff01, admin01, etc.), no un correo — funciona igual para cuentas
// de Emprendedora/Líder y para cuentas internas, ya que ambas usan el
// mismo correo sintético {usuario}@mw-joyeria-demo.app en Firebase Auth
// (ver js/auth-service.js).

const path = require('path');

const [serviceAccountPath, usuario, nuevaPassword] = process.argv.slice(2);

if (!serviceAccountPath || !usuario || !nuevaPassword) {
  console.error('Uso: node scripts/resetear-password.js ruta/a/tu-service-account.json <usuario> <nueva-contraseña>');
  process.exit(1);
}

if (nuevaPassword.length < 6) {
  console.error('La contraseña debe tener al menos 6 caracteres (requisito de Firebase Auth).');
  process.exit(1);
}

let initializeApp, cert, getAuth;
try {
  ({ initializeApp, cert } = require('firebase-admin/app'));
  ({ getAuth } = require('firebase-admin/auth'));
} catch (error) {
  console.error('Falta la dependencia "firebase-admin". Instálala primero:\n  npm install firebase-admin');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(require(path.resolve(serviceAccountPath))),
});
const auth = getAuth(app);

const AUTH_EMAIL_SUFFIX = '@mw-joyeria-demo.app'; // debe coincidir con AUTH_EMAIL_SUFFIX en js/auth-service.js

async function main() {
  const email = `${usuario.toLowerCase()}${AUTH_EMAIL_SUFFIX}`;

  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      console.error(`No existe ninguna cuenta real con el usuario "${usuario}". Revisa que esté escrito igual que en login.html.`);
      process.exit(1);
    }
    throw error;
  }

  await auth.updateUser(user.uid, { password: nuevaPassword });
  console.log(`✓ Contraseña actualizada para "${usuario}". Ya puede entrar a login.html con la nueva contraseña.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nError actualizando la contraseña:', err);
  process.exit(1);
});
