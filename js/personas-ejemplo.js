// MW JOYERÍA — Registro de Emprendedoras / Líderes (Admin)
//
// ⚠️ Nota de arquitectura: antes de esta página, cada módulo (apartados,
// equipo, cuenta) guardaba su propio dato de ejemplo aislado y ninguno
// compartía un mismo ID entre sí. Este archivo crea el registro único
// que la página de Admin necesita para buscar/editar personas.
// Para no inventar datos paralelos, reutiliza los MISMOS ids/nombres que
// ya usan los apartados de ejemplo (js/staff-apartados-ejemplo.js) — así
// la sección "Apartados"/"Compras" del perfil muestra datos reales, no
// inventados. El resto de módulos del sistema (Mi equipo, Mi cuenta de
// líder) seguirán usando sus propios datos de ejemplo por separado; no
// se modificaron para no romper Staff/Encargado ni las vistas de Líder.
//
// Fase 2 (Firebase): el registro completo ya sincroniza con Firestore
// (colección "personas") vía js/personas-firestore-sync.js — ver ese
// archivo para la caché/carga asíncrona. La contraseña sigue sin
// guardarse ahí (solo vive en Firebase Auth o en el localStorage del
// dispositivo que la creó/vio — ver PERSONAS_CREDENCIALES_STORAGE_KEY
// abajo), igual que ya se decidió para Cuentas internas.

const CATEGORIAS_PERSONA = { normal: 'Normal', vip: 'VIP', foranea: 'Foránea' };
const ESTADOS_CUENTA_PERSONA = { activa: 'Activa', inactiva: 'Inactiva', baja: 'Baja' };

// persona.alertaInactividad ({ desde: ISO } | null): bandera de
// "seguimiento" para líderes, calculada por
// js/alertas-inactividad-modelo.js cuando una Emprendedora lleva varias
// semanas sin compra mínima. NO es lo mismo que `estado` (activa/
// inactiva/baja) de arriba — esta bandera nunca bloquea el login ni
// afecta comisiones/rango, es solo una señal para que su línea de
// líderes la contacte y vea qué pasa.

const PERSONAS_STORAGE_KEY = 'mw_admin_personas_demo';

// Contraseñas guardadas APARTE del registro de personas (mapa id →
// password), no dentro de cada persona. Antes vivían como campo
// `password` en el mismo objeto que se lee para resolver un nombre en
// una búsqueda o para cruzar apartados — así, cualquier página que solo
// necesitaba "el nombre de María" (ej. Staff buscando a quién pertenece
// una lista de deseos) también recibía la contraseña en texto plano de
// TODAS las personas. Separarlas no oculta el dato de alguien que ya
// tiene la página abierta en devtools (localStorage sigue siendo del
// mismo origen — la barrera real llega con Firebase Auth), pero sí evita
// que la contraseña viaje junto con cada búsqueda/listado de nombres.
const PERSONAS_CREDENCIALES_STORAGE_KEY = 'mw_admin_personas_credenciales_demo';

function obtenerCredencialesPersonas() {
  try {
    const cred = JSON.parse(localStorage.getItem(PERSONAS_CREDENCIALES_STORAGE_KEY));
    return (cred && typeof cred === 'object' && !Array.isArray(cred)) ? cred : {};
  } catch (error) {
    return {};
  }
}

function guardarCredencialesPersonas(cred) {
  localStorage.setItem(PERSONAS_CREDENCIALES_STORAGE_KEY, JSON.stringify(cred));
}

// Único lugar que debe leer la contraseña real de una persona (Admin →
// Configuración → Usuarios y permisos → "Mostrar/ocultar").
function obtenerPasswordPersona(id) {
  return obtenerCredencialesPersonas()[id] || '';
}

function establecerPasswordPersona(id, nuevoPassword) {
  const cred = obtenerCredencialesPersonas();
  cred[id] = nuevoPassword;
  guardarCredencialesPersonas(cred);
}

function crearPersonaEjemplo(datos) {
  // La contraseña (si viene) se guarda aparte, nunca en el objeto que
  // regresa esta función — ver PERSONAS_CREDENCIALES_STORAGE_KEY arriba.
  if (datos.id && datos.password) establecerPasswordPersona(datos.id, datos.password);
  return {
    id: datos.id,
    nombre: datos.nombre || '',
    apellidos: datos.apellidos || '',
    tipo: datos.tipo || 'emprendedora', // 'emprendedora' | 'lider'
    categoria: datos.categoria || 'normal', // normal | vip | foranea
    estado: datos.estado || 'activa', // activa | inactiva | baja
    telefono: datos.telefono || '',
    correo: datos.correo || '',
    fotoUrl: datos.fotoUrl || '',
    usuario: datos.usuario || '',
    numeroCuenta: datos.numeroCuenta || '',
    fechaAlta: datos.fechaAlta || new Date().toISOString(),
    liderId: datos.liderId || null,
    // Quién la invitó (Solicitudes de inscripción). Casi siempre es la
    // misma persona que liderId, pero se guarda aparte porque liderId
    // puede cambiar más adelante (ver Admin → Emprendedoras/Líderes)
    // mientras que invitadaPor es un dato histórico que no cambia.
    invitadaPor: datos.invitadaPor || null,
    // Solo aplica cuando tipo === 'lider':
    rangoActualKey: datos.rangoActualKey || 'sin_rango',
    stats: datos.stats || {
      personasActivas: 0,
      produccionGrupalMes: 0,
      personasCalificadas: 0,
      compraPersonalPeriodo1: 0,
      compraPersonalPeriodo2: 0
    },
    // Detectado automáticamente por js/plan-mw-admin.js cuando una
    // líder ya cumple los requisitos del siguiente rango. Admin debe
    // confirmarlo — nunca sube sola. { rangoKey, detectadoEn }
    ascensoPendiente: datos.ascensoPendiente || null,
    // Aplica a ambos tipos — mismos campos que usan cuenta-ejemplo.js /
    // lider-cuenta-ejemplo.js (Reto de Constancia + boletos de rifa).
    // hitosOtorgados: hitos del Reto de Constancia ya CONFIRMADOS por
    // Admin ({ meses, premio, fecha }) — distinto de mesesCumplidos
    // (el conteo puede ya alcanzar un hito sin que Admin lo haya
    // confirmado/entregado todavía).
    constancia: { mesesCumplidos: 0, montoMesActual: 0, metaMes: 8000, hitosOtorgados: [], ...(datos.constancia || {}) },
    rifa: datos.rifa || { montoAcumuladoMes: 0, meta: 3000 },
    // Detectado automáticamente cuando mesesCumplidos alcanza un hito
    // todavía no otorgado. { meses, premio, detectadoEn }
    recompensaPendiente: datos.recompensaPendiente || null,
    // Historial de logros ya CONFIRMADOS (ascensos de rango y
    // recompensas de constancia entregadas), con fecha — es la fuente
    // de "Logros del periodo" en Admin → Plan MW. Se llena en el mismo
    // momento en que se confirma cada logro, nunca por captura manual.
    historialLogros: datos.historialLogros || []
  };
}

// Hitos del Reto de Constancia — mismos premios que cuenta-ejemplo.js,
// no se inventan otros.
const HITOS_CONSTANCIA_PERSONA = [
  { meses: 6, premio: 'Tablet' },
  { meses: 8, premio: 'Pantalla 43"' },
  { meses: 10, premio: 'Laptop' },
  { meses: 12, premio: 'Viaje x2' }
];

// SEC-03 de la auditoría: esta semilla llegó a tener ~21 Emprendedoras/
// Líderes de ejemplo (Ana Torres, MW0010..MW0026, me-lider, me-
// emprendedora) con contraseñas predecibles (usuario + iniciales) — el
// mismo problema que las cuentas internas de ejemplo de
// cuentas-internas-modelo.js. Nunca se van a usar en producción
// (confirmado con la dirección), así que se vació por completo: un
// proyecto nuevo arranca con la colección "personas" vacía hasta que
// Admin dé de alta Emprendedoras/Líderes reales (o se aprueben
// Solicitudes de inscripción reales). Las personas de ejemplo ya
// sembradas en el proyecto real de Firebase/Firestore se borran aparte
// con un script de Admin SDK (ver scripts/).
function construirPersonasEjemplo() {
  return [];
}

// Ya NO lee/escribe localStorage directo — ver js/personas-firestore-sync.js
// (cargado antes que este archivo), que llena PERSONAS_CACHE de forma
// asíncrona una sola vez (desde Firestore si hay config real, si no
// desde localStorage igual que antes) y expone guardarPersonasRepo() para
// escribir. Cualquier página que renderice personas en su primer render
// debe esperar `personasRepoListo` antes de llamar a obtenerPersonas().
function obtenerPersonas() {
  return PERSONAS_CACHE;
}

function guardarPersonas(personas) {
  guardarPersonasRepo(personas);
}

// Elimina la cuenta por completo (no es lo mismo que "estado: baja",
// que es reversible y no borra nada). Usado desde Configuración →
// Usuarios y permisos → Cuentas. Quien llame a esta función es
// responsable de mostrar la advertencia y registrar la auditoría —
// este archivo no depende de admin-comun.js.
async function eliminarPersona(id) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };

  // Sin esto, el perfil de login (users/{uid}) se quedaría huérfano y
  // esta persona podría seguir iniciando sesión aunque "ya no exista"
  // — mismo motivo por el que eliminarCuentaInterna hace lo mismo. El
  // acceso de Firebase Auth en sí no se puede borrar desde el
  // navegador (hace falta el SDK de administración); por eso, si se
  // vuelve a crear una cuenta con el mismo usuario, seguirá chocando
  // con "auth/email-already-in-use" hasta que se libere con ese script.
  if (persona.firebaseUid && typeof dbFirestore !== 'undefined' && dbFirestore) {
    try {
      await dbFirestore.collection('users').doc(persona.firebaseUid).delete();
    } catch (error) {
      return { ok: false, error: 'No se pudo eliminar el acceso real: ' + (error && error.message ? error.message : 'error desconocido') };
    }
  }

  guardarPersonas(personas.filter(p => p.id !== id));
  const cred = obtenerCredencialesPersonas();
  if (id in cred) {
    delete cred[id];
    guardarCredencialesPersonas(cred);
  }
  return { ok: true, persona };
}

// ============================================================
// SOLICITUD DE CAMBIO DE RAMA (primeros 5 días desde la inscripción)
// ============================================================
//
// Antes "Gestionar equipo" era solo solicitudes de baja — ahora es
// esto: si una emprendedora nueva quedó bajo la líder equivocada por
// error, cualquiera de las dos líderes involucradas (la que la tiene
// actualmente, o la que considera que debía quedar bajo ella) puede
// solicitar el cambio dentro de los primeros 5 días desde su alta.
// Solo aplica a Emprendedoras (nunca a Líderes) — Admin siempre
// confirma o rechaza, nunca se mueve de rama sola. Dar de baja a una
// persona sigue existiendo aparte, vía Configuración → editar cuenta.

const DIAS_LIMITE_CAMBIO_RAMA = 5;

function puedeSolicitarCambioRama(persona) {
  if (!persona || persona.tipo !== 'emprendedora' || persona.estado === 'baja') return false;
  if (persona.solicitudCambioRamaPendiente) return false;
  const limite = new Date(persona.fechaAlta).getTime() + DIAS_LIMITE_CAMBIO_RAMA * 24 * 60 * 60 * 1000;
  return Date.now() <= limite;
}

function crearSolicitudCambioRama(personaId, { liderPropuestaId, motivo, solicitadoPorId, solicitadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona) return { ok: false, error: 'La persona no existe.' };
  if (!puedeSolicitarCambioRama(persona)) return { ok: false, error: 'Ya pasaron los 5 días desde su inscripción, o ya hay una solicitud pendiente para ella.' };

  const liderPropuesta = personas.find(p => p.id === liderPropuestaId && p.tipo === 'lider' && p.estado !== 'baja');
  if (!liderPropuesta) return { ok: false, error: 'Elige a la líder a la que debería pasar.' };
  if (liderPropuesta.id === persona.liderId) return { ok: false, error: 'Ya está bajo esa líder.' };

  persona.solicitudCambioRamaPendiente = {
    liderActualId: persona.liderId || null,
    liderPropuestaId: liderPropuesta.id,
    motivo: motivo || '',
    solicitadoPorId: solicitadoPorId || null,
    solicitadoPorNombre: solicitadoPorNombre || '',
    fecha: new Date().toISOString()
  };
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `${solicitadoPorNombre} solicitó cambiar a ${nombreCompletoPersona(persona)} a la rama de ${nombreCompletoPersona(liderPropuesta)}${motivo ? `: "${motivo}"` : ''}. Revisa y confirma.`,
      link: `admin-emprendedoras-lideres.html?persona=${persona.id}`,
      paraId: 'admin01',
      rolDestino: 'admin',
      origen: 'emprendedora_lider'
    });
  }

  return { ok: true, persona };

}

function cancelarSolicitudCambioRama(personaId) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona || !persona.solicitudCambioRamaPendiente) return { ok: false, error: 'No hay una solicitud de cambio de rama pendiente.' };
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Ejecuta el cambio: mueve a la persona a la líder propuesta. No
// reasigna ni comprime nada más — una emprendedora recién inscrita
// (única elegible para este flujo) no tiene equipo propio todavía.
function ejecutarCambioRama(personaId, { ejecutadoPorId, ejecutadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona || !persona.solicitudCambioRamaPendiente) return { ok: false, error: 'No hay una solicitud de cambio de rama pendiente.' };

  const { liderActualId, liderPropuestaId } = persona.solicitudCambioRamaPendiente;
  persona.liderId = liderPropuestaId;
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Tu rama cambió — ahora perteneces al equipo de ${nombreCompletoPersona(obtenerPersonaPorId(liderPropuestaId))}.`,
      link: 'cuenta',
      paraId: persona.id,
      rolDestino: 'emprendedora_lider'
    });
  }

  return { ok: true, persona, liderActualId, liderPropuestaId };

}

// ============================================================
// CAMBIAR LÍDER — DIRECTO POR ADMIN (Lista A, fusión con mi-equipo)
// ============================================================
//
// A diferencia del flujo de arriba (solicitud, solo emprendedoras
// dentro de sus primeros 5 días, alguien tiene que aprobarla), esto es
// exclusivo de Admin: cambia de líder a cualquier emprendedora en el
// momento, sin solicitud ni aprobación — es un botón adicional, no
// reemplaza ni modifica el flujo de solicitud existente. Como el árbol
// se guarda por liderId (cada persona apunta a su líder, no al revés),
// cambiar SOLO el liderId de esta persona ya mueve automáticamente todo
// su subárbol con ella — sus descendientes siguen apuntándole a ELLA,
// no a la raíz.
function cambiarLiderDirectoAdmin(personaId, { liderNuevoId, ejecutadoPorId, ejecutadoPorNombre }) {

  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === personaId);
  if (!persona) return { ok: false, error: 'La persona no existe.' };

  const liderNuevo = personas.find(p => p.id === liderNuevoId && p.tipo === 'lider' && p.estado !== 'baja');
  if (!liderNuevo) return { ok: false, error: 'Elige a la líder a la que debería pasar.' };
  if (liderNuevo.id === persona.id) return { ok: false, error: 'No puede ser su propia líder.' };
  if (liderNuevo.id === persona.liderId) return { ok: false, error: 'Ya está bajo esa líder.' };

  // No permitir moverla bajo alguien de su propio equipo (evita un
  // ciclo: quedaría siendo líder de su propia líder).
  if (typeof calcularDescendenciaPersona === 'function') {
    const { conNivel } = calcularDescendenciaPersona(personaId);
    if (conNivel.some(n => n.persona.id === liderNuevo.id)) {
      return { ok: false, error: 'No puede pasar a la rama de alguien que está dentro de su propio equipo.' };
    }
  }

  const liderAnteriorId = persona.liderId || null;
  persona.liderId = liderNuevo.id;
  // Si tenía una solicitud de cambio de rama pendiente, esta acción de
  // Admin la vuelve obsoleta — se descarta en vez de dejarla colgada
  // apuntando a una líder que ya no aplica.
  delete persona.solicitudCambioRamaPendiente;
  guardarPersonas(personas);

  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Administración cambió tu equipo — ahora perteneces a la rama de ${nombreCompletoPersona(liderNuevo)}.`,
      link: 'cuenta',
      paraId: persona.id,
      rolDestino: 'emprendedora_lider'
    });
  }

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'personas',
      accion: 'cambiar_lider_directo',
      descripcion: `${nombreCompletoPersona(persona)} pasó de ${liderAnteriorId ? nombreCompletoPersona(obtenerPersonaPorId(liderAnteriorId) || {}) : 'sin líder'} a ${nombreCompletoPersona(liderNuevo)}`
    });
  }

  return { ok: true, persona, liderAnteriorId, liderNuevoId: liderNuevo.id };

}

function restablecerPasswordPersona(id, nuevoPassword) {
  const persona = obtenerPersonaPorId(id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  if (!nuevoPassword) return { ok: false, error: 'La nueva contraseña no puede estar vacía.' };
  establecerPasswordPersona(id, nuevoPassword);
  return { ok: true, persona };
}

function obtenerPersonaPorId(id) {
  return obtenerPersonas().find(p => p.id === id) || null;
}

// Usado por "Mi cuenta" de Emprendedora/Líder para guardar su propia
// foto de perfil (misma idea que editarCuentaInterna() para Staff/Encargado/
// Admin en cuentas-internas-modelo.js, pero sobre el registro de
// personas).
function actualizarFotoPersona(id, fotoUrl) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  persona.fotoUrl = fotoUrl || '';
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Datos para que Administración le deposite sus comisiones — solo
// tiene sentido para Líderes (Emprendedoras no cobran comisión), pero
// se deja disponible para cualquier persona por si algún día cambia.
// caratulaClabeUrl es una ruta de js/documentos-modelo.js (mismo patrón
// que la INE de Solicitudes) — nunca se guarda el archivo aquí, solo la
// referencia. Se deja fuera si no cambia (quien llama solo la manda
// cuando el usuario subió un archivo nuevo).
function actualizarDatosBancariosPersona(id, { titular, banco, clabe, caratulaClabeUrl }) {
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === id);
  if (!persona) return { ok: false, error: 'La cuenta no existe.' };
  persona.datosBancarios = {
    titular: (titular || '').trim(),
    banco: (banco || '').trim(),
    clabe: (clabe || '').trim(),
    caratulaClabeUrl: caratulaClabeUrl !== undefined ? caratulaClabeUrl : (persona.datosBancarios?.caratulaClabeUrl || null)
  };
  guardarPersonas(personas);
  return { ok: true, persona };
}

// Usado por js/auth-login.js para iniciar sesión como Emprendedora/Líder.
// Una persona 'inactiva' o 'baja' no puede iniciar sesión aunque conozca
// la contraseña, igual que una cuenta interna desactivada.
function verificarCredencialPersona(usuario, password) {
  const persona = obtenerPersonas().find(p => p.usuario === usuario && p.estado === 'activa');
  if (!persona) return null;
  return obtenerPasswordPersona(persona.id) === password ? persona : null;
}

function nombreCompletoPersona(p) {
  return [p.nombre, p.apellidos].filter(Boolean).join(' ');
}

// Utilidades genéricas compartidas por todas las páginas que consumen
// este registro (admin-emprendedoras.js, admin-plan-mw.js).
function formatearDineroPersonas(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}

function formatearFechaPersonas(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHTMLPersonas(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttributePersonas(texto) {
  return escapeHTMLPersonas(texto);
}

// Autocompletado genérico contra el registro real de Personas — antes
// vivía solo dentro de admin-emprendedoras.js (Admin → Emprendedoras/
// Líderes, para elegir líder/equipo); se movió aquí para que LOG-10 de
// la auditoría también pudiera reutilizarlo desde el formulario de
// "Nueva ventana de apartado" (staff/encargado/admin-apartados.js), sin
// duplicar el buscador.
function crearAutocompletePersonas({ inputEl, listEl, obtenerCandidatos, onSeleccionar, onLimpiar, limpiarInputAlSeleccionar }) {

  if (!inputEl || !listEl) return;

  inputEl.addEventListener('input', () => {

    const texto = inputEl.value.toLowerCase().trim();

    if (onLimpiar) onLimpiar();

    if (!texto) {
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    const candidatos = obtenerCandidatos(texto).slice(0, 8);

    if (!candidatos.length) {
      listEl.innerHTML = `<div class="persona-autocomplete-empty">Sin coincidencias.</div>`;
      listEl.hidden = false;
      return;
    }

    listEl.innerHTML = candidatos.map(p => `
      <button type="button" class="persona-autocomplete-item" data-persona-id="${p.id}">
        <span>${escapeHTMLPersonas(nombreCompletoPersona(p))}</span>
        <small>${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'}${p.liderId ? ` · Líder actual: ${escapeHTMLPersonas(nombreCompletoPersona(obtenerPersonaPorId(p.liderId) || {}))}` : ''}</small>
      </button>
    `).join('');

    listEl.hidden = false;

    listEl.querySelectorAll('[data-persona-id]').forEach(item => {
      item.addEventListener('click', () => {
        const persona = obtenerPersonaPorId(item.getAttribute('data-persona-id'));
        if (!persona) return;
        onSeleccionar(persona);
        if (limpiarInputAlSeleccionar) {
          inputEl.value = '';
        } else {
          inputEl.value = nombreCompletoPersona(persona);
        }
        listEl.hidden = true;
        listEl.innerHTML = '';
      });
    });

  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.hidden = true;
    }
  });

}

// Recorre el registro por liderId (equipo por niveles de una persona
// raíz). La usan Admin → Emprendedoras/Líderes (pestaña Equipo) y
// Admin → Comisiones (js/comisiones-modelo.js) — un solo recorrido de
// equipo, no dos árboles paralelos.
function calcularDescendenciaPersona(raizId) {

  const porLider = {};
  obtenerPersonas().forEach(p => {
    if (!p.liderId) return;
    (porLider[p.liderId] = porLider[p.liderId] || []).push(p);
  });

  const conNivel = [];
  (function recorrer(id, nivel) {
    (porLider[id] || []).forEach(hijo => {
      conNivel.push({ persona: hijo, nivel });
      recorrer(hijo.id, nivel + 1);
    });
  })(raizId, 1);

  return { conNivel, porLider };

}

// Inversa de calcularDescendenciaPersona: camina liderId hacia ARRIBA
// desde una persona, hasta maxNiveles líderes (o hasta llegar a la raíz
// del árbol, lo que pase primero). Usada por
// js/alertas-inactividad-modelo.js para avisarle a la línea de líderes
// de una Emprendedora — no filtra por estado, la propia líder decide si
// actúa aunque su cuenta esté marcada inactiva.
function calcularCadenaLideresHaciaArriba(personaId, maxNiveles) {
  const cadena = [];
  let actual = obtenerPersonaPorId(personaId);
  while (actual?.liderId && cadena.length < maxNiveles) {
    const lider = obtenerPersonaPorId(actual.liderId);
    if (!lider) break;
    cadena.push(lider);
    actual = lider;
  }
  return cadena;
}

// Usado por el módulo de Solicitudes de inscripción (js/solicitudes-modelo.js)
// para evitar cuentas duplicadas por correo o teléfono, tanto al enviar
// la solicitud como al aprobarla.
function existePersonaConCorreoOTelefono(correo, telefono, excluirId) {
  const correoNorm = String(correo || '').trim().toLowerCase();
  const telefonoNorm = String(telefono || '').replace(/\D/g, '');
  return obtenerPersonas().some(p => {
    if (excluirId && p.id === excluirId) return false;
    const mismoCorreo = correoNorm && String(p.correo || '').trim().toLowerCase() === correoNorm;
    const mismoTelefono = telefonoNorm && String(p.telefono || '').replace(/\D/g, '') === telefonoNorm;
    return mismoCorreo || mismoTelefono;
  });
}

// Arranca la carga de personas-firestore-sync.js — tiene que ser AQUÍ
// (no en ese archivo, que se carga primero) porque cargarPersonasRepo()
// necesita construirPersonasEjemplo(), definida arriba en este mismo
// archivo, para la semilla.
const personasRepoListo = cargarPersonasRepo();
