// MW JOYERÍA — Filtros del catálogo detrás de un solo botón (Sistema visual MW)
//
// El panel .filter-panel ya no ocupa espacio junto a las piezas: queda
// escondido y el botón "Filtros" de la barra (#abrirFiltrosBtn) lo abre
// (en celular sube desde abajo, en computadora sale de la derecha), con
// "Limpiar" y "Ver N modelos" abajo. El aspecto vive en css/mw-sistema.css (body.mw2).
// Reemplaza a js/filtros-movil.js en las páginas que ya usan body.mw2.
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.querySelector('.filter-panel');
  const abrirBtn = document.getElementById('abrirFiltrosBtn');
  if (!panel || !abrirBtn) return;

  const velo = document.createElement('div');
  velo.className = 'filtros-velo';
  velo.hidden = true;
  document.body.appendChild(velo);

  const cerrarBtn = document.createElement('button');
  cerrarBtn.type = 'button';
  cerrarBtn.className = 'filtros-cerrar';
  cerrarBtn.id = 'cerrarFiltrosBtn';
  cerrarBtn.setAttribute('aria-label', 'Cerrar filtros');
  cerrarBtn.textContent = '×';
  panel.querySelector('.filter-panel-header')?.appendChild(cerrarBtn);

  const pie = document.createElement('div');
  pie.className = 'filtros-pie';
  pie.innerHTML = '<button type="button" class="btn btn-outline" data-filtros-limpiar>Limpiar</button>'
    + '<button type="button" class="btn btn-primary" data-filtros-ver>Ver piezas</button>';
  panel.appendChild(pie);
  const verBtn = pie.querySelector('[data-filtros-ver]');

  const contador = document.getElementById('filtrosActivos');
  const conteo = document.getElementById('resultCount');

  const actualizar = () => {
    const marcados = panel.querySelectorAll('input[type="checkbox"]:checked').length;
    const selects = [...panel.querySelectorAll('select')].filter(s => s.value).length;
    const total = marcados + selects;
    if (contador) contador.textContent = total ? String(total) : '';
    abrirBtn.setAttribute('aria-label', total ? `Filtros (${total} aplicado${total === 1 ? '' : 's'})` : 'Filtros');
    const texto = (conteo?.textContent || '').trim();
    verBtn.textContent = texto ? `Ver ${texto}` : 'Ver piezas';
  };

  let focoPrevio = null;
  const abrir = () => {
    focoPrevio = document.activeElement;
    actualizar();
    panel.classList.add('hoja-abierta');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', 'Filtros');
    velo.hidden = false;
    document.body.classList.add('sin-scroll');
    abrirBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => cerrarBtn.focus(), 60);
  };
  const cerrar = () => {
    if (!panel.classList.contains('hoja-abierta')) return;
    panel.classList.remove('hoja-abierta');
    panel.removeAttribute('role');
    panel.removeAttribute('aria-modal');
    velo.hidden = true;
    document.body.classList.remove('sin-scroll');
    abrirBtn.setAttribute('aria-expanded', 'false');
    if (focoPrevio && focoPrevio.isConnected) focoPrevio.focus();
  };

  abrirBtn.setAttribute('aria-expanded', 'false');
  abrirBtn.addEventListener('click', abrir);
  cerrarBtn.addEventListener('click', cerrar);
  velo.addEventListener('click', cerrar);
  verBtn.addEventListener('click', cerrar);
  pie.querySelector('[data-filtros-limpiar]').addEventListener('click', () => {
    document.getElementById('clearFiltersBtn')?.click();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  panel.addEventListener('change', actualizar);
  // "Limpiar" desmarca por código (sin evento change).
  panel.addEventListener('click', () => setTimeout(actualizar, 0));
  if (conteo) new MutationObserver(actualizar).observe(conteo, { childList: true, characterData: true, subtree: true });
  actualizar();
});
