// MW JOYERÍA — Admin: Comisiones ("Excel inteligente de comisiones")
//
// Página controladora. Todo el cálculo vive en js/comisiones-modelo.js —
// este archivo solo arma la tabla, la edición estilo Excel, el
// autoguardado local y la exportación/PDF. No duplica lógica de
// personas/equipos/rangos (reutiliza personas-ejemplo.js, lider-ejemplo.js,
// lider-cuenta-ejemplo.js, plan-mw-admin.js).
//
// ⚠️ TEMPORAL: localStorage simula Firestore. "Sincronizar" en esta fase
// significa "escribir el ajuste en su lugar definitivo (mw-comisiones-
// ajustes-v1) en vez de dejarlo solo en el borrador local" — no hay
// backend real todavía (ver nota de arquitectura en comisiones-modelo.js).

let periodoActual = obtenerPeriodoActualKey();
let subPeriodoActual = obtenerSubPeriodoActual();
let filtroLiderTexto = '';
let comisionesData = [];
let pendienteBorrador = {}; // clave -> datos del ajuste todavía no "sincronizado"
let timerAutoguardado = null;
let timerBusquedaEquipo = null;

// Qué líderes/niveles están expandidos — se preserva entre renders (el
// autoguardado vuelve a pintar toda la tabla en segundo plano y no debe
// cerrar lo que la persona ya tenía abierto).
let expandedLideres = new Set();
let expandedNiveles = new Set(); // claves "liderId-nivel"

document.addEventListener('DOMContentLoaded', () => {

  renderSelectorPeriodoComisiones();
  document.getElementById('pagoSelect').value = subPeriodoActual;

  revisarBorradorAlCargar();
  renderComisiones();

  document.getElementById('periodoSelect')?.addEventListener('change', (e) => {
    periodoActual = e.target.value;
    renderComisiones();
  });

  document.getElementById('pagoSelect')?.addEventListener('change', (e) => {
    subPeriodoActual = e.target.value;
    renderComisiones();
  });

  document.getElementById('buscarLiderInput')?.addEventListener('input', (e) => {
    filtroLiderTexto = e.target.value.trim().toLowerCase();
    aplicarFiltroLideres();
  });

  document.getElementById('buscarEquipoInput')?.addEventListener('input', (e) => {
    const valor = e.target.value.trim();
    clearTimeout(timerBusquedaEquipo);
    timerBusquedaEquipo = setTimeout(() => buscarEnEquipos(valor), 280);
  });

  document.getElementById('recalcularBtn')?.addEventListener('click', () => {
    renderComisiones();
    mostrarToast('Cálculos actualizados con los datos vigentes.');
  });

  document.getElementById('expandirTodoBtn')?.addEventListener('click', () => alternarTodo(true));
  document.getElementById('contraerTodoBtn')?.addEventListener('click', () => alternarTodo(false));
  document.getElementById('exportarExcelBtn')?.addEventListener('click', exportarComisionesExcel);
  document.getElementById('comprobanteGeneralBtn')?.addEventListener('click', abrirModalComprobanteGeneral);

  document.getElementById('commRecuperarBtn')?.addEventListener('click', recuperarBorrador);
  document.getElementById('commDescartarBtn')?.addEventListener('click', descartarBorradorUI);

  window.addEventListener('online', () => {
    actualizarPillSync();
    if (Object.keys(pendienteBorrador).length) {
      mostrarToast('Conexión restablecida — sincronizando cambios...');
      sincronizarBorrador();
    }
  });
  window.addEventListener('offline', () => actualizarPillSync());

});

// ============================================================
// PERIODO
// ============================================================

function renderSelectorPeriodoComisiones() {
  const select = document.getElementById('periodoSelect');
  if (!select) return;

  const periodos = [];
  const base = new Date();
  base.setDate(1);
  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    periodos.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  select.innerHTML = periodos.map(p => `<option value="${p}">${formatearPeriodoLabelComisiones(p)}</option>`).join('');
  select.value = periodoActual;
}

// ============================================================
// BORRADOR / AUTOGUARDADO
// ============================================================

function revisarBorradorAlCargar() {
  const borrador = obtenerBorrador();
  const pendientes = borrador?.pendientes || {};
  if (Object.keys(pendientes).length) {
    pendienteBorrador = pendientes;
    document.getElementById('commRecuperarBanner').hidden = false;
  }
}

function recuperarBorrador() {
  Object.values(pendienteBorrador).forEach(datos => guardarAjusteManual(datos));
  pendienteBorrador = {};
  descartarBorrador();
  document.getElementById('commRecuperarBanner').hidden = true;
  mostrarToast('Cambios recuperados y sincronizados.');
  renderComisiones();
}

function descartarBorradorUI() {
  pendienteBorrador = {};
  descartarBorrador();
  document.getElementById('commRecuperarBanner').hidden = true;
  renderComisiones();
}

function programarAutoguardado() {
  actualizarPillSync('guardando');
  guardarBorrador({ pendientes: pendienteBorrador });
  clearTimeout(timerAutoguardado);
  timerAutoguardado = setTimeout(sincronizarBorrador, 700);
}

function sincronizarBorrador() {
  if (!navigator.onLine) { actualizarPillSync(); return; }
  if (!Object.keys(pendienteBorrador).length) { actualizarPillSync(); return; }

  Object.values(pendienteBorrador).forEach(datos => guardarAjusteManual(datos));
  pendienteBorrador = {};
  descartarBorrador();
  renderComisiones();
}

function actualizarPillSync(modo) {
  const pill = document.getElementById('commSyncPill');
  if (!pill) return;

  if (!navigator.onLine) {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Sin conexión — cambios guardados localmente';
    pill.className = 'comm-sync-pill offline';
    return;
  }

  if (modo === 'guardando') {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Guardando...';
    pill.className = 'comm-sync-pill guardando';
    return;
  }

  const hayAjustes = comisionesData.some(l => l.tieneAjustes);
  if (hayAjustes) {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Hay ajustes manuales';
    pill.className = 'comm-sync-pill ajustes';
  } else {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Todos los cálculos actualizados';
    pill.className = 'comm-sync-pill ok';
  }
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function fmtMoneyComm(n) {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderComisiones() {
  comisionesData = calcularTodasLasComisiones(periodoActual, subPeriodoActual);
  const cont = document.getElementById('comisionesLideres');
  if (!cont) return;

  if (!comisionesData.length) {
    cont.innerHTML = `
      <div class="catalog-empty-cell" style="padding:3rem 1rem;">
        <strong>Todavía no hay líderes registradas</strong>
        <span>Da de alta líderes en Emprendedoras/Líderes para ver sus comisiones aquí.</span>
      </div>
    `;
    actualizarPillSync();
    return;
  }

  cont.innerHTML = comisionesData.map(construirCardLider).join('');

  wireEventosTabla();
  aplicarFiltroLideres();
  actualizarPillSync();
}

function aplicarFiltroLideres() {
  document.querySelectorAll('.comm-lider-card').forEach(card => {
    const nombre = (card.getAttribute('data-nombre-lider') || '').toLowerCase();
    card.style.display = !filtroLiderTexto || nombre.includes(filtroLiderTexto) ? '' : 'none';
  });
}

// ============================================================
// TARJETA DE LÍDER
// ============================================================

function construirCardLider(r) {

  // r ya viene calculado para el sub-periodo elegido arriba (toggle
  // Periodo 1/Periodo 2) — eso sigue rigiendo el pago (son dos pagos
  // reales, en fechas distintas) y las exportaciones. Para la tabla de
  // equipo, que ahora muestra los dos periodos juntos, se calcula
  // aparte el que falte (reutilizando el mismo motor una sola vez más
  // por líder, no todas las líderes).
  const rP1 = subPeriodoActual === 'p1' ? r : calcularComisionesLider(r.lider, periodoActual, 'p1');
  const rP2 = subPeriodoActual === 'p2' ? r : calcularComisionesLider(r.lider, periodoActual, 'p2');
  const totalComisionCombinado = rP1.totalComision + rP2.totalComision;

  const estadoPagoLabel = r.estadoPago.estado === 'pagada' ? 'Pagada' : 'Pendiente';
  const estadoPagoClase = r.estadoPago.estado === 'pagada' ? 'badge-pagada' : 'badge-pendiente';

  const minimo = typeof calcularCumpleRangoActual === 'function' ? calcularCumpleRangoActual(r.lider, periodoActual) : { aplica: false, cumple: true };
  const avisoMinimo = minimo.aplica && !minimo.cumple
    ? `<span class="badge badge-correccion" title="${minimo.items.filter(it => !it.cumple).map(it => `${it.label}: ${it.valores}`).join(' · ')}">No alcanza el mínimo de ${rangoLabel(r.rangoKey)} este periodo</span>`
    : '';

  return `
    <div class="comm-lider-card" data-lider-card="${r.lider.id}" data-nombre-lider="${escapeAttributePersonas(nombreCompletoPersona(r.lider))}">
      <div class="comm-lider-header">
        <div class="comm-lider-info">
          <span class="comm-lider-nombre">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</span>
          <div class="comm-lider-meta">
            <span class="badge badge-ascenso">Rango aplicado: ${rangoLabel(r.rangoKey)}</span>
            <span>Origen: ${escapeHTMLPersonas(r.origenRango)}</span>
            <span>· Equipo: ${r.totalEquipo}</span>
            <span class="badge ${estadoPagoClase}">${estadoPagoLabel}</span>
            ${r.tieneAjustes ? '<span class="badge badge-ascenso"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Con ajustes manuales</span>' : ''}
            ${avisoMinimo}
          </div>
        </div>
        <div class="comm-lider-totales">
          <div class="comm-lider-total-item">
            <span>Periodo 1</span>
            <strong>${fmtMoneyComm(rP1.totalComision)}</strong>
          </div>
          <div class="comm-lider-total-item">
            <span>Periodo 2</span>
            <strong>${fmtMoneyComm(rP2.totalComision)}</strong>
          </div>
          <div class="comm-lider-total-item">
            <span>Comisión total</span>
            <strong>${fmtMoneyComm(totalComisionCombinado)}</strong>
          </div>
          <button class="btn btn-outline comm-ver-equipo-btn" type="button" data-toggle-equipo="${r.lider.id}">${expandedLideres.has(r.lider.id) ? '－ Ocultar equipo' : '＋ Ver equipo'}</button>
          <button class="btn btn-outline comm-ver-equipo-btn" type="button" data-generar-pdf="${r.lider.id}"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></span> Generar PDF</button>
        </div>
      </div>

      ${r.bono ? construirBloqueBono(r) : ''}

      <div class="comm-niveles" id="niveles-${r.lider.id}" ${expandedLideres.has(r.lider.id) ? '' : 'hidden'}>
        ${rP1.niveles.map((nP1, idx) => construirBloqueNivel(r.lider.id, nP1, rP2.niveles[idx])).join('')}
      </div>

      <div class="comm-pago-block">
        <span class="badge ${estadoPagoClase}">${estadoPagoLabel}</span>
        <button class="btn btn-outline" type="button" style="width:auto;" data-ver-datos-bancarios="${r.lider.id}">Datos bancarios</button>
        <button class="btn btn-outline" type="button" style="width:auto;" data-registrar-pago="${r.lider.id}">
          ${r.estadoPago.estado === 'pagada' ? 'Ver detalle de pago' : 'Registrar pago'}
        </button>
      </div>
    </div>
  `;

}

function construirBloqueBono(r) {
  const b = r.bono;
  return `
    <div class="comm-bono-block">
      <span><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="15" r="5"/><path d="M9 10.5L7 3h3l2 6"/><path d="M15 10.5L17 3h-3l-2 6"/></svg></span> <strong>Bono por rango — ${rangoLabel(b.rango)}</strong> (una sola vez, ascenso del ${formatearFechaPersonas(b.fechaAscenso)}): <strong>${fmtMoneyComm(b.monto)}</strong>. No se suma a la comisión — se paga aparte.</span>
      ${b.pagado
        ? `<span class="badge badge-pagada">Pagado el ${formatearFechaPersonas(b.fechaPago)} por ${escapeHTMLPersonas(b.registradoPor)}</span>`
        : `<button class="btn btn-outline" type="button" style="width:auto;" data-pagar-bono="${b.clave}" data-lider-bono="${r.lider.id}">Marcar como pagado</button>`}
    </div>
  `;
}

// ============================================================
// BLOQUE DE NIVEL
// ============================================================

function construirBloqueNivel(liderId, nP1, nP2) {
  const claveNivel = `${liderId}-${nP1.nivel}`;
  const abierto = expandedNiveles.has(claveNivel);
  const totalNivelCombinado = nP1.filas.reduce((s, f1) => {
    const f2 = (nP2?.filas || []).find(f => f.persona.id === f1.persona.id);
    return s + f1.comisionFinal + (f2 ? f2.comisionFinal : 0);
  }, 0);
  return `
    <div class="comm-nivel-block" data-nivel-block="${claveNivel}">
      <button type="button" class="comm-nivel-header ${abierto ? 'open' : ''}" data-toggle-nivel="${claveNivel}">
        <span>Nivel ${nP1.nivel} · ${nP1.pct}% · ${nP1.filas.length} persona${nP1.filas.length === 1 ? '' : 's'}</span>
        <span class="comm-nivel-total">${fmtMoneyComm(totalNivelCombinado)} <span class="comm-nivel-chevron">▾</span></span>
      </button>
      <div class="comm-nivel-body" id="nivel-body-${claveNivel}" ${abierto ? '' : 'hidden'}>
        <div class="catalog-table-wrap comm-tabla-wrap">
          <table class="catalog-table">
            <thead>
              <tr>
                <th>Emprendedora</th>
                <th>Periodo 1</th>
                <th>Base Comisión P1</th>
                <th>%</th>
                <th>Comisión calculada P1</th>
                <th>Periodo 2</th>
                <th>Base Comisión P2</th>
                <th>%</th>
                <th>Comisión calculada P2</th>
                <th>Ajuste manual</th>
                <th>Comisión final</th>
              </tr>
            </thead>
            <tbody>
              ${nP1.filas.length ? nP1.filas.map(f1 => {
                const f2 = (nP2?.filas || []).find(f => f.persona.id === f1.persona.id) || null;
                return construirFilaComisionHTML(liderId, f1, f2);
              }).join('') : `
                <tr><td colspan="11" class="catalog-empty-cell">Todavía no hay integrantes en este nivel.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function construirCeldaEditableComision(liderId, f, subPeriodo) {
  if (!f) return `<td>—</td>`;
  const ajustada = !!f.ajuste;
  return `<td class="comm-celda-editable ${ajustada ? 'ajustado' : 'calc'}"
      data-editable-comision
      data-clave="${f.clave}"
      data-lider="${liderId}"
      data-persona="${f.persona.id}"
      data-subperiodo="${subPeriodo}"
      data-calculada="${f.comisionCalculada}"
      data-final="${f.comisionFinal}"
      tabindex="0">${fmtMoneyComm(f.comisionFinal)}</td>`;
}

function construirFilaComisionHTML(liderId, f1, f2) {
  const ajustada1 = !!f1.ajuste;
  const ajustada2 = !!(f2 && f2.ajuste);
  const diferencia1 = ajustada1 ? f1.comisionFinal - f1.comisionCalculada : 0;
  const diferencia2 = ajustada2 ? f2.comisionFinal - f2.comisionCalculada : 0;
  const ajusteCombinado = diferencia1 + diferencia2;
  const comisionFinalCombinada = f1.comisionFinal + (f2 ? f2.comisionFinal : 0);

  const iconoRestaurar = (f, subPeriodo) => !f || !f.ajuste ? '' : `<button type="button" class="comm-icon-btn" data-restaurar="${f.clave}" data-lider="${liderId}" data-persona="${f.persona.id}" data-subperiodo="${subPeriodo}" title="Restaurar cálculo automático (Periodo ${subPeriodo === 'p1' ? '1' : '2'})">↺</button>`;
  const iconoHistorial = (f, subPeriodo) => !f ? '' : `<button type="button" class="comm-icon-btn" data-historial="${f.clave}" data-lider="${liderId}" data-persona="${f.persona.id}" data-subperiodo="${subPeriodo}" title="Ver historial (Periodo ${subPeriodo === 'p1' ? '1' : '2'})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></button>`;

  return `
    <tr data-fila-persona="${f1.persona.id}">
      <td>${escapeHTMLPersonas(nombreCompletoPersona(f1.persona))}</td>
      <td>${fmtMoneyComm(f1.compraNormal)}</td>
      <td>${fmtMoneyComm(f1.base)}</td>
      <td>${f1.pct}%</td>
      ${construirCeldaEditableComision(liderId, f1, 'p1')}
      <td>${f2 ? fmtMoneyComm(f2.compraNormal) : '—'}</td>
      <td>${f2 ? fmtMoneyComm(f2.base) : '—'}</td>
      <td>${f2 ? `${f2.pct}%` : '—'}</td>
      ${construirCeldaEditableComision(liderId, f2, 'p2')}
      <td data-celda-ajuste>
        ${ajustada1 || ajustada2 ? `${ajusteCombinado >= 0 ? '+' : ''}${fmtMoneyComm(ajusteCombinado)}` : '—'}
        ${iconoRestaurar(f1, 'p1')}${iconoRestaurar(f2, 'p2')}
        ${iconoHistorial(f1, 'p1')}${iconoHistorial(f2, 'p2')}
      </td>
      <td data-celda-final-combinada><strong>${fmtMoneyComm(comisionFinalCombinada)}</strong></td>
    </tr>
  `;
}

// Vuelve a calcular y pintar SOLO "Ajuste manual" y "Comisión final" de
// una fila, leyendo el estado actual (ya editado) de sus dos celdas de
// periodo — para que editar Periodo 1 o Periodo 2 se refleje de
// inmediato en el total combinado, sin esperar el autoguardado
// (~700ms) ni volver a pintar toda la tabla.
function actualizarCombinadosFila(tr) {
  if (!tr) return;

  function leerCelda(selector) {
    const celda = tr.querySelector(selector);
    if (!celda) return null;
    return {
      clave: celda.dataset.clave,
      lider: celda.dataset.lider,
      persona: celda.dataset.persona,
      calculada: parseFloat(celda.dataset.calculada) || 0,
      final: parseFloat(celda.dataset.final) || 0,
      ajustado: celda.classList.contains('ajustado')
    };
  }

  const d1 = leerCelda('[data-subperiodo="p1"]');
  const d2 = leerCelda('[data-subperiodo="p2"]');
  const diferencia1 = d1 && d1.ajustado ? d1.final - d1.calculada : 0;
  const diferencia2 = d2 && d2.ajustado ? d2.final - d2.calculada : 0;
  const ajusteCombinado = diferencia1 + diferencia2;
  const finalCombinado = (d1 ? d1.final : 0) + (d2 ? d2.final : 0);

  const iconoRestaurar = (d, subPeriodo) => !d || !d.ajustado ? '' : `<button type="button" class="comm-icon-btn" data-restaurar="${d.clave}" data-lider="${d.lider}" data-persona="${d.persona}" data-subperiodo="${subPeriodo}" title="Restaurar cálculo automático (Periodo ${subPeriodo === 'p1' ? '1' : '2'})">↺</button>`;
  const iconoHistorial = (d, subPeriodo) => !d ? '' : `<button type="button" class="comm-icon-btn" data-historial="${d.clave}" data-lider="${d.lider}" data-persona="${d.persona}" data-subperiodo="${subPeriodo}" title="Ver historial (Periodo ${subPeriodo === 'p1' ? '1' : '2'})"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></button>`;

  const celdaAjuste = tr.querySelector('[data-celda-ajuste]');
  if (celdaAjuste) {
    celdaAjuste.innerHTML = `
      ${(d1?.ajustado || d2?.ajustado) ? `${ajusteCombinado >= 0 ? '+' : ''}${fmtMoneyComm(ajusteCombinado)}` : '—'}
      ${iconoRestaurar(d1, 'p1')}${iconoRestaurar(d2, 'p2')}
      ${iconoHistorial(d1, 'p1')}${iconoHistorial(d2, 'p2')}
    `;
    wireBotonesAjusteFila(celdaAjuste);
  }

  const celdaFinal = tr.querySelector('[data-celda-final-combinada]');
  if (celdaFinal) celdaFinal.innerHTML = `<strong>${fmtMoneyComm(finalCombinado)}</strong>`;
}

// ============================================================
// EVENTOS DE LA TABLA
// ============================================================

function wireBotonesAjusteFila(scope) {
  scope.querySelectorAll('[data-restaurar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmarRestaurarCalculo(btn.getAttribute('data-lider'), btn.getAttribute('data-persona'), btn.getAttribute('data-subperiodo'));
    });
  });

  scope.querySelectorAll('[data-historial]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirHistorialAjuste(btn.getAttribute('data-lider'), btn.getAttribute('data-persona'), btn.getAttribute('data-subperiodo'));
    });
  });
}

function wireEventosTabla() {

  document.querySelectorAll('[data-toggle-equipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-equipo');
      const cont = document.getElementById(`niveles-${id}`);
      if (!cont) return;
      cont.hidden = !cont.hidden;
      if (cont.hidden) expandedLideres.delete(id); else expandedLideres.add(id);
      btn.textContent = cont.hidden ? '＋ Ver equipo' : '－ Ocultar equipo';
    });
  });

  document.querySelectorAll('[data-toggle-nivel]').forEach(btn => {
    btn.addEventListener('click', () => {
      const clave = btn.getAttribute('data-toggle-nivel');
      const body = document.getElementById(`nivel-body-${clave}`);
      if (!body) return;
      body.hidden = !body.hidden;
      if (body.hidden) expandedNiveles.delete(clave); else expandedNiveles.add(clave);
      btn.classList.toggle('open', !body.hidden);
    });
  });

  document.querySelectorAll('[data-editable-comision]').forEach(td => {
    td.addEventListener('click', () => activarEdicionCelda(td));
    td.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activarEdicionCelda(td); }
    });
  });

  wireBotonesAjusteFila(document);

  document.querySelectorAll('[data-registrar-pago]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPago(btn.getAttribute('data-registrar-pago')));
  });

  document.querySelectorAll('[data-ver-datos-bancarios]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalDatosBancariosLider(btn.getAttribute('data-ver-datos-bancarios')));
  });

  document.querySelectorAll('[data-pagar-bono]').forEach(btn => {
    btn.addEventListener('click', () => confirmarPagarBono(btn.getAttribute('data-pagar-bono')));
  });

  document.querySelectorAll('[data-generar-pdf]').forEach(btn => {
    btn.addEventListener('click', () => generarPDFComision(btn.getAttribute('data-generar-pdf')));
  });

}

function alternarTodo(expandir) {
  comisionesData.forEach(r => {
    if (expandir) expandedLideres.add(r.lider.id); else expandedLideres.delete(r.lider.id);
    r.niveles.forEach(n => {
      const clave = `${r.lider.id}-${n.nivel}`;
      if (expandir) expandedNiveles.add(clave); else expandedNiveles.delete(clave);
    });
  });
  document.querySelectorAll('.comm-niveles').forEach(cont => { cont.hidden = !expandir; });
  document.querySelectorAll('[data-toggle-equipo]').forEach(btn => {
    btn.textContent = expandir ? '－ Ocultar equipo' : '＋ Ver equipo';
  });
  document.querySelectorAll('.comm-nivel-body').forEach(body => { body.hidden = !expandir; });
  document.querySelectorAll('.comm-nivel-header').forEach(h => h.classList.toggle('open', expandir));
}

// ============================================================
// EDICIÓN ESTILO EXCEL
// ============================================================

function obtenerCeldasEditablesOrdenadas() {
  return Array.from(document.querySelectorAll('[data-editable-comision]'))
    .filter(td => {
      const nivelBody = td.closest('.comm-nivel-body');
      const niveles = td.closest('.comm-niveles');
      return nivelBody && !nivelBody.hidden && niveles && !niveles.hidden;
    });
}

function activarEdicionCelda(td) {
  if (td.querySelector('input')) return;
  const valorActual = parseFloat(td.dataset.final);
  td.innerHTML = `<input type="number" step="0.01" value="${valorActual.toFixed(2)}">`;
  const input = td.querySelector('input');
  input.focus();
  input.select();

  input.addEventListener('keydown', (e) => {
    // stopPropagation es indispensable: sin esto, el mismo Enter/Tab
    // burbujea hasta el listener de activación en el <td> (usado para
    // abrir edición con teclado cuando la celda solo tiene foco) y
    // vuelve a abrir la celda que se acaba de guardar.
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCelda(td, 'commit');
      moverAlaSiguienteCelda(td);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCelda(td, 'commit');
      moverAlaSiguienteCelda(td, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCelda(td, 'cancel');
    }
  });

  input.addEventListener('blur', () => finalizarEdicionCelda(td, 'commit'));
}

// Guardar/cancelar reemplaza el <input> por texto (innerHTML) — eso
// dispara un 'blur' SÍNCRONO sobre el mismo input (el navegador lo
// quita del DOM mientras tiene el foco), y ese blur vuelve a llamar
// aquí mismo antes de que la primera llamada termine de mutar el DOM.
// Sin el candado `cerrando`, esa segunda llamada reentrante intenta
// reemplazar el <input> una segunda vez a la mitad de la primera
// reemplazada y el navegador lanza "node no longer a child" — el
// candado hace que la llamada reentrante no haga nada.
function finalizarEdicionCelda(td, modo) {
  if (td.dataset.cerrando === '1') return;
  const input = td.querySelector('input');
  if (!input) return;

  td.dataset.cerrando = '1';
  try {

    if (modo === 'cancel') {
      aplicarTextoCelda(td, parseFloat(td.dataset.final));
      return;
    }

    const nuevoValor = parseFloat(input.value);
    const valorFinalActual = parseFloat(td.dataset.final);
    const calculada = parseFloat(td.dataset.calculada);

    if (Number.isNaN(nuevoValor) || nuevoValor === valorFinalActual) {
      aplicarTextoCelda(td, valorFinalActual);
      return;
    }

    const clave = td.dataset.clave;
    pendienteBorrador[clave] = {
      liderId: td.dataset.lider,
      emprendedoraId: td.dataset.persona,
      periodoKey: periodoActual,
      subPeriodo: td.dataset.subperiodo,
      valorCalculado: calculada,
      valorNuevo: nuevoValor,
      motivo: '',
      usuarioAdminId: ADMIN_IDENTIDAD.usuarioId,
      usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre
    };

    td.dataset.final = nuevoValor;
    td.innerHTML = fmtMoneyComm(nuevoValor);
    td.className = 'comm-celda-editable ajustado';

    actualizarCombinadosFila(td.closest('tr'));
    programarAutoguardado();

  } finally {
    delete td.dataset.cerrando;
  }
}

function aplicarTextoCelda(td, valor) {
  const ajustada = td.classList.contains('ajustado');
  td.innerHTML = fmtMoneyComm(valor);
  td.className = `comm-celda-editable ${ajustada ? 'ajustado' : 'calc'}`;
}

function moverAlaSiguienteCelda(tdActual, direccion = 1) {
  const celdas = obtenerCeldasEditablesOrdenadas();
  const idx = celdas.indexOf(tdActual);
  if (idx === -1) return;
  const siguiente = celdas[idx + direccion];
  if (siguiente) {
    siguiente.focus();
    activarEdicionCelda(siguiente);
  }
}

// ============================================================
// RESTAURAR CÁLCULO AUTOMÁTICO
// ============================================================

function confirmarRestaurarCalculo(liderId, personaId, subPeriodo) {
  subPeriodo = subPeriodo || subPeriodoActual;
  abrirAutorizacionAdmin({
    titulo: 'Restaurar cálculo automático',
    mensaje: `Se eliminará el ajuste manual de esta comisión (Periodo ${subPeriodo === 'p1' ? '1' : '2'}) y volverá a mostrarse el valor calculado automáticamente. Esta acción queda registrada.`,
    onConfirmar: () => {
      delete pendienteBorrador[construirClaveAjuste(liderId, personaId, periodoActual, subPeriodo)];
      restaurarCalculoAutomatico({
        liderId, emprendedoraId: personaId, periodoKey: periodoActual, subPeriodo,
        usuarioAdminId: ADMIN_IDENTIDAD.usuarioId
      });
      mostrarToast('Cálculo automático restaurado.');
      renderComisiones();
    }
  });
}

// ============================================================
// HISTORIAL DE AJUSTES (TRAZABILIDAD)
// ============================================================

function abrirHistorialAjuste(liderId, personaId, subPeriodo) {
  subPeriodo = subPeriodo || subPeriodoActual;
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const historial = obtenerHistorialAjustePersona(liderId, personaId, periodoActual, subPeriodo);
  const persona = obtenerPersonaPorId(personaId);

  box.style.maxWidth = '480px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></div>
    <h3>Historial de ajustes</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombreCompletoPersona(persona || {}))} · ${formatearPeriodoLabelComisiones(periodoActual)} · ${subPeriodo === 'p1' ? 'Periodo 1' : 'Periodo 2'}</p>
    ${historial.length ? `
      <div class="ct-detail-list" style="border-bottom:0;">
        ${historial.map(h => `
          <div class="ct-detail-row">
            <div>
              <strong>${fmtMoneyComm(h.valorAnterior)} → ${fmtMoneyComm(h.valorNuevo)}</strong>
              <span class="ct-detail-sub">${new Date(h.fecha).toLocaleString('es-MX')} · ${escapeHTMLPersonas(h.usuarioAdminId)}${h.motivo ? ` · ${escapeHTMLPersonas(h.motivo)}` : ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<p class="bp-sub" style="margin:0;">Esta comisión no tiene ajustes manuales registrados en este periodo.</p>`}
  `;
  overlay.classList.add('open');
}

// ============================================================
// DATOS BANCARIOS (consulta rápida, sin pasar por el pago)
// ============================================================

async function abrirModalDatosBancariosLider(liderId) {
  const r = comisionesData.find(x => x.lider.id === liderId);
  if (!r) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const datosBancarios = r.lider.datosBancarios;
  const tieneDatosBancarios = datosBancarios && (datosBancarios.titular || datosBancarios.banco || datosBancarios.clabe);

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg></div>
    <h3>Datos bancarios</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</p>
    ${tieneDatosBancarios ? `
      <div class="detail-grid">
        <div><span>Titular</span><strong>${escapeHTMLPersonas(datosBancarios.titular) || '—'}</strong></div>
        <div><span>Banco</span><strong>${escapeHTMLPersonas(datosBancarios.banco) || '—'}</strong></div>
        <div><span>CLABE</span><strong>${escapeHTMLPersonas(datosBancarios.clabe) || '—'}</strong></div>
      </div>
      <div class="ine-preview" style="margin-top:10px;">
        <small class="field-help">Carátula de la CLABE</small>
        <div id="comisionesCaratulaClabeContenido">${datosBancarios.caratulaClabeUrl ? '<p class="bp-sub" style="margin:0;">Cargando…</p>' : '<p class="bp-sub" style="margin:0;">Todavía no la sube.</p>'}</div>
      </div>
    ` : `<div class="modal-note" style="margin-top:10px;">Esta líder todavía no registró sus datos bancarios en su Mi cuenta.</div>`}
  `;
  overlay.classList.add('open');

  if (datosBancarios?.caratulaClabeUrl && typeof resolverSrcDocumento === 'function') {
    const url = datosBancarios.caratulaClabeUrl;
    const blob = (typeof storageFirebase === 'undefined' || !storageFirebase) ? await obtenerBlobDocumento(url) : null;
    const src = await resolverSrcDocumento(url);
    const contenido = document.getElementById('comisionesCaratulaClabeContenido');
    if (contenido) {
      if (!src) {
        contenido.innerHTML = '<p class="bp-sub" style="margin:0;">No pudimos cargar la carátula.</p>';
      } else if (blob && blob.type === 'application/pdf') {
        contenido.innerHTML = `<a href="${src}" target="_blank" rel="noopener">Ver PDF de la carátula</a>`;
      } else {
        contenido.innerHTML = `<img src="${src}" alt="Carátula de la CLABE" style="max-width:100%;border-radius:6px;">`;
      }
    }
  }
}

// ============================================================
// PAGO DE COMISIÓN
// ============================================================

function abrirModalPago(liderId) {
  const r = comisionesData.find(x => x.lider.id === liderId);
  if (!r) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const datosBancarios = r.lider.datosBancarios;
  const tieneDatosBancarios = datosBancarios && (datosBancarios.titular || datosBancarios.banco || datosBancarios.clabe);
  const bloqueDatosBancarios = tieneDatosBancarios
    ? `<div class="detail-grid" style="margin-top:10px;">
        <div><span>Titular</span><strong>${escapeHTMLPersonas(datosBancarios.titular) || '—'}</strong></div>
        <div><span>Banco</span><strong>${escapeHTMLPersonas(datosBancarios.banco) || '—'}</strong></div>
        <div><span>CLABE</span><strong>${escapeHTMLPersonas(datosBancarios.clabe) || '—'}</strong></div>
      </div>`
    : `<div class="modal-note" style="margin-top:10px;">Esta líder todavía no registró sus datos bancarios en su Mi cuenta.</div>`;

  if (r.estadoPago.estado === 'pagada') {
    box.style.maxWidth = '420px';
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
      <h3>Pago registrado</h3>
      <div class="detail-grid">
        <div><span>Fecha de pago</span><strong>${formatearFechaPersonas(r.estadoPago.fechaPago)}</strong></div>
        <div><span>Registrado por</span><strong>${escapeHTMLPersonas(r.estadoPago.registradoPor)}</strong></div>
        <div><span>Monto pagado</span><strong>${fmtMoneyComm(r.estadoPago.montoPagado)}</strong></div>
        <div><span>Periodo</span><strong>${r.estadoPago.periodo}</strong></div>
      </div>
      <h4 class="profile-section-title" style="margin-top:14px;">Datos bancarios</h4>
      ${bloqueDatosBancarios}
    `;
    overlay.classList.add('open');
    return;
  }

  const sugerido = (r.totalComision + (r.bono && !r.bono.pagado ? r.bono.monto : 0)).toFixed(2);

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">$</div>
    <h3>Registrar pago de comisión</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))} · ${formatearPeriodoLabelComisiones(periodoActual)} · ${subPeriodoActual === 'p1' ? 'Periodo 1' : 'Periodo 2'}</p>
    <h4 class="profile-section-title" style="margin-top:10px;">Datos bancarios</h4>
    ${bloqueDatosBancarios}
    <label class="form-label" style="display:block;margin-top:10px;font-size:0.78rem;color:var(--mw-text-muted);">Monto pagado</label>
    <input type="number" step="0.01" id="montoPagoInput" value="${sugerido}" style="width:100%;padding:0.6em 0.8em;border:1px solid var(--mw-border);border-radius:8px;font-size:0.85rem;">
    <div class="modal-note" style="margin-top:10px;"><strong>Recordatorio.</strong> El pago se realiza por un proceso externo; aquí solo se registra que ya ocurrió.</div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="cancelarPagoBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="confirmarPagoBtn" type="button">Registrar pago</button>
    </div>
  `;
  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', () => overlay.classList.remove('open'));
  document.getElementById('cancelarPagoBtn')?.addEventListener('click', () => overlay.classList.remove('open'));
  document.getElementById('confirmarPagoBtn')?.addEventListener('click', () => {
    const monto = parseFloat(document.getElementById('montoPagoInput').value);
    if (Number.isNaN(monto) || monto <= 0) return;
    registrarPago({ liderId, periodoKey: periodoActual, subPeriodo: subPeriodoActual, montoPagado: monto, registradoPor: ADMIN_IDENTIDAD.usuarioNombre });
    overlay.classList.remove('open');
    mostrarToast('Pago registrado.');
    renderComisiones();
  });
}

function confirmarPagarBono(clave) {
  abrirAutorizacionAdmin({
    titulo: 'Registrar bono como pagado',
    mensaje: 'Se marcará este bono por rango como pagado. Esta acción queda registrada.',
    onConfirmar: () => {
      registrarPagoBono(clave, ADMIN_IDENTIDAD.usuarioNombre);
      mostrarToast('Bono registrado como pagado.');
      renderComisiones();
    }
  });
}

// ============================================================
// BÚSQUEDA DENTRO DE LOS EQUIPOS
// ============================================================

function buscarEnEquipos(termino) {
  const resultado = document.getElementById('commResultadoBusqueda');
  if (!termino) { resultado.hidden = true; return; }

  const q = termino.toLowerCase().trim();
  const qDigitos = termino.replace(/\D/g, '');

  let encontrado = null;

  for (const r of comisionesData) {
    for (const n of r.niveles) {
      for (const f of n.filas) {
        const p = f.persona;
        const nombreMatch = nombreCompletoPersona(p).toLowerCase().includes(q);
        const cuentaMatch = q && (String(p.numeroCuenta || '').toLowerCase().includes(q) || String(p.usuario || '').toLowerCase().includes(q));
        const telMatch = qDigitos.length >= 3 && String(p.telefono || '').replace(/\D/g, '').includes(qDigitos);
        if (nombreMatch || cuentaMatch || telMatch) {
          encontrado = { r, n, f };
          break;
        }
      }
      if (encontrado) break;
    }
    if (encontrado) break;
  }

  if (!encontrado) {
    resultado.hidden = false;
    resultado.innerHTML = `No se encontraron resultados para "${escapeHTMLPersonas(termino)}".`;
    return;
  }

  const { r, n, f } = encontrado;
  resultado.hidden = false;
  resultado.innerHTML = `
    <strong>${escapeHTMLPersonas(nombreCompletoPersona(f.persona))}</strong> está en <strong>Nivel ${n.nivel}</strong>,
    equipo de <strong>${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</strong>.
    Compra usada: ${fmtMoneyComm(f.compraNormal)} · Comisión: ${fmtMoneyComm(f.comisionFinal)}.
  `;

  expandedLideres.add(r.lider.id);
  expandedNiveles.add(`${r.lider.id}-${n.nivel}`);

  document.getElementById(`niveles-${r.lider.id}`).hidden = false;
  const btnEquipo = document.querySelector(`[data-toggle-equipo="${r.lider.id}"]`);
  if (btnEquipo) btnEquipo.textContent = '－ Ocultar equipo';

  const body = document.getElementById(`nivel-body-${r.lider.id}-${n.nivel}`);
  if (body) body.hidden = false;
  const header = document.querySelector(`[data-toggle-nivel="${r.lider.id}-${n.nivel}"]`);
  if (header) header.classList.add('open');

  const fila = document.querySelector(`[data-clave="${f.clave}"]`)?.closest('tr');
  if (fila) {
    fila.classList.add('comm-highlight-row');
    fila.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => fila.classList.remove('comm-highlight-row'), 2200);
  }
}

// ============================================================
// EXPORTAR EXCEL (CSV compatible con Excel — Líder→Nivel→Emprendedora)
// ============================================================

function exportarComisionesExcel() {

  const filas = [['Líder', 'Rango aplicado', 'Nivel', 'Emprendedora', 'Compra válida', '%', 'Comisión calculada', 'Ajuste manual', 'Comisión final', 'Total líder', 'Estado de pago']];

  comisionesData.forEach(r => {
    r.niveles.forEach(n => {
      n.filas.forEach(f => {
        filas.push([
          nombreCompletoPersona(r.lider),
          rangoLabel(r.rangoKey),
          n.nivel,
          nombreCompletoPersona(f.persona),
          f.compraNormal.toFixed(2),
          `${f.pct}%`,
          f.comisionCalculada.toFixed(2),
          f.ajuste ? (f.comisionFinal - f.comisionCalculada).toFixed(2) : '',
          f.comisionFinal.toFixed(2),
          r.totalComision.toFixed(2),
          r.estadoPago.estado
        ]);
      });
    });
  });

  const csv = '﻿' + filas.map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Comisiones_${formatearPeriodoLabelComisiones(periodoActual).replace(/\s+/g, '_')}_${subPeriodoActual.toUpperCase()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  mostrarToast('Exportación generada.');
}

// ============================================================
// PDF — COMPROBANTE DE COMISIÓN
// ============================================================

function sanitizarNombreArchivo(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function generarPDFComision(liderId) {
  const r = comisionesData.find(x => x.lider.id === liderId);
  if (!r) return;

  if (Object.keys(pendienteBorrador).length) {
    abrirAutorizacionAdmin({
      titulo: 'Hay cambios sin sincronizar',
      mensaje: 'Este comprobante se generará antes de que algunos ajustes terminen de sincronizarse. Se recomienda esperar unos segundos. ¿Generar de todas formas?',
      peligrosa: true,
      onConfirmar: () => ejecutarGeneracionPDF(r)
    });
    return;
  }

  ejecutarGeneracionPDF(r);
}

async function ejecutarGeneracionPDF(r) {

  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
    return;
  }

  const contenedor = document.getElementById('commPdfTemplate');
  contenedor.innerHTML = construirHTMLTicketPDF(r);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const logo = contenedor.querySelector('[data-pdf-logo]');
    if (logo && !logo.complete) {
      await new Promise((resolve, reject) => {
        logo.addEventListener('load', resolve, { once: true });
        logo.addEventListener('error', reject, { once: true });
      });
    }

    const canvas = await html2canvas(contenedor, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

    const nombreArchivo = sanitizarNombreArchivo(nombreCompletoPersona(r.lider));
    const periodoArchivo = sanitizarNombreArchivo(formatearPeriodoLabelComisiones(periodoActual));
    pdf.save(`MW_Comision_${nombreArchivo}_${periodoArchivo}_${subPeriodoActual.toUpperCase()}.pdf`);

    mostrarToast('Comprobante generado.');
  } catch (error) {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
  } finally {
    contenedor.innerHTML = '';
  }

}

function construirHTMLTicketPDF(r) {

  const info = obtenerInfoSubPeriodo(periodoActual, subPeriodoActual);
  const ahora = new Date();
  const todasLasFilas = r.niveles.flatMap(n => n.filas);
  const totalAjustes = todasLasFilas.filter(f => f.ajuste);
  const totalSouvenirs = todasLasFilas.reduce((s, f) => s + f.compraSouvenir, 0);
  const totalAPagar = r.totalComision + (r.bono ? r.bono.monto : 0);

  const estiloBase = `font-family:Poppins,Arial,sans-serif;color:#2A2230;padding:24px;font-size:12px;`;

  return `
    <div style="${estiloBase}">
      <div style="text-align:center;margin-bottom:16px;">
        <img data-pdf-logo src="../../assets/images/imagotipo-completo.png" alt="MW Joyería" style="display:block;width:180px;height:auto;margin:0 auto 10px;">
        <div style="font-size:13px;font-weight:600;margin-top:4px;">COMPROBANTE DE COMISIÓN</div>
        <div style="font-size:11px;color:#6B6270;margin-top:2px;">${formatearPeriodoLabelComisiones(periodoActual)} · ${info.label}</div>
        <div style="font-size:10px;color:#6B6270;">Generado el ${ahora.toLocaleString('es-MX')}</div>
      </div>

      <div style="border-top:1px solid #eae4eb;border-bottom:1px solid #eae4eb;padding:10px 0;margin-bottom:12px;">
        <div><strong>Líder:</strong> ${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</div>
        <div><strong>Número de cuenta:</strong> ${escapeHTMLPersonas(r.lider.numeroCuenta || r.lider.usuario || '—')}</div>
        <div><strong>Rango aplicado al periodo:</strong> ${rangoLabel(r.rangoKey)}</div>
        <div><strong>Origen del rango:</strong> ${escapeHTMLPersonas(r.origenRango)}</div>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-weight:600;margin-bottom:6px;">Resumen por nivel</div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#F1EBFA;"><th style="padding:4px;text-align:left;">Nivel</th><th style="padding:4px;">%</th><th style="padding:4px;">Personas c/comisión</th><th style="padding:4px;text-align:right;">Comisión</th></tr></thead>
          <tbody>
            ${r.niveles.map(n => `<tr><td style="padding:4px;">Nivel ${n.nivel}</td><td style="padding:4px;text-align:center;">${n.pct}%</td><td style="padding:4px;text-align:center;">${n.filas.filter(f => f.comisionFinal > 0).length}</td><td style="padding:4px;text-align:right;">${fmtMoneyComm(n.totalNivel)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom:12px;">
        <div style="font-weight:600;margin-bottom:6px;">Detalle por persona</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead><tr style="background:#F1EBFA;"><th style="padding:3px;text-align:left;">Nivel</th><th style="padding:3px;text-align:left;">Emprendedora</th><th style="padding:3px;">Compra válida</th><th style="padding:3px;">Base</th><th style="padding:3px;">%</th><th style="padding:3px;">Calculada</th><th style="padding:3px;">Ajuste</th><th style="padding:3px;">Final</th></tr></thead>
          <tbody>
            ${todasLasFilas.map(f => `
              <tr>
                <td style="padding:3px;">${f.nivel}</td>
                <td style="padding:3px;">${escapeHTMLPersonas(nombreCompletoPersona(f.persona))}</td>
                <td style="padding:3px;text-align:right;">${fmtMoneyComm(f.compraNormal)}</td>
                <td style="padding:3px;text-align:right;">${fmtMoneyComm(f.base)}</td>
                <td style="padding:3px;text-align:center;">${f.pct}%</td>
                <td style="padding:3px;text-align:right;">${fmtMoneyComm(f.comisionCalculada)}</td>
                <td style="padding:3px;text-align:right;">${f.ajuste ? fmtMoneyComm(f.comisionFinal - f.comisionCalculada) : '—'}</td>
                <td style="padding:3px;text-align:right;font-weight:600;">${fmtMoneyComm(f.comisionFinal)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${totalAjustes.length ? `
        <div style="background:#F3E9C7;border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:10px;">
          <strong>Ajustes manuales aplicados (${totalAjustes.length}):</strong>
          ${totalAjustes.map(f => `<div>${escapeHTMLPersonas(nombreCompletoPersona(f.persona))}: calculado ${fmtMoneyComm(f.comisionCalculada)}, final ${fmtMoneyComm(f.comisionFinal)}, diferencia ${fmtMoneyComm(f.comisionFinal - f.comisionCalculada)}, por ${escapeHTMLPersonas(f.ajuste.usuarioAdminId)}</div>`).join('')}
        </div>
      ` : ''}

      ${totalSouvenirs > 0 ? `<div style="font-size:10px;color:#6B6270;margin-bottom:12px;">Souvenirs incluidos en las compras del equipo: ${fmtMoneyComm(totalSouvenirs)} — los souvenirs no generan comisión.</div>` : ''}

      <div style="border-top:2px solid #5E1A8A;padding-top:10px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;"><span>COMISIÓN TOTAL</span><strong>${fmtMoneyComm(r.totalComision)}</strong></div>
        <div style="display:flex;justify-content:space-between;"><span>BONO POR RANGO</span><strong>${r.bono ? fmtMoneyComm(r.bono.monto) : '$0.00'}</strong></div>
        <div style="display:flex;justify-content:space-between;font-size:14px;color:#5E1A8A;margin-top:6px;"><span>TOTAL A PAGAR</span><strong>${fmtMoneyComm(totalAPagar)}</strong></div>
      </div>

      <div style="font-size:10px;margin-bottom:10px;"><strong>Estado del pago:</strong> ${r.estadoPago.estado === 'pagada' ? `Pagada el ${formatearFechaPersonas(r.estadoPago.fechaPago)} por ${escapeHTMLPersonas(r.estadoPago.registradoPor)}` : 'Pendiente de pago'}</div>

      <div style="border-top:1px solid #eae4eb;padding-top:8px;font-size:9px;color:#6B6270;text-align:center;">
        Calculado automáticamente por Portal MW.
        ${totalAjustes.length ? `<br>Este comprobante contiene ajustes manuales registrados en el sistema. Última modificación: ${formatearFechaPersonas(totalAjustes[totalAjustes.length - 1].ajuste.fecha)} por ${escapeHTMLPersonas(totalAjustes[totalAjustes.length - 1].ajuste.usuarioAdminId)}.` : ''}
      </div>
    </div>
  `;

}

// ============================================================
// PDF — COMPROBANTE GENERAL (TODAS las líderes de un periodo o mes)
// ============================================================
//
// A diferencia del ticket individual (por líder), este es un resumen:
// una fila por líder con su comisión/bono/total, sin repetir el
// desglose completo por nivel/persona de cada una (eso ya lo cubre
// "Generar comprobante" en la tarjeta de cada líder). "Todo el mes"
// arma dos secciones (Periodo 1 y Periodo 2) en el mismo documento en
// vez de sumarlas en un solo número — así el comprobante sigue
// mostrando exactamente cómo se paga cada quincena.

function abrirModalComprobanteGeneral() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const info = obtenerInfoSubPeriodo(periodoActual, subPeriodoActual);

  box.style.maxWidth = '440px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22V2z"/><path d="M9 7h6M9 11h6M9 15h4"/></svg></div>
    <h3>Comprobante de todas las comisiones</h3>
    <p class="modal-sub">¿Lo quieres solo de este periodo o del mes completo?</p>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
      <button class="btn btn-outline" style="width:100%;text-align:left;padding:0.7em 1em;" id="comprobanteSoloPeriodoBtn" type="button">
        <strong>Solo este periodo</strong><br>
        <span style="font-weight:400;font-size:0.82em;">${info.label} · ${formatearPeriodoLabelComisiones(periodoActual)}</span>
      </button>
      <button class="btn btn-outline" style="width:100%;text-align:left;padding:0.7em 1em;" id="comprobanteMesCompletoBtn" type="button">
        <strong>Todo el mes</strong><br>
        <span style="font-weight:400;font-size:0.82em;">${formatearPeriodoLabelComisiones(periodoActual)} · Periodo 1 y Periodo 2</span>
      </button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);

  document.getElementById('comprobanteSoloPeriodoBtn')?.addEventListener('click', () => {
    cerrar();
    generarComprobanteGeneral('periodo');
  });
  document.getElementById('comprobanteMesCompletoBtn')?.addEventListener('click', () => {
    cerrar();
    generarComprobanteGeneral('mes');
  });

}

function generarComprobanteGeneral(modo) {

  if (!comisionesData.length) {
    mostrarToast('No hay comisiones para generar un comprobante.');
    return;
  }

  if (Object.keys(pendienteBorrador).length) {
    abrirAutorizacionAdmin({
      titulo: 'Hay cambios sin sincronizar',
      mensaje: 'Este comprobante se generará antes de que algunos ajustes terminen de sincronizarse. Se recomienda esperar unos segundos. ¿Generar de todas formas?',
      peligrosa: true,
      onConfirmar: () => ejecutarGeneracionPDFGeneral(modo)
    });
    return;
  }

  ejecutarGeneracionPDFGeneral(modo);

}

async function ejecutarGeneracionPDFGeneral(modo) {

  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
    return;
  }

  const contenedor = document.getElementById('commPdfTemplate');
  contenedor.innerHTML = construirHTMLComprobanteGeneral(modo);

  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const logo = contenedor.querySelector('[data-pdf-logo]');
    if (logo && !logo.complete) {
      await new Promise((resolve, reject) => {
        logo.addEventListener('load', resolve, { once: true });
        logo.addEventListener('error', reject, { once: true });
      });
    }

    const canvas = await html2canvas(contenedor, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);

    const periodoArchivo = sanitizarNombreArchivo(formatearPeriodoLabelComisiones(periodoActual));
    const sufijo = modo === 'mes' ? 'MES_COMPLETO' : subPeriodoActual.toUpperCase();
    pdf.save(`MW_Comisiones_Todas_${periodoArchivo}_${sufijo}.pdf`);

    mostrarToast('Comprobante generado.');
  } catch (error) {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
  } finally {
    contenedor.innerHTML = '';
  }

}

function construirSeccionResumenComisiones(datosPeriodo, periodoKeyDoc, subPeriodoDoc) {

  const info = obtenerInfoSubPeriodo(periodoKeyDoc, subPeriodoDoc);
  const totalComisionSeccion = datosPeriodo.reduce((s, r) => s + r.totalComision, 0);
  const totalBonoSeccion = datosPeriodo.reduce((s, r) => s + (r.bono ? r.bono.monto : 0), 0);
  const totalGeneralSeccion = totalComisionSeccion + totalBonoSeccion;

  return `
    <div style="margin-bottom:18px;">
      <div style="font-weight:600;font-size:12px;margin-bottom:6px;color:#5E1A8A;">${info.label} · ${info.rango} (paga ${info.fechaPago})</div>
      <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
        <thead>
          <tr style="background:#F1EBFA;">
            <th style="padding:4px;text-align:left;">Líder</th>
            <th style="padding:4px;text-align:left;">Rango</th>
            <th style="padding:4px;">Equipo</th>
            <th style="padding:4px;text-align:right;">Comisión</th>
            <th style="padding:4px;text-align:right;">Bono</th>
            <th style="padding:4px;text-align:right;">Total a pagar</th>
            <th style="padding:4px;text-align:center;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${datosPeriodo.map(r => {
            const totalPagarLider = r.totalComision + (r.bono ? r.bono.monto : 0);
            return `
              <tr>
                <td style="padding:4px;">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</td>
                <td style="padding:4px;">${rangoLabel(r.rangoKey)}</td>
                <td style="padding:4px;text-align:center;">${r.totalEquipo}</td>
                <td style="padding:4px;text-align:right;">${fmtMoneyComm(r.totalComision)}</td>
                <td style="padding:4px;text-align:right;">${r.bono ? fmtMoneyComm(r.bono.monto) : '—'}</td>
                <td style="padding:4px;text-align:right;font-weight:600;">${fmtMoneyComm(totalPagarLider)}</td>
                <td style="padding:4px;text-align:center;">${r.estadoPago.estado === 'pagada' ? 'Pagada' : 'Pendiente'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid #5E1A8A;font-weight:700;">
            <td style="padding:4px;" colspan="3">TOTAL ${info.label.toUpperCase()}</td>
            <td style="padding:4px;text-align:right;">${fmtMoneyComm(totalComisionSeccion)}</td>
            <td style="padding:4px;text-align:right;">${fmtMoneyComm(totalBonoSeccion)}</td>
            <td style="padding:4px;text-align:right;">${fmtMoneyComm(totalGeneralSeccion)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;

}

function construirHTMLComprobanteGeneral(modo) {

  const ahora = new Date();
  const estiloBase = `font-family:Poppins,Arial,sans-serif;color:#2A2230;padding:24px;font-size:12px;`;

  let secciones;
  let subtituloPeriodo;
  let totalGeneralDoc;

  if (modo === 'mes') {
    const datosP1 = calcularTodasLasComisiones(periodoActual, 'p1');
    const datosP2 = calcularTodasLasComisiones(periodoActual, 'p2');
    // El bono por rango es un monto único del MES (no depende del
    // subperiodo), pero calcularComisionesLider() lo adjunta igual en
    // cada subperiodo — mostrarlo/sumarlo en los dos duplicaría el
    // bono. Se muestra y se cuenta una sola vez, en la sección de
    // Periodo 2 (cuando el mes ya cerró); Periodo 1 lo omite.
    const datosP1SinBono = datosP1.map(r => ({ ...r, bono: null }));
    secciones = construirSeccionResumenComisiones(datosP1SinBono, periodoActual, 'p1') + construirSeccionResumenComisiones(datosP2, periodoActual, 'p2');
    totalGeneralDoc = [...datosP1SinBono, ...datosP2].reduce((s, r) => s + r.totalComision + (r.bono ? r.bono.monto : 0), 0);
    subtituloPeriodo = `${formatearPeriodoLabelComisiones(periodoActual)} · Mes completo (Periodo 1 y Periodo 2)`;
  } else {
    secciones = construirSeccionResumenComisiones(comisionesData, periodoActual, subPeriodoActual);
    totalGeneralDoc = comisionesData.reduce((s, r) => s + r.totalComision + (r.bono ? r.bono.monto : 0), 0);
    const info = obtenerInfoSubPeriodo(periodoActual, subPeriodoActual);
    subtituloPeriodo = `${formatearPeriodoLabelComisiones(periodoActual)} · ${info.label}`;
  }

  return `
    <div style="${estiloBase}">
      <div style="text-align:center;margin-bottom:16px;">
        <img data-pdf-logo src="../../assets/images/imagotipo-completo.png" alt="MW Joyería" style="display:block;width:180px;height:auto;margin:0 auto 10px;">
        <div style="font-size:13px;font-weight:600;margin-top:4px;">COMPROBANTE GENERAL DE COMISIONES</div>
        <div style="font-size:11px;color:#6B6270;margin-top:2px;">${subtituloPeriodo}</div>
        <div style="font-size:10px;color:#6B6270;">Generado el ${ahora.toLocaleString('es-MX')}</div>
      </div>

      ${secciones}

      <div style="border-top:2px solid #5E1A8A;padding-top:10px;margin-top:6px;display:flex;justify-content:space-between;font-size:14px;color:#5E1A8A;">
        <span>TOTAL GENERAL A PAGAR</span><strong>${fmtMoneyComm(totalGeneralDoc)}</strong>
      </div>

      <div style="border-top:1px solid #eae4eb;padding-top:8px;margin-top:12px;font-size:9px;color:#6B6270;text-align:center;">
        Calculado automáticamente por Portal MW. Para el detalle completo por nivel y por persona de una líder en particular, usa "Generar comprobante" en su tarjeta.
      </div>
    </div>
  `;

}
