// MW JOYERÍA — Admin: Configuración (motor de reglas versionadas)
//
// "Configuración define las reglas. Los módulos operativos las usan."
// Este archivo es la ÚNICA fuente de parámetros de negocio con vigencia
// por fecha (comisiones, bonos, rangos, constancia, rifas, apartados,
// fórmula, redondeo, periodos). Los módulos que ya calculaban estos
// valores (js/comisiones-modelo.js, js/plan-mw-admin.js,
// js/apartados-modelo.js, js/lider-cuenta.js) se modificaron para leer
// de aquí PRIMERO y solo usar su valor fijo original como respaldo si
// esta página no está cargada — así ninguna página deja de funcionar
// si todavía no incluye este script, pero apenas lo incluye, deja de
// duplicar la regla.
//
// MODELO DE VERSIONES (nunca se borra ni se sobreescribe un valor):
// cada parámetro es una lista de registros con vigenteDesde/vigenteHasta.
// Cambiar un valor NUNCA modifica el registro anterior más que para
// "cerrar" su vigencia (ponerle vigenteHasta = fecha de inicio de la
// nueva versión) — el valor histórico sigue intacto y consultable.
// Mismo espíritu que historialLogros (js/personas-ejemplo.js): bitácora
// que solo crece, nunca se reescribe.
//
// ⚠️ TEMPORAL: localStorage simula Firestore. La estructura ya está
// pensada para ser un documento por versión en una colección
// "configuracion" — ver guardarNuevaVersionParametro().
//
// ⚠️ LÍMITE DE SEGURIDAD CONOCIDO (ver sección "Usuarios y permisos" de
// la página): ocultar botones con JavaScript no es una barrera de
// seguridad real. Mientras no exista Firebase con Security Rules, CUALQUIER
// persona con acceso a las herramientas de desarrollador de su navegador
// podría, en teoría, llamar estas funciones directamente. Se documenta
// aquí para no dar una falsa sensación de seguridad.

const CONFIG_VERSIONES_KEY = 'mw-configuracion-v1';
const CONFIG_SIMPLE_KEY = 'mw-configuracion-simple-v1';
const CONFIG_BORRADOR_KEY = 'mw-configuracion-borrador-v1';

const CONFIG_FECHA_SEMILLA = '2020-01-01';

// ============================================================
// UTILIDADES DE FECHA
// ============================================================

function configHoyISO() {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
}

// ============================================================
// ALMACÉN DE VERSIONES (append-only)
// ============================================================

function obtenerVersionesConfig() {
  try {
    const datos = JSON.parse(localStorage.getItem(CONFIG_VERSIONES_KEY));
    return Array.isArray(datos) ? datos : [];
  } catch (error) {
    return [];
  }
}

function guardarVersionesConfig(lista) {
  localStorage.setItem(CONFIG_VERSIONES_KEY, JSON.stringify(lista));
}

function obtenerVersionesParametro(tipo, parametro) {
  asegurarSemillaConfiguracion();
  return obtenerVersionesConfig()
    .filter(v => v.tipo === tipo && v.parametro === parametro)
    .sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
}

// Valor vigente de un parámetro en una fecha dada (por defecto, hoy).
// Devuelve undefined si el parámetro no existe todavía (no sembrado en
// esta página porque le faltan los datos originales para sembrarlo).
function obtenerValorVigente(tipo, parametro, fecha) {
  const fechaRef = fecha || configHoyISO();
  const versiones = obtenerVersionesParametro(tipo, parametro);
  const vigente = versiones.find(v => v.vigenteDesde <= fechaRef && (!v.vigenteHasta || fechaRef < v.vigenteHasta));
  return vigente ? vigente.valor : undefined;
}

function obtenerVersionVigente(tipo, parametro, fecha) {
  const fechaRef = fecha || configHoyISO();
  const versiones = obtenerVersionesParametro(tipo, parametro);
  return versiones.find(v => v.vigenteDesde <= fechaRef && (!v.vigenteHasta || fechaRef < v.vigenteHasta)) || null;
}

// Crea una nueva versión vigente desde `vigenteDesde` y cierra la
// versión anterior (le pone vigenteHasta = vigenteDesde) SIN borrarla.
function guardarNuevaVersionParametro({ tipo, parametro, valor, vigenteDesde, motivo, usuarioAdminId, usuarioAdminNombre, seccion, etiqueta }) {

  const desde = vigenteDesde || configHoyISO();
  const lista = obtenerVersionesConfig();

  const abierta = lista.find(v => v.tipo === tipo && v.parametro === parametro && !v.vigenteHasta);
  const valorAnterior = abierta ? abierta.valor : undefined;
  if (abierta) abierta.vigenteHasta = desde;

  const registro = {
    id: `CFG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tipo,
    parametro,
    seccion: seccion || tipo,
    etiqueta: etiqueta || parametro,
    valor,
    valorAnterior: valorAnterior !== undefined ? valorAnterior : null,
    vigenteDesde: desde,
    vigenteHasta: null,
    motivo: motivo || '',
    usuarioAdminId,
    usuarioAdminNombre,
    fechaModificacion: new Date().toISOString()
  };

  lista.push(registro);
  guardarVersionesConfig(lista);

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'configuracion',
      accion: 'nueva_version_parametro',
      descripcion: `${registro.seccion} → ${registro.etiqueta}: ${formatearValorConfig(valorAnterior)} → ${formatearValorConfig(valor)} (vigente desde ${desde})${motivo ? ` — ${motivo}` : ''}`
    });
  }

  return registro;

}

// Restaurar una versión histórica = crear una versión NUEVA con ese
// mismo valor, nunca borrar lo que había en medio. El historial
// completo (incluida la versión que se acaba de "reemplazar") sigue
// intacto.
function restaurarVersionParametro({ tipo, parametro, valorHistorico, vigenteDesde, usuarioAdminId, usuarioAdminNombre, seccion, etiqueta }) {
  return guardarNuevaVersionParametro({
    tipo, parametro, valor: valorHistorico, vigenteDesde, usuarioAdminId, usuarioAdminNombre, seccion, etiqueta,
    motivo: 'Restaurado desde una versión anterior'
  });
}

function formatearValorConfig(valor) {
  if (valor === null || valor === undefined) return '—';
  if (typeof valor === 'number') return String(valor);
  return String(valor);
}

// ============================================================
// SEMILLA — mismos valores reales que ya usa el sistema hoy, nunca
// inventados. Cada bloque se sembra solo si todavía no existe Y si las
// constantes que necesita ya están cargadas en esta página (si no,
// simplemente no siembra nada de ese bloque — otra página que sí las
// tenga cargadas lo hará más adelante; ver nota de arquitectura).
// ============================================================

function _configYaSembrado(tipo, parametro) {
  return obtenerVersionesConfig().some(v => v.tipo === tipo && v.parametro === parametro);
}

function _sembrarValor(tipo, parametro, valor, seccion, etiqueta) {
  if (_configYaSembrado(tipo, parametro)) return;
  const lista = obtenerVersionesConfig();
  lista.push({
    id: `CFG-seed-${tipo}-${parametro}`,
    tipo,
    parametro,
    seccion: seccion || tipo,
    etiqueta: etiqueta || parametro,
    valor,
    valorAnterior: null,
    vigenteDesde: CONFIG_FECHA_SEMILLA,
    vigenteHasta: null,
    motivo: 'Valor original del sistema',
    usuarioAdminId: 'sistema',
    usuarioAdminNombre: 'Sistema',
    fechaModificacion: `${CONFIG_FECHA_SEMILLA}T00:00:00.000Z`
  });
  guardarVersionesConfig(lista);
}

function asegurarSemillaConfiguracion() {
  _asegurarSemillaFormulaYRedondeo();
  _asegurarSemillaPeriodos();
  _asegurarSemillaApartados();
  _asegurarSemillaRifa();
  _asegurarSemillaRangosYComisiones();
  _asegurarSemillaConstancia();
}

function _asegurarSemillaFormulaYRedondeo() {
  _sembrarValor('formula', 'iva_divisor', 1.16, 'Comisiones', 'Divisor de IVA de la fórmula');
  _sembrarValor('redondeo', 'modo', 'dos_decimales', 'Comisiones', 'Redondeo de comisiones');
}

function _asegurarSemillaPeriodos() {
  _sembrarValor('periodo', 'p1_dia_fin', 15, 'Comisiones', 'Periodo 1 — último día');
  _sembrarValor('periodo', 'p1_dia_pago', 20, 'Comisiones', 'Periodo 1 — día de pago');
  _sembrarValor('periodo', 'p2_dia_pago', 5, 'Comisiones', 'Periodo 2 — día de pago (mes siguiente)');
}

function _asegurarSemillaApartados() {
  _sembrarValor('apartado', 'deposito_base', 50, 'Apartados', 'Depósito base');
  _sembrarValor('apartado', 'ventana_normal_dias', 3, 'Apartados', 'Ventana nacional (días)');
  _sembrarValor('apartado', 'ventana_foranea_dias', 15, 'Apartados', 'Ventana foránea (días)');
}

function _asegurarSemillaRifa() {
  _sembrarValor('rifa', 'meta_mensual', 3000, 'Plan MW', 'Rifa — meta mensual');
  _sembrarValor('rifa', 'monto_por_boleto_extra', 1000, 'Plan MW', 'Rifa — monto por boleto extra');
}

function _asegurarSemillaRangosYComisiones() {
  if (typeof RANGOS_MW === 'undefined' || typeof COMISIONES_PCT === 'undefined') return;

  RANGOS_MW.forEach(r => {
    _sembrarValor('rango', `${r.key}_personas`, r.personas, 'Plan MW', `Rango ${r.label} — personas activas`);
    _sembrarValor('rango', `${r.key}_produccion`, r.produccion, 'Plan MW', `Rango ${r.label} — producción grupal`);
    _sembrarValor('rango', `${r.key}_compra`, r.compra, 'Plan MW', `Rango ${r.label} — compra personal`);
    _sembrarValor('rango', `${r.key}_calificado`, r.calificado, 'Plan MW', `Rango ${r.label} — % equipo calificado`);
  });

  Object.entries(COMISIONES_PCT).forEach(([rango, pcts]) => {
    pcts.forEach((pct, i) => {
      _sembrarValor('comision', `nivel${i + 1}_${rango}`, pct, 'Comisiones', `Nivel ${i + 1} · ${rango}`);
    });
  });

  const bonos = { plata: 2500, oro: 3500, diamante: 5000, corona: 10000 };
  Object.entries(bonos).forEach(([rango, monto]) => {
    _sembrarValor('bono', rango, monto, 'Plan MW', `Bono por rango — ${rango}`);
  });
}

function _asegurarSemillaConstancia() {
  if (typeof HITOS_CONSTANCIA_PERSONA === 'undefined') return;
  HITOS_CONSTANCIA_PERSONA.forEach(h => {
    _sembrarValor('constancia', `hito_${h.meses}_meses`, h.premio, 'Plan MW', `Reto de Constancia — ${h.meses} meses`);
  });
}

// ============================================================
// CONFIGURACIÓN "SIMPLE" (sin vigencia — no afecta dinero histórico):
// Datos de MW, Sistema, y qué eventos generan notificación.
// ============================================================

function obtenerConfigSimple() {
  const porDefecto = {
    datosMW: {
      nombreEmpresa: 'MW Joyería',
      logoUrl: '',
      telefono: '',
      direccion: '',
      datosOficiales: '',
      correoContacto: ''
    },
    sistema: {
      zonaHoraria: 'America/Mexico_City',
      moneda: 'MXN',
      formatoFecha: 'dd/mm/aaaa',
      formatoCantidad: '1,234.56',
      modoMantenimiento: false
    },
    // Solo eventos que YA disparan agregarNotificacion() en el sistema
    // real (js/solicitudes-modelo.js, js/plan-mw-admin.js) — no se
    // inventan eventos nuevos que no existen todavía.
    notificaciones: {
      solicitud_aprobada: true,
      solicitud_rechazada: true,
      rango_candidata_detectada: true,
      cambio_rango_confirmado: true,
      constancia_hito_detectado: true,
      recompensa_constancia_entregada: true
    }
  };

  try {
    const guardado = JSON.parse(localStorage.getItem(CONFIG_SIMPLE_KEY));
    if (!guardado || typeof guardado !== 'object') return porDefecto;
    return {
      datosMW: { ...porDefecto.datosMW, ...(guardado.datosMW || {}) },
      sistema: { ...porDefecto.sistema, ...(guardado.sistema || {}) },
      notificaciones: { ...porDefecto.notificaciones, ...(guardado.notificaciones || {}) }
    };
  } catch (error) {
    return porDefecto;
  }
}

function guardarConfigSimple(parcial, { seccion, descripcion } = {}) {
  const actual = obtenerConfigSimple();
  const nuevo = {
    datosMW: { ...actual.datosMW, ...(parcial.datosMW || {}) },
    sistema: { ...actual.sistema, ...(parcial.sistema || {}) },
    notificaciones: { ...actual.notificaciones, ...(parcial.notificaciones || {}) }
  };
  localStorage.setItem(CONFIG_SIMPLE_KEY, JSON.stringify(nuevo));

  if (typeof registrarAuditoriaAdmin === 'function') {
    registrarAuditoriaAdmin({
      modulo: 'configuracion',
      accion: 'actualizar_config_simple',
      descripcion: descripcion || `Se actualizó ${seccion || 'una sección'} de Configuración.`
    });
  }

  return nuevo;
}

// Se usa desde los puntos reales donde ya se dispara una notificación
// (no crea un sistema paralelo — solo decide si ESE agregarNotificacion
// ya existente se ejecuta o no).
function estaEventoNotifActivo(clave) {
  const config = obtenerConfigSimple();
  return config.notificaciones[clave] !== false;
}

// ============================================================
// BORRADOR (autoguardado local de cambios TODAVÍA no confirmados —
// section 13/11: nada financiero se guarda como versión final hasta
// que Admin confirma en el modal con fecha de vigencia).
// ============================================================

function obtenerBorradorConfig() {
  try {
    const datos = JSON.parse(localStorage.getItem(CONFIG_BORRADOR_KEY));
    return datos && typeof datos === 'object' ? datos : null;
  } catch (error) {
    return null;
  }
}

function guardarBorradorConfig(pendiente) {
  localStorage.setItem(CONFIG_BORRADOR_KEY, JSON.stringify({ ...pendiente, guardadoEn: new Date().toISOString() }));
}

function descartarBorradorConfig() {
  localStorage.removeItem(CONFIG_BORRADOR_KEY);
}

// ============================================================
// HISTORIAL DE CAMBIOS (sección Auditoría de Configuración) — se lee
// directamente de las versiones, que ya son append-only.
// ============================================================

function obtenerHistorialCambiosConfig() {
  return obtenerVersionesConfig()
    .filter(v => v.usuarioAdminId !== 'sistema')
    .sort((a, b) => b.fechaModificacion.localeCompare(a.fechaModificacion));
}
