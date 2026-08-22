// MW JOYERÍA — Menú hamburguesa (sitio público, mobile)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navToggle');
  const nav = document.getElementById('publicNav');
  if (!btn || !nav) return;

  btn.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
});
