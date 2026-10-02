// MW JOYERÍA — Renderiza las tarjetas de producto en la página de Colecciones
//
// Antes leía de PRODUCTOS_EJEMPLO, un arreglo fijo separado del
// catálogo real que administra Staff/Encargado/Admin — un visitante
// público siempre veía piezas inventadas, nunca el catálogo real. Ahora
// lee del mismo repositorio real (js/catalogo-firestore-sync.js +
// js/catalogo-variantes-modelo.js) que usan Staff/Encargado/Admin/
// Emprendedora/Líder — ver firestore.rules (productos/{id} ahora
// permite lectura pública a propósito, para esta página y
// catalogo-publico.html).
//
// "Destacado" ya no existe como campo del producto real (nunca se migró
// esa curación) — en su lugar se muestran hasta 4 piezas disponibles
// por material, en el orden en que ya vienen. Nunca muestra el precio
// de emprendedora (con descuento) ni el código interno del producto —
// esta es una página pública, sin sesión.

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof catalogoRepoListo !== 'undefined') await catalogoRepoListo;

  const categorias = ['oro-laminado', 'acero-inoxidable', 'exhibidores', 'souvenirs', 'fantasia', 'otros'];
  const catalogo = typeof obtenerCatalogoStaffStorage === 'function' ? obtenerCatalogoStaffStorage() : [];

  categorias.forEach((material) => {
    const grid = document.querySelector(`.product-grid[data-categoria="${material}"]`);
    if (!grid) return;

    const productos = catalogo
      .filter((p) => p.material === material && typeof productoDisponible === 'function' && productoDisponible(p))
      .slice(0, 4);

    if (productos.length === 0) {
      grid.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Próximamente productos en esta colección.</p>';
      return;
    }

    grid.innerHTML = productos.map((p) => `
      <a class="product-card" href="catalogo-publico.html?producto=${encodeURIComponent(p.id)}">
        <div class="product-photo">
          <img src="${normalizarImagenProductoPublico(p.imagen)}" alt="" class="${esFotoGenericaProductoPublico(p.imagen) ? 'foto-generica' : ''}">
        </div>
        <h4>${escapeHTMLColecciones(p.nombre)}</h4>
        <p class="product-price">$${p.precioEtiqueta} MXN</p>
      </a>
    `).join('');
  });
});

// Mismo respaldo que ya usan admin/encargado/staff-catalogo.js, pero
// esta página vive en la raíz del sitio (un nivel menos que /portal/).
function normalizarImagenProductoPublico(imagen) {
  if (!imagen) return 'assets/images/isotipo-morado.png';
  if (imagen.startsWith('../assets/')) return imagen.slice(3);
  return imagen;
}

// true si "imagen" no es una foto real (vacío, o la ruta del logo MW
// que trae la semilla de ejemplo) — ver esFotoGenericaProducto en
// js/catalogo.js (mismo criterio).
function esFotoGenericaProductoPublico(imagen) {
  return !imagen || /isotipo-morado\.png/.test(imagen);
}

function escapeHTMLColecciones(texto) {
  return escapeHTML(texto);
}
