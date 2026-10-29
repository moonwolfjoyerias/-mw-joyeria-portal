// MW JOYERÍA — Corregir el nombre de alguien del equipo interno
// (Staff / Encargado / Admin) en TODO el portal
//
// El nombre de quien hizo cada cosa se guarda como texto en cada
// registro (Actividad, historial de Apartados, Actividades del Staff,
// Nómina, Lista de deseos, Calendario, Catálogo…), así que corregir un
// error en el nombre de la cuenta no bastaba: el nombre viejo se
// quedaba en todo lo anterior. renombrarPersonalInterno() cambia el
// nombre en la cuenta (users/{uid}), en su registro de Nómina y en cada
// registro guardado que lo nombre. Las páginas abiertas que escuchan en
// vivo (Nómina, Actividades del Staff, Apartados…) lo ven al instante;
// la persona renombrada ve su nombre nuevo sin volver a iniciar sesión
// (ver escucharNombrePropioSesion en js/auth-guard.js).
//
// Solo se cambia un texto IGUAL al nombre anterior y, cuando el
// registro dice de quién es (usuarioId, solicitadoPorId, rol…), solo si
// es de esta persona — así nunca se toca el nombre de una Emprendedora
// o Líder que casualmente se llame igual.

const ROLES_PERSONAL_INTERNO = ['staff', 'encargado', 'admin'];

// Campos que guardan solo el nombre (sin id al lado).
const CAMPOS_SOLO_NOMBRE_PERSONAL = ['registradoPor', 'revisadoPor', 'solicitadoPor', 'actualizadoPor', 'empleado', 'usuario'];

// Colecciones que se revisan completas (el nombre puede estar anidado:
// historial de cada ventana, encargados de cada actividad…). Actividad
// (auditoria) y productos son grandes y se consultan por campo.
const COLECCIONES_CON_NOMBRE_PERSONAL = [
  'ventanasApartado', 'actividadesStaff', 'historialActividadesStaff',
  'nominaPeriodos', 'nominaSolicitudes', 'nominaHistorialAjustes', 'nominaHistorialEstados',
  'listaDeseos', 'listaDeseosHistorialEstados', 'solicitudesResurtido',
  'eventos', 'solicitudesEventos', 'solicitudesInscripcion', 'personas',
  'comisionesPagos', 'comisionesHistorialAjustes', 'fotosSitio', 'catalogoResumen'
];

function _debeRenombrarCampo(obj, clave, ctx) {
  const rolDe = (base) => obj[base + 'Rol'] ?? obj.rol;
  if (clave.endsWith('Nombre')) {
    const base = clave.slice(0, -'Nombre'.length);
    const idHermano = obj[base + 'Id'];
    if (idHermano !== undefined && idHermano !== null && idHermano !== '') return ctx.ids.has(String(idHermano));
    const rol = rolDe(base);
    if (rol) return ROLES_PERSONAL_INTERNO.includes(rol);
    // Sin id ni rol: solo quien hizo algo (creadoPor, firmadoPor…) o el
    // encargado de una actividad — nunca personaNombre, clienteNombre…
    return base.endsWith('Por') || base === 'encargado';
  }
  // { id, nombre } — p. ej. los encargados de una actividad del Staff.
  if (clave === 'nombre') return obj.id !== undefined && ctx.ids.has(String(obj.id));
  if (CAMPOS_SOLO_NOMBRE_PERSONAL.includes(clave)) {
    return !obj.rol || ROLES_PERSONAL_INTERNO.includes(obj.rol);
  }
  return false;
}

// Reemplaza en el lugar; regresa true si cambió algo.
function reemplazarNombrePersonalEn(valor, ctx) {
  if (!valor || typeof valor !== 'object') return false;
  let cambio = false;
  if (Array.isArray(valor)) {
    valor.forEach((item) => { if (reemplazarNombrePersonalEn(item, ctx)) cambio = true; });
    return cambio;
  }
  Object.keys(valor).forEach((clave) => {
    const v = valor[clave];
    if (typeof v === 'string') {
      if (v === ctx.anterior && _debeRenombrarCampo(valor, clave, ctx)) {
        valor[clave] = ctx.nuevo;
        cambio = true;
      }
    } else if (v && typeof v === 'object') {
      if (reemplazarNombrePersonalEn(v, ctx)) cambio = true;
    }
  });
  return cambio;
}

// Igual que arriba, pero para un documento entero: regresa solo los
// campos de primer nivel que cambiaron (lo que se manda a update()).
function cambiosNombrePersonalEnDocumento(datos, ctx) {
  const cambios = {};
  Object.keys(datos).forEach((clave) => {
    const contenedor = { [clave]: datos[clave] };
    const copia = JSON.parse(JSON.stringify(contenedor));
    if (typeof datos[clave] === 'string') {
      if (datos[clave] === ctx.anterior && _debeRenombrarCampo(datos, clave, ctx)) cambios[clave] = ctx.nuevo;
    } else if (reemplazarNombrePersonalEn(copia, ctx)) {
      cambios[clave] = copia[clave];
    }
  });
  return cambios;
}

// cuenta: la cuenta interna (puede faltar si solo existe en Nómina).
// empleadoIds: registros de Nómina de esta persona.
async function renombrarPersonalInterno({ cuenta, empleadoIds = [], nombreAnterior, nombreNuevo }) {
  const anterior = String(nombreAnterior || '').trim();
  const nuevo = String(nombreNuevo || '').trim();
  if (!nuevo) return { ok: false, error: 'El nombre no puede quedar vacío.' };
  if (!anterior || anterior === nuevo) return { ok: true, registros: 0, errores: [] };

  const errores = [];
  let registros = 0;

  if (typeof dbFirestore === 'undefined' || !dbFirestore) return { ok: true, registros, errores };

  // Su registro de Nómina: el enlazado a la cuenta (en cualquiera de
  // los dos sentidos) o, si todavía no se enlaza, el del mismo nombre
  // y cargo — el mismo criterio que ya usa Actividades del Staff.
  const empleados = new Map();
  try {
    const col = dbFirestore.collection('nominaEmpleados');
    const consultas = [];
    empleadoIds.concat(cuenta?.empleadoNominaId || []).forEach(id => consultas.push(col.doc(String(id)).get().then(d => (d.exists ? [d] : []))));
    if (cuenta?.id) consultas.push(col.where('cuentaInternaId', '==', cuenta.id).get().then(s => s.docs));
    if (cuenta) consultas.push(col.where('nombre', '==', anterior).get().then(s => s.docs.filter(d => !d.data().cuentaInternaId && d.data().cargo === cuenta.rol)));
    (await Promise.all(consultas)).flat().forEach(d => empleados.set(d.id, d.ref));
  } catch (error) { errores.push('Nómina'); }

  const ids = new Set([cuenta?.id, cuenta?.usuario, cuenta?.firebaseUid, ...empleados.keys()].filter(Boolean).map(String));
  const ctx = { anterior, nuevo, ids };

  // Escrituras en lotes de hasta 400 (el límite de Firestore es 500).
  const pendientes = [];
  const encolar = (ref, cambios) => { pendientes.push([ref, cambios]); registros++; };

  if (cuenta?.firebaseUid) encolar(dbFirestore.collection('users').doc(cuenta.firebaseUid), { nombre: nuevo });
  empleados.forEach(ref => encolar(ref, { nombre: nuevo }));

  const revisarSnap = (snap) => {
    snap.docs.forEach((doc) => {
      if (pendientes.some(([ref]) => ref.path === doc.ref.path)) return;
      const cambios = cambiosNombrePersonalEnDocumento(doc.data(), ctx);
      if (Object.keys(cambios).length) encolar(doc.ref, cambios);
    });
  };

  // Actividad: por quién la hizo (id de la cuenta o su usuario) y, para
  // registros sin ese id, por el nombre exacto.
  try {
    const col = dbFirestore.collection('auditoria');
    const idsLista = [...ids].slice(0, 10);
    if (idsLista.length) revisarSnap(await col.where('usuarioId', 'in', idsLista).get());
    revisarSnap(await col.where('usuarioNombre', '==', anterior).get());
  } catch (error) { errores.push('Actividad'); }

  try {
    revisarSnap(await dbFirestore.collection('productos').where('ultimaAccion.empleado', '==', anterior).get());
  } catch (error) { errores.push('Catálogo'); }

  for (const coleccion of COLECCIONES_CON_NOMBRE_PERSONAL) {
    try {
      revisarSnap(await dbFirestore.collection(coleccion).get());
    } catch (error) {
      errores.push(coleccion);
    }
  }

  for (let i = 0; i < pendientes.length; i += 400) {
    const lote = dbFirestore.batch();
    pendientes.slice(i, i + 400).forEach(([ref, cambios]) => lote.set(ref, cambios, { merge: true }));
    try {
      await lote.commit();
    } catch (error) {
      errores.push('guardado');
      return { ok: false, error: 'No se pudo guardar el nombre nuevo: ' + (error && error.message ? error.message : 'error desconocido'), registros: 0, errores };
    }
  }

  return { ok: true, registros, errores };
}
