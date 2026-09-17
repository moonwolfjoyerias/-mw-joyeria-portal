// MW JOYERÍA — Actividades del Staff (motor de datos)
//
// RH organiza las actividades semanales de limpieza/orden del Staff
// (barrer, vitrinas, refrigerador, etc.), Staff confirma que se enteró,
// RH revisa físicamente y firma que se realizó, y Administración
// supervisa todo el proceso. Ver PROMPT "Actividades del Staff".
//
// Dos colecciones, igual que el resto del portal (nunca un sistema
// paralelo de usuarios/roles):
// - actividadesCatalogoStaff: catálogo reutilizable de actividades
//   (nombre + zona/vitrina), para que se puedan agregar nuevas sin
//   tocar código — ver agregarActividadCatalogoStaff.
// - actividadesStaff: las asignaciones reales de una semana concreta
//   (una fila de la tabla principal), con su propio estado.
// - historialActividadesStaff: historial append-only de cada cambio
//   de estado/encargado de una asignación (nunca se borra).
//
// Encargado = un empleado de Staff ACTIVO, tomado del mismo roster que
// ya usa Nómina (obtenerEmpleadosNomina, cargo === 'staff') — no se
// inventa un registro de personas nuevo.
//
// ⚠️ TEMPORAL: localStorage simula Firestore.

const ACTIVIDADES_STAFF_CATALOGO_KEY = 'mw-actividades-staff-catalogo-v1';
const ACTIVIDADES_STAFF_ASIGNACIONES_KEY = 'mw-actividades-staff-asignaciones-v1';
const ACTIVIDADES_STAFF_HISTORIAL_KEY = 'mw-actividades-staff-historial-v1';

// Solo estas tres — nunca quincenal/mensual/personalizada (corrección
// posterior: la periodicidad ahora también define QUÉ DÍAS, no solo
// cada cuánto). "x_dias" y "semanal" siempre traen un arreglo `dias`
// (ver DIAS_SEMANA_ACTIVIDAD_STAFF); "diaria" no necesita días.
const PERIODICIDADES_ACTIVIDAD_STAFF = {
  diaria: 'Diaria',
  x_dias: 'X días',
  semanal: 'Semanalmente'
};

// Toda actividad es "permanente" salvo que RH la marque "temporal" al
// crearla: existe solo dentro de [fechaInicioTemporal, fechaFinTemporal]
// y, después de realizarse, RH la elimina a mano (ver
// eliminarAsignacionActividadStaff) — nunca se borra sola.
const TIPOS_ACTIVIDAD_STAFF = {
  permanente: 'Permanente',
  temporal: 'Temporal'
};

function vigenciaTemporalActividadStaff(a) {
  if (!a || a.tipo !== 'temporal') return { aplica: false, vigente: true, vencida: false };
  const hoy = formatearFechaISOActividadStaff(new Date());
  const vigente = (!a.fechaInicioTemporal || a.fechaInicioTemporal <= hoy) && (!a.fechaFinTemporal || hoy <= a.fechaFinTemporal);
  const vencida = !!a.fechaFinTemporal && hoy > a.fechaFinTemporal;
  return { aplica: true, vigente, vencida };
}

function formatearFechaCortaActividadStaff(fechaISO) {
  if (!fechaISO) return '—';
  return new Date(`${fechaISO}T00:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
}

const DIAS_SEMANA_ACTIVIDAD_STAFF = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo'
};
const ORDEN_DIAS_ACTIVIDAD_STAFF = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

// Texto de la columna "Día": "Todos los días" para diaria, o los días
// elegidos en su orden natural de semana (nunca el orden en que se
// marcaron), unidos con "/".
function formatearDiasAsignacionActividadStaff(a) {
  if (!a) return '—';
  if (a.periodicidad === 'diaria') return 'Todos los días';
  if (!a.dias || !a.dias.length) return '—';
  return ORDEN_DIAS_ACTIVIDAD_STAFF
    .filter(d => a.dias.includes(d))
    .map(d => DIAS_SEMANA_ACTIVIDAD_STAFF[d])
    .join('/');
}

// "borrador" es un estado interno de organización (todavía no existe
// para Staff/RH/Admin como tal) — el flujo público que pide el prompt
// es exactamente Anunciado → Enterado → Firmado por RH; borrador es lo
// que hay ANTES de anunciar, mientras RH/Admin todavía arman la semana.
const ESTADOS_ACTIVIDAD_STAFF = {
  borrador: 'En organización',
  anunciado: 'Anunciado',
  enterado: 'Enterado',
  firmado_rh: 'Firmado por RH'
};

const BADGE_ESTADOS_ACTIVIDAD_STAFF = {
  borrador: 'badge-pendiente',
  anunciado: 'badge-revision',
  enterado: 'badge-validado',
  firmado_rh: 'badge-pagada'
};

// ============================================================
// CATÁLOGO DE ACTIVIDADES (reutilizable, agrupado por zona/vitrina)
// ============================================================

function construirCatalogoActividadesStaffEjemplo() {

  const grupos = [
    ['Actividades generales', [
      'Barrer', 'Trapear', 'Limpiar parte externa de las vitrinas',
      'Limpiar superficie superior de las vitrinas', 'Rellenar el refrigerador',
      'Limpieza del refrigerador', 'Limpiar zona de caja secundaria'
    ]],
    ['Vitrina de Cadenas', [
      'Acomodo', 'Limpieza interna de la vitrina', 'Limpieza de charolas',
      'Limpiar el piso debajo de las vitrinas', 'Revisión de charolas cafés'
    ]],
    ['Vitrina de anillos y Vitrina de dijes', [
      'Acomodo', 'Limpieza interna de la vitrina', 'Limpieza de las charolas',
      'Limpieza de bustos', 'Limpieza de repisas traslúcidas',
      'Intercambio y acomodo de collares', 'Limpieza debajo de las vitrinas (barrer)'
    ]],
    ['Vitrina de pulseras y Vitrina de Acero', [
      'Acomodo', 'Limpieza interna de la vitrina', 'Limpieza de charolas',
      'Limpiar mueble morado', 'Limpieza debajo de las vitrinas (barrer)'
    ]],
    ['Vitrina de exhibidores y refrigerador', [
      'Acomodo', 'Limpieza interna de vitrina',
      'Limpiar ventilador y parte superior del refrigerador',
      'Revisar sección de apartados y retirar caducados',
      'Revisión de charolas cafés', 'Limpieza debajo de las vitrinas (barrer)'
    ]],
    ['Exhibidores de Huggies y zona de collares', [
      'Acomodo', 'Limpieza de la vitrina de Huggies', 'Limpiar el mueble morado',
      'Limpieza del bote de basura', 'Limpieza debajo de las vitrinas (barrer)'
    ]]
  ];

  const catalogo = [];
  let contador = 1;
  grupos.forEach(([zona, actividades]) => {
    actividades.forEach(nombre => {
      catalogo.push({ id: `cat-act-${contador}`, nombre, zona, activo: true });
      contador++;
    });
  });
  return catalogo;

}

function obtenerCatalogoActividadesStaff() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_CATALOGO_KEY));
    if (Array.isArray(guardado) && guardado.length) return guardado;
  } catch (error) {
    // sigue abajo y reconstruye el ejemplo
  }
  const catalogo = construirCatalogoActividadesStaffEjemplo();
  guardarCatalogoActividadesStaff(catalogo);
  return catalogo;
}

function guardarCatalogoActividadesStaff(catalogo) {
  localStorage.setItem(ACTIVIDADES_STAFF_CATALOGO_KEY, JSON.stringify(catalogo));
}

function obtenerActividadCatalogoStaffPorId(id) {
  return obtenerCatalogoActividadesStaff().find(a => a.id === id) || null;
}

// Preparado para que RH/Admin agreguen actividades nuevas sin tocar
// código: si ya existe una con el mismo nombre+zona, la reutiliza en
// vez de duplicarla.
function agregarActividadCatalogoStaff({ nombre, zona }) {

  nombre = String(nombre || '').trim();
  zona = String(zona || 'Otra').trim() || 'Otra';

  if (!nombre) return { ok: false, error: 'El nombre de la actividad es obligatorio.' };

  const catalogo = obtenerCatalogoActividadesStaff();
  const existente = catalogo.find(a => a.nombre.toLowerCase() === nombre.toLowerCase() && a.zona.toLowerCase() === zona.toLowerCase());
  if (existente) return { ok: true, actividad: existente };

  const nueva = { id: `cat-act-${Date.now()}`, nombre, zona, activo: true };
  catalogo.push(nueva);
  guardarCatalogoActividadesStaff(catalogo);

  return { ok: true, actividad: nueva };

}

// Zonas en el mismo orden en que aparecen en el catálogo (útil para
// agrupar visualmente selects y checklists).
function zonasCatalogoActividadesStaff() {
  const catalogo = obtenerCatalogoActividadesStaff();
  const vistas = new Set();
  const zonas = [];
  catalogo.forEach(a => {
    if (!vistas.has(a.zona)) { vistas.add(a.zona); zonas.push(a.zona); }
  });
  return zonas;
}

// ============================================================
// SEMANA / PERIODO (mismo criterio semanal que ya usa Nómina)
// ============================================================

function lunesDeSemanaActividadStaff(fecha) {
  const d = new Date(fecha);
  const diaSemana = d.getDay();
  const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + offsetLunes);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function formatearFechaISOActividadStaff(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function semanaKeyDesdeFechaActividadStaff(fechaTexto) {
  return formatearFechaISOActividadStaff(lunesDeSemanaActividadStaff(fechaTexto ? `${fechaTexto}T00:00:00` : new Date()));
}

function semanaKeyActualActividadStaff() {
  return formatearFechaISOActividadStaff(lunesDeSemanaActividadStaff(new Date()));
}

function formatearRangoSemanaActividadStaff(semanaKey) {
  if (!semanaKey) return '—';
  const lunes = new Date(`${semanaKey}T00:00:00`);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  return `${fmt(lunes)} – ${fmt(domingo)} de ${domingo.getFullYear()}`;
}

// ============================================================
// EMPLEADOS DE STAFF (mismo roster que Nómina)
// ============================================================

// Usa la versión SIN campos financieros del roster — esta página solo
// necesita cruzar nombre/cargo, nunca sueldo/pago por hora de nadie
// (ver nota de seguridad en obtenerEmpleadosNominaBasico, nomina-modelo.js).
function empleadosStaffActivosActividad() {
  return (typeof obtenerEmpleadosNominaBasico === 'function' ? obtenerEmpleadosNominaBasico() : [])
    .filter(e => e.cargo === 'staff' && e.estado === 'activo');
}

// Vincula una cuenta interna (login) con su registro de Nómina — usa
// empleadoNominaId cuando existe (cuentas creadas desde Configuración
// ya lo traen) y si no, cae a hacer match por nombre (mismas 9
// personas de ejemplo en ambos registros, ver nota en nomina-modelo.js).
function empleadoNominaDeCuentaActividadStaff(cuenta) {
  if (!cuenta) return null;
  const empleados = typeof obtenerEmpleadosNominaBasico === 'function' ? obtenerEmpleadosNominaBasico() : [];
  if (cuenta.empleadoNominaId) {
    const directo = empleados.find(e => e.id === cuenta.empleadoNominaId);
    if (directo) return directo;
  }
  return empleados.find(e => e.nombre === cuenta.nombre) || null;
}

// ============================================================
// ASIGNACIONES (actividadesStaff)
// ============================================================

// Rellena en memoria (nunca reescribe localStorage por su cuenta) los
// campos que no existían antes de esta corrección — así cualquier
// asignación ya guardada (un solo encargadoId/encargadoNombre, sin
// tipo/eliminada) se ve exactamente igual que una nueva, sin necesitar
// una migración aparte. `encargadoId`/`encargadoNombre` (el primer
// responsable) se conservan siempre sincronizados para que Admin —que
// todavía no tiene el selector múltiple— siga funcionando sin cambios.
function normalizarAsignacionActividadStaff(a) {
  if (!a) return a;
  const encargados = Array.isArray(a.encargados)
    ? a.encargados
    : (a.encargadoId ? [{ id: a.encargadoId, nombre: a.encargadoNombre || '' }] : []);
  const estadosPorEncargado = (a.estadosPorEncargado && typeof a.estadosPorEncargado === 'object') ? a.estadosPorEncargado : {};
  return {
    ...a,
    tipo: a.tipo === 'temporal' ? 'temporal' : 'permanente',
    fechaInicioTemporal: a.fechaInicioTemporal || null,
    fechaFinTemporal: a.fechaFinTemporal || null,
    encargados,
    encargadoId: encargados[0]?.id || null,
    encargadoNombre: encargados[0]?.nombre || '',
    estadosPorEncargado,
    eliminada: !!a.eliminada,
    eliminadaPorId: a.eliminadaPorId || null,
    eliminadaPorNombre: a.eliminadaPorNombre || null,
    fechaEliminacion: a.fechaEliminacion || null
  };
}

// Arma la lista de {id, nombre} de Staff activo a partir de un arreglo
// de ids, ignorando cualquier id que ya no corresponda a alguien activo.
function empleadosDesdeIdsActividadStaff(ids) {
  const activos = empleadosStaffActivosActividad();
  return (ids || [])
    .map(id => activos.find(e => e.id === id))
    .filter(Boolean)
    .map(e => ({ id: e.id, nombre: e.nombre }));
}

function obtenerAsignacionesActividadStaff() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY));
    if (Array.isArray(guardadas)) return guardadas.map(normalizarAsignacionActividadStaff);
  } catch (error) {
    // sigue abajo
  }
  guardarAsignacionesActividadStaff([]);
  return [];
}

function guardarAsignacionesActividadStaff(lista) {
  localStorage.setItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY, JSON.stringify(lista));
}

function obtenerAsignacionActividadStaffPorId(id) {
  return obtenerAsignacionesActividadStaff().find(a => a.id === id) || null;
}

// Solo las activas (no eliminadas) — es la lista que debe verse en la
// tabla de organización de RH/Admin y en "Mis actividades" de Staff.
// Las funciones que leen-modifican-guardan la lista COMPLETA (crear,
// actualizar, sorteo, eliminar) usan obtenerAsignacionesActividadStaff()
// directamente, nunca esta, para no perder al guardar las que sí están
// eliminadas (eliminar es lógico, no debe desaparecer de Firestore).
function obtenerAsignacionesPorSemanaActividadStaff(semanaKey) {
  return obtenerAsignacionesActividadStaff().filter(a => a.semanaKey === semanaKey && !a.eliminada);
}

// Valida periodicidad + días (null/[] es válido SOLO cuando todavía no
// se ha definido — ver asegurarAsignacionesBaseSemana). Cuando sí se
// manda una periodicidad, exige los días que correspondan.
function validarPeriodicidadYDiasActividadStaff(periodicidad, dias) {
  if (!periodicidad) return { ok: true, periodicidad: null, dias: [] };
  if (!PERIODICIDADES_ACTIVIDAD_STAFF[periodicidad]) return { ok: false, error: 'Selecciona una periodicidad válida.' };
  if (periodicidad === 'diaria') return { ok: true, periodicidad, dias: [] };
  const diasValidos = (dias || []).filter(d => DIAS_SEMANA_ACTIVIDAD_STAFF[d]);
  if (periodicidad === 'x_dias' && !diasValidos.length) return { ok: false, error: 'Selecciona al menos un día de la semana.' };
  if (periodicidad === 'semanal' && diasValidos.length !== 1) return { ok: false, error: 'Selecciona un único día de la semana.' };
  return { ok: true, periodicidad, dias: diasValidos };
}

// Nombre/zona pueden venir de un catálogo existente (actividadCatalogoId)
// o de una actividad nueva escrita a mano (nombreNuevo/zonaNueva), que
// de paso queda guardada en el catálogo para reutilizarse después. La
// periodicidad es OBLIGATORIA salvo cuando permitirSinPeriodicidad es
// true (solo lo usa asegurarAsignacionesBaseSemana, para que las
// actividades base aparezcan desde el inicio sin que nadie tenga que
// definir todavía cada cuánto se hacen).
// encargadoIds (arreglo, RH) o encargadoId (singular, todavía usado por
// Admin) — se acepta cualquiera de los dos; si mandan ambos gana el
// arreglo. tipo/fechaInicioTemporal/fechaFinTemporal son opcionales
// (por default toda actividad es "permanente").
function crearAsignacionActividadStaff({ actividadCatalogoId, nombreNuevo, zonaNueva, periodicidad, dias, encargadoId, encargadoIds, semanaKey, observaciones, creadoPorId, creadoPorNombre, creadoPorRol, permitirSinPeriodicidad, tipo, fechaInicioTemporal, fechaFinTemporal }) {

  let catalogoEntry = actividadCatalogoId ? obtenerActividadCatalogoStaffPorId(actividadCatalogoId) : null;

  if (!catalogoEntry) {
    const resultado = agregarActividadCatalogoStaff({ nombre: nombreNuevo, zona: zonaNueva });
    if (!resultado.ok) return resultado;
    catalogoEntry = resultado.actividad;
  }

  if (!periodicidad && !permitirSinPeriodicidad) return { ok: false, error: 'Selecciona una periodicidad.' };
  const validacion = validarPeriodicidadYDiasActividadStaff(periodicidad, dias);
  if (!validacion.ok) return validacion;

  if (!semanaKey) return { ok: false, error: 'Indica a qué semana corresponde.' };

  const tipoFinal = tipo === 'temporal' ? 'temporal' : 'permanente';
  if (tipoFinal === 'temporal') {
    if (!fechaInicioTemporal || !fechaFinTemporal) return { ok: false, error: 'Indica la fecha de inicio y la fecha límite de la actividad temporal.' };
    if (fechaFinTemporal < fechaInicioTemporal) return { ok: false, error: 'La fecha límite no puede ser anterior a la fecha de inicio.' };
  }

  const idsSolicitados = Array.isArray(encargadoIds) ? encargadoIds : (encargadoId ? [encargadoId] : []);
  const encargados = empleadosDesdeIdsActividadStaff(idsSolicitados);
  if (idsSolicitados.length && encargados.length !== idsSolicitados.length) {
    return { ok: false, error: 'Alguno de los responsables seleccionados ya no es un empleado de Staff activo.' };
  }

  const asignaciones = obtenerAsignacionesActividadStaff();

  const nueva = {
    id: `act-staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actividadCatalogoId: catalogoEntry.id,
    nombre: catalogoEntry.nombre,
    zona: catalogoEntry.zona,
    tipo: tipoFinal,
    fechaInicioTemporal: tipoFinal === 'temporal' ? fechaInicioTemporal : null,
    fechaFinTemporal: tipoFinal === 'temporal' ? fechaFinTemporal : null,
    periodicidad: validacion.periodicidad,
    dias: validacion.dias,
    encargados,
    encargadoId: encargados[0]?.id || null,
    encargadoNombre: encargados[0]?.nombre || '',
    estadosPorEncargado: {},
    semanaKey,
    observaciones: observaciones || '',
    estado: 'borrador',
    sorteada: false,
    fechaCreacion: new Date().toISOString(),
    fechaAnuncio: null,
    fechaEnterado: null,
    enteradoPorId: null,
    enteradoPorNombre: null,
    fechaFirmaRH: null,
    firmadoPorId: null,
    firmadoPorNombre: null,
    creadoPorId: creadoPorId || null,
    creadoPorNombre: creadoPorNombre || '',
    creadoPorRol: creadoPorRol || '',
    eliminada: false,
    eliminadaPorId: null,
    eliminadaPorNombre: null,
    fechaEliminacion: null
  };

  asignaciones.unshift(nueva);
  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: nueva.id,
    estadoAnterior: null,
    estadoNuevo: 'borrador',
    usuarioId: creadoPorId,
    usuarioNombre: creadoPorNombre,
    usuarioRol: creadoPorRol,
    comentario: `Actividad${tipoFinal === 'temporal' ? ' temporal' : ''} creada para la semana del ${formatearRangoSemanaActividadStaff(semanaKey)}${tipoFinal === 'temporal' ? ` (vigente del ${formatearFechaCortaActividadStaff(fechaInicioTemporal)} al ${formatearFechaCortaActividadStaff(fechaFinTemporal)})` : ''}.`
  });

  return { ok: true, asignacion: nueva };

}

// ============================================================
// ACTIVIDADES BASE — deben aparecer YA cargadas, sin que nadie tenga
// que crearlas una por una (corrección posterior). Se siembran de
// forma perezosa la primera vez que se pide una semana: por cada
// actividad del catálogo que todavía no tenga una asignación en esa
// semana, se crea una en "borrador" sin periodicidad ni encargado
// (RH/Admin los definen después) — nunca se asume la periodicidad.
// Es idempotente: nunca duplica una actividad que ya exista para esa
// semana, sea porque ya se sembró antes o porque alguien la creó a
// mano.
function asegurarAsignacionesBaseSemana(semanaKey) {

  if (!semanaKey) return;

  const catalogo = obtenerCatalogoActividadesStaff();
  const asignaciones = obtenerAsignacionesActividadStaff();
  // Se consideran TODAS las asignaciones de esa semana, incluidas las
  // eliminadas: una actividad que RH eliminó para esta semana ya está
  // "resuelta" y no debe volver a sembrarse como borrador nuevo.
  const existentes = asignaciones.filter(a => a.semanaKey === semanaKey);
  const catalogoIdsExistentes = new Set(existentes.map(a => a.actividadCatalogoId));

  const faltantes = catalogo.filter(c => !catalogoIdsExistentes.has(c.id));
  if (!faltantes.length) return;

  faltantes.forEach(catalogoEntry => {
    const nueva = {
      id: `act-staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actividadCatalogoId: catalogoEntry.id,
      nombre: catalogoEntry.nombre,
      zona: catalogoEntry.zona,
      tipo: 'permanente',
      fechaInicioTemporal: null,
      fechaFinTemporal: null,
      periodicidad: null,
      dias: [],
      encargados: [],
      encargadoId: null,
      encargadoNombre: '',
      estadosPorEncargado: {},
      semanaKey,
      observaciones: '',
      estado: 'borrador',
      sorteada: false,
      fechaCreacion: new Date().toISOString(),
      fechaAnuncio: null,
      fechaEnterado: null,
      enteradoPorId: null,
      enteradoPorNombre: null,
      fechaFirmaRH: null,
      firmadoPorId: null,
      firmadoPorNombre: null,
      creadoPorId: null,
      creadoPorNombre: 'Sistema',
      creadoPorRol: 'sistema',
      eliminada: false,
      eliminadaPorId: null,
      eliminadaPorNombre: null,
      fechaEliminacion: null
    };
    asignaciones.push(nueva);
  });

  guardarAsignacionesActividadStaff(asignaciones);

}

// Edición general (periodicidad/semana/observaciones/encargado) — el
// cambio de encargado siempre queda en el historial (sección 12 del
// prompt), y cualquier cambio hecho DESPUÉS de anunciada también.
function actualizarAsignacionActividadStaff(id, cambios, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const asignacion = asignaciones.find(a => a.id === id);
  if (!asignacion) return { ok: false, error: 'La actividad no existe.' };

  const yaAnunciada = asignacion.estado !== 'borrador';
  const cambiosTexto = [];

  // encargadoIds (arreglo, RH) reemplaza la lista completa de
  // responsables. encargadoId (singular, todavía usado por Admin) se
  // sigue aceptando — equivale a "deja un único responsable".
  if (cambios.encargadoIds !== undefined || cambios.encargadoId !== undefined) {
    const idsNuevos = Array.isArray(cambios.encargadoIds) ? cambios.encargadoIds : (cambios.encargadoId ? [cambios.encargadoId] : []);
    const idsActuales = (asignacion.encargados || []).map(e => e.id);
    if (JSON.stringify([...idsNuevos].sort()) !== JSON.stringify([...idsActuales].sort())) {
      const nuevosEncargados = empleadosDesdeIdsActividadStaff(idsNuevos);
      if (idsNuevos.length && nuevosEncargados.length !== idsNuevos.length) {
        return { ok: false, error: 'Alguno de los responsables seleccionados ya no es un empleado de Staff activo.' };
      }
      const nombresAntes = (asignacion.encargados || []).map(e => e.nombre).join(', ') || 'sin asignar';
      const nombresDespues = nuevosEncargados.map(e => e.nombre).join(', ') || 'sin asignar';
      cambiosTexto.push(`Responsable(s): ${nombresAntes} → ${nombresDespues}.`);
      const idsAntesSet = new Set(idsActuales);
      const estabaAnunciada = asignacion.estado === 'anunciado' || asignacion.estado === 'enterado';
      asignacion.encargados = nuevosEncargados;
      asignacion.encargadoId = nuevosEncargados[0]?.id || null;
      asignacion.encargadoNombre = nuevosEncargados[0]?.nombre || '';
      // Al cambiar la lista de responsables se reinicia la confirmación
      // individual de quien ya no está — nunca se le atribuye a alguien
      // un "Enterado" de una actividad que ya no le corresponde. A quien
      // se agrega a una actividad YA anunciada se le da entrada "anunciado"
      // (sin confirmar) y se le notifica, igual que en el anuncio original
      // — nunca hereda un "enterado" que nunca confirmó.
      const estadosNuevos = {};
      const nuevosSinNotificar = [];
      nuevosEncargados.forEach(e => {
        if (asignacion.estadosPorEncargado?.[e.id]) {
          estadosNuevos[e.id] = asignacion.estadosPorEncargado[e.id];
        } else if (estabaAnunciada && !idsAntesSet.has(e.id)) {
          estadosNuevos[e.id] = { estado: 'anunciado', fecha: new Date().toISOString() };
          nuevosSinNotificar.push(e);
        }
      });
      asignacion.estadosPorEncargado = estadosNuevos;
      // El estado agregado se recalcula: si alguien queda sin confirmar
      // (porque se agregó o porque el único que faltaba se quitó),
      // vuelve a "anunciado" en espera de esa confirmación; si con la
      // lista nueva ya todos confirmaron, pasa a "enterado".
      if (estabaAnunciada) {
        const todosConfirmanAhora = nuevosEncargados.length > 0 &&
          nuevosEncargados.every(e => estadosNuevos[e.id]?.estado === 'enterado');
        asignacion.estado = todosConfirmanAhora ? 'enterado' : 'anunciado';
      }
      if (nuevosSinNotificar.length && typeof agregarNotificacion === 'function') {
        const detalleFecha = asignacion.tipo === 'temporal'
          ? `Fecha límite: ${formatearFechaCortaActividadStaff(asignacion.fechaFinTemporal)}.`
          : `Semana del ${formatearRangoSemanaActividadStaff(asignacion.semanaKey)}.`;
        nuevosSinNotificar.forEach(e => {
          agregarNotificacion({
            texto: `${e.nombre}, tienes una nueva actividad${asignacion.tipo === 'temporal' ? ' temporal' : ''} asignada: "${asignacion.nombre}" (${asignacion.zona}). ${detalleFecha}`,
            link: 'misActividades',
            rolDestino: 'staff',
            paraId: e.id
          });
        });
      }
    }
  }
  if (cambios.tipo !== undefined && cambios.tipo !== asignacion.tipo) {
    if (cambios.tipo === 'temporal' && (!cambios.fechaInicioTemporal || !cambios.fechaFinTemporal)) {
      return { ok: false, error: 'Indica la fecha de inicio y la fecha límite de la actividad temporal.' };
    }
    cambiosTexto.push(`Tipo: ${TIPOS_ACTIVIDAD_STAFF[asignacion.tipo]} → ${TIPOS_ACTIVIDAD_STAFF[cambios.tipo] || cambios.tipo}.`);
    asignacion.tipo = cambios.tipo === 'temporal' ? 'temporal' : 'permanente';
    asignacion.fechaInicioTemporal = asignacion.tipo === 'temporal' ? cambios.fechaInicioTemporal : null;
    asignacion.fechaFinTemporal = asignacion.tipo === 'temporal' ? cambios.fechaFinTemporal : null;
  } else if (asignacion.tipo === 'temporal' && (cambios.fechaInicioTemporal !== undefined || cambios.fechaFinTemporal !== undefined)) {
    const nuevoInicio = cambios.fechaInicioTemporal ?? asignacion.fechaInicioTemporal;
    const nuevoFin = cambios.fechaFinTemporal ?? asignacion.fechaFinTemporal;
    if (nuevoInicio !== asignacion.fechaInicioTemporal || nuevoFin !== asignacion.fechaFinTemporal) {
      if (nuevoFin < nuevoInicio) return { ok: false, error: 'La fecha límite no puede ser anterior a la fecha de inicio.' };
      cambiosTexto.push(`Vigencia: ${formatearFechaCortaActividadStaff(asignacion.fechaInicioTemporal)}–${formatearFechaCortaActividadStaff(asignacion.fechaFinTemporal)} → ${formatearFechaCortaActividadStaff(nuevoInicio)}–${formatearFechaCortaActividadStaff(nuevoFin)}.`);
      asignacion.fechaInicioTemporal = nuevoInicio;
      asignacion.fechaFinTemporal = nuevoFin;
    }
  }
  if (cambios.periodicidad !== undefined && (cambios.periodicidad !== asignacion.periodicidad || JSON.stringify(cambios.dias || []) !== JSON.stringify(asignacion.dias || []))) {
    const validacion = validarPeriodicidadYDiasActividadStaff(cambios.periodicidad, cambios.dias);
    if (!validacion.ok) return validacion;
    const anteriorTexto = asignacion.periodicidad ? `${PERIODICIDADES_ACTIVIDAD_STAFF[asignacion.periodicidad]} (${formatearDiasAsignacionActividadStaff(asignacion)})` : 'sin definir';
    asignacion.periodicidad = validacion.periodicidad;
    asignacion.dias = validacion.dias;
    const nuevoTexto = asignacion.periodicidad ? `${PERIODICIDADES_ACTIVIDAD_STAFF[asignacion.periodicidad]} (${formatearDiasAsignacionActividadStaff(asignacion)})` : 'sin definir';
    cambiosTexto.push(`Periodicidad: ${anteriorTexto} → ${nuevoTexto}.`);
  }
  if (cambios.semanaKey !== undefined && cambios.semanaKey !== asignacion.semanaKey) {
    cambiosTexto.push(`Semana: ${formatearRangoSemanaActividadStaff(asignacion.semanaKey)} → ${formatearRangoSemanaActividadStaff(cambios.semanaKey)}.`);
    asignacion.semanaKey = cambios.semanaKey;
  }
  if (cambios.observaciones !== undefined && cambios.observaciones !== asignacion.observaciones) {
    asignacion.observaciones = cambios.observaciones;
    cambiosTexto.push('Observaciones actualizadas.');
  }

  if (!cambiosTexto.length) return { ok: true, asignacion };

  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: asignacion.id,
    estadoAnterior: asignacion.estado,
    estadoNuevo: asignacion.estado,
    usuarioId, usuarioNombre, usuarioRol,
    comentario: (yaAnunciada ? '[Cambio tras anunciar] ' : '') + cambiosTexto.join(' ')
  });

  return { ok: true, asignacion };

}

// ============================================================
// SORTEO POR ZONA/VITRINA (corrección posterior — reparto equilibrado
// entre Staff activo, siempre por zona completa, nunca actividad por
// actividad: todas las actividades de una misma zona quedan con el
// mismo encargado, ver sección 4-5 del prompt).
// ============================================================

// No persiste nada — solo arma una propuesta para revisar antes de
// guardarla. Reparte las ZONAS elegidas entre el Staff activo
// (round-robin sobre listas barajadas, para un reparto equilibrado) y
// agrupa, dentro de cada zona, las actividades de esa semana que
// todavía están en "borrador" (las ya anunciadas no se tocan).
function sortearZonasActividadStaff(semanaKey, zonas) {

  const staffActivos = empleadosStaffActivosActividad();
  if (!staffActivos.length) return { ok: false, error: 'No hay empleados de Staff activos para repartir actividades.' };

  const zonasValidas = (zonas || []).filter(Boolean);
  if (!zonasValidas.length) return { ok: false, error: 'Selecciona al menos una zona/vitrina para sortear.' };

  const asignacionesSemana = obtenerAsignacionesPorSemanaActividadStaff(semanaKey);

  const zonasConActividades = zonasValidas
    .map(zona => ({ zona, actividades: asignacionesSemana.filter(a => a.zona === zona && a.estado === 'borrador') }))
    .filter(z => z.actividades.length);

  if (!zonasConActividades.length) return { ok: false, error: 'Las zonas seleccionadas no tienen actividades pendientes de organizar en esta semana.' };

  const zonasBarajadas = [...zonasConActividades].sort(() => Math.random() - 0.5);
  const staffBarajado = [...staffActivos].sort(() => Math.random() - 0.5);

  const resultado = zonasBarajadas.map((z, i) => {
    const encargado = staffBarajado[i % staffBarajado.length];
    return {
      zona: z.zona,
      encargadoId: encargado.id,
      encargadoNombre: encargado.nombre,
      actividades: z.actividades.map(a => ({ asignacionId: a.id, nombre: a.nombre }))
    };
  });

  return { ok: true, resultado };

}

// Persiste el resultado (ya revisado/editado a mano si hacía falta) —
// las actividades siguen en "borrador" hasta que se anuncien aparte.
// Un solo renglón de historial por actividad (para poder consultarlo
// desde su propio detalle), mencionando que vino de un sorteo por zona.
function aplicarResultadoSorteoZonasActividadStaff(resultado, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  let aplicadas = 0;

  resultado.forEach(grupo => {
    grupo.actividades.forEach(fila => {
      const asignacion = asignaciones.find(a => a.id === fila.asignacionId);
      if (!asignacion || asignacion.estado !== 'borrador') return;
      const anterior = asignacion.encargadoNombre || 'sin asignar';
      asignacion.encargados = [{ id: grupo.encargadoId, nombre: grupo.encargadoNombre }];
      asignacion.encargadoId = grupo.encargadoId;
      asignacion.encargadoNombre = grupo.encargadoNombre;
      asignacion.estadosPorEncargado = {};
      asignacion.sorteada = true;
      aplicadas++;
      registrarHistorialActividadStaff({
        actividadId: asignacion.id,
        estadoAnterior: asignacion.estado,
        estadoNuevo: asignacion.estado,
        usuarioId, usuarioNombre, usuarioRol,
        comentario: `Encargado asignado por sorteo de zona (${grupo.zona}): ${anterior} → ${grupo.encargadoNombre}.`
      });
    });
  });

  guardarAsignacionesActividadStaff(asignaciones);
  return { ok: true, cantidad: aplicadas };

}

// ============================================================
// TRANSICIONES DE ESTADO (Anunciado → Enterado → Firmado por RH)
// ============================================================

// Solo actividades en borrador CON al menos un responsable asignado
// pueden anunciarse. Cada responsable recibe SU PROPIA notificación,
// con su nombre — nunca un aviso genérico compartido (sección 4).
function anunciarAsignacionesActividadStaff(ids, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const anunciadas = [];

  ids.forEach(id => {
    const a = asignaciones.find(x => x.id === id);
    if (!a || a.estado !== 'borrador' || !a.encargados?.length) return;
    a.estado = 'anunciado';
    a.fechaAnuncio = new Date().toISOString();
    a.estadosPorEncargado = {};
    a.encargados.forEach(e => { a.estadosPorEncargado[e.id] = { estado: 'anunciado', fecha: a.fechaAnuncio }; });
    const nombresResponsables = a.encargados.map(e => e.nombre).join(', ');
    registrarHistorialActividadStaff({
      actividadId: a.id, estadoAnterior: 'borrador', estadoNuevo: 'anunciado',
      usuarioId, usuarioNombre, usuarioRol, comentario: `Actividad anunciada a ${nombresResponsables}.`
    });
    anunciadas.push(a);
  });

  if (!anunciadas.length) return { ok: false, error: 'No hay actividades listas para anunciar (deben estar en organización y con responsable(s) asignado(s)).' };

  guardarAsignacionesActividadStaff(asignaciones);

  if (typeof agregarNotificacion === 'function') {
    anunciadas.forEach(a => {
      const detalleFecha = a.tipo === 'temporal'
        ? `Fecha límite: ${formatearFechaCortaActividadStaff(a.fechaFinTemporal)}.`
        : `Semana del ${formatearRangoSemanaActividadStaff(a.semanaKey)}.`;
      a.encargados.forEach(e => {
        agregarNotificacion({
          texto: `${e.nombre}, tienes una nueva actividad${a.tipo === 'temporal' ? ' temporal' : ''} asignada: "${a.nombre}" (${a.zona}). ${detalleFecha}`,
          link: 'misActividades',
          rolDestino: 'staff',
          paraId: e.id
        });
      });
    });
  }

  return { ok: true, cantidad: anunciadas.length, asignaciones: anunciadas };

}

// Cada responsable confirma POR SU CUENTA — nunca una sola confirmación
// compartida entre varios (sección 4). Solo mientras la actividad esté
// "anunciado" y solo si esa persona es una de las responsables.
function marcarEnteradoAsignacionActividadStaff(id, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const a = asignaciones.find(x => x.id === id);
  if (!a) return { ok: false, error: 'La actividad no existe.' };
  if (a.estado !== 'anunciado') return { ok: false, error: 'Esta actividad ya no está en espera de confirmación.' };
  const esResponsable = (a.encargados || []).some(e => e.id === usuarioId);
  if (!esResponsable) return { ok: false, error: 'Solo una persona responsable puede confirmar esta actividad.' };

  const fecha = new Date().toISOString();
  a.estadosPorEncargado = a.estadosPorEncargado || {};
  a.estadosPorEncargado[usuarioId] = { estado: 'enterado', fecha, nombre: usuarioNombre };

  // Campos legacy (un solo encargado) — se conservan con la ÚLTIMA
  // persona en confirmar, para que las páginas que todavía no muestran
  // varios responsables sigan enseñando algo razonable.
  a.fechaEnterado = fecha;
  a.enteradoPorId = usuarioId;
  a.enteradoPorNombre = usuarioNombre;

  // El estado general de la actividad solo pasa a "enterado" (y con
  // eso queda lista para que RH firme) cuando TODOS los responsables ya
  // confirmaron — nunca con que uno solo lo haga.
  const todosConfirmaron = a.encargados.every(e => a.estadosPorEncargado[e.id]?.estado === 'enterado');
  if (todosConfirmaron) a.estado = 'enterado';

  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: a.id, estadoAnterior: 'anunciado', estadoNuevo: a.estado,
    usuarioId, usuarioNombre, usuarioRol: usuarioRol || 'staff',
    comentario: `${usuarioNombre} confirmó que se enteró de la actividad.${a.encargados.length > 1 ? (todosConfirmaron ? ' Todos los responsables ya confirmaron.' : ` Faltan: ${a.encargados.filter(e => a.estadosPorEncargado[e.id]?.estado !== 'enterado').map(e => e.nombre).join(', ')}.`) : ''}`
  });

  return { ok: true, asignacion: a };

}

// Solo RH/Admin, y solo después de que Staff ya confirmó ("enterado") —
// es la verificación física de que la actividad sí se realizó.
function firmarRHAsignacionActividadStaff(id, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const a = asignaciones.find(x => x.id === id);
  if (!a) return { ok: false, error: 'La actividad no existe.' };
  if (a.estado !== 'enterado') return { ok: false, error: 'Solo se puede firmar una actividad que el Staff ya confirmó ("Enterado").' };

  a.estado = 'firmado_rh';
  a.fechaFirmaRH = new Date().toISOString();
  a.firmadoPorId = usuarioId;
  a.firmadoPorNombre = usuarioNombre;

  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: a.id, estadoAnterior: 'enterado', estadoNuevo: 'firmado_rh',
    usuarioId, usuarioNombre, usuarioRol,
    comentario: `${usuarioNombre} (${usuarioRol === 'admin' ? 'Administración' : 'RH'}) verificó y firmó que la actividad se realizó.`
  });

  return { ok: true, asignacion: a };

}

// ============================================================
// ELIMINAR (lógico — nunca borra historial/auditoría)
// ============================================================
//
// RH puede eliminar CUALQUIER actividad, permanente o temporal,
// anunciada o no (sección 2). Nunca se borra físicamente: se marca
// eliminada + quién + cuándo, y deja de aparecer en las vistas activas
// (obtenerAsignacionesPorSemanaActividadStaff ya filtra eliminada:true),
// pero el registro y todo su historial siguen existiendo para
// auditoría — obtenerAsignacionActividadStaffPorId y
// obtenerHistorialPorActividadStaff la siguen encontrando.
function eliminarAsignacionActividadStaff(id, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const a = asignaciones.find(x => x.id === id);
  if (!a) return { ok: false, error: 'La actividad no existe.' };
  if (a.eliminada) return { ok: false, error: 'Esta actividad ya fue eliminada.' };

  a.eliminada = true;
  a.eliminadaPorId = usuarioId;
  a.eliminadaPorNombre = usuarioNombre;
  a.fechaEliminacion = new Date().toISOString();

  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: a.id, estadoAnterior: a.estado, estadoNuevo: a.estado,
    usuarioId, usuarioNombre, usuarioRol,
    comentario: `Actividad eliminada por ${usuarioNombre} (${usuarioRol === 'admin' ? 'Administración' : 'RH'}). El historial se conserva para auditoría.`
  });

  return { ok: true, asignacion: a };

}

// ============================================================
// HISTORIAL (historialActividadesStaff — nunca se borra)
// ============================================================

function obtenerHistorialActividadStaff() {
  try {
    const guardado = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_HISTORIAL_KEY));
    if (Array.isArray(guardado)) return guardado;
  } catch (error) {
    // sigue abajo
  }
  guardarHistorialActividadStaff([]);
  return [];
}

function guardarHistorialActividadStaff(historial) {
  localStorage.setItem(ACTIVIDADES_STAFF_HISTORIAL_KEY, JSON.stringify(historial));
}

function registrarHistorialActividadStaff({ actividadId, estadoAnterior, estadoNuevo, usuarioId, usuarioNombre, usuarioRol, comentario }) {
  const historial = obtenerHistorialActividadStaff();
  historial.unshift({
    id: `hist-act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actividadId,
    estadoAnterior: estadoAnterior || null,
    estadoNuevo: estadoNuevo || null,
    usuarioId: usuarioId || null,
    usuarioNombre: usuarioNombre || '',
    usuarioRol: usuarioRol || '',
    fecha: new Date().toISOString(),
    comentario: comentario || ''
  });
  guardarHistorialActividadStaff(historial);
}

function obtenerHistorialPorActividadStaff(actividadId) {
  return obtenerHistorialActividadStaff().filter(h => h.actividadId === actividadId);
}

// ============================================================
// REPORTE SEMANAL — regla especial de "No se realizó" (sección 11)
// ============================================================
//
// El reporte NUNCA modifica el estado real guardado de la actividad —
// solo calcula, al momento de generar el PDF, cómo debe LEERSE cada
// estado que no llegó a "firmado_rh": tanto "anunciado" (nunca se
// enteró) como "enterado" (se enteró pero RH nunca verificó que se
// hizo) se reportan como "No se realizó", porque ninguno de los dos
// tiene la confirmación de RH que exige la sección 11. Las actividades
// que seguían en "borrador" (nunca se llegaron a anunciar) no forman
// parte de la semana pública y no aparecen en el reporte.

function obtenerFilasReporteSemanalActividadStaff(semanaKey) {
  return obtenerAsignacionesPorSemanaActividadStaff(semanaKey)
    .filter(a => a.estado !== 'borrador')
    .map(a => ({
      ...a,
      estadoReporteLabel: a.estado === 'firmado_rh' ? 'Firmado por RH' : 'No se realizó'
    }));
}

// ============================================================
// REPORTE DE ORGANIZACIÓN — vista previa ANTES de anunciar (sección 3)
// ============================================================
//
// A diferencia del reporte semanal de arriba (que resume lo YA
// anunciado, para auditoría), este es exclusivamente de las
// actividades todavía en "borrador" — es decir, exactamente lo que
// pasaría si RH presionara "Anunciar actividades" ahora mismo. Nunca
// cambia ningún estado ni genera notificaciones: es solo lectura.
function obtenerFilasReporteOrganizacionActividadStaff(semanaKey) {
  return obtenerAsignacionesPorSemanaActividadStaff(semanaKey)
    .filter(a => a.estado === 'borrador')
    .map(a => ({
      ...a,
      listaParaAnunciar: !!a.encargados?.length
    }));
}
