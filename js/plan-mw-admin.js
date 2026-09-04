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

// ============================================================
// RANGOS
// ============================================================

// Requisitos del SIGUIENTE rango comparados contra los datos actuales
// de la líder — misma comparación que ya usaba el checklist visual.
function calcularAscensoRango(persona) {

  const idxActual = RANGOS_MW.findIndex(r => r.key === persona.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];

  if (!siguiente) return { siguiente: null, items: [], elegible: false };

  const { personasActivas, produccionGrupalMes, equipoCalificadoPct, compraPersonalPeriodo1, compraPersonalPeriodo2 } = persona.stats;
  const compraMinima = Math.min(compraPersonalPeriodo1, compraPersonalPeriodo2);

  const items = [
    { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}`, ratio: siguiente.personas ? personasActivas / siguiente.personas : 1, faltante: Math.max(0, siguiente.personas - personasActivas), unidad: 'personas' },
    { label: 'Compra personal (ambos periodos)', cumple: compraMinima >= siguiente.compra, valores: `$${formatearDineroPersonas(compraPersonalPeriodo1)} y $${formatearDineroPersonas(compraPersonalPeriodo2)} / $${formatearDineroPersonas(siguiente.compra)}`, ratio: siguiente.compra ? compraMinima / siguiente.compra : 1, faltante: Math.max(0, siguiente.compra - compraMinima), unidad: 'dinero' },
    { label: 'Equipo calificado', cumple: equipoCalificadoPct >= siguiente.calificado, valores: `${equipoCalificadoPct}% / ${siguiente.calificado}%`, ratio: siguiente.calificado ? equipoCalificadoPct / siguiente.calificado : 1, faltante: Math.max(0, siguiente.calificado - equipoCalificadoPct), unidad: 'pct' },
    { label: 'Producción grupal', cumple: produccionGrupalMes >= siguiente.produccion, valores: `$${formatearDineroPersonas(produccionGrupalMes)} / $${formatearDineroPersonas(siguiente.produccion)}`, ratio: siguiente.produccion ? produccionGrupalMes / siguiente.produccion : 1, faltante: Math.max(0, siguiente.produccion - produccionGrupalMes), unidad: 'dinero' }
  ];

  return { siguiente, items, elegible: items.every(it => it.cumple) };

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

        if (typeof agregarNotificacion === 'function') {
          agregarNotificacion({
            texto: `${nombreCompletoPersona(persona)} cumple los requisitos para subir a ${siguiente.label}. Revisa y confirma su ascenso.`,
            link: 'admin-emprendedoras-lideres.html',
            paraId: 'admin01'
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

      if (typeof agregarNotificacion === 'function') {
        agregarNotificacion({
          texto: `¡Felicidades! Tu rango subió a ${siguienteLabel}. Sigue así ✦`,
          link: 'cuenta',
          paraId: actual.id
        });
      }

      if (typeof onExito === 'function') onExito(actual);

    }
  });

}

// ============================================================
// RETO DE CONSTANCIA
// ============================================================

// Primer hito que todavía no ha sido otorgado, y qué tan cerca está.
function calcularProximidadConstancia(persona) {

  const otorgados = persona.constancia.hitosOtorgados || [];
  const siguienteHito = HITOS_CONSTANCIA_PERSONA.find(h => !otorgados.some(o => o.meses === h.meses));

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

        if (typeof agregarNotificacion === 'function') {
          agregarNotificacion({
            texto: `${nombreCompletoPersona(persona)} cumplió ${proximidad.siguienteHito.meses} meses del Reto de Constancia. Confirma y prepara su premio: ${proximidad.siguienteHito.premio}.`,
            link: 'admin-emprendedoras-lideres.html',
            paraId: 'admin01'
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
    mensaje: `${escapeHTMLPersonas(nombreCompletoPersona(persona))} cumplió ${meses} meses del Reto de Constancia. ¿Confirmas la entrega de su premio: ${escapeHTMLPersonas(premio)}?`,
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
        descripcion: `${nombreCompletoPersona(actual)} recibió "${premio}" por ${meses} meses del Reto de Constancia`
      });

      if (typeof agregarNotificacion === 'function') {
        agregarNotificacion({
          texto: `¡Felicidades! Ganaste "${premio}" por cumplir ${meses} meses del Reto de Constancia 🎉`,
          link: 'cuenta',
          paraId: actual.id
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
