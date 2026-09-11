// MW JOYERÍA — Carrusel reutilizable
// Uso: <div class="carousel"> con .carousel-slide, .carousel-arrow.prev/.next, .dot dentro
// Se inicializa solo en cualquier página que tenga un .carousel en el HTML.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel').forEach(initCarousel);
});

function initCarousel(carousel) {
  // Reinicializable: si ya había un temporizador de una llamada anterior
  // (p. ej. carousel.js corrió antes de que fotos-sitio-render.js
  // reemplazara las diapositivas por las fotos reales), se limpia primero
  // para no dejar dos intervalos corriendo sobre el mismo carrusel.
  if (carousel._carouselTimer) clearInterval(carousel._carouselTimer);

  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.dot');
  const prevBtn = carousel.querySelector('.carousel-arrow.prev');
  const nextBtn = carousel.querySelector('.carousel-arrow.next');
  const intervalMs = 4500;
  let current = 0;

  if (slides.length === 0) return;

  function show(index) {
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    current = index;
  }

  function next() { show((current + 1) % slides.length); }
  function prev() { show((current - 1 + slides.length) % slides.length); }

  function startAuto() { carousel._carouselTimer = setInterval(next, intervalMs); }
  function resetAuto() { clearInterval(carousel._carouselTimer); startAuto(); }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); resetAuto(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); resetAuto(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); resetAuto(); }));

  // Pausa el auto-avance si el mouse está encima (no molesta en touch/mobile)
  carousel.addEventListener('mouseenter', () => clearInterval(carousel._carouselTimer));
  carousel.addEventListener('mouseleave', startAuto);

  show(0);
  startAuto();
}
