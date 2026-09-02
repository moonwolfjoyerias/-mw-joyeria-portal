// MW JOYERÍA — Catálogo RH
//
// Mismas capacidades que el catálogo de Staff (ver reglas y datos en
// staff-catalogo-ejemplo.js, reutilizado tal cual): ver, buscar,
// filtrar, agregar, editar, modificar existencia y eliminar productos.
//
// Única diferencia respecto a Staff: las acciones sensibles NO piden
// usuario/contraseña de nuevo — muestran un modal de Autorización con
// mensaje dinámico (ver js/rh-comun.js) y quedan en la auditoría de RH.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos (misma clave que
// usa Staff, para representar el mismo catálogo — ver Fase 3/Firestore).

let catalogoRH = [];

const STORAGE_KEY = 'mw_staff_catalogo_demo';

document.addEventListener('DOMContentLoaded', () => {

  cargarCatalogo();
  renderFiltros();
  renderCatalogo();
  inicializarEventos();

});


// ============================================================
// CARGAR / GUARDAR
// ============================================================

function cargarCatalogo() {

  const guardado = localStorage.getItem(STORAGE_KEY);

  if (guardado) {
    try {
      catalogoRH = JSON.parse(guardado);
    } catch (error) {
      catalogoRH = CATALOGO_EJEMPLO.map(p => ({ ...p }));
    }
  } else {
    catalogoRH = CATALOGO_EJEMPLO.map(p => ({ ...p }));
    guardarCatalogo();
  }

}

function guardarCatalogo() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(catalogoRH));
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

  const productos = catalogoRH.filter(p => {

    if (
      search &&
      !p.nombre.toLowerCase().includes(search) &&
      !p.descripcion.toLowerCase().includes(search) &&
      !(p.id || '').toLowerCase().includes(search) &&
      !(p.categoria || '').toLowerCase().includes(search)
    ) return false;

    if (material && p.material !== material) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (estado === 'disponible' && p.stock <= 0) return false;
    if (estado === 'agotado' && p.stock > 0) return false;

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

  grid.querySelectorAll('[data-editar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalProducto(catalogoRH.find(p => p.id === btn.dataset.editar)));
  });

  grid.querySelectorAll('[data-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => confirmarEliminar(btn.dataset.eliminar));
  });

  grid.querySelectorAll('[data-stock]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalStock(catalogoRH.find(p => p.id === btn.dataset.stock)));
  });

}

function actualizarResumenCatalogo() {

  const total = catalogoRH.length;
  const disponibles = catalogoRH.filter(p => p.stock > 0).length;
  const oro = catalogoRH.filter(p => p.material === 'oro-laminado').length;
  const promedio = total ? catalogoRH.reduce((suma, p) => suma + Number(p.precioEtiqueta || 0), 0) / total : 0;

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

  let stockClass = 'stock-ok';
  let stockText = `${p.stock} piezas`;

  if (p.stock <= 0) {
    stockClass = 'stock-empty';
    stockText = 'Agotado';
  } else if (p.stock <= 5) {
    stockClass = 'stock-low';
  }

  const imagen = normalizarImagenProducto(p.imagen);
  const disponibilidad = p.stock > 0 ? 'Disponible' : 'Agotado';
  const colorTalla = [p.colorOro, p.talla].filter(Boolean).join(' · ') || 'No aplica';

  return `
    <tr>
      <td><span class="catalog-product-id">${escapeHTML(p.id)}</span></td>
      <td>
        <div class="catalog-product-cell">
          <img src="${imagen}" alt="${escapeHTML(p.nombre)}">
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
          <button class="action-btn primary-action" data-editar="${p.id}"><span>✎</span> Editar</button>
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

let imagenTemporalRH = '';

function abrirModalProducto(producto = null) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const editando = !!producto;
  imagenTemporalRH = normalizarImagenProducto(producto?.imagen);

  const materialInicial = producto?.material || MATERIALES_STAFF[0].key;
  const descuentoInicial = producto?.descuento ?? descuentoSugerido(materialInicial);
  const esOtroDescuento = ![60, 40, 30, 0].includes(Number(descuentoInicial));

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon">${editando ? '✎' : '+'}</div>
    <h3>${editando ? 'Editar producto' : 'Agregar producto'}</h3>
    <p class="modal-sub">${editando ? 'Modifica la información del artículo.' : 'Agrega un nuevo artículo al catálogo de MW Joyería.'}</p>

    <div class="product-image-upload">
      <div class="image-preview" id="imagePreview">
        <img src="${imagenTemporalRH}" id="previewImage" alt="">
      </div>
      <div class="image-upload-info">
        <strong>Foto del artículo</strong>
        <label class="upload-image-btn">
          <span>📷</span>
          Seleccionar imagen
          <input type="file" id="productoImagen" accept="image/*" hidden>
        </label>
        <small>JPG, PNG o WEBP · Vista de demostración</small>
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
        <label>Calidad</label>
        <select id="productoCalidad">
          ${CALIDADES_STAFF.map(c => `<option value="${c.key}" ${producto?.calidad === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Color del oro</label>
        <select id="productoColor">
          <option value="">No aplica</option>
          ${COLORES_ORO_STAFF.map(c => `<option value="${c}" ${producto?.colorOro === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>

      <div class="form-field">
        <label>Talla / variante</label>
        <input id="productoTalla" type="text" placeholder="Ej. 6" value="${escapeAttribute(producto?.talla || '')}">
      </div>

      <div class="form-field">
        <label>Existencia *</label>
        <input id="productoStock" type="number" min="0" step="1" value="${producto?.stock ?? 0}">
        <small class="field-help">Esta cantidad solo es visible para Staff, RH y Admin.</small>
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

  document.getElementById('productoImagen')?.addEventListener('change', manejarImagen);

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

  document.getElementById('guardarProductoBtn')?.addEventListener('click', () => {

    const datos = obtenerDatosProducto();
    if (!datos) return;

    const mensaje = editando
      ? `Estás a punto de guardar los cambios de "${datos.nombre}".`
      : `Estás a punto de agregar "${datos.nombre}" al catálogo.`;

    abrirAutorizacionRH({
      titulo: editando ? 'Autorizar cambios' : 'Autorizar nuevo producto',
      mensaje,
      onConfirmar: () => editando ? guardarEdicionProducto(producto.id, datos) : agregarProducto(datos)
    });

  });

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModal);

}


// ============================================================
// IMAGEN
// ============================================================

function manejarImagen(e) {

  const archivo = e.target.files?.[0];
  if (!archivo) return;

  if (!archivo.type.startsWith('image/')) {
    mostrarToast('Selecciona una imagen válida.');
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    imagenTemporalRH = event.target.result;
    const preview = document.getElementById('previewImage');
    if (preview) preview.src = imagenTemporalRH;
  };

  reader.readAsDataURL(archivo);

}


// ============================================================
// OBTENER DATOS DEL FORMULARIO
// ============================================================

function obtenerDatosProducto() {

  const nombre = document.getElementById('productoNombre')?.value.trim();
  const descripcion = document.getElementById('productoDescripcion')?.value.trim();
  const material = document.getElementById('productoMaterial')?.value;
  const categoria = document.getElementById('productoCategoria')?.value;
  const calidad = document.getElementById('productoCalidad')?.value;
  const colorOro = document.getElementById('productoColor')?.value;
  const talla = document.getElementById('productoTalla')?.value.trim();
  const stock = Number(document.getElementById('productoStock')?.value);
  const precioEtiqueta = Number(document.getElementById('productoPrecioEtiqueta')?.value);
  const descuentoSelect = document.getElementById('productoDescuentoSelect')?.value;
  const descuento = descuentoSelect === 'otro'
    ? Number(document.getElementById('productoDescuentoOtro')?.value)
    : Number(descuentoSelect);

  if (!nombre) { mostrarToast('Escribe el nombre del producto.'); return null; }
  if (!descripcion) { mostrarToast('Agrega una descripción.'); return null; }
  if (Number.isNaN(stock) || stock < 0) { mostrarToast('La existencia no es válida.'); return null; }
  if (Number.isNaN(precioEtiqueta) || precioEtiqueta < 0) { mostrarToast('El precio etiqueta no es válido.'); return null; }
  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) { mostrarToast('El descuento no es válido (0 a 100).'); return null; }

  return {
    nombre, descripcion, material, categoria, calidad, colorOro, talla,
    stock, precioEtiqueta, descuento,
    disponible: stock > 0,
    imagen: imagenTemporalRH
  };

}


// ============================================================
// ACCIONES (ejecutadas tras confirmar en el modal de Autorización)
// ============================================================

function agregarProducto(datos) {

  const nuevoProducto = {
    id: 'prod-' + Date.now(),
    ...datos,
    ultimaAccion: { tipo: 'Agregado', empleado: RH_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() }
  };

  catalogoRH.unshift(nuevoProducto);
  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaRH({ modulo: 'catalogo', accion: 'agregar_producto', descripcion: `Producto agregado: ${datos.nombre}` });
  mostrarToast(`Producto agregado por ${RH_IDENTIDAD.usuarioNombre}.`);

}

function guardarEdicionProducto(id, datos) {

  const producto = catalogoRH.find(p => p.id === id);
  if (!producto) return;

  Object.assign(producto, datos);
  producto.ultimaAccion = { tipo: 'Editado', empleado: RH_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() };

  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaRH({ modulo: 'catalogo', accion: 'editar_producto', descripcion: `Producto editado: ${datos.nombre}` });
  mostrarToast(`Cambios guardados por ${RH_IDENTIDAD.usuarioNombre}.`);

}

function confirmarEliminar(id) {

  const producto = catalogoRH.find(p => p.id === id);
  if (!producto) return;

  abrirAutorizacionRH({
    titulo: 'Autorizar eliminación',
    mensaje: `Estás a punto de eliminar "${producto.nombre}" del catálogo. Esta acción no se puede deshacer.`,
    peligrosa: true,
    onConfirmar: () => eliminarProducto(id)
  });

}

function eliminarProducto(id) {

  const producto = catalogoRH.find(p => p.id === id);
  if (!producto) return;

  catalogoRH = catalogoRH.filter(p => p.id !== id);
  guardarCatalogo();
  renderCatalogo();

  registrarAuditoriaRH({ modulo: 'catalogo', accion: 'eliminar_producto', descripcion: `Producto eliminado: ${producto.nombre}` });
  mostrarToast(`"${producto.nombre}" fue eliminado por ${RH_IDENTIDAD.usuarioNombre}.`);

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
      <span>Existencia actual</span>
      <strong>${producto.stock} piezas</strong>
      <span>Último cambio</span>
      <strong>${producto.ultimaAccion?.empleado || 'Sin registro'}</strong>
    </div>

    <label for="nuevoStock">Nueva existencia</label>
    <input type="number" id="nuevoStock" min="0" step="1" value="${producto.stock}">

    <p class="demo-note">Esta información es privada para Staff, RH y Admin.</p>

    <button class="btn btn-primary" id="guardarStockBtn" style="width:100%;">Guardar existencia</button>
  `;

  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModal);

  document.getElementById('guardarStockBtn')?.addEventListener('click', () => {

    const nuevoStock = Number(document.getElementById('nuevoStock')?.value);

    if (Number.isNaN(nuevoStock) || nuevoStock < 0) {
      mostrarToast('La existencia no es válida.');
      return;
    }

    abrirAutorizacionRH({
      titulo: 'Autorizar existencia',
      mensaje: `Estás a punto de cambiar la existencia de "${producto.nombre}" a ${Math.floor(nuevoStock)} piezas.`,
      onConfirmar: () => guardarStock(producto.id, Math.floor(nuevoStock))
    });

  });

}

function guardarStock(id, nuevoStock) {

  const producto = catalogoRH.find(p => p.id === id);
  if (!producto) return;

  producto.stock = nuevoStock;
  producto.disponible = producto.stock > 0;
  producto.ultimaAccion = { tipo: 'Existencia modificada', empleado: RH_IDENTIDAD.usuarioNombre, fecha: new Date().toISOString() };

  guardarCatalogo();
  cerrarModal();
  renderCatalogo();

  registrarAuditoriaRH({ modulo: 'catalogo', accion: 'modificar_existencia', descripcion: `Existencia de "${producto.nombre}" cambiada a ${nuevoStock} piezas` });
  mostrarToast(`Existencia actualizada por ${RH_IDENTIDAD.usuarioNombre}.`);

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModal() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

// mostrarToast(mensaje) se reutiliza de portal-common.js (#appToast,
// ya estilizado). Staff redefine una versión local con #mwToast que no
// tiene CSS propia en styles.css — ver nota en el reporte a Product.

function formatearPrecio(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}

function normalizarImagenProducto(imagen) {

  if (!imagen) return '../../assets/images/isotipo-morado.png';

  if (imagen.startsWith('../assets/')) {
    return `../../${imagen.slice(3)}`;
  }

  return imagen;

}

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(texto) {
  return escapeHTML(texto);
}
