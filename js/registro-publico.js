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
// Depende de: documentos-modelo.js (subir las 2 fotos de INE),
// solicitudes-modelo.js (crearSolicitudInscripcionPublica) y, si hay
// Firebase real, auth-service.js (iniciarSesionAnonimaSiFalta — las
// reglas de Firestore/Storage exigen una sesión, aunque sea anónima,
// para poder escribir).

let registroIneFrenteArchivo = null;
let registroIneReversoArchivo = null;
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

  registroIneFrenteArchivo = null;
  registroIneReversoArchivo = null;
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

    <label for="regIneFrente">Foto de identificación oficial (INE) — frente *</label>
    <input id="regIneFrente" type="file" accept="image/*">

    <label for="regIneReverso">Foto de identificación oficial (INE) — reverso *</label>
    <input id="regIneReverso" type="file" accept="image/*">
    <small class="field-help">Información confidencial: solo el personal Administrativo autorizado podrá verla. Sube las dos caras para que se pueda validar sin problema.</small>

    <label style="display:flex;align-items:flex-start;gap:8px;margin-top:14px;cursor:pointer;">
      <input type="checkbox" id="regAutorizo" style="margin-top:3px;flex-shrink:0;">
      <span style="font-size:0.85rem;line-height:1.4;">Autorizo que MOONWOLF JOYERÍA guarde mis datos conforme a los Términos y condiciones.</span>
    </label>

    <div id="regError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" id="continuarRegistroBtn" style="width:100%;margin-top:14px;" type="button">Solicitar inscripción</button>
  `;

  overlay.classList.add('open');

  document.getElementById('regIneFrente')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { registroIneFrenteArchivo = null; return; }
    const validacion = validarArchivoDocumento(archivo);
    if (!validacion.ok) {
      mostrarErrorRegistro(validacion.error);
      e.target.value = '';
      registroIneFrenteArchivo = null;
      return;
    }
    registroIneFrenteArchivo = archivo;
  });

  document.getElementById('regIneReverso')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { registroIneReversoArchivo = null; return; }
    const validacion = validarArchivoDocumento(archivo);
    if (!validacion.ok) {
      mostrarErrorRegistro(validacion.error);
      e.target.value = '';
      registroIneReversoArchivo = null;
      return;
    }
    registroIneReversoArchivo = archivo;
  });

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
  if (!registroIneFrenteArchivo) return mostrarErrorRegistro('Adjunta la foto del frente de tu identificación oficial (INE).');
  if (!registroIneReversoArchivo) return mostrarErrorRegistro('Adjunta la foto del reverso de tu identificación oficial (INE).');
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

async function enviarRegistroPublico(liderIndicado) {

  const botones = ['terminarRegistroBtn', 'sinLiderBtn'].map(id => document.getElementById(id)).filter(Boolean);
  if (botones.some(b => b.disabled)) return;
  botones.forEach(b => { b.disabled = true; });

  try {

    // Las reglas de Firestore/Storage exigen una sesión — quien llena
    // este formulario nunca ha iniciado sesión, así que se destraba con
    // una sesión anónima (ver iniciarSesionAnonimaSiFalta en
    // auth-service.js). Si no hay Firebase real conectado (modo demo),
    // esta función no hace nada y se sigue por localStorage/IndexedDB
    // como siempre.
    if (typeof iniciarSesionAnonimaSiFalta === 'function') {
      await iniciarSesionAnonimaSiFalta();
    }

    // BUG grave evitado a tiempo: tanto personas-firestore-sync.js como
    // notificaciones-firestore-sync.js intentaron su primera carga al
    // abrir login.html, SIN sesión todavía — con Firestore real, esa
    // lectura se rechaza (reglas) y ambas cachés se quedan vacías. Si
    // crearSolicitudInscripcionPublica (más abajo) escribiera una
    // notificación nueva con la caché de notificaciones todavía vacía,
    // agregarNotificacion → guardarNotificacionesCompartidas terminaría
    // en la rama de "resync completo" de sincronizarNotificacionesConFirestore
    // (ver notificaciones-firestore-sync.js) creyendo que CUALQUIER
    // notificación real que exista en Firestore "ya no está en la lista
    // nueva" — y la borraría del servidor, de TODOS los roles, no solo
    // de esta cuenta. Se refrescan ambas cachés, ya autenticados, antes
    // de seguir.
    if (typeof cargarPersonasRepo === 'function') await cargarPersonasRepo();
    if (typeof cargarNotificacionesRepo === 'function') await cargarNotificacionesRepo();

    const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ineFrenteStoragePath = `solicitudes-ine/${sufijo}-frente`;
    const ineReversoStoragePath = `solicitudes-ine/${sufijo}-reverso`;
    await guardarBlobDocumento(ineFrenteStoragePath, registroIneFrenteArchivo);
    await guardarBlobDocumento(ineReversoStoragePath, registroIneReversoArchivo);

    const resultado = await crearSolicitudInscripcionPublica({
      ...registroDatosPaso1,
      liderIndicado,
      ineFrenteUrl: ineFrenteStoragePath,
      ineReversoUrl: ineReversoStoragePath
    });

    if (!resultado.ok) {
      await eliminarBlobDocumento(ineFrenteStoragePath);
      await eliminarBlobDocumento(ineReversoStoragePath);
      const error = document.getElementById('regPaso2Error');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      botones.forEach(b => { b.disabled = false; });
      return;
    }

    mostrarPantallaConfirmacionRegistro(liderIndicado);

  } catch (error) {
    const errorEl = document.getElementById('regPaso2Error');
    if (errorEl) { errorEl.textContent = 'No se pudo enviar tu solicitud. Revisa tu conexión e inténtalo de nuevo.'; errorEl.style.display = 'block'; }
    botones.forEach(b => { b.disabled = false; });
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
