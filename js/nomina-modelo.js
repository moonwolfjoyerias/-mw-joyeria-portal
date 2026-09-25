// MW JOYERÍA — Admin: Nómina (motor de datos)
//
// La nómina aplica SOLO a empleados con sueldo: Staff, Encargado y
// Administrativo. Emprendedoras/Líderes NO forman parte de Nómina —
// su compensación es Comisiones + Plan MW (no se toca nada de eso
// aquí, ver js/comisiones-modelo.js y js/plan-mw-admin.js).
//
// ⚠️ Nota de arquitectura: este roster de "empleados de nómina" es
// DISTINTO del registro de cuentas de login (js/cuentas-internas-modelo.js)
// aunque representan a las mismas 9 personas (Staff01-07, Encargado, Admin) —
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

const CARGOS_NOMINA = { staff: 'Staff', encargado: 'Encargado', admin: 'Administrativo' };
const ESTADOS_EMPLEADO_NOMINA = { activo: 'Activo', inactivo: 'Inactivo' };

// Flujo de revisión Encargado ↔ Administración de cada nómina semanal.
// Encargado prepara y envía a validación; Administración valida o pide
// corrección; el pago solo se registra una vez validada. Nunca se
// salta un paso ni se sobrescribe el historial (ver
// registrarCambioEstadoNomina más abajo).
const ESTADOS_NOMINA_PERIODO = {
  pendiente: 'Pendiente',
  necesita_validacion_admin: 'Necesita validación de Administración',
  validado_admin: 'Validado por Administración',
  correccion_solicitada: 'Corrección solicitada por Administración',
  pagado: 'Pagado'
};
const NOMINA_HISTORIAL_ESTADOS_KEY = 'mw-nomina-historial-estados-v1';

// ============================================================
// EMPLEADOS DE NÓMINA
// ============================================================

// Mismas 9 personas que ya existen como cuentas internas (Staff01-07,
// Valentina Cruz, Claudia) — ver nota de arquitectura arriba. Los
// salarios son valores de ejemplo razonables (no existía ningún dato
// salarial real en el sistema antes de esta página).
function construirEmpleadosNominaEjemplo() {
  return [
    { id: 'emp-staff01', numeroEmpleado: 'EMP001', nombre: 'Ana López', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff02', numeroEmpleado: 'EMP002', nombre: 'Mariana Torres', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff03', numeroEmpleado: 'EMP003', nombre: 'Carlos Reyes', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff04', numeroEmpleado: 'EMP004', nombre: 'Fernanda Ibarra', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff05', numeroEmpleado: 'EMP005', nombre: 'Jorge Salinas', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff06', numeroEmpleado: 'EMP006', nombre: 'Paulina Gómez', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-staff07', numeroEmpleado: 'EMP007', nombre: 'Luis Medina', cargo: 'staff', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 1800, pagoHoraExtra: 100, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-encargado01', numeroEmpleado: 'EMP008', nombre: 'Valentina Cruz', cargo: 'encargado', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 2600, pagoHoraExtra: 140, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' },
    { id: 'emp-admin01', numeroEmpleado: 'EMP009', nombre: 'Claudia', cargo: 'admin', fechaInicio: '2023-01-01', fechaBaja: null, salarioBase: 3200, pagoHoraExtra: 170, diasPorSemana: 6, horasPorDia: 8, desfaseInicioEstado: null, estado: 'activo', fotoUrl: '', metodoPago: 'Efectivo' }
  ];
}

// ============================================================
// SALARIO DIARIO Y HORA EXTRA — cálculo automático
// ============================================================
//
// Encargado ya no captura "pago por hora extra" a mano: se calcula solo a
// partir del salario SEMANAL (salarioBase) y el horario del empleado
// (diasPorSemana/horasPorDia), igual que marca el Art. 68 de la Ley
// Federal del Trabajo — el tiempo extra se paga al DOBLE de la
// tarifa ordinaria por hora. pagoHoraExtra se sigue guardando en el
// empleado (se recalcula en crearEmpleadoNomina/editarEmpleadoNomina)
// solo para no romper nada que ya lo lea (ej. el comprobante en PDF).
function calcularSalarioDiarioEmpleado(empleado) {
  const dias = Number(empleado?.diasPorSemana) || 6;
  return (Number(empleado?.salarioBase) || 0) / dias;
}

function calcularTarifaHoraNormalEmpleado(empleado) {
  const horas = Number(empleado?.horasPorDia) || 8;
  return calcularSalarioDiarioEmpleado(empleado) / horas;
}

function calcularTarifaHoraExtraEmpleado(empleado) {
  return 2 * calcularTarifaHoraNormalEmpleado(empleado);
}

// ============================================================
// DESFASE DE INICIO
// ============================================================
//
// Cuando alguien entra a media semana, esto cuenta cuántos días
// "sueltos" le tocan antes de su primera semana completa. La semana
// de referencia para este cálculo es SIEMPRE miércoles→martes, fija
// para todos — distinta de la semana de pago lunes→domingo que ya
// usa el resto de Nómina (ver periodoKeyDeLunes más abajo). Si entra
// exactamente un miércoles, regresa 7 (semana completa, sin desfase).
function calcularDiasDesfaseInicio(fechaInicioISO) {
  if (!fechaInicioISO) return 7;
  const fecha = new Date(`${fechaInicioISO}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) return 7;
  const diaSemana = fecha.getDay(); // 0=domingo … 3=miércoles … 6=sábado
  const offsetDesdeMiercoles = (diaSemana - 3 + 7) % 7;
  return 7 - offsetDesdeMiercoles;
}

// El desfase de inicio ya NO es una preferencia fija del empleado —
// es una acción de una sola vez que Encargado/Admin dispara directamente al
// capturar la nómina (ver abrirModalDesfaseHoras en encargado-nomina.js /
// admin-nomina.js). Se aplica una única vez por empleado
// (empleado.desfaseInicioEstado queda en null hasta que se usa) y, en
// cuanto se paga la semana que le corresponde, queda bloqueada para
// siempre — así nunca se puede volver a aplicar ni se recalcula sola
// en cada carga (lo que antes producía un doble pago cuando el
// desfase caía en la semana siguiente: esos días se contaban una vez
// en el ajuste y otra vez dentro del sueldo completo de esa semana).

// true si este empleado todavía puede usar "Desfase de horas → De
// inicio": nunca se ha aplicado, y su fecha de inicio sí generó días
// sueltos (no entró justo un miércoles).
function puedeAplicarDesfaseInicioNomina(empleado) {
  if (!empleado || empleado.desfaseInicioEstado) return false;
  return calcularDiasDesfaseInicio(empleado.fechaInicio) < 7;
}

// Aplica el ajuste UNA sola vez, directo sobre la fila de sueldo base
// del periodo que corresponda (nunca como concepto aparte). modo:
// 'pagar_parcial' (se paga solo lo que trabajó esa primera semana) |
// 'acumular_siguiente' (esa primera semana no se paga sola; la
// siguiente semana de pago recibe el sueldo completo + esos días).
function aplicarDesfaseInicioNomina(empleadoId, modo) {

  if (modo !== 'pagar_parcial' && modo !== 'acumular_siguiente') {
    return { ok: false, error: 'Elige cómo se paga el desfase de inicio.' };
  }

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };
  if (!puedeAplicarDesfaseInicioNomina(empleado)) {
    return { ok: false, error: 'Este empleado ya no tiene un desfase de inicio disponible.' };
  }

  const diasDesfase = calcularDiasDesfaseInicio(empleado.fechaInicio);
  const salarioNormal = Number(empleado.salarioBase) || 0;
  const salarioDiario = calcularSalarioDiarioEmpleado(empleado);
  const lunesInicio = obtenerLunesDeSemana(new Date(`${empleado.fechaInicio}T00:00:00`));
  const periodoInicio = periodoKeyDeLunes(lunesInicio);

  const periodos = obtenerPeriodosNomina();

  function periodoEnMemoria(periodoKey) {
    const clave = construirClavePeriodo(empleadoId, periodoKey);
    if (!periodos[clave]) periodos[clave] = obtenerPeriodoNomina(empleadoId, periodoKey);
    return periodos[clave];
  }

  function fijarSueldoBase(periodo, nuevoTotal) {
    const fila = periodo.conceptos.find(c => c.conceptoId === 'sueldo_base');
    if (fila) { fila.importe = nuevoTotal; fila.total = nuevoTotal; }
    Object.assign(periodo, calcularTotalesPeriodo(periodo.conceptos));
  }

  let periodoQuePaga;

  if (modo === 'pagar_parcial') {
    fijarSueldoBase(periodoEnMemoria(periodoInicio), salarioDiario * diasDesfase);
    periodoQuePaga = periodoInicio;
  } else {
    fijarSueldoBase(periodoEnMemoria(periodoInicio), 0);
    const lunesSiguiente = new Date(lunesInicio);
    lunesSiguiente.setDate(lunesInicio.getDate() + 7);
    const periodoSiguienteKey = periodoKeyDeLunes(lunesSiguiente);
    fijarSueldoBase(periodoEnMemoria(periodoSiguienteKey), salarioNormal + salarioDiario * diasDesfase);
    periodoQuePaga = periodoSiguienteKey;
  }

  guardarPeriodosNomina(periodos);

  const empleados = obtenerEmpleadosNomina();
  const empleadoActual = empleados.find(e => e.id === empleadoId);
  empleadoActual.desfaseInicioEstado = { modo, dias: diasDesfase, periodoAplicado: periodoInicio, periodoQuePaga, pagado: false };
  guardarEmpleadosNomina(empleados);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: 'aplicar_desfase_inicio',
      descripcion: `Desfase de inicio aplicado a ${empleado.nombre}: ${diasDesfase} día(s), ${modo === 'pagar_parcial' ? 'pagado en su primera semana' : 'acumulado con la semana siguiente'}.`
    });
  }

  return { ok: true, empleado: empleadoActual, periodoQuePaga };

}

// Deshace un desfase de inicio ya aplicado pero TODAVÍA no pagado —
// regresa los periodos afectados a su sueldo base normal. Una vez
// pagado, ya no se puede deshacer (el pago es lo que lo bloquea).
function quitarDesfaseInicioNomina(empleadoId) {

  const empleados = obtenerEmpleadosNomina();
  const empleado = empleados.find(e => e.id === empleadoId);
  if (!empleado || !empleado.desfaseInicioEstado) return { ok: false, error: 'No hay un desfase de inicio aplicado.' };
  if (empleado.desfaseInicioEstado.pagado) return { ok: false, error: 'Ya se pagó — no se puede deshacer.' };

  const { modo, periodoAplicado, periodoQuePaga } = empleado.desfaseInicioEstado;
  const salarioNormal = Number(empleado.salarioBase) || 0;
  const periodos = obtenerPeriodosNomina();

  function restaurar(periodoKey) {
    const clave = construirClavePeriodo(empleadoId, periodoKey);
    const periodo = periodos[clave];
    if (!periodo) return;
    const fila = periodo.conceptos.find(c => c.conceptoId === 'sueldo_base');
    if (fila) { fila.importe = salarioNormal; fila.total = salarioNormal; }
    Object.assign(periodo, calcularTotalesPeriodo(periodo.conceptos));
  }

  restaurar(periodoAplicado);
  if (modo === 'acumular_siguiente') restaurar(periodoQuePaga);

  guardarPeriodosNomina(periodos);

  delete empleado.desfaseInicioEstado;
  guardarEmpleadosNomina(empleados);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'quitar_desfase_inicio', descripcion: `Desfase de inicio de ${empleado.nombre} deshecho (todavía no se había pagado).` });
  }

  return { ok: true };

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

// Versión sin campos financieros (salarioBase/pagoHoraExtra/metodoPago) —
// para páginas que solo necesitan cruzar un nombre/cargo con el roster
// de empleados (ej. Actividades del Staff, para saber a qué empleado
// real corresponde un encargado), no ver ni administrar nómina. Ningún
// Staff debería recibir el sueldo de sus compañeros solo por abrir una
// página que no tiene nada que ver con Nómina.
function obtenerEmpleadosNominaBasico() {
  return obtenerEmpleadosNomina().map(e => ({
    id: e.id, numeroEmpleado: e.numeroEmpleado, nombre: e.nombre,
    cargo: e.cargo, estado: e.estado, fotoUrl: e.fotoUrl
  }));
}

function existeNumeroEmpleado(numeroEmpleado, excluirId) {
  return obtenerEmpleadosNomina().some(e => e.numeroEmpleado.toLowerCase() === String(numeroEmpleado || '').toLowerCase() && e.id !== excluirId);
}

function crearEmpleadoNomina({ numeroEmpleado, nombre, cargo, fechaInicio, salarioBase, fotoUrl, metodoPago, diasPorSemana, horasPorDia }) {

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
    diasPorSemana: Number(diasPorSemana) || 6,
    horasPorDia: Number(horasPorDia) || 8,
    desfaseInicioEstado: null,
    estado: 'activo',
    fotoUrl: fotoUrl || '',
    metodoPago: metodoPago || 'Efectivo'
  };
  nuevo.pagoHoraExtra = calcularTarifaHoraExtraEmpleado(nuevo);

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
    diasPorSemana: cambios.diasPorSemana !== undefined ? Number(cambios.diasPorSemana) || 6 : (empleado.diasPorSemana || 6),
    horasPorDia: cambios.horasPorDia !== undefined ? Number(cambios.horasPorDia) || 8 : (empleado.horasPorDia || 8),
    fotoUrl: cambios.fotoUrl ?? empleado.fotoUrl,
    metodoPago: cambios.metodoPago ?? empleado.metodoPago ?? 'Efectivo'
  });
  empleado.pagoHoraExtra = calcularTarifaHoraExtraEmpleado(empleado);

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

// Recorre TODOS los periodos ya guardados (de cualquier empleado o
// semana) buscando una fila que use este concepto — es la única forma
// confiable de saber si "eliminar" puede borrar físicamente o debe
// desactivar nada más (sección 5: nunca romper un recibo histórico).
function conceptoNominaEstaEnUso(id) {
  const periodos = obtenerPeriodosNomina();
  return Object.values(periodos).some(p => (p.conceptos || []).some(fila => fila.conceptoId === id));
}

// Acción única "Eliminar concepto" del prompt: decide sola si borra
// físicamente o solo desactiva, según si ya se usó alguna vez. Los
// conceptos "fijos" (sueldo base, horas extra, falta) nunca se
// eliminan — son parte del cálculo base de cualquier nómina.
function eliminarConceptoNomina(id) {
  const conceptos = obtenerConceptosNomina();
  const concepto = conceptos.find(c => c.id === id);
  if (!concepto) return { ok: false, error: 'El concepto no existe.' };
  if (concepto.fijo) return { ok: false, error: 'Este concepto es parte del cálculo base de la nómina y no puede eliminarse.' };

  if (conceptoNominaEstaEnUso(id)) {
    const resultado = desactivarConceptoNomina(id);
    if (!resultado.ok) return resultado;
    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'desactivar_concepto', descripcion: `Concepto "${concepto.nombre}" desactivado (ya se había usado en nóminas anteriores) — los recibos históricos no cambian.` });
    }
    return { ok: true, accion: 'desactivado', concepto: resultado.concepto };
  }

  const restantes = conceptos.filter(c => c.id !== id);
  guardarConceptosNomina(restantes);
  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'eliminar_concepto', descripcion: `Concepto "${concepto.nombre}" eliminado — nunca se había usado en ninguna nómina.` });
  }
  return { ok: true, accion: 'eliminado', concepto };
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

// Viernes de esa misma semana (lunes + 4 días) — el día normal de pago
// (sección 6.1). Es solo la PROPUESTA inicial: Encargado puede cambiarla con
// actualizarFechaPagoNomina, y ese cambio nunca afecta otros periodos.
function fechaPagoSugeridaNomina(periodoKey) {
  const lunes = new Date(`${periodoKey}T00:00:00`);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  return periodoKeyDeLunes(viernes);
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
// solo el sueldo base prellenado — el resto de conceptos (incluidos
// "Horas extra" y "Desfase de horas") se agregan manualmente desde
// el botón "+ Desfase de horas" o "+ Agregar concepto", según la
// Sección 5 (la captura es manual, el sistema no inventa asistencia).
// El desfase de inicio ya no se recalcula aquí en cada carga — se
// aplica una sola vez, directo sobre esta misma fila de sueldo base,
// desde aplicarDesfaseInicioNomina().
function obtenerPeriodoNomina(empleadoId, periodoKey) {

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  if (periodos[clave]) return periodos[clave];

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (!empleado) return null;

  const salarioBase = Number(empleado.salarioBase) || 0;

  const conceptos = [
    { filaId: `fila-${Date.now()}-1`, conceptoId: 'sueldo_base', nombre: 'Sueldo base', tipo: 'percepcion', cantidad: 1, importe: salarioBase, total: salarioBase }
  ];

  const totales = calcularTotalesPeriodo(conceptos);

  return {
    empleadoId,
    periodoKey,
    conceptos,
    ...totales,
    estadoNomina: 'pendiente',
    validacionEncargado: null,
    validacionAdmin: null,
    comentarioCorreccion: null,
    estadoPago: { estado: 'pendiente' },
    // Fecha de pago propuesta (viernes) y método de pago de ESTE
    // periodo — nace copiado del empleado, pero vive aparte para que
    // cambiarlo aquí nunca toque su dato permanente ni otras semanas
    // (sección 6.1 y 6.5).
    fechaPagoProgramada: fechaPagoSugeridaNomina(periodoKey),
    metodoPago: empleado.metodoPago || 'Efectivo',
    guardado: false
  };

}

function guardarPeriodoNomina(periodo) {
  const clave = construirClavePeriodo(periodo.empleadoId, periodo.periodoKey);
  const periodos = obtenerPeriodosNomina();
  const totales = calcularTotalesPeriodo(periodo.conceptos);
  periodos[clave] = {
    fechaPagoProgramada: fechaPagoSugeridaNomina(periodo.periodoKey),
    metodoPago: 'Efectivo',
    ...periodo,
    ...totales,
    guardado: true
  };
  guardarPeriodosNomina(periodos);
  return periodos[clave];
}

// El empleado firma de recibido su propio recibo (Staff → Mi cuenta) —
// aparte de estadoNomina (que es la validación Encargado/Admin del CONTENIDO
// de la nómina, un proceso distinto) para no interferir con esa
// máquina de estados. Solo aplica a un periodo que Encargado ya capturó
// (periodo.guardado), y es de una sola vez: firmar de nuevo no cambia
// la fecha ya registrada.
function firmarReciboNomina(empleadoId, periodoKey, { usuarioId, usuarioNombre }) {

  const periodo = obtenerPeriodoNomina(empleadoId, periodoKey);
  if (!periodo || !periodo.guardado) return { ok: false, error: 'Todavía no hay una nómina capturada esta semana para firmar.' };
  if (periodo.firmaEmpleado?.firmado) return { ok: true, periodo };

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  periodos[clave] = {
    ...periodo,
    firmaEmpleado: { firmado: true, fecha: new Date().toISOString(), usuarioId: usuarioId || null, usuarioNombre: usuarioNombre || '' }
  };
  guardarPeriodosNomina(periodos);

  return { ok: true, periodo: periodos[clave] };

}

// Encargado puede modificar la fecha de pago propuesta (sección 6.1) — nunca
// modifica otros periodos ni el dato permanente del empleado.
function actualizarFechaPagoNomina(empleadoId, periodoKey, nuevaFecha, { usuarioId, usuarioNombre, usuarioRol }) {
  if (!nuevaFecha) return { ok: false, error: 'Indica la fecha de pago.' };

  const periodo = guardarPeriodoNomina({ ...obtenerPeriodoNomina(empleadoId, periodoKey) });
  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const anterior = periodo.fechaPagoProgramada;
  if (anterior === nuevaFecha) return { ok: true, periodo };

  periodos[clave].fechaPagoProgramada = nuevaFecha;
  guardarPeriodosNomina(periodos);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'modificar_fecha_pago', descripcion: `Nómina de ${empleadoId} (${periodoKey}): fecha de pago ${formatearFechaDMYNominaModelo(anterior)} → ${formatearFechaDMYNominaModelo(nuevaFecha)}${usuarioRol ? ` — por ${usuarioNombre} (${usuarioRol})` : ''}` });
  }

  return { ok: true, periodo: periodos[clave] };
}

// Encargado puede cambiar el método de pago DIRECTAMENTE desde la nómina de
// ese periodo (sección 6.5) — no toca el dato permanente del empleado,
// así que la misma persona puede recibir efectivo una semana y
// transferencia la siguiente.
function actualizarMetodoPagoNomina(empleadoId, periodoKey, metodoPago, { usuarioId, usuarioNombre, usuarioRol }) {
  if (!metodoPago) return { ok: false, error: 'Selecciona un método de pago.' };

  const periodo = guardarPeriodoNomina({ ...obtenerPeriodoNomina(empleadoId, periodoKey) });
  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const anterior = periodo.metodoPago;
  if (anterior === metodoPago) return { ok: true, periodo };

  periodos[clave].metodoPago = metodoPago;
  guardarPeriodosNomina(periodos);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'modificar_metodo_pago', descripcion: `Nómina de ${empleadoId} (${periodoKey}): método de pago ${anterior} → ${metodoPago}${usuarioRol ? ` — por ${usuarioNombre} (${usuarioRol})` : ''}` });
  }

  return { ok: true, periodo: periodos[clave] };
}

function formatearFechaDMYNominaModelo(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(`${fechaISO}T00:00:00`);
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
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
// FLUJO DE VALIDACIÓN Encargado ↔ ADMINISTRACIÓN
// ============================================================

function obtenerHistorialEstadosNomina() {
  try {
    const registros = JSON.parse(localStorage.getItem(NOMINA_HISTORIAL_ESTADOS_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

function obtenerHistorialEstadosPeriodo(empleadoId, periodoKey) {
  return obtenerHistorialEstadosNomina()
    .filter(r => r.empleadoId === empleadoId && r.periodoKey === periodoKey)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// Nunca sobrescribe — cada cambio de estado agrega un registro nuevo.
// Mismo formato que pidió la sección 7: estadoAnterior, estadoNuevo,
// usuarioId, usuarioRol, fecha y (si aplica) comentario.
function registrarCambioEstadoNomina({ empleadoId, periodoKey, estadoAnterior, estadoNuevo, usuarioId, usuarioNombre, usuarioRol, comentario }) {

  const registro = {
    empleadoId,
    periodoKey,
    estadoAnterior,
    estadoNuevo,
    usuarioId,
    usuarioNombre,
    usuarioRol,
    fecha: new Date().toISOString(),
    comentario: comentario || null
  };

  const historial = obtenerHistorialEstadosNomina();
  historial.push(registro);
  localStorage.setItem(NOMINA_HISTORIAL_ESTADOS_KEY, JSON.stringify(historial));

  if (typeof registrarAuditoria === 'function') {
    registrarAuditoria({
      usuarioId, usuarioNombre, rol: usuarioRol,
      modulo: 'nomina',
      accion: 'cambio_estado_nomina',
      descripcion: `Nómina de ${empleadoId} (${periodoKey}): ${ESTADOS_NOMINA_PERIODO[estadoAnterior] || estadoAnterior} → ${ESTADOS_NOMINA_PERIODO[estadoNuevo] || estadoNuevo}${comentario ? ` — ${comentario}` : ''}`
    });
  }

  return registro;

}

// Encargado envía la nómina a revisión de Administración. Válido desde
// "pendiente" o desde "corrección solicitada" (ciclo de revisión las
// veces que hagan falta — sección 5).
function enviarNominaAValidacion(empleadoId, periodoKey, { usuarioId, usuarioNombre }) {

  const periodo = guardarPeriodoNomina({ ...obtenerPeriodoNomina(empleadoId, periodoKey) });
  const estadoAnterior = periodo.estadoNomina || 'pendiente';

  if (estadoAnterior !== 'pendiente' && estadoAnterior !== 'correccion_solicitada') {
    return { ok: false, error: 'Esta nómina ya está en revisión o ya fue validada.' };
  }

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  periodos[clave].estadoNomina = 'necesita_validacion_admin';
  periodos[clave].validacionEncargado = { usuarioId, usuarioNombre, fecha: new Date().toISOString() };
  guardarPeriodosNomina(periodos);

  registrarCambioEstadoNomina({
    empleadoId, periodoKey, estadoAnterior, estadoNuevo: 'necesita_validacion_admin',
    usuarioId, usuarioNombre, usuarioRol: 'encargado'
  });

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (typeof agregarNotificacion === 'function' && empleado) {
    agregarNotificacion({
      texto: `La nómina de ${empleado.nombre} (${formatearRangoSemanaNomina(periodoKey)}) está lista para validación.`,
      link: `admin-nomina.html?empleado=${empleadoId}&periodo=${periodoKey}`,
      rolDestino: 'admin',
      tipo: 'nomina',
      origen: 'encargado'
    });
  }

  return { ok: true, periodo: periodos[clave] };

}

// Administración valida la nómina — único rol que puede hacerlo.
function validarNominaAdmin(empleadoId, periodoKey, { usuarioId, usuarioNombre }) {

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const periodo = periodos[clave];
  if (!periodo) return { ok: false, error: 'La nómina no existe.' };

  const estadoAnterior = periodo.estadoNomina || 'pendiente';
  if (estadoAnterior !== 'necesita_validacion_admin') {
    return { ok: false, error: 'Esta nómina no está esperando validación.' };
  }

  periodo.estadoNomina = 'validado_admin';
  periodo.validacionAdmin = { usuarioId, usuarioNombre, fecha: new Date().toISOString() };
  guardarPeriodosNomina(periodos);

  registrarCambioEstadoNomina({
    empleadoId, periodoKey, estadoAnterior, estadoNuevo: 'validado_admin',
    usuarioId, usuarioNombre, usuarioRol: 'admin'
  });

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (typeof agregarNotificacion === 'function' && empleado) {
    agregarNotificacion({
      texto: `La nómina de ${empleado.nombre} (${formatearRangoSemanaNomina(periodoKey)}) fue validada por Administración.`,
      link: `encargado-nomina.html?empleado=${empleadoId}&periodo=${periodoKey}`,
      rolDestino: 'encargado',
      tipo: 'nomina'
    });
  }

  return { ok: true, periodo };

}

// Administración regresa la nómina a Encargado con un comentario obligatorio.
function solicitarCorreccionNomina(empleadoId, periodoKey, { usuarioId, usuarioNombre, comentario }) {

  comentario = String(comentario || '').trim();
  if (!comentario) return { ok: false, error: 'Escribe qué debe corregir Encargado.' };

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const periodo = periodos[clave];
  if (!periodo) return { ok: false, error: 'La nómina no existe.' };

  const estadoAnterior = periodo.estadoNomina || 'pendiente';
  if (estadoAnterior !== 'necesita_validacion_admin') {
    return { ok: false, error: 'Esta nómina no está esperando validación.' };
  }

  periodo.estadoNomina = 'correccion_solicitada';
  periodo.comentarioCorreccion = comentario;
  guardarPeriodosNomina(periodos);

  registrarCambioEstadoNomina({
    empleadoId, periodoKey, estadoAnterior, estadoNuevo: 'correccion_solicitada',
    usuarioId, usuarioNombre, usuarioRol: 'admin', comentario
  });

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (typeof agregarNotificacion === 'function' && empleado) {
    agregarNotificacion({
      texto: `La nómina de ${empleado.nombre} (${formatearRangoSemanaNomina(periodoKey)}) requiere correcciones. Revisa el comentario de Administración.`,
      link: `encargado-nomina.html?empleado=${empleadoId}&periodo=${periodoKey}`,
      rolDestino: 'encargado',
      tipo: 'nomina'
    });
  }

  return { ok: true, periodo };

}

// ============================================================
// PAGO
// ============================================================

// El pago solo puede registrarse una vez que Administración validó
// la nómina (sección 6) — nunca antes.
function registrarPagoNomina(empleadoId, periodoKey, { montoPagado, registradoPor }) {

  const clave = construirClavePeriodo(empleadoId, periodoKey);
  const periodos = obtenerPeriodosNomina();
  const periodo = periodos[clave];
  if (!periodo) return { ok: false, error: 'Primero guarda el periodo antes de registrar el pago.' };
  if (periodo.estadoNomina !== 'validado_admin') {
    return { ok: false, error: 'Esta nómina debe estar validada por Administración antes de registrar el pago.' };
  }

  periodo.estadoPago = {
    estado: 'pagada',
    fechaPago: new Date().toISOString(),
    registradoPor,
    montoPagado
  };
  periodo.estadoNomina = 'pagado';
  guardarPeriodosNomina(periodos);

  // Si esta semana es la que le paga el desfase de inicio a este
  // empleado (ver aplicarDesfaseInicioNomina), queda bloqueado para
  // siempre en cuanto se registra el pago — ya no se puede volver a
  // aplicar ni deshacer.
  const empleados = obtenerEmpleadosNomina();
  const empleado = empleados.find(e => e.id === empleadoId);
  if (empleado?.desfaseInicioEstado?.periodoQuePaga === periodoKey && !empleado.desfaseInicioEstado.pagado) {
    empleado.desfaseInicioEstado.pagado = true;
    guardarEmpleadosNomina(empleados);
  }

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

function crearSolicitudAltaNomina({ nombre, fechaInicio, salarioBase, pagoHoraExtra, numeroEmpleado, cargo, fotoUrl, correo, celular, solicitadoPor, solicitadoPorId }) {

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
    cuentaInternaId: null,
    datosAlta: {
      nombre, fechaInicio,
      salarioBase: Number(salarioBase) || 0,
      pagoHoraExtra: Number(pagoHoraExtra) || 0,
      numeroEmpleado, cargo: cargo || 'staff',
      fotoUrl: fotoUrl || '', correo: correo || '', celular: celular || ''
    },
    motivoBaja: null,
    fechaEfectivaBaja: null,
    observaciones: null,
    estado: 'pendiente',
    solicitadoPor,
    solicitadoPorId: solicitadoPorId || null,
    solicitadoPorRol: 'encargado',
    fechaSolicitud: new Date().toISOString(),
    revisadoPor: null,
    revisadoPorId: null,
    fechaResolucion: null,
    motivoRechazo: null
  };

  solicitudes.unshift(nueva);
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'solicitud_alta', descripcion: `Solicitud de alta creada: ${nombre} (${numeroEmpleado})` });
  }
  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Nueva solicitud de alta: Encargado solicitó el alta de ${nombre}. Requiere revisión de Administración.`,
      link: `admin-nomina.html?solicitud=${nueva.id}`,
      rolDestino: 'admin',
      origen: 'encargado'
    });
  }

  return { ok: true, solicitud: nueva };

}

function crearSolicitudBajaNomina({ empleadoId, motivoBaja, fechaEfectivaBaja, observaciones, solicitadoPor, solicitadoPorId }) {

  const empleado = obtenerEmpleadoNominaPorId(empleadoId);
  if (!empleado) return { ok: false, error: 'El empleado no existe.' };
  if (!motivoBaja) return { ok: false, error: 'El motivo de baja es obligatorio.' };

  const solicitudes = obtenerSolicitudesNomina();
  const nueva = {
    id: `sol-${Date.now()}`,
    tipo: 'baja',
    empleadoId,
    cuentaInternaId: null,
    datosAlta: null,
    motivoBaja,
    fechaEfectivaBaja: fechaEfectivaBaja || new Date().toISOString().slice(0, 10),
    observaciones: observaciones || '',
    estado: 'pendiente',
    solicitadoPor,
    solicitadoPorId: solicitadoPorId || null,
    solicitadoPorRol: 'encargado',
    fechaSolicitud: new Date().toISOString(),
    revisadoPor: null,
    revisadoPorId: null,
    fechaResolucion: null,
    motivoRechazo: null
  };

  solicitudes.unshift(nueva);
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'solicitud_baja', descripcion: `Solicitud de baja creada: ${nombreCompletoEmpleadoNomina(empleado)} (${empleado.numeroEmpleado})` });
  }
  if (typeof agregarNotificacion === 'function') {
    agregarNotificacion({
      texto: `Nueva solicitud de baja: Encargado solicitó la baja de ${nombreCompletoEmpleadoNomina(empleado)}. Requiere revisión de Administración.`,
      link: `admin-nomina.html?solicitud=${nueva.id}`,
      rolDestino: 'admin',
      origen: 'encargado'
    });
  }

  return { ok: true, solicitud: nueva };

}

function nombreCompletoEmpleadoNomina(empleado) {
  return empleado ? empleado.nombre : '';
}

// Usuario/password iniciales de la cuenta que se crea al aprobar un
// alta — mismo patrón ya usado para Emprendedoras/Líderes
// (js/solicitudes-modelo.js → generarCredenciales): usuario corto +
// password = usuario + iniciales del nombre.
function generarCredencialesEmpleadoNomina(numeroEmpleado, nombre) {
  const usuario = String(numeroEmpleado).toLowerCase().replace(/\s+/g, '');
  const iniciales = String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
  return { usuario, password: `${usuario}${iniciales}` };
}

// Único rol que puede aprobar/denegar — Administración. Al aprobar un
// alta, además de crear el registro de nómina, crea automáticamente
// la cuenta de acceso correspondiente (sección 4): Staff → subcuenta
// de Staff (mismo sistema de cuentas internas que ya existe), Encargado/Admin
// → cuenta normal — nunca deja que Encargado cree cuentas directamente.
function aprobarSolicitudNomina(id, { usuarioAdminId, usuarioAdminNombre }) {

  const solicitudes = obtenerSolicitudesNomina();
  const solicitud = solicitudes.find(s => s.id === id);
  if (!solicitud) return { ok: false, error: 'La solicitud no existe.' };
  if (solicitud.estado !== 'pendiente') return { ok: false, error: 'Esta solicitud ya fue resuelta.' };

  let empleadoResultante = null;

  if (solicitud.tipo === 'alta') {

    const resultado = crearEmpleadoNomina(solicitud.datosAlta);
    if (!resultado.ok) return resultado;
    solicitud.empleadoId = resultado.empleado.id;
    empleadoResultante = resultado.empleado;

    if (typeof crearCuentaInterna === 'function') {
      const { usuario, password } = generarCredencialesEmpleadoNomina(resultado.empleado.numeroEmpleado, resultado.empleado.nombre);
      const cuenta = crearCuentaInterna({
        usuario, password,
        nombre: resultado.empleado.nombre,
        rol: resultado.empleado.cargo, // 'staff' | 'encargado' | 'admin' — mismos valores en ambos catálogos
        empleadoNominaId: resultado.empleado.id
      });
      if (cuenta.ok) solicitud.cuentaInternaId = cuenta.cuenta.id;
    }

  } else {

    const resultado = darDeBajaEmpleadoNomina(solicitud.empleadoId, solicitud.fechaEfectivaBaja);
    if (!resultado.ok) return resultado;
    empleadoResultante = resultado.empleado;

    if (typeof obtenerCuentaInternaPorEmpleadoNomina === 'function' && typeof desactivarCuentaInterna === 'function') {
      const cuenta = obtenerCuentaInternaPorEmpleadoNomina(solicitud.empleadoId);
      if (cuenta) {
        desactivarCuentaInterna(cuenta.id);
        solicitud.cuentaInternaId = cuenta.id;
      }
    }

  }

  solicitud.estado = 'aprobada';
  solicitud.revisadoPor = usuarioAdminNombre;
  solicitud.revisadoPorId = usuarioAdminId;
  solicitud.fechaResolucion = new Date().toISOString();
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: solicitud.tipo === 'alta' ? 'aprobar_alta' : 'aprobar_baja',
      descripcion: `Solicitud de ${solicitud.tipo} aprobada por ${usuarioAdminNombre}`
    });
  }
  if (typeof agregarNotificacion === 'function') {
    const nombreEmpleado = solicitud.tipo === 'alta' ? solicitud.datosAlta.nombre : nombreCompletoEmpleadoNomina(empleadoResultante);
    agregarNotificacion({
      texto: solicitud.tipo === 'alta' ? `Alta aprobada: la solicitud de alta de ${nombreEmpleado} fue aprobada y su cuenta ya está creada.` : `Baja aprobada: la solicitud de baja de ${nombreEmpleado} fue aprobada.`,
      link: `encargado-nomina.html?solicitud=${solicitud.id}`,
      rolDestino: 'encargado',
      tipo: 'nomina'
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
  solicitud.revisadoPorId = usuarioAdminId;
  solicitud.fechaResolucion = new Date().toISOString();
  guardarSolicitudesNomina(solicitudes);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'nomina',
      accion: solicitud.tipo === 'alta' ? 'rechazar_alta' : 'rechazar_baja',
      descripcion: `Solicitud de ${solicitud.tipo} rechazada por ${usuarioAdminNombre} — ${motivo}`
    });
  }
  if (typeof agregarNotificacion === 'function') {
    const nombreEmpleado = solicitud.tipo === 'alta' ? solicitud.datosAlta.nombre : nombreCompletoEmpleadoNomina(obtenerEmpleadoNominaPorId(solicitud.empleadoId));
    agregarNotificacion({
      texto: solicitud.tipo === 'alta' ? `Alta denegada: la solicitud de alta de ${nombreEmpleado} fue denegada. Motivo: ${motivo}` : `Baja denegada: la solicitud de baja de ${nombreEmpleado} fue denegada. Motivo: ${motivo}`,
      link: `encargado-nomina.html?solicitud=${solicitud.id}`,
      rolDestino: 'encargado',
      tipo: 'nomina'
    });
  }

  return { ok: true, solicitud };

}
