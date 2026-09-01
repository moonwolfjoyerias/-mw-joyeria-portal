// MW JOYERÍA — Alternar vista compacta en tablas anchas (Catálogo,
// Apartados, Calendario, Lista de deseos de Staff/RH), para poder
// verlas completas en pantallas pequeñas sin perder columnas.
document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('[data-compactar-tabla]').forEach(btn => {

    const wrap = document.querySelector(btn.dataset.compactarTabla);
    if (!wrap) return;

    btn.addEventListener('click', () => {

      const activo = wrap.classList.toggle('compact');
      btn.classList.toggle('active', activo);
      btn.querySelector('.compact-toggle-label').textContent = activo ? 'Vista normal' : 'Vista compacta';

    });

  });

});
