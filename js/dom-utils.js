// MW JOYERÍA — Utilidades de DOM compartidas (MEJ-01 de la auditoría)
//
// escapeHTML/escapeAttribute/setText vivían copiadas de forma
// independiente en más de 30 archivos (varias con su propio sufijo,
// como escapeHTMLNomina o setTextDash, solo para no chocar con otra
// copia cargada en la misma página) — ya causó una desincronización
// real: un fix de cerrarModal en Catálogo que nunca se replicó en
// Apartados. Punto único de verdad: cualquier corrección futura a estas
// tres funciones se hace aquí UNA sola vez. Los archivos que ya tenían
// un nombre con sufijo lo conservan (para no tocar cada lugar donde se
// llamaba), pero ahora ese nombre es solo un delegado de una línea hacia
// las de aquí, nunca una copia completa de la lógica.
//
// Se carga ANTES que cualquier controlador que use alguna de las tres
// — ver el <script> de cada página.

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(texto) {
  return escapeHTML(texto);
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}

// ============================================================
// VER FOTO EN GRANDE (lightbox) — pedido tras lanzar a producción:
// poder ampliar la foto de un producto desde el catálogo y desde
// apartados, en cualquier rol. Un solo overlay compartido, creado la
// primera vez que se necesita (no requiere agregar nada al HTML de
// cada página) — así cualquier controlador que ya cargue este archivo
// puede usarlo sin wiring adicional.
function abrirImagenEnGrande(src, alt) {
  if (!src) return;
  let overlay = document.getElementById('lightboxOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'lightboxOverlay';
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button type="button" class="lightbox-close" aria-label="Cerrar">&times;</button>
      <img class="lightbox-img" alt="">
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) cerrarImagenEnGrande();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cerrarImagenEnGrande();
    });
  }
  const img = overlay.querySelector('.lightbox-img');
  img.src = src;
  img.alt = alt || '';
  overlay.classList.add('open');
}

function cerrarImagenEnGrande() {
  document.getElementById('lightboxOverlay')?.classList.remove('open');
}

// Conecta el clic de ampliar en cualquier <img data-zoom="..."> dentro de
// `contenedor` (o todo el documento, si se omite) — se vuelve a llamar
// cada vez que un render pinta HTML nuevo, ya que los listeners no
// sobreviven a un innerHTML.
function wirearZoomFotos(contenedor) {
  (contenedor || document).querySelectorAll('[data-zoom]').forEach((img) => {
    img.classList.add('zoomable-photo');
    img.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirImagenEnGrande(img.getAttribute('data-zoom'), img.getAttribute('data-zoom-alt') || img.alt || '');
    });
  });
}

// ============================================================
// SONIDO DE NOTIFICACIÓN — NOTIF-04 de la auditoría. Antes era un tono
// sintetizado con Web Audio API (no hacía falta subir ningún archivo);
// ahora reproduce notificacion.mp3 (subido por el cliente a la raíz
// del repositorio), el mismo para e/l y s/e/a. Se usa desde
// notificaciones-firestore-sync.js cuando llega, en vivo, una
// notificación nueva sin leer para la cuenta con sesión abierta.
let _audioNotificacion = null;

// notificacion.mp3 vive en la raíz del repositorio, pero este mismo
// archivo (dom-utils.js) se carga tanto desde páginas públicas
// (profundidad 0, ej. index.html) como desde /portal/<rol>/
// (profundidad 2) — mismo criterio de ruta por profundidad que ya usa
// auth-guard.js.
function _rutaAudioNotificacion() {
  return /\/portal\//.test(window.location.pathname) ? '../../notificacion.mp3' : 'notificacion.mp3';
}

function _obtenerAudioNotificacion() {
  if (_audioNotificacion) return _audioNotificacion;
  _audioNotificacion = new Audio(_rutaAudioNotificacion());
  _audioNotificacion.preload = 'auto';
  return _audioNotificacion;
}

// BUG ya corregido antes para el tono sintetizado, mismo motivo aquí:
// los navegadores solo dejan reproducir audio si ya hubo un gesto del
// usuario (clic/tecla/toque) en la página — un play() disparado después,
// desde un callback asíncrono como el de Firestore, nunca lo logra la
// primera vez. Se reproduce en silencio en el primer gesto para
// "destrabarlo" — casi siempre ocurre mucho antes de que llegue la
// primera notificación real — y se restaura el volumen enseguida.
function _destrabarAudioNotificacionConGesto() {
  const audio = _obtenerAudioNotificacion();
  const volumenOriginal = audio.volume;
  audio.volume = 0;
  audio.play().then(() => {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volumenOriginal;
  }).catch(() => {
    audio.volume = volumenOriginal;
  });
  ['pointerdown', 'keydown'].forEach(evento => document.removeEventListener(evento, _destrabarAudioNotificacionConGesto));
}
['pointerdown', 'keydown'].forEach(evento => document.addEventListener(evento, _destrabarAudioNotificacionConGesto));

function reproducirSonidoNotificacion() {
  try {
    const audio = _obtenerAudioNotificacion();
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Todavía no hubo gesto del usuario en esta página — no truena,
      // solo no suena esa vez en particular (mismo caso que ya pasaba
      // con el tono sintetizado).
    });
  } catch (error) {
    // Nunca debe tronar la página por no poder sonar.
  }
}
