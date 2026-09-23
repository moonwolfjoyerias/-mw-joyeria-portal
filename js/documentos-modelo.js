// MW JOYERÍA — Almacenamiento de documentos sensibles (INE de Solicitudes
// de inscripción)
//
// Mismo patrón que js/fotos-sitio-modelo.js (IndexedDB guarda el archivo
// real; el documento de la "colección" solo guarda una referencia), pero
// en su propia base — un documento de identidad es más sensible que una
// foto decorativa del sitio y no debe mezclarse con esa base.
//
// Antes, la foto de la INE se convertía a base64 (FileReader.readAsDataURL)
// y quedaba embebida completa dentro del registro de la solicitud en
// localStorage — cualquiera con acceso a ese almacenamiento podía leerla,
// y un campo así de pesado no cabría en un documento de Firestore (límite
// de 1MB). Ahora el registro de la solicitud solo guarda dos RUTAS
// (`ineFrenteUrl`/`ineReversoUrl`, ver js/solicitudes-modelo.js) — el
// archivo real vive aparte.
//
// FASE 2 (Firebase): si js/firebase-init.js dejó `storageFirebase` con
// valor (MODO_DEMO=false + config real), estas funciones suben/leen/
// borran el archivo en Firebase Storage bajo esa misma ruta. Si no,
// siguen usando IndexedDB para simularlo — mismo comportamiento en modo
// demo, cero regresión. La forma de la ruta ("solicitudes-ine/...") no
// cambia entre uno u otro, así que ineFrenteUrl/ineReversoUrl nunca
// necesitan migrarse.

const DOCUMENTOS_DB_NOMBRE = 'mw-documentos-db';
const DOCUMENTOS_DB_VERSION = 1;
const DOCUMENTOS_DB_STORE = 'archivos';

let _documentosDbPromise = null;

function abrirDBDocumentos() {
  if (_documentosDbPromise) return _documentosDbPromise;
  _documentosDbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'));
      return;
    }
    const solicitud = indexedDB.open(DOCUMENTOS_DB_NOMBRE, DOCUMENTOS_DB_VERSION);
    solicitud.onupgradeneeded = () => {
      const db = solicitud.result;
      if (!db.objectStoreNames.contains(DOCUMENTOS_DB_STORE)) {
        db.createObjectStore(DOCUMENTOS_DB_STORE);
      }
    };
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
  return _documentosDbPromise;
}

async function guardarBlobDocumento(storagePath, blob) {
  if (storageFirebase) {
    await storageFirebase.ref(storagePath).put(blob);
    return;
  }
  const db = await abrirDBDocumentos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENTOS_DB_STORE, 'readwrite');
    tx.objectStore(DOCUMENTOS_DB_STORE).put(blob, storagePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Solo aplica al respaldo de IndexedDB — Firebase Storage no expone el
// blob directo del mismo modo (ver resolverSrcDocumento, que sí cubre
// ambos casos con una URL para <img src>).
async function obtenerBlobDocumento(storagePath) {
  const db = await abrirDBDocumentos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENTOS_DB_STORE, 'readonly');
    const solicitud = tx.objectStore(DOCUMENTOS_DB_STORE).get(storagePath);
    solicitud.onsuccess = () => resolve(solicitud.result || null);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

async function eliminarBlobDocumento(storagePath) {
  if (storageFirebase) {
    await storageFirebase.ref(storagePath).delete();
    return;
  }
  const db = await abrirDBDocumentos();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCUMENTOS_DB_STORE, 'readwrite');
    tx.objectStore(DOCUMENTOS_DB_STORE).delete(storagePath);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Cache de object URLs / URLs de descarga ya resueltas en esta sesión de
// página (mismo motivo que fotos-sitio-modelo.js: no volver a pedirla
// cada vez que se pinta la misma vista previa).
const _documentosUrlCache = new Map();

async function resolverSrcDocumento(storagePath) {
  if (!storagePath) return null;
  if (_documentosUrlCache.has(storagePath)) return _documentosUrlCache.get(storagePath);
  if (storageFirebase) {
    try {
      const url = await storageFirebase.ref(storagePath).getDownloadURL();
      _documentosUrlCache.set(storagePath, url);
      return url;
    } catch (error) {
      return null;
    }
  }
  const blob = await obtenerBlobDocumento(storagePath);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  _documentosUrlCache.set(storagePath, url);
  return url;
}

// permitirPdf: la carátula de CLABE (Mi cuenta de Líder) acepta foto
// O documento PDF, a diferencia de la INE de Solicitudes (solo foto).
function validarArchivoDocumento(archivo, { tamanoMaximo = 5 * 1024 * 1024, permitirPdf = false } = {}) {
  if (!archivo) return { ok: false, error: 'Selecciona un archivo.' };
  const esImagen = archivo.type && archivo.type.startsWith('image/');
  const esPdf = permitirPdf && archivo.type === 'application/pdf';
  if (!esImagen && !esPdf) {
    return { ok: false, error: permitirPdf ? 'El archivo debe ser una imagen o un PDF.' : 'El archivo debe ser una imagen (JPG, PNG, etc.).' };
  }
  if (archivo.size > tamanoMaximo) {
    return { ok: false, error: `El archivo pesa demasiado (máximo ${Math.round(tamanoMaximo / 1024 / 1024)} MB). Comprímelo e inténtalo de nuevo.` };
  }
  return { ok: true };
}
