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

// Guarda los ARCHIVOS reales (no su contenido en base64) — se suben a
// IndexedDB vía js/documentos-modelo.js recién al enviar la solicitud,
// nunca se guarda su contenido dentro del registro de la solicitud.
// Se piden las dos caras de la INE (frente y reverso) porque Admin
// necesita poder leer ambos lados para validar la identificación.
let ineFrenteArchivoTemporal = null;
let ineReversoArchivoTemporal = null;

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
  // Prioriza la sesión real (misma fuente que usa el resto del portal ya
  // migrado, ver obtenerIdPersonaActualPortal() en portal-common.js) —
  // antes usaba siempre CUENTA_EJEMPLO/PERFIL_LIDER_EJEMPLO (el mismo id
  // fijo 'me-emprendedora'/'me-lider' sin importar quién inició sesión),
  // así que las solicitudes de cuentas reales distintas se mezclaban
  // todas bajo esa única identidad de ejemplo.
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.tipo === 'persona' && sesion.personaId && (sesion.rol === 'emprendedora' || sesion.rol === 'lider')) {
    return { id: sesion.personaId, nombre: sesion.nombre, rol: sesion.rol };
  }
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

async function renderMisSolicitudes(identidad) {

  const wrap = document.getElementById('misSolicitudesLista');
  if (!wrap) return;

  const solicitudes = await obtenerSolicitudesDe(identidad.id);

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

  ineFrenteArchivoTemporal = null;
  ineReversoArchivoTemporal = null;

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

    <label for="solIneFrente">Foto de identificación oficial (INE) — frente *</label>
    <input id="solIneFrente" type="file" accept="image/*">

    <label for="solIneReverso">Foto de identificación oficial (INE) — reverso *</label>
    <input id="solIneReverso" type="file" accept="image/*">
    <small class="field-help">Información confidencial: solo el personal Administrativo autorizado podrá verla. Sube las dos caras para que se pueda validar sin problema.</small>

    <div id="solError" class="auth-error" style="display:none;"></div>

    <button class="btn btn-primary" id="enviarSolicitudBtn" style="width:100%;" type="button">Enviar solicitud</button>
  `;

  overlay.classList.add('open');

  document.getElementById('solIneFrente')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { ineFrenteArchivoTemporal = null; return; }
    const validacion = validarArchivoDocumento(archivo);
    if (!validacion.ok) {
      mostrarErrorSolicitud(validacion.error);
      e.target.value = '';
      ineFrenteArchivoTemporal = null;
      return;
    }
    ineFrenteArchivoTemporal = archivo;
  });

  document.getElementById('solIneReverso')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { ineReversoArchivoTemporal = null; return; }
    const validacion = validarArchivoDocumento(archivo);
    if (!validacion.ok) {
      mostrarErrorSolicitud(validacion.error);
      e.target.value = '';
      ineReversoArchivoTemporal = null;
      return;
    }
    ineReversoArchivoTemporal = archivo;
  });

  document.getElementById('enviarSolicitudBtn')?.addEventListener('click', () => enviarNuevaSolicitud(identidad));

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    if (window.location.hash === '#solicitar-inscripcion') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  });

}

async function enviarNuevaSolicitud(identidad) {

  // Evita crear dos solicitudes si se hace doble clic mientras
  // guardarBlobDocumento()/crearSolicitudInscripcion() (ambas async)
  // todavía están en curso.
  const boton = document.getElementById('enviarSolicitudBtn');
  if (boton?.disabled) return;
  if (boton) { boton.disabled = true; boton.textContent = 'Enviando...'; }

  const nombreCompleto = document.getElementById('solNombre')?.value || '';
  const telefono = document.getElementById('solTelefono')?.value || '';
  const correo = document.getElementById('solCorreo')?.value || '';

  if (!ineFrenteArchivoTemporal) {
    mostrarErrorSolicitud('Adjunta la foto del frente de la identificación oficial (INE).');
    if (boton) { boton.disabled = false; boton.textContent = 'Enviar solicitud'; }
    return;
  }
  if (!ineReversoArchivoTemporal) {
    mostrarErrorSolicitud('Adjunta la foto del reverso de la identificación oficial (INE).');
    if (boton) { boton.disabled = false; boton.textContent = 'Enviar solicitud'; }
    return;
  }

  const sufijo = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const ineFrenteStoragePath = `solicitudes-ine/${sufijo}-frente`;
  const ineReversoStoragePath = `solicitudes-ine/${sufijo}-reverso`;
  await guardarBlobDocumento(ineFrenteStoragePath, ineFrenteArchivoTemporal);
  await guardarBlobDocumento(ineReversoStoragePath, ineReversoArchivoTemporal);

  const resultado = await crearSolicitudInscripcion({
    solicitanteId: identidad.id,
    solicitanteNombre: identidad.nombre,
    solicitanteRol: identidad.rol,
    nombreCompleto,
    telefono,
    correo,
    ineFrenteUrl: ineFrenteStoragePath,
    ineReversoUrl: ineReversoStoragePath
  });

  if (!resultado.ok) {
    await eliminarBlobDocumento(ineFrenteStoragePath);
    await eliminarBlobDocumento(ineReversoStoragePath);
    mostrarErrorSolicitud(resultado.error);
    if (boton) { boton.disabled = false; boton.textContent = 'Enviar solicitud'; }
    return;
  }

  document.getElementById('modalOverlay')?.classList.remove('open');
  if (window.location.hash === '#solicitar-inscripcion') {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  await renderMisSolicitudes(identidad);
  mostrarToast(`Solicitud enviada. Te avisaremos cuando sea revisada.`);

}

function mostrarErrorSolicitud(mensaje) {
  const error = document.getElementById('solError');
  if (!error) return;
  error.textContent = mensaje;
  error.style.display = 'block';
  error.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
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
