// MW JOYERÍA — Alerta de inactividad hacia la línea de líderes
//
// Cuando una Emprendedora lleva varias semanas sin llegar a la compra
// mínima, se marca con persona.alertaInactividad y se avisa a su línea
// de líderes (líder directa + hasta NIVELES_ALERTA_INACTIVIDAD_UPLINE-1
// niveles arriba) para que puedan contactarla y ver qué pasa.
//
// A propósito es una bandera SEPARADA del campo persona.estado (activa/
// inactiva/baja, ver personas-ejemplo.js) y del ciclo de 6 meses que ya
// existe en plan-mw-admin.js (evaluarActividadMensualPersona): esta
// alerta es mucho más corta (semanas, no meses) y es solo una señal de
// seguimiento para las líderes — nunca bloquea el login de la persona
// ni afecta comisiones, rango o apartados (ninguno de esos módulos lee
// esta bandera).
//
// Depende de: personas-ejemplo.js (obtenerPersonas/guardarPersonas,
// calcularCadenaLideresHaciaArriba), compras-modelo.js
// (obtenerComprasLiquidadasPersonaDesde), configuracion-modelo.js
// (parámetros 'inactividad'), notificaciones-modelo.js (agregarNotificacion).
// ⚠️ TEMPORAL: localStorage simula Firestore. Se reemplaza en Fase 3.

const NIVELES_ALERTA_INACTIVIDAD_UPLINE = 4; // líder directa + 3 niveles arriba

// Valores por defecto si Configuración todavía no está cargada en esta
// página (misma idea que UMBRAL_ACTIVA_MENSUAL en compras-modelo.js).
const ALERTA_INACTIVIDAD_SEMANAS_DEFECTO = 5;
const ALERTA_INACTIVIDAD_MONTO_DEFECTO = 500;

function obtenerParametrosAlertaInactividad() {
  const semanas = typeof obtenerValorVigente === 'function' ? obtenerValorVigente('inactividad', 'semanas_alerta') : undefined;
  const monto = typeof obtenerValorVigente === 'function' ? obtenerValorVigente('inactividad', 'monto_minimo') : undefined;
  return {
    semanas: semanas !== undefined ? semanas : ALERTA_INACTIVIDAD_SEMANAS_DEFECTO,
    monto: monto !== undefined ? monto : ALERTA_INACTIVIDAD_MONTO_DEFECTO
  };
}

// Evalúa UNA persona y actualiza persona.alertaInactividad si corresponde
// (no guarda — quien llama decide cuándo persistir). Devuelve true si
// hubo un cambio.
function evaluarAlertaInactividadPersona(persona) {

  if (persona.tipo !== 'emprendedora' || persona.estado === 'baja') return false;
  if (typeof obtenerComprasLiquidadasPersonaDesde !== 'function' || typeof calcularCadenaLideresHaciaArriba !== 'function') return false;

  const { semanas, monto } = obtenerParametrosAlertaInactividad();

  // Todavía no lleva suficiente tiempo inscrita para juzgarla con esta
  // ventana — igual que la regla mensual, un mes/semana en curso nunca
  // decide nada por sí solo.
  const fechaAlta = persona.fechaAlta ? new Date(persona.fechaAlta) : null;
  const haceNSemanas = new Date(Date.now() - semanas * 7 * 24 * 60 * 60 * 1000);
  if (fechaAlta && fechaAlta > haceNSemanas) return false;

  const fechaDesdeISO = haceNSemanas.toISOString().slice(0, 10);
  const cumpleMinimo = obtenerComprasLiquidadasPersonaDesde(persona.id, fechaDesdeISO).total >= monto;

  if (!cumpleMinimo && !persona.alertaInactividad) {

    persona.alertaInactividad = { desde: new Date().toISOString() };

    const cadena = calcularCadenaLideresHaciaArriba(persona.id, NIVELES_ALERTA_INACTIVIDAD_UPLINE);
    notificarCadenaLideresAlertaInactividad(persona, cadena, 'sin_actividad', semanas, monto);

    return true;

  }

  if (cumpleMinimo && persona.alertaInactividad) {

    const cadena = calcularCadenaLideresHaciaArriba(persona.id, NIVELES_ALERTA_INACTIVIDAD_UPLINE);
    delete persona.alertaInactividad;

    notificarCadenaLideresAlertaInactividad(persona, cadena, 'recuperada');

    return true;

  }

  return false;

}

function notificarCadenaLideresAlertaInactividad(persona, cadenaLideres, tipo, semanas, monto) {

  if (typeof agregarNotificacion !== 'function' || !cadenaLideres.length) return;

  const clave = tipo === 'sin_actividad' ? 'emprendedora_sin_actividad_detectada' : 'emprendedora_actividad_recuperada';
  if (typeof estaEventoNotifActivo === 'function' && !estaEventoNotifActivo(clave)) return;

  const texto = tipo === 'sin_actividad'
    ? `${nombreCompletoPersona(persona)} lleva ${semanas} semanas sin llegar a la compra mínima ($${monto} MXN) — contáctala para ver cómo está.`
    : `${nombreCompletoPersona(persona)} volvió a tener actividad — ya no necesita seguimiento por inactividad.`;

  cadenaLideres.forEach(lider => {
    agregarNotificacion({
      texto,
      link: 'equipo',
      paraId: lider.id,
      rolDestino: 'emprendedora_lider',
      origen: 'emprendedora_lider'
    });
  });

}

// Recorre TODAS las Emprendedoras y aplica evaluarAlertaInactividadPersona
// — pensada para llamarse junto con los demás verificar...()/procesar...()
// de Plan MW, tanto desde la campana de Admin (admin-comun.js) como desde
// el portal de Líder (Mi equipo), que no comparte el mismo "tick".
function procesarAlertasInactividadTodas() {

  if (typeof obtenerPersonas !== 'function') return false;

  const personas = obtenerPersonas();
  let huboCambios = false;

  personas.forEach(persona => {
    if (evaluarAlertaInactividadPersona(persona)) huboCambios = true;
  });

  if (huboCambios) guardarPersonas(personas);

  return huboCambios;

}
