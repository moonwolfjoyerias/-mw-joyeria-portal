// MW JOYERÍA — Repositorio de Catálogo (Fase 2: Firebase)
//
// Punto único de lectura/escritura para TODO lo que hoy comparte la
// clave localStorage "mw_staff_catalogo_demo": el catálogo de mayoreo
// público (catalogo.js), las 3 páginas de gestión
// (staff/encargado/admin-catalogo.js) y el descuento/restauración de
// stock que usa Apartados (obtenerCatalogoStaffStorage/
// guardarCatalogoStaffStorage en catalogo-variantes-modelo.js).
//
// Se carga DESPUÉS de js/firebase-init.js y del *-catalogo-ejemplo.js
// de cada página (para tener la semilla de respaldo si hace falta) y
// ANTES de catalogo-variantes-modelo.js y de cualquier controlador de
// catálogo — ver el <script> de cada página.
//
// Los consumidores siguen leyendo de forma SÍNCRONA (misma API de
// siempre) contra `CATALOGO_CACHE`, un arreglo en memoria que este
// archivo llena de forma asíncrona apenas se carga (desde Firestore si
// hay config real, si no desde localStorage igual que siempre). Cada
// página espera una vez la promesa `catalogoRepoListo` antes de su
// primer render — igual que ya hace solicitudes-modelo.js con sus
// consultas — así nunca se pinta con el arreglo todavía vacío.
//
// Nota (DUP-01 y DUP-02 de la auditoría, ya corregidos): llegó a haber
// DOS semillas distintas con el mismo nombre CATALOGO_EJEMPLO —catalogo-
// productos-ejemplo.js (catálogo público, forma antigua sin variantes)
// y staff-catalogo-ejemplo.js (gestión Staff/Encargado/Admin, ya en
// forma de variantes)— y admin-portal.html era la única página que
// todavía cargaba la antigua, con su propio conteo leído directo de
// localStorage en vez de esperar a `catalogoRepoListo`. Ahora las 11
// páginas que usan catálogo cargan la MISMA semilla
// (staff-catalogo-ejemplo.js) antes de este archivo, así que si
// Firestore arranca vacío, cualquiera que sea la primera página
// visitada siembra la colección "productos" con la misma forma.
// catalogo-productos-ejemplo.js se eliminó del proyecto al quedar sin
// ninguna página que lo cargara.

const CATALOGO_STORAGE_KEY = 'mw_staff_catalogo_demo';
const CATALOGO_COLECCION_FIRESTORE = 'productos';
const CATALOGO_META_COLECCION = 'catalogoMeta';
const CATALOGO_META_DOC_ID = 'estado';

let CATALOGO_CACHE = [];

// Opción A acordada para convivir con BRILLO MW (el sistema de caja e
// inventario, repositorio brillomw), que también agrega y edita
// productos en esta misma colección: esta página ya NO reescribe el
// catálogo completo en cada guardado. Recuerda cómo estaba cada producto
// en el servidor la última vez que lo leyó o lo guardó (aquí, como texto
// con las claves ordenadas) y en cada guardado:
// - escribe SOLO los productos que cambiaron en esta página;
// - borra SOLO los que esta página tenía y ya no están (eliminados aquí);
// - NUNCA toca un producto que no conoce (por ejemplo, uno que BRILLO
//   agregó después de que se abrió esta página).
// Así un guardado de aquí no deshace ni borra lo que se hizo en BRILLO.
let _catalogoEnServidor = new Map();

function _textoEstable(valor) {
  if (Array.isArray(valor)) return '[' + valor.map(_textoEstable).join(',') + ']';
  if (valor && typeof valor === 'object') {
    return '{' + Object.keys(valor).sort()
      .filter(k => valor[k] !== undefined)
      .map(k => JSON.stringify(k) + ':' + _textoEstable(valor[k])).join(',') + '}';
  }
  return JSON.stringify(valor === undefined ? null : valor);
}

function _recordarCatalogoEnServidor(productos) {
  _catalogoEnServidor = new Map(productos.map(p => [String(p.id), _textoEstable(p)]));
}

function catalogoSemillaLocal() {
  return (typeof CATALOGO_EJEMPLO !== 'undefined' ? CATALOGO_EJEMPLO : []).map(p => ({ ...p }));
}

function catalogoDesdeLocalStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CATALOGO_STORAGE_KEY));
    if (Array.isArray(guardado)) return guardado;
  } catch (error) {
    // sigue abajo
  }
  return catalogoSemillaLocal();
}

async function cargarCatalogoRepo() {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).get();
      if (!snap.empty) {
        CATALOGO_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
        _recordarCatalogoEnServidor(CATALOGO_CACHE);
      } else {
        // Colección vacía: puede ser la primera vez que este proyecto de
        // Firestore recibe catálogo, O alguien borró todo a propósito.
        // catalogoMeta/estado distingue los dos casos — solo se siembra
        // si ese marcador nunca se ha creado.
        const meta = await dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_META_DOC_ID).get();
        if (meta.exists) {
          CATALOGO_CACHE = [];
        } else {
          CATALOGO_CACHE = catalogoSemillaLocal();
          await guardarCatalogoRepo(CATALOGO_CACHE);
        }
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar productos ya eliminados en otro
      // dispositivo (mismo problema ya corregido en cuentas-firestore-
      // sync.js / personas-firestore-sync.js / apartados-firestore-
      // sync.js). Se avisa y se deja vacío en vez de mostrar datos que
      // podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar el catálogo desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      CATALOGO_CACHE = [];
    }
  } else {
    CATALOGO_CACHE = catalogoDesdeLocalStorage();
    try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(CATALOGO_CACHE)); } catch (error) { /* noop */ }
  }
  return CATALOGO_CACHE;
}

// Recibe el catálogo completo (mismo contrato de siempre para todos los
// controladores): guarda siempre en localStorage como caché/respaldo, y
// si hay Firestore real, envía SOLO las diferencias contra lo que esta
// página sabe que hay en el servidor — ver _catalogoEnServidor arriba.
//
// Cada controlador llama esto sin esperar (varios clics seguidos —
// borrar, agregar — disparan varias llamadas casi al mismo tiempo). Si
// cada una leyera Firestore y escribiera por su cuenta, podrían
// terminar en cualquier orden y la más lenta pisaría el resultado de
// una más reciente. `_colaGuardadoCatalogo` fuerza a que se ejecuten
// una a la vez, en el mismo orden en que se llamaron.
let _colaGuardadoCatalogo = Promise.resolve();

async function guardarCatalogoRepo(catalogo) {
  CATALOGO_CACHE = catalogo;
  try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(catalogo)); } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  // Nunca queda en estado "rechazada": si un guardado falla, ya se avisó
  // dentro de sincronizarCatalogoConFirestore (mostrarToast) — que quede
  // rechazada aquí solo bloquearía en silencio los guardados siguientes
  // de la cola y generaría un error sin manejar en la consola, ya que
  // ningún controlador espera ni atrapa el resultado de esta llamada.
  const tarea = _colaGuardadoCatalogo.then(() => sincronizarCatalogoConFirestore(catalogo).catch(() => {}));
  _colaGuardadoCatalogo = tarea;
  return tarea;
}

async function sincronizarCatalogoConFirestore(catalogo) {
  const coleccion = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE);
  const batch = dbFirestore.batch();
  const escritos = new Map();
  const borrados = [];

  catalogo.forEach(producto => {
    const id = String(producto.id);
    const texto = _textoEstable(producto);
    if (_catalogoEnServidor.get(id) === texto) return; // sin cambios en esta página
    batch.set(coleccion.doc(id), producto);
    escritos.set(id, texto);
  });

  const idsNuevos = new Set(catalogo.map(p => String(p.id)));
  _catalogoEnServidor.forEach((texto, id) => {
    if (!idsNuevos.has(id)) {
      batch.delete(coleccion.doc(id)); // lo eliminó esta página
      borrados.push(id);
    }
  });

  // Sella que este proyecto ya tuvo catálogo real — así una colección
  // vacía después de esto se sabe que es a propósito, no "sin sembrar".
  batch.set(dbFirestore.collection(CATALOGO_META_COLECCION).doc(CATALOGO_META_DOC_ID), { inicializado: true }, { merge: true });
  try {
    await batch.commit();
    escritos.forEach((texto, id) => _catalogoEnServidor.set(id, texto));
    borrados.forEach(id => _catalogoEnServidor.delete(id));
  } catch (error) {
    // Firestore aplica el batch completo o nada: si un solo producto
    // falla (ej. una foto demasiado pesada), NINGÚN cambio de este
    // guardado se aplica. Antes esto quedaba como una promesa rechazada
    // sin manejar — visible solo en la consola del navegador — y parecía
    // que "no pasó nada". Avisamos con un mensaje que sí se ve en pantalla.
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar el catálogo: ' + (error && error.message ? error.message : 'error desconocido') + '. Ningún cambio de este guardado se aplicó.');
    }
    throw error;
  }
}

// Reduce cualquier foto de producto a un tamaño que quepa cómodo en un
// documento de Firestore (límite de ~1 MB por campo). Las fotos de
// Catálogo van embebidas directo en el producto (nunca se suben a
// Storage — ver js/firebase-init.js), así que una foto de cámara/
// celular sin comprimir (varios MB) puede tumbar el guardado COMPLETO
// del catálogo, no solo ese producto (Firestore aplica cada lote de
// escritura completo o nada). Usar SIEMPRE esto al leer un <input
// type="file"> de foto de producto, en vez de FileReader directo.
const CATALOGO_IMAGEN_LADO_MAX = 900; // px del lado más largo
const CATALOGO_IMAGEN_CALIDAD = 0.72;

function comprimirImagenAProductoDataURL(archivo) {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onerror = () => reject(lector.error || new Error('No se pudo leer el archivo'));
    lector.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('No se pudo leer la imagen'));
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > CATALOGO_IMAGEN_LADO_MAX) {
          height = Math.round(height * (CATALOGO_IMAGEN_LADO_MAX / width));
          width = CATALOGO_IMAGEN_LADO_MAX;
        } else if (height > width && height > CATALOGO_IMAGEN_LADO_MAX) {
          width = Math.round(width * (CATALOGO_IMAGEN_LADO_MAX / height));
          height = CATALOGO_IMAGEN_LADO_MAX;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', CATALOGO_IMAGEN_CALIDAD));
      };
      img.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  });
}

// Cada página espera esto UNA vez antes de su primer render.
const catalogoRepoListo = cargarCatalogoRepo();
