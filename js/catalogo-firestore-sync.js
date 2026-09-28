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
// ⚠️ Nota conocida (ver AUDITORIA-FIREBASE.md, sección C.4): hoy
// existen DOS semillas distintas con el mismo nombre CATALOGO_EJEMPLO
// —catalogo-productos-ejemplo.js (catálogo público, forma antigua sin
// variantes) y staff-catalogo-ejemplo.js (gestión Staff/Encargado/
// Admin, ya en forma de variantes)— cada página carga solo una de las
// dos. Este archivo no intenta resolver esa inconsistencia (viene de
// antes de Firebase); solo usa la que ya esté cargada en cada página,
// exactamente como el comportamiento actual. Si Firestore arranca
// vacío, la primera página que se visite siembra la colección
// "productos" con SU semilla local — normalizarlas a una sola es
// trabajo de una migración aparte.

const CATALOGO_STORAGE_KEY = 'mw_staff_catalogo_demo';
const CATALOGO_COLECCION_FIRESTORE = 'productos';

let CATALOGO_CACHE = [];

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
    const snap = await dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE).get();
    if (!snap.empty) {
      CATALOGO_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    } else {
      // Colección vacía = primera vez que este proyecto de Firestore
      // recibe catálogo — se siembra una sola vez para que la beta no
      // arranque en blanco.
      CATALOGO_CACHE = catalogoSemillaLocal();
      await guardarCatalogoRepo(CATALOGO_CACHE);
    }
  } else {
    CATALOGO_CACHE = catalogoDesdeLocalStorage();
    try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(CATALOGO_CACHE)); } catch (error) { /* noop */ }
  }
  return CATALOGO_CACHE;
}

// Reemplaza el catálogo completo (mismo patrón que ya usaba
// guardarCatalogoStaffStorage): guarda siempre en localStorage como
// caché/respaldo, y si hay Firestore real, sincroniza la colección
// completa — agrega/actualiza lo que sigue en `catalogo` y borra los
// documentos cuyo producto ya no está en el arreglo (eliminado).
async function guardarCatalogoRepo(catalogo) {
  CATALOGO_CACHE = catalogo;
  try { localStorage.setItem(CATALOGO_STORAGE_KEY, JSON.stringify(catalogo)); } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  const coleccion = dbFirestore.collection(CATALOGO_COLECCION_FIRESTORE);
  const snap = await coleccion.get();
  const idsNuevos = new Set(catalogo.map(p => String(p.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  catalogo.forEach(producto => {
    batch.set(coleccion.doc(String(producto.id)), producto);
  });
  await batch.commit();
}

// Cada página espera esto UNA vez antes de su primer render.
const catalogoRepoListo = cargarCatalogoRepo();
