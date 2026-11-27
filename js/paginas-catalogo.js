// MW JOYERÍA — Páginas del catálogo (24 piezas por página).
//
// Cada catálogo filtra y ordena como siempre y luego pide aquí solo la
// página que toca: así se pintan 24 tarjetas en vez de cientos y solo se
// descargan las fotos de esas 24. Al cambiar un filtro, la búsqueda o el
// orden se regresa a la página 1; al sumar/restar una pieza se queda en
// la misma página.
//
//   const pag = crearPaginasCatalogo({ grid, alCambiar: aplicarFiltros });
//   const visibles = pag.cortar(productos, firmaDeLosFiltros);
//   ...pintar visibles en grid...
//   pag.pintar(productos.length);

const PIEZAS_POR_PAGINA_CATALOGO = 24;

// ancla: después de qué elemento van los botones (por omisión el grid; en tablas, la tabla).
function crearPaginasCatalogo({ grid, alCambiar, porPagina = PIEZAS_POR_PAGINA_CATALOGO, ancla = grid }) {
  let pagina = 1;
  let firmaAnterior = null;
  let nav = null;

  function totalPaginas(total) {
    return Math.max(1, Math.ceil(total / porPagina));
  }

  function cortar(lista, firma) {
    if (firma !== undefined && firma !== firmaAnterior) {
      if (firmaAnterior !== null) pagina = 1;
      firmaAnterior = firma;
    }
    pagina = Math.min(pagina, totalPaginas(lista.length));
    return lista.slice((pagina - 1) * porPagina, pagina * porPagina);
  }

  function ir(n) {
    pagina = n;
    alCambiar();
    const arriba = grid.closest('.catalog-grid-wrap, .catalog-table-card') || grid;
    const y = arriba.getBoundingClientRect().top + window.scrollY - 90;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  }

  // Números a mostrar: 1 … 4 5 6 … 12
  function numeros(actual, total) {
    const set = new Set([1, total, actual - 1, actual, actual + 1].filter(n => n >= 1 && n <= total));
    const lista = [...set].sort((a, b) => a - b);
    const salida = [];
    lista.forEach((n, i) => {
      if (i && n - lista[i - 1] > 1) salida.push('…');
      salida.push(n);
    });
    return salida;
  }

  function pintar(total) {
    if (!nav) {
      nav = document.createElement('nav');
      nav.className = 'catalogo-paginas';
      nav.setAttribute('aria-label', 'Páginas del catálogo');
      ancla.insertAdjacentElement('afterend', nav);
      nav.addEventListener('click', (e) => {
        const b = e.target.closest('button[data-pagina]');
        if (b && !b.disabled) ir(Number(b.dataset.pagina));
      });
    }
    const paginas = totalPaginas(total);
    nav.hidden = paginas <= 1;
    if (paginas <= 1) { nav.innerHTML = ''; return; }
    const desde = (pagina - 1) * porPagina + 1;
    const hasta = Math.min(total, pagina * porPagina);
    nav.innerHTML = `
      <p class="catalogo-paginas-rango">${desde}–${hasta} de ${total}</p>
      <div class="catalogo-paginas-botones">
        <button type="button" class="catalogo-pagina-flecha" data-pagina="${pagina - 1}" ${pagina === 1 ? 'disabled' : ''} aria-label="Página anterior">Anterior</button>
        ${numeros(pagina, paginas).map(n => n === '…'
          ? '<span class="catalogo-pagina-hueco" aria-hidden="true">…</span>'
          : `<button type="button" class="catalogo-pagina-num" data-pagina="${n}" ${n === pagina ? 'aria-current="page"' : ''} aria-label="Página ${n}">${n}</button>`).join('')}
        <button type="button" class="catalogo-pagina-flecha" data-pagina="${pagina + 1}" ${pagina === paginas ? 'disabled' : ''} aria-label="Página siguiente">Siguiente</button>
      </div>`;
  }

  return { cortar, pintar, get pagina() { return pagina; } };
}
