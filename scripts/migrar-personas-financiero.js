#!/usr/bin/env node
// MW JOYERÍA — Migra datosBancarios/constancia/rifa que ya existan
// dentro de documentos "personas/{id}" reales hacia la colección
// aparte "personasFinanciero/{id}" (SEC-01 de la auditoría del 1 de
// octubre de 2026).
//
// Por qué hace falta: js/personas-firestore-sync.js ya escribe estos
// tres campos en la colección nueva para cualquier guardado FUTURO,
// pero un documento de "personas/{id}" que ya existía ANTES de ese
// cambio sigue teniendo esos campos embebidos — y la regla de
// "personas/{id}" permite lectura a cualquier autenticado, así que el
// hueco de seguridad original sigue abierto para esos documentos
// viejos hasta correr esto.
//
// Qué hace, por cada documento de "personas":
//   1. Si tiene datosBancarios, constancia o rifa, copia esos campos a
//      personasFinanciero/{mismo id} (merge, no pisa nada que ya
//      exista ahí).
//   2. Borra esos mismos campos del documento original en "personas".
//
// Es seguro correrlo más de una vez: un documento ya migrado no tiene
// esos campos, así que se omite solo.
//
// Requisitos (iguales a scripts/seed-firebase.js):
//   1. npm install firebase-admin
//   2. Descarga tu clave de cuenta de servicio: Firebase Console →
//      ⚙️ Configuración del proyecto → Cuentas de servicio → Generar
//      nueva clave privada. Guarda el .json fuera del repo.
//
// Uso:
//   node scripts/migrar-personas-financiero.js ruta/a/tu-service-account.json

const path = require('path');

const serviceAccountPath = process.argv[2];
if (!serviceAccountPath) {
  console.error('Uso: node scripts/migrar-personas-financiero.js ruta/a/tu-service-account.json');
  process.exit(1);
}

let initializeApp, cert, getFirestore, FieldValue;
try {
  ({ initializeApp, cert } = require('firebase-admin/app'));
  ({ getFirestore, FieldValue } = require('firebase-admin/firestore'));
} catch (error) {
  console.error('Falta la dependencia "firebase-admin". Instálala primero:\n  npm install firebase-admin');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(require(path.resolve(serviceAccountPath))),
});
const firestore = getFirestore(app);

const CAMPOS_FINANCIERO = ['datosBancarios', 'constancia', 'rifa'];

async function main() {
  const snap = await firestore.collection('personas').get();

  let migrados = 0, sinCambios = 0;

  for (const doc of snap.docs) {
    const datos = doc.data();
    const financiero = {};
    let tieneAlgo = false;

    CAMPOS_FINANCIERO.forEach(campo => {
      if (datos[campo] !== undefined) {
        financiero[campo] = datos[campo];
        tieneAlgo = true;
      }
    });

    if (!tieneAlgo) { sinCambios++; continue; }

    await firestore.collection('personasFinanciero').doc(doc.id).set(financiero, { merge: true });

    const borrar = {};
    CAMPOS_FINANCIERO.forEach(campo => { if (datos[campo] !== undefined) borrar[campo] = FieldValue.delete(); });
    await firestore.collection('personas').doc(doc.id).update(borrar);

    console.log(`✓ Migrado: ${doc.id} (${Object.keys(financiero).join(', ')})`);
    migrados++;
  }

  console.log(`\nListo: ${migrados} migrados, ${sinCambios} ya estaban limpios.`);
  process.exit(0);
}

main().catch(err => {
  console.error('\nError migrando personasFinanciero:', err);
  process.exit(1);
});
