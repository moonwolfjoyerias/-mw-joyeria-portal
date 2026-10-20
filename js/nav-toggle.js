// MW JOYERÍA — Menú hamburguesa (sitio público, mobile)
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('navToggle');
  const nav = document.getElementById('publicNav');
  if (!btn || !nav) return;

  const ICONO_MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
  const ICONO_CERRAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // El ícono cambia a "X" mientras el menú está abierto, para que sea
  // obvio cómo cerrarlo en el celular.
  const marcar = (abierto) => {
    nav.classList.toggle('open', abierto);
    btn.setAttribute('aria-expanded', String(abierto));
    btn.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
    btn.innerHTML = abierto ? ICONO_CERRAR : ICONO_MENU;
  };

  btn.setAttribute('aria-expanded', 'false');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    marcar(!nav.classList.contains('open'));
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => marcar(false)));

  // Tocar fuera del menú o presionar Esc también lo cierra.
  document.addEventListener('click', (e) => {
    if (nav.classList.contains('open') && !nav.contains(e.target)) marcar(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) marcar(false);
  });
});
