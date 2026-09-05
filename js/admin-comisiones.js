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
    pill.textContent = '🔴 Sin conexión — cambios guardados localmente';
    pill.className = 'comm-sync-pill offline';
    return;
  }

  if (modo === 'guardando') {
    pill.textContent = '🟡 Guardando...';
    pill.className = 'comm-sync-pill guardando';
    return;
  }

  const hayAjustes = comisionesData.some(l => l.tieneAjustes);
  if (hayAjustes) {
    pill.textContent = '🟠 Hay ajustes manuales';
    pill.className = 'comm-sync-pill ajustes';
  } else {
    pill.textContent = '🟢 Todos los cálculos actualizados';
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

  const info = obtenerInfoSubPeriodo(periodoActual, subPeriodoActual);
  const estadoPagoLabel = r.estadoPago.estado === 'pagada' ? 'Pagada' : 'Pendiente';
  const estadoPagoClase = r.estadoPago.estado === 'pagada' ? 'badge-pagada' : 'badge-pendiente';

  return `
    <div class="comm-lider-card" data-lider-card="${r.lider.id}" data-nombre-lider="${escapeAttributePersonas(nombreCompletoPersona(r.lider))}">
      <div class="comm-lider-header">
        <div class="comm-lider-info">
          <span class="comm-lider-nombre">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))}</span>
          <div class="comm-lider-meta">
            <span class="badge badge-ascenso">Rango aplicado: ${rangoLabel(r.rangoKey)}</span>
            <span>Origen: ${escapeHTMLPersonas(r.origenRango)}</span>
            <span>· Equipo: ${r.totalEquipo}</span>
            <span>· ${info.label} (paga ${info.fechaPago})</span>
            <span class="badge ${estadoPagoClase}">${estadoPagoLabel}</span>
            ${r.tieneAjustes ? '<span class="badge badge-ascenso">🟠 Con ajustes manuales</span>' : ''}
          </div>
        </div>
        <div class="comm-lider-totales">
          <div class="comm-lider-total-item">
            <span>Con comisión / Sin comisión</span>
            <strong style="font-size:0.85rem;">${r.personasConComision} / ${r.personasSinComision}</strong>
          </div>
          <div class="comm-lider-total-item">
            <span>Compra del equipo considerada</span>
            <strong style="font-size:0.85rem;">${fmtMoneyComm(r.compraConsiderada)}</strong>
          </div>
          <div class="comm-lider-total-item">
            <span>Comisión total</span>
            <strong>${fmtMoneyComm(r.totalComision)}</strong>
          </div>
          <button class="btn btn-outline comm-ver-equipo-btn" type="button" data-toggle-equipo="${r.lider.id}">${expandedLideres.has(r.lider.id) ? '－ Ocultar equipo' : '＋ Ver equipo'}</button>
          <button class="btn btn-outline comm-ver-equipo-btn" type="button" data-generar-pdf="${r.lider.id}">🧾 Generar PDF</button>
        </div>
      </div>

      ${r.bono ? construirBloqueBono(r) : ''}

      <div class="comm-niveles" id="niveles-${r.lider.id}" ${expandedLideres.has(r.lider.id) ? '' : 'hidden'}>
        ${r.niveles.map(n => construirBloqueNivel(r, n)).join('')}
      </div>

      <div class="comm-pago-block">
        <span>${r.estadoPago.estado === 'pagada'
          ? `Pagada el ${formatearFechaPersonas(r.estadoPago.fechaPago)} por ${escapeHTMLPersonas(r.estadoPago.registradoPor)} — ${fmtMoneyComm(r.estadoPago.montoPagado)}`
          : 'Sin registrar pago todavía. El pago se realiza por un proceso externo y se registra aquí manualmente.'}</span>
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
      <span>🎖️ <strong>Bono por rango — ${rangoLabel(b.rango)}</strong> (una sola vez, ascenso del ${formatearFechaPersonas(b.fechaAscenso)}): <strong>${fmtMoneyComm(b.monto)}</strong>. No se suma a la comisión — se paga aparte.</span>
      ${b.pagado
        ? `<span class="badge badge-pagada">Pagado el ${formatearFechaPersonas(b.fechaPago)} por ${escapeHTMLPersonas(b.registradoPor)}</span>`
        : `<button class="btn btn-outline" type="button" style="width:auto;" data-pagar-bono="${b.clave}" data-lider-bono="${r.lider.id}">Marcar como pagado</button>`}
    </div>
  `;
}

// ============================================================
// BLOQUE DE NIVEL
// ============================================================

function construirBloqueNivel(r, n) {
  const claveNivel = `${r.lider.id}-${n.nivel}`;
  const abierto = expandedNiveles.has(claveNivel);
  return `
    <div class="comm-nivel-block" data-nivel-block="${claveNivel}">
      <button type="button" class="comm-nivel-header ${abierto ? 'open' : ''}" data-toggle-nivel="${claveNivel}">
        <span>Nivel ${n.nivel} · ${n.pct}% · ${n.filas.length} persona${n.filas.length === 1 ? '' : 's'}</span>
        <span class="comm-nivel-total">${fmtMoneyComm(n.totalNivel)} <span class="comm-nivel-chevron">▾</span></span>
      </button>
      <div class="comm-nivel-body" id="nivel-body-${claveNivel}" ${abierto ? '' : 'hidden'}>
        <div class="catalog-table-wrap comm-tabla-wrap">
          <table class="catalog-table">
            <thead>
              <tr>
                <th>Emprendedora</th>
                <th>Compra válida</th>
                <th>Souvenirs</th>
                <th>Base comisión</th>
                <th>%</th>
                <th>Comisión calculada</th>
                <th>Ajuste manual</th>
                <th>Comisión final</th>
              </tr>
            </thead>
            <tbody>
              ${n.filas.length ? n.filas.map(f => construirFilaComisionHTML(r.lider.id, f)).join('') : `
                <tr><td colspan="8" class="catalog-empty-cell">Todavía no hay integrantes en este nivel.</td></tr>
              `}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function construirFilaComisionHTML(liderId, f) {
  const ajustada = !!f.ajuste;
  const diferencia = ajustada ? f.comisionFinal - f.comisionCalculada : 0;
  return `
    <tr data-fila-persona="${f.persona.id}" data-clave="${f.clave}">
      <td>${escapeHTMLPersonas(nombreCompletoPersona(f.persona))}</td>
      <td>${fmtMoneyComm(f.compraNormal)}</td>
      <td>${f.compraSouvenir > 0 ? `${fmtMoneyComm(f.compraSouvenir)} <span style="color:var(--mw-text-muted);">(no comisiona)</span>` : '—'}</td>
      <td>${fmtMoneyComm(f.base)}</td>
      <td>${f.pct}%</td>
      <td>${fmtMoneyComm(f.comisionCalculada)}</td>
      <td>
        ${ajustada ? `${diferencia >= 0 ? '+' : ''}${fmtMoneyComm(diferencia)}` : '—'}
        ${ajustada ? `<button type="button" class="comm-icon-btn" data-restaurar="${f.clave}" data-lider="${liderId}" data-persona="${f.persona.id}" title="Restaurar cálculo automático">↺</button>` : ''}
        <button type="button" class="comm-icon-btn" data-historial="${f.clave}" data-lider="${liderId}" data-persona="${f.persona.id}" title="Ver historial de cambios">🕘</button>
      </td>
      <td class="comm-celda-editable ${ajustada ? 'ajustado' : 'calc'}"
          data-editable-comision
          data-clave="${f.clave}"
          data-lider="${liderId}"
          data-persona="${f.persona.id}"
          data-calculada="${f.comisionCalculada}"
          data-final="${f.comisionFinal}"
          tabindex="0">${fmtMoneyComm(f.comisionFinal)}</td>
    </tr>
  `;
}

// ============================================================
// EVENTOS DE LA TABLA
// ============================================================

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

  document.querySelectorAll('[data-restaurar]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      confirmarRestaurarCalculo(btn.getAttribute('data-lider'), btn.getAttribute('data-persona'));
    });
  });

  document.querySelectorAll('[data-historial]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      abrirHistorialAjuste(btn.getAttribute('data-lider'), btn.getAttribute('data-persona'));
    });
  });

  document.querySelectorAll('[data-registrar-pago]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalPago(btn.getAttribute('data-registrar-pago')));
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
      subPeriodo: subPeriodoActual,
      valorCalculado: calculada,
      valorNuevo: nuevoValor,
      motivo: '',
      usuarioAdminId: ADMIN_IDENTIDAD.usuarioId,
      usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre
    };

    td.dataset.final = nuevoValor;
    td.innerHTML = fmtMoneyComm(nuevoValor);
    td.className = 'comm-celda-editable ajustado';

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

function confirmarRestaurarCalculo(liderId, personaId) {
  abrirAutorizacionAdmin({
    titulo: 'Restaurar cálculo automático',
    mensaje: 'Se eliminará el ajuste manual de esta comisión y volverá a mostrarse el valor calculado automáticamente. Esta acción queda registrada.',
    onConfirmar: () => {
      delete pendienteBorrador[construirClaveAjuste(liderId, personaId, periodoActual, subPeriodoActual)];
      restaurarCalculoAutomatico({
        liderId, emprendedoraId: personaId, periodoKey: periodoActual, subPeriodo: subPeriodoActual,
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

function abrirHistorialAjuste(liderId, personaId) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const historial = obtenerHistorialAjustePersona(liderId, personaId, periodoActual, subPeriodoActual);
  const persona = obtenerPersonaPorId(personaId);

  box.style.maxWidth = '480px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">🕘</div>
    <h3>Historial de ajustes</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombreCompletoPersona(persona || {}))} · ${formatearPeriodoLabelComisiones(periodoActual)} · ${subPeriodoActual === 'p1' ? 'Periodo 1' : 'Periodo 2'}</p>
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
// PAGO DE COMISIÓN
// ============================================================

function abrirModalPago(liderId) {
  const r = comisionesData.find(x => x.lider.id === liderId);
  if (!r) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  if (r.estadoPago.estado === 'pagada') {
    box.style.maxWidth = '420px';
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="auth-icon">✓</div>
      <h3>Pago registrado</h3>
      <div class="detail-grid">
        <div><span>Fecha de pago</span><strong>${formatearFechaPersonas(r.estadoPago.fechaPago)}</strong></div>
        <div><span>Registrado por</span><strong>${escapeHTMLPersonas(r.estadoPago.registradoPor)}</strong></div>
        <div><span>Monto pagado</span><strong>${fmtMoneyComm(r.estadoPago.montoPagado)}</strong></div>
        <div><span>Periodo</span><strong>${r.estadoPago.periodo}</strong></div>
      </div>
    `;
    overlay.classList.add('open');
    return;
  }

  const sugerido = (r.totalComision + (r.bono && !r.bono.pagado ? 0 : 0)).toFixed(2);

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">$</div>
    <h3>Registrar pago de comisión</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombreCompletoPersona(r.lider))} · ${formatearPeriodoLabelComisiones(periodoActual)} · ${subPeriodoActual === 'p1' ? 'Periodo 1' : 'Periodo 2'}</p>
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
        <div style="font-family:Cinzel,serif;font-size:18px;color:#5E1A8A;letter-spacing:1px;">MW JOYERÍA</div>
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
