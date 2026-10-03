// MW JOYERÍA — Mi cuenta (Líder)
// BUG reportado tras lanzar a producción: Progreso de rango y Ticket de
// comisiones seguían leyendo LIDER_EJEMPLO/EQUIPO_ARBOL_EJEMPLO en vez
// del equipo y las compras reales — cualquier cuenta real, aunque no
// tuviera equipo todavía, veía producción/comisiones de ejemplo. Ahora
// ambos usan el mismo motor real que ya usa Administración:
// calcularStatsRangoLider (compras-modelo.js) para las estadísticas de
// rango y calcularComisionesLider (comisiones-modelo.js) para el
// ticket — así esta página, Inicio y Mi equipo nunca pueden mostrar
// datos distintos para la misma líder. Depende de: RANGOS_MW
// (lider-ejemplo.js), COMISIONES_PCT (lider-cuenta-ejemplo.js, solo
// como referencia visual del %, el cálculo real ya no lo usa).

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof apartadosRepoListo !== 'undefined') await apartadosRepoListo;
  if (typeof personasRepoListo !== 'undefined') await personasRepoListo;
  if (typeof rifaMensualRepoListo !== 'undefined') await rifaMensualRepoListo;

  renderPerfilLider();
  renderRifaLider();
  renderConstanciaLider();
  renderRifaMesLider();
  renderProgresoRangoCuenta();
  renderTicketComisiones();
  renderProximoPago();

  document.getElementById('editarDatosBancariosBtn')?.addEventListener('click', abrirModalDatosBancarios);

  document.getElementById('perfilFotoInput')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    if (!archivo.type.startsWith('image/')) {
      e.target.value = '';
      mostrarToast('Selecciona un archivo de imagen válido.');
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      e.target.value = '';
      mostrarToast('La imagen no puede superar 2 MB.');
      return;
    }

    const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
    if (!idActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }

    const lector = new FileReader();
    lector.onload = () => {
      actualizarFotoPersona(idActual, lector.result);
      mostrarToast('Foto de perfil actualizada.');
      renderPerfilLider();
    };
    lector.readAsDataURL(archivo);
  });
});

function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString('es-MX')}`;
}
// Producción grupal (requisito de rango) se mide en "puntos", no en
// pesos (Plan MW, Sección 1) — aunque hoy 1 punto = 1 peso de compra,
// nunca se le pone signo de $.
function fmtPuntos(n) {
  return `${Math.round(n).toLocaleString('es-MX')} puntos`;
}
// Misma regla que js/plan-mw-admin.js → cumpleCompraPersonalRango: Plata
// y Oro exigen $1,500 en AMBOS periodos; Diamante y Corona, $3,000 pero
// solo en el periodo de consolidación (el mayor de los dos). Copiada
// aquí (no importada) porque esta página todavía usa datos de ejemplo
// desconectados del motor real de Plan MW — ver nota de arquitectura.
function cumpleCompraPersonalRangoCuenta(rangoKey, p1, p2, montoRequerido) {
  const soloUnPeriodo = rangoKey === 'diamante' || rangoKey === 'corona';
  const valorComparado = soloUnPeriodo ? Math.max(p1, p2) : Math.min(p1, p2);
  return { cumple: valorComparado >= montoRequerido, soloUnPeriodo };
}
function idxRango(key) {
  return RANGOS_MW.findIndex(r => r.key === key);
}
// Admin → Configuración → Comisiones es dueño de este valor (fórmula:
// comisión = (compra ÷ divisor) × %). Antes este archivo repetía el
// 1.16 aparte del de comisiones-modelo.js — ahora ambos leen del mismo
// lugar cuando está disponible, para que nunca queden desincronizados.
function obtenerIvaDivisorLider() {
  return (typeof obtenerValorVigente === 'function' && obtenerValorVigente('formula', 'iva_divisor')) || 1.16;
}

// ---------- Perfil ----------
// BUG reportado tras lanzar a producción: ya traía el registro real de
// la persona (abajo, `persona`) para su foto, pero nombre/rango/
// teléfono/correo seguían usando PERFIL_LIDER_EJEMPLO/LIDER_EJEMPLO —
// cualquier cuenta real veía el nombre y rango de la cuenta de ejemplo.
function renderPerfilLider() {
  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const persona = idActual && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(idActual) : null;
  const nombre = persona ? nombreCompletoPersona(persona) : PERFIL_LIDER_EJEMPLO.nombre;

  const iniciales = typeof obtenerInicialesPerfil === 'function' ? obtenerInicialesPerfil(nombre) : 'L';

  const fotoBox = document.getElementById('perfilIniciales');
  if (fotoBox) {
    fotoBox.innerHTML = persona?.fotoUrl
      ? `<img src="${persona.fotoUrl}" alt="Foto de ${escapeHTML(nombre)}" style="width:100%;height:100%;object-fit:cover;">`
      : iniciales;
  }

  setText('perfilNombre', nombre);
  setText('perfilLider', `Líder ${RANGOS_MW[idxRango(persona?.rangoActualKey || 'sin_rango')].label}`);
  setText('perfilTelefono', persona?.telefono || PERFIL_LIDER_EJEMPLO.telefono);
  setText('perfilCorreo', persona?.correo || PERFIL_LIDER_EJEMPLO.correo);

  const datosBancarios = persona?.datosBancarios;
  setText('perfilDatosBancarios', (datosBancarios && (datosBancarios.titular || datosBancarios.banco || datosBancarios.clabe))
    ? `${datosBancarios.titular || '(sin titular)'}\n${datosBancarios.banco || '(sin banco)'} · CLABE ${datosBancarios.clabe || '(sin CLABE)'}`
    : 'Todavía no los registras');
}

// ---------- Datos bancarios (para el pago de comisiones) ----------
let caratulaClabeArchivoTemporal = null;

async function abrirModalDatosBancarios() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  const persona = idActual && typeof obtenerPersonaPorId === 'function' ? obtenerPersonaPorId(idActual) : null;
  const actuales = persona?.datosBancarios || {};
  caratulaClabeArchivoTemporal = null;

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Datos bancarios</h3>
    <p class="modal-sub">Administración usa estos datos para depositarte tus comisiones.</p>
    <label for="inputBancoTitular">Nombre del titular</label>
    <input type="text" id="inputBancoTitular" value="${(actuales.titular || '').replace(/"/g, '&quot;')}">
    <label for="inputBancoNombre" style="margin-top:10px;">Banco</label>
    <input type="text" id="inputBancoNombre" value="${(actuales.banco || '').replace(/"/g, '&quot;')}">
    <label for="inputBancoClabe" style="margin-top:10px;">CLABE interbancaria</label>
    <input type="text" id="inputBancoClabe" inputmode="numeric" maxlength="18" value="${(actuales.clabe || '').replace(/"/g, '&quot;')}">
    <label for="inputCaratulaClabe" style="margin-top:10px;">Carátula de la CLABE (foto o PDF)</label>
    <input type="file" id="inputCaratulaClabe" accept="image/*,application/pdf">
    <small class="field-help" id="caratulaClabeActual">${actuales.caratulaClabeUrl ? 'Ya tienes una carátula guardada — sube otra solo si quieres reemplazarla.' : 'Todavía no subes tu carátula.'}</small>
    <div id="datosBancariosError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="guardarDatosBancariosBtn">Guardar</button>
  `;
  overlay.classList.add('open');

  document.getElementById('inputCaratulaClabe')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) { caratulaClabeArchivoTemporal = null; return; }
    const validacion = validarArchivoDocumento(archivo, { permitirPdf: true });
    if (!validacion.ok) {
      const error = document.getElementById('datosBancariosError');
      if (error) { error.textContent = validacion.error; error.style.display = 'block'; }
      e.target.value = '';
      caratulaClabeArchivoTemporal = null;
      return;
    }
    caratulaClabeArchivoTemporal = archivo;
  });

  document.getElementById('guardarDatosBancariosBtn')?.addEventListener('click', async () => {
    if (!idActual) { mostrarToast('No se pudo identificar tu cuenta — vuelve a iniciar sesión.'); return; }
    const titular = document.getElementById('inputBancoTitular').value.trim();
    const banco = document.getElementById('inputBancoNombre').value.trim();
    const clabe = document.getElementById('inputBancoClabe').value.trim();
    if (clabe && !/^\d{18}$/.test(clabe)) { mostrarToast('La CLABE interbancaria debe tener 18 dígitos.'); return; }

    let caratulaClabeUrl;
    if (caratulaClabeArchivoTemporal) {
      caratulaClabeUrl = `datos-bancarios/${idActual}-caratula-${Date.now()}`;
      await guardarBlobDocumento(caratulaClabeUrl, caratulaClabeArchivoTemporal);
    }

    actualizarDatosBancariosPersona(idActual, { titular, banco, clabe, caratulaClabeUrl });
    overlay.classList.remove('open');
    mostrarToast('Datos bancarios actualizados.');
    renderPerfilLider();
  });
}

// Persona real con sesión abierta, con su Plan MW (Rifa/Constancia) al
// día — misma función de cierre idempotente que usa Admin en cada
// carga (js/plan-mw-admin.js), así nunca se desincroniza de lo que ve
// Administración de esta misma persona.
function obtenerPersonaConPlanMWAlDia() {
  const idActual = typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null;
  if (!idActual || typeof obtenerPersonas !== 'function') return null;
  const personas = obtenerPersonas();
  const persona = personas.find(p => p.id === idActual);
  if (!persona) return null;
  if (typeof procesarCierresMensualesPlanMW === 'function' && procesarCierresMensualesPlanMW(persona)) {
    guardarPersonas(personas);
  }
  return persona;
}

// ---------- Rifa mensual ----------
function renderRifaLider() {
  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  const montoAcumuladoMes = (persona.rifa && persona.rifa.montoAcumuladoMes) || 0;
  // Admin → Configuración → Plan MW es dueña de estas dos reglas; si no
  // está cargada aquí, se usan los mismos valores fijos de siempre.
  const meta = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'meta_mensual')) || (persona.rifa && persona.rifa.meta) || 3000;
  const montoPorBoletoExtra = (typeof obtenerValorVigente === 'function' && obtenerValorVigente('rifa', 'monto_por_boleto_extra')) || 1000;

  const pctBase = Math.min(100, (montoAcumuladoMes / meta) * 100);
  document.getElementById('rifaFill').style.width = `${pctBase}%`;
  setText('rifaMontoActual', fmtMoney(montoAcumuladoMes));
  setText('rifaMontoMeta', fmtMoney(meta));

  const msg = document.getElementById('rifaMensaje');
  if (montoAcumuladoMes < meta) {
    msg.textContent = `Te faltan ${fmtMoney(meta - montoAcumuladoMes)} en compras este mes para ganar tu boleto de la rifa.`;
  } else {
    const extra = montoAcumuladoMes - meta;
    const boletosExtra = Math.floor(extra / montoPorBoletoExtra);
    const totalBoletos = 1 + boletosExtra;
    const faltanteSiguiente = montoPorBoletoExtra - (extra % montoPorBoletoExtra);
    let texto = totalBoletos === 1 ? '¡Ya tienes tu boleto para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>' : `¡Llevas ${totalBoletos} boletos para la rifa de este mes! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v1a1.5 1.5 0 000 3v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a1.5 1.5 0 000-3V9z"/><path d="M9 7v10"/></svg></span>`;
    texto += ` Te faltan ${fmtMoney(faltanteSiguiente)} para tu siguiente boleto extra.`;
    msg.innerHTML = texto;
  }
}

// ---------- Reto de Constancia ----------
function renderConstanciaLider() {
  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  // Admin → Configuración → Plan MW puede tener premios propios por
  // hito; si no, se usan los mismos hitos reales de siempre.
  const hitos = typeof obtenerHitosConstanciaConfigurados === 'function' ? obtenerHitosConstanciaConfigurados() : HITOS_CONSTANCIA_PERSONA;
  const comprasCumplidas = (persona.constancia && persona.constancia.mesesCumplidos) || 0;
  const montoMesActual = (persona.constancia && persona.constancia.montoMesActual) || 0;
  const metaMes = (persona.constancia && persona.constancia.metaMes) || 8000;

  const puntosLinea = [0, ...hitos.map(h => h.meses)];
  let segmentoActual = puntosLinea.length - 2;
  for (let i = 0; i < puntosLinea.length - 1; i++) {
    if (comprasCumplidas <= puntosLinea[i + 1]) { segmentoActual = i; break; }
  }
  const inicioSeg = puntosLinea[segmentoActual];
  const finSeg = puntosLinea[segmentoActual + 1];
  const fracSeg = finSeg > inicioSeg ? (comprasCumplidas - inicioSeg) / (finSeg - inicioSeg) : 1;
  const pctGeneral = Math.min(100, ((segmentoActual + fracSeg) / (puntosLinea.length - 1)) * 100);
  document.getElementById('constanciaFill').style.width = `${pctGeneral}%`;

  document.getElementById('constanciaNodes').innerHTML = hitos.map(h => {
    const alcanzado = comprasCumplidas >= h.meses;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.meses}</span>`}
        </div>
        <span class="node-label">${h.meses}° compra<br>${h.premio}</span>
      </div>
    `;
  }).join('');

  setText('constanciaResumen', `Llevas ${comprasCumplidas} compras cumplidas.`);
  const siguienteHito = hitos.find(h => h.meses > comprasCumplidas);
  const nota = document.getElementById('constanciaNota');
  nota.textContent = siguienteHito
    ? `Te falta${siguienteHito.meses - comprasCumplidas === 1 ? '' : 'n'} ${siguienteHito.meses - comprasCumplidas} compra${siguienteHito.meses - comprasCumplidas === 1 ? '' : 's'} para tu siguiente recompensa: ${siguienteHito.premio}.`
    : '¡Has alcanzado todas las recompensas! Pronto habrá una nueva categoría.';

  const pctMes = Math.min(100, (montoMesActual / metaMes) * 100);
  document.getElementById('mesFill').style.width = `${pctMes}%`;
  setText('mesMontoActual', fmtMoney(montoMesActual));
  setText('mesMontoMeta', fmtMoney(metaMes));

  const fechaLogroEl = document.getElementById('mesFechaLogro');
  if (fechaLogroEl) {
    const fechaLogro = typeof obtenerFechaLogroMesActual === 'function' ? obtenerFechaLogroMesActual(persona) : null;
    if (fechaLogro) {
      const texto = new Date(fechaLogro).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
      fechaLogroEl.textContent = `Llegaste a tus $8,000 de este mes el ${texto}.`;
      fechaLogroEl.style.display = '';
    } else {
      fechaLogroEl.style.display = 'none';
    }
  }
}

// ---------- Progreso de rango (detalle completo) ----------
function renderProgresoRangoCuenta() {
  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  const idxActual = idxRango(persona.rangoActualKey || 'sin_rango');
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];

  const mesKey = typeof mesKeyActualComprasModelo === 'function' ? mesKeyActualComprasModelo() : new Date().toISOString().slice(0, 7);
  const subPeriodo = typeof subPeriodoActualComprasModelo === 'function' ? subPeriodoActualComprasModelo() : (new Date().getDate() <= 15 ? 'p1' : 'p2');
  const stats = typeof calcularStatsRangoLider === 'function'
    ? calcularStatsRangoLider(persona, mesKey, subPeriodo)
    : { personasActivas: 0, produccionGrupalMes: 0, personasCalificadas: 0, compraPersonalPeriodo1: 0, compraPersonalPeriodo2: 0 };
  const { personasActivas, produccionGrupalMes, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = stats;

  setText('cuentaRangoActual', RANGOS_MW[idxActual].label.toUpperCase());

  document.getElementById('cuentaRankNodes').innerHTML = RANGOS_MW.map(r => {
    const alcanzado = produccionGrupalMes >= r.produccion;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>'}
        </div>
        <span class="node-label">${r.label}<br>${fmtPuntos(r.produccion)}</span>
      </div>
    `;
  }).join('');

  const maxProduccion = RANGOS_MW[RANGOS_MW.length - 1].produccion;
  document.getElementById('cuentaRankFill').style.width = `${Math.min(100, (produccionGrupalMes / maxProduccion) * 100)}%`;

  const titulo = document.getElementById('cuentaProgresoTitulo');
  const sub = document.getElementById('cuentaProgresoSub');
  if (siguiente) {
    titulo.textContent = `Progreso hacia ${siguiente.label.toUpperCase()}`;
    const faltante = Math.max(0, siguiente.produccion - produccionGrupalMes);
    sub.textContent = faltante > 0
      ? `Te faltan ${fmtPuntos(faltante)} de producción grupal para alcanzar ${siguiente.label}.`
      : `¡Ya cumples la producción grupal para ${siguiente.label}!`;

    const compra = cumpleCompraPersonalRangoCuenta(siguiente.key, compraPersonalPeriodo1, compraPersonalPeriodo2, siguiente.compra);
    const items = [
      { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}` },
      { label: compra.soloUnPeriodo ? 'Compra personal (periodo de consolidación)' : 'Compra personal (ambos periodos)', cumple: compra.cumple, valores: `${fmtMoney(compraPersonalPeriodo1)} y ${fmtMoney(compraPersonalPeriodo2)} / ${fmtMoney(siguiente.compra)}` },
      { label: 'Equipo calificado', cumple: personasCalificadas >= siguiente.calificado, valores: `${personasCalificadas} / ${siguiente.calificado} personas` },
    ];
    document.getElementById('cuentaChecklist').innerHTML = items.map(it => `
      <div class="check-item light ${it.cumple ? 'met' : 'unmet'}">
        <span class="check-icon">${it.cumple ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}</span>
        <span class="check-label">${it.label}</span>
        <span class="check-values">${it.valores}</span>
      </div>
    `).join('');
  } else {
    titulo.textContent = '¡Estás en el rango más alto!';
    sub.textContent = 'Sigue así para mantenerte en Corona el próximo mes.';
    document.getElementById('cuentaChecklist').innerHTML = '';
  }
}

// ---------- Ticket de comisiones ----------
// Comisiones "a la fecha" del mes en curso = quincena 1 + quincena 2,
// exactamente como las combina Admin → Comisiones (construirCardLider)
// — así la Líder nunca ve un total distinto del que calcula Admin para
// ella. calcularComisionesLider ya aplica el rango CONGELADO del cierre
// del mes anterior (nunca el rango en vivo) y ya filtra por equipo REAL
// (calcularDescendenciaPersona) — un equipo vacío da niveles vacíos y
// comisión $0, no el ticket de ejemplo.
function renderTicketComisiones() {
  if (typeof calcularComisionesLider !== 'function') return;

  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  const periodoKey = typeof obtenerPeriodoActualKey === 'function' ? obtenerPeriodoActualKey() : new Date().toISOString().slice(0, 7);
  const rP1 = calcularComisionesLider(persona, periodoKey, 'p1');
  const rP2 = calcularComisionesLider(persona, periodoKey, 'p2');

  const wrap = document.getElementById('ticketNiveles');
  let total = 0;

  wrap.innerHTML = rP1.niveles.map((nivelP1, i) => {

    const nivelP2 = rP2.niveles[i];
    const pct = nivelP1.pct;
    const produccion = nivelP1.filas.reduce((s, f) => s + f.compraNormal, 0) + nivelP2.filas.reduce((s, f) => s + f.compraNormal, 0);
    const comisionNivel = nivelP1.totalNivel + nivelP2.totalNivel;
    total += comisionNivel;

    return `
      <div class="ct-row-wrap">
        <button type="button" class="ct-row" data-toggle-nivel="${i}" aria-expanded="false">
          <div>
            <span class="ct-level">Nivel ${i + 1}</span>
            <span class="ct-detail">${fmtMoney(produccion)} en compras × ${pct}%</span>
          </div>
          <span class="ct-amount">${fmtMoney(comisionNivel)} <span class="ct-chevron">▾</span></span>
        </button>
        <div class="ct-detail-list" id="ctDetalle${i}" hidden>
          ${construirDetalleNivelComisiones(nivelP1.filas, nivelP2.filas)}
        </div>
      </div>
    `;

  }).join('');

  setText('ticketTotal', fmtMoney(total));
  setText('ticketRango', RANGOS_MW[idxRango(rP1.rangoKey)].label);

  wrap.querySelectorAll('[data-toggle-nivel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const detalle = document.getElementById(`ctDetalle${btn.getAttribute('data-toggle-nivel')}`);
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
      btn.classList.toggle('open', !detalle.hidden);
      btn.setAttribute('aria-expanded', String(!detalle.hidden));
    });
  });

}

// Desglose por emprendedora de un nivel: compra y comisión real de
// quincena 1 + quincena 2, emparejadas por persona (mismo criterio que
// construirBloqueNivel en admin-comisiones.js).
function construirDetalleNivelComisiones(filasP1, filasP2) {

  if (!filasP1.length) {
    return `<div class="ct-detail-empty">Todavía no hay integrantes en este nivel.</div>`;
  }

  return filasP1.map((f1) => {
    const f2 = filasP2.find(f => f.persona.id === f1.persona.id) || null;
    const compraTotal = f1.compraNormal + (f2 ? f2.compraNormal : 0);
    const comisionTotal = f1.comisionFinal + (f2 ? f2.comisionFinal : 0);
    const base = compraTotal / obtenerIvaDivisorLider();
    const iva = compraTotal - base;
    return `
      <div class="ct-detail-row">
        <div>
          <strong>${nombreCompletoPersona(f1.persona)}</strong>
          <span class="ct-detail-sub">${fmtMoney(compraTotal)} en compra este mes</span>
        </div>
        <div class="ct-detail-nums">
          <span>IVA ${fmtMoney(iva)}</span>
          <strong>${fmtMoney(comisionTotal)}</strong>
        </div>
      </div>
    `;
  }).join('');

}
// ---------- Próxima fecha de pago ----------
// El calendario real es día 5 y día 20 de cada mes, alternados (5, 20,
// 5, 20...) — los mismos dos días que ya usa obtenerInfoSubPeriodo()
// en comisiones-modelo.js para la fecha de pago de cada sub-periodo.
// Se busca la fecha más próxima de esa lista que todavía no llega.
function calcularProximoPagoLider(ahora = new Date()) {
  const candidatos = [];
  for (let offsetMes = 0; offsetMes <= 1; offsetMes++) {
    const base = new Date(ahora.getFullYear(), ahora.getMonth() + offsetMes, 1);
    candidatos.push(new Date(base.getFullYear(), base.getMonth(), 5));
    candidatos.push(new Date(base.getFullYear(), base.getMonth(), 20));
  }
  const hoyMedianoche = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  return candidatos.filter(d => d > hoyMedianoche).sort((a, b) => a - b)[0];
}

function renderProximoPago() {
  const fechaPago = calcularProximoPagoLider();
  const diaSemana = fechaPago.toLocaleDateString('es-MX', { weekday: 'long' });
  const mes = fechaPago.toLocaleDateString('es-MX', { month: 'long' });
  const texto = `${diaSemana} ${fechaPago.getDate()} de ${mes}`;
  setText('proximoPago', texto.charAt(0).toUpperCase() + texto.slice(1));
}

// ---------- Rifa del mes (solicitud o votación, según decida Admin) ----------
function formatearMesLabelRifaCuenta(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[mes - 1].charAt(0).toUpperCase()}${nombres[mes - 1].slice(1)} ${anio}`;
}

function renderRifaMesLider() {
  if (typeof obtenerConfigRifaMes !== 'function') return;

  const persona = obtenerPersonaConPlanMWAlDia();
  if (!persona) return;

  const mesKey = obtenerMesKeyActualRifaMensual();
  const config = obtenerConfigRifaMes(mesKey);
  setText('rifaMesLabelCuenta', formatearMesLabelRifaCuenta(mesKey));

  const contenido = document.getElementById('rifaMesContenido');
  const sub = document.getElementById('rifaMesSub');
  if (!contenido || !sub) return;

  if (!config.modo) {
    sub.textContent = 'Administración todavía no elige cómo va a funcionar la rifa de este mes.';
    contenido.innerHTML = '';
    return;
  }

  if (config.modo === 'solicitud') {
    sub.textContent = 'Escribe y sube una foto de algo que te gustaría que se rifara este mes.';
    const solicitud = obtenerSolicitudRifaPersona(persona.id, mesKey);

    contenido.innerHTML = `
      <label for="rifaMesTexto">¿Qué te gustaría que se rifara?</label>
      <textarea id="rifaMesTexto" rows="3">${solicitud ? solicitud.texto.replace(/</g, '&lt;') : ''}</textarea>
      <label for="rifaMesFoto" style="margin-top:10px;">Foto (opcional)</label>
      <input type="file" id="rifaMesFoto" accept="image/*">
      ${solicitud && solicitud.fotoUrl ? `<img src="${solicitud.fotoUrl}" alt="Tu foto" class="rifa-solicitud-foto-propia">` : ''}
      <button class="btn btn-primary" type="button" id="rifaMesGuardarBtn" style="margin-top:12px;">${solicitud ? 'Actualizar mi solicitud' : 'Enviar mi solicitud'}</button>
      ${solicitud ? `<p class="bp-sub" style="margin-top:8px;margin-bottom:0;">Enviada el ${new Date(solicitud.actualizadoEn || solicitud.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}.</p>` : ''}
    `;

    let fotoTemporal = solicitud ? solicitud.fotoUrl : '';
    document.getElementById('rifaMesFoto')?.addEventListener('change', (e) => {
      const archivo = e.target.files?.[0];
      if (!archivo) return;
      if (!archivo.type.startsWith('image/')) { e.target.value = ''; mostrarToast('Selecciona un archivo de imagen válido.'); return; }
      if (archivo.size > 2 * 1024 * 1024) { e.target.value = ''; mostrarToast('La imagen no puede superar 2 MB.'); return; }
      const lector = new FileReader();
      lector.onload = () => { fotoTemporal = lector.result; };
      lector.readAsDataURL(archivo);
    });

    document.getElementById('rifaMesGuardarBtn')?.addEventListener('click', () => {
      const texto = document.getElementById('rifaMesTexto').value.trim();
      const resultado = guardarSolicitudRifaPersona({ personaId: persona.id, personaNombre: nombreCompletoPersona(persona), mesKey, texto, fotoUrl: fotoTemporal });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      mostrarToast('¡Gracias! Tu solicitud para la rifa de este mes quedó guardada.');
      renderRifaMesLider();
    });

    return;
  }

  // modo votación
  sub.textContent = 'Vota por el regalo que te gustaría que se rifara este mes — puedes cambiar tu voto mientras siga abierta.';
  const voto = obtenerVotoRifaPersona(persona.id, mesKey);

  if (!config.opciones || !config.opciones.length) {
    contenido.innerHTML = '<p class="bp-sub" style="margin:0;">Todavía no hay opciones para votar este mes.</p>';
    return;
  }

  contenido.innerHTML = `<div class="rifa-opciones-grid">${config.opciones.map(op => {
    const esMiVoto = voto && voto.opcionId === op.id;
    return `
      <div class="rifa-opcion-card${esMiVoto ? ' votada' : ''}">
        ${op.fotoUrl ? `<img src="${op.fotoUrl}" alt="${op.nombre.replace(/</g, '&lt;')}">` : '<div class="rifa-opcion-sinfoto">Sin foto</div>'}
        <div class="rifa-opcion-body">
          <strong>${op.nombre.replace(/</g, '&lt;')}</strong>
          ${op.descripcion ? `<p>${op.descripcion.replace(/</g, '&lt;')}</p>` : ''}
        </div>
        <button class="btn ${esMiVoto ? 'btn-outline' : 'btn-primary'}" type="button" data-votar-opcion="${op.id}">${esMiVoto ? 'Tu voto' : 'Votar'}</button>
      </div>
    `;
  }).join('')}</div>`;

  contenido.querySelectorAll('[data-votar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const opcionId = btn.getAttribute('data-votar-opcion');
      const votoActual = obtenerVotoRifaPersona(persona.id, mesKey);
      if (votoActual && votoActual.opcionId === opcionId) return;
      votarOpcionRifaMes({ personaId: persona.id, personaNombre: nombreCompletoPersona(persona), mesKey, opcionId });
      mostrarToast('¡Listo! Tu voto quedó registrado.');
      renderRifaMesLider();
    });
  });
}
