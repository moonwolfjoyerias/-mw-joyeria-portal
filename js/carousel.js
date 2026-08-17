// MW JOYERÍA — Carrusel reutilizable
// Uso: <div class="carousel"> con .carousel-slide, .carousel-arrow.prev/.next, .dot dentro
// Se inicializa solo en cualquier página que tenga un .carousel en el HTML.

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.carousel').forEach(initCarousel);
});

function initCarousel(carousel) {
  const slides = carousel.querySelectorAll('.carousel-slide');
  const dots = carousel.querySelectorAll('.dot');
  const prevBtn = carousel.querySelector('.carousel-arrow.prev');
  const nextBtn = carousel.querySelector('.carousel-arrow.next');
  const intervalMs = 4500;
  let current = 0;
  let timer;

  if (slides.length === 0) return;

  function show(index) {
    slides.forEach((s, i) => s.classList.toggle('active', i === index));
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
    current = index;
  }

  function next() { show((current + 1) % slides.length); }
  function prev() { show((current - 1 + slides.length) % slides.length); }

  function startAuto() { timer = setInterval(next, intervalMs); }
  function resetAuto() { clearInterval(timer); startAuto(); }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); resetAuto(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); resetAuto(); });
  dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); resetAuto(); }));

  // Pausa el auto-avance si el mouse está encima (no molesta en touch/mobile)
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', startAuto);

  show(0);
  startAuto();
}
