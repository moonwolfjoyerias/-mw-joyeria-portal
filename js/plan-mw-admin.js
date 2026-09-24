// MW JOYERÍA — Plan MW (Admin): lógica compartida de rangos y Reto de
// Constancia.
//
// Única fuente de cálculo para "quién está por subir de rango" / "quién
// está por ganar una recompensa" / "quién ya lo logró". La usan tanto
// la pestaña Equipo y Rango / Plan MW de Admin → Emprendedoras/Líderes
// como la nueva página Admin → Plan MW — ninguna de las dos duplica esta
// lógica por su cuenta.
//
// Reutiliza (no inventa reglas nuevas):
// - RANGOS_MW (js/lider-ejemplo.js) — mismos umbrales de rango reales.
// - HITOS_CONSTANCIA_PERSONA (js/personas-ejemplo.js) — mismos hitos
//   reales del Reto de Constancia (6/8/10/12 meses).
// - js/admin-comun.js — abrirAutorizacionAdmin / registrarAuditoriaAdmin.
// - js/notificaciones-modelo.js — agregarNotificacion.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3 sin cambiar la forma de estas funciones.

// "Próximo" a subir de rango = ya cumple al menos este % del requisito
// más limitante (no un promedio — el requisito más atrasado es el que
// realmente detiene el ascenso).
const UMBRAL_PROXIMIDAD_RANGO = 0.7;
// "Próxima" recompensa de constancia = le faltan máximo estos meses.
const UMBRAL_PROXIMIDAD_CONSTANCIA_MESES = 2;

function rangoLabel(key) {
  return RANGOS_MW.find(r => r.key === key)?.label || 'Sin Rango';
}

// Admin → Configuración → Plan MW es dueña de estos umbrales y premios
// (ver js/configuracion-modelo.js). Si esta página no la tiene cargada,
// se usan los mismos RANGOS_MW / HITOS_CONSTANCIA_PERSONA de siempre.
function obtenerRangoConfigurado(rango) {
  if (typeof obtenerValorVigente !== 'function') return rango;
  const personas = obtenerValorVigente('rango', `${rango.key}_personas`);
  const produccion = obtenerValorVigente('rango', `${rango.key}_produccion`);
  const compra = obtenerValorVigente('rango', `${rango.key}_compra`);
  const calificado = obtenerValorVigente('rango', `${rango.key}_calificado`);
  return {
    ...rango,
    personas: typeof personas === 'number' ? personas : rango.personas,
    produccion: typeof produccion === 'number' ? produccion : rango.produccion,
    compra: typeof compra === 'number' ? compra : rango.compra,
    calificado: typeof calificado === 'number' ? calificado : rango.calificado
  };
}

function obtenerHitosConstanciaConfigurados() {
  if (typeof obtenerValorVigente !== 'function') return HITOS_CONSTANCIA_PERSONA;
  return HITOS_CONSTANCIA_PERSONA.map(h => {
    const premio = obtenerValorVigente('constancia', `hito_${h.meses}_meses`);
    return { ...h, premio: typeof premio === 'string' && premio ? premio : h.premio };
  });
}

// ============================================================
// RANGOS
// ============================================================

// Compra personal (Sección 6 del Plan MW): Plata y Oro exigen $1,500
// en CADA sub-periodo (ambos, sin excepción). Diamante y Corona exigen
// $3,000, pero SOLO en el periodo en que se consolida el rango — no
// hace falta cumplirlo también en el otro periodo (Sección 7, "regla
// especial de Diamante y Corona").
function cumpleCompraPersonalRango(rangoKey, p1, p2, montoRequerido) {
  const soloUnPeriodo = rangoKey === 'diamante' || rangoKey === 'corona';
  const valorComparado = soloUnPeriodo ? Math.max(p1, p2) : Math.min(p1, p2);
  return { cumple: valorComparado >= montoRequerido, valorComparado, soloUnPeriodo };
}

// Producción que cuenta para el requisito del rango — con el tope del
// 50% por línea ya aplicado (Sección 5). La producción real/sin capar
// (statsReales.produccionGrupalMes) sigue usándose tal cual para
// comisiones; esta versión capada es SOLO para saber si se cumple el
// requisito de puntos de un rango.
function calcularProduccionParaRequisitoRango(personaId, mesKey, produccionRequerida) {
  if (typeof calcularProduccionCapadaParaRango !== 'function') return null;
  return calcularProduccionCapadaParaRango(personaId, mesKey, produccionRequerida);
}

// Requisitos del SIGUIENTE rango comparados contra los datos REALES de
// la líder — antes se leían de persona.stats (campos capturados a
// mano); ahora se calculan a partir de las piezas de apartado
// liquidadas de todo su equipo (js/compras-modelo.js). Si esta página
// no cargó compras-modelo.js, cae a persona.stats como red de
// seguridad (no debería ocurrir — se agregó a todas las páginas que
// cargan este archivo).
function calcularAscensoRango(persona, mesKey) {

  mesKey = mesKey || mesKeyActualComprasModelo();

  const idxActual = RANGOS_MW.findIndex(r => r.key === persona.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : obtenerRangoConfigurado(RANGOS_MW[idxActual + 1]);

  if (!siguiente) return { siguiente: null, items: [], elegible: false };

  const statsReales = typeof calcularStatsRangoLider === 'function'
    ? calcularStatsRangoLider(persona, mesKey, subPeriodoActualComprasModelo())
    : persona.stats;

  const { personasActivas, produccionGrupalMes, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = statsReales;
  const compra = cumpleCompraPersonalRango(siguiente.key, compraPersonalPeriodo1, compraPersonalPeriodo2, siguiente.compra);
  const produccionParaRequisito = calcularProduccionParaRequisitoRango(persona.id, mesKey, siguiente.produccion);
  const produccionEvaluada = produccionParaRequisito !== null ? produccionParaRequisito : produccionGrupalMes;

  const items = [
    { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}`, ratio: siguiente.personas ? personasActivas / siguiente.personas : 1, faltante: Math.max(0, siguiente.personas - personasActivas), unidad: 'personas' },
    { label: compra.soloUnPeriodo ? 'Compra personal (periodo de consolidación)' : 'Compra personal (ambos periodos)', cumple: compra.cumple, valores: `$${formatearDineroPersonas(compraPersonalPeriodo1)} y $${formatearDineroPersonas(compraPersonalPeriodo2)} / $${formatearDineroPersonas(siguiente.compra)}`, ratio: siguiente.compra ? compra.valorComparado / siguiente.compra : 1, faltante: Math.max(0, siguiente.compra - compra.valorComparado), unidad: 'dinero' },
    { label: 'Equipo calificado', cumple: personasCalificadas >= siguiente.calificado, valores: `${personasCalificadas} / ${siguiente.calificado} personas`, ratio: siguiente.calificado ? personasCalificadas / siguiente.calificado : 1, faltante: Math.max(0, siguiente.calificado - personasCalificadas), unidad: 'personas_calificadas' },
    { label: 'Producción grupal', cumple: produccionEvaluada >= siguiente.produccion, valores: `${formatearDineroPersonas(produccionEvaluada)} / ${formatearDineroPersonas(siguiente.produccion)} puntos`, ratio: siguiente.produccion ? produccionEvaluada / siguiente.produccion : 1, faltante: Math.max(0, siguiente.produccion - produccionEvaluada), unidad: 'puntos' }
  ];

  return { siguiente, items, elegible: items.every(it => it.cumple) };

}

// A diferencia de calcularAscensoRango (que compara contra el
// SIGUIENTE rango), esto compara contra los requisitos de SU PROPIO
// rango actual — para avisar en Comisiones si una líder ya no alcanza
// el mínimo de su propio rango este periodo. Es solo informativo: el
// % de comisión que se le aplica ya quedó fijo para el periodo (ver
// calcularRangoAplicadoPeriodo en comisiones-modelo.js), esto no lo
// cambia ni la baja de rango sola.
function calcularCumpleRangoActual(persona, periodoKey) {

  // El rango a exigir es el que estaba VIGENTE ese periodo (mismo
  // criterio que ya usa el cálculo de comisiones en
  // calcularRangoAplicadoPeriodo), no persona.rangoActualKey en crudo —
  // ese campo ya pudo cambiar por un ascenso confirmado DESPUÉS de este
  // periodo, y compararía un mes ya cerrado contra un rango que todavía
  // no tenía entonces.
  const rangoKey = periodoKey && typeof calcularRangoAplicadoPeriodo === 'function'
    ? calcularRangoAplicadoPeriodo(persona, periodoKey).rangoKey
    : persona.rangoActualKey;

  const rango = RANGOS_MW.find(r => r.key === rangoKey);
  if (!rango || rango.key === 'sin_rango') return { aplica: false, cumple: true, items: [] };

  const rangoConfigurado = obtenerRangoConfigurado(rango);

  const statsReales = typeof calcularStatsRangoLider === 'function'
    ? calcularStatsRangoLider(persona, periodoKey || mesKeyActualComprasModelo(), subPeriodoActualComprasModelo())
    : persona.stats;

  const { personasActivas, produccionGrupalMes, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = statsReales;
  const mesKeyEvaluado = periodoKey || mesKeyActualComprasModelo();
  const compra = cumpleCompraPersonalRango(rangoConfigurado.key, compraPersonalPeriodo1, compraPersonalPeriodo2, rangoConfigurado.compra);
  const produccionParaRequisito = calcularProduccionParaRequisitoRango(persona.id, mesKeyEvaluado, rangoConfigurado.produccion);
  const produccionEvaluada = produccionParaRequisito !== null ? produccionParaRequisito : produccionGrupalMes;

  const items = [
    { label: 'Personas activas', cumple: personasActivas >= rangoConfigurado.personas, valores: `${personasActivas} / ${rangoConfigurado.personas}` },
    { label: compra.soloUnPeriodo ? 'Compra personal (periodo de consolidación)' : 'Compra personal (ambos periodos)', cumple: compra.cumple, valores: `$${formatearDineroPersonas(compraPersonalPeriodo1)} y $${formatearDineroPersonas(compraPersonalPeriodo2)} / $${formatearDineroPersonas(rangoConfigurado.compra)}` },
    { label: 'Equipo calificado', cumple: personasCalificadas >= rangoConfigurado.calificado, valores: `${personasCalificadas} / ${rangoConfigurado.calificado} personas` },
    { label: 'Producción grupal', cumple: produccionEvaluada >= rangoConfigurado.produccion, valores: `${formatearDineroPersonas(produccionEvaluada)} / ${formatearDineroPersonas(rangoConfigurado.produccion)} puntos` }
  ];

  return { aplica: true, cumple: items.every(it => it.cumple), items };

}

// ============================================================
// RANGO EFECTIVO DEL MES (Secciones 9/12) — recalificación mensual
// ============================================================
//
// persona.rangoActualKey (arriba) es el rango HISTÓRICO: el máximo que
// alguna vez alcanzó, nunca baja, y es lo único que dispara el bono de
// "primera vez" (Sección 10) al confirmarse un ascenso. Esto es algo
// DISTINTO: el rango EFECTIVO de un mes ya cerrado — el que realmente
// cumplió ese mes en concreto, evaluando TODOS los rangos de arriba
// hacia abajo (no solo "el siguiente"), y que sí puede ser menor al
// histórico si ese mes no se recalificó. Las comisiones se calculan
// sobre este rango efectivo, nunca sobre el histórico directamente
// (ver calcularRangoAplicadoPeriodo en comisiones-modelo.js).
function calcularRangoEfectivoMes(persona, mesKey) {

  if (persona.tipo !== 'lider') return 'sin_rango';

  const statsReales = typeof calcularStatsRangoLider === 'function'
    ? calcularStatsRangoLider(persona, mesKey, 'p2')
    : persona.stats;

  const { personasActivas, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = statsReales;

  // De Corona hacia Plata (nunca sin_rango, que siempre "cumple" por
  // definición) — el primero que cumpla TODOS sus requisitos es el
  // rango efectivo de ese mes.
  for (let i = RANGOS_MW.length - 1; i >= 1; i--) {

    const rango = obtenerRangoConfigurado(RANGOS_MW[i]);

    const cumplePersonas = personasActivas >= rango.personas;
    const cumpleCalificado = personasCalificadas >= rango.calificado;
    const compra = cumpleCompraPersonalRango(rango.key, compraPersonalPeriodo1, compraPersonalPeriodo2, rango.compra);
    const produccionParaRequisito = calcularProduccionParaRequisitoRango(persona.id, mesKey, rango.produccion);
    const produccionEvaluada = produccionParaRequisito !== null ? produccionParaRequisito : statsReales.produccionGrupalMes;
    const cumpleProduccion = produccionEvaluada >= rango.produccion;

    if (cumplePersonas && cumpleCalificado && compra.cumple && cumpleProduccion) return rango.key;

  }

  return 'sin_rango';

}

// Recorre TODAS las líderes y cierra, de forma idempotente, el rango
// efectivo de los meses pasados que les falten procesar — mismo patrón
// de cursor que procesarCierresMensualesPlanMW (Constancia/Rifas), pero
// para persona.historialRangoEfectivo. El mes en curso NUNCA se cierra
// aquí (todavía puede cambiar): por eso comisiones-modelo.js siempre
// termina usando el último mes YA cerrado como el rango vigente del
// periodo que esté pagando, nunca una recalificación a medias.
function procesarRangoEfectivoMensual(persona) {

  if (persona.tipo !== 'lider') return false;
  if (typeof mesKeyActualComprasModelo !== 'function') return false;

  persona.historialRangoEfectivo = persona.historialRangoEfectivo || [];

  const mesKeyHoy = mesKeyActualComprasModelo();
  let cursor = (persona.fechaAlta || mesKeyHoy).slice(0, 7);
  if (cursor < MES_INICIO_CIERRE_AUTOMATICO) cursor = MES_INICIO_CIERRE_AUTOMATICO;
  let vueltas = 0;
  let huboCambios = false;

  while (cursor < mesKeyHoy && vueltas < 240) {

    if (!persona.historialRangoEfectivo.some(h => h.mesKey === cursor)) {
      const rangoKey = calcularRangoEfectivoMes(persona, cursor);
      persona.historialRangoEfectivo.push({ mesKey: cursor, rangoKey });
      huboCambios = true;
    }

    cursor = _siguienteMesKey(cursor);
    vueltas++;

  }

  return huboCambios;

}

// Para tarjetas de "Próximos a lograr": el requisito más atrasado (el
// que realmente falta) y qué tan cerca está en general (0-100%).
function calcularProximidadRango(persona) {

  const { siguiente, items, elegible } = calcularAscensoRango(persona);
  if (!siguiente || !items.length) return null;

  const limitante = items.reduce((peor, it) => (it.ratio < peor.ratio ? it : peor), items[0]);
  const progresoPct = Math.round(Math.min(1, limitante.ratio) * 100);

  return { siguiente, limitante, progresoPct, elegible };

}

// Revisa a todas las líderes y, si alguna ya cumple los requisitos del
// siguiente rango, avisa a Administración (notificación) para que
// confirme el ascenso manualmente — nunca sube de rango sola.
function verificarAscensosPendientes() {

  const personas = obtenerPersonas();
  let huboCambios = false;

  personas.filter(p => p.tipo === 'lider').forEach(persona => {

    const { siguiente, elegible } = calcularAscensoRango(persona);

    if (elegible && siguiente) {

      if (!persona.ascensoPendiente || persona.ascensoPendiente.rangoKey !== siguiente.key) {

        persona.ascensoPendiente = { rangoKey: siguiente.key, detectadoEn: new Date().toISOString() };
        huboCambios = true;

        if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('rango_candidata_detectada'))) {
          agregarNotificacion({
            texto: `${nombreCompletoPersona(persona)} cumple los requisitos para subir a ${siguiente.label}. Revisa y confirma su ascenso.`,
            link: `admin-emprendedoras-lideres.html?persona=${persona.id}&tab=equipo`,
            paraId: 'admin01',
            rolDestino: 'admin',
            origen: 'emprendedora_lider'
          });
        }

      }

    } else if (persona.ascensoPendiente) {
      // Ya no cumple (p. ej. se editaron sus datos) — se limpia sin notificar.
      delete persona.ascensoPendiente;
      huboCambios = true;
    }

  });

  if (huboCambios) guardarPersonas(personas);

}

// onExito(personaActualizada) — cada página refresca su propia vista.
function abrirConfirmarAscensoRango(persona, onExito) {

  const siguienteLabel = rangoLabel(persona.ascensoPendiente.rangoKey);

  abrirAutorizacionAdmin({
    titulo: 'Confirmar subida de rango',
    mensaje: `${escapeHTMLPersonas(nombreCompletoPersona(persona))} cumple los requisitos para subir a ${siguienteLabel}. ¿Confirmas su ascenso? Se actualizará su rango y se le notificará para que prepares sus premios.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === persona.id);
      if (!actual || !actual.ascensoPendiente) return;

      const rangoAnteriorKey = actual.rangoActualKey;
      const rangoAnterior = rangoLabel(rangoAnteriorKey);
      const fecha = new Date().toISOString();

      actual.rangoActualKey = actual.ascensoPendiente.rangoKey;
      delete actual.ascensoPendiente;
      actual.historialLogros.push({ tipo: 'ascenso_rango', fecha, rangoAnterior: rangoAnteriorKey, rangoNuevo: actual.rangoActualKey });

      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'ascenso_rango',
        descripcion: `${nombreCompletoPersona(actual)} subió de rango: ${rangoAnterior} → ${siguienteLabel}`
      });

      if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('cambio_rango_confirmado'))) {
        agregarNotificacion({
          texto: `¡Felicidades! Tu rango subió a ${siguienteLabel}. Sigue así <span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg></span>`,
          link: 'cuenta',
          paraId: actual.id,
          rolDestino: 'emprendedora_lider'
        });
      }

      if (typeof onExito === 'function') onExito(actual);

    }
  });

}

// ============================================================
// CIERRE MENSUAL REAL (Constancia y Rifas — Secciones 8.1/8.2)
// ============================================================
//
// mesesCumplidos (Constancia) y boletosPorMes (Rifas) son contadores
// HISTÓRICOS que solo deben avanzar una vez por mes, y solo para meses
// que ya terminaron — el mes en curso nunca se cierra (todavía se
// puede seguir comprando). Se procesan aquí, contra las compras NORMALES
// ya liquidadas de cada persona (nunca souvenirs — Sección 4), en vez
// de dejar mesesCumplidos/montoMesActual como campos estáticos que
// alguien tenía que actualizar a mano.

const META_CONSTANCIA_MENSUAL = 8000;
const META_RIFA_MENSUAL = 3000;
const MONTO_POR_BOLETO_EXTRA_RIFA = 1000;

// Mes en que este cierre automático (contra compras REALES liquidadas)
// empezó a regir. Los meses ANTERIORES a este no se evalúan — antes de
// esta fecha no existe ledger real de compras (ver nota TEMPORAL de
// apartados-modelo.js), así que "no hubo compra" en, por ejemplo, 2023
// no significa nada y no debe restar meses de Constancia ni disparar
// una inactivación automática de gente que en realidad sí compra hoy.
// Solo aplica a personas cuya fechaAlta es anterior a este mes — quien
// se dé de alta después arranca su conteo real desde su propia fechaAlta.
const MES_INICIO_CIERRE_AUTOMATICO = mesKeyActualComprasModelo();

function _siguienteMesKey(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const siguienteMes = mes === 12 ? 1 : mes + 1;
  const siguienteAnio = mes === 12 ? anio + 1 : anio;
  return `${siguienteAnio}-${String(siguienteMes).padStart(2, '0')}`;
}

// Cierra, de forma idempotente, todos los meses pasados que a esta
// persona le falten procesar. Regresa true si cambió algo (para saber
// si hace falta guardarPersonas). No guarda por sí sola — la llama
// quien ya está iterando/guardando el arreglo completo de personas.
function procesarCierresMensualesPlanMW(persona) {

  if (typeof obtenerComprasLiquidadasPersonaMes !== 'function' || typeof mesKeyActualComprasModelo !== 'function') return false;

  let huboCambios = false;

  persona.constancia = persona.constancia || { mesesCumplidos: 0, montoMesActual: 0, metaMes: META_CONSTANCIA_MENSUAL, hitosOtorgados: [] };
  persona.constancia.mesesProcesados = persona.constancia.mesesProcesados || [];
  persona.constancia.excedenteDisponible = persona.constancia.excedenteDisponible || 0;
  persona.constancia.mesesCumplidos = persona.constancia.mesesCumplidos || 0;

  persona.rifa = persona.rifa || { montoAcumuladoMes: 0, meta: META_RIFA_MENSUAL };
  persona.rifa.mesesProcesados = persona.rifa.mesesProcesados || [];
  persona.rifa.boletosPorMes = persona.rifa.boletosPorMes || {};

  // Reparación de datos: una versión anterior de este cierre sí procesó
  // meses previos a MES_INICIO_CIERRE_AUTOMATICO (ver nota arriba), y
  // esos meses quedaron grabados en localStorage con "compra $0" que no
  // significa nada real. Se limpian aquí para que cuentas que ya habían
  // sido inactivadas por error puedan reactivarse y esa reactivación no
  // se revierta sola en la siguiente carga (evaluarActividadMensualPersona
  // toma los últimos meses de este mismo arreglo).
  const mesesConstanciaLimpios = persona.constancia.mesesProcesados.filter(m => m >= MES_INICIO_CIERRE_AUTOMATICO);
  if (mesesConstanciaLimpios.length !== persona.constancia.mesesProcesados.length) {
    persona.constancia.mesesProcesados = mesesConstanciaLimpios;
    huboCambios = true;
  }
  const mesesRifaLimpios = persona.rifa.mesesProcesados.filter(m => m >= MES_INICIO_CIERRE_AUTOMATICO);
  if (mesesRifaLimpios.length !== persona.rifa.mesesProcesados.length) {
    persona.rifa.mesesProcesados = mesesRifaLimpios;
    huboCambios = true;
  }

  const mesKeyHoy = mesKeyActualComprasModelo();
  let cursor = (persona.fechaAlta || mesKeyHoy).slice(0, 7);
  if (cursor < MES_INICIO_CIERRE_AUTOMATICO) cursor = MES_INICIO_CIERRE_AUTOMATICO;
  let vueltas = 0;

  while (cursor < mesKeyHoy && vueltas < 240) { // tope defensivo: 20 años, nunca debería alcanzarse

    if (!persona.constancia.mesesProcesados.includes(cursor)) {
      const comprasNormalesMes = obtenerComprasLiquidadasPersonaMes(persona.id, cursor).normal;
      const totalConExcedente = comprasNormalesMes + persona.constancia.excedenteDisponible;
      if (totalConExcedente >= META_CONSTANCIA_MENSUAL) {
        persona.constancia.mesesCumplidos += 1;
        persona.constancia.excedenteDisponible = totalConExcedente - META_CONSTANCIA_MENSUAL;
      } else {
        persona.constancia.excedenteDisponible = 0;
      }
      persona.constancia.mesesProcesados.push(cursor);
      huboCambios = true;
    }

    if (!persona.rifa.mesesProcesados.includes(cursor)) {
      const comprasNormalesMes = obtenerComprasLiquidadasPersonaMes(persona.id, cursor).normal;
      if (comprasNormalesMes >= META_RIFA_MENSUAL) {
        const extra = Math.floor((comprasNormalesMes - META_RIFA_MENSUAL) / MONTO_POR_BOLETO_EXTRA_RIFA);
        persona.rifa.boletosPorMes[cursor] = 1 + extra;
      }
      persona.rifa.mesesProcesados.push(cursor);
      huboCambios = true;
    }

    cursor = _siguienteMesKey(cursor);
    vueltas++;

  }

  // Progreso del mes EN CURSO — informativo, se recalcula siempre (no
  // se marca como "procesado" hasta que el mes efectivamente termine).
  const comprasMesActual = obtenerComprasLiquidadasPersonaMes(persona.id, mesKeyHoy).normal;
  if (persona.constancia.montoMesActual !== comprasMesActual) { persona.constancia.montoMesActual = comprasMesActual; huboCambios = true; }
  if (persona.rifa.montoAcumuladoMes !== comprasMesActual) { persona.rifa.montoAcumuladoMes = comprasMesActual; huboCambios = true; }

  return huboCambios;

}

// Recorre TODAS las personas y cierra sus meses pendientes de una vez
// — pensado para llamarse junto con verificarAscensosPendientes()/
// verificarRecompensasConstancia() cada vez que se abre la campana de
// notificaciones de Admin (ver admin-comun.js).
function procesarCierresMensualesPlanMWTodas() {

  const personas = obtenerPersonas();
  let huboCambios = false;

  personas.forEach(persona => {
    if (procesarCierresMensualesPlanMW(persona)) huboCambios = true;
    if (evaluarActividadMensualPersona(persona)) huboCambios = true;
    if (procesarRangoEfectivoMensual(persona)) huboCambios = true;
  });

  if (huboCambios) guardarPersonas(personas);

  return huboCambios;

}

// ============================================================
// CICLO DE VIDA — ACTIVA/INACTIVA AUTOMÁTICA (Sección 15)
// ============================================================
//
// Se apoya en persona.constancia.mesesProcesados (ya cerrado arriba)
// como el registro de "meses que ya terminaron" — el mismo concepto
// que usa Constancia/Rifas, así que no hace falta llevarlo por
// separado. Nunca toca a alguien con estado 'baja' (es manual y
// definitivo, no se reactiva solo). El mes EN CURSO nunca decide nada
// — solo meses ya cerrados cuentan, igual que Constancia/Rifas.

const MESES_INACTIVIDAD_PARA_AUTO_INACTIVAR = 6;

function evaluarActividadMensualPersona(persona) {

  if (typeof obtenerComprasLiquidadasPersonaMes !== 'function' || typeof UMBRAL_ACTIVA_MENSUAL === 'undefined') return false;
  if (persona.estado === 'baja') return false;

  const mesesCerrados = (persona.constancia?.mesesProcesados || []);
  if (!mesesCerrados.length) return false;

  const cumpleMinimoMes = (mesKey) => obtenerComprasLiquidadasPersonaMes(persona.id, mesKey).total >= UMBRAL_ACTIVA_MENSUAL;

  if (persona.estado === 'activa') {

    const ultimosSeis = mesesCerrados.slice(-MESES_INACTIVIDAD_PARA_AUTO_INACTIVAR);
    if (ultimosSeis.length < MESES_INACTIVIDAD_PARA_AUTO_INACTIVAR) return false;
    if (ultimosSeis.some(cumpleMinimoMes)) return false; // le bastó UN mes con compra mínima en la ventana

    persona.estado = 'inactiva';
    if (typeof agregarNotificacion === 'function') {
      agregarNotificacion({
        texto: `${nombreCompletoPersona(persona)} fue marcada como INACTIVA automáticamente — sin compra mínima de $500 en los últimos 6 meses.`,
        link: `admin-emprendedoras-lideres.html?persona=${persona.id}`,
        paraId: 'admin01', rolDestino: 'admin', origen: 'emprendedora_lider'
      });
    }
    return true;

  }

  if (persona.estado === 'inactiva') {

    const ultimoMesCerrado = mesesCerrados[mesesCerrados.length - 1];
    if (!cumpleMinimoMes(ultimoMesCerrado)) return false;

    persona.estado = 'activa';
    if (typeof agregarNotificacion === 'function') {
      agregarNotificacion({
        texto: `${nombreCompletoPersona(persona)} volvió a estar ACTIVA automáticamente — ya cumplió la compra mínima mensual.`,
        link: `admin-emprendedoras-lideres.html?persona=${persona.id}`,
        paraId: 'admin01', rolDestino: 'admin', origen: 'emprendedora_lider'
      });
    }
    return true;

  }

  return false;

}

// ============================================================
// RETO DE CONSTANCIA
// ============================================================

// Primer hito que todavía no ha sido otorgado, y qué tan cerca está.
function calcularProximidadConstancia(persona) {

  const otorgados = persona.constancia.hitosOtorgados || [];
  const siguienteHito = obtenerHitosConstanciaConfigurados().find(h => !otorgados.some(o => o.meses === h.meses));

  if (!siguienteHito) return null; // ya recibió todos los hitos

  const mesesCumplidos = persona.constancia.mesesCumplidos || 0;
  const mesesFaltantes = Math.max(0, siguienteHito.meses - mesesCumplidos);
  const elegible = mesesCumplidos >= siguienteHito.meses;
  const progresoPct = Math.round(Math.min(1, mesesCumplidos / siguienteHito.meses) * 100);

  return { siguienteHito, mesesCumplidos, mesesFaltantes, elegible, progresoPct };

}

// Revisa a TODAS las personas (Emprendedoras y Líderes — el Reto de
// Constancia aplica a ambas) y avisa a Administración cuando alguna ya
// cumple los meses de un hito que todavía no se le ha otorgado.
function verificarRecompensasConstancia() {

  const personas = obtenerPersonas();
  let huboCambios = false;

  personas.forEach(persona => {

    const proximidad = calcularProximidadConstancia(persona);

    if (proximidad && proximidad.elegible) {

      const yaAvisado = persona.recompensaPendiente && persona.recompensaPendiente.meses === proximidad.siguienteHito.meses;

      if (!yaAvisado) {

        persona.recompensaPendiente = { meses: proximidad.siguienteHito.meses, premio: proximidad.siguienteHito.premio, detectadoEn: new Date().toISOString() };
        huboCambios = true;

        if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('constancia_hito_detectado'))) {
          agregarNotificacion({
            texto: `${nombreCompletoPersona(persona)} cumplió ${proximidad.siguienteHito.meses} compras del Reto de Constancia. Confirma y prepara su premio: ${proximidad.siguienteHito.premio}.`,
            link: `admin-emprendedoras-lideres.html?persona=${persona.id}&tab=planmw`,
            paraId: 'admin01',
            rolDestino: 'admin',
            origen: 'emprendedora_lider'
          });
        }

      }

    } else if (persona.recompensaPendiente) {
      delete persona.recompensaPendiente;
      huboCambios = true;
    }

  });

  if (huboCambios) guardarPersonas(personas);

}

function abrirConfirmarRecompensaConstancia(persona, onExito) {

  const { meses, premio } = persona.recompensaPendiente;

  abrirAutorizacionAdmin({
    titulo: 'Confirmar recompensa',
    mensaje: `${escapeHTMLPersonas(nombreCompletoPersona(persona))} cumplió ${meses} compras del Reto de Constancia. ¿Confirmas la entrega de su premio: ${escapeHTMLPersonas(premio)}?`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === persona.id);
      if (!actual || !actual.recompensaPendiente) return;

      const fecha = new Date().toISOString();
      actual.constancia.hitosOtorgados = actual.constancia.hitosOtorgados || [];
      actual.constancia.hitosOtorgados.push({ meses, premio, fecha });
      delete actual.recompensaPendiente;
      actual.historialLogros.push({ tipo: 'recompensa_constancia', fecha, hito: meses, premio });

      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'recompensa_constancia',
        descripcion: `${nombreCompletoPersona(actual)} recibió "${premio}" por ${meses} compras del Reto de Constancia`
      });

      if (typeof agregarNotificacion === 'function' && (typeof estaEventoNotifActivo !== 'function' || estaEventoNotifActivo('recompensa_constancia_entregada'))) {
        agregarNotificacion({
          texto: `¡Felicidades! Ganaste "${premio}" por cumplir ${meses} compras del Reto de Constancia <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20l5-13"/><path d="M9 7l2 2M13 4l1 2M6 15l2 1"/><circle cx="17" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="11" r="1" fill="currentColor" stroke="none"/></svg></span>`,
          link: 'cuenta',
          paraId: actual.id,
          rolDestino: 'emprendedora_lider'
        });
      }

      if (typeof onExito === 'function') onExito(actual);

    }
  });

}

// ============================================================
// LOGROS DEL PERIODO (Admin → Plan MW)
// ============================================================

// Aplana historialLogros de todas las personas en una sola lista
// { persona, logro }, más reciente primero.
function obtenerLogrosPlanMW() {

  const registros = [];

  obtenerPersonas().forEach(persona => {
    (persona.historialLogros || []).forEach(logro => {
      registros.push({ persona, logro });
    });
  });

  registros.sort((a, b) => b.logro.fecha.localeCompare(a.logro.fecha));

  return registros;

}
