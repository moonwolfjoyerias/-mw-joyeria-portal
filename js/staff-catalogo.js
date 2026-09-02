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
let imagenTemporal = '';

const STORAGE_KEY = 'mw_staff_catalogo_demo';
const LOG_KEY = 'mw_staff_catalogo_logs';

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
      catalogoStaff = JSON.parse(guardado);
    } catch (error) {
      catalogoStaff = CATALOGO_EJEMPLO.map(p => ({ ...p }));
    }
  } else {
    catalogoStaff = CATALOGO_EJEMPLO.map(p => ({ ...p }));
    guardarCatalogo();
  }

}


function guardarCatalogo() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(catalogoStaff)
  );

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


    if (estado === 'disponible' && p.stock <= 0) {
      return false;
    }


    if (estado === 'agotado' && p.stock > 0) {
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
  const disponibles = catalogoStaff.filter(producto => producto.stock > 0).length;
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
// MODAL DE PRODUCTO
// ============================================================

function abrirModalProducto(producto = null) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box) return;


  const editando = !!producto;


  imagenTemporal = normalizarImagenProducto(producto?.imagen);

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
      ${editando ? '✎' : '+'}
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


    <div class="product-image-upload">

      <div
        class="image-preview"
        id="imagePreview"
      >

        <img
          src="${imagenTemporal}"
          id="previewImage"
          alt=""
        >

      </div>


      <div class="image-upload-info">

        <strong>Foto del artículo</strong>

        <label class="upload-image-btn">

          <span>📷</span>

          Seleccionar imagen

          <input
            type="file"
            id="productoImagen"
            accept="image/*"
            hidden
          >

        </label>

        <small>
          JPG, PNG o WEBP · Vista de demostración
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


      <div class="form-field">

        <label>Color del oro</label>

        <select id="productoColor">

          <option value="">No aplica</option>

          ${COLORES_ORO_STAFF.map(c => `
            <option
              value="${c}"
              ${producto?.colorOro === c ? 'selected' : ''}
            >
              ${c}
            </option>
          `).join('')}

        </select>

      </div>


      <div class="form-field">

        <label>Talla / variante</label>

        <input
          id="productoTalla"
          type="text"
          placeholder="Ej. 6"
          value="${escapeAttribute(producto?.talla || '')}"
        >

      </div>


      <div class="form-field">

        <label>Existencia *</label>

        <input
          id="productoStock"
          type="number"
          min="0"
          step="1"
          value="${producto?.stock ?? 0}"
        >

        <small class="field-help">
          Esta cantidad solo es visible para Staff, RH y Admin.
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


  document
    .getElementById('productoImagen')
    ?.addEventListener('change', manejarImagen);


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
    ?.addEventListener('click', () => {

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


  reader.onload = function(event) {

    imagenTemporal = event.target.result;


    const preview =
      document.getElementById('previewImage');

    if (preview) {
      preview.src = imagenTemporal;
    }

  };


  reader.readAsDataURL(archivo);

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


  const calidad =
    document.getElementById('productoCalidad')?.value;


  const colorOro =
    document.getElementById('productoColor')?.value;


  const talla =
    document.getElementById('productoTalla')?.value.trim();


  const stock =
    Number(document.getElementById('productoStock')?.value);


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


  if (Number.isNaN(stock) || stock < 0) {

    mostrarToast('La existencia no es válida.');

    return null;

  }


  if (Number.isNaN(precioEtiqueta) || precioEtiqueta < 0) {

    mostrarToast('El precio etiqueta no es válido.');

    return null;

  }


  if (Number.isNaN(descuento) || descuento < 0 || descuento > 100) {

    mostrarToast('El descuento no es válido (0 a 100).');

    return null;

  }


  return {

    nombre,
    descripcion,
    material,
    categoria,
    calidad,
    colorOro,
    talla,
    stock,
    precioEtiqueta,
    descuento,
    disponible: stock > 0,
    imagen: imagenTemporal

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
      ${tipo === 'eliminar' ? '!' : '✓'}
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

      <span>🔐</span>

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

function validarAutorizacion() {

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
    );


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

    cerrarModal();

    renderCatalogo();

    mostrarToast(
      `Producto agregado por ${empleado.nombre}.`
    );

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

      <span>Existencia actual</span>

      <strong>
        ${producto.stock} piezas
      </strong>


      <span>Último cambio</span>

      <strong>
        ${producto.ultimaAccion?.empleado || 'Sin registro'}
      </strong>

    </div>


    <label for="nuevoStock">
      Nueva existencia
    </label>


    <input
      type="number"
      id="nuevoStock"
      min="0"
      step="1"
      value="${producto.stock}"
    >


    <p class="demo-note">
      Esta información es privada para Staff, RH y Admin.
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

      const nuevoStock =
        Number(
          document.getElementById('nuevoStock')?.value
        );


      if (
        Number.isNaN(nuevoStock) ||
        nuevoStock < 0
      ) {

        mostrarToast(
          'La existencia no es válida.'
        );

        return;

      }


      producto.stock =
        Math.floor(nuevoStock);


      producto.disponible =
        producto.stock > 0;


      producto.ultimaAccion = {

        tipo: 'Existencia modificada',

        empleado:
          empleado.nombre,

        fecha:
          new Date().toISOString()

      };


      guardarCatalogo();

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

}


function mostrarToast(mensaje) {

  let toast =
    document.getElementById('mwToast');


  if (!toast) {

    toast =
      document.createElement('div');

    toast.id = 'mwToast';

    toast.className = 'mw-toast';

    document.body.appendChild(toast);

  }


  toast.textContent = mensaje;

  toast.classList.add('show');


  setTimeout(() => {

    toast.classList.remove('show');

  }, 2800);

}


function formatearPrecio(numero) {

  return Number(numero || 0)
    .toLocaleString('es-MX');

}


function normalizarImagenProducto(imagen) {

  if (!imagen) return '../../assets/images/isotipo-morado.png';

  // Datos de ejemplo antiguos guardan la ruta relativa a /portal/ (un
  // nivel), pero esta página vive en /portal/staff/ (dos niveles).
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