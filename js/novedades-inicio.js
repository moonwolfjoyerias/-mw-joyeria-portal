// MW JOYERÍA — "Nuevas piezas" en el Inicio de Emprendedora/Líder
//
// Pedido: que en el Inicio de las e/l aparezcan las fotos de los
// productos nuevos. Llena el carrusel del banner "Recién llegado"
// (#novedadesCarrusel) con la foto real de las piezas más recientes que
// tienen existencia; si todavía no hay ninguna con foto, el banner se
// queda con sus fondos decorativos de siempre.
//
// Cuota de Firestore: este Inicio lo abren todas las e/l varias veces
// al día, así que NUNCA lee el catálogo completo (con 3,000 piezas
// serían 3,000 lecturas por visita). Pide a Firestore solo los
// NOVEDADES_INICIO_CONSULTA productos más nuevos (por fechaAlta — ver
// completarFechaAltaCatalogo en catalogo-variantes-modelo.js) y guarda
// el resultado NOVEDADES_INICIO_VIGENCIA_MS en este dispositivo, para
// que volver al Inicio no vuelva a leer nada.

const NOVEDADES_INICIO_CONSULTA = 8;
const NOVEDADES_INICIO_MAX = 6;
const NOVEDADES_INICIO_VIGENCIA_MS = 20 * 60 * 1000;
const NOVEDADES_INICIO_CACHE_KEY = 'mw_novedades_inicio';

function _novedadesDesdeCache() {
  try {
    const guardado = JSON.parse(localStorage.getItem(NOVEDADES_INICIO_CACHE_KEY));
    if (guardado && Array.isArray(guardado.piezas) && Date.now() - guardado.fecha < NOVEDADES_INICIO_VIGENCIA_MS) {
      return guardado.piezas;
    }
  } catch (error) {
    // sigue abajo
  }
  return null;
}

function _guardarNovedadesEnCache(piezas) {
  try {
    localStorage.setItem(NOVEDADES_INICIO_CACHE_KEY, JSON.stringify({ fecha: Date.now(), piezas }));
  } catch (error) {
    // Sin espacio en localStorage (las fotos pesan) — solo no se guarda.
  }
}

// Ruta de la foto vista desde /portal/<rol>/ — mismo criterio que
// normalizarImagenProducto en catalogo.js.
function _rutaFotoNovedad(src) {
  if (src.startsWith('../assets/')) return `../../${src.slice(3)}`;
  return src;
}

function _piezaNovedad(producto) {
  if (stockTotalProducto(producto) <= 0) return null;
  const foto = fotoPrincipalProducto(producto);
  if (!foto || /isotipo-morado\.png/.test(foto)) return null;
  return {
    id: producto.id,
    nombre: producto.nombre || '',
    precio: precioConDescuento(producto),
    foto: _rutaFotoNovedad(foto)
  };
}

async function obtenerNovedadesInicio() {
  const enCache = _novedadesDesdeCache();
  if (enCache) return enCache;

  let productos = [];
  if (typeof dbFirestore !== 'undefined' && dbFirestore) {
    const snap = await dbFirestore.collection('productos')
      .orderBy('fechaAlta', 'desc')
      .limit(NOVEDADES_INICIO_CONSULTA)
      .get();
    productos = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  } else {
    // Modo demo: el catálogo de prueba vive en localStorage.
    try { productos = JSON.parse(localStorage.getItem('mw_staff_catalogo_demo')) || []; } catch (error) { productos = []; }
    productos = productos
      .filter(p => p.fechaAlta)
      .sort((a, b) => String(b.fechaAlta).localeCompare(String(a.fechaAlta)))
      .slice(0, NOVEDADES_INICIO_CONSULTA);
  }

  const piezas = productos.map(_piezaNovedad).filter(Boolean).slice(0, NOVEDADES_INICIO_MAX);
  _guardarNovedadesEnCache(piezas);
  return piezas;
}

function renderNovedadesInicio(piezas) {
  const carrusel = document.getElementById('novedadesCarrusel');
  if (!carrusel || !piezas.length) return;

  const fondos = [
    'linear-gradient(155deg, var(--mw-lilac-soft) 0%, var(--mw-cream) 55%, var(--mw-gold-soft) 100%)',
    'linear-gradient(155deg, var(--mw-gold-soft) 0%, var(--mw-cream) 55%, var(--mw-lilac-soft) 100%)',
    'linear-gradient(155deg, var(--mw-cream) 0%, var(--mw-lilac-soft) 55%, var(--mw-gold-soft) 100%)'
  ];

  carrusel.innerHTML = piezas.map((p, i) => `
    <div class="carousel-slide novedad-slide${i === 0 ? ' active' : ''}" style="background:${fondos[i % fondos.length]};">
      <figure class="novedad-figura">
        <img src="${escapeAttribute(p.foto)}" alt="${escapeAttribute(p.nombre)}" loading="lazy">
        <figcaption>
          <span class="novedad-nombre">${escapeHTML(p.nombre)}</span>
          <span class="novedad-precio">$${Number(p.precio).toLocaleString('es-MX')} MXN</span>
        </figcaption>
      </figure>
    </div>
  `).join('') + (piezas.length > 1
    ? `<div class="carousel-dots novedad-dots">${piezas.map((_, i) => `<span class="dot${i === 0 ? ' active' : ''}"></span>`).join('')}</div>`
    : '');

  const banner = carrusel.closest('.promo-banner');
  if (banner) banner.classList.add('con-novedades');

  if (typeof initCarousel === 'function') initCarousel(carrusel);
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!document.getElementById('novedadesCarrusel')) return;
  try {
    renderNovedadesInicio(await obtenerNovedadesInicio());
  } catch (error) {
    // Sin novedades (red, cuota, reglas) el banner se queda con sus
    // fondos decorativos — nunca debe tronar el resto del Inicio.
  }
});
