// MW JOYERÍA — Solicitar inscripción (vista de Emprendedora / Líder)
//
// Página "Mi cuenta" de ambos portales cargan este mismo archivo, así
// que el botón "+ Nueva solicitud" de la sección y el enlace "Solicitar
// inscripción" del menú desplegable (en cualquier página del portal,
// vía #solicitar-inscripcion) abren EXACTAMENTE el mismo flujo.
//
// Depende de js/solicitudes-modelo.js (lógica) y de que la página haya
// cargado su propio archivo de identidad (cuenta-ejemplo.js o
// lider-cuenta-ejemplo.js) para saber quién es el solicitante.

let ineTemporalDataUrl = '';

document.addEventListener('DOMContentLoaded', () => {

  const identidad = obtenerIdentidadSolicitante();
  if (!identidad) return; // esta página no es Mi cuenta de Emprendedora/Líder

  renderMisSolicitudes(identidad);

  document.getElementById('nuevaSolicitudBtn')?.addEventListener('click', () => abrirModalNuevaSolicitud());

  if (window.location.hash === '#solicitar-inscripcion') {
    abrirModalNuevaSolicitud();
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#solicitar-inscripcion') abrirModalNuevaSolicitud();
  });

});

function obtenerIdentidadSolicitante() {
  if (typeof CUENTA_EJEMPLO !== 'undefined') {
    return { id: CUENTA_EJEMPLO.id, nombre: CUENTA_EJEMPLO.nombre, rol: 'emprendedora' };
  }
  if (typeof PERFIL_LIDER_EJEMPLO !== 'undefined') {
    return { id: PERFIL_LIDER_EJEMPLO.id, nombre: PERFIL_LIDER_EJEMPLO.nombre, rol: 'lider' };
  }
  return null;
}

// ============================================================
// LISTA "MIS SOLICITUDES"
// ============================================================

function renderMisSolicitudes(identidad) {

  const wrap = document.getElementById('misSolicitudesLista');
  if (!wrap) return;

  const solicitudes = obtenerSolicitudesDe(identidad.id);

  if (!solicitudes.length) {
    wrap.innerHTML = `<p class="bp-sub" style="margin:0;">Todavía no has enviado ninguna solicitud.</p>`;
    return;
  }

  wrap.innerHTML = solicitudes.map(s => `
    <div class="solicitud-card">
      <div class="solicitud-card-head">
        <strong>${escapeHTMLSolicitudes(s.nombreCompleto)}</strong>
        <span class="badge estado-badge ${s.estado}">${ESTADOS_SOLICITUD[s.estado] || s.estado}</span>
      </div>
      <small>Solicitada el ${formatearFechaSolicitudes(s.fechaSolicitud)}</small>
      ${s.fechaRevision ? `<small>Resuelta el ${formatearFechaSolicitudes(s.fechaRevision)}</small>` : ''}
      ${s.estado === 'rechazada' && s.motivoRechazo ? `<div class="solicitud-motivo">Motivo: ${escapeHTMLSolicitudes(s.motivoRechazo)}</div>` : ''}
    </div>
  `).join('');

}

// ============================================================
// MODAL: NUEVA SOLICITUD
// ============================================================

function abrirModalNuevaSolicitud() {

  const identidad = obtenerIdentidadSolicitante();
  if (!identidad) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  ineTemporalDataUrl = '';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nueva solicitud de inscripción</h3>
    <p class="modal-sub">Envía los datos de la persona que quieres integrar a tu equipo. Nuestro equipo administrativo la revisará.</p>

    <label for="solNombre">Nombre completo *</label>
    <input id="solNombre" type="text" placeholder="Ej. Ana López Martínez">

    <label for="solTelefono">Número de celular *</label>
    <input id="solTelefono" type="tel" placeholder="444 000 0000">

    <label for="solCorreo">Correo electrónico *</label>
    <input id="solCorreo" type="email" placeholder="correo@ejemplo.com">

    <label for="solIne">Foto de identificación oficial (INE) *</label>
    <input id="solIne" type="file" accept="image/*">
    <small class="field-help">Información confidencial: solo el personal Administrativo autorizado podrá verla.</small>

    <div id="solError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" id="enviarSolicitudBtn" style="width:100%;" type="button">Enviar solicitud</button>
  `;

  overlay.classList.add('open');

  document.getElementById('solIne')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { ineTemporalDataUrl = ''; return; }
    if (!archivo.type.startsWith('image/')) {
      mostrarErrorSolicitud('Selecciona una imagen válida para la INE.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { ineTemporalDataUrl = ev.target.result; };
    reader.readAsDataURL(archivo);
  });

  document.getElementById('enviarSolicitudBtn')?.addEventListener('click', () => enviarNuevaSolicitud(identidad));

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    if (window.location.hash === '#solicitar-inscripcion') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });

}

function enviarNuevaSolicitud(identidad) {

  const nombreCompleto = document.getElementById('solNombre')?.value || '';
  const telefono = document.getElementById('solTelefono')?.value || '';
  const correo = document.getElementById('solCorreo')?.value || '';

  const resultado = crearSolicitudInscripcion({
    solicitanteId: identidad.id,
    solicitanteNombre: identidad.nombre,
    solicitanteRol: identidad.rol,
    nombreCompleto,
    telefono,
    correo,
    ineUrl: ineTemporalDataUrl
  });

  if (!resultado.ok) {
    mostrarErrorSolicitud(resultado.error);
    return;
  }

  document.getElementById('modalOverlay')?.classList.remove('open');
  if (window.location.hash === '#solicitar-inscripcion') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  renderMisSolicitudes(identidad);
  mostrarToast(`Solicitud enviada. Te avisaremos cuando sea revisada.`);

}

function mostrarErrorSolicitud(mensaje) {
  const error = document.getElementById('solError');
  if (!error) return;
  error.textContent = mensaje;
  error.style.display = 'block';
}

// ============================================================
// UTILIDADES
// ============================================================

function formatearFechaSolicitudes(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHTMLSolicitudes(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
