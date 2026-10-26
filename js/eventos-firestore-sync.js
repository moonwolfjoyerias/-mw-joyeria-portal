// MW JOYERÍA — Repositorio de Eventos del calendario (Firebase)
//
// Antes js/eventos-modelo.js guardaba el calendario completo en
// localStorage ("mw-eventos-v1") — un evento agregado desde la
// computadora de la tienda nunca aparecía en el celular de otra
// cuenta interna, y cada dispositivo tenía su propio calendario.
//
// Mismo patrón "caché + cargador asíncrono + escritor" que ya usan
// js/catalogo-firestore-sync.js y el resto de dominios migrados:
// EVENTOS_CACHE vive en memoria, se llena una vez desde la colección
// "eventos" de Firestore, y js/eventos-modelo.js sigue exponiendo las
// mismas dos funciones de siempre (cargarEventosCompartidos/
// guardarEventosCompartidos) para que ninguna página que ya las usa
// tenga que cambiar cómo las llama — solo esperar `eventosRepoListo`
// una vez antes de su primer render, igual que ya hace
// catalogoRepoListo.
//
// Se carga DESPUÉS de js/firebase-init.js y de eventos-ejemplo.js (la
// semilla de respaldo) y ANTES de js/eventos-modelo.js — ver el
// <script> de cada página.

const EVENTOS_COLECCION_FIRESTORE = 'eventos';
const EVENTOS_META_COLECCION = 'eventosMeta';
const EVENTOS_META_DOC_ID = 'estado';
const EVENTOS_STORAGE_KEY = 'mw-eventos-v1';

let EVENTOS_CACHE = [];

// Opción A + en vivo (convivencia con BRILLO MW, que también maneja el
// calendario en esta misma colección). Igual que
// lista-deseos-firestore-sync.js:
// - Se recuerda cómo estaba cada evento en el servidor y al guardar se
//   envía SOLO lo que cambió aquí; solo se borra lo que esta página
//   conocía y quitó, nunca un evento que no conoce.
// - onSnapshot aplica lo que cambie BRILLO u otro dispositivo sobre el
//   mismo arreglo en memoria y avisa a la pantalla
//   ('mw:eventos-actualizados') para que se vuelva a pintar sola.
// - Una copia atrasada de un evento no se vuelve a enviar, y lo que llegó
//   en vivo no se borra por no venir en un arreglo viejo.
const _evEnServidor = new Map();
const _evVersionesSuperadas = new Map();
const _evRecibidosEnVivo = new Set();
let _evEnServidorCargado = false;
let _escuchaEventosActiva = false;

function _evRecordarServidor(eventos) {
  _evEnServidor.clear();
  eventos.forEach(ev => _evEnServidor.set(String(ev.id), textoEstableFirestore(ev)));
  _evEnServidorCargado = true;
}

function _evSuperar(id, texto) {
  if (!texto) return;
  if (!_evVersionesSuperadas.has(id)) _evVersionesSuperadas.set(id, new Set());
  _evVersionesSuperadas.get(id).add(texto);
}

function _evAplicarEnVivo(snap) {
  let huboCambios = false;
  snap.docChanges().forEach(cambio => {
    const id = String(cambio.doc.id);
    const antes = _evEnServidor.get(id);
    const i = EVENTOS_CACHE.findIndex(ev => String(ev.id) === id);
    const local = i >= 0 ? EVENTOS_CACHE[i] : null;
    const cambioPendiente = local && textoEstableFirestore(local) !== antes;
    if (cambio.type === 'removed') {
      if (antes === undefined) return;
      _evSuperar(id, antes);
      _evEnServidor.delete(id);
      if (local && !cambioPendiente) { EVENTOS_CACHE.splice(i, 1); huboCambios = true; }
      return;
    }
    const ev = { ...cambio.doc.data(), id: cambio.doc.id };
    const texto = textoEstableFirestore(ev);
    if (texto === antes) return;
    if (antes === undefined && !local) _evRecibidosEnVivo.add(id);
    _evSuperar(id, antes);
    _evEnServidor.set(id, texto);
    if (cambioPendiente) return;
    if (local) EVENTOS_CACHE[i] = ev; else EVENTOS_CACHE.unshift(ev);
    huboCambios = true;
  });
  if (!huboCambios) return;
  try { localStorage.setItem(EVENTOS_STORAGE_KEY, JSON.stringify(EVENTOS_CACHE)); } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:eventos-actualizados'));
}

function escucharEventosEnVivo() {
  if (!dbFirestore || _escuchaEventosActiva) return;
  _escuchaEventosActiva = true;
  // Si la escucha falla (sin sesión, sin red) la página sigue como antes:
  // con lo que cargó.
  dbFirestore.collection(EVENTOS_COLECCION_FIRESTORE).onSnapshot(_evAplicarEnVivo, () => {});
}

// Un arreglo armado antes de un cambio en vivo: sus copias atrasadas se
// cambian por la versión actual y lo que llegó en vivo y no trae se
// conserva, para que la pantalla no muestre datos viejos.
function _evConservarRecibidos(eventos) {
  if (eventos === EVENTOS_CACHE) return eventos;
  const actuales = new Map(EVENTOS_CACHE.map(ev => [String(ev.id), ev]));
  eventos.forEach((ev, i) => {
    const id = String(ev.id);
    if (_evVersionesSuperadas.has(id) && _evVersionesSuperadas.get(id).has(textoEstableFirestore(ev)) && actuales.has(id)) eventos[i] = actuales.get(id);
  });
  if (_evRecibidosEnVivo.size) {
    const ids = new Set(eventos.map(ev => String(ev.id)));
    EVENTOS_CACHE.forEach(ev => {
      if (_evRecibidosEnVivo.has(String(ev.id)) && !ids.has(String(ev.id))) eventos.push(ev);
    });
  }
  return eventos;
}

function eventosSemillaLocal() {
  return (typeof EVENTOS_EJEMPLO !== 'undefined' ? EVENTOS_EJEMPLO : []).map(ev => ({ ...ev }));
}

function eventosDesdeLocalStorage() {
  try {
    const guardados = JSON.parse(localStorage.getItem(EVENTOS_STORAGE_KEY));
    if (Array.isArray(guardados)) return guardados;
  } catch (error) {
    // sigue abajo
  }
  return eventosSemillaLocal();
}

async function cargarEventosRepo() {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection(EVENTOS_COLECCION_FIRESTORE).get();
      if (!snap.empty) {
        EVENTOS_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        _evRecordarServidor(EVENTOS_CACHE);
        escucharEventosEnVivo();
      } else {
        // Colección vacía: puede ser la primera vez que este proyecto
        // recibe el calendario, O alguien borró todos los eventos a
        // propósito. eventosMeta/estado distingue los dos casos —
        // mismo criterio que catalogoMeta/apartadosMeta.
        const meta = await dbFirestore.collection(EVENTOS_META_COLECCION).doc(EVENTOS_META_DOC_ID).get();
        if (meta.exists) {
          EVENTOS_CACHE = [];
          _evRecordarServidor(EVENTOS_CACHE);
          escucharEventosEnVivo();
        } else {
          EVENTOS_CACHE = eventosSemillaLocal();
          await guardarEventosRepo(EVENTOS_CACHE);
        }
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que
      // haya en local: podría resucitar eventos ya eliminados en otro
      // dispositivo. Se avisa y se deja vacío.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar el calendario desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      EVENTOS_CACHE = [];
    }
  } else {
    EVENTOS_CACHE = eventosDesdeLocalStorage();
    try { localStorage.setItem(EVENTOS_STORAGE_KEY, JSON.stringify(EVENTOS_CACHE)); } catch (error) { /* noop */ }
  }
  return EVENTOS_CACHE;
}

// Mismo patrón que guardarCatalogoRepo: guarda siempre en localStorage
// como caché/respaldo, y si hay Firestore real, sincroniza la
// colección completa (agrega/actualiza/borra). Cada controlador llama
// esto sin esperar — `_colaGuardadoEventos` evita que varios guardados
// casi simultáneos (agregar, luego editar) se pisen entre sí.
let _colaGuardadoEventos = Promise.resolve();

async function guardarEventosRepo(eventos) {
  eventos = _evConservarRecibidos(eventos);
  EVENTOS_CACHE = eventos;
  try { localStorage.setItem(EVENTOS_STORAGE_KEY, JSON.stringify(eventos)); } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  const tarea = _colaGuardadoEventos.then(() => sincronizarEventosConFirestore(eventos).catch(() => {}));
  _colaGuardadoEventos = tarea;
  return tarea;
}

async function sincronizarEventosConFirestore(eventos) {
  const coleccion = dbFirestore.collection(EVENTOS_COLECCION_FIRESTORE);
  // Opción A: solo lo que cambió aquí; solo se borra lo que esta página
  // conocía y quitó (nunca un evento creado en BRILLO u otro dispositivo).
  const batch = dbFirestore.batch();
  const escritos = new Map();
  eventos.forEach(ev => {
    const id = String(ev.id);
    const texto = textoEstableFirestore(ev);
    if (_evEnServidor.get(id) === texto) return;
    if (_evVersionesSuperadas.has(id) && _evVersionesSuperadas.get(id).has(texto)) return;
    batch.set(coleccion.doc(id), ev);
    escritos.set(id, texto);
  });
  const idsNuevos = new Set(eventos.map(ev => String(ev.id)));
  const borrados = [];
  _evEnServidor.forEach((texto, id) => {
    if (!idsNuevos.has(id) && !_evRecibidosEnVivo.has(id)) {
      batch.delete(coleccion.doc(id));
      borrados.push(id);
    }
  });
  // El marcador "ya se sembró" solo hace falta la primera vez.
  const primeraVez = !_evEnServidorCargado;
  if (primeraVez) {
    batch.set(dbFirestore.collection(EVENTOS_META_COLECCION).doc(EVENTOS_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritos.size && !borrados.length && !primeraVez) return;
  try {
    await batch.commit();
    escritos.forEach((texto, id) => _evEnServidor.set(id, texto));
    borrados.forEach(id => _evEnServidor.delete(id));
    _evEnServidorCargado = true;
  } catch (error) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar el calendario: ' + (error && error.message ? error.message : 'error desconocido') + '. Ningún cambio de este guardado se aplicó.');
    }
    throw error;
  }
}

// Reduce la foto destacada de un evento a un tamaño que quepa cómodo
// en un documento de Firestore — mismo criterio que
// comprimirImagenAProductoDataURL (catalogo-firestore-sync.js) y
// comprimirImagenSitioADataURL (fotos-sitio-modelo.js). Un poco más
// grande que la de producto porque aquí es la imagen principal del
// evento, no una miniatura.
const EVENTOS_IMAGEN_LADO_MAX = 1200;
const EVENTOS_IMAGEN_CALIDAD = 0.75;

function comprimirImagenEventoADataURL(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error || new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > EVENTOS_IMAGEN_LADO_MAX) {
          height = Math.round(height * (EVENTOS_IMAGEN_LADO_MAX / width));
          width = EVENTOS_IMAGEN_LADO_MAX;
        } else if (height > width && height > EVENTOS_IMAGEN_LADO_MAX) {
          width = Math.round(width * (EVENTOS_IMAGEN_LADO_MAX / height));
          height = EVENTOS_IMAGEN_LADO_MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', EVENTOS_IMAGEN_CALIDAD));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// Cada página espera esto UNA vez antes de su primer render.
const eventosRepoListo = cargarEventosRepo();
