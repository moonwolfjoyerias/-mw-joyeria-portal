// MW JOYERÍA — Admin: Plan MW (centro de seguimiento y alertas)
//
// A diferencia de la página pública "Plan MW" (informativa), esta
// página es exclusiva de Administración: muestra automáticamente quién
// está por lograr algo importante y quién ya lo logró en el periodo
// seleccionado. No captura nada manualmente — todo se calcula con
// js/plan-mw-admin.js sobre el mismo registro de personas que usa
// Admin → Emprendedoras/Líderes.

let periodoActual = '';
let filtroPlanMW = 'todos';

document.addEventListener('DOMContentLoaded', () => {

  verificarAscensosPendientes();
  verificarRecompensasConstancia();

  renderSelectorPeriodo();
  renderPlanMW();

  document.getElementById('periodoSelect')?.addEventListener('change', (e) => {
    periodoActual = e.target.value;
    renderPlanMW();
  });

  document.querySelectorAll('#planmwFiltros [data-filtro]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtroPlanMW = btn.getAttribute('data-filtro');
      document.querySelectorAll('#planmwFiltros [data-filtro]').forEach(b => b.classList.toggle('active', b === btn));
      aplicarFiltroSeccionesPlanMW();
    });
  });

});

// ============================================================
// PERIODO
// ============================================================

function formatearPeriodoLabel(yyyyMM) {
  const [anio, mes] = yyyyMM.split('-').map(Number);
  const nombres = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${nombres[mes - 1].charAt(0).toUpperCase()}${nombres[mes - 1].slice(1)} ${anio}`;
}

function obtenerPeriodosDisponibles() {

  const periodos = new Set();
  const ahora = new Date();
  periodos.add(`${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`);

  obtenerLogrosPlanMW().forEach(({ logro }) => {
    periodos.add(logro.fecha.slice(0, 7));
  });

  return Array.from(periodos).sort((a, b) => b.localeCompare(a));

}

function renderSelectorPeriodo() {
  const select = document.getElementById('periodoSelect');
  if (!select) return;

  const periodos = obtenerPeriodosDisponibles();
  periodoActual = periodos[0];

  select.innerHTML = periodos.map(p => `<option value="${p}">${formatearPeriodoLabel(p)}</option>`).join('');
  select.value = periodoActual;
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderPlanMW() {

  const todasLasPersonas = obtenerPersonas();
  const proximos = calcularProximosALograr(todasLasPersonas);
  const logrosPeriodo = obtenerLogrosPlanMW().filter(({ logro }) => logro.fecha.slice(0, 7) === periodoActual);

  renderStatsPlanMW(proximos, logrosPeriodo);
  renderProximosPlanMW(proximos);
  renderLogrosPlanMW(logrosPeriodo);
  aplicarFiltroSeccionesPlanMW();

}

function aplicarFiltroSeccionesPlanMW() {
  const seccionProximos = document.getElementById('seccionProximos');
  const seccionLogros = document.getElementById('seccionLogros');
  if (seccionProximos) seccionProximos.hidden = filtroPlanMW === 'alcanzados';
  if (seccionLogros) seccionLogros.hidden = filtroPlanMW === 'proximos';
}

// ============================================================
// PRÓXIMOS A LOGRAR
// ============================================================

// No es una lista interminable: solo quienes ya están razonablemente
// cerca (o ya elegibles, esperando que Admin confirme), ordenadas de
// más cerca a menos cerca. Tope de tarjetas para mantenerla enfocada.
const TOPE_TARJETAS_PROXIMOS = 8;

function calcularProximosALograr(personas) {

  const resultado = [];

  personas.forEach(persona => {

    if (persona.tipo === 'lider') {
      const proximidad = calcularProximidadRango(persona);
      if (proximidad && (persona.ascensoPendiente || proximidad.progresoPct / 100 >= UMBRAL_PROXIMIDAD_RANGO)) {
        resultado.push({ persona, categoria: 'rango', ...proximidad, listo: !!persona.ascensoPendiente });
      }
    }

    const proximidadConstancia = calcularProximidadConstancia(persona);
    if (proximidadConstancia && (persona.recompensaPendiente || proximidadConstancia.mesesFaltantes <= UMBRAL_PROXIMIDAD_CONSTANCIA_MESES)) {
      resultado.push({ persona, categoria: 'constancia', ...proximidadConstancia, listo: !!persona.recompensaPendiente });
    }

  });

  resultado.sort((a, b) => {
    if (a.listo !== b.listo) return a.listo ? -1 : 1; // listas para confirmar primero
    return b.progresoPct - a.progresoPct;
  });

  return resultado;

}

function renderStatsPlanMW(proximosCompletos, logrosPeriodo) {
  setTextPlanMW('statLogros', logrosPeriodo.length);
  setTextPlanMW('statAscensos', logrosPeriodo.filter(r => r.logro.tipo === 'ascenso_rango').length);
  setTextPlanMW('statRecompensas', logrosPeriodo.filter(r => r.logro.tipo === 'recompensa_constancia').length);
  setTextPlanMW('statProximos', proximosCompletos.length);
}

function renderProximosPlanMW(lista) {

  const grid = document.getElementById('proximosGrid');
  if (!grid) return;

  if (!lista.length) {
    grid.innerHTML = `
      <div class="catalog-empty-cell" style="padding:2.5rem 1rem;grid-column:1/-1;">
        <strong>Nadie está próximo a lograr algo ahora mismo</strong>
        <span>Cuando alguien esté cerca de subir de rango o ganar una recompensa, aparecerá aquí.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = lista.slice(0, TOPE_TARJETAS_PROXIMOS).map(item => construirTarjetaProximo(item)).join('');

  grid.querySelectorAll('[data-ver-proximo]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-confirmar-ya]')) return;
      abrirDetallePlanMW(card.getAttribute('data-ver-proximo'));
    });
  });

  grid.querySelectorAll('[data-confirmar-ya]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const persona = obtenerPersonaPorId(btn.getAttribute('data-confirmar-ya'));
      if (!persona) return;
      if (persona.ascensoPendiente) {
        abrirConfirmarAscensoRango(persona, () => renderPlanMW());
      } else if (persona.recompensaPendiente) {
        abrirConfirmarRecompensaConstancia(persona, () => renderPlanMW());
      }
    });
  });

}

function construirTarjetaProximo(item) {

  const { persona, categoria, listo, progresoPct } = item;
  const tipoCuenta = persona.tipo === 'lider' ? 'Líder' : 'Emprendedora';

  let icono = '⚡';
  let tituloTipo = '';
  let sub = '';
  let textoFalta = '';

  if (categoria === 'rango') {
    icono = listo ? '⬆️' : '⚡';
    tituloTipo = listo ? 'Lista para subir de rango' : 'Próximo rango';
    sub = `${tipoCuenta} · Rango ${rangoLabel(persona.rangoActualKey)}`;
    textoFalta = listo
      ? `Ya cumple todos los requisitos para <strong>${item.siguiente.label}</strong>.`
      : construirTextoFaltante(item.limitante, item.siguiente.label);
  } else {
    icono = listo ? '🎁' : '⚡';
    tituloTipo = listo ? 'Lista para su recompensa' : 'Próxima recompensa';
    sub = `${tipoCuenta} · Reto de Constancia`;
    textoFalta = listo
      ? `Ya cumplió ${item.siguienteHito.meses} meses. Premio: <strong>${escapeHTMLPersonas(item.siguienteHito.premio)}</strong>.`
      : `${item.mesesCumplidos} meses acumulados. Le${item.mesesFaltantes === 1 ? ' falta' : 'n faltan'} ${item.mesesFaltantes} mes${item.mesesFaltantes === 1 ? '' : 'es'} para obtener: <strong>${escapeHTMLPersonas(item.siguienteHito.premio)}</strong>.`;
  }

  return `
    <div class="proximo-card ${listo ? 'listo' : ''}" data-ver-proximo="${persona.id}">
      <span class="proximo-tipo">${icono} ${tituloTipo}</span>
      <strong class="proximo-nombre">${escapeHTMLPersonas(nombreCompletoPersona(persona))}</strong>
      <span class="proximo-sub">${sub}</span>
      <div class="progress-track"><div class="progress-fill" style="width:${progresoPct}%"></div></div>
      <p class="proximo-falta">${textoFalta}</p>
      ${listo ? `<button class="btn btn-primary" style="width:100%;margin-top:10px;" data-confirmar-ya="${persona.id}" type="button">Confirmar ahora</button>` : ''}
    </div>
  `;

}

function construirTextoFaltante(limitante, siguienteLabel) {
  if (!limitante || limitante.faltante <= 0) return `Está muy cerca de alcanzar: <strong>${siguienteLabel}</strong>.`;
  let valor;
  if (limitante.unidad === 'dinero') valor = `$${formatearDineroPersonas(limitante.faltante)}`;
  else if (limitante.unidad === 'pct') valor = `${limitante.faltante}%`;
  else valor = `${Math.ceil(limitante.faltante)} persona${limitante.faltante === 1 ? '' : 's'} activas`;
  return `Le falta${limitante.unidad === 'personas' ? 'n' : ''} ${valor} para alcanzar: <strong>${siguienteLabel}</strong>.`;
}

// ============================================================
// LOGROS DEL PERIODO
// ============================================================

function renderLogrosPlanMW(lista) {

  const grid = document.getElementById('logrosGrid');
  if (!grid) return;

  if (!lista.length) {
    grid.innerHTML = `
      <div class="catalog-empty-cell" style="padding:2.5rem 1rem;grid-column:1/-1;">
        <strong>Todavía no hay logros en este periodo</strong>
        <span>Los ascensos de rango y recompensas confirmados aparecerán aquí automáticamente.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = lista.map(({ persona, logro }) => construirTarjetaLogro(persona, logro)).join('');

  grid.querySelectorAll('[data-ver-logro]').forEach(card => {
    card.addEventListener('click', () => abrirDetallePlanMW(card.getAttribute('data-ver-logro')));
  });

}

function construirTarjetaLogro(persona, logro) {

  const tipoCuenta = persona.tipo === 'lider' ? 'Líder' : 'Emprendedora';
  let icono = '🏆';
  let titulo = '';
  let sub = tipoCuenta;

  if (logro.tipo === 'ascenso_rango') {
    icono = logro.rangoNuevo === 'corona' ? '👑' : '🥇';
    titulo = `${nombreCompletoPersona(persona)} subió a ${rangoLabel(logro.rangoNuevo)}`;
    sub = `${tipoCuenta} · ${rangoLabel(logro.rangoAnterior)} → ${rangoLabel(logro.rangoNuevo)}`;
  } else if (logro.tipo === 'recompensa_constancia') {
    icono = '🎁';
    titulo = `${nombreCompletoPersona(persona)} ganó ${logro.premio}`;
    sub = `${tipoCuenta} · Reto de Constancia · ${logro.hito} meses`;
  }

  return `
    <div class="logro-card" data-ver-logro="${persona.id}">
      <span class="logro-icon">${icono}</span>
      <div>
        <strong>${escapeHTMLPersonas(titulo)}</strong>
        <span class="logro-sub">${escapeHTMLPersonas(sub)}</span>
        <span class="logro-fecha">${formatearFechaLogro(logro.fecha)}</span>
      </div>
    </div>
  `;

}

function formatearFechaLogro(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ============================================================
// DETALLE
// ============================================================

function abrirDetallePlanMW(personaId) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const tipoCuenta = persona.tipo === 'lider' ? 'Líder' : 'Emprendedora';
  const ascenso = persona.tipo === 'lider' ? calcularProximidadRango(persona) : null;
  const constancia = calcularProximidadConstancia(persona);

  const logrosPersona = (persona.historialLogros || []).slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
  const ultimoAscenso = logrosPersona.find(l => l.tipo === 'ascenso_rango');

  box.style.maxWidth = '520px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">✦</div>
    <h3>${escapeHTMLPersonas(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">${tipoCuenta}${persona.tipo === 'lider' ? ` · Rango ${rangoLabel(persona.rangoActualKey)}` : ''}</p>

    <div class="detail-grid">
      ${ultimoAscenso ? `<div><span>Rango anterior</span><strong>${rangoLabel(ultimoAscenso.rangoAnterior)}</strong></div>` : ''}
      ${persona.tipo === 'lider' && ascenso ? `
        <div><span>Progreso a ${ascenso.siguiente.label}</span><strong>${ascenso.progresoPct}%</strong></div>
        <div><span>Le falta</span><strong>${ascenso.elegible ? 'Ya cumple todo' : construirTextoFaltanteCorto(ascenso.limitante)}</strong></div>
      ` : ''}
      <div><span>Meses de Constancia</span><strong>${persona.constancia.mesesCumplidos}</strong></div>
      <div><span>Próxima recompensa</span><strong>${constancia ? `${escapeHTMLPersonas(constancia.siguienteHito.premio)} (${constancia.mesesFaltantes === 0 ? 'lista' : `faltan ${constancia.mesesFaltantes} mes${constancia.mesesFaltantes === 1 ? '' : 'es'}`})` : 'Todos los hitos otorgados'}</strong></div>
      <div><span>Compra del mes en curso</span><strong>$${formatearDineroPersonas(persona.constancia.montoMesActual)} MXN</strong></div>
    </div>

    <h4 class="profile-section-title" style="margin-top:16px;">Logros obtenidos</h4>
    ${logrosPersona.length ? `
      <div class="ct-detail-list" style="border-bottom:0;">
        ${logrosPersona.map(l => `
          <div class="ct-detail-row">
            <div>
              <strong>${l.tipo === 'ascenso_rango' ? `Subió a ${rangoLabel(l.rangoNuevo)}` : `Ganó ${escapeHTMLPersonas(l.premio)}`}</strong>
              <span class="ct-detail-sub">${formatearFechaLogro(l.fecha)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<p class="bp-sub" style="margin:0 0 12px;">Todavía no tiene logros confirmados.</p>`}

    <a class="btn btn-primary" style="width:100%;display:block;text-align:center;margin-top:10px;" href="admin-emprendedoras-lideres.html?persona=${encodeURIComponent(persona.id)}">Ver perfil completo</a>
  `;

  overlay.classList.add('open');

}

function construirTextoFaltanteCorto(limitante) {
  if (!limitante || limitante.faltante <= 0) return '—';
  if (limitante.unidad === 'dinero') return `$${formatearDineroPersonas(limitante.faltante)}`;
  if (limitante.unidad === 'pct') return `${limitante.faltante}%`;
  return `${Math.ceil(limitante.faltante)} personas activas`;
}

function setTextPlanMW(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
