// MW JOYERÍA — Catálogo Staff
// Administra el catálogo de forma local.
// ⚠️ TEMPORAL: en Fase 3 los datos se conectarán con Firestore.

let productos = [];
let productoEditando = null;


// ======================================================
// INICIO
// ======================================================

document.addEventListener('DOMContentLoaded', () => {

  productos = CATALOGO_STAFF_EJEMPLO.map(producto => ({
    ...producto
  }));

  renderCatalogo();
  actualizarResumen();

  const nuevoBtn = document.getElementById('nuevoProductoBtn');

  if (nuevoBtn) {
    nuevoBtn.addEventListener('click', () => abrirModalProducto());
  }


  const search = document.getElementById('catalogSearch');

  if (search) {
    search.addEventListener('input', renderCatalogo);
  }


  const material = document.getElementById('catalogMaterialFilter');

  if (material) {
    material.addEventListener('change', renderCatalogo);
  }


  const availability = document.getElementById('catalogAvailabilityFilter');

  if (availability) {
    availability.addEventListener('change', renderCatalogo);
  }


  const closeBtn = document.getElementById('catalogModalClose');

  if (closeBtn) {
    closeBtn.addEventListener('click', cerrarModal);
  }


  const overlay = document.getElementById('catalogModalOverlay');

  if (overlay) {

    overlay.addEventListener('click', (event) => {

      if (event.target === overlay) {
        cerrarModal();
      }

    });

  }

});


// ======================================================
// RENDER
// ======================================================

function renderCatalogo() {

  const grid = document.getElementById('staffCatalogGrid');

  if (!grid) return;


  const texto = (
    document.getElementById('catalogSearch')?.value || ''
  ).toLowerCase().trim();


  const material = (
    document.getElementById('catalogMaterialFilter')?.value || ''
  );


  const disponibilidad = (
    document.getElementById('catalogAvailabilityFilter')?.value || ''
  );


  const filtrados = productos.filter(producto => {

    const coincideTexto =
      !texto ||
      producto.nombre.toLowerCase().includes(texto) ||
      producto.categoria.toLowerCase().includes(texto) ||
      producto.codigo.toLowerCase().includes(texto);


    const coincideMaterial =
      !material ||
      producto.material === material;


    const coincideDisponibilidad =
      !disponibilidad ||
      (disponibilidad === 'disponible' && producto.disponible) ||
      (disponibilidad === 'no-disponible' && !producto.disponible);


    return (
      coincideTexto &&
      coincideMaterial &&
      coincideDisponibilidad
    );

  });


  if (filtrados.length === 0) {

    grid.innerHTML = `
      <div class="catalog-empty">
        <div class="catalog-empty-icon">✦</div>
        <strong>No se encontraron productos</strong>
        <span>Prueba con otros filtros o agrega un nuevo producto.</span>
      </div>
    `;

    return;
  }


  grid.innerHTML = filtrados.map(producto => {

    const materialLabel = obtenerMaterialLabel(producto.material);

    return `
      <article class="staff-product-card">

        <div class="staff-product-image">

          <img
            src="${producto.imagen || '../assets/images/isotipo-morado.png'}"
            alt="${escapeHtml(producto.nombre)}"
          >

          <span class="product-status ${
            producto.disponible
              ? 'status-available'
              : 'status-unavailable'
          }">

            ${producto.disponible ? 'Disponible' : 'No disponible'}

          </span>

        </div>


        <div class="staff-product-body">

          <div class="product-code">
            ${escapeHtml(producto.codigo)}
          </div>

          <h3>
            ${escapeHtml(producto.nombre)}
          </h3>

          <p class="product-description">
            ${escapeHtml(producto.descripcion || 'Sin descripción')}
          </p>


          <div class="product-meta">

            <span>
              ${escapeHtml(materialLabel)}
            </span>

            <span>
              ${escapeHtml(producto.categoria)}
            </span>

            ${
              producto.colorOro
                ? `<span>${escapeHtml(producto.colorOro)}</span>`
                : ''
            }

            ${
              producto.talla
                ? `<span>Talla ${escapeHtml(producto.talla)}</span>`
                : ''
            }

          </div>


          <div class="product-bottom">

            <div>
              <small>Precio de mayoreo</small>

              <strong>
                $${formatearPrecio(producto.precioMayoreo)} MXN
              </strong>
            </div>


            <div class="product-actions">

              <button
                class="product-action-btn edit"
                data-edit="${producto.id}"
                title="Editar"
              >
                ✎
              </button>


              <button
                class="product-action-btn toggle"
                data-toggle="${producto.id}"
                title="${
                  producto.disponible
                    ? 'Marcar no disponible'
                    : 'Marcar disponible'
                }"
              >
                ${producto.disponible ? '◉' : '○'}
              </button>


              <button
                class="product-action-btn delete"
                data-delete="${producto.id}"
                title="Eliminar"
              >
                ×
              </button>

            </div>

          </div>

        </div>

      </article>
    `;

  }).join('');


  grid.querySelectorAll('[data-edit]').forEach(btn => {

    btn.addEventListener('click', () => {

      abrirModalProducto(btn.getAttribute('data-edit'));

    });

  });


  grid.querySelectorAll('[data-toggle]').forEach(btn => {

    btn.addEventListener('click', () => {

      cambiarDisponibilidad(btn.getAttribute('data-toggle'));

    });

  });


  grid.querySelectorAll('[data-delete]').forEach(btn => {

    btn.addEventListener('click', () => {

      eliminarProducto(btn.getAttribute('data-delete'));

    });

  });

}


// ======================================================
// MODAL AGREGAR / EDITAR
// ======================================================

function abrirModalProducto(id = null) {

  const overlay = document.getElementById('catalogModalOverlay');
  const content = document.getElementById('catalogModalContent');

  if (!overlay || !content) return;


  productoEditando = id
    ? productos.find(p => p.id === id)
    : null;


  const p = productoEditando || {

    codigo: '',
    nombre: '',
    descripcion: '',
    material: 'oro-laminado',
    categoria: 'Anillos',
    calidad: 'estandar',
    colorOro: 'Amarillo',
    talla: '',
    precioMayoreo: '',
    disponible: true,
    imagen: '../assets/images/isotipo-morado.png'

  };


  content.innerHTML = `

    <div class="catalog-modal-heading">

      <span class="eyebrow">
        ${productoEditando ? 'Editar producto' : 'Nuevo producto'}
      </span>

      <h3>
        ${productoEditando
          ? 'Editar pieza'
          : 'Agregar al catálogo'}
      </h3>

      <p>
        ${
          productoEditando
            ? 'Actualiza la información de esta pieza.'
            : 'Agrega una nueva pieza para que esté disponible en el catálogo de mayoreo.'
        }
      </p>

    </div>


    <form id="productoForm">


      <!-- IMAGEN -->

      <div class="image-upload-area">

        <div class="image-preview" id="imagePreview">

          <img
            src="${p.imagen}"
            alt="Vista previa"
            id="previewImage"
          >

        </div>


        <div class="image-upload-info">

          <strong>Imagen del producto</strong>

          <small>
            Sube una imagen clara de la pieza.
          </small>


          <label class="upload-image-btn">

            Seleccionar imagen

            <input
              type="file"
              id="productoImagen"
              accept="image/*"
              hidden
            >

          </label>

        </div>

      </div>


      <div class="form-grid">


        <!-- CÓDIGO -->

        <div class="form-field">

          <label for="productoCodigo">
            Código del producto
          </label>

          <input
            type="text"
            id="productoCodigo"
            value="${escapeAttribute(p.codigo)}"
            placeholder="Ej. MW-007"
            required
          >

        </div>


        <!-- NOMBRE -->

        <div class="form-field">

          <label for="productoNombre">
            Nombre
          </label>

          <input
            type="text"
            id="productoNombre"
            value="${escapeAttribute(p.nombre)}"
            placeholder="Ej. Anillo Corazón"
            required
          >

        </div>


        <!-- MATERIAL -->

        <div class="form-field">

          <label for="productoMaterial">
            Material
          </label>

          <select id="productoMaterial">

            <option value="oro-laminado"
              ${p.material === 'oro-laminado' ? 'selected' : ''}>
              Oro Laminado
            </option>

            <option value="acero-inoxidable"
              ${p.material === 'acero-inoxidable' ? 'selected' : ''}>
              Acero Inoxidable
            </option>

            <option value="exhibidores"
              ${p.material === 'exhibidores' ? 'selected' : ''}>
              Exhibidores
            </option>

            <option value="souvenirs"
              ${p.material === 'souvenirs' ? 'selected' : ''}>
              Souvenirs
            </option>

          </select>

        </div>


        <!-- CATEGORÍA -->

        <div class="form-field">

          <label for="productoCategoria">
            Categoría
          </label>

          <select id="productoCategoria">

            <option ${p.categoria === 'Anillos' ? 'selected' : ''}>
              Anillos
            </option>

            <option ${p.categoria === 'Cadenas' ? 'selected' : ''}>
              Cadenas
            </option>

            <option ${p.categoria === 'Collares' ? 'selected' : ''}>
              Collares
            </option>

            <option ${p.categoria === 'Pulseras' ? 'selected' : ''}>
              Pulseras
            </option>

            <option ${p.categoria === 'Aretes' ? 'selected' : ''}>
              Aretes
            </option>

            <option ${p.categoria === 'Dijes' ? 'selected' : ''}>
              Dijes
            </option>

            <option ${p.categoria === 'Exhibidores' ? 'selected' : ''}>
              Exhibidores
            </option>

            <option ${p.categoria === 'Souvenirs' ? 'selected' : ''}>
              Souvenirs
            </option>

          </select>

        </div>


        <!-- CALIDAD -->

        <div class="form-field">

          <label for="productoCalidad">
            Calidad
          </label>

          <select id="productoCalidad">

            <option value="estandar"
              ${p.calidad === 'estandar' ? 'selected' : ''}>
              Estándar
            </option>

            <option value="premium"
              ${p.calidad === 'premium' ? 'selected' : ''}>
              Premium
            </option>

          </select>

        </div>


        <!-- COLOR -->

        <div class="form-field">

          <label for="productoColor">
            Color de oro
          </label>

          <select id="productoColor">

            <option value="">
              No aplica
            </option>

            <option value="Amarillo"
              ${p.colorOro === 'Amarillo' ? 'selected' : ''}>
              Amarillo
            </option>

            <option value="Rosa"
              ${p.colorOro === 'Rosa' ? 'selected' : ''}>
              Rosa
            </option>

            <option value="Blanco"
              ${p.colorOro === 'Blanco' ? 'selected' : ''}>
              Blanco
            </option>

          </select>

        </div>


        <!-- TALLA -->

        <div class="form-field">

          <label for="productoTalla">
            Talla / medida
          </label>

          <input
            type="text"
            id="productoTalla"
            value="${escapeAttribute(p.talla)}"
            placeholder="Ej. 6 / 18 cm / 45 cm"
          >

        </div>


        <!-- PRECIO -->

        <div class="form-field">

          <label for="productoPrecio">
            Precio de mayoreo
          </label>

          <div class="price-input">

            <span>$</span>

            <input
              type="number"
              id="productoPrecio"
              value="${p.precioMayoreo}"
              min="0"
              step="1"
              placeholder="410"
              required
            >

            <span>MXN</span>

          </div>

        </div>

      </div>


      <!-- DESCRIPCIÓN -->

      <div class="form-field full">

        <label for="productoDescripcion">
          Descripción
        </label>

        <textarea
          id="productoDescripcion"
          rows="4"
          placeholder="Describe brevemente la pieza..."
        >${escapeHtml(p.descripcion)}</textarea>

      </div>


      <!-- DISPONIBILIDAD -->

      <label class="availability-check">

        <input
          type="checkbox"
          id="productoDisponible"
          ${p.disponible ? 'checked' : ''}
        >

        <span>

          <strong>Producto disponible</strong>

          <small>
            Si está activo, las emprendedoras podrán verlo como disponible.
          </small>

        </span>

      </label>


      <div class="catalog-form-actions">

        <button
          type="button"
          class="btn btn-outline"
          id="cancelarProductoBtn"
        >
          Cancelar
        </button>

        <button
          type="submit"
          class="btn btn-primary"
        >
          ${
            productoEditando
              ? 'Guardar cambios'
              : 'Agregar producto'
          }
        </button>

      </div>


    </form>

  `;


  overlay.classList.add('open');


  // PREVIEW IMAGEN

  const imageInput = document.getElementById('productoImagen');
  const preview = document.getElementById('previewImage');


  imageInput.addEventListener('change', () => {

    const file = imageInput.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {

      preview.src = event.target.result;

    };

    reader.readAsDataURL(file);

  });


  // CANCELAR

  document
    .getElementById('cancelarProductoBtn')
    .addEventListener('click', cerrarModal);


  // GUARDAR

  document
    .getElementById('productoForm')
    .addEventListener('submit', guardarProducto);

}


// ======================================================
// GUARDAR
// ======================================================

function guardarProducto(event) {

  event.preventDefault();


  const codigo =
    document.getElementById('productoCodigo').value.trim();


  const nombre =
    document.getElementById('productoNombre').value.trim();


  const descripcion =
    document.getElementById('productoDescripcion').value.trim();


  const material =
    document.getElementById('productoMaterial').value;


  const categoria =
    document.getElementById('productoCategoria').value;


  const calidad =
    document.getElementById('productoCalidad').value;


  const colorOro =
    document.getElementById('productoColor').value;


  const talla =
    document.getElementById('productoTalla').value.trim();


  const precioMayoreo =
    Number(document.getElementById('productoPrecio').value);


  const disponible =
    document.getElementById('productoDisponible').checked;


  const preview =
    document.getElementById('previewImage');


  const imagen =
    preview?.src ||
    '../assets/images/isotipo-morado.png';


  if (!codigo || !nombre || !precioMayoreo) {

    alert('Completa los campos obligatorios.');

    return;

  }


  if (productoEditando) {

    productoEditando.codigo = codigo;
    productoEditando.nombre = nombre;
    productoEditando.descripcion = descripcion;
    productoEditando.material = material;
    productoEditando.categoria = categoria;
    productoEditando.calidad = calidad;
    productoEditando.colorOro = colorOro;
    productoEditando.talla = talla;
    productoEditando.precioMayoreo = precioMayoreo;
    productoEditando.disponible = disponible;
    productoEditando.imagen = imagen;


    mostrarToast('Producto actualizado correctamente.');

  } else {

    productos.unshift({

      id: 'p' + Date.now(),

      codigo,
      nombre,
      descripcion,

      material,
      categoria,
      calidad,
      colorOro,
      talla,

      precioMayoreo,

      disponible,

      imagen

    });


    mostrarToast('Producto agregado al catálogo.');

  }


  cerrarModal();

  renderCatalogo();

  actualizarResumen();

}


// ======================================================
// DISPONIBILIDAD
// ======================================================

function cambiarDisponibilidad(id) {

  const producto =
    productos.find(p => p.id === id);


  if (!producto) return;


  producto.disponible =
    !producto.disponible;


  mostrarToast(
    producto.disponible
      ? 'Producto marcado como disponible.'
      : 'Producto marcado como no disponible.'
  );


  renderCatalogo();

  actualizarResumen();

}


// ======================================================
// ELIMINAR
// ======================================================

function eliminarProducto(id) {

  const producto =
    productos.find(p => p.id === id);


  if (!producto) return;


  const confirmar = confirm(
    `¿Seguro que deseas eliminar "${producto.nombre}" del catálogo?`
  );


  if (!confirmar) return;


  productos =
    productos.filter(p => p.id !== id);


  mostrarToast('Producto eliminado del catálogo.');


  renderCatalogo();

  actualizarResumen();

}


// ======================================================
// RESUMEN
// ======================================================

function actualizarResumen() {

  const total =
    productos.length;


  const disponibles =
    productos.filter(p => p.disponible).length;


  const oro =
    productos.filter(
      p => p.material === 'oro-laminado'
    ).length;


  const promedio =
    total
      ? productos.reduce(
          (sum, p) => sum + Number(p.precioMayoreo || 0),
          0
        ) / total
      : 0;


  setText('totalProductos', total);

  setText(
    'productosDisponibles',
    disponibles
  );

  setText(
    'productosOro',
    oro
  );

  setText(
    'precioPromedio',
    '$' + Math.round(promedio)
  );

}


// ======================================================
// CERRAR MODAL
// ======================================================

function cerrarModal() {

  const overlay =
    document.getElementById('catalogModalOverlay');


  if (overlay) {

    overlay.classList.remove('open');

  }


  productoEditando = null;

}


// ======================================================
// HELPERS
// ======================================================

function obtenerMaterialLabel(material) {

  const labels = {

    'oro-laminado': 'Oro Laminado',

    'acero-inoxidable': 'Acero Inoxidable',

    'exhibidores': 'Exhibidores',

    'souvenirs': 'Souvenirs'

  };


  return labels[material] || material;

}


function formatearPrecio(numero) {

  return Number(numero || 0).toLocaleString(
    'es-MX'
  );

}


function setText(id, value) {

  const element =
    document.getElementById(id);


  if (element) {

    element.textContent = value;

  }

}


function escapeHtml(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


function escapeAttribute(value) {

  return escapeHtml(value);

}


// ======================================================
// TOAST
// ======================================================

function mostrarToast(mensaje) {

  let toast =
    document.getElementById('mwCatalogToast');


  if (!toast) {

    toast = document.createElement('div');

    toast.id = 'mwCatalogToast';

    toast.className = 'mw-toast';

    document.body.appendChild(toast);

  }


  toast.textContent = mensaje;

  toast.classList.add('show');


  setTimeout(() => {

    toast.classList.remove('show');

  }, 2200);

}