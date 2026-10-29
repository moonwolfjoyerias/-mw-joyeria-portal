// MW JOYERÍA — Repositorio de Personas (Emprendedora/Líder) — Fase 2: Firebase
//
// Mismo patrón que apartados-firestore-sync.js / catalogo-firestore-sync.js:
// una caché en memoria (PERSONAS_CACHE) que este archivo llena de forma
// ASÍNCRONA una sola vez al cargar la página — personas-ejemplo.js expone
// encima las mismas funciones síncronas de siempre (obtenerPersonas/
// guardarPersonas), así ninguna otra página necesita tocarse más que para
// esperar `personasRepoListo` antes de su primer render (igual que ya se
// hizo con Apartados y Cuentas internas).
//
// Antes de este archivo, una cuenta de Emprendedora/Líder creada en un
// dispositivo (Admin → Configuración, o al aprobar una Solicitud de
// inscripción) solo quedaba en el localStorage de ESE dispositivo: no
// aparecía en ningún otro, y tampoco podía iniciar sesión desde otro
// (el login no dependía de esto, pero sin una cuenta real de Firebase
// Auth + su perfil en users/{uid}, nunca llegaba a intentarlo).
//
// Dos piezas separadas, igual que ya se decidió para Cuentas internas:
// - personas/{id} — el registro completo (nombre, stats, rango, equipo,
//   constancia, rifa, datos bancarios…), diff-y-resync como ventanasApartado.
//   NUNCA incluye password — personas-ejemplo.js ya la guarda aparte.
// - users/{firebaseUid} — el perfil delgado que ya usa js/auth-service.js
//   para saber el rol de quien inició sesión (reutilizado, no es una
//   colección nueva) — se llena solo al crear la cuenta real (ver
//   crearAccesoFirebaseParaPersona), nunca con la contraseña.
//
// Se carga ANTES que personas-ejemplo.js — pero quien de verdad arranca
// la carga (`const personasRepoListo = cargarPersonasRepo();`) vive al
// FINAL de personas-ejemplo.js, no aquí: cargarPersonasRepo() necesita
// construirPersonasEjemplo() para la semilla, que todavía no existiría
// si se disparara desde este archivo (mismo motivo/mismo orden que ya
// usa apartados-firestore-sync.js con apartados-modelo.js).

const PERSONAS_COLECCION_FIRESTORE = 'personas';
const PERSONAS_META_COLECCION = 'personasMeta';
const PERSONAS_META_DOC_ID = 'estado';
const PERSONAS_FINANCIERO_COLECCION = 'personasFinanciero';
const PERSONAS_FINANCIERO_CAMPOS = ['datosBancarios', 'constancia', 'rifa'];

let PERSONAS_CACHE = [];

// Cómo está cada documento en el servidor la última vez que esta página
// lo leyó o lo guardó (texto estable). Cada guardado escribe SOLO lo que
// cambió: antes cada guardado leía la colección completa y reescribía,
// por cada persona, su perfil + sus datos financieros + su acceso
// (users/{uid}) — con el plan gratuito de Firestore eso agotaba el
// límite diario de lecturas/escrituras.
let _personasEnServidor = new Map();   // id → personas/{id}
let _financieroEnServidor = new Map(); // id → personasFinanciero/{id}
// Ids cuyo personasFinanciero ESTA página sí leyó (o confirmó que no existe).
// Revisión de oct-2026: si la sesión todavía no estaba lista al cargar, no
// se leía nada, los cierres del Plan MW partían de cero y al guardar se
// pisaban con ceros el Reto de Constancia y los boletos de la rifa de todas.
// Ahora solo se escribe lo financiero de quien sí se leyó (o es nueva).
let _financieroLeido = new Set();
let _personasCargadasDelServidor = false;
let _usuariosEnServidor = new Map();   // firebaseUid → users/{uid}

function perfilUsuarioPersona(persona) {
  return {
    usuario: persona.usuario,
    nombre: nombreCompletoPersona(persona),
    rol: persona.tipo,
    personaId: persona.id,
    cuentaId: null,
    correo: persona.correo || '',
    telefono: persona.telefono || '',
    activa: persona.estado === 'activa'
  };
}

function _recordarPersonasEnServidor(personas) {
  _personasEnServidor = new Map();
  _financieroEnServidor = new Map();
  _usuariosEnServidor = new Map();
  personas.forEach(persona => {
    const id = String(persona.id);
    const { publico, financiero } = separarCamposFinancieroPersona(persona);
    _personasEnServidor.set(id, textoEstableFirestore(publico));
    if (Object.keys(financiero).length) _financieroEnServidor.set(id, textoEstableFirestore(financiero));
    if (persona.firebaseUid) _usuariosEnServidor.set(persona.firebaseUid, textoEstableFirestore(perfilUsuarioPersona(persona)));
  });
}

// En vivo (convivencia con BRILLO MW, que también maneja Emprendedoras/
// Líderes y aprueba Solicitudes en esta misma colección). Igual que
// eventos-firestore-sync.js:
// - onSnapshot aplica lo que cambie BRILLO u otro dispositivo sobre el
//   mismo arreglo en memoria y avisa a la pantalla
//   ('mw:personas-actualizadas') para que se vuelva a pintar sola. Solo en
//   los portales de Staff/Encargado/Admin (una Emprendedora solo lee su
//   propio registro y el de su líder).
// - Una copia atrasada de una persona no se vuelve a enviar, y lo que
//   llegó en vivo no se borra por no venir en un arreglo viejo.
const _personasVersionesSuperadas = new Map();
const _personasRecibidasEnVivo = new Set();
let _escuchaPersonasActiva = false;

function _textoPublicoPersona(persona) {
  return textoEstableFirestore(separarCamposFinancieroPersona(persona).publico);
}

function _superarPersona(id, texto) {
  if (!texto) return;
  if (!_personasVersionesSuperadas.has(id)) _personasVersionesSuperadas.set(id, new Set());
  _personasVersionesSuperadas.get(id).add(texto);
}

function _aplicarPersonasEnVivo(snap) {
  let huboCambios = false;
  snap.docChanges().forEach(cambio => {
    const id = String(cambio.doc.id);
    const antes = _personasEnServidor.get(id);
    const i = PERSONAS_CACHE.findIndex(p => String(p.id) === id);
    const local = i >= 0 ? PERSONAS_CACHE[i] : null;
    const cambioPendiente = local && _textoPublicoPersona(local) !== antes;
    if (cambio.type === 'removed') {
      if (antes === undefined) return;
      _superarPersona(id, antes);
      _personasEnServidor.delete(id);
      if (local && !cambioPendiente) { PERSONAS_CACHE.splice(i, 1); huboCambios = true; }
      return;
    }
    // Los datos financieros viven aparte (personasFinanciero) y no llegan
    // aquí: se conservan los que ya tenía esta página.
    const financiero = local ? separarCamposFinancieroPersona(local).financiero : {};
    const persona = { ...cambio.doc.data(), id: cambio.doc.id, ...financiero };
    const texto = _textoPublicoPersona(persona);
    if (texto === antes) return;
    if (antes === undefined && !local) _personasRecibidasEnVivo.add(id);
    _superarPersona(id, antes);
    _personasEnServidor.set(id, texto);
    if (cambioPendiente) return;
    // Quien cambia una persona con acceso real también deja al día su
    // users/{uid} en el mismo guardado (la página y BRILLO).
    if (persona.firebaseUid) _usuariosEnServidor.set(persona.firebaseUid, textoEstableFirestore(perfilUsuarioPersona(persona)));
    if (local) PERSONAS_CACHE[i] = persona; else PERSONAS_CACHE.push(persona);
    huboCambios = true;
  });
  if (!huboCambios) return;
  try { localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(PERSONAS_CACHE)); } catch (error) { /* noop */ }
  window.dispatchEvent(new CustomEvent('mw:personas-actualizadas'));
}

function escucharPersonasEnVivo() {
  if (!dbFirestore || _escuchaPersonasActiva) return;
  if (!/\/portal\/(admin|encargado|staff)\//.test(window.location.pathname)) return;
  _escuchaPersonasActiva = true;
  // Si la escucha falla (sin sesión, sin red) la página sigue como antes:
  // con lo que cargó.
  dbFirestore.collection(PERSONAS_COLECCION_FIRESTORE).onSnapshot(_aplicarPersonasEnVivo, () => {});
}

// Un arreglo armado antes de un cambio en vivo: sus copias atrasadas se
// cambian por la versión actual y lo que llegó en vivo y no trae se
// conserva, para que la pantalla no muestre datos viejos.
function _conservarPersonasRecibidas(personas) {
  if (personas === PERSONAS_CACHE) return personas;
  const actuales = new Map(PERSONAS_CACHE.map(p => [String(p.id), p]));
  personas.forEach((p, i) => {
    const id = String(p.id);
    if (_personasVersionesSuperadas.has(id) && _personasVersionesSuperadas.get(id).has(_textoPublicoPersona(p)) && actuales.has(id)) personas[i] = actuales.get(id);
  });
  if (_personasRecibidasEnVivo.size) {
    const ids = new Set(personas.map(p => String(p.id)));
    PERSONAS_CACHE.forEach(p => {
      if (_personasRecibidasEnVivo.has(String(p.id)) && !ids.has(String(p.id))) personas.push(p);
    });
  }
  return personas;
}

function personasSemillaLocal() {
  return typeof construirPersonasEjemplo === 'function' ? construirPersonasEjemplo() : [];
}

function personasDesdeLocalStorage() {
  try {
    const guardado = JSON.parse(localStorage.getItem(PERSONAS_STORAGE_KEY));
    if (Array.isArray(guardado) && guardado.length) return guardado;
  } catch (error) {
    // sigue abajo y reconstruye el ejemplo
  }
  return personasSemillaLocal();
}

function _esperarSesionPersonas() {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function revisar() {
      const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
      if (sesion || Date.now() - inicio > 15000) return resolve(sesion);
      setTimeout(revisar, 150);
    })();
  });
}

// Revisión de cuota de Firestore: el portal de una Emprendedora solo
// usa su propio registro y el de su líder (ver cuenta.js, apartados.js,
// catalogo.js), así que lee esos 2 documentos en vez de la colección
// completa (con 1,000 e/l eran 1,000 lecturas por cada página que
// abría). Líder (necesita a todo su equipo para rango/comisiones) y
// Staff/Encargado/Admin siguen leyendo todo.
async function _leerPersonasDeEstaPagina() {
  const coleccion = dbFirestore.collection(PERSONAS_COLECCION_FIRESTORE);
  // Fuera del portal (login.html) no se usa la lista: el chequeo de
  // duplicados del registro público ya lo hace Admin al aprobar, y sin
  // sesión las reglas ni siquiera dejan leerla. Una cuenta con sesión
  // que pasaba por el login leía a todas las personas sin usarlas.
  if (!/\/portal\//.test(window.location.pathname)) return [];
  if (/\/portal\/emprendedora\//.test(window.location.pathname)) {
    const sesion = await _esperarSesionPersonas();
    const personaId = sesion && sesion.tipo === 'persona' ? sesion.personaId : null;
    if (personaId) {
      const propia = await coleccion.doc(String(personaId)).get();
      if (!propia.exists) return [];
      const personas = [{ ...propia.data(), id: propia.id }];
      const liderId = propia.data().liderId;
      if (liderId) {
        const lider = await coleccion.doc(String(liderId)).get();
        if (lider.exists) personas.push({ ...lider.data(), id: lider.id });
      }
      return personas;
    }
  }
  const snap = await coleccion.get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id }));
}

async function cargarPersonasRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(PERSONAS_META_COLECCION).doc(PERSONAS_META_DOC_ID).get();
      if (metaSnap.exists) {
        // Las personas se publican (PERSONAS_CACHE) hasta tener también sus
        // datos financieros: si otra parte de la página calculaba y guardaba
        // antes, los cierres del Plan MW partían de cero y se guardaban ceros.
        const leidas = await _leerPersonasDeEstaPagina();
        await fusionarPersonasFinanciero(leidas);
        PERSONAS_CACHE = leidas;
        _recordarPersonasEnServidor(PERSONAS_CACHE);
        _personasCargadasDelServidor = true;
        escucharPersonasEnVivo();
      } else {
        // Primera vez que este proyecto de Firestore ve Personas: siembra
        // el ejemplo completo de una vez (misma semilla que ya existía).
        const semilla = personasSemillaLocal();
        await guardarPersonasRepo(semilla);
      }
    } catch (error) {
      // La consulta falló (reglas, red) — NO se rellena con lo que haya
      // en local: eso podría resucitar personas ya eliminadas de
      // Firestore en otro dispositivo (ver mismo problema ya corregido
      // en cuentas-firestore-sync.js). Se avisa y se deja vacío hasta
      // la siguiente carga en vez de mostrar datos que podrían estar mal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudieron cargar las cuentas de Emprendedora/Líder desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      PERSONAS_CACHE = [];
    }
  } else {
    PERSONAS_CACHE = personasDesdeLocalStorage();
  }
  try { localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(PERSONAS_CACHE)); } catch (error) { /* noop */ }
  return PERSONAS_CACHE;
}

// SEC-01 de la auditoría: datosBancarios/constancia/rifa viven en la
// colección aparte personasFinanciero/{id} (ver firestore.rules), legible
// solo por la propia persona o Admin — así que esta fusión solo puede
// traer lo que el perfil de quien inició sesión tenga permitido leer.
// Staff/Encargado nunca llaman esto con éxito (ni lo necesitan: ningún
// controlador de Staff/Encargado lee estos tres campos) — se detectan
// por sesión para no intentar una lectura que las reglas van a negar.
function _esperarSesionPersonas() {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function revisar() {
      const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
      if (sesion || Date.now() - inicio > 15000) return resolve(sesion);
      setTimeout(revisar, 150);
    })();
  });
}

async function fusionarPersonasFinanciero(personas) {
  // La sesión de Firebase llega un momento después de cargar la página:
  // se espera, para no quedarse sin los datos financieros (ver _financieroLeido).
  const sesion = await _esperarSesionPersonas();
  if (!sesion) return;
  try {
    if (sesion.tipo === 'interna' && sesion.rol === 'admin') {
      const snap = await dbFirestore.collection(PERSONAS_FINANCIERO_COLECCION).get();
      const porId = new Map(snap.docs.map(d => [d.id, d.data()]));
      personas.forEach(persona => {
        const datos = porId.get(String(persona.id));
        if (datos) Object.assign(persona, datos);
        _financieroLeido.add(String(persona.id));
      });
      // Las que no tenían documento también cuentan como leídas (ya se sabe que no hay nada).
      porId.forEach((_, id) => _financieroLeido.add(id));
    } else if (sesion.tipo === 'persona' && sesion.personaId) {
      const doc = await dbFirestore.collection(PERSONAS_FINANCIERO_COLECCION).doc(String(sesion.personaId)).get();
      if (doc.exists) {
        const persona = personas.find(p => String(p.id) === String(sesion.personaId));
        if (persona) Object.assign(persona, doc.data());
      }
      _financieroLeido.add(String(sesion.personaId));
    }
    // Staff/Encargado: ni lo intentan — no tienen permiso ni lo necesitan.
  } catch (error) {
    // Sin estos campos, cada lector ya trata datosBancarios/constancia/
    // rifa como ausentes (persona?.datosBancarios, (persona.rifa||{}).x);
    // no vale la pena tumbar toda la carga de Personas por esto.
  }
}

// Separa de un objeto persona los campos restringidos (para que nunca
// se vuelvan a escribir en personas/{id}) — regresa { publico, financiero }.
function separarCamposFinancieroPersona(persona) {
  const financiero = {};
  const publico = { ...persona };
  PERSONAS_FINANCIERO_CAMPOS.forEach(campo => {
    if (persona[campo] !== undefined) {
      financiero[campo] = persona[campo];
      delete publico[campo];
    }
  });
  return { publico, financiero };
}

// Igual que Apartados: varias acciones seguidas (crear, editar, cambiar
// de líder…) pueden disparar varios guardados casi al mismo tiempo — una
// cola evita que se pisen entre sí.
let _colaGuardadoPersonas = Promise.resolve();

function avisarErrorGuardadoPersonas(error, detalle) {
  if (typeof mostrarToast === 'function') {
    mostrarToast('No se pudo guardar ' + detalle + ': ' + (error && error.message ? error.message : 'error desconocido') + '. Ese cambio no se aplicó.');
  }
}

function guardarPersonasRepo(personas) {
  personas = _conservarPersonasRecibidas(personas);
  PERSONAS_CACHE = personas;
  try { localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(personas)); } catch (error) { /* noop */ }

  if (!dbFirestore) return Promise.resolve();

  const tarea = _colaGuardadoPersonas.then(() =>
    sincronizarPersonasConFirestore(personas).catch(error => avisarErrorGuardadoPersonas(error, 'la cuenta de Emprendedora/Líder'))
  );
  _colaGuardadoPersonas = tarea;
  return tarea;
}

async function sincronizarPersonasConFirestore(personas) {
  const coleccion = dbFirestore.collection(PERSONAS_COLECCION_FIRESTORE);
  const financieroColeccion = dbFirestore.collection(PERSONAS_FINANCIERO_COLECCION);
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;

  // Una cuenta de Emprendedora/Líder (sesion.tipo === 'persona') solo
  // puede escribir SU PROPIO documento — igual que ya exige la regla de
  // personas/{id} (esInterno() || miPerfil().personaId == id).
  // obtenerPersonas() regresa el arreglo COMPLETO, así que se filtra a la
  // suya para que Firestore no rechace el batch entero por las ajenas.
  const esPersona = !!(sesion && sesion.tipo === 'persona' && sesion.personaId);
  const candidatas = esPersona
    ? personas.filter(p => String(p.id) === String(sesion.personaId))
    : personas;

  const batch = dbFirestore.batch();
  const alConfirmar = [];
  const tarjetasCatalogoABorrar = [];

  candidatas.forEach(persona => {
    const id = String(persona.id);
    const { publico, financiero } = separarCamposFinancieroPersona(persona);

    const textoPublico = textoEstableFirestore(publico);
    // Una copia atrasada (ya superada por un cambio en vivo) no se reenvía.
    const atrasada = _personasVersionesSuperadas.has(id) && _personasVersionesSuperadas.get(id).has(textoPublico);
    if (_personasEnServidor.get(id) !== textoPublico && !atrasada) {
      batch.set(coleccion.doc(id), publico);
      alConfirmar.push(() => _personasEnServidor.set(id, textoPublico));
      if (!esPersona && persona.estado && persona.estado !== 'activa') tarjetasCatalogoABorrar.push(id);
    }

    // Nunca se escribe lo financiero de alguien cuyo documento no se leyó
    // (se pisaría con ceros); sí el de una persona recién creada aquí.
    const financieroConocido = _financieroLeido.has(id) || (_personasCargadasDelServidor && !_personasEnServidor.has(id));
    if (Object.keys(financiero).length && financieroConocido) {
      const textoFinanciero = textoEstableFirestore(financiero);
      if (_financieroEnServidor.get(id) !== textoFinanciero) {
        batch.set(financieroColeccion.doc(id), financiero, { merge: true });
        alConfirmar.push(() => _financieroEnServidor.set(id, textoFinanciero));
      }
    }

    // Admin edita personas por muchos caminos (reactivar, convertir en
    // líder, editar información, dar de baja…) y todos terminan aquí: el
    // acceso users/{uid} de quien YA tiene cuenta real se mantiene al día
    // desde este único punto. Nunca toca password ni crea accesos nuevos
    // (eso es crearAccesoFirebaseParaPersona).
    if (!esPersona && persona.firebaseUid && !atrasada) {
      const uid = persona.firebaseUid;
      const perfil = perfilUsuarioPersona(persona);
      const textoPerfil = textoEstableFirestore(perfil);
      if (_usuariosEnServidor.get(uid) !== textoPerfil) {
        batch.set(dbFirestore.collection('users').doc(uid), perfil, { merge: true });
        alConfirmar.push(() => _usuariosEnServidor.set(uid, textoPerfil));
      }
    }
  });

  // Solo se borran las que esta página tenía y ya no están (eliminadas
  // aquí) — nunca una que se haya creado en otro dispositivo después.
  if (!esPersona) {
    const idsNuevos = new Set(personas.map(p => String(p.id)));
    _personasEnServidor.forEach((texto, id) => {
      if (idsNuevos.has(id) || _personasRecibidasEnVivo.has(id)) return;
      batch.delete(coleccion.doc(id));
      alConfirmar.push(() => _personasEnServidor.delete(id));
      tarjetasCatalogoABorrar.push(id);
    });
  }

  const primeraVez = !esPersona && _personasEnServidor.size === 0;
  if (primeraVez) {
    batch.set(dbFirestore.collection(PERSONAS_META_COLECCION).doc(PERSONAS_META_DOC_ID), { inicializado: true }, { merge: true });
  }
  if (!alConfirmar.length && !primeraVez) return;

  await batch.commit();
  alConfirmar.forEach(aplicar => aplicar());

  // Cuenta dada de baja, inactiva o eliminada: su link de catálogo para
  // clientas (catalogo-vivo.html, ver js/catalogo.js) deja de funcionar.
  // Aparte del batch a propósito: si esto falla, no debe tumbar el
  // guardado de personas.
  tarjetasCatalogoABorrar.forEach((id) => {
    dbFirestore.collection('catalogoTarjetas').doc(id).delete().catch(() => { /* noop */ });
  });
}

// Crea la cuenta REAL de Firebase Auth de una persona nueva + su perfil
// en users/{uid} (mismo correo sintético {usuario}@... que ya usa
// Cuentas internas — ver js/auth-service.js) para que pueda iniciar
// sesión desde cualquier dispositivo. Se llama SOLO al crear una cuenta
// nueva (Admin → Configuración, o al aprobar una Solicitud de
// inscripción) — nunca reintenta para las que ya tenían acceso.
// Lanza el error tal cual si algo falla, para que quien llama decida
// (mismo contrato que crearUsuarioFirebaseSinPerderSesion).
async function crearAccesoFirebaseParaPersona(persona, password) {
  if (!dbFirestore || typeof crearUsuarioFirebaseSinPerderSesion !== 'function') return null;

  let uid;
  try {
    uid = await crearUsuarioFirebaseSinPerderSesion(persona.usuario, password, nombreCompletoPersona(persona));
  } catch (error) {
    // Antes de rendirse: puede ser un acceso huérfano de un intento
    // anterior interrumpido a medias por una conexión lenta (se alcanzó
    // a crear el acceso real de Firebase Auth, pero nunca se terminó de
    // guardar su perfil) — ver intentarRecuperarUsuarioFirebaseExistente
    // en auth-service.js. Mismo criterio que ya usa crearCuentaInterna.
    const uidRecuperado = error?.code === 'auth/email-already-in-use' && typeof intentarRecuperarUsuarioFirebaseExistente === 'function'
      ? await intentarRecuperarUsuarioFirebaseExistente(persona.usuario, password)
      : null;
    if (!uidRecuperado) throw error;
    uid = uidRecuperado;
  }

  persona.firebaseUid = uid;
  const perfil = perfilUsuarioPersona(persona);
  await dbFirestore.collection('users').doc(uid).set(perfil, { merge: true });
  _usuariosEnServidor.set(uid, textoEstableFirestore(perfil));
  return uid;
}

