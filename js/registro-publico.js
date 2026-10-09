// MW JOYERÍA — Botón "Inscribirse" en login.html (FEAT-09)
//
// Flujo de 2 pasos, pedido tras lanzar a producción: antes solo una
// Emprendedora/Líder YA con cuenta podía invitar a alguien (ver
// js/solicitudes-ui.js, usado desde "Mi cuenta"). Esto es lo mismo pero
// para alguien que todavía no tiene NINGUNA cuenta — llena sus propios
// datos y, aparte, dice quién es su líder (texto libre, Admin lo revisa
// y lo asigna de verdad después si corresponde — ver
// crearSolicitudInscripcionPublica en js/solicitudes-modelo.js).
//
// Decisión de negocio: las inscripciones PÚBLICAS (este formulario, sin
// sesión previa) ya no piden identificación oficial (INE) — a
// diferencia de crearSolicitudInscripcion (invitación hecha por una
// cuenta YA existente, en js/solicitudes-ui.js), que sigue
// requiriéndola sin cambios. Como ya no se sube ninguna foto, este
// flujo tampoco necesita Cloud Storage. La contraparte de quitar esa
// verificación de identidad es la señal de riesgo que agrega
// crearSolicitudInscripcionPublica cuando varias solicitudes públicas
// recientes indican a la misma líder — ver su comentario en
// js/solicitudes-modelo.js.
//
// Depende de: solicitudes-modelo.js (crearSolicitudInscripcionPublica)
// y, si hay Firebase real, auth-service.js (iniciarSesionAnonimaSiFalta
// — las reglas de Firestore exigen una sesión, aunque sea anónima, para
// poder escribir).

let registroDatosPaso1 = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inscribirseBtn')?.addEventListener('click', () => abrirModalRegistroPaso1());

  // login.html no carga portal-common.js (es una página pública, no un
  // portal con sesión) — ahí es donde vive normalmente el cierre
  // genérico del modal (overlay/[data-close]), así que aquí se agrega
  // la misma idea mínima, propia de esta página.
  const overlay = document.getElementById('modalOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) {
      overlay.classList.remove('open');
    }
  });
});

// ============================================================
// PASO 1 — datos propios + autorización
// ============================================================

function abrirModalRegistroPaso1() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  registroDatosPaso1 = null;

  box.style.maxWidth = '460px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Inscribirme</h3>
    <p class="modal-sub">Déjanos tus datos para unirte a MW Joyería. Nuestro equipo administrativo los revisará.</p>

    <label for="regNombre">Nombre completo *</label>
    <input id="regNombre" type="text" placeholder="Ej. Ana López Martínez">

    <label for="regTelefono">Número de celular *</label>
    <input id="regTelefono" type="tel" placeholder="444 000 0000">

    <label for="regCorreo">Correo electrónico *</label>
    <input id="regCorreo" type="email" placeholder="correo@ejemplo.com">

    <label style="display:flex;align-items:flex-start;gap:8px;margin-top:14px;cursor:pointer;">
      <input type="checkbox" id="regAutorizo" style="margin-top:3px;flex-shrink:0;">
      <span style="font-size:0.85rem;line-height:1.4;">Autorizo que MOONWOLF JOYERÍA guarde mis datos conforme a los Términos y condiciones.</span>
    </label>

    <div id="regError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" id="continuarRegistroBtn" style="width:100%;margin-top:14px;" type="button">Solicitar inscripción</button>
  `;

  overlay.classList.add('open');

  document.getElementById('continuarRegistroBtn')?.addEventListener('click', () => validarYContinuarPaso1());

}

function validarYContinuarPaso1() {

  const nombreCompleto = document.getElementById('regNombre')?.value.trim() || '';
  const telefono = document.getElementById('regTelefono')?.value.trim() || '';
  const correo = document.getElementById('regCorreo')?.value.trim() || '';
  const autorizo = document.getElementById('regAutorizo')?.checked;

  if (!nombreCompleto) return mostrarErrorRegistro('Escribe tu nombre completo.');
  if (!telefono) return mostrarErrorRegistro('Escribe tu número de celular.');
  if (!correo) return mostrarErrorRegistro('Escribe tu correo electrónico.');
  if (!autorizo) return mostrarErrorRegistro('Debes autorizar el uso de tus datos para continuar.');

  registroDatosPaso1 = { nombreCompleto, telefono, correo };
  abrirModalRegistroPaso2();

}

function mostrarErrorRegistro(mensaje) {
  const error = document.getElementById('regError');
  if (!error) return;
  error.textContent = mensaje;
  error.style.display = 'block';
  error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ============================================================
// PASO 2 — ¿Quién es tu líder?
// ============================================================

function abrirModalRegistroPaso2() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>¿Quién es tu líder?</h3>
    <p class="modal-sub">Tu líder es la persona que te invitó a unirte a MW Joyería.</p>

    <label for="regLiderNombre">Nombre de tu líder</label>
    <input id="regLiderNombre" type="text" placeholder="Ej. María Sánchez">

    <div id="regPaso2Error" class="auth-error" style="display:none;"></div>

    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px;">
      <button class="btn btn-primary" id="terminarRegistroBtn" style="width:100%;" type="button">Terminar mi solicitud</button>
      <button class="btn btn-outline" id="sinLiderBtn" style="width:100%;" type="button">No tengo líder</button>
    </div>
  `;

  overlay.classList.add('open');

  document.getElementById('terminarRegistroBtn')?.addEventListener('click', () => {
    const liderNombre = document.getElementById('regLiderNombre')?.value.trim() || '';
    if (!liderNombre) {
      const error = document.getElementById('regPaso2Error');
      if (error) { error.textContent = 'Escribe el nombre de tu líder, o usa "No tengo líder".'; error.style.display = 'block'; }
      return;
    }
    enviarRegistroPublico(liderNombre);
  });

  document.getElementById('sinLiderBtn')?.addEventListener('click', () => enviarRegistroPublico(null));

}

// ============================================================
// ENVÍO
// ============================================================

// BUG reportado: "el botón se queda sin hacer nada" y la consola del
// navegador no muestra NINGÚN error — ni una promesa rechazada, ni una
// excepción. La explicación más probable es que algo fuera de este
// código (un bloqueador de anuncios/privacidad, una red restrictiva)
// frena en silencio la conexión hacia Firebase Auth/Firestore: ni la
// deja completarse ni la deja fallar, así que el await de abajo se
// queda esperando para siempre y el botón nunca se vuelve a habilitar.
// Sin un límite de tiempo, eso es indistinguible de "no hace nada".
// Con este límite, a los 12 segundos se da por fallida la operación y
// se explica la causa más probable en vez de quedarse pegado.
function conTiempoLimiteRegistro(promesa) {
  return new Promise((resolve, reject) => {
    const limite = setTimeout(() => reject(new Error('TIEMPO_AGOTADO')), 12000);
    promesa.then(
      (valor) => { clearTimeout(limite); resolve(valor); },
      (error) => { clearTimeout(limite); reject(error); }
    );
  });
}

async function enviarRegistroPublico(liderIndicado) {

  const botones = ['terminarRegistroBtn', 'sinLiderBtn'].map(id => document.getElementById(id)).filter(Boolean);
  if (botones.some(b => b.disabled)) return;
  const textosOriginales = botones.map(b => b.textContent);
  botones.forEach(b => { b.disabled = true; b.textContent = 'Enviando...'; });

  const restaurarBotones = () => botones.forEach((b, i) => { b.disabled = false; b.textContent = textosOriginales[i]; });

  try {

    // Las reglas de Firestore exigen una sesión — quien llena este
    // formulario nunca ha iniciado sesión, así que se destraba con una
    // sesión anónima (ver iniciarSesionAnonimaSiFalta en
    // auth-service.js). Si no hay Firebase real conectado (modo demo),
    // esta función no hace nada y se sigue por localStorage/IndexedDB
    // como siempre.
    if (typeof iniciarSesionAnonimaSiFalta === 'function') {
      await conTiempoLimiteRegistro(iniciarSesionAnonimaSiFalta());
    }

    const resultado = await conTiempoLimiteRegistro(crearSolicitudInscripcionPublica({
      ...registroDatosPaso1,
      liderIndicado
    }));

    if (!resultado.ok) {
      const error = document.getElementById('regPaso2Error');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      restaurarBotones();
      return;
    }

    mostrarPantallaConfirmacionRegistro(liderIndicado);

  } catch (error) {
    // BUG reportado: siempre decía "revisa tu conexión", aunque la
    // causa real casi nunca es de red. Sospechosos conocidos, cada uno
    // con su propio texto:
    //  - 'auth/operation-not-allowed': el proveedor "Anonymous" de
    //    Firebase Auth no está activado (Firebase Console →
    //    Authentication → Sign-in method) — necesario para
    //    iniciarSesionAnonimaSiFalta.
    //  - 'TIEMPO_AGOTADO': ver conTiempoLimiteRegistro arriba — algo
    //    frenó la conexión en silencio, sin error visible.
    // console.error deja el detalle completo para la consola del navegador.
    console.error('No se pudo enviar la solicitud de inscripción:', error);
    const errorEl = document.getElementById('regPaso2Error');
    if (errorEl) {
      if (error && error.code === 'auth/operation-not-allowed') {
        errorEl.textContent = 'No se pudo enviar tu solicitud — falta activar el acceso anónimo en Firebase. Avísale a soporte.';
      } else if (error && error.message === 'TIEMPO_AGOTADO') {
        errorEl.textContent = 'Se está tardando demasiado en enviar tu solicitud — puede ser tu conexión o un bloqueador de anuncios/privacidad deteniéndola. Desactívalo o prueba desde otra red e inténtalo de nuevo.';
      } else {
        errorEl.textContent = 'No se pudo enviar tu solicitud. Espera unos segundos e inténtalo de nuevo.';
      }
      errorEl.style.display = 'block';
    }
    restaurarBotones();
  }

}

function mostrarPantallaConfirmacionRegistro(liderIndicado) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>¡Solicitud enviada!</h3>
    <p class="modal-sub">${liderIndicado
      ? 'Nuestro equipo revisará tu solicitud y te avisaremos por WhatsApp o correo.'
      : 'No te preocupes, nuestro equipo se pondrá en contacto contigo y te asignaremos un líder.'}</p>
    <button class="btn btn-primary" style="width:100%;" data-close type="button">Listo</button>
  `;

  overlay.classList.add('open');

}
