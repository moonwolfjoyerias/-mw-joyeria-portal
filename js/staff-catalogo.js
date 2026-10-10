// MW JOYERÍA — Catálogo Staff
//
// Permite:
// - Ver productos
// - Agregar productos
// - Editar productos
// - Eliminar productos
// - Modificar existencia
// - Subir imágenes en modo demo
// - Registrar qué empleado hizo cada modificación
//
// ⚠️ TEMPORAL:
// localStorage simula la base de datos.
// En Fase 3 será reemplazado por Firestore.

let catalogoStaff = [];
let accionPendiente = null;
let galeriaTemporal = [];
let variantesTemporal = [];
const CATALOGO_GALERIA_MAX_FOTOS = 5;
const CATALOGO_GALERIA_TAMANO_MAX = 700000; // suma de caracteres base64 de la galería — ver nota en catalogo-firestore-sync.js (1 doc por producto, límite ~1MB)

const LOG_KEY = 'mw_staff_catalogo_logs';

document.addEventListener('DOMContentLoaded', async () => {

  await cargarCatalogo();

  renderFiltros();

  renderCatalogo();

  inicializarEventos();

});


// ============================================================
// CARGAR / GUARDAR — FASE 2 (Firebase): delega en
// js/catalogo-firestore-sync.js (catalogoRepoListo/guardarCatalogoRepo),
// que ya resuelve Firestore vs. localStorage.
// ============================================================

async function cargarCatalogo() {
  await catalogoRepoListo;
  catalogoStaff = CATALOGO_CACHE.map(migrarProductoAVariantes);
}


function guardarCatalogo() {
  guardarCatalogoRepo(catalogoStaff); // async, sin esperar — la UI ya refleja el cambio en memoria
}


// ============================================================
// EVENTOS
// ============================================================

function inicializarEventos() {

  const addBtn = document.getElementById('agregarProductoBtn');

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      abrirModalProducto();
    });
  }


  const search = document.getElementById('searchInput');

  if (search) {
    search.addEventListener('input', renderCatalogo);
  }


  const material = document.getElementById('filterMaterial');

  if (material) {
    material.addEventListener('change', renderCatalogo);
  }


  const categoria = document.getElementById('filterCategoria');

  if (categoria) {
    categoria.addEventListener('change', renderCatalogo);
  }


  const estado = document.getElementById('filterEstado');

  if (estado) {
    estado.addEventListener('change', renderCatalogo);
  }


  const overlay = document.getElementById('modalOverlay');

  if (overlay) {

    overlay.addEventListener('click', (e) => {

      if (e.target === overlay) {
        cerrarModal();
      }

    });

  }

}


// ============================================================
// FILTROS
// ============================================================

function renderFiltros() {

  const material = document.getElementById('filterMaterial');

  if (material) {

    material.innerHTML =
      `<option value="">Todos los materiales</option>` +
      MATERIALES_STAFF.map(m =>
        `<option value="${m.key}">${m.label}</option>`
      ).join('');

  }


  const categoria = document.getElementById('filterCategoria');

  if (categoria) {

    categoria.innerHTML =
      `<option value="">Todas las categorías</option>` +
      CATEGORIAS_STAFF.map(c =>
        `<option value="${c}">${c}</option>`
      ).join('');

  }

}


// ============================================================
// RENDER DEL CATÁLOGO
// ============================================================

function renderCatalogo() {

  const grid = document.getElementById('catalogGrid');

  if (!grid) return;

  actualizarResumenCatalogo();


  const search =
    document.getElementById('searchInput')?.value
      .toLowerCase()
      .trim() || '';


  const material =
    document.getElementById('filterMaterial')?.value || '';


  const categoria =
    document.getElementById('filterCategoria')?.value || '';


  const estado =
    document.getElementById('filterEstado')?.value || '';


  const productos = catalogoStaff.filter(p => {

    if (
      search &&
      !p.nombre.toLowerCase().includes(search) &&
      !p.descripcion.toLowerCase().includes(search) &&
      !(p.id || '').toLowerCase().includes(search) &&
      !(p.categoria || '').toLowerCase().includes(search)
    ) {
      return false;
    }


    if (material && p.material !== material) {
      return false;
    }


    if (categoria && p.categoria !== categoria) {
      return false;
    }


    if (estado === 'disponible' && stockTotalProducto(p) <= 0) {
      return false;
    }


    if (estado === 'agotado' && stockTotalProducto(p) > 0) {
      return false;
    }


    return true;

  });


  const count = document.getElementById('resultCount');

  if (count) {
    count.textContent =
      `${productos.length} producto${productos.length === 1 ? '' : 's'}`;
  }


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

    btn.addEventListener('click', () => {

      const id = btn.dataset.editar;

      solicitarAutorizacion(
        'editar',
        id
      );

    });

  });


  grid.querySelectorAll('[data-eliminar]').forEach(btn => {

    btn.addEventListener('click', () => {

      const id = btn.dataset.eliminar;

      solicitarAutorizacion(
        'eliminar',
        id
      );

    });

  });


  grid.querySelectorAll('[data-stock]').forEach(btn => {

    btn.addEventListener('click', () => {

      const id = btn.dataset.stock;

      solicitarAutorizacion(
        'stock',
        id
      );

    });

  });

}

function actualizarResumenCatalogo() {
  const total = catalogoStaff.length;
  const disponibles = catalogoStaff.filter(productoDisponible).length;
  const oro = catalogoStaff.filter(producto => producto.material === 'oro-laminado').length;
  const promedio = total
    ? catalogoStaff.reduce((suma, producto) => suma + Number(producto.precioEtiqueta || 0), 0) / total
    : 0;

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

  const material =
    MATERIALES_STAFF.find(m => m.key === p.material)?.label ||
    p.material ||
    '';


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
// MODAL DE PRODUCTO
// ============================================================

function abrirModalProducto(producto = null) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box) return;

  // El formulario de producto necesita más ancho que el resto de
  // modales de esta página (variantes en fila) — el modificador se
  // quita en cerrarModal() para no afectar a los demás.
  box.classList.add('modal-box-wide');

  fotosProcesando = [];

  const editando = !!producto;


  galeriaTemporal = producto ? migrarProductoAVariantes(producto).galeria.map(f => ({ ...f })) : [];
  variantesTemporal = producto?.variantes?.length
    ? producto.variantes.map(v => ({ ...v }))
    : [crearVarianteProducto()];

  const materialInicial = producto?.material || MATERIALES_STAFF[0].key;
  const descuentoInicial = producto?.descuento ?? descuentoSugerido(materialInicial);
  const esOtroDescuento = ![60, 40, 30, 0].includes(Number(descuentoInicial));


  box.innerHTML = `

    <button
      class="modal-close"
      data-close
    >
      ×
    </button>


    <div class="auth-icon">
      ${editando ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 20h4L18 10l-4-4L4 16v4z"/><path d="M13 7l4 4"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 5v14M5 12h14"/></svg>'}
    </div>


    <h3>
      ${editando ? 'Editar producto' : 'Agregar producto'}
    </h3>


    <p class="modal-sub">

      ${editando
        ? 'Modifica la información del artículo.'
        : 'Agrega un nuevo artículo al catálogo de MW Joyería.'
      }

    </p>


    <div class="product-gallery-upload">

      <div class="product-gallery-grid" id="galeriaGrid"></div>


      <div class="image-upload-info">

        <strong>Fotos del artículo</strong>

        <label class="upload-image-btn">

          <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8.5A1.5 1.5 0 015.5 7H8l1.2-1.8a1.5 1.5 0 011.25-.7h3.1a1.5 1.5 0 011.25.7L16 7h2.5A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z"/><circle cx="12" cy="13" r="3.4"/></svg></span>

          Agregar foto

          <input
            type="file"
            id="productoGaleriaInput"
            accept="image/*"
            multiple
            hidden
          >

        </label>

        <small>
          JPG, PNG o WEBP · Máximo ${CATALOGO_GALERIA_MAX_FOTOS} fotos · Cada variante puede elegir cuál usar
        </small>

      </div>

    </div>


    <div class="form-grid">

      <div class="form-field full">

        <label>Nombre del artículo *</label>

        <input
          id="productoNombre"
          type="text"
          placeholder="Ej. Anillo Corazón"
          value="${escapeAttribute(producto?.nombre || '')}"
        >

      </div>


      <div class="form-field full">

        <label>Descripción *</label>

        <textarea
          id="productoDescripcion"
          rows="3"
          placeholder="Describe el artículo..."
        >${escapeHTML(producto?.descripcion || '')}</textarea>

      </div>


      <div class="form-field">

        <label>Material *</label>

        <select id="productoMaterial">

          ${MATERIALES_STAFF.map(m => `
            <option
              value="${m.key}"
              ${producto?.material === m.key ? 'selected' : ''}
            >
              ${m.label}
            </option>
          `).join('')}

        </select>

      </div>


      <div class="form-field">

        <label>Categoría *</label>

        <select id="productoCategoria">

          ${CATEGORIAS_STAFF.map(c => `
            <option
              value="${c}"
              ${producto?.categoria === c ? 'selected' : ''}
            >
              ${c}
            </option>
          `).join('')}

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

          ${CALIDADES_STAFF.map(c => `
            <option
              value="${c.key}"
              ${producto?.calidad === c.key ? 'selected' : ''}
            >
              ${c.label}
            </option>
          `).join('')}

        </select>

      </div>


      <div class="form-field full">

        <label>Variantes (color de piedra / talla y existencia) *</label>

        <div id="variantesLista"></div>

        <button type="button" class="btn btn-outline" id="agregarVarianteBtn" style="width:100%;margin-top:8px;">+ Agregar variante</button>

        <small class="field-help">
          Una fila por cada combinación real de color de piedra/zirconia y talla en inventario (el color de oro ya se captura arriba, a nivel del artículo completo). Si el artículo no tiene color de piedra o talla, deja esos campos vacíos — solo captura la existencia. Esta cantidad solo es visible para Staff, Encargado y Admin.
        </small>

      </div>


      <div class="form-field">

        <label>Precio etiqueta *</label>

        <input
          id="productoPrecioEtiqueta"
          type="number"
          min="0"
          step="1"
          value="${producto?.precioEtiqueta ?? ''}"
        >

        <small class="field-help">
          El precio que aparece en todos los catálogos.
        </small>

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

        <input
          id="productoDescuentoOtro"
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="% de descuento"
          value="${esOtroDescuento ? descuentoInicial : ''}"
          style="margin-top:8px;${esOtroDescuento ? '' : 'display:none;'}"
        >

        <small class="field-help">
          Se sugiere según el material, pero puedes cambiarlo.
        </small>

      </div>

    </div>


    <div class="modal-note">

      <strong>Importante:</strong>
      al guardar este producto se solicitará nuevamente
      la autenticación del empleado que realizó el cambio.

    </div>


    <button
      class="btn btn-primary"
      id="guardarProductoBtn"
      style="width:100%;"
    >

      ${editando ? 'Guardar cambios' : 'Agregar al catálogo'}

    </button>

  `;


  overlay.classList.add('open');

  renderGaleriaTemporal();
  renderVariantesTemporal();

  document
    .getElementById('agregarVarianteBtn')
    ?.addEventListener('click', () => {
      variantesTemporal.push(crearVarianteProducto());
      renderVariantesTemporal();
    });


  document
    .getElementById('productoGaleriaInput')
    ?.addEventListener('change', manejarGaleria);


  document
    .getElementById('productoMaterial')
    ?.addEventListener('change', (e) => {

      const select = document.getElementById('productoDescuentoSelect');
      const otro = document.getElementById('productoDescuentoOtro');
      if (!select) return;

      select.value = String(descuentoSugerido(e.target.value));
      if (otro) { otro.style.display = 'none'; otro.value = ''; }

    });


  document
    .getElementById('productoDescuentoSelect')
    ?.addEventListener('change', (e) => {

      const otro = document.getElementById('productoDescuentoOtro');
      if (!otro) return;

      if (e.target.value === 'otro') {
        otro.style.display = '';
        otro.focus();
      } else {
        otro.style.display = 'none';
        otro.value = '';
      }

    });


  document
    .getElementById('guardarProductoBtn')
    ?.addEventListener('click', async () => {

      if (fotosProcesando.length) await Promise.all(fotosProcesando);

      const datos = obtenerDatosProducto();

      if (!datos) return;


      cerrarModal();


      // Toda modificación requiere autenticación
      solicitarAutorizacion(
        editando ? 'guardar-edicion' : 'agregar',
        producto?.id || null,
        datos
      );

    });


  box.querySelector('[data-close]')
    ?.addEventListener('click', cerrarModal);

}


// ============================================================
// REPETIDOR DE VARIANTES (color de piedra / talla / existencia / foto)
// ============================================================

function renderVariantesTemporal() {

  const cont = document.getElementById('variantesLista');
  if (!cont) return;

  cont.innerHTML = variantesTemporal.map((v, i) => `
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
      ${galeriaTemporal.length ? `
        <div class="variante-foto-picker">
          <span class="variante-foto-picker-label">Foto de esta variante:</span>
          <button type="button" class="variante-foto-thumb ${!v.fotoId ? 'selected' : ''}" data-elegir-foto="" data-variante-id="${v.id}" title="Usar la foto principal del producto">
            <img src="${galeriaTemporal[0].src}" alt="">
          </button>
          ${galeriaTemporal.map(f => `
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
      const variante = variantesTemporal.find(v => v.id === e.target.dataset.id);
      if (!variante) return;
      const campo = e.target.dataset.campo;
      variante[campo] = campo === 'stock' ? e.target.value : e.target.value.trim();
    });
  });

  cont.querySelectorAll('[data-quitar-variante]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (variantesTemporal.length <= 1) {
        mostrarToast('El producto debe tener al menos una variante.');
        return;
      }
      variantesTemporal = variantesTemporal.filter(v => v.id !== btn.dataset.quitarVariante);
      renderVariantesTemporal();
    });
  });

  cont.querySelectorAll('[data-elegir-foto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const variante = variantesTemporal.find(v => v.id === btn.dataset.varianteId);
      if (!variante) return;
      variante.fotoId = btn.dataset.elegirFoto || null;
      renderVariantesTemporal();
    });
  });

}


// ============================================================
// GALERÍA DE FOTOS
// ============================================================

// BUG-04 (ya corregido para la foto única, mismo criterio aquí):
// comprimir cada foto es async (comprimirImagenAProductoDataURL) pero
// nada impedía dar clic en "Guardar" ANTES de que terminaran — se
// guardaba la galería incompleta. fotosProcesando guarda un arreglo de
// esas promesas (puede haber varias fotos subiéndose a la vez) para
// que el botón de Guardar las espere todas si hace falta.
let fotosProcesando = [];

function renderGaleriaTemporal() {

  const cont = document.getElementById('galeriaGrid');
  if (!cont) return;

  if (!galeriaTemporal.length) {
    cont.innerHTML = `<div class="gallery-thumb gallery-thumb-empty"><img src="../../assets/images/isotipo-morado.png" alt=""></div>`;
    return;
  }

  cont.innerHTML = galeriaTemporal.map(f => `
    <div class="gallery-thumb">
      <img src="${f.src}" alt="">
      <button type="button" class="gallery-thumb-remove" data-quitar-foto="${f.id}" title="Quitar foto">×</button>
    </div>
  `).join('');

  cont.querySelectorAll('[data-quitar-foto]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fotoId = btn.dataset.quitarFoto;
      galeriaTemporal = galeriaTemporal.filter(f => f.id !== fotoId);
      variantesTemporal.forEach(v => { if (v.fotoId === fotoId) v.fotoId = null; });
      renderGaleriaTemporal();
      renderVariantesTemporal();
    });
  });

}

async function manejarGaleria(e) {

  const archivos = Array.from(e.target.files || []);
  e.target.value = '';
  if (!archivos.length) return;

  const validos = archivos.filter(a => a.type.startsWith('image/'));
  if (validos.length < archivos.length) mostrarToast('Algún archivo no era una imagen válida y se omitió.');
  if (!validos.length) return;

  if (galeriaTemporal.length + validos.length > CATALOGO_GALERIA_MAX_FOTOS) {
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
        galeriaTemporal.push({ id: `foto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, src });
      } catch (error) {
        mostrarToast('No se pudo procesar una de las imágenes.');
      }
    }
    renderGaleriaTemporal();
    renderVariantesTemporal();
  })();

  fotosProcesando.push(tarea);
  await tarea;
  fotosProcesando = fotosProcesando.filter(t => t !== tarea);
  if (boton) { boton.disabled = false; boton.textContent = textoBotonOriginal; }

}


// ============================================================
// OBTENER DATOS
// ============================================================

function obtenerDatosProducto() {

  const nombre =
    document.getElementById('productoNombre')?.value.trim();


  const descripcion =
    document.getElementById('productoDescripcion')?.value.trim();


  const material =
    document.getElementById('productoMaterial')?.value;


  const categoria =
    document.getElementById('productoCategoria')?.value;


  const colorOro =
    document.getElementById('productoColorOro')?.value || '';


  const codigo =
    document.getElementById('productoCodigo')?.value.trim();


  const calidad =
    document.getElementById('productoCalidad')?.value;


  const precioEtiqueta =
    Number(document.getElementById('productoPrecioEtiqueta')?.value);


  const descuentoSelect = document.getElementById('productoDescuentoSelect')?.value;

  const descuento =
    descuentoSelect === 'otro'
      ? Number(document.getElementById('productoDescuentoOtro')?.value)
      : Number(descuentoSelect);


  if (!nombre) {

    mostrarToast('Escribe el nombre del producto.');

    return null;

  }


  if (!descripcion) {

    mostrarToast('Agrega una descripción.');

    return null;

  }


  if (!variantesTemporal.length || variantesTemporal.some(v => Number.isNaN(Number(v.stock)) || Number(v.stock) < 0)) {

    mostrarToast('La existencia de alguna variante no es válida.');

    return null;

  }

  const variantes = variantesTemporal.map(v => crearVarianteProducto(v));


  if (Number.isNaN(precioEtiqueta) || precioEtiqueta < 0) {

    mostrarToast('El precio etiqueta no es válido.');

    return null;

  }


  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) {

    mostrarToast('El descuento no es válido (0 a 100).');

    return null;

  }


  const tamanoGaleria = galeriaTemporal.reduce((suma, f) => suma + (f.src?.length || 0), 0);

  if (tamanoGaleria > CATALOGO_GALERIA_TAMANO_MAX) {

    mostrarToast('Las fotos de este producto pesan demasiado juntas. Quita alguna o usa fotos más pequeñas.');

    return null;

  }


  return {

    nombre,
    descripcion,
    material,
    categoria,
    calidad,
    codigo,
    colorOro,
    variantes,
    precioEtiqueta,
    descuento,
    disponible: variantes.some(v => v.stock > 0),
    galeria: galeriaTemporal,
    imagen: galeriaTemporal[0]?.src || ''

  };

}


// ============================================================
// AUTENTICACIÓN PARA ACCIONES
// ============================================================

function solicitarAutorizacion(tipo, id, datos = null) {

  accionPendiente = {
    tipo,
    id,
    datos
  };


  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box) return;


  let titulo = 'Autorizar acción';
  let descripcion =
    'Ingresa tus credenciales para registrar quién realizó este cambio.';
  let boton = 'Autorizar y continuar';
  const productoSeleccionado = id ? catalogoStaff.find(p => p.id === id) : null;
  const detalleAccion = productoSeleccionado ? productoSeleccionado.nombre : 'Producto nuevo';


  if (tipo === 'agregar') {

    titulo = 'Autorizar nuevo producto';
    descripcion =
      'Confirma tus credenciales para agregar este artículo al catálogo.';

  }


  if (tipo === 'guardar-edicion') {

    titulo = 'Autorizar cambios';
    descripcion =
      'Confirma tus credenciales para guardar las modificaciones.';

  }


  if (tipo === 'editar') {

    titulo = 'Autorizar edición';
    descripcion =
      'Por seguridad, necesitamos identificar al empleado que realizará esta modificación.';

  }


  if (tipo === 'eliminar') {

    titulo = 'Autorizar eliminación';
    descripcion =
      'Esta acción eliminará el artículo del catálogo. Ingresa tus credenciales para continuar.';
    boton = 'Autorizar eliminación';

  }


  if (tipo === 'stock') {

    titulo = 'Modificar existencia';
    descripcion =
      'Ingresa tus credenciales para modificar la cantidad disponible.';

  }


  box.innerHTML = `

    <button
      class="modal-close"
      data-close
    >
      ×
    </button>


    <div class="auth-icon ${tipo === 'eliminar' ? 'danger' : ''}">
      ${tipo === 'eliminar' ? '!' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg>'}
    </div>


    <h3>${titulo}</h3>


    <p class="modal-sub">
      ${descripcion}
    </p>

    <div class="modal-context">
      <span>Acción</span>
      <strong>${titulo}</strong>

      <span>Detalle</span>
      <strong>${detalleAccion}</strong>

      <span>Tipo</span>
      <strong>${tipo === 'eliminar' ? 'Eliminación' : tipo === 'stock' ? 'Existencia' : tipo === 'agregar' ? 'Alta de producto' : tipo === 'guardar-edicion' ? 'Edición' : 'Modificación'}</strong>
    </div>

    <div class="auth-warning">

      <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></span>

      <div>

        <strong>
          Acción registrada
        </strong>

        <small>
          El sistema guardará el usuario, fecha y hora de esta modificación.
        </small>

      </div>

    </div>


    <label for="staffUsuario">
      Usuario de empleado
    </label>

    <input
      id="staffUsuario"
      type="text"
      autocomplete="username"
      placeholder="Ej. staff01"
    >


    <label for="staffPassword">
      Contraseña
    </label>

    <div class="password-wrap">

      <input
        id="staffPassword"
        type="password"
        autocomplete="current-password"
        placeholder="Contraseña"
      >

      <button
        type="button"
        id="mostrarPassword"
      >
        Ver
      </button>

    </div>


    <div
      id="authError"
      style="display:none;"
      class="auth-error"
    ></div>


    <button
      class="btn ${tipo === 'eliminar' ? 'btn-danger' : 'btn-primary'}"
      id="autorizarBtn"
      style="width:100%;"
    >
      ${boton}
    </button>


    <p class="demo-note">
      Demo: usuario <strong>staff01</strong> · contraseña <strong>1234</strong>
    </p>

  `;


  overlay.classList.add('open');


  document
    .getElementById('mostrarPassword')
    ?.addEventListener('click', () => {

      const input =
        document.getElementById('staffPassword');

      if (!input) return;

      input.type =
        input.type === 'password'
          ? 'text'
          : 'password';

    });


  document
    .getElementById('autorizarBtn')
    ?.addEventListener('click', validarAutorizacion);


  box.querySelector('[data-close]')
    ?.addEventListener('click', () => {

      accionPendiente = null;

      cerrarModal();

    });

}


// ============================================================
// VALIDAR CREDENCIALES
// ============================================================

async function validarAutorizacion() {

  const usuario =
    document.getElementById('staffUsuario')
      ?.value.trim();


  const password =
    document.getElementById('staffPassword')
      ?.value;


  const error =
    document.getElementById('authError');


  const empleado =
    STAFF_USUARIOS_EJEMPLO.find(
      u =>
        u.usuario === usuario &&
        u.password === password
    )
    // También acepta cuentas creadas desde Admin → Configuración →
    // Usuarios y permisos → Cuentas (js/cuentas-internas-modelo.js), ahora
    // verificadas contra Firebase Auth real (verificarCredencialEmpleado).
    || (typeof verificarCredencialEmpleado === 'function' ? await verificarCredencialEmpleado(usuario, password) : null);


  if (!empleado) {

    if (error) {

      error.style.display = 'block';

      error.textContent =
        'Usuario o contraseña incorrectos.';

    }

    return;

  }


  const accion = accionPendiente;


  registrarAccion(
    empleado,
    accion
  );


  ejecutarAccion(
    accion,
    empleado
  );


  accionPendiente = null;

}


// ============================================================
// EJECUTAR ACCIÓN
// ============================================================

function ejecutarAccion(accion, empleado) {

  if (!accion) return;


  // ----------------------------------------------------------
  // AGREGAR
  // ----------------------------------------------------------

  if (accion.tipo === 'agregar') {

    const nuevoProducto = {

      id:
        'prod-' +
        Date.now(),

      ...accion.datos,

      ultimaAccion: {
        tipo: 'Agregado',
        empleado: empleado.nombre,
        fecha: new Date().toISOString()
      }

    };


    catalogoStaff.unshift(nuevoProducto);

    guardarCatalogo();

    registrarAuditoria({
      usuarioId: empleado.usuario,
      usuarioNombre: empleado.nombre,
      rol: 'staff',
      modulo: 'catalogo',
      accion: 'agregar_producto',
      descripcion: `Producto agregado: ${nuevoProducto.nombre}`
    });

    cerrarModal();

    renderCatalogo();

    mostrarToast(
      `Producto agregado por ${empleado.nombre}.`
    );

    if (typeof abrirRevisionListaDeseosNuevoProducto === 'function') {
      abrirRevisionListaDeseosNuevoProducto(nuevoProducto, empleado);
    }

    return;

  }


  // ----------------------------------------------------------
  // GUARDAR EDICIÓN
  // ----------------------------------------------------------

  if (accion.tipo === 'guardar-edicion') {

    const producto =
      catalogoStaff.find(
        p => p.id === accion.id
      );


    if (!producto) return;


    Object.assign(
      producto,
      accion.datos
    );


    producto.ultimaAccion = {

      tipo: 'Editado',

      empleado:
        empleado.nombre,

      fecha:
        new Date().toISOString()

    };


    guardarCatalogo();

    registrarAuditoria({
      usuarioId: empleado.usuario,
      usuarioNombre: empleado.nombre,
      rol: 'staff',
      modulo: 'catalogo',
      accion: 'editar_producto',
      descripcion: `Producto editado: ${producto.nombre}`
    });

    cerrarModal();

    renderCatalogo();

    mostrarToast(
      `Cambios guardados por ${empleado.nombre}.`
    );

    return;

  }


  // ----------------------------------------------------------
  // EDITAR
  // ----------------------------------------------------------

  if (accion.tipo === 'editar') {

    const producto =
      catalogoStaff.find(
        p => p.id === accion.id
      );


    if (!producto) return;


    cerrarModal();

    abrirModalProducto(producto);

    return;

  }


  // ----------------------------------------------------------
  // ELIMINAR
  // ----------------------------------------------------------

  if (accion.tipo === 'eliminar') {

    const producto =
      catalogoStaff.find(
        p => p.id === accion.id
      );


    if (!producto) return;


    catalogoStaff =
      catalogoStaff.filter(
        p => p.id !== accion.id
      );


    guardarCatalogo();

    registrarAuditoria({
      usuarioId: empleado.usuario,
      usuarioNombre: empleado.nombre,
      rol: 'staff',
      modulo: 'catalogo',
      accion: 'eliminar_producto',
      descripcion: `Producto eliminado: ${producto.nombre}`
    });

    cerrarModal();

    renderCatalogo();

    mostrarToast(
      `"${producto.nombre}" fue eliminado por ${empleado.nombre}.`
    );

    return;

  }


  // ----------------------------------------------------------
  // EXISTENCIA
  // ----------------------------------------------------------

  if (accion.tipo === 'stock') {

    const producto =
      catalogoStaff.find(
        p => p.id === accion.id
      );


    if (!producto) return;


    cerrarModal();

    abrirModalStock(
      producto,
      empleado
    );

  }

}


// ============================================================
// MODIFICAR EXISTENCIA
// ============================================================

function abrirModalStock(producto, empleado) {

  const overlay =
    document.getElementById('modalOverlay');

  const box =
    document.getElementById('modalBox');


  box.innerHTML = `

    <button
      class="modal-close"
      data-close
    >
      ×
    </button>


    <div class="auth-icon">
      ◇
    </div>


    <h3>
      Modificar existencia
    </h3>


    <p class="modal-sub">
      ${escapeHTML(producto.nombre)}
    </p>


    <div class="modal-context">

      <span>Existencia total actual</span>

      <strong>
        ${stockTotalProducto(producto)} piezas
      </strong>

      ${producto.colorOro ? `<span>Color de oro</span><strong>${escapeHTML(producto.colorOro)}</strong>` : ''}

      <span>Último cambio</span>

      <strong>
        ${producto.ultimaAccion?.empleado || 'Sin registro'}
      </strong>

    </div>


    <label>
      Existencia por variante
    </label>

    <div id="stockVariantesLista">
      ${producto.variantes.map(v => `
        <div class="variante-stock-row">
          <span class="variante-stock-label">${escapeHTML(etiquetaVariante(v))}</span>
          <input type="number" min="0" step="1" class="variante-stock-input" data-variante-id="${v.id}" value="${v.stock}">
        </div>
      `).join('')}
    </div>


    <p class="demo-note">
      Esta información es privada para Staff, Encargado y Admin.
    </p>


    <button
      class="btn btn-primary"
      id="guardarStockBtn"
      style="width:100%;"
    >
      Guardar existencia
    </button>

  `;


  overlay.classList.add('open');


  box.querySelector('[data-close]')
    ?.addEventListener('click', cerrarModal);


  document
    .getElementById('guardarStockBtn')
    ?.addEventListener('click', () => {

      const inputs = box.querySelectorAll('.variante-stock-input');
      const nuevosValores = new Map();
      let valido = true;

      inputs.forEach(input => {
        const valor = Number(input.value);
        if (Number.isNaN(valor) || valor < 0) valido = false;
        nuevosValores.set(input.dataset.varianteId, Math.floor(valor));
      });

      if (!valido) {

        mostrarToast(
          'La existencia no es válida.'
        );

        return;

      }


      producto.variantes.forEach(v => {
        if (nuevosValores.has(v.id)) v.stock = nuevosValores.get(v.id);
      });


      producto.disponible =
        productoDisponible(producto);


      producto.ultimaAccion = {

        tipo: 'Existencia modificada',

        empleado:
          empleado.nombre,

        fecha:
          new Date().toISOString()

      };


      guardarCatalogo();

      registrarAuditoria({
        usuarioId: empleado.usuario,
        usuarioNombre: empleado.nombre,
        rol: 'staff',
        modulo: 'catalogo',
        accion: 'modificar_existencia',
        descripcion: `Existencia de "${producto.nombre}" cambiada a ${stockTotalProducto(producto)} piezas`
      });

      cerrarModal();

      renderCatalogo();


      mostrarToast(
        `Existencia actualizada por ${empleado.nombre}.`
      );

    });

}


// ============================================================
// REGISTRO DE ACCIONES
// ============================================================

function registrarAccion(empleado, accion) {

  const logs =
    JSON.parse(
      localStorage.getItem(LOG_KEY) || '[]'
    );


  logs.unshift({

    id: Date.now(),

    usuario:
      empleado.usuario,

    empleado:
      empleado.nombre,

    accion:
      accion.tipo,

    productoId:
      accion.id || null,

    fecha:
      new Date().toISOString()

  });


  localStorage.setItem(
    LOG_KEY,
    JSON.stringify(logs)
  );

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModal() {

  const overlay =
    document.getElementById('modalOverlay');

  if (overlay) {
    overlay.classList.remove('open');
  }

  document.getElementById('modalBox')?.classList.remove('modal-box-wide');

}


// mostrarToast(mensaje) se reutiliza de portal-common.js


function formatearPrecio(numero) {

  return Number(numero || 0)
    .toLocaleString('es-MX');

}


function normalizarImagenProducto(producto) {

  const imagen = fotoPrincipalProducto(producto);

  if (!imagen) return '../../assets/images/isotipo-morado.png';

  // Datos de ejemplo antiguos guardan la ruta relativa a /portal/ (un
  // nivel), pero esta página vive en /portal/staff/ (dos niveles).
  if (imagen.startsWith('../assets/')) {
    return `../../${imagen.slice(3)}`;
  }

  return imagen;

}

