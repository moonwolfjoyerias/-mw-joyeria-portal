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

// Opción A (convivencia con BRILLO MW, que también maneja apartados en
// estas mismas colecciones) y cuota diaria de Firestore: esta página ya NO
// lee ni reescribe todas las ventanas, ni el documento completo de
// créditos, en cada guardado. Recuerda cómo estaba cada ventana y cada
// crédito en el servidor la última vez que los leyó o guardó, y en cada
// guardado envía SOLO lo que cambió aquí; nunca borra una ventana que no
// conoce (por ejemplo, una abierta desde BRILLO después de cargar esta
// página) ni pisa créditos de otras personas que no tocó.
let _ventanasEnServidor = new Map();
let _creditosEnServidor = {};

// En vivo (onSnapshot): lo que cambie BRILLO u otro dispositivo se ve
// aquí sin recargar. Para que un arreglo viejo (leído antes de que llegara
// el cambio) no regrese datos atrasados al guardarse, se recuerdan las
// versiones del servidor que ya quedaron superadas (no se vuelven a
// enviar) y las ventanas que llegaron en vivo (esta página nunca las
// borra por no traerlas en un arreglo viejo).
const _versionesSuperadas = new Map();
const _idsRecibidosEnVivo = new Set();

function _marcarVersionSuperada(id, texto) {
  if (!texto) return;
  if (!_versionesSuperadas.has(id)) _versionesSuperadas.set(id, new Set());
  _versionesSuperadas.get(id).add(texto);
}

function _avisarApartadosActualizados() {
  try { localStorage.setItem(APARTADOS_STORAGE_KEY, JSON.stringify(APARTADOS_CACHE)); } catch (error) { /* noop */ }
  try { localStorage.setItem(CREDITOS_STORAGE_KEY, JSON.stringify(CREDITOS_CACHE)); } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:apartados-actualizados'));
}

// Aplica la foto del servidor SOBRE el mismo arreglo/objeto en memoria
// (los paneles guardan una referencia a él). Una ventana o crédito con
// un cambio de esta página que todavía no se guarda se respeta: ese
// guardado sale después, como siempre.
function _aplicarVentanasEnVivo(snap) {
  let huboCambios = false;
  snap.docChanges().forEach(cambio => {
    const id = String(cambio.doc.id);
    const enServidorAntes = _ventanasEnServidor.get(id);
    const i = APARTADOS_CACHE.findIndex(v => String(v.id) === id);
    const local = i >= 0 ? APARTADOS_CACHE[i] : null;
    const cambioPendiente = local && textoEstableFirestore(local) !== enServidorAntes;

    if (cambio.type === 'removed') {
      if (enServidorAntes === undefined) return;
      _marcarVersionSuperada(id, enServidorAntes);
      _ventanasEnServidor.delete(id);
      if (local && !cambioPendiente) { APARTADOS_CACHE.splice(i, 1); huboCambios = true; }
      return;
    }

    const ventana = { ...cambio.doc.data(), id: cambio.doc.id };
    const texto = textoEstableFirestore(ventana);
    if (texto === enServidorAntes) return;
    if (enServidorAntes === undefined && !local) _idsRecibidosEnVivo.add(id);
    _marcarVersionSuperada(id, enServidorAntes);
    _ventanasEnServidor.set(id, texto);
    if (cambioPendiente) return;
    if (local) APARTADOS_CACHE[i] = ventana; else APARTADOS_CACHE.push(ventana);
    huboCambios = true;
  });
  if (huboCambios) _avisarApartadosActualizados();
}

function _aplicarCreditosEnVivo(doc) {
  const servidor = doc.exists ? (doc.data() || {}) : {};
  let huboCambios = false;
  new Set([...Object.keys(servidor), ...Object.keys(_creditosEnServidor)]).forEach(usuarioId => {
    const antes = _creditosEnServidor[usuarioId];
    const ahora = servidor[usuarioId];
    if (antes === ahora) return;
    const sinCambioLocal = CREDITOS_CACHE[usuarioId] === antes;
    if (ahora === undefined) delete _creditosEnServidor[usuarioId]; else _creditosEnServidor[usuarioId] = ahora;
    if (!sinCambioLocal) return;
    if (ahora === undefined) delete CREDITOS_CACHE[usuarioId]; else CREDITOS_CACHE[usuarioId] = ahora;
    huboCambios = true;
  });
  if (huboCambios) _avisarApartadosActualizados();
}

// Revisión de cuota de Firestore: antes se leía la colección completa
// con .get() y luego OTRA VEZ al abrir la escucha en vivo (Firestore
// cobra las dos). Ahora la primera respuesta de la escucha en vivo es la
// carga inicial, y las siguientes se aplican con _aplicar*EnVivo.
function _primeraRespuestaEnVivo(ref, alCambiar) {
  return new Promise((resolve, reject) => {
    let primera = true;
    ref.onSnapshot(snap => {
      if (primera) { primera = false; resolve(snap); return; }
      alCambiar(snap);
    }, error => {
      // Si la escucha falla (sin sesión, sin red) antes de responder, la
      // carga falla igual que antes; si falla después, la página sigue
      // con lo que ya tenía.
      if (primera) { primera = false; reject(error); }
    });
  });
}

// La sesión de Firebase se resuelve de forma asíncrona (ver auth-guard.js):
// en una pestaña nueva tarda un momento en quedar en sessionStorage.
function _esperarSesionApartados() {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function revisar() {
      const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
      if (sesion || Date.now() - inicio > 15000) return resolve(sesion);
      setTimeout(revisar, 150);
    })();
  });
}

// Qué ventanas necesita esta página: una Emprendedora solo usa las suyas
// (todo su portal filtra por su propio usuarioId), así que no lee las de
// todas las demás. Líder sigue con todas por ahora (sus cálculos de
// equipo, rango y comisiones usan las compras de su equipo), igual que
// Staff/Encargado/Admin.
async function _consultaVentanasDeEstaPagina() {
  const coleccion = dbFirestore.collection(APARTADOS_COLECCION_FIRESTORE);
  if (!/\/portal\/emprendedora\//.test(window.location.pathname)) return coleccion;
  const sesion = await _esperarSesionApartados();
  const personaId = sesion && sesion.tipo === 'persona' ? sesion.personaId : null;
  return personaId ? coleccion.where('usuarioId', '==', personaId) : coleccion;
}

function _recordarVentanasEnServidor(ventanas) {
  _ventanasEnServidor = new Map(ventanas.map(v => [String(v.id), textoEstableFirestore(v)]));
}

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
    try {
      const metaSnap = await dbFirestore.collection(APARTADOS_META_COLECCION).doc(APARTADOS_META_DOC_ID).get();

      if (metaSnap.exists) {
        const [snapVentanas, docCreditos] = await Promise.all([
          _primeraRespuestaEnVivo(await _consultaVentanasDeEstaPagina(), _aplicarVentanasEnVivo),
          _primeraRespuestaEnVivo(dbFirestore.collection(APARTADOS_META_COLECCION).doc(CREDITOS_META_DOC_ID), _aplicarCreditosEnVivo)
        ]);
        APARTADOS_CACHE = snapVentanas.docs.map(d => ({ ...d.data(), id: d.id }));
        _recordarVentanasEnServidor(APARTADOS_CACHE);
        CREDITOS_CACHE = docCreditos.exists ? (docCreditos.data() || {}) : {};
        _creditosEnServidor = { ...CREDITOS_CACHE };
      } else {
        // Primera vez que este proyecto de Firestore ve Apartados: siembra
        // las compras de ejemplo + la prueba de $8,000 + el crédito demo,
        // todo de una vez.
        const ventanasSemilla = conCompraDePruebaOchoMil(apartadosSemillaLocal());
        const creditosSemilla = creditosSemillaLocal();
        await guardarVentanasRepo(ventanasSemilla);
        await guardarCreditosRepo(creditosSemilla);
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar ventanas ya eliminadas/cerradas
      // en otro dispositivo (mismo problema ya corregido en
      // cuentas-firestore-sync.js / personas-firestore-sync.js). Se
      // avisa y se deja vacío en vez de mostrar datos que podrían
      // estar mal o dejar la página sin terminar de cargar nunca.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudieron cargar los apartados desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      APARTADOS_CACHE = [];
      CREDITOS_CACHE = {};
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
  // Un arreglo armado antes de que llegara un cambio en vivo: sus copias
  // atrasadas se cambian por la versión actual y las ventanas que llegaron
  // en vivo y no trae se conservan, para que la pantalla no muestre datos
  // viejos ni pierda ventanas.
  if (ventanas !== APARTADOS_CACHE) {
    const actuales = new Map(APARTADOS_CACHE.map(v => [String(v.id), v]));
    if (_versionesSuperadas.size) {
      ventanas.forEach((v, i) => {
        const id = String(v.id);
        if (_versionesSuperadas.has(id) && _versionesSuperadas.get(id).has(textoEstableFirestore(v)) && actuales.has(id)) ventanas[i] = actuales.get(id);
      });
    }
    if (_idsRecibidosEnVivo.size) {
      const ids = new Set(ventanas.map(v => String(v.id)));
      APARTADOS_CACHE.forEach(v => {
        if (_idsRecibidosEnVivo.has(String(v.id)) && !ids.has(String(v.id))) ventanas.push(v);
      });
    }
  }
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

  // SEC-07: una cuenta de Emprendedora/Líder (sesion.tipo === 'persona')
  // solo puede escribir SUS PROPIAS ventanas (usuarioId == su
  // personaId) — igual que ya exige la regla de ventanasApartado.
  // guardarVentanasApartado() recibe el arreglo COMPLETO (todas las
  // ventanas de todas las clientas), así que se filtra a las suyas.
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  const esPersona = Boolean(sesion && sesion.tipo === 'persona' && sesion.personaId);
  const candidatas = esPersona ? ventanas.filter(v => v.usuarioId === sesion.personaId) : ventanas;

  // Opción A: solo las ventanas que cambiaron en esta página.
  const batch = dbFirestore.batch();
  const escritas = new Map();
  candidatas.forEach(ventana => {
    const id = String(ventana.id);
    const texto = textoEstableFirestore(ventana);
    if (_ventanasEnServidor.get(id) === texto) return;
    // Copia atrasada de una ventana que ya cambió en el servidor: no se
    // regresa (pisaría lo que se hizo en BRILLO u otro dispositivo).
    if (_versionesSuperadas.has(id) && _versionesSuperadas.get(id).has(texto)) return;
    batch.set(coleccion.doc(id), ventana);
    escritas.set(id, texto);
  });

  // Solo se borra lo que esta página conocía y quitó — nunca una ventana
  // que no conoce. Las Emprendedoras/Líderes nunca borran ventanas.
  const borradas = [];
  if (!esPersona) {
    const idsNuevos = new Set(ventanas.map(v => String(v.id)));
    _ventanasEnServidor.forEach((texto, id) => {
      if (!idsNuevos.has(id) && !_idsRecibidosEnVivo.has(id)) {
        batch.delete(coleccion.doc(id));
        borradas.push(id);
      }
    });
  }

  // El marcador "ya se sembró" solo hace falta la primera vez (cada
  // escritura cuenta contra la cuota diaria).
  const primeraVez = !esPersona && _ventanasEnServidor.size === 0;
  if (primeraVez) {
    batch.set(dbFirestore.collection(APARTADOS_META_COLECCION).doc(APARTADOS_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!escritas.size && !borradas.length && !primeraVez) return;

  await batch.commit();
  escritas.forEach((texto, id) => _ventanasEnServidor.set(id, texto));
  borradas.forEach(id => _ventanasEnServidor.delete(id));
}

async function sincronizarCreditosConFirestore(creditos) {
  // Opción A: solo los créditos que cambiaron en esta página, con merge,
  // para no pisar los de otras personas que se movieron desde BRILLO.
  const cambios = {};
  Object.keys(creditos).forEach(usuarioId => {
    if (_creditosEnServidor[usuarioId] !== creditos[usuarioId]) cambios[usuarioId] = creditos[usuarioId];
  });
  Object.keys(_creditosEnServidor).forEach(usuarioId => {
    if (!(usuarioId in creditos)) cambios[usuarioId] = firebase.firestore.FieldValue.delete();
  });
  if (!Object.keys(cambios).length) return;
  await dbFirestore.collection(APARTADOS_META_COLECCION).doc(CREDITOS_META_DOC_ID).set(cambios, { merge: true });
  // Solo lo que se envió: otros créditos pudieron cambiar en vivo mientras tanto.
  Object.keys(cambios).forEach(usuarioId => {
    if (usuarioId in creditos) _creditosEnServidor[usuarioId] = creditos[usuarioId];
    else delete _creditosEnServidor[usuarioId];
  });
}
