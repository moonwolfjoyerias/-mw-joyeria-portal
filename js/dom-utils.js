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
