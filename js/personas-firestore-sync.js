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

let PERSONAS_CACHE = [];

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

async function cargarPersonasRepo() {
  if (dbFirestore) {
    try {
      const metaSnap = await dbFirestore.collection(PERSONAS_META_COLECCION).doc(PERSONAS_META_DOC_ID).get();
      if (metaSnap.exists) {
        const snap = await dbFirestore.collection(PERSONAS_COLECCION_FIRESTORE).get();
        PERSONAS_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      } else {
        // Primera vez que este proyecto de Firestore ve Personas: siembra
        // el ejemplo completo de una vez (misma semilla que ya existía).
        const semilla = personasSemillaLocal();
        await guardarPersonasRepo(semilla);
      }
    } catch (error) {
      // Si falla la consulta (reglas, red), no se rompe la pantalla — se
      // sigue con lo que haya en local en vez de dejarla en blanco.
      PERSONAS_CACHE = personasDesdeLocalStorage();
    }
  } else {
    PERSONAS_CACHE = personasDesdeLocalStorage();
  }
  try { localStorage.setItem(PERSONAS_STORAGE_KEY, JSON.stringify(PERSONAS_CACHE)); } catch (error) { /* noop */ }
  return PERSONAS_CACHE;
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
  const snap = await coleccion.get();
  const idsNuevos = new Set(personas.map(p => String(p.id)));
  const batch = dbFirestore.batch();
  snap.docs.forEach(doc => {
    if (!idsNuevos.has(doc.id)) batch.delete(doc.ref);
  });
  personas.forEach(persona => {
    batch.set(coleccion.doc(String(persona.id)), persona);
  });
  batch.set(dbFirestore.collection(PERSONAS_META_COLECCION).doc(PERSONAS_META_DOC_ID), { inicializado: true }, { merge: true });

  // Admin edita personas por muchos caminos distintos (reactivar,
  // convertir en líder, editar información, dar de baja…) y todos pasan
  // por aquí al final (guardarPersonas guarda el arreglo completo) — en
  // vez de repetir la sincronización de login en cada uno, se resuelve
  // una sola vez aquí para cualquier persona que YA tenga acceso real.
  // Nunca toca password ni crea accesos nuevos (eso es
  // crearAccesoFirebaseParaPersona, solo al crear la cuenta).
  personas.filter(p => p.firebaseUid).forEach(persona => {
    batch.set(dbFirestore.collection('users').doc(persona.firebaseUid), {
      usuario: persona.usuario,
      nombre: nombreCompletoPersona(persona),
      rol: persona.tipo,
      personaId: persona.id,
      cuentaId: null,
      correo: persona.correo || '',
      telefono: persona.telefono || '',
      activa: persona.estado === 'activa'
    }, { merge: true });
  });

  await batch.commit();
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
  const uid = await crearUsuarioFirebaseSinPerderSesion(persona.usuario, password, nombreCompletoPersona(persona));
  persona.firebaseUid = uid;
  await dbFirestore.collection('users').doc(uid).set({
    usuario: persona.usuario,
    nombre: nombreCompletoPersona(persona),
    rol: persona.tipo, // 'emprendedora' | 'lider'
    personaId: persona.id,
    cuentaId: null,
    activa: persona.estado === 'activa',
    correo: persona.correo || '',
    telefono: persona.telefono || ''
  }, { merge: true });
  return uid;
}

