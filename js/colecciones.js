// MW JOYERÍA — Renderiza las tarjetas de producto en la página de Colecciones
// No sabe ni le importa si PRODUCTOS_EJEMPLO viene de un archivo fijo (ahora)
// o de Firestore (después) — solo espera un array con la forma:
// { id, nombre, categoria, precioEtiqueta, destacado }

document.addEventListener('DOMContentLoaded', () => {
  const categorias = ['oro-laminado', 'acero-inoxidable', 'exhibidores', 'souvenirs'];

  categorias.forEach((categoria) => {
    const grid = document.querySelector(`.product-grid[data-categoria="${categoria}"]`);
    if (!grid) return;

    const productos = PRODUCTOS_EJEMPLO
      .filter((p) => p.categoria === categoria && p.destacado)
      .slice(0, 4);

    if (productos.length === 0) {
      grid.innerHTML = '<p class="text-muted" style="font-size:0.9rem;">Próximamente productos en esta colección.</p>';
      return;
    }

    grid.innerHTML = productos.map((p) => `
      <a class="product-card" href="catalogo-publico.html?producto=${encodeURIComponent(p.id)}">
        <div class="product-photo">
          <img src="assets/images/isotipo-morado.png" alt="">
        </div>
        <h4>${p.nombre}</h4>
        <p class="product-price">$${p.precioEtiqueta} MXN</p>
      </a>
    `).join('');
  });
});
