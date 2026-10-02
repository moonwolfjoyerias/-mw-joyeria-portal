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
// (staff/encargado/admin-catalogo.js — casi copias entre sí, ver sus
// propios encabezados) y los 3 controladores de Apartados (staff/
// encargado/admin-apartados.js), que ahora seleccionan la pieza del
// catálogo real en vez de texto libre, y descuentan/restauran el stock
// de la variante exacta al apartar/cancelar.
//
// FASE 2 (Firebase): el almacenamiento real (Firestore o localStorage,
// colección/clave "productos"/"mw_staff_catalogo_demo") ya no vive
// aquí — ver js/catalogo-firestore-sync.js. La forma de `variantes` no
// cambió: cada elemento ya tiene su propio id estable, listo para ser
// un subdocumento o un campo de mapa en Firestore.

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

// FASE 2 (Firebase): delega en js/catalogo-firestore-sync.js — mismo
// contrato síncrono de siempre (lee/escribe un arreglo en memoria), pero
// ese arreglo ahora puede venir de Firestore en vez de localStorage. Ver
// el comentario de cabecera de ese archivo para el porqué del caché.
function obtenerCatalogoStaffStorage() {
  return CATALOGO_CACHE.map(migrarProductoAVariantes);
}

function guardarCatalogoStaffStorage(catalogo) {
  guardarCatalogoRepo(catalogo); // async, sin esperar — mismo patrón "fire and forget" que ya tenía este guardado
}

// LOG-01 de la auditoría: antes esto operaba sobre la copia del
// catálogo en memoria de ESTE dispositivo y guardaba con un
// lectura-modificación-escritura optimista de TODO el arreglo — si dos
// cajas tenían abierta la última pieza de una variante casi al mismo
// tiempo, ambas veían éxito y creaban un apartado, dejando dos
// apartados reclamando la misma unidad física. Con Firestore real, el
// descuento ahora ocurre dentro de una transacción (runTransaction)
// SOLO sobre el documento de ese producto — Firestore reintenta la
// transacción si el documento cambió entre la lectura y la escritura,
// así que de dos intentos casi simultáneos sobre la última pieza, la
// segunda transacción vuelve a leer el stock YA en 0 y falla limpio,
// en vez de que ambas crean que tuvieron éxito.
//
// Ahora es asíncrona (regresa una Promise) — quien llama debe esperarla
// antes de crear la pieza del apartado. En modo local/demo (sin
// Firestore real) no hay otro dispositivo con quien pelear el stock, así
// que se queda con el mismo cálculo síncrono de siempre, solo envuelto
// en una Promise para que el contrato sea igual en ambos casos.

// Descuenta 1 pieza de una variante exacta. Falla explícitamente (sin
// tocar nada) si el producto/variante ya no existe o no tiene stock —
// evita apartar una pieza que en realidad ya no hay.
async function descontarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return { ok: true }; // pieza sin producto real vinculado (dato antiguo) — no hay nada que descontar

  if (dbFirestore) {
    try {
      return await dbFirestore.runTransaction(async tx => {
        const ref = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(String(productoId));
        const doc = await tx.get(ref);
        if (!doc.exists) return { ok: false, error: 'Ese producto ya no existe en el catálogo.' };
        const datos = doc.data();
        const variantes = Array.isArray(datos.variantes) ? datos.variantes : [];
        const indice = variantes.findIndex(v => v.id === varianteId);
        if (indice === -1) return { ok: false, error: 'Esa variante ya no existe en el catálogo.' };
        const variante = variantes[indice];
        if (!variante.stock || variante.stock <= 0) {
          return { ok: false, error: `Ya no hay existencia de ${datos.nombre} (${etiquetaVariante(variante)}).` };
        }
        const variantesActualizadas = variantes.map((v, i) => i === indice ? { ...v, stock: v.stock - 1 } : v);
        tx.update(ref, { variantes: variantesActualizadas });
        actualizarVarianteEnCacheLocal(productoId, varianteId, variantesActualizadas.find(v => v.id === varianteId).stock);
        return { ok: true };
      });
    } catch (error) {
      return { ok: false, error: 'No se pudo apartar la pieza: ' + (error && error.message ? error.message : 'error de conexión') + '.' };
    }
  }

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
// una pieza, para que el inventario no quede perdido para siempre. No
// necesita ser transacción (sumar 1 nunca "sobre-restaura" por una
// carrera entre dispositivos de la misma forma en que restar sí puede
// vender de más), pero igual usa FieldValue-free lectura-escritura
// dentro de una transacción corta para no pisar un descuento concurrente
// de la MISMA variante.
async function restaurarStockVariante(productoId, varianteId) {
  if (!productoId || !varianteId) return;

  if (dbFirestore) {
    try {
      await dbFirestore.runTransaction(async tx => {
        const ref = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).doc(String(productoId));
        const doc = await tx.get(ref);
        if (!doc.exists) return;
        const datos = doc.data();
        const variantes = Array.isArray(datos.variantes) ? datos.variantes : [];
        const indice = variantes.findIndex(v => v.id === varianteId);
        if (indice === -1) return;
        const variantesActualizadas = variantes.map((v, i) => i === indice ? { ...v, stock: (v.stock || 0) + 1 } : v);
        tx.update(ref, { variantes: variantesActualizadas });
        actualizarVarianteEnCacheLocal(productoId, varianteId, variantesActualizadas.find(v => v.id === varianteId).stock);
      });
    } catch (error) {
      if (typeof mostrarToast === 'function') mostrarToast('No se pudo restaurar la existencia en el catálogo: ' + (error && error.message ? error.message : 'error de conexión') + '.');
    }
    return;
  }

  const catalogo = obtenerCatalogoStaffStorage();
  const producto = catalogo.find(p => p.id === productoId);
  if (!producto) return;
  const variante = producto.variantes.find(v => v.id === varianteId);
  if (!variante) return;
  variante.stock += 1;
  guardarCatalogoStaffStorage(catalogo);
}

// Refleja en CATALOGO_CACHE (el arreglo en memoria que todo lo demás
// sigue leyendo de forma síncrona) el stock que la transacción de
// arriba ya confirmó en el servidor — para no disparar un resync
// completo del catálogo (guardarCatalogoRepo) por un solo número, que
// además podría pisar cambios concurrentes de OTROS productos hechos
// por otro dispositivo entre la transacción y ese resync.
function actualizarVarianteEnCacheLocal(productoId, varianteId, nuevoStock) {
  if (typeof CATALOGO_CACHE === 'undefined') return;
  const producto = CATALOGO_CACHE.find(p => p.id === productoId);
  const variante = producto?.variantes?.find(v => v.id === varianteId);
  if (variante) variante.stock = nuevoStock;
  try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(CATALOGO_CACHE)); } catch (error) { /* noop */ }
}

function escapeHTMLCatalogoVariantes(texto) {
  return escapeHTML(texto);
}
