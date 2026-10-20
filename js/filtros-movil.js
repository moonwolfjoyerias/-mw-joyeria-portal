// MW JOYERÍA — Panel de filtros plegable en celular
//
// En pantallas angostas .filter-panel (catálogo público, de Emprendedora
// y de Líder) se apilaba completo arriba de los productos: ~25 casillas
// que ocupaban casi dos pantallas antes de ver la primera pieza. Aquí el
// título "Filtros" se vuelve un botón que abre/cierra el panel; el
// colapso en sí solo aplica en celular (ver .filter-panel en
// css/styles.css), en escritorio el panel siempre se ve completo.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.filter-panel').forEach((panel) => {
    const titulo = panel.querySelector('.filter-panel-header h3');
    if (!titulo) return;

    titulo.setAttribute('role', 'button');
    titulo.setAttribute('tabindex', '0');
    titulo.setAttribute('aria-expanded', 'false');

    const contador = document.createElement('span');
    contador.className = 'filtros-activos';
    titulo.appendChild(contador);

    const alternar = () => {
      const abierto = panel.classList.toggle('filtros-abiertos');
      titulo.setAttribute('aria-expanded', String(abierto));
    };
    titulo.addEventListener('click', alternar);
    titulo.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alternar(); }
    });

    // Con el panel cerrado, el número junto a "Filtros" avisa que hay
    // filtros aplicados (si no, parecería que faltan productos).
    const actualizarContador = () => {
      const marcados = panel.querySelectorAll('input[type="checkbox"]:checked').length;
      const selects = [...panel.querySelectorAll('select')].filter(s => s.value).length;
      const total = marcados + selects;
      contador.textContent = total ? String(total) : '';
    };
    panel.addEventListener('change', actualizarContador);
    // "Limpiar" desmarca por código (sin evento change).
    panel.addEventListener('click', () => setTimeout(actualizarContador, 0));
    actualizarContador();
  });
});
