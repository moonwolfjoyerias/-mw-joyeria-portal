// MW JOYERÍA — Catálogo de mayoreo (portal privado)
// Filtra CATALOGO_EJEMPLO en el navegador. Cuando exista Firestore (Fase 3),
// solo cambia de dónde viene el array — el resto de este archivo sigue igual.

const MATERIALES = [
  { key: 'oro-laminado', label: 'Oro Laminado' },
  { key: 'acero-inoxidable', label: 'Acero Inoxidable' },
  { key: 'exhibidores', label: 'Exhibidores' },
  { key: 'souvenirs', label: 'Souvenirs' },
];

const filtro = {
  materiales: new Set(),
  categorias: new Set(),
  calidades: new Set(),
  coloresOro: new Set(),
  talla: '',
};

document.addEventListener('DOMContentLoaded', () => {
  renderFiltroMateriales();
  renderFiltroCategorias();
  renderFiltroCalidad();
  renderFiltroColorOro();
  renderFiltroTalla();
  aplicarFiltros();

  const clearBtn = document.getElementById('clearFiltersBtn');
  if (clearBtn) clearBtn.addEventListener('click', limpiarFiltros);
});

function categoriasDisponibles() {
  const incluyeOro = filtro.materiales.size === 0 || filtro.materiales.has('oro-laminado');
  const incluyeAcero = filtro.materiales.size === 0 || filtro.materiales.has('acero-inoxidable');
  const set = new Set();
  if (incluyeOro) CATEGORIAS_ORO.forEach(c => set.add(c));
  if (incluyeAcero) CATEGORIAS_ACERO.forEach(c => set.add(c));
  return Array.from(set).sort();
}

function renderFiltroMateriales() {
  const wrap = document.getElementById('filterMateriales');
  if (!wrap) return;
  wrap.innerHTML = MATERIALES.map(m => `
    <label class="filter-option">
      <input type="checkbox" value="${m.key}" data-filter="material">
      ${m.label}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', onMaterialChange));
}

function onMaterialChange(e) {
  const val = e.target.value;
  if (e.target.checked) filtro.materiales.add(val); else filtro.materiales.delete(val);
  renderFiltroCategorias();
  toggleOroGroups();
  aplicarFiltros();
}

function renderFiltroCategorias() {
  const wrap = document.getElementById('filterCategorias');
  if (!wrap) return;
  const cats = categoriasDisponibles();
  // conserva selección previa que siga siendo válida
  filtro.categorias.forEach(c => { if (!cats.includes(c)) filtro.categorias.delete(c); });
  wrap.innerHTML = cats.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${c}" data-filter="categoria" ${filtro.categorias.has(c) ? 'checked' : ''}>
      ${c}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.categorias.add(e.target.value); else filtro.categorias.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroCalidad() {
  const wrap = document.getElementById('filterCalidad');
  if (!wrap) return;
  wrap.innerHTML = ['estandar', 'premium'].map(q => `
    <label class="filter-option">
      <input type="checkbox" value="${q}" data-filter="calidad">
      ${q === 'estandar' ? 'Estándar' : 'Premium'}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.calidades.add(e.target.value); else filtro.calidades.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroColorOro() {
  const wrap = document.getElementById('filterColorOro');
  if (!wrap) return;
  wrap.innerHTML = COLORES_ORO.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${c}" data-filter="colorOro">
      ${c}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtro.coloresOro.add(e.target.value); else filtro.coloresOro.delete(e.target.value);
    aplicarFiltros();
  }));
}

function renderFiltroTalla() {
  const wrap = document.getElementById('filterTalla');
  if (!wrap) return;
  const tallas = Array.from(new Set(CATALOGO_EJEMPLO.filter(p => p.talla).map(p => p.talla))).sort();
  wrap.innerHTML = `<option value="">Todas</option>` + tallas.map(t => `<option value="${t}">${t}</option>`).join('');
  wrap.addEventListener('change', (e) => {
    filtro.talla = e.target.value;
    aplicarFiltros();
  });
}

function toggleOroGroups() {
  const showOro = filtro.materiales.size === 0 || filtro.materiales.has('oro-laminado');
  document.querySelectorAll('.filter-group.conditional').forEach(g => g.classList.toggle('visible', showOro));
}

function limpiarFiltros() {
  filtro.materiales.clear();
  filtro.categorias.clear();
  filtro.calidades.clear();
  filtro.coloresOro.clear();
  filtro.talla = '';
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => cb.checked = false);
  const tallaSelect = document.getElementById('filterTalla');
  if (tallaSelect) tallaSelect.value = '';
  renderFiltroCategorias();
  toggleOroGroups();
  aplicarFiltros();
}

function aplicarFiltros() {
  const resultado = CATALOGO_EJEMPLO.filter((p) => {
    if (filtro.materiales.size > 0 && !filtro.materiales.has(p.material)) return false;
    if (filtro.categorias.size > 0 && !filtro.categorias.has(p.categoria)) return false;
    if (filtro.calidades.size > 0 && !filtro.calidades.has(p.calidad)) return false;
    if (filtro.coloresOro.size > 0 && !filtro.coloresOro.has(p.colorOro)) return false;
    if (filtro.talla && p.talla !== filtro.talla) return false;
    return true;
  });
  renderProductos(resultado);
}

function renderProductos(productos) {
  const grid = document.getElementById('catalogGrid');
  const count = document.getElementById('resultCount');
  if (!grid) return;

  if (count) count.textContent = `${productos.length} pieza${productos.length === 1 ? '' : 's'}`;

  if (productos.length === 0) {
    grid.innerHTML = '<div class="catalog-empty">No hay piezas que coincidan con estos filtros.</div>';
    return;
  }

  grid.innerHTML = productos.map((p) => `
    <div class="catalog-product-card">
      <div class="cp-photo">
        <img src="../assets/images/isotipo-morado.png" alt="">
      </div>
      <div class="cp-body">
        <h4>${p.nombre}</h4>
        <div class="cp-meta">${[p.categoria, p.colorOro, p.talla].filter(Boolean).join(' · ') || '&nbsp;'}</div>
        <div class="cp-price">$${p.precioMayoreo} MXN</div>
        ${p.disponible
          ? `<button class="btn btn-primary btn-apartar" data-apartar="${p.nombre}">Apartar</button>`
          : `<button class="btn btn-outline btn-apartar" disabled style="opacity:0.5;cursor:not-allowed;">No disponible</button>`}
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('[data-apartar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalApartar(btn.getAttribute('data-apartar')));
  });
}

function abrirModalApartar(nombreProducto) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Apartar: ${nombreProducto}</h3>
    <p class="modal-sub">Esta pieza quedaría reservada bajo tu ventana de depósito.</p>
    <div class="modal-note">⚠️ Vista de prueba: el sistema de apartados todavía no está conectado. Esta acción no reserva la pieza de verdad todavía.</div>
    <button class="btn btn-primary" style="width:100%;" data-close>Entendido</button>
  `;
  overlay.classList.add('open');
}
