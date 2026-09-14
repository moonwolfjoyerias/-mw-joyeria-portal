// MW JOYERÍA — Catálogo: variantes reales Modelo → Color → Talla
//
// Antes cada producto era un registro plano con UN solo colorOro, UNA
// sola talla y UN solo stock — imposible reflejar que "Anillo Corazón"
// existe en Amarillo talla 6 (18 piezas) Y en Blanco talla 7 (5 piezas)
// a la vez. Ahora cada producto ("modelo") tiene un arreglo `variantes`:
// cada elemento es una combinación Color+Talla con su propio stock —
// exactamente la jerarquía Modelo→Color→Talla que pide la Sección 4.3
// del documento de requisitos ("cantidad por combinación color+talla").
//
// Productos sin color relevante (acero, exhibidores, souvenirs...) o sin
// talla (la mayoría fuera de Anillos/Cadenas) simplemente guardan
// colorOro/talla vacíos en su(s) variante(s) — la forma es la misma para
// todos, solo cambia si esos campos están vacíos o no.
//
// Comparten este módulo los 3 controladores de catálogo operativo
// (staff/rh/admin-catalogo.js — casi copias entre sí, ver sus propios
// encabezados) y los 3 controladores de Apartados (staff/rh/admin-
// apartados.js), que ahora seleccionan la pieza del catálogo real en
// vez de texto libre, y descuentan/restauran el stock de la variante
// exacta al apartar/cancelar.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. En Fase 2 se
// reemplaza por Firestore (colección productos/{productoId}) sin
// cambiar la forma de `variantes` — cada elemento ya tiene su propio id
// estable, listo para ser un subdocumento o un campo de mapa.

const CATALOGO_STAFF_STORAGE_KEY = 'mw_staff_catalogo_demo';

// ============================================================
// VARIANTES — crear / consultar
// ============================================================

function crearVarianteProducto(datos = {}) {
  return {
    id: datos.id || `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    colorOro: datos.colorOro || '',
    talla: datos.talla || '',
    stock: Math.max(0, Math.floor(Number(datos.stock) || 0))
  };
}

// Compatibilidad hacia atrás: un producto sembrado antes de esta
// migración solo tiene colorOro/talla/stock planos — se convierte a una
// única variante en el momento de leerlo, nunca se pierde información.
function migrarProductoAVariantes(producto) {
  if (Array.isArray(producto.variantes)) return producto;
  return {
    ...producto,
    variantes: [crearVarianteProducto({
      colorOro: producto.colorOro || '',
      talla: producto.talla || '',
      stock: producto.stock || 0
    })]
  };
}

function etiquetaVariante(variante) {
  return [variante.colorOro, variante.talla].filter(Boolean).join(' · ') || 'Única';
}

function stockTotalProducto(producto) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.reduce((suma, v) => suma + (Number(v.stock) || 0), 0);
}

function productoDisponible(producto) {
  return stockTotalProducto(producto) > 0;
}

// Variantes con stock > 0 — lo que debe verse al SELECCIONAR una pieza
// (Apartados, catálogo público): "ocultamiento automático de variantes
// agotadas" (Sección 4.3). Staff sigue viendo todas (agotadas incluidas)
// en su propio catálogo para poder restockear.
function variantesDisponibles(producto) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.filter(v => v.stock > 0);
}

function buscarVariante(producto, varianteId) {
  const p = migrarProductoAVariantes(producto);
  return p.variantes.find(v => v.id === varianteId) || null;
}

function precioConDescuento(producto) {
  const precio = Number(producto.precioEtiqueta) || 0;
  const descuento = Number(producto.descuento) || 0;
  return Math.round(precio * (1 - descuento / 100));
}

// ============================================================
// CATÁLOGO COMPLETO (localStorage) — usado por Apartados para
// descontar/restaurar stock sin depender del estado en memoria del
// controlador de Catálogo (pueden ser páginas distintas).
// ============================================================

function obtenerCatalogoStaffStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CATALOGO_STAFF_STORAGE_KEY));
    if (Array.isArray(guardado)) return guardado.map(migrarProductoAVariantes);
  } catch (error) {
    // sigue abajo
  }
  return (typeof CATALOGO_EJEMPLO !== 'undefined' ? CATALOGO_EJEMPLO : []).map(migrarProductoAVariantes);
}

function guardarCatalogoStaffStorage(catalogo) {
  localStorage.setItem(CATALOGO_STAFF_STORAGE_KEY, JSON.stringify(catalogo));
}

// Descuenta 1 pieza de una variante exacta. Falla explícitamente (sin
// tocar nada) si el producto/variante ya no existe o no tiene stock —
// evita apartar una pieza que en realidad ya no hay.
function descontarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return { ok: true }; // pieza sin producto real vinculado (dato antiguo) — no hay nada que descontar
  const catalogo = obtenerCatalogoStaffStorage();
  const producto = catalogo.find(p => p.id === productoId);
  if (!producto) return { ok: false, error: 'Ese producto ya no existe en el catálogo.' };
  const variante = producto.variantes.find(v => v.id === varianteId);
  if (!variante) return { ok: false, error: 'Esa variante ya no existe en el catálogo.' };
  if (variante.stock <= 0) return { ok: false, error: `Ya no hay existencia de ${producto.nombre} (${etiquetaVariante(variante)}).` };
  variante.stock -= 1;
  guardarCatalogoStaffStorage(catalogo);
  return { ok: true };
}

// Contraparte de descontarStockVariante — se llama al cancelar/desapartar
// una pieza, para que el inventario no quede perdido para siempre.
function restaurarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return;
  const catalogo = obtenerCatalogoStaffStorage();
  const producto = catalogo.find(p => p.id === productoId);
  if (!producto) return;
  const variante = producto.variantes.find(v => v.id === varianteId);
  if (!variante) return;
  variante.stock += 1;
  guardarCatalogoStaffStorage(catalogo);
}

function escapeHTMLCatalogoVariantes(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
