// MW JOYERÍA — Repositorio de Fotografías del sitio (Firebase)
//
// Antes js/fotos-sitio-modelo.js guardaba cada fotografía como un Blob
// en IndexedDB y su metadata (sección/ubicación/orden/activa) en
// localStorage — ambos exclusivos del navegador donde Admin subió la
// foto. Eso significaba que una fotografía subida desde la computadora
// de la tienda NUNCA aparecía en el celular de Admin ni en el de ningún
// visitante público: cada dispositivo tenía su propia colección vacía.
//
// Este archivo es el mismo patrón "caché + cargador asíncrono +
// escritor" que ya usan js/catalogo-firestore-sync.js y el resto de
// dominios migrados: FOTOS_SITIO_CACHE vive en memoria, se llena una
// vez desde la colección "fotosSitio" de Firestore, y cada fotografía
// se guarda como UN documento (no como un arreglo completo que se
// reescribe entero) — a diferencia de Catálogo/Cuentas, aquí la unidad
// natural es "una fotografía" (subir una, eliminar una, mover una), y
// cada documento ya trae su propia imagen embebida (ver
// comprimirImagenSitioADataURL) — reescribir TODAS las fotografías del
// sitio en un solo batch cada vez que se sube o mueve una sola sería
// lento y pesado sin necesidad.
//
// Se carga DESPUÉS de js/firebase-init.js y ANTES de
// js/fotos-sitio-modelo.js — ver el <script> de cada página.

const FOTOS_SITIO_COLECCION_FIRESTORE = 'fotosSitio';
const FOTOS_SITIO_STORAGE_KEY_CACHE = 'mw-fotos-sitio-cache-v1';

let FOTOS_SITIO_CACHE = [];

function fotosSitioDesdeLocalStorageCache() {
  try {
    const guardado = JSON.parse(localStorage.getItem(FOTOS_SITIO_STORAGE_KEY_CACHE));
    if (Array.isArray(guardado)) return guardado;
  } catch (error) {
    // sigue abajo
  }
  return [];
}

function guardarFotosSitioCacheLocal() {
  try { localStorage.setItem(FOTOS_SITIO_STORAGE_KEY_CACHE, JSON.stringify(FOTOS_SITIO_CACHE)); } catch (error) { /* noop */ }
}

async function cargarFotosSitioRepo() {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection(FOTOS_SITIO_COLECCION_FIRESTORE).get();
      FOTOS_SITIO_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      guardarFotosSitioCacheLocal();
    } catch (error) {
      // La consulta falló (reglas, red) — no se rellena con lo que haya
      // en local: mismo motivo ya documentado en catalogo-firestore-sync.js
      // (podría mostrar fotografías ya eliminadas en otro dispositivo, o
      // nunca mostrar una eliminada de verdad). Se deja vacío — cada
      // espacio cae automáticamente en el logo MW mientras tanto.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudieron cargar las fotografías del sitio. Revisa tu conexión y vuelve a cargar la página.');
      }
      FOTOS_SITIO_CACHE = [];
    }
  } else {
    // Sin Firebase real configurado (modo demo): respaldo local, igual
    // que el resto del portal en ese modo.
    FOTOS_SITIO_CACHE = fotosSitioDesdeLocalStorageCache();
  }
  return FOTOS_SITIO_CACHE;
}

// Sube o reemplaza UNA fotografía completa (incluye su imagen). Usado
// solo al subir una fotografía nueva — el documento ya trae todos sus
// campos armados (ver subirFotoSitio en fotos-sitio-modelo.js).
async function guardarFotoSitioRepo(doc) {
  const existe = FOTOS_SITIO_CACHE.some(f => f.id === doc.id);
  FOTOS_SITIO_CACHE = existe
    ? FOTOS_SITIO_CACHE.map(f => (f.id === doc.id ? doc : f))
    : [...FOTOS_SITIO_CACHE, doc];
  guardarFotosSitioCacheLocal();

  if (!dbFirestore) return;
  try {
    await dbFirestore.collection(FOTOS_SITIO_COLECCION_FIRESTORE).doc(doc.id).set(doc);
  } catch (error) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar la fotografía: ' + (error && error.message ? error.message : 'error desconocido') + '.');
    }
    throw error;
  }
}

// Actualiza SOLO los campos indicados de una o varias fotografías ya
// existentes (eliminar = desactivar, reordenar = intercambiar "orden")
// — nunca reenvía la imagen completa de nuevo. `cambiosPorId` es
// { [id]: { campo: valor, ... }, ... }.
async function actualizarCamposFotosSitioRepo(cambiosPorId) {
  Object.entries(cambiosPorId).forEach(([id, cambios]) => {
    const doc = FOTOS_SITIO_CACHE.find(f => f.id === id);
    if (doc) Object.assign(doc, cambios);
  });
  guardarFotosSitioCacheLocal();

  if (!dbFirestore) return;
  try {
    const batch = dbFirestore.batch();
    Object.entries(cambiosPorId).forEach(([id, cambios]) => {
      batch.update(dbFirestore.collection(FOTOS_SITIO_COLECCION_FIRESTORE).doc(id), cambios);
    });
    await batch.commit();
  } catch (error) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar el cambio: ' + (error && error.message ? error.message : 'error desconocido') + '.');
    }
    throw error;
  }
}

// Cada página espera esto UNA vez antes de su primer uso.
const fotosSitioRepoListo = cargarFotosSitioRepo();
