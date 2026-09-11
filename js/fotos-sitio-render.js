// MW JOYERÍA — Fotografías del sitio: pintado en páginas públicas
//
// Busca en el HTML los espacios marcados con data-foto-sitio (una sola
// fotografía) o data-foto-sitio-galeria (carrusel/galería) y los llena
// con la fotografía configurada en Configuración → Fotografías del sitio
// (js/fotos-sitio-modelo.js) — o con el logo MW si todavía no hay una
// fotografía personalizada para ese espacio. No hace falta tocar HTML
// para cambiar una fotografía: basta con subirla desde Configuración.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-foto-sitio]').forEach(pintarFotoUnicaSitio);
  document.querySelectorAll('[data-foto-sitio-galeria]').forEach(pintarGaleriaSitio);
});

async function pintarFotoUnicaSitio(el) {

  const [seccion, ubicacion] = (el.getAttribute('data-foto-sitio') || '').split(':');
  if (!seccion || !ubicacion) return;

  el.classList.add('foto-sitio-cargando');

  let resultado = null;
  try {
    if (typeof getImagenSitio === 'function') resultado = await getImagenSitio(seccion, ubicacion);
  } catch (error) {
    resultado = null;
  }

  const fallback = typeof LOGO_MW_FALLBACK_FOTOS_SITIO !== 'undefined' ? LOGO_MW_FALLBACK_FOTOS_SITIO : '';
  const src = (resultado && resultado.src) || fallback;
  const personalizada = !!(resultado && resultado.personalizada);
  const espacio = typeof obtenerEspacioFotoSitio === 'function' ? obtenerEspacioFotoSitio(seccion, ubicacion) : null;
  const alt = (espacio && espacio.ubicacionLabel) || '';

  el.classList.remove('foto-sitio-cargando');
  el.classList.toggle('foto-sitio-personalizada', personalizada);
  el.classList.toggle('foto-sitio-predeterminada', !personalizada);
  el.innerHTML = `<img src="${src}" alt="${alt}" loading="lazy">`;

  const img = el.querySelector('img');
  if (img && fallback) {
    img.addEventListener('error', () => {
      if (img.dataset.fotoSitioFallbackAplicado) return;
      img.dataset.fotoSitioFallbackAplicado = '1';
      img.src = fallback;
      el.classList.remove('foto-sitio-personalizada');
      el.classList.add('foto-sitio-predeterminada');
    }, { once: true });
  }

}

async function pintarGaleriaSitio(el) {

  const [seccion, ubicacion] = (el.getAttribute('data-foto-sitio-galeria') || '').split(':');
  if (!seccion || !ubicacion) return;

  const carousel = el.classList.contains('carousel') ? el : el.querySelector('.carousel');
  if (!carousel) return;

  let fotos = [];
  try {
    if (typeof getImagenesSitio === 'function') fotos = await getImagenesSitio(seccion, ubicacion);
  } catch (error) {
    fotos = [];
  }
  if (!fotos.length) return;

  const gradientes = [
    'linear-gradient(155deg, var(--mw-lilac-soft) 0%, var(--mw-cream) 55%, var(--mw-gold-soft) 100%)',
    'linear-gradient(155deg, var(--mw-gold-soft) 0%, var(--mw-cream) 55%, var(--mw-lilac-soft) 100%)',
    'linear-gradient(155deg, var(--mw-cream) 0%, var(--mw-lilac-soft) 55%, var(--mw-gold-soft) 100%)'
  ];

  const flechas = Array.from(carousel.querySelectorAll('.carousel-arrow')).map(a => a.outerHTML).join('');

  const slidesHTML = fotos.map((f, i) => `
    <div class="carousel-slide ${i === 0 ? 'active' : ''} ${f.personalizada ? 'foto-real' : ''}" style="background:${gradientes[i % gradientes.length]};">
      <img src="${f.src}" alt="">
    </div>
  `).join('');

  const controlesHTML = fotos.length > 1
    ? flechas + `<div class="carousel-dots">${fotos.map((_, i) => `<button class="dot ${i === 0 ? 'active' : ''}" aria-label="Ir a imagen ${i + 1}"></button>`).join('')}</div>`
    : '';

  carousel.innerHTML = slidesHTML + controlesHTML;

  if (typeof initCarousel === 'function') initCarousel(carousel);

}
