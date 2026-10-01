// MW JOYERÍA — Repositorio de Auditoría / Actividad (Firebase)
//
// Antes js/auditoria-modelo.js (y sus envoltorios duplicados
// registrarAuditoriaAdmin/registrarAuditoriaEncargado en admin-comun.js
// /encargado-comun.js) guardaban la bitácora completa en localStorage
// ("mw-auditoria-v1") — una acción hecha en un dispositivo (ej. Staff
// subiendo productos al catálogo) nunca aparecía en la pestaña
// "Actividad" de otro dispositivo (ej. el celular de Admin).
//
// A diferencia de Catálogo/Eventos (que reescriben la colección
// completa en cada guardado), la bitácora es de solo agregar — nunca
// se edita ni se borra un registro ya escrito — así que aquí cada
// entrada se guarda como SU PROPIO documento (mucho más barato que
// reenviar toda la bitácora completa cada vez que alguien hace una
// acción).
//
// Se carga DESPUÉS de js/firebase-init.js y ANTES de
// js/auditoria-modelo.js / js/admin-comun.js / js/encargado-comun.js —
// ver el <script> de cada página.

const AUDITORIA_COLECCION_FIRESTORE = 'auditoria';
const AUDITORIA_CACHE_STORAGE_KEY = 'mw-auditoria-v1';

let AUDITORIA_CACHE = [];

function auditoriaDesdeLocalStorage() {
  try {
    const registros = JSON.parse(localStorage.getItem(AUDITORIA_CACHE_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function guardarAuditoriaCacheLocal() {
  try { localStorage.setItem(AUDITORIA_CACHE_STORAGE_KEY, JSON.stringify(AUDITORIA_CACHE)); } catch (error) { /* noop */ }
}

async function cargarAuditoriaRepo() {
  if (dbFirestore) {
    try {
      const snap = await dbFirestore.collection(AUDITORIA_COLECCION_FIRESTORE).orderBy('fecha', 'desc').get();
      AUDITORIA_CACHE = snap.docs.map(d => ({ ...d.data(), id: d.id }));
      guardarAuditoriaCacheLocal();
    } catch (error) {
      // La consulta falló (reglas, red) — no se rellena con lo que haya
      // en local: mismo criterio que el resto del portal.
      if (typeof mostrarToast === 'function') {
        mostrarToast('No se pudo cargar la actividad desde el servidor. Revisa tu conexión y vuelve a cargar la página.');
      }
      AUDITORIA_CACHE = [];
    }
  } else {
    AUDITORIA_CACHE = auditoriaDesdeLocalStorage();
  }
  return AUDITORIA_CACHE;
}

// Agrega UN registro nuevo — nunca reescribe los anteriores.
async function registrarAuditoriaRepo(registro) {
  AUDITORIA_CACHE.unshift(registro);
  guardarAuditoriaCacheLocal();

  if (!dbFirestore) return;
  try {
    await dbFirestore.collection(AUDITORIA_COLECCION_FIRESTORE).doc(registro.id).set(registro);
  } catch (error) {
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudo guardar el registro de actividad en el servidor.');
    }
  }
}

// Cada página espera esto UNA vez antes de su primer render.
const auditoriaRepoListo = cargarAuditoriaRepo();
