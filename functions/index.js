// MW JOYERÍA — Funciones de servidor
//
// 1. correoNotificacionEmprendedoraLider — correo de las notificaciones
//    personales de Emprendedora/Líder (abajo).
// 2. cambiarPasswordCuenta — Admin cambia la contraseña real de una
//    cuenta (al final del archivo).
//
// ---------------------------------------------------------------------
// 1. Correo de las notificaciones personales de Emprendedora/Líder
//
// Pedido: "vincular las notificaciones con el correo". Acordado con el
// equipo:
//   - Solo las notificaciones PERSONALES de una e/l (rolDestino
//     'emprendedora_lider' con paraId: apartados por vencer/cancelados,
//     piezas quitadas, pagos, comisiones, solicitudes aprobadas…).
//     Staff/Encargado/Admin siguen solo con la campana.
//   - Nada de correo por cada pieza nueva del catálogo.
//
// Corre en el servidor de Firebase (requiere el plan Blaze), no en el
// navegador: el correo sale aunque quien generó la notificación cierre
// la página al instante, y también para las que crea BRILLO MW. Envía
// con Brevo (https://www.brevo.com, 300 correos/día gratis) — ver
// functions/README.md para activarlo.

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

initializeApp();
const db = getFirestore();

// La API key de Brevo vive en Secret Manager (nunca en el repositorio,
// que es público). Remitente y región se preguntan al desplegar y se
// guardan en functions/.env.moonwolf-portal (tampoco se sube, ver
// .gitignore).
const BREVO_API_KEY = defineSecret('BREVO_API_KEY');
const REMITENTE_CORREO = defineString('REMITENTE_CORREO', { description: 'Correo remitente ya verificado en Brevo (ej. hola@tudominio.com)' });
const REMITENTE_NOMBRE = defineString('REMITENTE_NOMBRE', { default: 'MW Joyería' });
// Debe coincidir con la ubicación de la base de datos de Firestore
// (Firebase Console → Firestore → la ubicación aparece arriba). Si es
// "nam5" se usa us-central1; si es una región sola (ej. us-east1),
// esa misma.
const REGION = defineString('REGION_FUNCIONES', { default: 'us-central1' });

const PORTAL_URL = 'https://moonwolfjoyerias.github.io/-mw-joyeria-portal';

// Mismas claves cortas que usan los avisos (PORTAL_LINKS de cada página
// del portal de e/l).
const PAGINAS_PORTAL = {
  inicio: 'portal',
  catalogo: 'catalogo',
  apartados: 'apartados',
  compras: 'mis-compras',
  deseos: 'lista-deseos',
  calendario: 'calendario',
  cuenta: 'mi-cuenta',
  equipo: 'mi-equipo'
};

function linkPortal(tipo, link) {
  const carpeta = tipo === 'lider' ? 'lider' : 'emprendedora';
  const valor = String(link || '').trim();
  if (/^https?:\/\//.test(valor)) return valor;
  if (PAGINAS_PORTAL[valor]) return `${PORTAL_URL}/portal/${carpeta}/${carpeta}-${PAGINAS_PORTAL[valor]}.html`;
  // "emprendedora-apartados.html" / "../lider/lider-apartados.html" → la
  // misma página, pero en la carpeta de quien recibe.
  const archivo = valor.split('/').pop();
  const pagina = /^(emprendedora|lider)-(.+\.html)$/.exec(archivo || '');
  if (pagina) return `${PORTAL_URL}/portal/${carpeta}/${carpeta}-${pagina[2]}`;
  return `${PORTAL_URL}/portal/${carpeta}/${carpeta}-portal.html`;
}

function escaparHTML(texto) {
  return String(texto || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(correo || '').trim());
}

function cuerpoCorreo({ nombre, texto, url }) {
  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f6f2fa;font-family:Arial,Helvetica,sans-serif;color:#2b2233;">
  <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px;">
    <tr><td>
      <p style="margin:0 0 6px;font-size:13px;letter-spacing:1px;color:#6b2c91;font-weight:bold;">MW JOYERÍA</p>
      <p style="margin:0 0 16px;font-size:16px;">Hola ${escaparHTML(nombre)},</p>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.5;">${escaparHTML(texto)}</p>
      <a href="${escaparHTML(url)}" style="display:inline-block;background:#6b2c91;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:14px;">Abrir mi portal</a>
      <p style="margin:26px 0 0;font-size:12px;color:#8a7f93;">Recibes este correo porque tienes una cuenta en el portal de MW Joyería. También lo verás en la campana de notificaciones de tu portal.</p>
    </td></tr>
  </table>
</body></html>`;
}

exports.correoNotificacionEmprendedoraLider = onDocumentCreated(
  { document: 'notificaciones/{notifId}', region: REGION, secrets: [BREVO_API_KEY], retry: false },
  async (event) => {
    const notif = event.data && event.data.data();
    if (!notif) return;

    // Solo los avisos personales de una e/l, todavía sin leer.
    if ((notif.rolDestino || 'emprendedora_lider') !== 'emprendedora_lider') return;
    if (!notif.paraId || notif.leida) return;

    const notifId = event.params.notifId;

    // Una sola vez por notificación: si otro dispositivo vuelve a crear el
    // mismo documento (sincronización de una lista vieja), create() falla
    // y no se manda de nuevo.
    const registro = db.collection('correosNotificaciones').doc(notifId);
    try {
      await registro.create({ paraId: String(notif.paraId), estado: 'enviando', fecha: FieldValue.serverTimestamp() });
    } catch (error) {
      logger.info('Correo ya procesado antes, se omite', { notifId });
      return;
    }

    const personaSnap = await db.collection('personas').doc(String(notif.paraId)).get();
    const persona = personaSnap.exists ? personaSnap.data() : null;
    if (!persona || persona.estado === 'baja' || persona.estado === 'inactiva' || !correoValido(persona.correo)) {
      await registro.update({ estado: 'sin_correo' });
      return;
    }

    const nombre = [persona.nombre, persona.apellidos].filter(Boolean).join(' ').trim() || 'emprendedora';
    const texto = String(notif.texto || '').trim();
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY.value(), 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: REMITENTE_CORREO.value(), name: REMITENTE_NOMBRE.value() },
        to: [{ email: String(persona.correo).trim(), name: nombre }],
        subject: texto.length > 70 ? `MW Joyería: ${texto.slice(0, 67)}…` : `MW Joyería: ${texto}`,
        htmlContent: cuerpoCorreo({ nombre: persona.nombre || nombre, texto, url: linkPortal(persona.tipo, notif.link) }),
        textContent: `Hola ${persona.nombre || nombre},\n\n${texto}\n\nAbre tu portal: ${linkPortal(persona.tipo, notif.link)}`
      })
    });

    if (!respuesta.ok) {
      const detalle = (await respuesta.text()).slice(0, 300);
      logger.error('Brevo rechazó el correo', { notifId, status: respuesta.status, detalle });
      await registro.update({ estado: 'error', detalle: `${respuesta.status} ${detalle}` });
      return;
    }
    await registro.update({ estado: 'enviado' });
  }
);

// ---------------------------------------------------------------------
// 2. Cambiar la contraseña de una cuenta desde Administración
// ---------------------------------------------------------------------
//
// El navegador no puede cambiar la contraseña de OTRA cuenta de Firebase
// Auth (solo la propia); antes había que correr a mano
// scripts/resetear-password.js con la llave de servicio. Ahora
// Configuración → Usuarios y permisos → "Restablecer contraseña" llama a
// esta función (ver cambiarPasswordFirebaseComoAdmin en
// js/auth-service.js).
//
// Solo la usa una cuenta de Administración activa (se revisa su perfil
// en users/{uid}, no lo que diga el navegador), y solo sobre cuentas del
// portal (las que tienen perfil en users/{uid}).
//
// Región fija us-central1: a diferencia del correo, no depende de dónde
// esté Firestore, y así el portal siempre sabe a qué dirección llamar.
exports.cambiarPasswordCuenta = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión de nuevo.');

  const quien = await db.collection('users').doc(request.auth.uid).get();
  const perfil = quien.exists ? quien.data() : null;
  if (!perfil || perfil.rol !== 'admin' || perfil.activa === false) {
    throw new HttpsError('permission-denied', 'Solo Administración puede cambiar contraseñas.');
  }

  const uid = String((request.data && request.data.uid) || '');
  const password = String((request.data && request.data.password) || '');
  if (!uid) throw new HttpsError('invalid-argument', 'Falta la cuenta.');
  if (password.length < 6) throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');

  const destino = await db.collection('users').doc(uid).get();
  if (!destino.exists) throw new HttpsError('not-found', 'Esa cuenta no existe en el portal.');

  try {
    await getAuth().updateUser(uid, { password });
  } catch (error) {
    if (error && error.code === 'auth/user-not-found') throw new HttpsError('not-found', 'Esa cuenta ya no tiene acceso en Firebase.');
    if (error && error.code === 'auth/invalid-password') throw new HttpsError('invalid-argument', 'La contraseña debe tener al menos 6 caracteres.');
    logger.error('No se pudo cambiar la contraseña', { uid, error: error && error.message });
    throw new HttpsError('internal', 'No se pudo cambiar la contraseña. Inténtalo de nuevo.');
  }

  const datos = destino.data();
  logger.info('Contraseña cambiada por Administración', { uid, usuario: datos.usuario || '', por: perfil.usuario || request.auth.uid });
  return { ok: true };
});
