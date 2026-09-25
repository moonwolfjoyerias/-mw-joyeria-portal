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
let planmwVista = 'seguimiento';

document.addEventListener('DOMContentLoaded', () => {

  if (typeof procesarCierresMensualesPlanMWTodas === 'function') procesarCierresMensualesPlanMWTodas();
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

  document.querySelectorAll('#planmwNavPrincipal [data-planmw-vista]').forEach(btn => {
    btn.addEventListener('click', () => {
      planmwVista = btn.getAttribute('data-planmw-vista');
      document.querySelectorAll('#planmwNavPrincipal [data-planmw-vista]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('planmwVistaSeguimiento').hidden = planmwVista !== 'seguimiento';
      document.getElementById('planmwVistaRifa').hidden = planmwVista !== 'rifa';
      document.getElementById('planmwVistaRangos').hidden = planmwVista !== 'rangos';
      if (planmwVista === 'rifa') renderRifaMes();
      if (planmwVista === 'rangos') renderHistorialRangos();
    });
  });

  document.getElementById('descargarTodosBoletosBtn')?.addEventListener('click', generarPDFBoletosRifa);

  document.getElementById('exportarHistorialRangosBtn')?.addEventListener('click', () => {
    const { periodos, filas } = calcularHistorialRangosTodas(6);
    const encabezado = ['Líder', ...periodos.map(p => formatearPeriodoLabelComisiones(p))];
    const cuerpo = filas.map(f => [nombreCompletoPersona(f.lider), ...f.porMes.map(k => rangoLabel(k))]);
    descargarCSVArbol(generarCSVArbol(encabezado, cuerpo), `historial-rangos-mw-${new Date().toISOString().slice(0, 10)}.csv`);
    mostrarToast('Historial exportado.');
  });

  document.querySelectorAll('#rifaModoChips [data-rifa-modo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modo = btn.getAttribute('data-rifa-modo');
      const mesKey = obtenerMesKeyActualRifaMensual();
      establecerModoRifaMes(mesKey, modo, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre });
      mostrarToast(`Modo de la Rifa del mes: ${MODOS_RIFA_MENSUAL[modo]}.`);
      renderRifaMes();
    });
  });

  document.getElementById('rifaAgregarOpcionBtn')?.addEventListener('click', () => {
    abrirModalOpcionRifa(obtenerMesKeyActualRifaMensual(), null);
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

  let icono = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>';
  let tituloTipo = '';
  let sub = '';
  let textoFalta = '';

  if (categoria === 'rango') {
    icono = listo ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>';
    tituloTipo = listo ? 'Lista para subir de rango' : 'Próximo rango';
    sub = `${tipoCuenta} · Rango ${rangoLabel(persona.rangoActualKey)}`;
    textoFalta = listo
      ? `Ya cumple todos los requisitos para <strong>${item.siguiente.label}</strong>.`
      : construirTextoFaltante(item.limitante, item.siguiente.label);
  } else {
    icono = listo ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 9h16M12 9v11"/><path d="M8 9c0-2 1-4 4-4s4 2 4 4"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"/></svg>';
    tituloTipo = listo ? 'Lista para su recompensa' : 'Próxima recompensa';
    sub = `${tipoCuenta} · Reto de Constancia`;
    textoFalta = listo
      ? `Ya cumplió ${item.siguienteHito.meses} compras. Premio: <strong>${escapeHTMLPersonas(item.siguienteHito.premio)}</strong>.`
      : `${item.mesesCumplidos} compras acumuladas. Le${item.mesesFaltantes === 1 ? ' falta' : 'n faltan'} ${item.mesesFaltantes} compra${item.mesesFaltantes === 1 ? '' : 's'} para obtener: <strong>${escapeHTMLPersonas(item.siguienteHito.premio)}</strong>.`;
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
  else if (limitante.unidad === 'puntos') valor = `${formatearDineroPersonas(limitante.faltante)} puntos`;
  else if (limitante.unidad === 'personas_calificadas') valor = `${Math.ceil(limitante.faltante)} persona${limitante.faltante === 1 ? '' : 's'} calificada${limitante.faltante === 1 ? '' : 's'}`;
  else valor = `${Math.ceil(limitante.faltante)} persona${limitante.faltante === 1 ? '' : 's'} activas`;
  const esPersonas = limitante.unidad === 'personas' || limitante.unidad === 'personas_calificadas';
  return `Le falta${esPersonas ? 'n' : ''} ${valor} para alcanzar: <strong>${siguienteLabel}</strong>.`;
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
  let icono = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M7 5H4a3 3 0 003 4M17 5h3a3 3 0 01-3 4"/><path d="M12 13v4"/><path d="M9 20h6"/><path d="M9.5 17h5l.5 3h-6l.5-3z"/></svg>';
  let titulo = '';
  let sub = tipoCuenta;

  if (logro.tipo === 'ascenso_rango') {
    icono = logro.rangoNuevo === 'corona' ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 18h16l-1.5-8-4 3-2.5-5-2.5 5-4-3L4 18z"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="15" r="5"/><path d="M9 10.5L7 3h3l2 6"/><path d="M15 10.5L17 3h-3l-2 6"/></svg>';
    titulo = `${nombreCompletoPersona(persona)} subió a ${rangoLabel(logro.rangoNuevo)}`;
    sub = `${tipoCuenta} · ${rangoLabel(logro.rangoAnterior)} → ${rangoLabel(logro.rangoNuevo)}`;
  } else if (logro.tipo === 'recompensa_constancia') {
    icono = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="4" y="9" width="16" height="11" rx="1"/><path d="M4 9h16M12 9v11"/><path d="M8 9c0-2 1-4 4-4s4 2 4 4"/></svg>';
    titulo = `${nombreCompletoPersona(persona)} ganó ${logro.premio}`;
    sub = `${tipoCuenta} · Reto de Constancia · ${logro.hito} compras`;
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
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg></div>
    <h3>${escapeHTMLPersonas(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">${tipoCuenta}${persona.tipo === 'lider' ? ` · Rango ${rangoLabel(persona.rangoActualKey)}` : ''}</p>

    <div class="detail-grid">
      ${ultimoAscenso ? `<div><span>Rango anterior</span><strong>${rangoLabel(ultimoAscenso.rangoAnterior)}</strong></div>` : ''}
      ${persona.tipo === 'lider' && ascenso ? `
        <div><span>Progreso a ${ascenso.siguiente.label}</span><strong>${ascenso.progresoPct}%</strong></div>
        <div><span>Le falta</span><strong>${ascenso.elegible ? 'Ya cumple todo' : construirTextoFaltanteCorto(ascenso.limitante)}</strong></div>
      ` : ''}
      <div><span>Compras de Constancia</span><strong>${persona.constancia.mesesCumplidos}</strong></div>
      <div><span>Próxima recompensa</span><strong>${constancia ? `${escapeHTMLPersonas(constancia.siguienteHito.premio)} (${constancia.mesesFaltantes === 0 ? 'lista' : `faltan ${constancia.mesesFaltantes} compra${constancia.mesesFaltantes === 1 ? '' : 's'}`})` : 'Todos los hitos otorgados'}</strong></div>
      <div><span>Compra del mes en curso</span><strong>$${formatearDineroPersonas(persona.constancia.montoMesActual)} MXN</strong></div>
      ${(() => {
        const fechaLogro = typeof obtenerFechaLogroMesActual === 'function' ? obtenerFechaLogroMesActual(persona) : null;
        if (!fechaLogro) return '';
        const texto = new Date(fechaLogro).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });
        return `<div><span>Llegó a sus $${formatearDineroPersonas(persona.constancia.metaMes)} este mes el</span><strong>${texto}</strong></div>`;
      })()}
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
  if (limitante.unidad === 'puntos') return `${formatearDineroPersonas(limitante.faltante)} puntos`;
  if (limitante.unidad === 'personas_calificadas') return `${Math.ceil(limitante.faltante)} persona${limitante.faltante === 1 ? '' : 's'} calificada${limitante.faltante === 1 ? '' : 's'}`;
  return `${Math.ceil(limitante.faltante)} personas activas`;
}

function setTextPlanMW(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// RIFA DEL MES (js/rifa-mensual-modelo.js) — solicitud o votación
// ============================================================

function renderRifaMes() {

  const mesKey = obtenerMesKeyActualRifaMensual();
  setTextPlanMW('rifaMesLabel', formatearPeriodoLabel(mesKey));

  const config = obtenerConfigRifaMes(mesKey);

  document.querySelectorAll('#rifaModoChips [data-rifa-modo]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-rifa-modo') === config.modo);
  });

  const opcionesBloque = document.getElementById('rifaOpcionesBloque');
  opcionesBloque.hidden = config.modo !== 'votacion';
  if (config.modo === 'votacion') renderOpcionesRifaMes(config);

  renderResultadosRifaMes(config);
  renderBoletosRifaMes();

}

function renderOpcionesRifaMes(config) {

  const grid = document.getElementById('rifaOpcionesGrid');
  const conteo = obtenerConteoVotosRifaMes(config.mesKey);

  if (!config.opciones || !config.opciones.length) {
    grid.innerHTML = '<p class="bp-sub">Todavía no agregas ninguna opción — usa "+ Agregar opción".</p>';
    return;
  }

  grid.innerHTML = config.opciones.map(op => {
    const votosOpcion = (conteo.find(c => c.opcion.id === op.id) || { votos: [] }).votos;
    return `
      <div class="rifa-opcion-card">
        ${op.fotoUrl ? `<img src="${op.fotoUrl}" alt="${escapeHTMLPersonas(op.nombre)}">` : '<div class="rifa-opcion-sinfoto">Sin foto</div>'}
        <div class="rifa-opcion-body">
          <strong>${escapeHTMLPersonas(op.nombre)}</strong>
          ${op.descripcion ? `<p>${escapeHTMLPersonas(op.descripcion)}</p>` : ''}
          <span class="rifa-opcion-votos">${votosOpcion.length} voto${votosOpcion.length === 1 ? '' : 's'}</span>
        </div>
        <div class="rifa-opcion-acciones">
          <button class="btn btn-outline" type="button" data-editar-opcion="${op.id}">Editar</button>
          <button class="btn btn-outline" type="button" data-eliminar-opcion="${op.id}">Eliminar</button>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-editar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalOpcionRifa(config.mesKey, btn.getAttribute('data-editar-opcion')));
  });

  grid.querySelectorAll('[data-eliminar-opcion]').forEach(btn => {
    btn.addEventListener('click', () => {
      const opcionId = btn.getAttribute('data-eliminar-opcion');
      const opcion = config.opciones.find(o => o.id === opcionId);
      abrirAutorizacionAdmin({
        titulo: 'Eliminar opción de la rifa',
        mensaje: `¿Eliminar "${escapeHTMLPersonas(opcion ? opcion.nombre : '')}" de las opciones de este mes? Los votos que ya tenía quedan como historial.`,
        peligrosa: true,
        onConfirmar: () => {
          eliminarOpcionRifaMes(config.mesKey, opcionId, { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre });
          mostrarToast('Opción eliminada.');
          renderRifaMes();
        }
      });
    });
  });

}

function renderResultadosRifaMes(config) {

  const bloque = document.getElementById('rifaResultadosBloque');
  const tituloEl = document.getElementById('rifaResultadosTitulo');
  const mesKey = config.mesKey;

  if (!config.modo) {
    tituloEl.textContent = 'Resultados';
    bloque.innerHTML = '<p class="bp-sub">Elige un modo arriba para empezar a recibir participación este mes.</p>';
    return;
  }

  if (config.modo === 'solicitud') {
    const solicitudes = obtenerSolicitudesRifaMes(mesKey);
    tituloEl.textContent = `Solicitudes recibidas (${solicitudes.length})`;
    bloque.innerHTML = solicitudes.length ? `<div class="ct-detail-list" style="border-bottom:0;">${solicitudes.map(s => `
      <div class="ct-detail-row">
        <div>
          <strong>${escapeHTMLPersonas(s.personaNombre)}</strong>
          <span class="ct-detail-sub">${formatearFechaLogro(s.actualizadoEn || s.fecha)}</span>
          <p style="margin:6px 0 0;">${escapeHTMLPersonas(s.texto)}</p>
        </div>
        ${s.fotoUrl ? `<img src="${s.fotoUrl}" alt="Foto de ${escapeHTMLPersonas(s.personaNombre)}" class="rifa-solicitud-foto">` : ''}
      </div>
    `).join('')}</div>` : '<p class="bp-sub">Todavía nadie ha enviado su solicitud este mes.</p>';
    return;
  }

  // modo votación
  const conteo = obtenerConteoVotosRifaMes(mesKey);
  const totalVotos = conteo.reduce((suma, c) => suma + c.votos.length, 0);
  tituloEl.textContent = `Votos recibidos (${totalVotos})`;

  if (!config.opciones || !config.opciones.length) {
    bloque.innerHTML = '<p class="bp-sub">Agrega opciones arriba para que las Emprendedoras/Líderes puedan votar.</p>';
    return;
  }

  bloque.innerHTML = conteo.map(({ opcion, votos }) => `
    <div class="ct-row-wrap">
      <button type="button" class="ct-row" data-toggle-opcion-votos="${opcion.id}" aria-expanded="false">
        <div><span class="ct-level">${escapeHTMLPersonas(opcion.nombre)}</span></div>
        <span class="ct-amount">${votos.length} voto${votos.length === 1 ? '' : 's'} <span class="ct-chevron">▾</span></span>
      </button>
      <div class="ct-detail-list" id="votosDetalle${opcion.id}" hidden>
        ${votos.length ? votos.map(v => `
          <div class="ct-detail-row">
            <div><strong>${escapeHTMLPersonas(v.personaNombre)}</strong><span class="ct-detail-sub">${formatearFechaLogro(v.actualizadoEn || v.fecha)}</span></div>
          </div>
        `).join('') : '<div class="ct-detail-empty">Nadie ha votado esta opción todavía.</div>'}
      </div>
    </div>
  `).join('');

  bloque.querySelectorAll('[data-toggle-opcion-votos]').forEach(btn => {
    btn.addEventListener('click', () => {
      const detalle = document.getElementById(`votosDetalle${btn.getAttribute('data-toggle-opcion-votos')}`);
      if (!detalle) return;
      detalle.hidden = !detalle.hidden;
      btn.classList.toggle('open', !detalle.hidden);
      btn.setAttribute('aria-expanded', String(!detalle.hidden));
    });
  });

}

// ---------- Modal: agregar/editar opción de votación ----------
let rifaOpcionFotoTemporal;

function abrirModalOpcionRifa(mesKey, opcionId) {

  const config = obtenerConfigRifaMes(mesKey);
  const opcion = opcionId ? (config.opciones || []).find(o => o.id === opcionId) : null;
  rifaOpcionFotoTemporal = opcion ? opcion.fotoUrl : '';

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>${opcion ? 'Editar opción' : 'Nueva opción de la rifa'}</h3>
    <p class="modal-sub">${formatearPeriodoLabel(mesKey)}</p>
    <label for="rifaOpcionNombre">Nombre del regalo</label>
    <input type="text" id="rifaOpcionNombre" value="${(opcion ? opcion.nombre : '').replace(/"/g, '&quot;')}">
    <label for="rifaOpcionDescripcion" style="margin-top:10px;">Descripción</label>
    <textarea id="rifaOpcionDescripcion" rows="3">${opcion ? escapeHTMLPersonas(opcion.descripcion || '') : ''}</textarea>
    <label for="rifaOpcionFoto" style="margin-top:10px;">Foto</label>
    <input type="file" id="rifaOpcionFoto" accept="image/*">
    <small class="field-help" id="rifaOpcionFotoActual">${opcion && opcion.fotoUrl ? 'Ya tiene una foto — sube otra solo si quieres reemplazarla.' : 'Sin foto todavía.'}</small>
    <div id="rifaOpcionError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:14px;" id="rifaOpcionGuardarBtn">Guardar</button>
  `;
  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', () => { overlay.classList.remove('open'); });

  document.getElementById('rifaOpcionFoto')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    const error = document.getElementById('rifaOpcionError');
    if (!archivo) return;
    if (!archivo.type.startsWith('image/')) {
      e.target.value = '';
      if (error) { error.textContent = 'Selecciona un archivo de imagen válido.'; error.style.display = 'block'; }
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      e.target.value = '';
      if (error) { error.textContent = 'La imagen no puede superar 2 MB.'; error.style.display = 'block'; }
      return;
    }
    if (error) error.style.display = 'none';
    const lector = new FileReader();
    lector.onload = () => { rifaOpcionFotoTemporal = lector.result; };
    lector.readAsDataURL(archivo);
  });

  document.getElementById('rifaOpcionGuardarBtn')?.addEventListener('click', () => {
    const nombre = document.getElementById('rifaOpcionNombre').value.trim();
    const descripcion = document.getElementById('rifaOpcionDescripcion').value.trim();
    const error = document.getElementById('rifaOpcionError');
    if (!nombre) {
      if (error) { error.textContent = 'Escribe el nombre del regalo.'; error.style.display = 'block'; }
      return;
    }

    const identidad = { usuarioId: ADMIN_IDENTIDAD.usuarioId, usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre };
    const resultado = opcion
      ? editarOpcionRifaMes(mesKey, opcion.id, { nombre, fotoUrl: rifaOpcionFotoTemporal, descripcion })
      : agregarOpcionRifaMes(mesKey, { nombre, fotoUrl: rifaOpcionFotoTemporal, descripcion }, identidad);

    if (!resultado.ok) {
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }

    overlay.classList.remove('open');
    mostrarToast(opcion ? 'Opción actualizada.' : 'Opción agregada.');
    renderRifaMes();
  });

}

// ============================================================
// BOLETOS DE LA RIFA (mes ya cerrado, listo para imprimir) — folio +
// fecha de sorteo + PDF compactado de 10 por hoja.
// Lista A, fusión con mi-equipo — ver js/rifa-boletos-modelo.js
//
// A diferencia del resto de la pestaña "Rifa del mes" (que trabaja
// sobre el mes EN CURSO, todavía acumulando compras), este bloque
// siempre muestra el mes que YA CERRÓ — el que se sortea el día 15 de
// este mes — porque es el que hay que imprimir para el sorteo.
// ============================================================

function renderBoletosRifaMes() {

  const mesKey = mesKeyAnteriorRifaBoletos(obtenerMesKeyActualRifaMensual());
  setTextPlanMW('boletosSorteoFecha', `Sorteo oficial: ${formatearFechaSorteoRifaMes(mesKey)}`);

  const resumen = obtenerResumenBoletosPorPersonaRifaMes(mesKey);
  const bloque = document.getElementById('boletosRifaBloque');
  if (!bloque) return;

  if (!resumen.length) {
    bloque.innerHTML = '<p class="bp-sub">Nadie ganó boletos el mes pasado.</p>';
    return;
  }

  bloque.innerHTML = `
    <div class="catalog-table-wrap">
      <table class="catalog-table">
        <thead><tr><th>Persona</th><th>Boletos</th></tr></thead>
        <tbody>
          ${resumen.map(r => `
            <tr>
              <td>${escapeHTMLPersonas(r.personaNombre)}</td>
              <td>${r.boletos.length}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

}

function sanitizarNombreArchivoPlanMW(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// PDF imprimible con todos los boletos del mes ya cerrado, 10 por hoja
// Carta (2 columnas × 5 filas) — reemplaza la descarga individual de
// SVGs de uno en uno.
async function generarPDFBoletosRifa() {

  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
    return;
  }

  const mesKey = mesKeyAnteriorRifaBoletos(obtenerMesKeyActualRifaMensual());
  const boletos = obtenerBoletosRifaMes(mesKey);

  if (!boletos.length) {
    mostrarToast('Nadie ganó boletos el mes pasado — no hay nada que imprimir.');
    return;
  }

  // Folio "local": posición de cada boleto dentro de los boletos de SU
  // MISMA persona (1, 2, 3...) — boletos ya viene ordenado por folio
  // general ascendente, así que este conteo respeta ese mismo orden.
  const folioLocalPorFolio = new Map();
  const contadorPorPersona = {};
  boletos.forEach(b => {
    contadorPorPersona[b.personaId] = (contadorPorPersona[b.personaId] || 0) + 1;
    folioLocalPorFolio.set(b.folio, contadorPorPersona[b.personaId]);
  });

  const contenedor = document.getElementById('boletosPdfTemplate');
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'letter' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  try {

    if (document.fonts?.ready) await document.fonts.ready;

    for (let i = 0; i < boletos.length; i += 10) {
      const hoja = boletos.slice(i, i + 10);
      contenedor.innerHTML = construirHTMLHojaBoletosRifa(hoja, folioLocalPorFolio);
      const canvas = await html2canvas(contenedor, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pageWidth, pageHeight);
    }

    pdf.save(`MW_Boletos_Rifa_${sanitizarNombreArchivoPlanMW(formatearPeriodoLabel(mesKey))}.pdf`);
    mostrarToast(`${boletos.length} boleto(s) listos para imprimir.`);

  } catch (error) {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
  } finally {
    contenedor.innerHTML = '';
  }

}

// ============================================================
// HISTORIAL DE RANGOS MES A MES (TODAS LAS LÍDERES)
// Lista A, fusión con mi-equipo — usa comisiones-modelo.js
// (calcularRangoAplicadoPeriodo), el mismo cálculo de rango
// aplicado que ya usa Comisiones — un solo criterio, no dos.
// ============================================================

function obtenerUltimosPeriodosPlanMW(cantidad) {
  const periodos = [];
  const [anio, mes] = obtenerPeriodoActualKey().split('-').map(Number);
  for (let i = cantidad - 1; i >= 0; i--) {
    const d = new Date(anio, mes - 1 - i, 1);
    periodos.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return periodos;
}

function calcularHistorialRangosTodas(cantidadMeses) {
  const periodos = obtenerUltimosPeriodosPlanMW(cantidadMeses);
  const lideres = obtenerPersonas()
    .filter(p => p.tipo === 'lider' && p.estado !== 'baja')
    .sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b)));

  const filas = lideres.map(lider => ({
    lider,
    porMes: periodos.map(p => calcularRangoAplicadoPeriodo(lider, p).rangoKey)
  }));

  return { periodos, filas };
}

function ordenRangoPlanMW(key) {
  return RANGOS_MW.findIndex(r => r.key === key);
}

function renderHistorialRangos() {

  const { periodos, filas } = calcularHistorialRangosTodas(6);
  const bloque = document.getElementById('historialRangosBloque');
  if (!bloque) return;

  bloque.innerHTML = `
    <div class="catalog-table-wrap">
      <table class="catalog-table">
        <thead>
          <tr>
            <th>Líder</th>
            ${periodos.map(p => `<th>${formatearPeriodoLabelComisiones(p)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filas.map(f => `
            <tr>
              <td>${escapeHTMLPersonas(nombreCompletoPersona(f.lider))}</td>
              ${f.porMes.map((rangoKey, i) => {
                const anterior = i > 0 ? f.porMes[i - 1] : null;
                let flecha = '';
                if (anterior && anterior !== rangoKey) {
                  flecha = ordenRangoPlanMW(rangoKey) > ordenRangoPlanMW(anterior)
                    ? ' <span style="color:#1f7a34;">▲</span>'
                    : ' <span style="color:#a3272f;">▼</span>';
                }
                return `<td>${rangoLabel(rangoKey)}${flecha}</td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

}
