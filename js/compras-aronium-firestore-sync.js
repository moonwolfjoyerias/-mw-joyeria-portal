// MW JOYERÍA — Compras de Aronium (fuente oficial de compras de las e/l)
//
// Admin sube por QUINCENA (1–15 o 16–fin de mes, igual que los
// sub-periodos de comisiones del Plan MW) el reporte de Aronium "Ventas por
// formas de pago y cliente" (ver js/aronium-xlsx.js y admin-compras.js).
// Subir otra vez la misma quincena la REEMPLAZA — así nunca se cuenta doble.
//
// En Firestore (también lo puede leer BRILLO MW):
//   comprasAronium/{AAAA-MM-p1|p2}
//     { quincena, mes, subPeriodo, desde, hasta,
//       montos: { <personaId>: <monto que cuenta> },   ← lo que usan rango,
//       resumen: {...}, archivo, importadoPor, importadoEn }   comisiones, etc.
//   comprasAroniumPersona/{personaId}
//     { quincenas: { <AAAA-MM-p1>: { desde, hasta, pagos: {efectivo, …},
//                                    cuenta, totalReporte } } }   ← Mis compras
//   comprasAroniumMeta/estado  { quincenas: [<AAAA-MM-p1>, …] }
//
// "Monto que cuenta" = Efectivo + Terminal + Transferencia (decisión del
// equipo, ver FORMAS_PAGO_QUE_CUENTAN en aronium-xlsx.js).
//
// Cuota de Firestore: una página de Admin/Líder lee 1 documento por
// quincena importada (no uno por persona); una Emprendedora lee solo el
// suyo.

const COMPRAS_ARONIUM_COLECCION = 'comprasAronium';
const COMPRAS_ARONIUM_PERSONA_COLECCION = 'comprasAroniumPersona';
const COMPRAS_ARONIUM_META_COLECCION = 'comprasAroniumMeta';
const COMPRAS_ARONIUM_META_DOC_ID = 'estado';
const COMPRAS_ARONIUM_STORAGE_KEY = 'mw_compras_aronium_demo';

// quincenaKey → { montos: { personaId: número }, desde, hasta, ... }
let COMPRAS_ARONIUM_QUINCENAS = {};
// Quincenas que ya tienen archivo de Aronium (aunque esta página no haya
// cargado sus montos — ej. una Emprendedora solo carga lo suyo).
let COMPRAS_ARONIUM_IMPORTADAS = new Set();
// Desglose de la persona con sesión abierta (Mis compras).
let COMPRAS_ARONIUM_MIAS = {};
// Números de cliente de Aronium que Admin marcó como "no es e/l" (público
// en general) — para no volver a preguntar por ellos en cada quincena.
let COMPRAS_ARONIUM_IGNORADOS = new Set();

function claveQuincenaAronium(mesKey, subPeriodo) {
  return `${mesKey}-${subPeriodo}`;
}

function rangoFechasQuincenaAronium(mesKey, subPeriodo) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return subPeriodo === 'p1'
    ? { desde: `${mesKey}-01`, hasta: `${mesKey}-15` }
    : { desde: `${mesKey}-16`, hasta: `${mesKey}-${String(ultimoDia).padStart(2, '0')}` };
}

function _sesionComprasAronium() {
  return typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
}

function _esperarSesionComprasAronium() {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function revisar() {
      const sesion = _sesionComprasAronium();
      if (sesion || Date.now() - inicio > 15000) return resolve(sesion);
      setTimeout(revisar, 150);
    })();
  });
}

function _comprasAroniumDemo() {
  try { return JSON.parse(localStorage.getItem(COMPRAS_ARONIUM_STORAGE_KEY)) || { quincenas: {}, personas: {} }; } catch (e) { return { quincenas: {}, personas: {} }; }
}

async function cargarComprasAroniumRepo() {
  const enPortalPersona = /\/portal\/(emprendedora|lider)\//.test(window.location.pathname);
  const esLider = /\/portal\/lider\//.test(window.location.pathname);

  if (!dbFirestore) {
    const demo = _comprasAroniumDemo();
    COMPRAS_ARONIUM_QUINCENAS = demo.quincenas || {};
    COMPRAS_ARONIUM_IMPORTADAS = new Set(Object.keys(COMPRAS_ARONIUM_QUINCENAS));
    COMPRAS_ARONIUM_IGNORADOS = new Set(demo.ignorados || []);
    const sesion = _sesionComprasAronium();
    COMPRAS_ARONIUM_MIAS = (sesion && sesion.personaId && demo.personas?.[sesion.personaId]) || {};
    return;
  }

  try {
    const meta = await dbFirestore.collection(COMPRAS_ARONIUM_META_COLECCION).doc(COMPRAS_ARONIUM_META_DOC_ID).get();
    COMPRAS_ARONIUM_IMPORTADAS = new Set(meta.exists ? (meta.data().quincenas || []) : []);
    COMPRAS_ARONIUM_IGNORADOS = new Set(meta.exists ? (meta.data().ignorados || []) : []);
    if (!COMPRAS_ARONIUM_IMPORTADAS.size) return;

    if (enPortalPersona) {
      const sesion = await _esperarSesionComprasAronium();
      const personaId = sesion && sesion.tipo === 'persona' ? sesion.personaId : null;
      if (personaId) {
        const propio = await dbFirestore.collection(COMPRAS_ARONIUM_PERSONA_COLECCION).doc(String(personaId)).get();
        COMPRAS_ARONIUM_MIAS = propio.exists ? (propio.data().quincenas || {}) : {};
      }
      // Una Emprendedora solo necesita lo suyo: sus montos por quincena
      // salen de su propio documento.
      if (!esLider) {
        COMPRAS_ARONIUM_IMPORTADAS.forEach(clave => {
          COMPRAS_ARONIUM_QUINCENAS[clave] = { montos: personaId && COMPRAS_ARONIUM_MIAS[clave] ? { [personaId]: COMPRAS_ARONIUM_MIAS[clave].cuenta || 0 } : {} };
        });
        return;
      }
    }

    // Admin/Staff/Encargado y Líder (cálculos de equipo): un documento por quincena.
    const snap = await dbFirestore.collection(COMPRAS_ARONIUM_COLECCION).get();
    snap.docs.forEach(d => { COMPRAS_ARONIUM_QUINCENAS[d.id] = d.data(); });
  } catch (error) {
    // Sin estos datos, cada cálculo sigue con los apartados liquidados,
    // igual que antes de existir la carga de Aronium.
    console.error('No se pudieron cargar las compras de Aronium:', error);
    COMPRAS_ARONIUM_IMPORTADAS = new Set();
    COMPRAS_ARONIUM_QUINCENAS = {};
  }
}

// Monto que cuenta de una persona en una quincena, o null si esa quincena
// todavía no tiene archivo de Aronium (entonces se usan los apartados).
function montoComprasAroniumQuincena(personaId, mesKey, subPeriodo) {
  const clave = claveQuincenaAronium(mesKey, subPeriodo);
  if (!COMPRAS_ARONIUM_IMPORTADAS.has(clave)) return null;
  const quincena = COMPRAS_ARONIUM_QUINCENAS[clave];
  return Number((quincena && quincena.montos && quincena.montos[personaId]) || 0);
}

function quincenasAroniumImportadas() {
  return [...COMPRAS_ARONIUM_IMPORTADAS].sort();
}

// ============================================================
// GUARDAR / ELIMINAR UNA IMPORTACIÓN (solo Admin — ver firestore.rules)
// ============================================================

// ligadas: [{ personaId, cliente }] — cliente tal como lo regresa
// interpretarReporteAronium (pagos, cuenta, totalReporte).
async function guardarImportacionAronium({ mesKey, subPeriodo, ligadas, resumen, archivo, importadoPor }) {
  const clave = claveQuincenaAronium(mesKey, subPeriodo);
  const { desde, hasta } = rangoFechasQuincenaAronium(mesKey, subPeriodo);
  const montos = {};
  const porPersona = {};
  ligadas.forEach(({ personaId, cliente }) => {
    const anterior = porPersona[personaId];
    // Dos clientes de Aronium ligados a la misma e/l (ej. dio de alta dos
    // veces a la misma persona): se suman.
    const pagos = { ...(anterior ? anterior.pagos : {}) };
    Object.entries(cliente.pagos).forEach(([f, v]) => { pagos[f] = Math.round(((pagos[f] || 0) + v) * 100) / 100; });
    porPersona[personaId] = {
      desde, hasta, pagos,
      cuenta: Math.round(((anterior ? anterior.cuenta : 0) + cliente.cuenta) * 100) / 100,
      totalReporte: Math.round(((anterior ? anterior.totalReporte : 0) + cliente.totalReporte) * 100) / 100
    };
    montos[personaId] = porPersona[personaId].cuenta;
  });

  const documento = {
    quincena: clave, mes: mesKey, subPeriodo, desde, hasta, montos,
    resumen, archivo: archivo || '', importadoPor: importadoPor || '', importadoEn: new Date().toISOString()
  };

  if (!dbFirestore) {
    const demo = _comprasAroniumDemo();
    const anterior = demo.quincenas[clave];
    if (anterior) Object.keys(anterior.montos || {}).forEach(id => { if (demo.personas[id]) delete demo.personas[id][clave]; });
    demo.quincenas[clave] = documento;
    Object.entries(porPersona).forEach(([id, datos]) => { (demo.personas[id] = demo.personas[id] || {})[clave] = datos; });
    localStorage.setItem(COMPRAS_ARONIUM_STORAGE_KEY, JSON.stringify(demo));
  } else {
    const fv = firebase.firestore.FieldValue;
    // Si la quincena ya existía, quitar la entrada de quien ya no viene.
    const previo = await dbFirestore.collection(COMPRAS_ARONIUM_COLECCION).doc(clave).get();
    const yaNoVienen = previo.exists ? Object.keys(previo.data().montos || {}).filter(id => !porPersona[id]) : [];

    // Lotes de 400 (Firestore acepta 500 escrituras por lote). Los
    // documentos por persona van primero; el de la quincena y el índice
    // al final, para que una carga que falle a medias no cuente nada.
    const escrituras = [];
    Object.entries(porPersona).forEach(([id, datos]) => {
      escrituras.push(b => b.set(dbFirestore.collection(COMPRAS_ARONIUM_PERSONA_COLECCION).doc(id), { quincenas: { [clave]: datos } }, { merge: true }));
    });
    yaNoVienen.forEach(id => {
      escrituras.push(b => b.set(dbFirestore.collection(COMPRAS_ARONIUM_PERSONA_COLECCION).doc(id), { quincenas: { [clave]: fv.delete() } }, { merge: true }));
    });
    for (let i = 0; i < escrituras.length; i += 400) {
      const lote = dbFirestore.batch();
      escrituras.slice(i, i + 400).forEach(f => f(lote));
      await lote.commit();
    }
    const final = dbFirestore.batch();
    final.set(dbFirestore.collection(COMPRAS_ARONIUM_COLECCION).doc(clave), documento);
    final.set(dbFirestore.collection(COMPRAS_ARONIUM_META_COLECCION).doc(COMPRAS_ARONIUM_META_DOC_ID), { quincenas: fv.arrayUnion(clave) }, { merge: true });
    await final.commit();
  }

  COMPRAS_ARONIUM_QUINCENAS[clave] = documento;
  COMPRAS_ARONIUM_IMPORTADAS.add(clave);
  return documento;
}

async function eliminarImportacionAronium(clave) {
  const quincena = COMPRAS_ARONIUM_QUINCENAS[clave];
  const ids = Object.keys((quincena && quincena.montos) || {});

  if (!dbFirestore) {
    const demo = _comprasAroniumDemo();
    delete demo.quincenas[clave];
    ids.forEach(id => { if (demo.personas[id]) delete demo.personas[id][clave]; });
    localStorage.setItem(COMPRAS_ARONIUM_STORAGE_KEY, JSON.stringify(demo));
  } else {
    const fv = firebase.firestore.FieldValue;
    // Primero el índice y la quincena (deja de contar de inmediato), luego
    // el desglose de cada persona.
    const primero = dbFirestore.batch();
    primero.set(dbFirestore.collection(COMPRAS_ARONIUM_META_COLECCION).doc(COMPRAS_ARONIUM_META_DOC_ID), { quincenas: fv.arrayRemove(clave) }, { merge: true });
    primero.delete(dbFirestore.collection(COMPRAS_ARONIUM_COLECCION).doc(clave));
    await primero.commit();
    for (let i = 0; i < ids.length; i += 400) {
      const lote = dbFirestore.batch();
      ids.slice(i, i + 400).forEach(id => lote.set(dbFirestore.collection(COMPRAS_ARONIUM_PERSONA_COLECCION).doc(id), { quincenas: { [clave]: fv.delete() } }, { merge: true }));
      await lote.commit();
    }
  }

  delete COMPRAS_ARONIUM_QUINCENAS[clave];
  COMPRAS_ARONIUM_IMPORTADAS.delete(clave);
}

// Recuerda (o deja de recordar) clientes de Aronium como "no es e/l".
async function guardarIgnoradosAronium(agregar, quitar) {
  agregar = (agregar || []).map(String);
  quitar = (quitar || []).map(String);
  if (!agregar.length && !quitar.length) return;
  agregar.forEach(id => COMPRAS_ARONIUM_IGNORADOS.add(id));
  quitar.forEach(id => COMPRAS_ARONIUM_IGNORADOS.delete(id));
  if (!dbFirestore) {
    const demo = _comprasAroniumDemo();
    demo.ignorados = [...COMPRAS_ARONIUM_IGNORADOS];
    localStorage.setItem(COMPRAS_ARONIUM_STORAGE_KEY, JSON.stringify(demo));
    return;
  }
  const fv = firebase.firestore.FieldValue;
  const ref = dbFirestore.collection(COMPRAS_ARONIUM_META_COLECCION).doc(COMPRAS_ARONIUM_META_DOC_ID);
  if (agregar.length) await ref.set({ ignorados: fv.arrayUnion(...agregar) }, { merge: true });
  if (quitar.length) await ref.set({ ignorados: fv.arrayRemove(...quitar) }, { merge: true });
}

const comprasAroniumListo = cargarComprasAroniumRepo();
