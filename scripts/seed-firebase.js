#!/usr/bin/env node
// MW JOYERÍA — Siembra inicial de Firebase Auth + Firestore (Fase 2)
//
// Ejecuta esto UNA SOLA VEZ contra tu proyecto real de Firebase para
// crear una cuenta de Firebase Auth + su perfil en Firestore
// ("users/{uid}") para cada persona (Emprendedora/Líder) y cuenta
// interna (Staff/Encargado/Admin) que ya existen como datos de ejemplo
// en el portal — así el equipo puede seguir entrando con los mismos
// usuario/contraseña que ya conoce (MW0001, staff01, admin01, etc.),
// pero ahora contra Firebase Auth real en vez de la comparación en el
// navegador. Ver js/auth-service.js para el porqué del correo sintético
// {usuario}@mw-joyeria-demo.app.
//
// Requisitos:
//   1. npm install firebase-admin  (dentro de esta carpeta, scripts/,
//      o en la raíz del proyecto — donde prefieras correrlo)
//   2. Descarga tu clave de cuenta de servicio: Firebase Console →
//      ⚙️ Configuración del proyecto → Cuentas de servicio → Generar
//      nueva clave privada. Guarda el .json fuera del repo (nunca lo
//      subas a git).
//
// Uso:
//   node scripts/seed-firebase.js ruta/a/tu-service-account.json
//
// Es seguro correrlo más de una vez: si el usuario ya existe en
// Firebase Auth, solo actualiza su contraseña/nombre y su perfil en
// Firestore, no lo duplica.
//
// SEC-03 de la auditoría: construirPersonasEjemplo() y
// construirCuentasInternasEjemplo() se vaciaron a propósito (esas
// contraseñas de ejemplo quedaban escritas en JS público, ver
// cuentas-internas-modelo.js) — así que este script hoy no siembra
// nada ("0 cuentas sembradas"). Para borrar las cuentas de ejemplo que
// ya existan en el proyecto real de un uso anterior de este script, usa
// scripts/borrar-cuentas-ejemplo.js en vez de este archivo.

const path = require('path');
const vm = require('vm');
const fs = require('fs');

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error('Uso: node scripts/seed-firebase.js ruta/a/tu-service-account.json');
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

// ============================================================
// Carga las semillas reales del portal (sin duplicarlas a mano) —
// ejecuta los propios js/personas-ejemplo.js y
// js/cuentas-internas-modelo.js en una zona aislada con un
// localStorage falso en memoria, para poder llamar a sus funciones
// constructoras tal cual las usa el navegador.
// ============================================================

function localStorageFalso() {
  const datos = {};
  return {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(datos, k) ? datos[k] : null),
    setItem: (k, v) => { datos[k] = String(v); },
    removeItem: (k) => { delete datos[k]; },
  };
}

function cargarSandboxDeArchivo(rutaRelativa) {
  const rutaAbsoluta = path.resolve(__dirname, '..', rutaRelativa);
  const codigo = fs.readFileSync(rutaAbsoluta, 'utf8');
  const sandbox = { localStorage: localStorageFalso(), console };
  vm.createContext(sandbox);
  vm.runInContext(codigo, sandbox, { filename: rutaAbsoluta });
  return sandbox;
}

const sandboxPersonas = cargarSandboxDeArchivo('js/personas-ejemplo.js');
const personas = sandboxPersonas.construirPersonasEjemplo();
// La contraseña de cada persona se guarda aparte (nunca en el objeto
// persona) — ver PERSONAS_CREDENCIALES_STORAGE_KEY en personas-ejemplo.js.
personas.forEach(p => { p.password = sandboxPersonas.obtenerPasswordPersona(p.id); });

const sandboxCuentas = cargarSandboxDeArchivo('js/cuentas-internas-modelo.js');
const cuentasInternas = sandboxCuentas.construirCuentasInternasEjemplo();

// ============================================================
// Firebase Auth + Firestore
// ============================================================

async function crearOActualizarUsuario({ usuario, password, nombre, rol, personaId, cuentaId }) {
  const email = `${String(usuario).toLowerCase()}${AUTH_EMAIL_SUFFIX}`;
  let user;
  try {
    user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, { password, displayName: nombre });
    console.log(`↻ Actualizada: ${usuario} (${rol})`);
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error;
    user = await auth.createUser({ email, password, displayName: nombre });
    console.log(`✓ Creada:     ${usuario} (${rol})`);
  }

  await firestore.collection('users').doc(user.uid).set({
    usuario,
    nombre,
    rol,
    personaId: personaId || null,
    cuentaId: cuentaId || null,
  }, { merge: true });
}

async function main() {
  let ok = 0, saltadas = 0;

  for (const p of personas) {
    if (!p.usuario || !p.password) { saltadas++; continue; }
    await crearOActualizarUsuario({
      usuario: p.usuario,
      password: p.password,
      nombre: `${p.nombre} ${p.apellidos || ''}`.trim(),
      rol: p.tipo, // 'emprendedora' | 'lider'
      personaId: p.id,
    });
    ok++;
  }

  for (const c of cuentasInternas) {
    if (!c.usuario || !c.password) { saltadas++; continue; }
    await crearOActualizarUsuario({
      usuario: c.usuario,
      password: c.password,
      nombre: c.nombre,
      rol: c.rol, // 'staff' | 'encargado' | 'admin'
      cuentaId: c.id,
    });
    ok++;
  }

  console.log(`\nListo: ${ok} cuentas sembradas en Firebase Auth + Firestore${saltadas ? ` (${saltadas} sin usuario/contraseña, omitidas)` : ''}.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nError sembrando Firebase:', err);
  process.exit(1);
});
