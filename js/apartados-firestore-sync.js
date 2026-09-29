// MW JOYERÍA — Repositorio de Apartados (Fase 2: Firebase)
//
// Mismo patrón que js/catalogo-firestore-sync.js: una caché en memoria
// que este archivo llena de forma ASÍNCRONA una sola vez al cargar la
// página (desde Firestore si hay config real, si no desde localStorage
// igual que siempre) — js/apartados-modelo.js expone encima funciones
// SÍNCRONAS (obtenerVentanasApartado/guardarVentanasApartado/
// obtenerCreditosApartado/guardarCreditosApartado) que solo leen/
// escriben esta caché, así ninguna otra página necesita tocarse.
//
// Se carga DESPUÉS de js/firebase-init.js y ANTES de
// js/apartados-modelo.js (que es quien de verdad arranca la carga —
// ver el final de ese archivo — porque la semilla de ejemplo y la
// "prueba de $8,000" usan crearVentanaApartado/crearApartadoPieza,
// definidas ahí, no aquí).
//
// Dos colecciones de Firestore:
// - ventanasApartado/{id} — una ventana por documento (mismo patrón de
//   diff-y-resync que productos/ en Catálogo: se agregan/actualizan las
//   que siguen en el arreglo y se borran las que ya no están — hoy
//   ninguna ventana se borra nunca, solo cambia de estado, pero se deja
//   la misma lógica por si algún día sí se necesita).
// - apartadosMeta/estado — igual que catalogoMeta/estado en Catálogo:
//   marca si este proyecto de Firestore ya tuvo Apartados alguna vez,
//   para no confundir "recién conectado" con "ya se usó, solo que ahora
//   no hay ventanas nuevas" (aquí es menos probable que pase, porque
//   las ventanas nunca se borran, pero cuesta poco protegerlo igual).
// - apartadosMeta/creditos — el objeto completo de créditos guardados
//   (usuarioId → monto), como un solo documento.

const APARTADOS_STORAGE_KEY = 'mw-apartados-modelo-v1';
const CREDITOS_STORAGE_KEY = 'mw-creditos-modelo-v1';
const APARTADOS_COLECCION_FIRESTORE = 'ventanasApartado';
const APARTADOS_META_COLECCION = 'apartadosMeta';
const APARTADOS_META_DOC_ID = 'estado';
const CREDITOS_META_DOC_ID = 'creditos';

// ⚠️ PRUEBA TEMPORAL — BÓRRAME (se mantiene igual que antes, movida
// aquí desde apartados-modelo.js): agrega siempre una compra de $8,000
// ya liquidada para 'me-emprendedora', protegida solo por su id fijo.
const ID_PRUEBA_8000 = 'VENT-PRUEBA-8000-CLAUDIA';

let APARTADOS_CACHE = [];
let CREDITOS_CACHE = {};

function apartadosSemillaLocal() {
  return typeof construirVentanasApartadoEjemplo === 'function' ? construirVentanasApartadoEjemplo() : [];
}

function creditosSemillaLocal() {
  return { 'me-emprendedora': (typeof DEPOSITO_BASE === 'number' ? DEPOSITO_BASE : 50) };
}

function apartadosDesdeLocalStorage() {
  try {
    const guardadas = localStorage.getItem(APARTADOS_STORAGE_KEY);
    if (guardadas === null) return apartadosSemillaLocal();
    const ventanas = JSON.parse(guardadas);
    return Array.isArray(ventanas) ? ventanas : [];
  } catch (error) {
    return apartadosSemillaLocal();
  }
}

function creditosDesdeLocalStorage() {
  try {
    if (localStorage.getItem(CREDITOS_STORAGE_KEY) === null) return creditosSemillaLocal();
    const creditos = JSON.parse(localStorage.getItem(CREDITOS_STORAGE_KEY));
    return (creditos && typeof creditos === 'object' && !Array.isArray(creditos)) ? creditos : {};
  } catch (error) {
    return {};
  }
}

function conCompraDePruebaOchoMil(ventanas) {
  if (ventanas.some(v => v.id === ID_PRUEBA_8000)) return ventanas;
  if (typeof crearApartadoPieza !== 'function' || typeof crearVentanaApartado !== 'function') return ventanas;
  const ahoraISO = new Date().toISOString();
  const pieza = crearApartadoPieza({
    id: 'PIEZA-PRUEBA-8000-CLAUDIA',
    producto: 'Pieza de prueba ($8,000)',
    material: 'oro-laminado',
    total: 8000,
    estado: 'liquidada',
    fechaSolicitud: ahoraISO,
    pagos: [{ monto: 8000, tipo: 'liquidacion', metodo: 'transferencia', referencia: null, fecha: ahoraISO }]
  });
  return [...ventanas, crearVentanaApartado({
    id: ID_PRUEBA_8000,
    usuarioId: 'me-emprendedora',
    usuarioNombre: 'Claudia Ramírez',
    telefono: '444 123 4567',
    categoria: 'normal',
    fechaInicio: ahoraISO,
    estado: 'cerrada',
    resolucionDeposito: 'no_aplica',
    apartados: [pieza]
  })];
}

async function cargarApartadosRepo() {
  if (dbFirestore) {
    const metaSnap = await dbFirestore.collection(APARTADOS_META_COLECCION).doc(APARTADOS_META_DOC_ID).get();

    if (metaSnap.exists) {
      const snapVentanas = await dbFirestore.collection(APARTADOS_COLECCION_FIRESTORE).get();
      APARTADOS_CACHE = snapVentanas.docs.map(d => ({ ...d.data(), id: d.id }));

      const docCreditos = await dbFirestore.collection(APARTADOS_META_COLECCION).doc(CREDITOS_META_DOC_ID).get();
      CREDITOS_CACHE = docCreditos.exists ? (docCreditos.data() || {}) : {};
    } else {
      // Primera vez que este proyecto de Firestore ve Apartados: siembra
      // las compras de ejemplo + la prueba de $8,000 + el crédito demo,
      // todo de una vez.
      const ventanasSemilla = conCompraDePruebaOchoMil(apartadosSemillaLocal());
      const creditosSemilla = creditosSemillaLocal();
      await guardarVentanasRepo(ventanasSemilla);
      await guardarCreditosRepo(creditosSemilla);
    }
  } else {
    APARTADOS_CACHE = conCompraDePruebaOchoMil(apartadosDesdeLocalStorage());
    CREDITOS_CACHE = creditosDesdeLocalStorage();
    try {
      localStorage.setItem(APARTADOS_STORAGE_KEY, JSON.stringify(APARTADOS_CACHE));
      localStorage.setItem(CREDITOS_STORAGE_KEY, JSON.stringify(CREDITOS_CACHE));
    } catch (error) { /* noop */ }
  }
  return { ventanas: APARTADOS_CACHE, creditos: CREDITOS_CACHE };
}

// Los controladores (Staff/Encargado/Admin/Emprendedora/Líder, Comisiones,
// dashboards…) llaman esto sin esperar (varias acciones seguidas pueden
// disparar varios guardados casi al mismo tiempo). Una cola compartida
// entre ventanas y créditos evita que se pisen entre sí — mismo problema
// (y misma solución) que ya se encontró en vivo con Catálogo.
let _colaGuardadoApartados = Promise.resolve();

function avisarErrorGuardadoApartados(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

async function guardarVentanasRepo(ventanas) {
  APARTADOS_CACHE = ventanas;
  try { localStorage.setItem(APARTADOS_STORAGE_KEY, JSON.stringify(ventanas)); } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  const tarea = _colaGuardadoApartados.then(() =>
    sincronizarVentanasConFirestore(ventanas).catch(error => avisarErrorGuardadoApartados(error, 'Apartados'))
  );
  _colaGuardadoApartados = tarea;
  return tarea;
}

async function guardarCreditosRepo(creditos) {
  CREDITOS_CACHE = creditos;
  try { localStorage.setItem(CREDITOS_STORAGE_KEY, JSON.stringify(creditos)); } catch (error) { /* noop */ }

  if (!dbFirestore) return;

  const tarea = _colaGuardadoApartados.then(() =>
    sincronizarCreditosConFirestore(creditos).catch(error => avisarErrorGuardadoApartados(error, 'el crédito guardado'))
  );
  _colaGuardadoApartados = tarea;
  return tarea;
}

async function sincronizarVentanasConFirestore(ventanas) {
  const coleccion = dbFirestore.collection(APARTADOS_COLECCION_FIRESTORE);
  const snap = await coleccion.get();
  const idsNuevos = new Set(ventanas.map(v => String(v.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  ventanas.forEach(ventana => {
    batch.set(coleccion.doc(String(ventana.id)), ventana);
  });
  batch.set(dbFirestore.collection(APARTADOS_META_COLECCION).doc(APARTADOS_META_DOC_ID), { inicializado: true }, { merge: true });
  await batch.commit();
}

async function sincronizarCreditosConFirestore(creditos) {
  await dbFirestore.collection(APARTADOS_META_COLECCION).doc(CREDITOS_META_DOC_ID).set(creditos);
  await dbFirestore.collection(APARTADOS_META_COLECCION).doc(APARTADOS_META_DOC_ID).set({ inicializado: true }, { merge: true });
}
