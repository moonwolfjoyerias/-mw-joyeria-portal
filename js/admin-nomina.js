// MW JOYERÍA — Admin: Nómina
//
// Solo aplica a empleados con sueldo (Staff, RH, Administrativo) — no
// toca Emprendedoras/Líderes (Comisiones/Plan MW). Reutiliza el mismo
// patrón de edición estilo Excel, autoguardado y trazabilidad que ya
// se construyó para Comisiones (js/admin-comisiones.js) y
// Configuración (js/admin-configuracion.js) — mismas clases CSS
// (.comm-sync-pill → aquí .cfg-sync-pill, .ct-detail-list, etc.).

let nomVista = 'lista';
let nomDatosTab = 'empleados';
let nomPeriodoActual = obtenerPeriodoActualNomina();
let nomEmpleadoActualId = null;
let nomPeriodoEnEdicion = null;
let nomPendienteCambios = []; // [{filaId, concepto, campo, valorAnterior, valorNuevo}]
let nomTimerAutoguardado = null;
let nomFiltroTexto = '';
let nomFiltroEstado = 'todos';
let nomFiltroCargo = 'todos';

document.addEventListener('DOMContentLoaded', () => {

  revisarBorradorNominaAlCargar();
  renderSelectorPeriodoNomina();
  renderVistaActualNomina();

  document.querySelectorAll('#nomNavPrincipal [data-nom-vista]').forEach(btn => {
    btn.addEventListener('click', () => {
      nomVista = btn.getAttribute('data-nom-vista');
      document.querySelectorAll('#nomNavPrincipal [data-nom-vista]').forEach(b => b.classList.toggle('active', b === btn));
      document.getElementById('nomVistaLista').hidden = nomVista !== 'lista';
      document.getElementById('nomVistaDetalle').hidden = nomVista !== 'detalle';
      document.getElementById('nomVistaDatos').hidden = nomVista !== 'datos';
      renderVistaActualNomina();
    });
  });

  document.getElementById('nomBuscarInput')?.addEventListener('input', (e) => {
    nomFiltroTexto = e.target.value.trim().toLowerCase();
    renderTablaPrincipalNomina();
  });
  document.getElementById('nomFiltroEstado')?.addEventListener('change', (e) => {
    nomFiltroEstado = e.target.value;
    renderTablaPrincipalNomina();
  });
  document.getElementById('nomFiltroCargo')?.addEventListener('change', (e) => {
    nomFiltroCargo = e.target.value;
    renderTablaPrincipalNomina();
  });
  document.getElementById('nomPeriodoSelect')?.addEventListener('change', (e) => {
    nomPeriodoActual = e.target.value;
  });

  document.getElementById('nomRecuperarBtn')?.addEventListener('click', recuperarBorradorNomina);
  document.getElementById('nomDescartarBtn')?.addEventListener('click', () => {
    descartarBorradorNomina();
    document.getElementById('nomRecuperarBanner').hidden = true;
  });

  window.addEventListener('online', () => { actualizarPillNomina(); sincronizarNomina(); });
  window.addEventListener('offline', () => actualizarPillNomina());

});

function renderVistaActualNomina() {
  if (nomVista === 'lista') renderTablaPrincipalNomina();
  else if (nomVista === 'datos') renderVistaDatosNomina();
}

// ============================================================
// AUTOGUARDADO
// ============================================================

function revisarBorradorNominaAlCargar() {
  const borrador = obtenerBorradorNomina();
  if (borrador && borrador.periodo && borrador.cambios?.length) {
    document.getElementById('nomRecuperarBanner').hidden = false;
  }
}

function recuperarBorradorNomina() {
  const borrador = obtenerBorradorNomina();
  if (!borrador) return;

  (borrador.cambios || []).forEach(c => {
    registrarAjusteNomina({
      empleadoId: borrador.empleadoId,
      periodoKey: borrador.periodoKey,
      concepto: c.concepto,
      campo: c.campo,
      valorAnterior: c.valorAnterior,
      valorNuevo: c.valorNuevo,
      usuarioAdminId: ADMIN_IDENTIDAD.usuarioId,
      usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre,
      motivo: 'Recuperado de un borrador local sin sincronizar'
    });
  });
  guardarPeriodoNomina(borrador.periodo);
  descartarBorradorNomina();

  document.getElementById('nomRecuperarBanner').hidden = true;
  mostrarToast('Cambios recuperados y sincronizados.');

  // El borrador pudo haberse guardado antes de recargar la página, así que
  // nomVista/nomEmpleadoActualId ya no reflejan dónde estaba el admin —
  // hay que llevarlo de vuelta al detalle recuperado para que vea el resultado.
  nomEmpleadoActualId = borrador.empleadoId;
  nomPeriodoActual = borrador.periodoKey;
  nomVista = 'detalle';
  document.querySelectorAll('#nomNavPrincipal [data-nom-vista]').forEach(b => b.classList.remove('active'));
  document.getElementById('nomVistaLista').hidden = true;
  document.getElementById('nomVistaDetalle').hidden = false;
  document.getElementById('nomVistaDatos').hidden = true;
  renderVistaDetalleNomina();
}

function programarAutoguardadoNomina() {
  actualizarPillNomina('guardando');
  try {
    guardarBorradorNomina({ empleadoId: nomEmpleadoActualId, periodoKey: nomPeriodoActual, periodo: nomPeriodoEnEdicion, cambios: nomPendienteCambios });
  } catch (error) {
    actualizarPillNomina('error');
    return;
  }
  clearTimeout(nomTimerAutoguardado);
  nomTimerAutoguardado = setTimeout(sincronizarNomina, 600);
}

function sincronizarNomina() {
  if (!navigator.onLine) { actualizarPillNomina(); return; }
  if (!nomPeriodoEnEdicion || !nomPendienteCambios.length) { actualizarPillNomina(); return; }

  nomPendienteCambios.forEach(c => {
    registrarAjusteNomina({
      empleadoId: nomEmpleadoActualId,
      periodoKey: nomPeriodoActual,
      concepto: c.concepto,
      campo: c.campo,
      valorAnterior: c.valorAnterior,
      valorNuevo: c.valorNuevo,
      usuarioAdminId: ADMIN_IDENTIDAD.usuarioId,
      usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre
    });
  });
  nomPendienteCambios = [];
  guardarPeriodoNomina(nomPeriodoEnEdicion);
  descartarBorradorNomina();
  actualizarPillNomina();
  renderResumenTotalesNomina();
}

function actualizarPillNomina(modo) {
  const pill = document.getElementById('nomSyncPill');
  if (!pill) return;

  if (modo === 'error') {
    pill.textContent = '🔴 Error de sincronización';
    pill.className = 'cfg-sync-pill error';
    return;
  }
  if (!navigator.onLine) {
    pill.textContent = '🟠 Cambios guardados localmente — esperando conexión';
    pill.className = 'cfg-sync-pill offline';
    return;
  }
  if (modo === 'guardando') {
    pill.textContent = '🟡 Guardando...';
    pill.className = 'cfg-sync-pill guardando';
    return;
  }
  pill.textContent = '🟢 Guardado';
  pill.className = 'cfg-sync-pill ok';
}

// ============================================================
// FORMATO
// ============================================================

function fmtMoneyNomina(n) {
  return `$${Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatearFechaNomina(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO.length <= 10 ? `${fechaISO}T00:00:00` : fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatearFechaHoraNomina(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function obtenerInicialesNomina(nombre) {
  return String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

function construirAvatarEmpleadoNomina(empleado, estilos = '') {
  const contenido = empleado.fotoUrl
    ? `<img src="${escapeHTMLNomina(empleado.fotoUrl)}" alt="Foto de ${escapeHTMLNomina(empleado.nombre)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : escapeHTMLNomina(obtenerInicialesNomina(empleado.nombre));
  return `<span class="profile-avatar" style="${estilos}overflow:hidden;">${contenido}</span>`;
}

function escapeHTMLNomina(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// SELECTOR DE PERIODO (toolbar)
// ============================================================

function renderSelectorPeriodoNomina() {
  const select = document.getElementById('nomPeriodoSelect');
  if (!select) return;

  const periodos = [];
  const lunesActual = obtenerLunesDeSemana();
  for (let i = 0; i < 10; i++) {
    const lunes = new Date(lunesActual);
    lunes.setDate(lunes.getDate() - 7 * i);
    periodos.push(periodoKeyDeLunes(lunes));
  }

  select.innerHTML = periodos.map(p => `<option value="${p}">${formatearRangoSemanaNomina(p)}</option>`).join('');
  select.value = nomPeriodoActual;
}

// ============================================================
// VISTA: LISTA PRINCIPAL
// ============================================================

function renderTablaPrincipalNomina() {

  const cont = document.getElementById('nomTablaPrincipalBody');
  if (!cont) return;

  let empleados = obtenerEmpleadosNomina();

  if (nomFiltroEstado === 'activos') empleados = empleados.filter(e => e.estado === 'activo');
  if (nomFiltroEstado === 'inactivos') empleados = empleados.filter(e => e.estado === 'inactivo');
  if (nomFiltroCargo !== 'todos') empleados = empleados.filter(e => e.cargo === nomFiltroCargo);

  if (nomFiltroTexto) {
    empleados = empleados.filter(e =>
      e.nombre.toLowerCase().includes(nomFiltroTexto) ||
      e.numeroEmpleado.toLowerCase().includes(nomFiltroTexto) ||
      (CARGOS_NOMINA[e.cargo] || '').toLowerCase().includes(nomFiltroTexto)
    );
  }

  if (!empleados.length) {
    cont.innerHTML = `<tr><td colspan="4" class="catalog-empty-cell">No se encontraron empleados con ese filtro.</td></tr>`;
    return;
  }

  cont.innerHTML = empleados.map(e => `
    <tr>
      <td><strong>${escapeHTMLNomina(e.nombre)}</strong> <span class="catalog-product-id">${escapeHTMLNomina(e.numeroEmpleado)}</span></td>
      <td>${escapeHTMLNomina(CARGOS_NOMINA[e.cargo] || e.cargo)}</td>
      <td><span class="badge ${e.estado === 'activo' ? 'badge-pagada' : 'badge-pendiente'}">${ESTADOS_EMPLEADO_NOMINA[e.estado] || e.estado}</span></td>
      <td><button class="btn btn-outline" style="width:auto;" data-nom-ver-detalle="${e.id}" type="button">Ver detalles →</button></td>
    </tr>
  `).join('');

  cont.querySelectorAll('[data-nom-ver-detalle]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleEmpleadoNomina(btn.getAttribute('data-nom-ver-detalle')));
  });

}

function abrirDetalleEmpleadoNomina(empleadoId) {
  nomEmpleadoActualId = empleadoId;
  nomVista = 'detalle';
  document.querySelectorAll('#nomNavPrincipal [data-nom-vista]').forEach(b => b.classList.remove('active'));
  document.getElementById('nomVistaLista').hidden = true;
  document.getElementById('nomVistaDetalle').hidden = false;
  document.getElementById('nomVistaDatos').hidden = true;
  renderVistaDetalleNomina();
}

// ============================================================
// VISTA: DETALLE DE EMPLEADO
// ============================================================

function renderVistaDetalleNomina() {

  const cont = document.getElementById('nomVistaDetalle');
  const empleado = obtenerEmpleadoNominaPorId(nomEmpleadoActualId);
  if (!cont || !empleado) return;

  nomPeriodoEnEdicion = obtenerPeriodoNomina(empleado.id, nomPeriodoActual);
  nomPendienteCambios = [];

  const semanas = obtenerSemanasDisponibles(empleado.id);

  cont.innerHTML = `
    <button class="btn btn-outline" id="nomVolverBtn" style="width:auto;margin-bottom:1rem;" type="button">← Volver a la lista</button>

    <div class="dash-two-col">
      <div class="cfg-card" style="margin-bottom:0;">
        <div style="display:flex;gap:14px;align-items:center;">
          ${construirAvatarEmpleadoNomina(empleado, 'width:56px;height:56px;font-size:1.2rem;flex-shrink:0;')}
          <div>
            <h3 class="cfg-card-title" style="margin-bottom:4px;">${escapeHTMLNomina(empleado.nombre)}</h3>
            <span class="badge ${empleado.estado === 'activo' ? 'badge-pagada' : 'badge-pendiente'}">${escapeHTMLNomina(CARGOS_NOMINA[empleado.cargo])} · ${escapeHTMLNomina(ESTADOS_EMPLEADO_NOMINA[empleado.estado])}</span>
          </div>
        </div>
        <div class="detail-grid" style="margin-top:14px;">
          <div><span>Número de empleado</span><strong>${escapeHTMLNomina(empleado.numeroEmpleado)}</strong></div>
          <div><span>Fecha de inicio</span><strong>${formatearFechaNomina(empleado.fechaInicio)}</strong></div>
          <div><span>Salario base semanal</span><strong>${fmtMoneyNomina(empleado.salarioBase)}</strong></div>
          <div><span>Pago por hora extra</span><strong>${fmtMoneyNomina(empleado.pagoHoraExtra)}</strong></div>
          ${empleado.fechaBaja ? `<div><span>Fecha de baja</span><strong>${formatearFechaNomina(empleado.fechaBaja)}</strong></div>` : ''}
        </div>
      </div>

      <div class="cfg-card" style="margin-bottom:0;">
        <h3 class="cfg-card-title">Nómina — ${formatearRangoSemanaNomina(nomPeriodoActual)}</h3>
        <p class="cfg-card-sub" id="nomEstadoPagoTexto"></p>

        <div class="catalog-table-wrap comm-tabla-wrap">
          <table class="catalog-table" id="nomTablaConceptos">
            <thead><tr><th>Concepto</th><th>Cantidad</th><th>Importe</th><th>Tipo</th><th>Total</th></tr></thead>
            <tbody id="nomTablaConceptosBody"></tbody>
          </table>
        </div>
        <button class="btn btn-outline" id="nomAgregarConceptoBtn" type="button" style="width:auto;margin-top:10px;">+ Agregar concepto</button>

        <div id="nomResumenTotales" class="nom-resumen-totales"></div>

        <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn btn-outline" id="nomVerHistorialBtn" type="button" style="width:auto;">🕘 Historial de ajustes</button>
          <button class="btn btn-outline" id="nomRegistrarPagoBtn" type="button" style="width:auto;">Registrar pago</button>
          <button class="btn btn-primary" id="nomGenerarPdfBtn" type="button" style="width:auto;">📊 Generar comprobante</button>
        </div>
      </div>
    </div>

    <div class="cfg-card" style="margin-top:1.1rem;">
      <h3 class="cfg-card-title">Historial de semanas</h3>
      <p class="cfg-card-sub">Todas las semanas se conservan, aunque el empleado sea dado de baja.</p>
      <div class="nom-semanas-lista" id="nomHistorialSemanas">
        ${semanas.map(s => {
          const p = obtenerPeriodosNomina()[`${empleado.id}__${s}`];
          const pagada = p?.estadoPago?.estado === 'pagada';
          return `<button type="button" class="nom-semana-chip ${s === nomPeriodoActual ? 'activa' : ''}" data-nom-semana="${s}">${formatearRangoSemanaNomina(s)} ${p ? `<span class="badge ${pagada ? 'badge-pagada' : 'badge-pendiente'}">${pagada ? 'Pagada' : 'Pendiente'}</span>` : '<span class="badge">Sin capturar</span>'}</button>`;
        }).join('')}
      </div>
    </div>
  `;

  document.getElementById('nomVolverBtn').addEventListener('click', () => {
    nomVista = 'lista';
    document.querySelectorAll('#nomNavPrincipal [data-nom-vista]').forEach(b => b.classList.toggle('active', b.getAttribute('data-nom-vista') === 'lista'));
    document.getElementById('nomVistaLista').hidden = false;
    document.getElementById('nomVistaDetalle').hidden = true;
    renderTablaPrincipalNomina();
  });

  cont.querySelectorAll('[data-nom-semana]').forEach(btn => {
    btn.addEventListener('click', () => {
      nomPeriodoActual = btn.getAttribute('data-nom-semana');
      document.getElementById('nomPeriodoSelect').value = nomPeriodoActual;
      renderVistaDetalleNomina();
    });
  });

  document.getElementById('nomAgregarConceptoBtn').addEventListener('click', abrirModalAgregarConceptoFila);
  document.getElementById('nomVerHistorialBtn').addEventListener('click', abrirModalHistorialAjustesNomina);
  document.getElementById('nomRegistrarPagoBtn').addEventListener('click', abrirModalRegistrarPagoNomina);
  document.getElementById('nomGenerarPdfBtn').addEventListener('click', generarComprobanteNomina);

  renderTablaConceptosNomina();
  renderResumenTotalesNomina();

}

function renderTablaConceptosNomina() {

  const body = document.getElementById('nomTablaConceptosBody');
  if (!body || !nomPeriodoEnEdicion) return;

  body.innerHTML = nomPeriodoEnEdicion.conceptos.map(fila => `
    <tr data-fila-id="${fila.filaId}">
      <td>${escapeHTMLNomina(fila.nombre)}${fila.conceptoId === 'sueldo_base' || fila.conceptoId === 'horas_extra' ? '' : ` <button type="button" class="comm-icon-btn" data-nom-eliminar-fila="${fila.filaId}" title="Eliminar concepto">🗑</button>`}</td>
      <td class="nom-celda-editable" data-fila-id="${fila.filaId}" data-campo="cantidad" tabindex="0">${fila.cantidad}</td>
      <td class="nom-celda-editable" data-fila-id="${fila.filaId}" data-campo="importe" tabindex="0">${fmtMoneyNomina(fila.importe)}</td>
      <td><span class="badge ${fila.tipo === 'percepcion' ? 'badge-pagada' : 'badge-pendiente'}">${fila.tipo === 'percepcion' ? 'Percepción' : 'Deducción'}</span></td>
      <td><strong>${fmtMoneyNomina(fila.total)}</strong></td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-nom-eliminar-fila]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarFilaConceptoNomina(btn.getAttribute('data-nom-eliminar-fila'));
    });
  });

  wireCeldasEditablesNomina(body);

}

function renderResumenTotalesNomina() {
  const cont = document.getElementById('nomResumenTotales');
  const textoEstado = document.getElementById('nomEstadoPagoTexto');
  if (!cont || !nomPeriodoEnEdicion) return;

  const totales = calcularTotalesPeriodo(nomPeriodoEnEdicion.conceptos);
  Object.assign(nomPeriodoEnEdicion, totales);

  cont.innerHTML = `
    <div class="nom-total-fila"><span>Percepciones</span><strong>${fmtMoneyNomina(totales.totalPercepciones)}</strong></div>
    <div class="nom-total-fila"><span>Deducciones</span><strong>-${fmtMoneyNomina(totales.totalDeducciones)}</strong></div>
    <div class="nom-total-fila nom-total-final"><span>TOTAL A PAGAR</span><strong>${fmtMoneyNomina(totales.totalAPagar)}</strong></div>
  `;

  const estadoPago = nomPeriodoEnEdicion.estadoPago || { estado: 'pendiente' };
  if (textoEstado) {
    textoEstado.textContent = estadoPago.estado === 'pagada'
      ? `Pagada el ${formatearFechaNomina(estadoPago.fechaPago)} por ${estadoPago.registradoPor} — ${fmtMoneyNomina(estadoPago.montoPagado)}`
      : 'Periodo pendiente de pago.';
  }
}

// ============================================================
// EDICIÓN ESTILO EXCEL (mismo patrón que Comisiones/Configuración)
// ============================================================

function obtenerCeldasEditablesNominaOrdenadas() {
  return Array.from(document.querySelectorAll('#nomTablaConceptosBody [data-fila-id]'))
    .map(tr => Array.from(tr.querySelectorAll('.nom-celda-editable')))
    .flat();
}

function wireCeldasEditablesNomina(body) {
  body.querySelectorAll('.nom-celda-editable').forEach(td => {
    td.addEventListener('click', () => activarEdicionCeldaNomina(td));
    td.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activarEdicionCeldaNomina(td); }
    });
  });
}

function activarEdicionCeldaNomina(td) {
  if (td.querySelector('input')) return;
  const filaId = td.dataset.filaId;
  const campo = td.dataset.campo;
  const fila = nomPeriodoEnEdicion.conceptos.find(f => f.filaId === filaId);
  if (!fila) return;

  td.innerHTML = `<input type="number" step="0.01" value="${fila[campo]}">`;
  const input = td.querySelector('input');
  input.focus();
  input.select();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaNomina(td, 'commit');
      moverASiguienteCeldaNomina(td);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaNomina(td, 'commit');
      moverASiguienteCeldaNomina(td, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaNomina(td, 'cancel');
    }
  });

  input.addEventListener('blur', () => finalizarEdicionCeldaNomina(td, 'commit'));
}

// Mismo candado de reentrancia que Comisiones/Configuración: reemplazar
// el <input> por texto dispara un 'blur' síncrono sobre el mismo input
// que, sin este candado, volvería a llamar aquí a la mitad de la
// primera mutación del DOM.
function finalizarEdicionCeldaNomina(td, modo) {
  if (td.dataset.cerrando === '1') return;
  const input = td.querySelector('input');
  if (!input) return;

  td.dataset.cerrando = '1';
  try {

    const filaId = td.dataset.filaId;
    const campo = td.dataset.campo;
    const fila = nomPeriodoEnEdicion.conceptos.find(f => f.filaId === filaId);
    if (!fila) return;

    if (modo === 'cancel') {
      pintarCeldaNomina(td, fila[campo], campo);
      return;
    }

    const nuevoValor = parseFloat(input.value);
    if (Number.isNaN(nuevoValor)) {
      pintarCeldaNomina(td, fila[campo], campo);
      return;
    }

    const valorAnterior = fila[campo];
    if (nuevoValor === valorAnterior) {
      pintarCeldaNomina(td, valorAnterior, campo);
      return;
    }

    fila[campo] = nuevoValor;
    fila.total = fila.cantidad * fila.importe;
    pintarCeldaNomina(td, nuevoValor, campo);

    const filaTr = td.closest('tr');
    if (filaTr) {
      const tdTotal = filaTr.children[4];
      if (tdTotal) tdTotal.innerHTML = `<strong>${fmtMoneyNomina(fila.total)}</strong>`;
    }

    nomPendienteCambios.push({ filaId, concepto: fila.nombre, campo, valorAnterior, valorNuevo: nuevoValor });
    programarAutoguardadoNomina();
    renderResumenTotalesNomina();

  } finally {
    delete td.dataset.cerrando;
  }
}

function pintarCeldaNomina(td, valor, campo) {
  td.innerHTML = campo === 'importe' ? fmtMoneyNomina(valor) : String(valor);
}

function moverASiguienteCeldaNomina(tdActual, direccion = 1) {
  const celdas = obtenerCeldasEditablesNominaOrdenadas();
  const idx = celdas.indexOf(tdActual);
  if (idx === -1) return;
  const siguiente = celdas[idx + direccion];
  if (siguiente) {
    siguiente.focus();
    activarEdicionCeldaNomina(siguiente);
  }
}

function eliminarFilaConceptoNomina(filaId) {
  const fila = nomPeriodoEnEdicion.conceptos.find(f => f.filaId === filaId);
  if (!fila) return;

  abrirAutorizacionAdmin({
    titulo: 'Eliminar concepto',
    mensaje: `Vas a eliminar "${escapeHTMLNomina(fila.nombre)}" (${fmtMoneyNomina(fila.total)}) de esta semana.`,
    onConfirmar: () => {
      nomPeriodoEnEdicion.conceptos = nomPeriodoEnEdicion.conceptos.filter(f => f.filaId !== filaId);
      nomPendienteCambios.push({ filaId, concepto: fila.nombre, campo: 'eliminado', valorAnterior: fila.total, valorNuevo: 0 });
      programarAutoguardadoNomina();
      renderTablaConceptosNomina();
      renderResumenTotalesNomina();
      mostrarToast('Concepto eliminado.');
    }
  });
}

function abrirModalAgregarConceptoFila() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const conceptosDisponibles = obtenerConceptosNomina().filter(c => c.activo && !c.fijo);

  box.style.maxWidth = '400px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">＋</div>
    <h3>Agregar concepto</h3>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Concepto
        <select id="nomNuevoConceptoId">
          ${conceptosDisponibles.map(c => {
            const tipoLabel = c.tipo === 'percepcion' ? 'Percepción' : 'Deducción';
            const nombreIncluyeTipo = c.nombre.toLowerCase().includes(`(${tipoLabel.toLowerCase()})`);
            const etiqueta = nombreIncluyeTipo ? c.nombre : `${c.nombre} (${tipoLabel})`;
            return `<option value="${c.id}">${escapeHTMLNomina(etiqueta)}</option>`;
          }).join('')}
        </select>
      </label>
      <label>Cantidad<input type="number" step="0.01" id="nomNuevaCantidad" value="1"></label>
      <label>Importe<input type="number" step="0.01" id="nomNuevoImporte" value="0"></label>
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomCancelarAgregarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="nomConfirmarAgregarBtn" type="button">Agregar</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomCancelarAgregarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomConfirmarAgregarBtn')?.addEventListener('click', () => {

    const conceptoId = document.getElementById('nomNuevoConceptoId').value;
    const concepto = obtenerConceptoNominaPorId(conceptoId);
    if (!concepto) return;

    const cantidad = parseFloat(document.getElementById('nomNuevaCantidad').value) || 0;
    const importe = parseFloat(document.getElementById('nomNuevoImporte').value) || 0;
    const total = cantidad * importe;

    const nuevaFila = {
      filaId: `fila-${Date.now()}`,
      conceptoId: concepto.id,
      nombre: concepto.nombre,
      tipo: concepto.tipo,
      cantidad,
      importe,
      total
    };

    nomPeriodoEnEdicion.conceptos.push(nuevaFila);
    nomPendienteCambios.push({ filaId: nuevaFila.filaId, concepto: nuevaFila.nombre, campo: 'agregado', valorAnterior: 0, valorNuevo: total });
    programarAutoguardadoNomina();

    cerrar();
    renderTablaConceptosNomina();
    renderResumenTotalesNomina();
    mostrarToast('Concepto agregado.');

  });

}

// ============================================================
// HISTORIAL DE AJUSTES
// ============================================================

function abrirModalHistorialAjustesNomina() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const historial = obtenerHistorialAjustesPeriodo(nomEmpleadoActualId, nomPeriodoActual);

  box.style.maxWidth = '480px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">🕘</div>
    <h3>Historial de ajustes</h3>
    <p class="modal-sub">${formatearRangoSemanaNomina(nomPeriodoActual)}</p>
    ${historial.length ? `
      <div class="ct-detail-list" style="border-bottom:0;">
        ${historial.map(h => `
          <div class="ct-detail-row">
            <div>
              <strong>${escapeHTMLNomina(h.concepto)} — ${h.campo}</strong>
              <span class="ct-detail-sub">${h.valorAnterior} → ${h.valorNuevo} · ${formatearFechaHoraNomina(h.fecha)} · ${escapeHTMLNomina(h.usuarioAdminNombre || h.usuarioAdminId)}${h.motivo ? ` · ${escapeHTMLNomina(h.motivo)}` : ''}</span>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<p class="bp-sub" style="margin:0;">Todavía no hay ajustes registrados en esta semana.</p>`}
  `;
  overlay.classList.add('open');
  box.querySelector('[data-close]')?.addEventListener('click', () => overlay.classList.remove('open'));

}

// ============================================================
// REGISTRAR PAGO
// ============================================================

function abrirModalRegistrarPagoNomina() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  const empleado = obtenerEmpleadoNominaPorId(nomEmpleadoActualId);
  if (!overlay || !box || !empleado) return;

  if (nomPeriodoEnEdicion.estadoPago?.estado === 'pagada') {
    const ep = nomPeriodoEnEdicion.estadoPago;
    box.style.maxWidth = '400px';
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <div class="auth-icon">✓</div>
      <h3>Pago registrado</h3>
      <div class="detail-grid">
        <div><span>Fecha de pago</span><strong>${formatearFechaNomina(ep.fechaPago)}</strong></div>
        <div><span>Registrado por</span><strong>${escapeHTMLNomina(ep.registradoPor)}</strong></div>
        <div><span>Monto pagado</span><strong>${fmtMoneyNomina(ep.montoPagado)}</strong></div>
      </div>
    `;
    overlay.classList.add('open');
    box.querySelector('[data-close]')?.addEventListener('click', () => overlay.classList.remove('open'));
    return;
  }

  guardarPeriodoNomina(nomPeriodoEnEdicion); // asegura que exista antes de poder pagarlo

  box.style.maxWidth = '400px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">$</div>
    <h3>Registrar pago de nómina</h3>
    <p class="modal-sub">${escapeHTMLNomina(empleado.nombre)} · ${formatearRangoSemanaNomina(nomPeriodoActual)}</p>
    <label class="cfg-field-label">Monto pagado</label>
    <input type="number" step="0.01" id="nomMontoPagoInput" value="${nomPeriodoEnEdicion.totalAPagar.toFixed(2)}">
    <div class="modal-note"><strong>Recordatorio.</strong> El pago se realiza por un proceso externo; aquí solo se registra que ya ocurrió.</div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomCancelarPagoBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="nomConfirmarPagoBtn" type="button">Registrar pago</button>
    </div>
  `;
  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomCancelarPagoBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomConfirmarPagoBtn')?.addEventListener('click', () => {
    const monto = parseFloat(document.getElementById('nomMontoPagoInput').value);
    if (Number.isNaN(monto) || monto <= 0) return;
    const resultado = registrarPagoNomina(nomEmpleadoActualId, nomPeriodoActual, { montoPagado: monto, registradoPor: ADMIN_IDENTIDAD.usuarioNombre });
    if (resultado.ok) {
      nomPeriodoEnEdicion = resultado.periodo;
      cerrar();
      mostrarToast('Pago registrado.');
      renderVistaDetalleNomina();
    }
  });

}

// ============================================================
// PDF — COMPROBANTE DE PAGO
// ============================================================

function sanitizarNombreArchivoNomina(t) {
  return String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function generarComprobanteNomina() {

  const empleado = obtenerEmpleadoNominaPorId(nomEmpleadoActualId);
  if (!empleado) return;

  if (nomPendienteCambios.length) {
    abrirAutorizacionAdmin({
      titulo: 'Hay cambios sin sincronizar',
      mensaje: 'Este comprobante se generará antes de que algunos ajustes terminen de sincronizarse. Se recomienda esperar unos segundos. ¿Generar de todas formas?',
      peligrosa: true,
      onConfirmar: () => ejecutarGeneracionComprobanteNomina(empleado)
    });
    return;
  }

  guardarPeriodoNomina(nomPeriodoEnEdicion);
  ejecutarGeneracionComprobanteNomina(empleado);

}

async function ejecutarGeneracionComprobanteNomina(empleado) {

  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el comprobante — intenta de nuevo en un momento.');
    return;
  }

  try {
    const periodo = nomPeriodoEnEdicion || obtenerPeriodoNomina(empleado.id, nomPeriodoActual);
    if (!periodo) {
      mostrarToast('No se pudo generar el comprobante — no hay datos de nómina para este periodo.');
      return;
    }

    const contenedor = document.getElementById('nomPdfTemplate');
    contenedor.innerHTML = construirHTMLComprobanteNomina(empleado, periodo);

    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(contenedor, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      width: 820,
      height: 1100
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const w = canvas.width * ratio;
    const h = canvas.height * ratio;
    pdf.addImage(imgData, 'PNG', (pageWidth - w) / 2, 20, w, h);

    const nombreArchivo = sanitizarNombreArchivoNomina(empleado.nombre);
    const periodoArchivo = sanitizarNombreArchivoNomina(formatearRangoSemanaNomina(nomPeriodoActual));
    pdf.save(`MW_Nomina_${nombreArchivo}_${periodoArchivo}.pdf`);

    mostrarToast('Comprobante generado.');
  } catch (error) {
    console.error('Error generando comprobante de nómina:', error);
    mostrarToast('No se pudo generar el comprobante — intenta de nuevo en un momento.');
  } finally {
    const contenedor = document.getElementById('nomPdfTemplate');
    if (contenedor) contenedor.innerHTML = '';
  }

}

function construirHTMLComprobanteNomina(empleado, periodo) {

  const ahora = new Date();
  const percepciones = (periodo.conceptos || []).filter(c => c.tipo === 'percepcion');
  const deducciones = (periodo.conceptos || []).filter(c => c.tipo === 'deduccion');
  const estadoPago = periodo.estadoPago || { estado: 'pendiente' };

  const filaConcepto = (c, tipo) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #efe3f3;font-size:11px;color:#2a2230;text-align:left;">${escapeHTMLNomina(c.nombre)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #efe3f3;font-size:11px;color:#2a2230;text-align:right;">${tipo === 'percepcion' ? fmtMoneyNomina(c.total) : `-${fmtMoneyNomina(c.total)}`}</td>
    </tr>
  `;

  return `
    <div style="width: 820px; min-height: 1100px; background: #ffffff; color: #2A2230; font-family: poppins, cinzel; padding: 24px 28px 20px; box-sizing: border-box; border: 1px solid #e8dff0;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 2px solid #6d2f83; padding-bottom: 16px; margin-bottom: 20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="../../assets/images/isotipo-morado.png" alt="MW" style="width:92px;height:46px;object-fit:contain;" />
          <div>
            <div style="font-size: 20px; font-weight: 700; color: #5E1A8A; letter-spacing: 1px;">MW JOYERÍA</div>
            <div style="font-size: 10px; color: #6B6270; letter-spacing: 1.5px; text-transform: uppercase;">Portal de nómina</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size: 10px; color: #6B6270; text-transform: uppercase; letter-spacing: 1.2px;">Recibo de pago</div>
          <div style="font-size: 22px; font-weight: 700; color: #2A2230; margin-top: 4px;">COMPROBANTE</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap: 18px; margin-bottom: 18px;">
        <div style="background:#f7f0fa; border:1px solid #ead7f1; border-radius:12px; padding:14px 16px;">
          <div style="font-size:11px; color:#6B6270; margin-bottom:6px; text-transform: uppercase; letter-spacing:0.8px;">Empleado</div>
          <div style="font-size:17px; font-weight:700; color:#2A2230;">${escapeHTMLNomina(empleado.nombre)}</div>
          <div style="font-size:12px; color:#4B4052; margin-top:6px;">${escapeHTMLNomina(CARGOS_NOMINA[empleado.cargo] || empleado.cargo)} · ${escapeHTMLNomina(empleado.numeroEmpleado)}</div>
        </div>
        <div style="background:#f7f0fa; border:1px solid #ead7f1; border-radius:12px; padding:14px 16px;">
          <div style="font-size:11px; color:#6B6270; margin-bottom:6px; text-transform: uppercase; letter-spacing:0.8px;">Periodo</div>
          <div style="font-size:14px; font-weight:700; color:#2A2230;">${formatearRangoSemanaNomina(periodo.periodoKey)}</div>
          <div style="font-size:12px; color:#4B4052; margin-top:6px;">Generado el ${ahora.toLocaleString('es-MX')}</div>
        </div>
      </div>

      <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px;">
        <div style="background:#fff; border:1px solid #ead7f1; border-radius:12px; overflow:hidden;">
          <div style="background:#5E1A8A; color:#fff; font-size:12px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; padding:10px 14px;">Percepciones</div>
          <table style="width:100%; border-collapse:collapse;">
            <tbody>
              ${percepciones.length ? percepciones.map(c => filaConcepto(c, 'percepcion')).join('') : '<tr><td style="padding:12px; color:#6B6270; font-size:11px;">Sin percepciones</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="background:#fff; border:1px solid #ead7f1; border-radius:12px; overflow:hidden;">
          <div style="background:#5E1A8A; color:#fff; font-size:12px; font-weight:700; letter-spacing:0.8px; text-transform:uppercase; padding:10px 14px;">Deducciones</div>
          <table style="width:100%; border-collapse:collapse;">
            <tbody>
              ${deducciones.length ? deducciones.map(c => filaConcepto(c, 'deduccion')).join('') : '<tr><td style="padding:12px; color:#6B6270; font-size:11px;">Sin deducciones</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div style="background:#f6eef8; border:1px solid #e8dff0; border-radius:12px; padding:14px 16px; margin-bottom: 18px;">
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#4B4052; margin-bottom: 8px;">
          <span>Percepciones</span>
          <strong style="color:#2A2230;">${fmtMoneyNomina(periodo.totalPercepciones)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px; color:#4B4052; margin-bottom: 8px;">
          <span>Deducciones</span>
          <strong style="color:#2A2230;">-${fmtMoneyNomina(periodo.totalDeducciones)}</strong>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:18px; font-weight:700; color:#5E1A8A; border-top:1px solid #d9c3e6; padding-top:10px;">
          <span>Total a pagar</span>
          <strong>${fmtMoneyNomina(periodo.totalAPagar)}</strong>
        </div>
      </div>

      <div style="display:flex; justify-content:space-between; gap:20px; margin-top:24px; margin-bottom: 30px;">
        <div style="flex:1; border-top:2px solid #d9c3e6; padding-top:8px;">
          <div style="font-size:10px; color:#6B6270; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">Estado</div>
          <div style="font-size:12px; color:#2A2230; font-weight:600;">${estadoPago.estado === 'pagada' ? `Pagado el ${formatearFechaNomina(estadoPago.fechaPago)}` : 'Pendiente de pago'}</div>
        </div>
        <div style="flex:1; border-top:2px solid #d9c3e6; padding-top:8px; text-align:center;">
          <div style="font-size:10px; color:#6B6270; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:12px;">Firma de recibido</div>
          <div style="height: 46px; border-bottom: 2px solid #2A2230; width: 90%; margin: 0 auto; opacity: 0.7;"></div>
        </div>
      </div>

      <div style="border-top:1px solid #eae4eb; padding-top:10px; font-size:9px; color:#6B6270; text-align:center;">
        Comprobante generado por Portal MW • Sin alteración del diseño original del machote.
      </div>
    </div>
  `;

}

// ============================================================
// VISTA: DATOS
// ============================================================

function renderVistaDatosNomina() {

  document.querySelectorAll('#nomNavDatos [data-nom-datos-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-nom-datos-tab') === nomDatosTab);
    btn.onclick = () => {
      nomDatosTab = btn.getAttribute('data-nom-datos-tab');
      document.getElementById('nomDatosEmpleados').hidden = nomDatosTab !== 'empleados';
      document.getElementById('nomDatosConceptos').hidden = nomDatosTab !== 'conceptos';
      document.getElementById('nomDatosSolicitudes').hidden = nomDatosTab !== 'solicitudes';
      renderVistaDatosNomina();
    };
  });

  document.getElementById('nomDatosEmpleados').hidden = nomDatosTab !== 'empleados';
  document.getElementById('nomDatosConceptos').hidden = nomDatosTab !== 'conceptos';
  document.getElementById('nomDatosSolicitudes').hidden = nomDatosTab !== 'solicitudes';

  if (nomDatosTab === 'empleados') renderDatosEmpleados();
  else if (nomDatosTab === 'conceptos') renderDatosConceptos();
  else renderDatosSolicitudes();

}

// ---------- Empleados ----------

function renderDatosEmpleados() {

  const cont = document.getElementById('nomDatosEmpleados');
  const empleados = obtenerEmpleadosNomina();

  cont.innerHTML = `
    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 class="cfg-card-title" style="margin-bottom:0.15rem;">Empleados</h3>
          <p class="cfg-card-sub" style="margin-bottom:0;">Alta/baja directa (uso administrativo). Para el flujo con aprobación, usa la pestaña Solicitudes.</p>
        </div>
        <button class="btn btn-primary" id="nomAgregarEmpleadoBtn" style="width:auto;" type="button">＋ Agregar empleado</button>
      </div>
      <div class="catalog-table-wrap cfg-tabla-wrap" style="margin-top:10px;">
        <table class="catalog-table">
          <thead><tr><th>Nombre</th><th>Número</th><th>Cargo</th><th>Fecha de inicio</th><th>Salario</th><th>Hora extra</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            ${empleados.map(e => `
              <tr>
                <td>${construirAvatarEmpleadoNomina(e, 'width:30px;height:30px;font-size:0.7rem;display:inline-flex;vertical-align:middle;margin-right:6px;')}${escapeHTMLNomina(e.nombre)}</td>
                <td>${escapeHTMLNomina(e.numeroEmpleado)}</td>
                <td>${escapeHTMLNomina(CARGOS_NOMINA[e.cargo] || e.cargo)}</td>
                <td>${formatearFechaNomina(e.fechaInicio)}</td>
                <td>${fmtMoneyNomina(e.salarioBase)}</td>
                <td>${fmtMoneyNomina(e.pagoHoraExtra)}</td>
                <td><span class="badge ${e.estado === 'activo' ? 'badge-pagada' : 'badge-pendiente'}">${ESTADOS_EMPLEADO_NOMINA[e.estado]}</span></td>
                <td style="white-space:nowrap;">
                  <button type="button" class="comm-icon-btn" data-nom-editar-empleado="${e.id}" title="Editar">✎</button>
                  ${e.estado === 'activo'
                    ? `<button type="button" class="comm-icon-btn" data-nom-baja-empleado="${e.id}" title="Dar de baja">⏻</button>`
                    : `<button type="button" class="comm-icon-btn" data-nom-reactivar-empleado="${e.id}" title="Reactivar">↺</button>`}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('nomAgregarEmpleadoBtn').addEventListener('click', () => abrirModalEmpleadoNomina(null));
  cont.querySelectorAll('[data-nom-editar-empleado]').forEach(btn => btn.addEventListener('click', () => abrirModalEmpleadoNomina(btn.getAttribute('data-nom-editar-empleado'))));
  cont.querySelectorAll('[data-nom-baja-empleado]').forEach(btn => btn.addEventListener('click', () => confirmarBajaEmpleadoNomina(btn.getAttribute('data-nom-baja-empleado'))));
  cont.querySelectorAll('[data-nom-reactivar-empleado]').forEach(btn => btn.addEventListener('click', () => {
    reactivarEmpleadoNomina(btn.getAttribute('data-nom-reactivar-empleado'));
    if (typeof registrarAuditoriaAdmin === 'function') registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'reactivar_empleado', descripcion: 'Empleado reactivado desde Nómina → Datos' });
    mostrarToast('Empleado reactivado.');
    renderDatosEmpleados();
  }));

}

function confirmarBajaEmpleadoNomina(id) {
  const empleado = obtenerEmpleadoNominaPorId(id);
  if (!empleado) return;
  abrirAutorizacionAdmin({
    titulo: 'Dar de baja',
    peligrosa: true,
    mensaje: `Vas a dar de baja a <strong>${escapeHTMLNomina(empleado.nombre)}</strong>. Su historial de nómina se conserva completo; solo deja de aparecer como activo.`,
    onConfirmar: () => {
      darDeBajaEmpleadoNomina(id);
      if (typeof registrarAuditoriaAdmin === 'function') registrarAuditoriaAdmin({ modulo: 'nomina', accion: 'baja_empleado', descripcion: `Empleado dado de baja: ${empleado.nombre} (${empleado.numeroEmpleado})` });
      mostrarToast('Empleado dado de baja.');
      renderDatosEmpleados();
    }
  });
}

function abrirModalEmpleadoNomina(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const empleado = id ? obtenerEmpleadoNominaPorId(id) : null;
  let fotoEmpleadoData = empleado?.fotoUrl || '';
  const inicialesEmpleado = obtenerInicialesNomina(empleado?.nombre || 'Empleado');
  const avatarEmpleado = fotoEmpleadoData
    ? `<img src="${escapeHTMLNomina(fotoEmpleadoData)}" alt="Foto de ${escapeHTMLNomina(empleado?.nombre || 'empleado')}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : escapeHTMLNomina(inicialesEmpleado);

  box.style.maxWidth = '460px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">${empleado ? '✎' : '＋'}</div>
    <h3>${empleado ? 'Editar empleado' : 'Agregar empleado'}</h3>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Nombre completo<input type="text" id="nomEmpNombre" value="${escapeHTMLNomina(empleado?.nombre || '')}"></label>
      <label>Número de empleado<input type="text" id="nomEmpNumero" value="${escapeHTMLNomina(empleado?.numeroEmpleado || '')}" placeholder="Ej. EMP010"></label>
      <label>Cargo
        <select id="nomEmpCargo">
          <option value="staff" ${empleado?.cargo === 'staff' ? 'selected' : ''}>Staff</option>
          <option value="rh" ${empleado?.cargo === 'rh' ? 'selected' : ''}>RH</option>
          <option value="admin" ${empleado?.cargo === 'admin' ? 'selected' : ''}>Administrativo</option>
        </select>
      </label>
      <label>Fecha de inicio<input type="date" id="nomEmpFechaInicio" value="${empleado?.fechaInicio || new Date().toISOString().slice(0, 10)}"></label>
      <label>Salario base semanal<input type="number" step="0.01" id="nomEmpSalario" value="${empleado?.salarioBase ?? 0}"></label>
      <label>Pago por hora extra<input type="number" step="0.01" id="nomEmpHoraExtra" value="${empleado?.pagoHoraExtra ?? 0}"></label>
      <label class="cfg-span-2">Foto del empleado<input type="file" id="nomEmpFoto" accept="image/*"></label>
      <div class="cfg-span-2" style="display:flex;align-items:center;gap:10px;">
        <div id="nomEmpFotoPreview" class="profile-avatar" style="width:56px;height:56px;font-size:1.1rem;overflow:hidden;flex-shrink:0;">${avatarEmpleado}</div>
        <span class="cfg-card-sub" style="margin:0;">Selecciona una imagen para actualizar la foto.</span>
      </div>
    </div>
    <div id="nomEmpError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomEmpCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="nomEmpGuardarBtn" type="button">${empleado ? 'Guardar cambios' : 'Agregar empleado'}</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomEmpCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomEmpFoto')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    const error = document.getElementById('nomEmpError');
    if (!archivo.type.startsWith('image/')) {
      e.target.value = '';
      error.style.display = 'block';
      error.textContent = 'Selecciona un archivo de imagen válido.';
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      e.target.value = '';
      error.style.display = 'block';
      error.textContent = 'La imagen no puede superar 2 MB.';
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      fotoEmpleadoData = lector.result;
      document.getElementById('nomEmpFotoPreview').innerHTML = `<img src="${fotoEmpleadoData}" alt="Vista previa de la foto" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
      error.style.display = 'none';
    };
    lector.readAsDataURL(archivo);
  });

  document.getElementById('nomEmpGuardarBtn')?.addEventListener('click', () => {

    const datos = {
      nombre: document.getElementById('nomEmpNombre').value.trim(),
      numeroEmpleado: document.getElementById('nomEmpNumero').value.trim(),
      cargo: document.getElementById('nomEmpCargo').value,
      fechaInicio: document.getElementById('nomEmpFechaInicio').value,
      salarioBase: parseFloat(document.getElementById('nomEmpSalario').value) || 0,
      pagoHoraExtra: parseFloat(document.getElementById('nomEmpHoraExtra').value) || 0,
      fotoUrl: fotoEmpleadoData
    };

    const error = document.getElementById('nomEmpError');
    const resultado = empleado ? editarEmpleadoNomina(empleado.id, datos) : crearEmpleadoNomina(datos);

    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }

    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({
        modulo: 'nomina',
        accion: empleado ? 'editar_empleado' : 'crear_empleado',
        descripcion: `${empleado ? 'Empleado editado' : 'Empleado creado'}: ${datos.nombre} (${datos.numeroEmpleado})`
      });
    }

    cerrar();
    mostrarToast(empleado ? 'Empleado actualizado.' : 'Empleado agregado.');
    renderDatosEmpleados();

  });

}

// ---------- Conceptos ----------

function renderDatosConceptos() {

  const cont = document.getElementById('nomDatosConceptos');
  const conceptos = obtenerConceptosNomina();

  cont.innerHTML = `
    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 class="cfg-card-title" style="margin-bottom:0.15rem;">Conceptos de nómina</h3>
          <p class="cfg-card-sub" style="margin-bottom:0;">Los conceptos ya usados en periodos anteriores nunca se borran — solo se desactivan.</p>
        </div>
        <button class="btn btn-primary" id="nomAgregarConceptoDatoBtn" style="width:auto;" type="button">＋ Agregar concepto</button>
      </div>
      <div class="catalog-table-wrap cfg-tabla-wrap" style="margin-top:10px;">
        <table class="catalog-table">
          <thead><tr><th>Concepto</th><th>Tipo</th><th>Activo</th><th>Acciones</th></tr></thead>
          <tbody>
            ${conceptos.map(c => `
              <tr>
                <td>${escapeHTMLNomina(c.nombre)}${c.fijo ? ' <span class="catalog-product-id">(fijo)</span>' : ''}</td>
                <td><span class="badge ${c.tipo === 'percepcion' ? 'badge-pagada' : 'badge-pendiente'}">${c.tipo === 'percepcion' ? 'Percepción' : 'Deducción'}</span></td>
                <td>${c.activo ? '✓' : '—'}</td>
                <td style="white-space:nowrap;">
                  <button type="button" class="comm-icon-btn" data-nom-editar-concepto="${c.id}" title="Editar">✎</button>
                  ${!c.fijo ? (c.activo
                    ? `<button type="button" class="comm-icon-btn" data-nom-desactivar-concepto="${c.id}" title="Desactivar">⏻</button>`
                    : `<button type="button" class="comm-icon-btn" data-nom-activar-concepto="${c.id}" title="Activar">↺</button>`) : ''}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('nomAgregarConceptoDatoBtn').addEventListener('click', () => abrirModalConceptoNomina(null));
  cont.querySelectorAll('[data-nom-editar-concepto]').forEach(btn => btn.addEventListener('click', () => abrirModalConceptoNomina(btn.getAttribute('data-nom-editar-concepto'))));
  cont.querySelectorAll('[data-nom-desactivar-concepto]').forEach(btn => btn.addEventListener('click', () => {
    desactivarConceptoNomina(btn.getAttribute('data-nom-desactivar-concepto'));
    mostrarToast('Concepto desactivado.');
    renderDatosConceptos();
  }));
  cont.querySelectorAll('[data-nom-activar-concepto]').forEach(btn => btn.addEventListener('click', () => {
    activarConceptoNomina(btn.getAttribute('data-nom-activar-concepto'));
    mostrarToast('Concepto activado.');
    renderDatosConceptos();
  }));

}

function abrirModalConceptoNomina(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const concepto = id ? obtenerConceptoNominaPorId(id) : null;

  box.style.maxWidth = '400px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">${concepto ? '✎' : '＋'}</div>
    <h3>${concepto ? 'Editar concepto' : 'Agregar concepto'}</h3>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Nombre<input type="text" id="nomConceptoNombre" value="${escapeHTMLNomina(concepto?.nombre || '')}"></label>
      <label class="cfg-span-2">Tipo
        <select id="nomConceptoTipo" ${concepto?.fijo ? 'disabled' : ''}>
          <option value="percepcion" ${concepto?.tipo === 'percepcion' ? 'selected' : ''}>Percepción</option>
          <option value="deduccion" ${concepto?.tipo === 'deduccion' ? 'selected' : ''}>Deducción</option>
        </select>
      </label>
    </div>
    <div id="nomConceptoError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomConceptoCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="nomConceptoGuardarBtn" type="button">${concepto ? 'Guardar' : 'Agregar'}</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomConceptoCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomConceptoGuardarBtn')?.addEventListener('click', () => {
    const nombre = document.getElementById('nomConceptoNombre').value.trim();
    const tipo = document.getElementById('nomConceptoTipo').value;
    const error = document.getElementById('nomConceptoError');

    const resultado = concepto ? editarConceptoNomina(concepto.id, { nombre, tipo }) : crearConceptoNomina({ nombre, tipo });
    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }

    cerrar();
    mostrarToast(concepto ? 'Concepto actualizado.' : 'Concepto agregado.');
    renderDatosConceptos();
  });

}

// ---------- Solicitudes ----------

function renderDatosSolicitudes() {

  const cont = document.getElementById('nomDatosSolicitudes');
  const solicitudes = obtenerSolicitudesNomina();
  const empleadosActivos = obtenerEmpleadosNomina().filter(e => e.estado === 'activo');

  cont.innerHTML = `
    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 class="cfg-card-title" style="margin-bottom:0.15rem;">Solicitudes de alta y baja</h3>
          <p class="cfg-card-sub" style="margin-bottom:0;">Las altas y bajas nunca se ejecutan solas — siempre requieren aprobación de Administrativo.</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn btn-outline" id="nomSolicitarAltaBtn" style="width:auto;" type="button">+ Solicitar alta</button>
          <button class="btn btn-outline" id="nomSolicitarBajaBtn" style="width:auto;" type="button">Solicitar baja</button>
        </div>
      </div>
      <div class="catalog-table-wrap cfg-tabla-wrap" style="margin-top:10px;">
        <table class="catalog-table">
          <thead><tr><th>Empleado</th><th>Tipo</th><th>Fecha solicitud</th><th>Estado</th><th>Revisado por</th><th>Fecha resolución</th><th>Acciones</th></tr></thead>
          <tbody>
            ${solicitudes.length ? solicitudes.map(s => {
              const nombre = s.tipo === 'alta' ? s.datosAlta.nombre : (obtenerEmpleadoNominaPorId(s.empleadoId)?.nombre || '—');
              const estadoBadge = s.estado === 'pendiente' ? 'badge-pendiente' : (s.estado === 'aprobada' ? 'badge-pagada' : 'badge-pendiente');
              return `
                <tr>
                  <td>${escapeHTMLNomina(nombre)}</td>
                  <td>${s.tipo === 'alta' ? 'Alta' : 'Baja'}</td>
                  <td>${formatearFechaHoraNomina(s.fechaSolicitud)}</td>
                  <td><span class="badge ${estadoBadge}">${s.estado === 'pendiente' ? 'Pendiente' : s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</span>${s.estado === 'rechazada' && s.motivoRechazo ? `<div class="catalog-product-id">${escapeHTMLNomina(s.motivoRechazo)}</div>` : ''}</td>
                  <td>${escapeHTMLNomina(s.revisadoPor || '—')}</td>
                  <td>${s.fechaResolucion ? formatearFechaHoraNomina(s.fechaResolucion) : '—'}</td>
                  <td style="white-space:nowrap;">
                    ${s.estado === 'pendiente' ? `
                      <button type="button" class="comm-icon-btn" data-nom-aprobar-solicitud="${s.id}" title="Aprobar">✓</button>
                      <button type="button" class="comm-icon-btn" data-nom-rechazar-solicitud="${s.id}" title="Rechazar">✕</button>
                    ` : '—'}
                  </td>
                </tr>
              `;
            }).join('') : `<tr><td colspan="7" class="catalog-empty-cell">Todavía no hay solicitudes.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('nomSolicitarAltaBtn').addEventListener('click', abrirModalSolicitudAlta);
  document.getElementById('nomSolicitarBajaBtn').addEventListener('click', () => abrirModalSolicitudBaja(empleadosActivos));
  cont.querySelectorAll('[data-nom-aprobar-solicitud]').forEach(btn => btn.addEventListener('click', () => confirmarAprobarSolicitud(btn.getAttribute('data-nom-aprobar-solicitud'))));
  cont.querySelectorAll('[data-nom-rechazar-solicitud]').forEach(btn => btn.addEventListener('click', () => abrirModalRechazarSolicitud(btn.getAttribute('data-nom-rechazar-solicitud'))));

}

function abrirModalSolicitudAlta() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '440px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">＋</div>
    <h3>Solicitar alta de empleado</h3>
    <p class="modal-sub">Queda pendiente de aprobación de Administrativo — no crea la cuenta de inmediato.</p>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Nombre completo<input type="text" id="nomSolAltaNombre"></label>
      <label>Número de empleado<input type="text" id="nomSolAltaNumero" placeholder="Ej. EMP010"></label>
      <label>Cargo
        <select id="nomSolAltaCargo">
          <option value="staff">Staff</option>
          <option value="rh">RH</option>
          <option value="admin">Administrativo</option>
        </select>
      </label>
      <label>Fecha de inicio<input type="date" id="nomSolAltaFecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label>Salario base semanal<input type="number" step="0.01" id="nomSolAltaSalario" value="0"></label>
    </div>
    <div id="nomSolAltaError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomSolAltaCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="nomSolAltaConfirmarBtn" type="button">Enviar solicitud</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomSolAltaCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomSolAltaConfirmarBtn')?.addEventListener('click', () => {
    const datos = {
      nombre: document.getElementById('nomSolAltaNombre').value.trim(),
      numeroEmpleado: document.getElementById('nomSolAltaNumero').value.trim(),
      cargo: document.getElementById('nomSolAltaCargo').value,
      fechaInicio: document.getElementById('nomSolAltaFecha').value,
      salarioBase: parseFloat(document.getElementById('nomSolAltaSalario').value) || 0,
      solicitadoPor: ADMIN_IDENTIDAD.usuarioNombre
    };
    const error = document.getElementById('nomSolAltaError');
    const resultado = crearSolicitudAltaNomina(datos);
    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }
    cerrar();
    mostrarToast('Solicitud de alta enviada — pendiente de aprobación.');
    renderDatosSolicitudes();
  });

}

function abrirModalSolicitudBaja(empleadosActivos) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '440px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon danger">−</div>
    <h3>Solicitar baja de empleado</h3>
    <p class="modal-sub">No elimina al empleado de inmediato — queda pendiente de aprobación.</p>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Empleado
        <select id="nomSolBajaEmpleado">
          ${empleadosActivos.map(e => `<option value="${e.id}">${escapeHTMLNomina(e.nombre)} (${escapeHTMLNomina(e.numeroEmpleado)})</option>`).join('')}
        </select>
      </label>
      <label>Fecha efectiva de baja<input type="date" id="nomSolBajaFecha" value="${new Date().toISOString().slice(0, 10)}"></label>
      <label class="cfg-span-2">Motivo<textarea id="nomSolBajaMotivo" rows="3"></textarea></label>
    </div>
    <div id="nomSolBajaError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomSolBajaCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-danger" style="flex:1;" id="nomSolBajaConfirmarBtn" type="button">Enviar solicitud</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomSolBajaCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomSolBajaConfirmarBtn')?.addEventListener('click', () => {
    const datos = {
      empleadoId: document.getElementById('nomSolBajaEmpleado').value,
      motivoBaja: document.getElementById('nomSolBajaMotivo').value.trim(),
      fechaEfectivaBaja: document.getElementById('nomSolBajaFecha').value,
      solicitadoPor: ADMIN_IDENTIDAD.usuarioNombre
    };
    const error = document.getElementById('nomSolBajaError');
    const resultado = crearSolicitudBajaNomina(datos);
    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }
    cerrar();
    mostrarToast('Solicitud de baja enviada — pendiente de aprobación.');
    renderDatosSolicitudes();
  });

}

function confirmarAprobarSolicitud(id) {
  const solicitudes = obtenerSolicitudesNomina();
  const solicitud = solicitudes.find(s => s.id === id);
  if (!solicitud) return;

  const nombre = solicitud.tipo === 'alta' ? solicitud.datosAlta.nombre : (obtenerEmpleadoNominaPorId(solicitud.empleadoId)?.nombre || '');

  abrirAutorizacionAdmin({
    titulo: `Aprobar ${solicitud.tipo === 'alta' ? 'alta' : 'baja'}`,
    mensaje: `¿Confirmas la ${solicitud.tipo} de <strong>${escapeHTMLNomina(nombre)}</strong>?`,
    onConfirmar: () => {
      const resultado = aprobarSolicitudNomina(id, { usuarioAdminId: ADMIN_IDENTIDAD.usuarioId, usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre });
      if (!resultado.ok) { mostrarToast(resultado.error); return; }
      mostrarToast(`Solicitud de ${solicitud.tipo} aprobada.`);
      renderDatosSolicitudes();
    }
  });
}

function abrirModalRechazarSolicitud(id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '400px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon danger">✕</div>
    <h3>Rechazar solicitud</h3>
    <label class="cfg-field-label">Motivo del rechazo</label>
    <textarea id="nomRechazoMotivo" rows="3" style="width:100%;border:1px solid var(--mw-border);border-radius:8px;padding:0.6em 0.8em;font-family:inherit;"></textarea>
    <div id="nomRechazoError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="nomRechazoCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-danger" style="flex:1;" id="nomRechazoConfirmarBtn" type="button">Rechazar</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('nomRechazoCancelarBtn')?.addEventListener('click', cerrar);

  document.getElementById('nomRechazoConfirmarBtn')?.addEventListener('click', () => {
    const motivo = document.getElementById('nomRechazoMotivo').value.trim();
    const error = document.getElementById('nomRechazoError');
    const resultado = rechazarSolicitudNomina(id, { motivo, usuarioAdminId: ADMIN_IDENTIDAD.usuarioId, usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre });
    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }
    cerrar();
    mostrarToast('Solicitud rechazada.');
    renderDatosSolicitudes();
  });

}
