// MW JOYERÍA — Fotografías del sitio: modelo de datos
//
// Administra las fotografías fijas del portal (banners, carruseles,
// galerías, fotos de secciones informativas) desde Configuración →
// Fotografías del sitio, para que Admin pueda cambiarlas sin tocar
// HTML/CSS/JS.
//
// El catálogo de espacios (ESPACIOS_FOTOS_SITIO) vive aquí igual que
// antes. Las fotografías en sí (documentos + imagen) ahora viven en
// Firestore — ver js/fotos-sitio-firestore-sync.js (FOTOS_SITIO_CACHE,
// fotosSitioRepoListo) — así una fotografía subida desde cualquier
// dispositivo se ve en todos los demás, incluido el sitio público sin
// sesión. Antes de Firebase, esto vivía en localStorage + un Blob real
// en IndexedDB por dispositivo — nunca salía del navegador donde se
// subió.
//
// Cada fotografía se comprime a JPEG y se embebe directo en su
// documento (mismo criterio que las fotos de producto del Catálogo —
// ver comprimirImagenAProductoDataURL en catalogo-firestore-sync.js —
// para no depender de Firebase Storage, que requiere plan de pago).

const FOTOS_SITIO_TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB — tamaño máximo del ARCHIVO original antes de comprimir
const FOTOS_SITIO_LADO_MAX = 1600; // px del lado más largo, ya comprimida
const FOTOS_SITIO_CALIDAD = 0.75;

// Ruta base calculada a partir de dónde está cargado este script, para
// que el fallback al logo funcione igual en páginas públicas (raíz) que
// en portal/admin/ (dos niveles de profundidad) sin repetir rutas.
const FOTOS_SITIO_BASE_PATH = (function obtenerBasePathFotosSitio() {
  const src = document.currentScript && document.currentScript.src;
  if (!src) return '';
  return src.replace(/js\/fotos-sitio-modelo\.js(\?.*)?$/, '');
})();

const LOGO_MW_FALLBACK_FOTOS_SITIO = FOTOS_SITIO_BASE_PATH + 'assets/images/isotipo-morado.png';

// ============================================================
// CATÁLOGO DE ESPACIOS — inventario de fotografías fijas del portal
// ============================================================
// tipo: 'unica' (un solo slot, se reemplaza) | 'multiple' (galería/carrusel,
// admite N fotos con orden).

const ESPACIOS_FOTOS_SITIO = [
  { seccion: 'inicio', seccionLabel: 'Inicio', ubicacion: 'hero-carousel', ubicacionLabel: 'Carrusel principal', tipo: 'multiple', dondeAparece: 'index.html — banner grande junto al encabezado' },

  { seccion: 'colecciones', seccionLabel: 'Colecciones', ubicacion: 'hero-carousel', ubicacionLabel: 'Carrusel de portada', tipo: 'multiple', dondeAparece: 'colecciones.html — banner del encabezado' },

  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'fachada-interior', ubicacionLabel: 'Fachada o interior del local', tipo: 'unica', dondeAparece: 'nosotros.html — junto al texto de introducción' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'fundadoras', ubicacionLabel: 'Fundadoras / inicios de MW (1 de 2)', tipo: 'unica', dondeAparece: 'nosotros.html — sección "Nuestra historia"' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'fundadoras-2', ubicacionLabel: 'Fundadoras / inicios de MW (2 de 2)', tipo: 'unica', dondeAparece: 'nosotros.html — sección "Nuestra historia"' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'galeria-equipo', ubicacionLabel: 'Galería — Equipo MW', tipo: 'unica', dondeAparece: 'nosotros.html — galería de fotos' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'galeria-taller', ubicacionLabel: 'Galería — Taller / proceso de las piezas', tipo: 'unica', dondeAparece: 'nosotros.html — galería de fotos' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'galeria-eventos', ubicacionLabel: 'Galería — Familia MW en eventos', tipo: 'unica', dondeAparece: 'nosotros.html — galería de fotos' },
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'galeria-emprendedoras', ubicacionLabel: 'Galería — Emprendedoras y líderes MW', tipo: 'unica', dondeAparece: 'nosotros.html — galería de fotos' },

  { seccion: 'plan-mw', seccionLabel: 'Plan MW', ubicacion: 'hero-carousel', ubicacionLabel: 'Carrusel de portada', tipo: 'multiple', dondeAparece: 'ventajas-plan.html — banner del encabezado' },
  { seccion: 'plan-mw', seccionLabel: 'Plan MW', ubicacion: 'recompensa-viaje', ubicacionLabel: 'Foto del viaje de recompensa', tipo: 'unica', dondeAparece: 'ventajas-plan.html — sección "Recompensamos tu esfuerzo"' },

  { seccion: 'contacto', seccionLabel: 'Contacto', ubicacion: 'fachada', ubicacionLabel: 'Fachada del local', tipo: 'unica', dondeAparece: 'contacto.html — galería de 4 fotos' },
  { seccion: 'contacto', seccionLabel: 'Contacto', ubicacion: 'interior', ubicacionLabel: 'Interior / showroom', tipo: 'unica', dondeAparece: 'contacto.html — galería de 4 fotos' },
  { seccion: 'contacto', seccionLabel: 'Contacto', ubicacion: 'exhibidores', ubicacionLabel: 'Exhibidores', tipo: 'unica', dondeAparece: 'contacto.html — galería de 4 fotos' },
  { seccion: 'contacto', seccionLabel: 'Contacto', ubicacion: 'detalle-piezas', ubicacionLabel: 'Detalle de piezas', tipo: 'unica', dondeAparece: 'contacto.html — galería de 4 fotos' }
];

function obtenerEspacioFotoSitio(seccion, ubicacion) {
  return ESPACIOS_FOTOS_SITIO.find(e => e.seccion === seccion && e.ubicacion === ubicacion) || null;
}

function obtenerSeccionesFotosSitio() {
  const vistas = [];
  const claves = new Set();
  ESPACIOS_FOTOS_SITIO.forEach(e => {
    if (claves.has(e.seccion)) return;
    claves.add(e.seccion);
    vistas.push({ seccion: e.seccion, seccionLabel: e.seccionLabel });
  });
  return vistas;
}

// ============================================================
// Compresión de imagen — mismo criterio que catalogo-firestore-sync.js
// ============================================================

function comprimirImagenSitioADataURL(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error || new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > FOTOS_SITIO_LADO_MAX) {
          height = Math.round(height * (FOTOS_SITIO_LADO_MAX / width));
          width = FOTOS_SITIO_LADO_MAX;
        } else if (height > width && height > FOTOS_SITIO_LADO_MAX) {
          width = Math.round(width * (FOTOS_SITIO_LADO_MAX / height));
          height = FOTOS_SITIO_LADO_MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', FOTOS_SITIO_CALIDAD));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// doc.imagenDataUrl ya trae la imagen lista para pintar — esta función
// sigue siendo async (mismo nombre/forma que antes, cuando leía de
// IndexedDB) porque fotos-sitio-render.js y admin-configuracion.js ya
// la usan con await.
async function resolverSrcFotoSitio(doc) {
  return doc && doc.imagenDataUrl ? doc.imagenDataUrl : null;
}

// ============================================================
// COLECCIÓN "fotosSitio" — ver js/fotos-sitio-firestore-sync.js
// ============================================================

function obtenerFotosSitioTodas() {
  return FOTOS_SITIO_CACHE;
}

// Devuelve las fotos de un espacio, ordenadas. Por default solo activas.
function obtenerFotosDeEspacio(seccion, ubicacion, { soloActivas = true } = {}) {
  return obtenerFotosSitioTodas()
    .filter(f => f.seccion === seccion && f.ubicacion === ubicacion && (!soloActivas || f.activa))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function validarArchivoFotoSitio(archivo) {
  if (!archivo) return { ok: false, error: 'Selecciona una imagen.' };
  if (!archivo.type || !archivo.type.startsWith('image/')) {
    return { ok: false, error: 'El archivo debe ser una imagen (JPG, PNG, WEBP, etc.).' };
  }
  if (archivo.size > FOTOS_SITIO_TAMANO_MAXIMO) {
    return { ok: false, error: `La imagen pesa demasiado (máximo ${Math.round(FOTOS_SITIO_TAMANO_MAXIMO / 1024 / 1024)} MB). Comprímela e inténtalo de nuevo.` };
  }
  return { ok: true };
}

// Sube una fotografía nueva para un espacio. Si el espacio es de tipo
// "unica", desactiva (sin borrar) la fotografía activa anterior — así
// nunca se pierde una referencia histórica (requisito 9).
async function subirFotoSitio({ seccion, ubicacion, archivo, actualizadoPor }) {

  const espacio = obtenerEspacioFotoSitio(seccion, ubicacion);
  if (!espacio) return { ok: false, error: 'Espacio no reconocido.' };

  const validacion = validarArchivoFotoSitio(archivo);
  if (!validacion.ok) return validacion;

  let imagenDataUrl;
  try {
    imagenDataUrl = await comprimirImagenSitioADataURL(archivo);
  } catch (error) {
    return { ok: false, error: 'No se pudo procesar esa imagen. Intenta con otra.' };
  }

  const ahora = new Date().toISOString();
  const registros = obtenerFotosSitioTodas();

  if (espacio.tipo === 'unica') {
    const activasAntes = registros.filter(f => f.seccion === seccion && f.ubicacion === ubicacion && f.activa);
    if (activasAntes.length) {
      const cambios = {};
      activasAntes.forEach(f => { cambios[f.id] = { activa: false, fechaActualizacion: ahora }; });
      try {
        await actualizarCamposFotosSitioRepo(cambios);
      } catch (error) {
        return { ok: false, error: 'No se pudo reemplazar la fotografía anterior. Intenta de nuevo.' };
      }
    }
  }

  const fotosMismoEspacio = registros.filter(f => f.seccion === seccion && f.ubicacion === ubicacion);
  const ordenMax = fotosMismoEspacio.reduce((max, f) => Math.max(max, f.orden || 0), -1);

  const nuevoDoc = {
    id: `foto-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    seccion,
    ubicacion,
    nombre: archivo.name || 'fotografía',
    imagenDataUrl,
    orden: espacio.tipo === 'multiple' ? ordenMax + 1 : 0,
    activa: true,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
    actualizadoPor: actualizadoPor || null
  };

  try {
    await guardarFotoSitioRepo(nuevoDoc);
  } catch (error) {
    return { ok: false, error: 'No se pudo guardar la fotografía en el servidor. Revisa tu conexión e intenta de nuevo.' };
  }

  return { ok: true, foto: nuevoDoc };
}

// Elimina (desactiva) una fotografía. Nunca deja el espacio sin nada:
// el helper getImagenSitio/getImagenesSitio regresa automáticamente al
// logo MW en cuanto deja de haber una fotografía activa (requisito 10).
async function eliminarFotoSitio(id, actualizadoPor) {
  const doc = obtenerFotosSitioTodas().find(f => f.id === id);
  if (!doc) return { ok: false, error: 'Fotografía no encontrada.' };

  const cambios = {
    activa: false,
    fechaActualizacion: new Date().toISOString(),
    actualizadoPor: actualizadoPor || doc.actualizadoPor
  };

  try {
    await actualizarCamposFotosSitioRepo({ [id]: cambios });
  } catch (error) {
    return { ok: false, error: 'No se pudo eliminar la fotografía. Revisa tu conexión e intenta de nuevo.' };
  }

  return { ok: true, foto: doc };
}

// Mueve una fotografía un lugar arriba (-1) o abajo (+1) dentro de su
// espacio (solo aplica a espacios tipo "multiple").
async function reordenarFotoSitio(id, direccion, actualizadoPor) {
  const registros = obtenerFotosSitioTodas();
  const doc = registros.find(f => f.id === id);
  if (!doc) return { ok: false, error: 'Fotografía no encontrada.' };

  const delEspacio = registros
    .filter(f => f.seccion === doc.seccion && f.ubicacion === doc.ubicacion && f.activa)
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));

  const indice = delEspacio.findIndex(f => f.id === id);
  const indiceVecino = indice + direccion;
  if (indice === -1 || indiceVecino < 0 || indiceVecino >= delEspacio.length) {
    return { ok: false, error: 'No se puede mover más en esa dirección.' };
  }

  const vecino = delEspacio[indiceVecino];
  const ahora = new Date().toISOString();
  const ordenTemp = doc.orden;

  try {
    await actualizarCamposFotosSitioRepo({
      [doc.id]: { orden: vecino.orden, fechaActualizacion: ahora, actualizadoPor: actualizadoPor || doc.actualizadoPor },
      [vecino.id]: { orden: ordenTemp, fechaActualizacion: ahora }
    });
  } catch (error) {
    return { ok: false, error: 'No se pudo mover la fotografía. Revisa tu conexión e intenta de nuevo.' };
  }

  return { ok: true };
}

// ============================================================
// LÓGICA CENTRAL — obtener la imagen de un espacio (requisito 11)
// ============================================================
// No repetir esta lógica en cada página: siempre pasar por aquí.

async function getImagenSitio(seccion, ubicacion) {
  const activas = obtenerFotosDeEspacio(seccion, ubicacion);
  const doc = activas[0] || null;

  if (doc) {
    try {
      const src = await resolverSrcFotoSitio(doc);
      if (src) return { src, personalizada: true, foto: doc };
    } catch (error) {
      // sigue al fallback
    }
  }

  return { src: LOGO_MW_FALLBACK_FOTOS_SITIO, personalizada: false, foto: null };
}

// Para espacios tipo "multiple" (carruseles/galerías). Nunca regresa una
// lista vacía: si no hay fotos activas, regresa un único elemento con el
// logo MW para que el carrusel siempre tenga al menos una diapositiva.
async function getImagenesSitio(seccion, ubicacion) {
  const activas = obtenerFotosDeEspacio(seccion, ubicacion);

  const resueltas = [];
  for (const doc of activas) {
    try {
      const src = await resolverSrcFotoSitio(doc);
      if (src) resueltas.push({ src, personalizada: true, foto: doc });
    } catch (error) {
      // esta foto en particular falló — se omite, no rompe el resto
    }
  }

  if (resueltas.length === 0) {
    return [{ src: LOGO_MW_FALLBACK_FOTOS_SITIO, personalizada: false, foto: null }];
  }

  return resueltas;
}
