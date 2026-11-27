// MW JOYERÍA — Catálogo de Staff/Encargado/Admin: dos vistas y páginas de 24.
//
// - "Catálogo": solo lo que ven las emprendedoras/líderes (marcado "mostrar
//   en catálogo") y que está completo (foto, descripción y categoría).
// - "Inventario e incompletos": lo de solo tienda (por ejemplo lo importado
//   de Aronium desde BRILLO) y lo que le falta foto, descripción o categoría.
// Así lo recién subido por el equipo queda arriba en "Catálogo" y la página
// pinta 24 renglones a la vez en vez de miles.
//
//   const vista = MWVistasCatalogo.preparar(grid, filtrados, firmaFiltros, renderCatalogo);
//   vista.todos  → los de la vista elegida (para el contador)
//   vista.pagina → los 24 que toca pintar

(function () {
  const sinFoto = (p) => {
    if (Array.isArray(p.galeria) && p.galeria.some(f => f && f.src)) return false;
    if (p.imagen) return false;
    // Lo que trae fotosIds vacío no tiene fotos (las fotos viven aparte en productosFotos).
    return Array.isArray(p.fotosIds) && !p.fotosIds.length;
  };

  function faltantes(p) {
    const f = [];
    if (sinFoto(p)) f.push('foto');
    if (!String(p.descripcion || '').trim()) f.push('descripción');
    if (!String(p.categoria || '').trim()) f.push('categoría');
    return f;
  }

  const enCatalogo = (p) => p.mostrarEnCatalogo !== false && !faltantes(p).length;

  let vista = 'catalogo';
  let barra = null;
  let paginas = null;

  function instalar(grid, alCambiar) {
    if (barra) return;
    const tabla = grid.closest('table') || grid;
    const envoltura = tabla.closest('.catalog-table-wrap, .catalog-grid-wrap, .table-wrap') || tabla;
    barra = document.createElement('div');
    barra.className = 'catalogo-vistas';
    barra.setAttribute('role', 'tablist');
    barra.innerHTML = `
      <button type="button" role="tab" data-vista="catalogo" aria-selected="true">Catálogo <span data-cuenta="catalogo"></span></button>
      <button type="button" role="tab" data-vista="inventario" aria-selected="false">Inventario e incompletos <span data-cuenta="inventario"></span></button>`;
    envoltura.insertAdjacentElement('beforebegin', barra);
    barra.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-vista]');
      if (!b || b.dataset.vista === vista) return;
      vista = b.dataset.vista;
      barra.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', String(x.dataset.vista === vista)));
      alCambiar();
    });
    if (typeof crearPaginasCatalogo === 'function') paginas = crearPaginasCatalogo({ grid, ancla: envoltura, alCambiar });
  }

  function preparar(grid, filtrados, firma, alCambiar) {
    instalar(grid, alCambiar);
    const catalogo = filtrados.filter(enCatalogo);
    const resto = filtrados.filter(p => !enCatalogo(p));
    barra.querySelector('[data-cuenta="catalogo"]').textContent = `(${catalogo.length})`;
    barra.querySelector('[data-cuenta="inventario"]').textContent = `(${resto.length})`;
    const todos = vista === 'catalogo' ? catalogo : resto;
    const pagina = paginas ? paginas.cortar(todos, `${vista}|${firma}`) : todos;
    if (paginas) paginas.pintar(todos.length);
    return { todos, pagina, vista };
  }

  /** Aviso en el renglón: qué le falta para salir en el catálogo. */
  function chipFaltantes(p) {
    if (vista !== 'inventario') return '';
    const f = faltantes(p);
    return f.length ? `<small class="chip-faltan">Falta: ${f.join(', ')}</small>` : '';
  }

  window.MWVistasCatalogo = { preparar, chipFaltantes, faltantes, enCatalogo };
})();
