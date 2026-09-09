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

function empleadosStaffActivosActividad() {
  return (typeof obtenerEmpleadosNomina === 'function' ? obtenerEmpleadosNomina() : [])
    .filter(e => e.cargo === 'staff' && e.estado === 'activo');
}

// Vincula una cuenta interna (login) con su registro de Nómina — usa
// empleadoNominaId cuando existe (cuentas creadas desde Configuración
// ya lo traen) y si no, cae a hacer match por nombre (mismas 9
// personas de ejemplo en ambos registros, ver nota en nomina-modelo.js).
function empleadoNominaDeCuentaActividadStaff(cuenta) {
  if (!cuenta) return null;
  const empleados = typeof obtenerEmpleadosNomina === 'function' ? obtenerEmpleadosNomina() : [];
  if (cuenta.empleadoNominaId) {
    const directo = empleados.find(e => e.id === cuenta.empleadoNominaId);
    if (directo) return directo;
  }
  return empleados.find(e => e.nombre === cuenta.nombre) || null;
}

// ============================================================
// ASIGNACIONES (actividadesStaff)
// ============================================================

function obtenerAsignacionesActividadStaff() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(ACTIVIDADES_STAFF_ASIGNACIONES_KEY));
    if (Array.isArray(guardadas)) return guardadas;
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

function obtenerAsignacionesPorSemanaActividadStaff(semanaKey) {
  return obtenerAsignacionesActividadStaff().filter(a => a.semanaKey === semanaKey);
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
function crearAsignacionActividadStaff({ actividadCatalogoId, nombreNuevo, zonaNueva, periodicidad, dias, encargadoId, semanaKey, observaciones, creadoPorId, creadoPorNombre, creadoPorRol, permitirSinPeriodicidad }) {

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

  if (encargadoId) {
    const encargado = empleadosStaffActivosActividad().find(e => e.id === encargadoId);
    if (!encargado) return { ok: false, error: 'El encargado debe ser un empleado de Staff activo.' };
  }

  const asignaciones = obtenerAsignacionesActividadStaff();
  const encargado = encargadoId ? empleadosStaffActivosActividad().find(e => e.id === encargadoId) : null;

  const nueva = {
    id: `act-staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    actividadCatalogoId: catalogoEntry.id,
    nombre: catalogoEntry.nombre,
    zona: catalogoEntry.zona,
    periodicidad: validacion.periodicidad,
    dias: validacion.dias,
    encargadoId: encargadoId || null,
    encargadoNombre: encargado ? encargado.nombre : '',
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
    creadoPorRol: creadoPorRol || ''
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
    comentario: `Actividad creada para la semana del ${formatearRangoSemanaActividadStaff(semanaKey)}.`
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
  const existentes = obtenerAsignacionesPorSemanaActividadStaff(semanaKey);
  const catalogoIdsExistentes = new Set(existentes.map(a => a.actividadCatalogoId));

  const faltantes = catalogo.filter(c => !catalogoIdsExistentes.has(c.id));
  if (!faltantes.length) return;

  const asignaciones = obtenerAsignacionesActividadStaff();

  faltantes.forEach(catalogoEntry => {
    const nueva = {
      id: `act-staff-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      actividadCatalogoId: catalogoEntry.id,
      nombre: catalogoEntry.nombre,
      zona: catalogoEntry.zona,
      periodicidad: null,
      dias: [],
      encargadoId: null,
      encargadoNombre: '',
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
      creadoPorRol: 'sistema'
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

  if (cambios.encargadoId !== undefined && cambios.encargadoId !== asignacion.encargadoId) {
    const nuevoEncargado = cambios.encargadoId ? empleadosStaffActivosActividad().find(e => e.id === cambios.encargadoId) : null;
    if (cambios.encargadoId && !nuevoEncargado) return { ok: false, error: 'El encargado debe ser un empleado de Staff activo.' };
    cambiosTexto.push(`Encargado: ${asignacion.encargadoNombre || 'sin asignar'} → ${nuevoEncargado ? nuevoEncargado.nombre : 'sin asignar'}.`);
    asignacion.encargadoId = cambios.encargadoId || null;
    asignacion.encargadoNombre = nuevoEncargado ? nuevoEncargado.nombre : '';
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
      asignacion.encargadoId = grupo.encargadoId;
      asignacion.encargadoNombre = grupo.encargadoNombre;
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

// Solo actividades en borrador CON encargado asignado pueden anunciarse.
function anunciarAsignacionesActividadStaff(ids, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const anunciadas = [];

  ids.forEach(id => {
    const a = asignaciones.find(x => x.id === id);
    if (!a || a.estado !== 'borrador' || !a.encargadoId) return;
    a.estado = 'anunciado';
    a.fechaAnuncio = new Date().toISOString();
    registrarHistorialActividadStaff({
      actividadId: a.id, estadoAnterior: 'borrador', estadoNuevo: 'anunciado',
      usuarioId, usuarioNombre, usuarioRol, comentario: `Actividad anunciada a ${a.encargadoNombre}.`
    });
    anunciadas.push(a);
  });

  if (!anunciadas.length) return { ok: false, error: 'No hay actividades listas para anunciar (deben estar en organización y con encargado asignado).' };

  guardarAsignacionesActividadStaff(asignaciones);

  if (typeof agregarNotificacion === 'function') {
    const semanaKey = anunciadas[0].semanaKey;
    agregarNotificacion({
      texto: `Se anunciaron ${anunciadas.length} actividad${anunciadas.length === 1 ? '' : 'es'} de limpieza para la semana del ${formatearRangoSemanaActividadStaff(semanaKey)}. Revisa "Mis actividades".`,
      link: 'misActividades',
      rolDestino: 'staff'
    });
  }

  return { ok: true, cantidad: anunciadas.length, asignaciones: anunciadas };

}

// Solo el propio encargado puede confirmar que se enteró — y solo
// mientras la actividad esté "anunciado" (no puede saltarse a
// "firmado_rh" por su cuenta).
function marcarEnteradoAsignacionActividadStaff(id, { usuarioId, usuarioNombre, usuarioRol }) {

  const asignaciones = obtenerAsignacionesActividadStaff();
  const a = asignaciones.find(x => x.id === id);
  if (!a) return { ok: false, error: 'La actividad no existe.' };
  if (a.estado !== 'anunciado') return { ok: false, error: 'Esta actividad ya no está en espera de confirmación.' };
  if (a.encargadoId !== usuarioId) return { ok: false, error: 'Solo la persona encargada puede confirmar esta actividad.' };

  a.estado = 'enterado';
  a.fechaEnterado = new Date().toISOString();
  a.enteradoPorId = usuarioId;
  a.enteradoPorNombre = usuarioNombre;

  guardarAsignacionesActividadStaff(asignaciones);

  registrarHistorialActividadStaff({
    actividadId: a.id, estadoAnterior: 'anunciado', estadoNuevo: 'enterado',
    usuarioId, usuarioNombre, usuarioRol: usuarioRol || 'staff',
    comentario: `${usuarioNombre} confirmó que se enteró de la actividad.`
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
