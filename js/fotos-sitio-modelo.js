// MW JOYERÍA — Fotografías del sitio: modelo de datos
//
// Administra las fotografías fijas del portal (banners, carruseles,
// galerías, fotos de secciones informativas) desde Configuración →
// Fotografías del sitio, para que Admin pueda cambiarlas sin tocar
// HTML/CSS/JS.
//
// ⚠️ TEMPORAL: localStorage simula la colección "fotosSitio" de Firestore
// (mismo patrón que el resto del portal). El ARCHIVO de cada fotografía
// (los bytes de la imagen) NO se guarda como Base64 dentro de ese
// "documento" — se guarda como Blob real en IndexedDB, simulando Firebase
// Storage. El documento solo conserva la referencia (storagePath) igual
// que pasaría con Storage real. Migrar a Firebase en Fase 3 significa
// cambiar subirBlobFotoSitio/obtenerBlobFotoSitio/eliminarBlobFotoSitio
// por llamadas reales a Storage — la forma del documento no cambia.

const FOTOS_SITIO_STORAGE_KEY = 'mw-fotos-sitio-v1';
const FOTOS_SITIO_DB_NOMBRE = 'mw-fotos-sitio-db';
const FOTOS_SITIO_DB_VERSION = 1;
const FOTOS_SITIO_DB_STORE = 'archivos';
const FOTOS_SITIO_TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB — "tamaño razonable" (requisito 18)

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
  { seccion: 'nosotros', seccionLabel: 'Nosotros', ubicacion: 'fundadoras', ubicacionLabel: 'Fundadoras / inicios de MW', tipo: 'unica', dondeAparece: 'nosotros.html — sección "Nuestra historia"' },
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
// IndexedDB — almacenamiento de los archivos (simula Storage)
// ============================================================

let _fotosSitioDbPromise = null;

function abrirDBFotosSitio() {
  if (_fotosSitioDbPromise) return _fotosSitioDbPromise;
  _fotosSitioDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const solicitud = indexedDB.open(FOTOS_SITIO_DB_NOMBRE, FOTOS_SITIO_DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(FOTOS_SITIO_DB_STORE)) {
        db.createObjectStore(FOTOS_SITIO_DB_STORE);
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
  return _fotosSitioDbPromise;
}

async function guardarBlobFotoSitio(storagePath, blob) {
  const db = await abrirDBFotosSitio();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_SITIO_DB_STORE, 'readwrite');
    tx.objectStore(FOTOS_SITIO_DB_STORE).put(blob, storagePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function obtenerBlobFotoSitio(storagePath) {
  const db = await abrirDBFotosSitio();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_SITIO_DB_STORE, 'readonly');
    const solicitud = tx.objectStore(FOTOS_SITIO_DB_STORE).get(storagePath);
    solicitud.onsuccess = () => resolve(solicitud.result || null);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function eliminarBlobFotoSitio(storagePath) {
  const db = await abrirDBFotosSitio();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FOTOS_SITIO_DB_STORE, 'readwrite');
    tx.objectStore(FOTOS_SITIO_DB_STORE).delete(storagePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Cache de object URLs ya creados en esta sesión de página, para no
// generar uno nuevo (y filtrarlo) cada vez que se pinta el mismo espacio.
const _fotosSitioUrlCache = new Map();

async function resolverSrcFotoSitio(doc) {
  if (_fotosSitioUrlCache.has(doc.storagePath)) {
    return _fotosSitioUrlCache.get(doc.storagePath);
  }
  const blob = await obtenerBlobFotoSitio(doc.storagePath);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  _fotosSitioUrlCache.set(doc.storagePath, url);
  return url;
}

// ============================================================
// COLECCIÓN "fotosSitio" (documentos, simula Firestore)
// ============================================================

function obtenerFotosSitioTodas() {
  try {
    const registros = JSON.parse(localStorage.getItem(FOTOS_SITIO_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function guardarFotosSitioTodas(registros) {
  localStorage.setItem(FOTOS_SITIO_STORAGE_KEY, JSON.stringify(registros));
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

  const registros = obtenerFotosSitioTodas();
  const storagePath = `fotos-sitio/${seccion}/${ubicacion}/${Date.now()}-${Math.round(Math.random() * 1e6)}`;

  try {
    await guardarBlobFotoSitio(storagePath, archivo);
  } catch (error) {
    return { ok: false, error: 'No se pudo guardar la imagen en este navegador.' };
  }

  const ahora = new Date().toISOString();

  if (espacio.tipo === 'unica') {
    registros.forEach(f => {
      if (f.seccion === seccion && f.ubicacion === ubicacion && f.activa) {
        f.activa = false;
        f.fechaActualizacion = ahora;
      }
    });
  }

  const fotosMismoEspacio = registros.filter(f => f.seccion === seccion && f.ubicacion === ubicacion);
  const ordenMax = fotosMismoEspacio.reduce((max, f) => Math.max(max, f.orden || 0), -1);

  const nuevoDoc = {
    id: `foto-${Date.now()}-${Math.round(Math.random() * 1e6)}`,
    seccion,
    ubicacion,
    nombre: archivo.name || 'fotografía',
    storagePath,
    tipoArchivo: archivo.type,
    tamanoBytes: archivo.size,
    orden: espacio.tipo === 'multiple' ? ordenMax + 1 : 0,
    activa: true,
    fechaCreacion: ahora,
    fechaActualizacion: ahora,
    actualizadoPor: actualizadoPor || null
  };

  registros.push(nuevoDoc);
  guardarFotosSitioTodas(registros);

  return { ok: true, foto: nuevoDoc };
}

// Elimina (desactiva) una fotografía. Nunca deja el espacio sin nada:
// el helper getImagenSitio/getImagenesSitio regresa automáticamente al
// logo MW en cuanto deja de haber una fotografía activa (requisito 10).
function eliminarFotoSitio(id, actualizadoPor) {
  const registros = obtenerFotosSitioTodas();
  const doc = registros.find(f => f.id === id);
  if (!doc) return { ok: false, error: 'Fotografía no encontrada.' };

  doc.activa = false;
  doc.fechaActualizacion = new Date().toISOString();
  doc.actualizadoPor = actualizadoPor || doc.actualizadoPor;
  guardarFotosSitioTodas(registros);

  return { ok: true, foto: doc };
}

// Mueve una fotografía un lugar arriba (-1) o abajo (+1) dentro de su
// espacio (solo aplica a espacios tipo "multiple").
function reordenarFotoSitio(id, direccion, actualizadoPor) {
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
  const ordenTemp = doc.orden;
  doc.orden = vecino.orden;
  vecino.orden = ordenTemp;
  doc.fechaActualizacion = new Date().toISOString();
  vecino.fechaActualizacion = doc.fechaActualizacion;
  doc.actualizadoPor = actualizadoPor || doc.actualizadoPor;

  guardarFotosSitioTodas(registros);
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
