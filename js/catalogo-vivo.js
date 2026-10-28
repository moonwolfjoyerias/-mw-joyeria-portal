// MW JOYERÍA — Catálogo en vivo para las clientas de una Emprendedora/Líder
//
// catalogo-vivo.html?e={personaId}: el link que cada e/l copia o comparte
// desde su Catálogo (ver iniciarLinkCatalogoClientas en js/catalogo.js).
// Muestra SOLO el catálogo real, con precio etiqueta (nunca el precio
// emprendedora ni el descuento), filtros, buscador y el detalle de cada
// pieza con todas sus fotos. No hay menú ni enlaces al resto del sitio:
// lo único que sale de aquí es el WhatsApp de la e/l.
//
// La página es pública (las clientas no inician sesión), así que el
// nombre y el teléfono salen de catalogoTarjetas/{personaId} — la e/l la
// escribe al compartir su link y se borra al dar de baja/inactivar su
// cuenta; sin tarjeta, el link ya no muestra nada.

let CATALOGO_VIVO = [];
let TARJETA_VIVO = null;

const filtroVivo = {
  materiales: new Set(),
  categorias: new Set(),
  coloresOro: new Set(),
  talla: '',
  texto: ''
};

function _numeroWhatsappVivo(telefono) {
  const digitos = String(telefono || '').replace(/\D/g, '');
  if (digitos.length === 10) return '52' + digitos;
  return digitos.length > 10 ? digitos : '';
}

function _primerNombreVivo() {
  return String((TARJETA_VIVO && TARJETA_VIVO.nombre) || '').trim().split(/\s+/)[0] || '';
}

function linkWhatsappVivo(mensaje) {
  const numero = _numeroWhatsappVivo(TARJETA_VIVO && TARJETA_VIVO.telefono);
  if (!numero) return '';
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}

function _fotoVivo(src) {
  if (!src) return 'assets/images/isotipo-morado.png';
  if (src.startsWith('../assets/')) return src.slice(3);
  return src;
}

function _esFotoGenericaVivo(src) {
  return !src || /isotipo-morado\.png/.test(src);
}

function _materialVivo(producto) {
  return (MATERIALES_STAFF.find(m => m.key === producto.material) || {}).label || producto.material || '';
}

// ---------- Carga ----------
async function leerTarjetaCatalogo(personaId) {
  if (!personaId || typeof dbFirestore === 'undefined' || !dbFirestore) return null;
  try {
    const doc = await dbFirestore.collection('catalogoTarjetas').doc(personaId).get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    return null;
  }
}

function mostrarLinkNoDisponible() {
  document.getElementById('catalogoVivoTitulo').textContent = 'Este link no está disponible';
  document.getElementById('catalogoVivoSub').textContent = 'Pídele a tu emprendedora MW que te comparta su link de nuevo.';
}

document.addEventListener('DOMContentLoaded', async () => {
  const personaId = new URLSearchParams(window.location.search).get('e') || '';
  TARJETA_VIVO = await leerTarjetaCatalogo(personaId);
  if (!TARJETA_VIVO) { mostrarLinkNoDisponible(); return; }

  const nombre = String(TARJETA_VIVO.nombre || '').trim();
  document.title = nombre ? `Catálogo de ${nombre} — MW Joyería` : 'Catálogo — MW Joyería';
  document.getElementById('catalogoVivoTitulo').textContent = nombre ? `Catálogo de ${nombre}` : 'Catálogo MW';

  const wa = linkWhatsappVivo(`¡Hola${_primerNombreVivo() ? ` ${_primerNombreVivo()}` : ''}! Vi tu catálogo de MW Joyería y me interesa una pieza.`);
  document.getElementById('catalogoVivoSub').textContent = wa
    ? 'Piezas disponibles con su precio etiqueta. Toca una pieza para ver sus fotos y pídela por WhatsApp.'
    : 'Piezas disponibles con su precio etiqueta. Toca una pieza para ver sus fotos.';
  const waBtn = document.getElementById('catalogoVivoWhatsapp');
  if (wa) { waBtn.href = wa; waBtn.style.display = ''; }

  if (typeof catalogoRepoListo !== 'undefined') await catalogoRepoListo;
  CATALOGO_VIVO = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];
  document.getElementById('catalogoVivoContenido').style.display = '';

  renderFiltroMaterialesVivo();
  renderFiltroCategoriasVivo();
  renderFiltroColorOroVivo();
  renderFiltroTallaVivo();
  toggleOroGroupsVivo();
  aplicarFiltrosVivo();

  document.getElementById('clearFiltersBtn').addEventListener('click', limpiarFiltrosVivo);
  document.getElementById('catalogoVivoBuscar').addEventListener('input', (e) => {
    filtroVivo.texto = e.target.value;
    aplicarFiltrosVivo();
  });
  iniciarModalVivo();
});

// ---------- Filtros (mismos que el catálogo público) ----------
function categoriasDisponiblesVivo() {
  const set = new Set();
  CATALOGO_VIVO.forEach((p) => {
    if (!productoDisponible(p)) return;
    if (filtroVivo.materiales.size > 0 && !filtroVivo.materiales.has(p.material)) return;
    if (p.categoria) set.add(p.categoria);
  });
  return Array.from(set).sort();
}

function renderFiltroMaterialesVivo() {
  const wrap = document.getElementById('filterMateriales');
  wrap.innerHTML = MATERIALES_STAFF.map(m => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeAttribute(m.key)}" data-filter="material">
      ${escapeHTML(m.label)}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtroVivo.materiales.add(e.target.value); else filtroVivo.materiales.delete(e.target.value);
    renderFiltroCategoriasVivo();
    toggleOroGroupsVivo();
    aplicarFiltrosVivo();
  }));
}

function renderFiltroCategoriasVivo() {
  const wrap = document.getElementById('filterCategorias');
  const cats = categoriasDisponiblesVivo();
  filtroVivo.categorias.forEach(c => { if (!cats.includes(c)) filtroVivo.categorias.delete(c); });
  wrap.innerHTML = cats.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeAttribute(c)}" data-filter="categoria" ${filtroVivo.categorias.has(c) ? 'checked' : ''}>
      ${escapeHTML(c)}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtroVivo.categorias.add(e.target.value); else filtroVivo.categorias.delete(e.target.value);
    aplicarFiltrosVivo();
  }));
}

function renderFiltroColorOroVivo() {
  const wrap = document.getElementById('filterColorOro');
  wrap.innerHTML = COLORES_ORO_STAFF.map(c => `
    <label class="filter-option">
      <input type="checkbox" value="${escapeAttribute(c)}" data-filter="colorOro">
      ${escapeHTML(c)}
    </label>
  `).join('');
  wrap.querySelectorAll('input').forEach(cb => cb.addEventListener('change', (e) => {
    if (e.target.checked) filtroVivo.coloresOro.add(e.target.value); else filtroVivo.coloresOro.delete(e.target.value);
    aplicarFiltrosVivo();
  }));
}

function renderFiltroTallaVivo() {
  const select = document.getElementById('filterTalla');
  const tallas = new Set();
  CATALOGO_VIVO.forEach((p) => {
    (variantesDisponibles(p) || []).forEach((v) => { if (v.talla) tallas.add(v.talla); });
  });
  select.innerHTML = '<option value="">Todas</option>' + Array.from(tallas).sort()
    .map(t => `<option value="${escapeAttribute(t)}">${escapeHTML(t)}</option>`).join('');
  select.addEventListener('change', (e) => {
    filtroVivo.talla = e.target.value;
    aplicarFiltrosVivo();
  });
}

function toggleOroGroupsVivo() {
  const showOro = filtroVivo.materiales.size === 0 || filtroVivo.materiales.has('oro-laminado');
  document.querySelectorAll('.filter-group.conditional').forEach(group => group.classList.toggle('visible', showOro));
}

function limpiarFiltrosVivo() {
  filtroVivo.materiales.clear();
  filtroVivo.categorias.clear();
  filtroVivo.coloresOro.clear();
  filtroVivo.talla = '';
  document.querySelectorAll('.filter-panel input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  document.getElementById('filterTalla').value = '';
  renderFiltroCategoriasVivo();
  toggleOroGroupsVivo();
  aplicarFiltrosVivo();
}

function _normalizarTextoVivo(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function productoCoincideVivo(p) {
  if (!productoDisponible(p)) return false;
  if (filtroVivo.materiales.size > 0 && !filtroVivo.materiales.has(p.material)) return false;
  if (filtroVivo.categorias.size > 0 && !filtroVivo.categorias.has(p.categoria)) return false;
  if (filtroVivo.coloresOro.size > 0 && !filtroVivo.coloresOro.has(p.colorOro)) return false;
  if (filtroVivo.talla && !variantesDisponibles(p).some(v => v.talla === filtroVivo.talla)) return false;
  const texto = _normalizarTextoVivo(filtroVivo.texto).trim();
  if (!texto) return true;
  const donde = _normalizarTextoVivo([p.nombre, p.descripcion, p.categoria, p.colorOro, _materialVivo(p)].join(' '));
  return texto.split(/\s+/).every(palabra => donde.includes(palabra));
}

function aplicarFiltrosVivo() {
  renderProductosVivo(ordenarProductosMasRecientes(CATALOGO_VIVO.filter(productoCoincideVivo)));
}

function renderProductosVivo(productos) {
  const grid = document.getElementById('catalogGrid');
  document.getElementById('resultCount').textContent = `${productos.length} pieza${productos.length === 1 ? '' : 's'}`;

  if (!productos.length) {
    grid.innerHTML = '<div class="catalog-empty">No hay piezas que coincidan con tu búsqueda.</div>';
    return;
  }

  grid.innerHTML = productos.map((p) => {
    const foto = fotoPrincipalProducto(p);
    const meta = [p.colorOro, p.categoria].filter(Boolean).join(' · ');
    return `
    <article class="catalog-product-card catalogo-vivo-card" data-producto="${escapeAttribute(p.id)}" tabindex="0" role="button" aria-label="Ver ${escapeAttribute(p.nombre)}">
      <div class="cp-photo">
        <img src="${_fotoVivo(foto)}" alt="${escapeAttribute(p.nombre)}" class="${_esFotoGenericaVivo(foto) ? 'foto-generica' : ''}">
      </div>
      <div class="cp-body">
        <h4>${escapeHTML(p.nombre)}</h4>
        <div class="cp-meta">${escapeHTML(meta) || '&nbsp;'}</div>
        <div class="cp-price">
          <span class="price-emprendedora">$${escapeHTML(p.precioEtiqueta)} MXN</span>
        </div>
      </div>
    </article>
  `;
  }).join('');

  grid.querySelectorAll('[data-producto]').forEach((card) => {
    const abrir = () => abrirDetalleVivo(card.getAttribute('data-producto'));
    card.addEventListener('click', abrir);
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } });
  });
}

// ---------- Detalle de la pieza ----------
function cerrarModalVivo() {
  document.getElementById('modalOverlay').classList.remove('open');
}

function iniciarModalVivo() {
  const overlay = document.getElementById('modalOverlay');
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('[data-close]')) cerrarModalVivo();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModalVivo(); });
}

async function abrirDetalleVivo(productoId) {
  const producto = CATALOGO_VIVO.find(p => String(p.id) === String(productoId));
  if (!producto) return;
  const box = document.getElementById('modalBox');
  const disponibles = variantesDisponibles(producto);
  const conOpciones = disponibles.filter(v => etiquetaVariante(v) && etiquetaVariante(v) !== 'Única');
  const fotoInicial = fotoPrincipalProducto(producto, true);

  box.classList.add('modal-box-xwide');
  box.innerHTML = `
    <button class="modal-close" data-close aria-label="Cerrar">&times;</button>
    <div class="detalle-producto-layout">
      <div>
        <div class="detalle-producto-foto">
          <img id="vivoFotoGrande" src="${_fotoVivo(fotoInicial)}" alt="${escapeAttribute(producto.nombre)}" class="${_esFotoGenericaVivo(fotoInicial) ? 'foto-generica' : ''}">
        </div>
        <div class="detalle-miniaturas" id="vivoMiniaturas"></div>
      </div>
      <div class="detalle-producto-info">
        <h3>${escapeHTML(producto.nombre)}</h3>
        <div class="detail-grid">
          ${producto.descripcion ? `<div class="full" style="grid-column:1/-1;"><span>Descripción</span><strong>${escapeHTML(producto.descripcion)}</strong></div>` : ''}
          <div><span>Categoría</span><strong>${escapeHTML(producto.categoria || 'Sin categoría')}</strong></div>
          <div><span>Material</span><strong>${escapeHTML(_materialVivo(producto))}</strong></div>
          ${producto.colorOro ? `<div><span>Color de oro</span><strong>${escapeHTML(producto.colorOro)}</strong></div>` : ''}
          <div><span>Precio etiqueta</span><strong>$${escapeHTML(producto.precioEtiqueta)} MXN</strong></div>
        </div>
        ${conOpciones.length ? `
          <label for="vivoVariante">${conOpciones.length === 1 ? 'Disponible en' : 'Color / talla disponibles'}</label>
          <select id="vivoVariante" style="width:100%;height:42px;border:1px solid var(--mw-border);border-radius:7px;padding:0 12px;color:var(--mw-text);background:var(--surface);">
            ${conOpciones.length === 1 ? '' : '<option value="">Elige una opción…</option>'}
            ${conOpciones.map(v => `<option value="${escapeAttribute(v.id)}">${escapeHTML(etiquetaVariante(v))}</option>`).join('')}
          </select>
        ` : ''}
        <a class="btn btn-whatsapp" id="vivoPedirBtn" href="#" target="_blank" rel="noopener" style="width:100%;justify-content:center;margin-top:14px;display:none;">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.5 11.6a8.5 8.5 0 01-12.6 7.4L3.5 20.5l1.6-4.2A8.5 8.5 0 1120.5 11.6z"/></svg>
          <span>Pedir por WhatsApp</span>
        </a>
      </div>
    </div>
  `;
  document.getElementById('modalOverlay').classList.add('open');

  const img = document.getElementById('vivoFotoGrande');
  const select = document.getElementById('vivoVariante');
  const pedirBtn = document.getElementById('vivoPedirBtn');
  const tira = document.getElementById('vivoMiniaturas');
  const marcarMiniatura = (fotoId) => {
    tira.querySelectorAll('[data-foto]').forEach((b, i) => {
      b.classList.toggle('activa', fotoId ? b.getAttribute('data-foto') === fotoId : i === 0);
    });
  };

  const mostrarFoto = async (src) => {
    let real = src;
    try { real = await resolverFotoPendienteProducto(src, true); } catch (error) { real = ''; }
    if (!img.isConnected) return;
    img.src = _fotoVivo(real);
    img.classList.toggle('foto-generica', _esFotoGenericaVivo(real));
  };

  const actualizarPedido = () => {
    const variante = select ? buscarVariante(producto, select.value) : null;
    const opcion = variante ? ` (${etiquetaVariante(variante)})` : '';
    const nombre = _primerNombreVivo();
    const wa = linkWhatsappVivo(`¡Hola${nombre ? ` ${nombre}` : ''}! Me interesa la pieza "${producto.nombre}"${opcion} de $${producto.precioEtiqueta} MXN que vi en tu catálogo.`);
    pedirBtn.style.display = wa ? '' : 'none';
    if (wa) pedirBtn.href = wa;
  };
  actualizarPedido();

  select?.addEventListener('change', () => {
    const variante = buscarVariante(producto, select.value);
    mostrarFoto(variante ? fotoVarianteProducto(producto, variante) : fotoPrincipalProducto(producto, true));
    marcarMiniatura(variante && variante.fotoId);
    actualizarPedido();
  });
  if (select && conOpciones.length === 1) {
    mostrarFoto(fotoVarianteProducto(producto, conOpciones[0]));
  }

  // Todas las fotos de la pieza, como miniaturas para cambiar la grande.
  let galeria = fotosEmbebidasProducto(producto);
  if (!galeria.length && !(Array.isArray(producto.fotosIds) && !producto.fotosIds.length)) {
    try { galeria = await cargarGaleriaProducto(producto.id); } catch (error) { galeria = []; }
  }
  if (!tira.isConnected || galeria.length < 2) return;
  tira.innerHTML = galeria.map((f, i) => `
    <button type="button" class="${i === 0 ? 'activa' : ''}" data-foto="${escapeAttribute(f.id)}" aria-label="Foto ${i + 1}">
      <img src="${_fotoVivo(f.src)}" alt="">
    </button>
  `).join('');
  tira.querySelectorAll('[data-foto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const foto = galeria.find(f => f.id === btn.getAttribute('data-foto'));
      if (!foto) return;
      mostrarFoto(foto.src);
      marcarMiniatura(foto.id);
    });
  });
}
