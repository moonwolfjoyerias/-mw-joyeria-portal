// MW JOYERÍA — Catálogo Encargado
//
// Mismas capacidades que el catálogo de Staff (ver reglas y datos en
// staff-catalogo-ejemplo.js, reutilizado tal cual): ver, buscar,
// filtrar, agregar, editar, modificar existencia y eliminar productos.
//
// Única diferencia respecto a Staff: las acciones sensibles NO piden
// usuario/contraseña de nuevo — muestran un modal de Autorización con
// mensaje dinámico (ver js/encargado-comun.js) y quedan en la auditoría de Encargado.
//
// FASE 2 (Firebase): el almacenamiento real (Firestore o localStorage,
// misma colección/clave que usa Staff para representar el mismo
// catálogo) ya no vive aquí — ver js/catalogo-firestore-sync.js.

let catalogoEncargado = [];

document.addEventListener('DOMContentLoaded', async () => {

  await cargarCatalogo();
  renderFiltros();
  renderCatalogo();
  inicializarEventos();

});


// ============================================================
// CARGAR / GUARDAR — delega en js/catalogo-firestore-sync.js
// ============================================================

async function cargarCatalogo() {
  await catalogoRepoListo;
  catalogoEncargado = CATALOGO_CACHE.map(migrarProductoAVariantes);
}

function guardarCatalogo() {
  guardarCatalogoRepo(catalogoEncargado);
}


// ============================================================
// EVENTOS
// ============================================================

function inicializarEventos() {

  document.getElementById('agregarProductoBtn')?.addEventListener('click', () => abrirModalProducto());
  document.getElementById('searchInput')?.addEventListener('input', renderCatalogo);
  document.getElementById('filterMaterial')?.addEventListener('change', renderCatalogo);
  document.getElementById('filterCategoria')?.addEventListener('change', renderCatalogo);
  document.getElementById('filterEstado')?.addEventListener('change', renderCatalogo);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModal();
  });

}


// ============================================================
// FILTROS
// ============================================================

function renderFiltros() {

  const material = document.getElementById('filterMaterial');
  if (material) {
    material.innerHTML = `<option value="">Todos los materiales</option>` +
      MATERIALES_STAFF.map(m => `<option value="${m.key}">${m.label}</option>`).join('');
  }

  const categoria = document.getElementById('filterCategoria');
  if (categoria) {
    categoria.innerHTML = `<option value="">Todas las categorías</option>` +
      CATEGORIAS_STAFF.map(c => `<option value="${c}">${c}</option>`).join('');
  }

}


// ============================================================
// RENDER DEL CATÁLOGO
// ============================================================

function renderCatalogo() {

  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  actualizarResumenCatalogo();

  const search = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const material = document.getElementById('filterMaterial')?.value || '';
  const categoria = document.getElementById('filterCategoria')?.value || '';
  const estado = document.getElementById('filterEstado')?.value || '';

  const productos = catalogoEncargado.filter(p => {

    if (
      search &&
      !p.nombre.toLowerCase().includes(search) &&
      !p.descripcion.toLowerCase().includes(search) &&
      !(p.id || '').toLowerCase().includes(search) &&
      !(p.categoria || '').toLowerCase().includes(search)
    ) return false;

    if (material && p.material !== material) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (estado === 'disponible' && stockTotalProducto(p) <= 0) return false;
    if (estado === 'agotado' && stockTotalProducto(p) > 0) return false;

    return true;

  });

  const count = document.getElementById('resultCount');
  if (count) count.textContent = `${productos.length} producto${productos.length === 1 ? '' : 's'}`;

  if (!productos.length) {
    grid.innerHTML = `
      <tr>
        <td colspan="11" class="catalog-empty-cell">
          <strong>No encontramos productos</strong>
          <span>Prueba con otros filtros o agrega un nuevo artículo.</span>
        </td>
      </tr>
    `;
    return;
  }

  grid.innerHTML = productos.map(renderProducto).join('');

  wirearZoomFotos(grid);

  grid.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProducto(catalogoEncargado.find(p => p.id === btn.dataset.editar)));
  });

  grid.querySelectorAll('[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminar(btn.dataset.eliminar));
  });

  grid.querySelectorAll('[data-stock]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalStock(catalogoEncargado.find(p => p.id === btn.dataset.stock)));
  });

}

function actualizarResumenCatalogo() {

  const total = catalogoEncargado.length;
  const disponibles = catalogoEncargado.filter(productoDisponible).length;
  const oro = catalogoEncargado.filter(p => p.material === 'oro-laminado').length;
  const promedio = total ? catalogoEncargado.reduce((suma, p) => suma + Number(p.precioEtiqueta || 0), 0) / total : 0;

  const valores = {
    totalProductos: total,
    productosDisponibles: disponibles,
    productosOro: oro,
    precioPromedio: `$${formatearPrecio(promedio)}`
  };

  Object.entries(valores).forEach(([id, valor]) => {
    const elemento = document.getElementById(id);
    if (elemento) elemento.textContent = valor;
  });

}


// ============================================================
// TARJETA DEL PRODUCTO
// ============================================================

function renderProducto(p) {

  const material = MATERIALES_STAFF.find(m => m.key === p.material)?.label || p.material || '';

  const stockTotal = stockTotalProducto(p);

  let stockClass = 'stock-ok';
  let stockText = `${stockTotal} piezas`;

  if (stockTotal <= 0) {
    stockClass = 'stock-empty';
    stockText = 'Agotado';
  } else if (stockTotal <= 5) {
    stockClass = 'stock-low';
  }

  const imagen = normalizarImagenProducto(p);
  const disponibilidad = stockTotal > 0 ? 'Disponible' : 'Agotado';
  const variantesTxt = p.variantes.map(v => `${etiquetaVariante(v)} (${v.stock})`).join(' · ') || 'Sin variantes';
  const colorTalla = p.colorOro ? `${p.colorOro} · ${variantesTxt}` : variantesTxt;

  return `
    <tr>
      <td><span class="catalog-product-id">${escapeHTML(p.codigo || p.id)}</span></td>
      <td>
        <div class="catalog-product-cell">
          <img src="${imagen}" alt="${escapeHTML(p.nombre)}" ${/isotipo-morado\.png/.test(imagen) ? '' : `data-zoom="${escapeAttribute(imagen)}" data-zoom-alt="${escapeAttribute(p.nombre)}"`}>
          <strong>${escapeHTML(p.nombre)}</strong>
        </div>
      </td>
      <td><span class="catalog-description">${escapeHTML(p.descripcion || 'Sin descripción')}</span></td>
      <td>${escapeHTML(p.categoria || 'Sin categoría')}</td>
      <td>${escapeHTML(material)}</td>
      <td>${p.calidad === 'premium' ? 'Premium' : 'Estándar'}</td>
      <td>${escapeHTML(colorTalla)}</td>
      <td><strong>$${formatearPrecio(p.precioEtiqueta)} MXN</strong></td>
      <td>
        <strong>${p.descuento || 0}%</strong>
        <div class="catalog-description">$${formatearPrecio(calcularPrecioEmprendedora(p.precioEtiqueta, p.descuento))} MXN emprendedora</div>
      </td>
      <td><span class="catalog-stock ${stockClass}">${stockText}<small>${disponibilidad}</small></span></td>
      <td>
        <div class="catalog-actions">
          <button class="action-btn primary-action" data-editar="${p.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg></span> Editar</button>
          <button class="action-btn detail-action" data-stock="${p.id}"><span>◇</span> Existencia</button>
          <button class="action-btn danger-action" data-eliminar="${p.id}"><span>×</span> Eliminar</button>
        </div>
      </td>
    </tr>
  `;

}


// ============================================================
// MODAL DE PRODUCTO (agregar / editar) — abrir NO requiere
// autorización, es solo preparar el cambio (sección 17). El botón
// de guardar sí la pide, con el nombre real del producto.
// ============================================================

let galeriaTemporalEncargado = [];
let variantesTemporalEncargado = [];
const CATALOGO_GALERIA_MAX_FOTOS = 5;
const CATALOGO_GALERIA_TAMANO_MAX = 700000; // suma de caracteres base64 de la galería — ver nota en catalogo-firestore-sync.js (1 doc por producto, límite ~1MB)

function abrirModalProducto(producto = null) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  // El formulario de producto necesita más ancho que el resto de
  // modales de esta página (variantes en fila) — el modificador se
  // quita en cerrarModal() para no afectar a los demás.
  box.classList.add('modal-box-wide');

  fotosProcesandoEncargado = [];

  const editando = !!producto;
  galeriaTemporalEncargado = producto ? migrarProductoAVariantes(producto).galeria.map(f => ({ ...f })) : [];
  variantesTemporalEncargado = producto?.variantes?.length
    ? producto.variantes.map(v => ({ ...v }))
    : [crearVarianteProducto()];

  const materialInicial = producto?.material || MATERIALES_STAFF[0].key;
  const descuentoInicial = producto?.descuento ?? descuentoSugerido(materialInicial);
  const esOtroDescuento = ![60, 40, 30, 0].includes(Number(descuentoInicial));

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon">${editando ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M5 12h14"/></svg>'}</div>
    <h3>${editando ? 'Editar producto' : 'Agregar producto'}</h3>
    <p class="modal-sub">${editando ? 'Modifica la información del artículo.' : 'Agrega un nuevo artículo al catálogo de MW Joyería.'}</p>

    <div class="product-gallery-upload">
      <div class="product-gallery-grid" id="galeriaGrid"></div>
      <div class="image-upload-info">
        <strong>Fotos del artículo</strong>
        <label class="upload-image-btn">
          <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5A1.5 1.5 0 015.5 7H8l1.2-1.8a1.5 1.5 0 011.25-.7h3.1a1.5 1.5 0 011.25.7L16 7h2.5A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z"/><circle cx="12" cy="13" r="3.4"/></svg></span>
          Agregar foto
          <input type="file" id="productoGaleriaInput" accept="image/*" multiple hidden>
        </label>
        <small>JPG, PNG o WEBP · Máximo ${CATALOGO_GALERIA_MAX_FOTOS} fotos · Cada variante puede elegir cuál usar</small>
      </div>
    </div>

    <div class="form-grid">
      <div class="form-field full">
        <label>Nombre del artículo *</label>
        <input id="productoNombre" type="text" placeholder="Ej. Anillo Corazón" value="${escapeAttribute(producto?.nombre || '')}">
      </div>

      <div class="form-field full">
        <label>Descripción *</label>
        <textarea id="productoDescripcion" rows="3" placeholder="Describe el artículo...">${escapeHTML(producto?.descripcion || '')}</textarea>
      </div>

      <div class="form-field">
        <label>Material *</label>
        <select id="productoMaterial">
          ${MATERIALES_STAFF.map(m => `<option value="${m.key}" ${producto?.material === m.key ? 'selected' : ''}>${m.label}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Categoría *</label>
        <select id="productoCategoria">
          ${CATEGORIAS_STAFF.map(c => `<option value="${c}" ${producto?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Color de oro</label>
        <select id="productoColorOro">
          <option value="">Sin color</option>
          ${COLORES_ORO_STAFF.map(c => `<option value="${c}" ${producto?.colorOro === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Código del producto</label>
        <input id="productoCodigo" type="text" placeholder="Ej. AN-045" value="${escapeAttribute(producto?.codigo || '')}">
        <small class="field-help">Solo lo ven Staff, Encargado y Admin (columna "ID del producto") — nunca Emprendedora/Líder.</small>
      </div>

      <div class="form-field">
        <label>Calidad</label>
        <select id="productoCalidad">
          ${CALIDADES_STAFF.map(c => `<option value="${c.key}" ${producto?.calidad === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>

      <div class="form-field full">
        <label>Variantes (color de piedra / talla y existencia) *</label>
        <div id="variantesLista"></div>
        <button type="button" class="btn btn-outline" id="agregarVarianteBtn" style="width:100%;margin-top:8px;">+ Agregar variante</button>
        <small class="field-help">Una fila por cada combinación real de color de piedra/zirconia y talla en inventario (el color de oro ya se captura arriba, a nivel del artículo completo). Si el artículo no tiene color de piedra o talla, deja esos campos vacíos — solo captura la existencia. Esta cantidad solo es visible para Staff, Encargado y Admin.</small>
      </div>

      <div class="form-field">
        <label>Precio etiqueta *</label>
        <input id="productoPrecioEtiqueta" type="number" min="0" step="1" value="${producto?.precioEtiqueta ?? ''}">
        <small class="field-help">El precio que aparece en todos los catálogos.</small>
      </div>

      <div class="form-field">
        <label>Descuento</label>
        <select id="productoDescuentoSelect">
          <option value="60" ${!esOtroDescuento && descuentoInicial === 60 ? 'selected' : ''}>60%</option>
          <option value="40" ${!esOtroDescuento && descuentoInicial === 40 ? 'selected' : ''}>40%</option>
          <option value="30" ${!esOtroDescuento && descuentoInicial === 30 ? 'selected' : ''}>30%</option>
          <option value="otro" ${esOtroDescuento ? 'selected' : ''}>Otro</option>
          <option value="0" ${!esOtroDescuento && descuentoInicial === 0 ? 'selected' : ''}>No aplica</option>
        </select>
        <input id="productoDescuentoOtro" type="number" min="0" max="100" step="1" placeholder="% de descuento" value="${esOtroDescuento ? descuentoInicial : ''}" style="margin-top:8px;${esOtroDescuento ? '' : 'display:none;'}">
        <small class="field-help">Se sugiere según el material, pero puedes cambiarlo.</small>
      </div>
    </div>

    <div class="modal-note">
      <strong>Importante:</strong> al guardar este producto se te pedirá confirmar la acción.
    </div>

    <button class="btn btn-primary" id="guardarProductoBtn" style="width:100%;">
      ${editando ? 'Guardar cambios' : 'Agregar al catálogo'}
    </button>
  `;

  overlay.classList.add('open');

  renderGaleriaTemporalEncargado();
  renderVariantesTemporalEncargado();

  document.getElementById('agregarVarianteBtn')?.addEventListener('click', () => {
    variantesTemporalEncargado.push(crearVarianteProducto());
    renderVariantesTemporalEncargado();
  });

  document.getElementById('productoGaleriaInput')?.addEventListener('change', manejarGaleriaEncargado);

  document.getElementById('productoMaterial')?.addEventListener('change', (e) => {
    const select = document.getElementById('productoDescuentoSelect');
    const otro = document.getElementById('productoDescuentoOtro');
    if (!select) return;
    select.value = String(descuentoSugerido(e.target.value));
    if (otro) { otro.style.display = 'none'; otro.value = ''; }
  });

  document.getElementById('productoDescuentoSelect')?.addEventListener('change', (e) => {
    const otro = document.getElementById('productoDescuentoOtro');
    if (!otro) return;
    if (e.target.value === 'otro') { otro.style.display = ''; otro.focus(); }
    else { otro.style.display = 'none'; otro.value = ''; }
  });

  document.getElementById('guardarProductoBtn')?.addEventListener('click', async () => {

    if (fotosProcesandoEncargado.length) await Promise.all(fotosProcesandoEncargado);

    const datos = obtenerDatosProducto();
    if (!datos) return;

    const mensaje = editando
      ? `Estás a punto de guardar los cambios de "${datos.nombre}".`
      : `Estás a punto de agregar "${datos.nombre}" al catálogo.`;

    abrirAutorizacionEncargado({
      titulo: editando ? 'Autorizar cambios' : 'Autorizar nuevo producto',
      mensaje,
      onConfirmar: () => editando ? guardarEdicionProducto(producto.id, datos) : agregarProducto(datos)
    });

  });

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModal);

}


// ============================================================
// REPETIDOR DE VARIANTES (color de piedra / talla / existencia / foto)
// ============================================================

function renderVariantesTemporalEncargado() {

  const cont = document.getElementById('variantesLista');
  if (!cont) return;

  cont.innerHTML = variantesTemporalEncargado.map((v, i) => `
    <div class="variante-row" data-variante-row="${v.id}">
      <span class="variante-numero">Variante ${i + 1}</span>
      <div class="variante-campos">
        <div class="variante-field">
          <label>Color</label>
          <input class="variante-color" type="text" placeholder="Ej. Azul (opcional)" data-campo="color" data-id="${v.id}" value="${escapeAttribute(v.color || '')}">
        </div>
        <div class="variante-field">
          <label>Talla</label>
          <input class="variante-talla" type="text" placeholder="Opcional" data-campo="talla" data-id="${v.id}" value="${escapeAttribute(v.talla)}">
        </div>
        <div class="variante-field variante-field-stock">
          <label>Existencia</label>
          <input class="variante-stock" type="number" min="0" step="1" placeholder="0" data-campo="stock" data-id="${v.id}" value="${v.stock}">
        </div>
        <button type="button" class="variante-quitar" data-quitar-variante="${v.id}" title="Quitar variante">× Eliminar</button>
      </div>
      ${galeriaTemporalEncargado.length ? `
        <div class="variante-foto-picker">
          <span class="variante-foto-picker-label">Foto de esta variante:</span>
          <button type="button" class="variante-foto-thumb ${!v.fotoId ? 'selected' : ''}" data-elegir-foto="" data-variante-id="${v.id}" title="Usar la foto principal del producto">
            <img src="${galeriaTemporalEncargado[0].src}" alt="">
          </button>
          ${galeriaTemporalEncargado.map(f => `
            <button type="button" class="variante-foto-thumb ${v.fotoId === f.id ? 'selected' : ''}" data-elegir-foto="${f.id}" data-variante-id="${v.id}" title="Usar esta foto para la variante">
              <img src="${f.src}" alt="">
            </button>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  cont.querySelectorAll('[data-campo]').forEach(input => {
    input.addEventListener('input', (e) => {
      const variante = variantesTemporalEncargado.find(v => v.id === e.target.dataset.id);
      if (!variante) return;
      const campo = e.target.dataset.campo;
      variante[campo] = campo === 'stock' ? e.target.value : e.target.value.trim();
    });
  });

  cont.querySelectorAll('[data-quitar-variante]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (variantesTemporalEncargado.length <= 1) {
        mostrarToast('El producto debe tener al menos una variante.');
        return;
      }
      variantesTemporalEncargado = variantesTemporalEncargado.filter(v => v.id !== btn.dataset.quitarVariante);
      renderVariantesTemporalEncargado();
    });
  });

  cont.querySelectorAll('[data-elegir-foto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const variante = variantesTemporalEncargado.find(v => v.id === btn.dataset.varianteId);
      if (!variante) return;
      variante.fotoId = btn.dataset.elegirFoto || null;
      renderVariantesTemporalEncargado();
    });
  });

}


// ============================================================
// GALERÍA DE FOTOS
// ============================================================

// BUG-04 (ya corregido para la foto única, mismo criterio aquí):
// comprimir cada foto es async (comprimirImagenAProductoDataURL) pero
// nada impedía dar clic en "Guardar" ANTES de que terminaran — se
// guardaba la galería incompleta. fotosProcesandoEncargado guarda un
// arreglo de esas promesas (puede haber varias fotos subiéndose a la
// vez) para que el botón de Guardar las espere todas si hace falta.
let fotosProcesandoEncargado = [];

function renderGaleriaTemporalEncargado() {

  const cont = document.getElementById('galeriaGrid');
  if (!cont) return;

  if (!galeriaTemporalEncargado.length) {
    cont.innerHTML = `<div class="gallery-thumb gallery-thumb-empty"><img src="../../assets/images/isotipo-morado.png" alt=""></div>`;
    return;
  }

  cont.innerHTML = galeriaTemporalEncargado.map(f => `
    <div class="gallery-thumb">
      <img src="${f.src}" alt="">
      <button type="button" class="gallery-thumb-remove" data-quitar-foto="${f.id}" title="Quitar foto">×</button>
    </div>
  `).join('');

  cont.querySelectorAll('[data-quitar-foto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fotoId = btn.dataset.quitarFoto;
      galeriaTemporalEncargado = galeriaTemporalEncargado.filter(f => f.id !== fotoId);
      variantesTemporalEncargado.forEach(v => { if (v.fotoId === fotoId) v.fotoId = null; });
      renderGaleriaTemporalEncargado();
      renderVariantesTemporalEncargado();
    });
  });

}

async function manejarGaleriaEncargado(e) {

  const archivos = Array.from(e.target.files || []);
  e.target.value = '';
  if (!archivos.length) return;

  const validos = archivos.filter(a => a.type.startsWith('image/'));
  if (validos.length < archivos.length) mostrarToast('Algún archivo no era una imagen válida y se omitió.');
  if (!validos.length) return;

  if (galeriaTemporalEncargado.length + validos.length > CATALOGO_GALERIA_MAX_FOTOS) {
    mostrarToast(`Un producto admite máximo ${CATALOGO_GALERIA_MAX_FOTOS} fotos.`);
    return;
  }

  const boton = document.getElementById('guardarProductoBtn');
  const textoBotonOriginal = boton?.textContent;
  if (boton) { boton.disabled = true; boton.textContent = 'Procesando fotos...'; }

  const tarea = (async () => {
    for (const archivo of validos) {
      try {
        const src = await comprimirImagenAProductoDataURL(archivo);
        galeriaTemporalEncargado.push({ id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, src });
      } catch (error) {
        mostrarToast('No se pudo procesar una de las imágenes.');
      }
    }
    renderGaleriaTemporalEncargado();
    renderVariantesTemporalEncargado();
  })();

  fotosProcesandoEncargado.push(tarea);
  await tarea;
  fotosProcesandoEncargado = fotosProcesandoEncargado.filter(t => t !== tarea);
  if (boton) { boton.disabled = false; boton.textContent = textoBotonOriginal; }

}


// ============================================================
// OBTENER DATOS DEL FORMULARIO
// ============================================================

function obtenerDatosProducto() {

  const nombre = document.getElementById('productoNombre')?.value.trim();
  const descripcion = document.getElementById('productoDescripcion')?.value.trim();
  const material = document.getElementById('productoMaterial')?.value;
  const categoria = document.getElementById('productoCategoria')?.value;
  const colorOro = document.getElementById('productoColorOro')?.value || '';
  const codigo = document.getElementById('productoCodigo')?.value.trim();
  const calidad = document.getElementById('productoCalidad')?.value;
  const precioEtiqueta = Number(document.getElementById('productoPrecioEtiqueta')?.value);
  const descuentoSelect = document.getElementById('productoDescuentoSelect')?.value;
  const descuento = descuentoSelect === 'otro'
    ? Number(document.getElementById('productoDescuentoOtro')?.value)
    : Number(descuentoSelect);

  if (!nombre) { mostrarToast('Escribe el nombre del producto.'); return null; }
  if (!descripcion) { mostrarToast('Agrega una descripción.'); return null; }
  if (!variantesTemporalEncargado.length || variantesTemporalEncargado.some(v => Number.isNaN(Number(v.stock)) || Number(v.stock) < 0)) {
    mostrarToast('La existencia de alguna variante no es válida.');
    return null;
  }
  if (Number.isNaN(precioEtiqueta) || precioEtiqueta < 0) { mostrarToast('El precio etiqueta no es válido.'); return null; }
  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) { mostrarToast('El descuento no es válido (0 a 100).'); return null; }

  const tamanoGaleria = galeriaTemporalEncargado.reduce((suma, f) => suma + (f.src?.length || 0), 0);
  if (tamanoGaleria > CATALOGO_GALERIA_TAMANO_MAX) {
    mostrarToast('Las fotos de este producto pesan demasiado juntas. Quita alguna o usa fotos más pequeñas.');
    return null;
  }

  const variantes = variantesTemporalEncargado.map(v => crearVarianteProducto(v));

  return {
    nombre, descripcion, material, categoria, calidad, codigo, colorOro,
    variantes, precioEtiqueta, descuento,
    disponible: variantes.some(v => v.stock > 0),
    galeria: galeriaTemporalEncargado,
    imagen: galeriaTemporalEncargado[0]?.src || ''
  };

}


// ============================================================
// ACCIONES (ejecutadas tras confirmar en el modal de Autorización)
// ============================================================

function agregarProducto(datos) {

  const nuevoProducto = {
    id: 'prod-' + Date.now(),
    ...datos,
    ultimaAccion: { tipo: 'Agregado', empleado: ENCARGADO_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() }
  };

  catalogoEncargado.unshift(nuevoProducto);
  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaEncargado({ modulo: 'catalogo', accion: 'agregar_producto', descripcion: `Producto agregado: ${datos.nombre}` });
  mostrarToast(`Producto agregado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

  if (typeof abrirRevisionListaDeseosNuevoProducto === 'function') {
    abrirRevisionListaDeseosNuevoProducto(nuevoProducto, ENCARGADO_IDENTIDAD);
  }

  if (typeof enviarCorreoNuevoProductoCatalogo === 'function') enviarCorreoNuevoProductoCatalogo(nuevoProducto);

}

function guardarEdicionProducto(id, datos) {

  const producto = catalogoEncargado.find(p => p.id === id);
  if (!producto) return;

  Object.assign(producto, datos);
  producto.ultimaAccion = { tipo: 'Editado', empleado: ENCARGADO_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() };

  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaEncargado({ modulo: 'catalogo', accion: 'editar_producto', descripcion: `Producto editado: ${datos.nombre}` });
  mostrarToast(`Cambios guardados por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}

function confirmarEliminar(id) {

  const producto = catalogoEncargado.find(p => p.id === id);
  if (!producto) return;

  abrirAutorizacionEncargado({
    titulo: 'Autorizar eliminación',
    mensaje: `Estás a punto de eliminar "${producto.nombre}" del catálogo. Esta acción no se puede deshacer.`,
    peligrosa: true,
    onConfirmar: () => eliminarProducto(id)
  });

}

function eliminarProducto(id) {

  const producto = catalogoEncargado.find(p => p.id === id);
  if (!producto) return;

  catalogoEncargado = catalogoEncargado.filter(p => p.id !== id);
  guardarCatalogo();
  renderCatalogo();

  registrarAuditoriaEncargado({ modulo: 'catalogo', accion: 'eliminar_producto', descripcion: `Producto eliminado: ${producto.nombre}` });
  mostrarToast(`"${producto.nombre}" fue eliminado por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// MODIFICAR EXISTENCIA
// ============================================================

function abrirModalStock(producto) {

  if (!producto) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon">◇</div>
    <h3>Modificar existencia</h3>
    <p class="modal-sub">${escapeHTML(producto.nombre)}</p>

    <div class="modal-context">
      <span>Existencia total actual</span>
      <strong>${stockTotalProducto(producto)} piezas</strong>
      ${producto.colorOro ? `<span>Color de oro</span><strong>${escapeHTML(producto.colorOro)}</strong>` : ''}
      <span>Último cambio</span>
      <strong>${producto.ultimaAccion?.empleado || 'Sin registro'}</strong>
    </div>

    <label>Existencia por variante</label>
    <div id="stockVariantesLista">
      ${producto.variantes.map(v => `
        <div class="variante-stock-row">
          <span class="variante-stock-label">${escapeHTML(etiquetaVariante(v))}</span>
          <input type="number" min="0" step="1" class="variante-stock-input" data-variante-id="${v.id}" value="${v.stock}">
        </div>
      `).join('')}
    </div>

    <p class="demo-note">Esta información es privada para Staff, Encargado y Admin.</p>

    <button class="btn btn-primary" id="guardarStockBtn" style="width:100%;">Guardar existencia</button>
  `;

  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModal);

  document.getElementById('guardarStockBtn')?.addEventListener('click', () => {

    const inputs = box.querySelectorAll('.variante-stock-input');
    const nuevosValores = new Map();
    let valido = true;

    inputs.forEach(input => {
      const valor = Number(input.value);
      if (Number.isNaN(valor) || valor < 0) valido = false;
      nuevosValores.set(input.dataset.varianteId, Math.floor(valor));
    });

    if (!valido) {
      mostrarToast('La existencia no es válida.');
      return;
    }

    const totalNuevo = Array.from(nuevosValores.values()).reduce((suma, v) => suma + v, 0);

    abrirAutorizacionEncargado({
      titulo: 'Autorizar existencia',
      mensaje: `Estás a punto de cambiar la existencia de "${producto.nombre}" a ${totalNuevo} piezas en total.`,
      onConfirmar: () => guardarStock(producto.id, nuevosValores)
    });

  });

}

function guardarStock(id, nuevosValores) {

  const producto = catalogoEncargado.find(p => p.id === id);
  if (!producto) return;

  producto.variantes.forEach(v => {
    if (nuevosValores.has(v.id)) v.stock = nuevosValores.get(v.id);
  });
  producto.disponible = productoDisponible(producto);
  producto.ultimaAccion = { tipo: 'Existencia modificada', empleado: ENCARGADO_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() };

  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaEncargado({ modulo: 'catalogo', accion: 'modificar_existencia', descripcion: `Existencia de "${producto.nombre}" cambiada a ${stockTotalProducto(producto)} piezas` });
  mostrarToast(`Existencia actualizada por ${ENCARGADO_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModal() {
  document.getElementById('modalOverlay')?.classList.remove('open');
  document.getElementById('modalBox')?.classList.remove('modal-box-wide');
}

// mostrarToast(mensaje) se reutiliza de portal-common.js (#appToast,
// ya estilizado). Staff redefine una versión local con #mwToast que no
// tiene CSS propia en styles.css — ver nota en el reporte a Product.

function formatearPrecio(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}

function normalizarImagenProducto(producto) {

  const imagen = fotoPrincipalProducto(producto);

  if (!imagen) return '../../assets/images/isotipo-morado.png';

  if (imagen.startsWith('../assets/')) {
    return `../../${imagen.slice(3)}`;
  }

  return imagen;

}

