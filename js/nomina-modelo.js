// MW JOYERÍA — Admin: Nómina (motor de datos)
//
// La nómina aplica SOLO a empleados con sueldo: Staff, RH y
// Administrativo. Emprendedoras/Líderes NO forman parte de Nómina —
// su compensación es Comisiones + Plan MW (no se toca nada de eso
// aquí, ver js/comisiones-modelo.js y js/plan-mw-admin.js).
//
// ⚠️ Nota de arquitectura: este roster de "empleados de nómina" es
// DISTINTO del registro de cuentas de login (js/cuentas-internas-modelo.js)
// aunque representan a las mismas 9 personas (Staff01-07, RH, Admin) —
// no se inventaron personas nuevas. Se mantienen separados a propósito
// porque Nómina necesita su propio número de empleado, salario, fecha
// de inicio y un flujo de alta/baja CON APROBACIÓN que no existe (ni
// debe existir) para las cuentas de login — esas se crean/eliminan de
// inmediato desde Configuración → Usuarios y permisos → Cuentas. Si
// más adelante se conecta un backend real, lo natural es que ambos
// registros referencien el mismo documento de persona; por ahora, en
// localStorage, mantenerlos separados evita que borrar una cuenta de
// login borre por accidente el historial de nómina de alguien, o
// viceversa.
//
// Reutiliza (no inventa reglas nuevas):
// - js/admin-comun.js — abrirAutorizacionAdmin / registrarAuditoriaAdmin.
// - Mismo patrón de ajustes+historial append-only que ya usa
//   js/comisiones-modelo.js (valorCalculado/valorAnterior/valorNuevo/
//   motivo/usuarioAdminId/fecha) — misma idea, aplicada a nómina.
// - Mismo patrón de borrador/autoguardado que ya usan
//   js/comisiones-modelo.js y js/configuracion-modelo.js.
//
// ⚠️ TEMPORAL: localStorage simula Firestore.

const NOMINA_EMPLEADOS_KEY = 'mw-nomina-empleados-v1';
const NOMINA_CONCEPTOS_KEY = 'mw-nomina-conceptos-v1';
const NOMINA_PERIODOS_KEY = 'mw-nomina-periodos-v1';
const NOMINA_HISTORIAL_KEY = 'mw-nomina-historial-ajustes-v1';
const NOMINA_SOLICITUDES_KEY = 'mw-nomina-solicitudes-v1';
const NOMINA_BORRADOR_KEY = 'mw-nomina-borrador-v1';

const CARGOS_NOMINA = { staff: 'Staff', rh: 'RH', admin: 'Administrativo' };
const ESTADOS_EMPLEADO_NOMINA = { activo: 'Activo', inactivo: 'Inactivo' };

// ============================================================
// EMPLEADOS DE NÓMINA
// ============================================================

// Mismas 9 personas que ya existen como cuentas internas (Staff01-07,
// Recursos Humanos, Claudia) — ver nota de arquitectura arriba. Los
// salarios son valores de ejemplo razonables (no existía ningún dato
// salarial real en el sistema antes de esta página).
function construirEmpleadosNominaEjemplo() {
  return [
    { id: 'emp-staff01', numeroEmpleado: 'EMP001', nombre: 'Ana López', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff02', numeroEmpleado: 'EMP002', nombre: 'Mariana Torres', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff03', numeroEmpleado: 'EMP003', nombre: 'Carlos Reyes', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff04', numeroEmpleado: 'EMP004', nombre: 'Fernanda Ibarra', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff05', numeroEmpleado: 'EMP005', nombre: 'Jorge Salinas', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff06', numeroEmpleado: 'EMP006', nombre: 'Paulina Gómez', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff07', numeroEmpleado: 'EMP007', nombre: 'Luis Medina', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-rh01', numeroEmpleado: 'EMP008', nombre: 'Recursos Humanos', cargo: 'rh', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 2600, pagoHoraExtra: 140, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-admin01', numeroEmpleado: 'EMP009', nombre: 'Claudia', cargo: 'admin', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 3200, pagoHoraExtra: 170, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' }
  ];
}

function obtenerEmpleadosNomina() {
  try {
    const guardados = JSON.parse(localStorage.getItem(NOMINA_EMPLEADOS_KEY));
    if (Array.isArray(guardados) && guardados.length) return guardados;
  } catch (error) {
    // sigue abajo y reconstruye el ejemplo
  }
  const empleados = construirEmpleadosNominaEjemplo();
  guardarEmpleadosNomina(empleados);
  return empleados;
}

function guardarEmpleadosNomina(empleados) {
  localStorage.setItem(NOMINA_EMPLEADOS_KEY, JSON.stringify(empleados));
}

function obtenerEmpleadoNominaPorId(id) {
  return obtenerEmpleadosNomina().find(e => e.id === id) || null;
}

function existeNumeroEmpleado(numeroEmpleado, excluirId) {
  return obtenerEmpleadosNomina().some(e => e.numeroEmpleado.toLowerCase() === String(numeroEmpleado || '').toLowerCase() && e.id !== excluirId);
}

function crearEmpleadoNomina({ numeroEmpleado, nombre, cargo, fechaInicio, salarioBase, pagoHoraExtra, fotoUrl, metodoPago }) {

  numeroEmpleado = String(numeroEmpleado || '').trim();
  nombre = String(nombre || '').trim();

  if (!numeroEmpleado || !nombre || !cargo) {
    return { ok: false, error: 'Número de empleado, nombre y cargo son obligatorios.' };
  }
  if (!CARGOS_NOMINA[cargo]) {
    return { ok: false, error: 'El cargo no es válido.' };
  }
  if (existeNumeroEmpleado(numeroEmpleado)) {
    return { ok: false, error: 'Ya existe un empleado con ese número.' };
  }

  const empleados = obtenerEmpleadosNomina();
  const nuevo = {
    id: `emp-${Date.now()}`,
    numeroEmpleado,
    nombre,
    cargo,
    fechaInicio: fechaInicio || new Date().toISOString().slice(0, 10),
    fechaBaja: null,
    salarioBase: Number(salarioBase) || 0,
    pagoHoraExtra: Number(pagoHoraExtra) || 0,
    estado: 'activo',
    fotoUrl: fotoUrl || '',
    metodoPago: metodoPago || 'Efectivo'
  };

  empleados.push(nuevo);
  guardarEmpleadosNomina(empleados);

  return { ok: true, empleado: nuevo };

}

function editarEmpleadoNomina(id, cambios) {

  const empleados = obtenerEmpleadosNomina();
  const empleado = empleados.find(e => e.id === id);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };

  if (cambios.numeroEmpleado && existeNumeroEmpleado(cambios.numeroEmpleado, id)) {
    return { ok: false, error: 'Ya existe un empleado con ese número.' };
  }

  Object.assign(empleado, {
    numeroEmpleado: cambios.numeroEmpleado ?? empleado.numeroEmpleado,
    nombre: cambios.nombre ?? empleado.nombre,
    cargo: CARGOS_NOMINA[cambios.cargo] ? cambios.cargo : empleado.cargo,
    fechaInicio: cambios.fechaInicio ?? empleado.fechaInicio,
    salarioBase: cambios.salarioBase !== undefined ? Number(cambios.salarioBase) || 0 : empleado.salarioBase,
    pagoHoraExtra: cambios.pagoHoraExtra !== undefined ? Number(cambios.pagoHoraExtra) || 0 : empleado.pagoHoraExtra,
    fotoUrl: cambios.fotoUrl ?? empleado.fotoUrl,
    metodoPago: cambios.metodoPago ?? empleado.metodoPago ?? 'Efectivo'
  });

  guardarEmpleadosNomina(empleados);
  return { ok: true, empleado };

}

// "Dar de baja" NUNCA borra nada — solo marca inactivo y conserva
// todo el historial de nómina (periodos, ajustes, comprobantes).
function darDeBajaEmpleadoNomina(id, fechaBaja) {
  const empleados = obtenerEmpleadosNomina();
  const empleado = empleados.find(e => e.id === id);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };
  empleado.estado = 'inactivo';
  empleado.fechaBaja = fechaBaja || new Date().toISOString().slice(0, 10);
  guardarEmpleadosNomina(empleados);
  return { ok: true, empleado };
}

function reactivarEmpleadoNomina(id) {
  const empleados = obtenerEmpleadosNomina();
  const empleado = empleados.find(e => e.id === id);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };
  empleado.estado = 'activo';
  empleado.fechaBaja = null;
  guardarEmpleadosNomina(empleados);
  return { ok: true, empleado };
}

// ============================================================
// CONCEPTOS DE NÓMINA
// ============================================================

function construirConceptosNominaEjemplo() {
  return [
    { id: 'sueldo_base', nombre: 'Sueldo base', tipo: 'percepcion', activo: true, fijo: true },
    { id: 'horas_extra', nombre: 'Horas extra', tipo: 'percepcion', activo: true, fijo: true },
    { id: 'bono', nombre: 'Bono', tipo: 'percepcion', activo: true },
    { id: 'comision_especial', nombre: 'Comisión especial', tipo: 'percepcion', activo: true },
    { id: 'otro_percepcion', nombre: 'Otro (percepción)', tipo: 'percepcion', activo: true },
    { id: 'falta', nombre: 'Falta', tipo: 'deduccion', activo: true, fijo: true },
    { id: 'deduccion', nombre: 'Deducción', tipo: 'deduccion', activo: true },
    { id: 'otro_deduccion', nombre: 'Otro (deducción)', tipo: 'deduccion', activo: true }
  ];
}

function obtenerConceptosNomina() {
  try {
    const guardados = JSON.parse(localStorage.getItem(NOMINA_CONCEPTOS_KEY));
    if (Array.isArray(guardados) && guardados.length) return guardados;
  } catch (error) {
    // sigue abajo
  }
  const conceptos = construirConceptosNominaEjemplo();
  guardarConceptosNomina(conceptos);
  return conceptos;
}

function guardarConceptosNomina(conceptos) {
  localStorage.setItem(NOMINA_CONCEPTOS_KEY, JSON.stringify(conceptos));
}

function obtenerConceptoNominaPorId(id) {
  return obtenerConceptosNomina().find(c => c.id === id) || null;
}

function crearConceptoNomina({ nombre, tipo }) {
  nombre = String(nombre || '').trim();
  if (!nombre) return { ok: false, error: 'El nombre del concepto es obligatorio.' };
  if (tipo !== 'percepcion' && tipo !== 'deduccion') return { ok: false, error: 'El tipo debe ser percepción o deducción.' };

  const conceptos = obtenerConceptosNomina();
  if (conceptos.some(c => c.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { ok: false, error: 'Ya existe un concepto con ese nombre.' };
  }

  const nuevo = { id: `concepto-${Date.now()}`, nombre, tipo, activo: true, fijo: false };
  conceptos.push(nuevo);
  guardarConceptosNomina(conceptos);
  return { ok: true, concepto: nuevo };
}

function editarConceptoNomina(id, { nombre, tipo }) {
  const conceptos = obtenerConceptosNomina();
  const concepto = conceptos.find(c => c.id === id);
  if (!concepto) return { ok: false, error: 'El concepto no existe.' };
  if (nombre) concepto.nombre = nombre;
  if (tipo === 'percepcion' || tipo === 'deduccion') concepto.tipo = tipo;
  guardarConceptosNomina(conceptos);
  return { ok: true, concepto };
}

// Nunca se borra físicamente — se desactiva. Los periodos ya
// capturados conservan el concepto tal como estaba (con su nombre y
// tipo de entonces), aunque después se desactive.
function desactivarConceptoNomina(id) {
  const conceptos = obtenerConceptosNomina();
  const concepto = conceptos.find(c => c.id === id);
  if (!concepto) return { ok: false, error: 'El concepto no existe.' };
  concepto.activo = false;
  guardarConceptosNomina(conceptos);
  return { ok: true, concepto };
}

function activarConceptoNomina(id) {
  const conceptos = obtenerConceptosNomina();
  const concepto = conceptos.find(c => c.id === id);
  if (!concepto) return { ok: false, error: 'El concepto no existe.' };
  concepto.activo = true;
  guardarConceptosNomina(conceptos);
  return { ok: true, concepto };
}

// ============================================================
// SEMANAS (periodicidad confirmada: SEMANAL, lunes a domingo)
// ============================================================

function obtenerLunesDeSemana(fechaBase) {
  const fecha = fechaBase ? new Date(fechaBase) : new Date();
  fecha.setHours(0, 0, 0, 0);
  const diaSemana = fecha.getDay(); // 0 = domingo
  const offsetLunes = diaSemana === 0 ? -6 : 1 - diaSemana;
  fecha.setDate(fecha.getDate() + offsetLunes);
  return fecha;
}

function periodoKeyDeLunes(lunes) {
  return `${lunes.getFullYear()}-${String(lunes.getMonth() + 1).padStart(2, '0')}-${String(lunes.getDate()).padStart(2, '0')}`;
}

function obtenerPeriodoActualNomina() {
  return periodoKeyDeLunes(obtenerLunesDeSemana());
}

const MESES_NOMINA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatearRangoSemanaNomina(periodoKey) {
  const lunes = new Date(`${periodoKey}T00:00:00`);
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);

  const mismoMes = lunes.getMonth() === domingo.getMonth();
  const mesLunes = MESES_NOMINA[lunes.getMonth()];
  const mesDomingo = MESES_NOMINA[domingo.getMonth()];

  if (mismoMes) {
    return `${lunes.getDate()} al ${domingo.getDate()} de ${mesDomingo} de ${domingo.getFullYear()}`;
  }
  return `${lunes.getDate()} de ${mesLunes} al ${domingo.getDate()} de ${mesDomingo} de ${domingo.getFullYear()}`;
}

// Semanas con datos guardados para un empleado + la semana actual
// (para poder empezar a capturarla aunque todavía no tenga nada).
function obtenerSemanasDisponibles(empleadoId) {
  const periodos = obtenerPeriodosNomina();
  const claves = Object.keys(periodos)
    .filter(k => periodos[k].empleadoId === empleadoId)
    .map(k => periodos[k].periodoKey);

  const actual = obtenerPeriodoActualNomina();
  const todas = new Set([actual, ...claves]);
  return Array.from(todas).sort((a, b) => b.localeCompare(a));
}

// ============================================================
// PERIODOS DE NÓMINA
// ============================================================

function construirClavePeriodo(empleadoId, periodoKey) {
  return `${empleadoId}__${periodoKey}`;
}

function obtenerPeriodosNomina() {
  try {
    const datos = JSON.parse(localStorage.getItem(NOMINA_PERIODOS_KEY));
    return datos && typeof datos === 'object' ? datos : {};
  } catch (error) {
    return {};
  }
}

function guardarPeriodosNomina(periodos) {
  localStorage.setItem(NOMINA_PERIODOS_KEY, JSON.stringify(periodos));
}

function calcularTotalesPeriodo(conceptos) {
  const totalPercepciones = conceptos.filter(c => c.tipo === 'percepcion').reduce((s, c) => s + c.total, 0);
  const totalDeducciones = conceptos.filter(c => c.tipo === 'deduccion').reduce((s, c) => s + c.total, 0);
  return { totalPercepciones, totalDeducciones, totalAPagar: totalPercepciones - totalDeducciones };
}

// Si el periodo ya fue guardado, lo devuelve tal cual. Si es la
// primera vez que se abre, arma uno nuevo (sin guardarlo todavía) con
// sueldo base y horas extra prellenados desde los datos del empleado
// — el resto de conceptos se agregan manualmente, según la Sección 5
// (la captura es manual, el sistema no inventa asistencia).
function obtenerPeriodoNomina(empleadoId, periodoKey) {

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  if (periodos[clave]) return periodos[clave];

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (!empleado) return null;

  const conceptos = [
    { filaId: `fila-${Date.now()}-1`, conceptoId: 'sueldo_base', nombre: 'Sueldo base', tipo: 'percepcion', cantidad: 1, importe: empleado.salarioBase, total: empleado.salarioBase },
    { filaId: `fila-${Date.now()}-2`, conceptoId: 'horas_extra', nombre: 'Horas extra', tipo: 'percepcion', cantidad: 0, importe: empleado.pagoHoraExtra, total: 0 }
  ];

  const totales = calcularTotalesPeriodo(conceptos);

  return {
    empleadoId,
    periodoKey,
    conceptos,
    ...totales,
    estadoPago: { estado: 'pendiente' },
    guardado: false
  };

}

function guardarPeriodoNomina(periodo) {
  const clave = construirClavePeriodo(periodo.empleadoId, periodo.periodoKey);
  const periodos = obtenerPeriodosNomina();
  const totales = calcularTotalesPeriodo(periodo.conceptos);
  periodos[clave] = { ...periodo, ...totales, guardado: true };
  guardarPeriodosNomina(periodos);
  return periodos[clave];
}

// ============================================================
// AJUSTES / TRAZABILIDAD (misma idea que comisiones-modelo.js)
// ============================================================

function obtenerHistorialAjustesNomina() {
  try {
    const registros = JSON.parse(localStorage.getItem(NOMINA_HISTORIAL_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function registrarAjusteNomina({ empleadoId, periodoKey, concepto, campo, valorAnterior, valorNuevo, motivo, usuarioAdminId, usuarioAdminNombre }) {

  const registro = {
    tipo: 'ajusteNomina',
    empleadoId,
    periodoKey,
    concepto,
    campo,
    valorAnterior,
    valorNuevo,
    motivo: motivo || '',
    usuarioAdminId,
    usuarioAdminNombre,
    fecha: new Date().toISOString()
  };

  const historial = obtenerHistorialAjustesNomina();
  historial.push(registro);
  localStorage.setItem(NOMINA_HISTORIAL_KEY, JSON.stringify(historial));

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: 'ajuste_concepto',
      descripcion: `Nómina (${periodoKey}) → ${concepto}: ${valorAnterior} → ${valorNuevo}${motivo ? ` — ${motivo}` : ''}`
    });
  }

  return registro;

}

function obtenerHistorialAjustesPeriodo(empleadoId, periodoKey) {
  return obtenerHistorialAjustesNomina()
    .filter(r => r.empleadoId === empleadoId && r.periodoKey === periodoKey)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// ============================================================
// PAGO
// ============================================================

function registrarPagoNomina(empleadoId, periodoKey, { montoPagado, registradoPor }) {

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const periodo = periodos[clave];
  if (!periodo) return { ok: false, error: 'Primero guarda el periodo antes de registrar el pago.' };

  periodo.estadoPago = {
    estado: 'pagada',
    fechaPago: new Date().toISOString(),
    registradoPor,
    montoPagado
  };
  guardarPeriodosNomina(periodos);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: 'registrar_pago',
      descripcion: `Pago de nómina registrado (${periodoKey}) por $${Number(montoPagado).toFixed(2)}`
    });
  }

  return { ok: true, periodo };

}

// ============================================================
// BORRADOR (autoguardado local)
// ============================================================

function obtenerBorradorNomina() {
  try {
    const datos = JSON.parse(localStorage.getItem(NOMINA_BORRADOR_KEY));
    return datos && typeof datos === 'object' ? datos : null;
  } catch (error) {
    return null;
  }
}

function guardarBorradorNomina(pendiente) {
  localStorage.setItem(NOMINA_BORRADOR_KEY, JSON.stringify({ ...pendiente, guardadoEn: new Date().toISOString() }));
}

function descartarBorradorNomina() {
  localStorage.removeItem(NOMINA_BORRADOR_KEY);
}

// ============================================================
// SOLICITUDES DE ALTA / BAJA
// ============================================================

function obtenerSolicitudesNomina() {
  try {
    const guardadas = JSON.parse(localStorage.getItem(NOMINA_SOLICITUDES_KEY));
    return Array.isArray(guardadas) ? guardadas : [];
  } catch (error) {
    return [];
  }
}

function guardarSolicitudesNomina(solicitudes) {
  localStorage.setItem(NOMINA_SOLICITUDES_KEY, JSON.stringify(solicitudes));
}

function crearSolicitudAltaNomina({ nombre, fechaInicio, salarioBase, numeroEmpleado, cargo, fotoUrl, solicitadoPor }) {

  if (!nombre || !numeroEmpleado) {
    return { ok: false, error: 'Nombre y número de empleado son obligatorios.' };
  }
  if (existeNumeroEmpleado(numeroEmpleado)) {
    return { ok: false, error: 'Ya existe un empleado con ese número.' };
  }

  const solicitudes = obtenerSolicitudesNomina();
  const nueva = {
    id: `sol-${Date.now()}`,
    tipo: 'alta',
    empleadoId: null,
    datosAlta: { nombre, fechaInicio, salarioBase: Number(salarioBase) || 0, numeroEmpleado, cargo: cargo || 'staff', fotoUrl: fotoUrl || '' },
    motivoBaja: null,
    fechaEfectivaBaja: null,
    estado: 'pendiente',
    solicitadoPor,
    fechaSolicitud: new Date().toISOString(),
    revisadoPor: null,
    fechaResolucion: null,
    motivoRechazo: null
  };

  solicitudes.unshift(nueva);
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'solicitud_alta', descripcion: `Solicitud de alta creada: ${nombre} (${numeroEmpleado})` });
  }

  return { ok: true, solicitud: nueva };

}

function crearSolicitudBajaNomina({ empleadoId, motivoBaja, fechaEfectivaBaja, solicitadoPor }) {

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };
  if (!motivoBaja) return { ok: false, error: 'El motivo de baja es obligatorio.' };

  const solicitudes = obtenerSolicitudesNomina();
  const nueva = {
    id: `sol-${Date.now()}`,
    tipo: 'baja',
    empleadoId,
    datosAlta: null,
    motivoBaja,
    fechaEfectivaBaja: fechaEfectivaBaja || new Date().toISOString().slice(0, 10),
    estado: 'pendiente',
    solicitadoPor,
    fechaSolicitud: new Date().toISOString(),
    revisadoPor: null,
    fechaResolucion: null,
    motivoRechazo: null
  };

  solicitudes.unshift(nueva);
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'solicitud_baja', descripcion: `Solicitud de baja creada: ${nombreCompletoEmpleadoNomina(empleado)} (${empleado.numeroEmpleado})` });
  }

  return { ok: true, solicitud: nueva };

}

function nombreCompletoEmpleadoNomina(empleado) {
  return empleado ? empleado.nombre : '';
}

function aprobarSolicitudNomina(id, { usuarioAdminId, usuarioAdminNombre }) {

  const solicitudes = obtenerSolicitudesNomina();
  const solicitud = solicitudes.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') return { ok: false, error: 'Esta solicitud ya fue resuelta.' };

  if (solicitud.tipo === 'alta') {
    const resultado = crearEmpleadoNomina(solicitud.datosAlta);
    if (!resultado.ok) return resultado;
    solicitud.empleadoId = resultado.empleado.id;
  } else {
    const resultado = darDeBajaEmpleadoNomina(solicitud.empleadoId, solicitud.fechaEfectivaBaja);
    if (!resultado.ok) return resultado;
  }

  solicitud.estado = 'aprobada';
  solicitud.revisadoPor = usuarioAdminNombre;
  solicitud.fechaResolucion = new Date().toISOString();
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: solicitud.tipo === 'alta' ? 'aprobar_alta' : 'aprobar_baja',
      descripcion: `Solicitud de ${solicitud.tipo} aprobada por ${usuarioAdminNombre}`
    });
  }

  return { ok: true, solicitud };

}

function rechazarSolicitudNomina(id, { motivo, usuarioAdminId, usuarioAdminNombre }) {

  const solicitudes = obtenerSolicitudesNomina();
  const solicitud = solicitudes.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') return { ok: false, error: 'Esta solicitud ya fue resuelta.' };
  if (!motivo) return { ok: false, error: 'El motivo del rechazo es obligatorio.' };

  solicitud.estado = 'rechazada';
  solicitud.motivoRechazo = motivo;
  solicitud.revisadoPor = usuarioAdminNombre;
  solicitud.fechaResolucion = new Date().toISOString();
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: solicitud.tipo === 'alta' ? 'rechazar_alta' : 'rechazar_baja',
      descripcion: `Solicitud de ${solicitud.tipo} rechazada por ${usuarioAdminNombre} — ${motivo}`
    });
  }

  return { ok: true, solicitud };

}
