// MW JOYERÍA — Admin: Configuración (centro de reglas del sistema)
//
// "Configuración define las reglas. Los módulos operativos las usan."
// Esta página es la interfaz de js/configuracion-modelo.js — no vuelve
// a calcular nada por su cuenta, solo lee/escribe versiones vigentes.
//
// Flujo para parámetros con dinero/rangos/recompensas de por medio
// (Plan MW, Comisiones, Apartados): editar celda → queda "pendiente"
// (borrador local, autoguardado) → botón "Guardar cambios" → modal de
// confirmación con fecha de vigencia → recién ahí se crea la nueva
// versión y se cierra la anterior (nunca se borra).
//
// Para Datos de MW / Sistema / Notificaciones (no afectan dinero
// histórico) el guardado es directo, sin modal de confirmación.

let seccionActual = 'datosMW';
let pendientesVersionados = {}; // clave `${tipo}__${parametro}` -> {tipo,parametro,seccion,etiqueta,tipoValor,valorAnterior,valorNuevo}
let timerAutoguardadoConfig = null;

document.addEventListener('DOMContentLoaded', () => {

  revisarBorradorConfigAlCargar();
  renderSeccionActual();
  actualizarPillConfig();

  document.querySelectorAll('#cfgNav [data-cfg-seccion]').forEach(btn => {
    btn.addEventListener('click', () => {
      seccionActual = btn.getAttribute('data-cfg-seccion');
      document.querySelectorAll('#cfgNav [data-cfg-seccion]').forEach(b => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.cfg-seccion').forEach(sec => { sec.hidden = sec.id !== `seccion-${seccionActual}`; });
      renderSeccionActual();
    });
  });

  document.getElementById('cfgRecuperarBtn')?.addEventListener('click', () => {
    document.getElementById('cfgRecuperarBanner').hidden = true;
    mostrarToast('Cambios recuperados — puedes seguir editando.');
    renderSeccionActual();
    actualizarBarraGuardar();
  });

  document.getElementById('cfgDescartarBtn')?.addEventListener('click', () => {
    pendientesVersionados = {};
    descartarBorradorConfig();
    document.getElementById('cfgRecuperarBanner').hidden = true;
    renderSeccionActual();
    actualizarBarraGuardar();
  });

  window.addEventListener('online', actualizarPillConfig);
  window.addEventListener('offline', actualizarPillConfig);

});

// ============================================================
// AUTOGUARDADO (borrador local de cambios sin confirmar)
// ============================================================

function revisarBorradorConfigAlCargar() {
  const borrador = obtenerBorradorConfig();
  const pendientes = borrador?.pendientes || {};
  if (Object.keys(pendientes).length) {
    pendientesVersionados = pendientes;
    document.getElementById('cfgRecuperarBanner').hidden = false;
  }
}

function programarAutoguardadoConfig() {
  actualizarPillConfig('guardando');
  clearTimeout(timerAutoguardadoConfig);
  timerAutoguardadoConfig = setTimeout(() => {
    try {
      guardarBorradorConfig({ pendientes: pendientesVersionados });
      actualizarPillConfig();
    } catch (error) {
      actualizarPillConfig('error');
    }
  }, 500);
}

function actualizarPillConfig(modo) {
  const pill = document.getElementById('cfgSyncPill');
  if (!pill) return;

  if (modo === 'error') {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Error de sincronización';
    pill.className = 'cfg-sync-pill error';
    return;
  }
  if (!navigator.onLine) {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Guardado localmente — esperando conexión';
    pill.className = 'cfg-sync-pill offline';
    return;
  }
  if (modo === 'guardando') {
    pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Guardando...';
    pill.className = 'cfg-sync-pill guardando';
    return;
  }
  pill.innerHTML = '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="12" cy="12" r="7"/></svg></span> Guardado';
  pill.className = 'cfg-sync-pill ok';
}

// ============================================================
// FORMATO
// ============================================================

function formatearValorTipo(valor, tipoValor) {
  if (valor === null || valor === undefined) return '—';
  if (tipoValor === 'moneda') return `$${Number(valor).toLocaleString('es-MX')}`;
  if (tipoValor === 'porcentaje') return `${valor}%`;
  if (tipoValor === 'dias') return `${valor} día${Number(valor) === 1 ? '' : 's'}`;
  return String(valor);
}

function formatearFechaCfg(fechaISO) {
  if (!fechaISO) return '—';
  const fecha = new Date(fechaISO.length <= 10 ? `${fechaISO}T00:00:00` : fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ============================================================
// RENDER PRINCIPAL
// ============================================================

function renderSeccionActual() {
  const render = {
    datosMW: renderSeccionDatosMW,
    planMW: renderSeccionPlanMW,
    comisiones: renderSeccionComisionesConfig,
    apartados: renderSeccionApartadosConfig,
    fotos: renderSeccionFotos,
    usuarios: renderSeccionUsuarios,
    notificaciones: renderSeccionNotificaciones,
    sistema: renderSeccionSistema,
    auditoria: renderSeccionAuditoria
  }[seccionActual];
  if (render) render();
  actualizarBarraGuardar();
}

// ============================================================
// VALOR MOSTRADO (respeta un cambio pendiente si existe)
// ============================================================

function valorMostradoParametro(tipo, parametro, valorReal) {
  const clave = `${tipo}__${parametro}`;
  return pendientesVersionados[clave] ? pendientesVersionados[clave].valorNuevo : valorReal;
}

// ============================================================
// CELDA EDITABLE VERSIONADA (Excel-like, con historial)
// ============================================================

function construirCeldaVersionada({ tipo, parametro, seccion, etiqueta, tipoValor }) {
  const valorReal = obtenerValorVigente(tipo, parametro);
  const clave = `${tipo}__${parametro}`;
  const pendiente = pendientesVersionados[clave];
  const valorMostrado = pendiente ? pendiente.valorNuevo : valorReal;

  return `
    <td class="cfg-celda-editable ${pendiente ? 'pendiente' : ''}"
        data-cfg-editable
        data-clave="${clave}"
        data-tipo="${tipo}"
        data-parametro="${parametro}"
        data-seccion="${escapeAttributePersonas(seccion)}"
        data-etiqueta="${escapeAttributePersonas(etiqueta)}"
        data-tipo-valor="${tipoValor}"
        data-valor-real="${escapeAttributePersonas(valorReal)}"
        data-valor-mostrado="${escapeAttributePersonas(valorMostrado)}"
        tabindex="0"
    ><span class="cfg-celda-texto">${formatearValorTipo(valorMostrado, tipoValor)}</span><button type="button" class="cfg-icon-btn" data-cfg-historial="${clave}" title="Ver historial"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></button></td>
  `;
}

function wireEventosConfigTabla(contenedor) {

  contenedor.querySelectorAll('[data-cfg-editable]').forEach(td => {
    td.addEventListener('click', (e) => {
      if (e.target.closest('[data-cfg-historial]')) return;
      activarEdicionCeldaConfig(td);
    });
    td.addEventListener('keydown', (e) => {
      if (e.target.closest('[data-cfg-historial]')) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activarEdicionCeldaConfig(td); }
    });
  });

  contenedor.querySelectorAll('[data-cfg-historial]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const td = btn.closest('[data-cfg-editable]');
      abrirHistorialParametroConfig({
        tipo: td.dataset.tipo,
        parametro: td.dataset.parametro,
        etiqueta: td.dataset.etiqueta,
        seccion: td.dataset.seccion,
        tipoValor: td.dataset.tipoValor
      });
    });
  });

}

function obtenerCeldasEditablesConfigOrdenadas() {
  const cont = document.getElementById(`seccion-${seccionActual}`);
  if (!cont) return [];
  return Array.from(cont.querySelectorAll('[data-cfg-editable]'));
}

function activarEdicionCeldaConfig(td) {
  if (td.querySelector('input')) return;

  const tipoValor = td.dataset.tipoValor;
  const valorActual = td.dataset.valorMostrado;
  const tipoInput = tipoValor === 'texto' ? 'text' : 'number';
  const step = tipoValor === 'texto' ? '' : 'step="0.01"';

  td.innerHTML = `<input type="${tipoInput}" ${step} value="${escapeAttributePersonas(valorActual)}">`;
  const input = td.querySelector('input');
  input.focus();
  input.select();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaConfig(td, 'commit');
      moverASiguienteCeldaConfig(td);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaConfig(td, 'commit');
      moverASiguienteCeldaConfig(td, e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      finalizarEdicionCeldaConfig(td, 'cancel');
    }
  });

  input.addEventListener('blur', () => finalizarEdicionCeldaConfig(td, 'commit'));
}

// Mismo candado de reentrancia que Comisiones: reemplazar el <input>
// por texto dispara un 'blur' síncrono sobre el mismo input, que sin
// este candado volvería a llamar aquí a la mitad de la primera mutación
// del DOM y el navegador lanza "node no longer a child".
function finalizarEdicionCeldaConfig(td, modo) {
  if (td.dataset.cerrando === '1') return;
  const input = td.querySelector('input');
  if (!input) return;

  td.dataset.cerrando = '1';
  try {

    const tipoValor = td.dataset.tipoValor;
    const valorRealTexto = td.dataset.valorReal;
    const valorReal = tipoValor === 'texto' ? valorRealTexto : parseFloat(valorRealTexto);
    const clave = td.dataset.clave;

    // Importante: solo se vuelve a pintar la barra "Guardar cambios" si
    // REALMENTE había un cambio pendiente que quitar. Enter/Tab dejan la
    // SIGUIENTE celda abierta en modo edición (estilo Excel); si el
    // admin nunca la toca y más tarde hace clic en "Guardar cambios",
    // ese clic le quita el foco a esa celda y dispara su 'blur' —
    // repintar la barra en ese momento reemplazaría (innerHTML) el
    // mismísimo botón que se está clicando, a la mitad del clic, y el
    // navegador lo perdería en silencio.
    if (modo === 'cancel') {
      const habiaPendiente = !!pendientesVersionados[clave];
      delete pendientesVersionados[clave];
      pintarCeldaConfig(td, valorReal);
      if (habiaPendiente) {
        programarAutoguardadoConfig();
        actualizarBarraGuardar();
      }
      return;
    }

    let nuevoValor = tipoValor === 'texto' ? input.value.trim() : parseFloat(input.value);

    if (tipoValor !== 'texto' && Number.isNaN(nuevoValor)) {
      pintarCeldaConfig(td, parseFloat(td.dataset.valorMostrado));
      return;
    }

    if (nuevoValor === valorReal || nuevoValor === '') {
      const habiaPendiente = !!pendientesVersionados[clave];
      delete pendientesVersionados[clave];
      pintarCeldaConfig(td, valorReal);
      if (habiaPendiente) {
        programarAutoguardadoConfig();
        actualizarBarraGuardar();
      }
      return;
    }

    pendientesVersionados[clave] = {
      tipo: td.dataset.tipo,
      parametro: td.dataset.parametro,
      seccion: td.dataset.seccion,
      etiqueta: td.dataset.etiqueta,
      tipoValor,
      valorAnterior: valorReal,
      valorNuevo: nuevoValor
    };

    td.dataset.valorMostrado = nuevoValor;
    pintarCeldaConfig(td, nuevoValor, true);
    programarAutoguardadoConfig();
    actualizarBarraGuardar();

  } finally {
    delete td.dataset.cerrando;
  }
}

function pintarCeldaConfig(td, valor, pendiente) {
  const tipoValor = td.dataset.tipoValor;
  td.innerHTML = `<span class="cfg-celda-texto">${formatearValorTipo(valor, tipoValor)}</span><button type="button" class="cfg-icon-btn" data-cfg-historial="${td.dataset.clave}" title="Ver historial"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></button>`;
  td.className = `cfg-celda-editable ${pendiente ? 'pendiente' : ''}`;
  td.querySelector('[data-cfg-historial]').addEventListener('click', (e) => {
    e.stopPropagation();
    abrirHistorialParametroConfig({
      tipo: td.dataset.tipo, parametro: td.dataset.parametro,
      etiqueta: td.dataset.etiqueta, seccion: td.dataset.seccion, tipoValor: td.dataset.tipoValor
    });
  });
}

function moverASiguienteCeldaConfig(tdActual, direccion = 1) {
  const celdas = obtenerCeldasEditablesConfigOrdenadas();
  const idx = celdas.indexOf(tdActual);
  if (idx === -1) return;
  const siguiente = celdas[idx + direccion];
  if (siguiente) {
    siguiente.focus();
    activarEdicionCeldaConfig(siguiente);
  }
}

// ============================================================
// BARRA "GUARDAR CAMBIOS" + MODAL DE CONFIRMACIÓN CON VIGENCIA
// ============================================================

function actualizarBarraGuardar() {
  let barra = document.getElementById('cfgBarraGuardar');
  const total = Object.keys(pendientesVersionados).length;

  if (!total) {
    barra?.remove();
    return;
  }

  if (!barra) {
    barra = document.createElement('div');
    barra.id = 'cfgBarraGuardar';
    barra.className = 'cfg-barra-guardar';
    document.body.appendChild(barra);
  }

  barra.innerHTML = `
    <span>${total} cambio${total === 1 ? '' : 's'} pendiente${total === 1 ? '' : 's'} de confirmar</span>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-outline" id="cfgDescartarTodoBtn" type="button">Descartar</button>
      <button class="btn btn-primary" id="cfgGuardarCambiosBtn" type="button">Guardar cambios</button>
    </div>
  `;

  document.getElementById('cfgDescartarTodoBtn').addEventListener('click', () => {
    pendientesVersionados = {};
    descartarBorradorConfig();
    renderSeccionActual();
  });

  document.getElementById('cfgGuardarCambiosBtn').addEventListener('click', abrirConfirmacionCambiosVersion);
}

function abrirConfirmacionCambiosVersion() {

  const cambios = Object.values(pendientesVersionados);
  if (!cambios.length) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const hoy = configHoyISO();

  box.style.maxWidth = '480px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon danger"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></div>
    <h3>Confirmar cambios de configuración</h3>
    <p class="modal-sub">Esta modificación puede afectar cálculos, comisiones, pagos o recompensas.</p>

    <div class="cfg-cambios-lista">
      ${cambios.map(c => `
        <div class="cfg-cambio-item">
          <strong>${escapeHTMLPersonas(c.seccion)} → ${escapeHTMLPersonas(c.etiqueta)}</strong>
          <span>${formatearValorTipo(c.valorAnterior, c.tipoValor)} → ${formatearValorTipo(c.valorNuevo, c.tipoValor)}</span>
        </div>
      `).join('')}
    </div>

    <label class="cfg-field-label">Vigente desde</label>
    <input type="date" id="cfgVigenciaInput" value="${hoy}" min="${hoy}">
    <label class="cfg-field-label">Motivo (opcional)</label>
    <input type="text" id="cfgMotivoInput" placeholder="¿Por qué se hace este cambio?">

    <div class="modal-note">
      <strong>La nueva configuración tendrá vigencia a partir de la fecha indicada.</strong>
      Los periodos ya calculados con la regla anterior no se recalculan.
    </div>

    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="cfgCancelarCambioBtn" type="button">Cancelar</button>
      <button class="btn btn-danger" style="flex:1;" id="cfgConfirmarCambioBtn" type="button">Confirmar cambio</button>
    </div>
  `;

  overlay.classList.add('open');

  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('cfgCancelarCambioBtn')?.addEventListener('click', cerrar);

  document.getElementById('cfgConfirmarCambioBtn')?.addEventListener('click', () => {

    const vigenteDesde = document.getElementById('cfgVigenciaInput').value || hoy;
    const motivo = document.getElementById('cfgMotivoInput').value.trim();

    cambios.forEach(c => {
      guardarNuevaVersionParametro({
        tipo: c.tipo,
        parametro: c.parametro,
        valor: c.valorNuevo,
        vigenteDesde,
        motivo,
        usuarioAdminId: ADMIN_IDENTIDAD.usuarioId,
        usuarioAdminNombre: ADMIN_IDENTIDAD.usuarioNombre,
        seccion: c.seccion,
        etiqueta: c.etiqueta
      });
    });

    pendientesVersionados = {};
    descartarBorradorConfig();
    cerrar();
    mostrarToast(`${cambios.length} cambio${cambios.length === 1 ? '' : 's'} confirmado${cambios.length === 1 ? '' : 's'} — vigente desde ${formatearFechaCfg(vigenteDesde)}.`);
    renderSeccionActual();

  });

}

// ============================================================
// HISTORIAL + RESTAURAR VERSIÓN
// ============================================================

function abrirHistorialParametroConfig({ tipo, parametro, etiqueta, seccion, tipoValor }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const versiones = obtenerVersionesParametro(tipo, parametro).slice().sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde));

  box.style.maxWidth = '480px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg></div>
    <h3>Historial — ${escapeHTMLPersonas(etiqueta)}</h3>
    <p class="modal-sub">${escapeHTMLPersonas(seccion)}</p>
    <div class="ct-detail-list" style="border-bottom:0;">
      ${versiones.map(v => `
        <div class="ct-detail-row">
          <div>
            <strong>${formatearValorTipo(v.valor, tipoValor)}</strong>
            <span class="ct-detail-sub">Vigente ${formatearFechaCfg(v.vigenteDesde)} – ${v.vigenteHasta ? formatearFechaCfg(v.vigenteHasta) : 'hoy'} · ${escapeHTMLPersonas(v.usuarioAdminNombre || v.usuarioAdminId || 'Sistema')}</span>
          </div>
          ${v.vigenteHasta ? `<button type="button" class="btn btn-outline" style="width:auto;" data-cfg-restaurar="${v.valor}">Restaurar</button>` : '<span class="badge badge-pagada">Vigente</span>'}
        </div>
      `).join('')}
    </div>
  `;

  overlay.classList.add('open');
  box.querySelector('[data-close]')?.addEventListener('click', () => overlay.classList.remove('open'));

  box.querySelectorAll('[data-cfg-restaurar]').forEach(btn => {
    btn.addEventListener('click', () => {

      const valorHistorico = tipoValor === 'texto' ? btn.getAttribute('data-cfg-restaurar') : parseFloat(btn.getAttribute('data-cfg-restaurar'));
      const valorReal = obtenerValorVigente(tipo, parametro);
      const clave = `${tipo}__${parametro}`;

      pendientesVersionados[clave] = { tipo, parametro, seccion, etiqueta, tipoValor, valorAnterior: valorReal, valorNuevo: valorHistorico };

      overlay.classList.remove('open');
      programarAutoguardadoConfig();
      actualizarBarraGuardar();
      renderSeccionActual();
      mostrarToast('Versión preparada para restaurar — confirma el cambio para aplicarla.');

    });
  });

}

// ============================================================
// SECCIÓN: DATOS DE MW
// ============================================================

function renderSeccionDatosMW() {
  const cont = document.getElementById('seccion-datosMW');
  const { datosMW } = obtenerConfigSimple();

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Datos de MW</h3>
      <p class="cfg-card-sub">Información general de la empresa, usada en documentos y comprobantes.</p>
      <div class="cfg-form-grid">
        <label>Nombre de la empresa<input type="text" id="cfgNombreEmpresa" value="${escapeAttributePersonas(datosMW.nombreEmpresa)}"></label>
        <label>Teléfono<input type="text" id="cfgTelefono" value="${escapeAttributePersonas(datosMW.telefono)}"></label>
        <label>Correo de contacto<input type="text" id="cfgCorreoContacto" value="${escapeAttributePersonas(datosMW.correoContacto)}"></label>
        <label>URL del logo<input type="text" id="cfgLogoUrl" value="${escapeAttributePersonas(datosMW.logoUrl)}" placeholder="https://..."></label>
        <label class="cfg-span-2">Dirección<input type="text" id="cfgDireccion" value="${escapeAttributePersonas(datosMW.direccion)}"></label>
        <label class="cfg-span-2">Datos oficiales (para documentos/PDF)<textarea id="cfgDatosOficiales" rows="3">${escapeHTMLPersonas(datosMW.datosOficiales)}</textarea></label>
      </div>
      <button class="btn btn-primary" id="cfgGuardarDatosMW" type="button" style="width:auto;margin-top:10px;">Guardar cambios</button>
    </div>
  `;

  document.getElementById('cfgGuardarDatosMW').addEventListener('click', () => {
    guardarConfigSimple({
      datosMW: {
        nombreEmpresa: document.getElementById('cfgNombreEmpresa').value.trim(),
        telefono: document.getElementById('cfgTelefono').value.trim(),
        correoContacto: document.getElementById('cfgCorreoContacto').value.trim(),
        logoUrl: document.getElementById('cfgLogoUrl').value.trim(),
        direccion: document.getElementById('cfgDireccion').value.trim(),
        datosOficiales: document.getElementById('cfgDatosOficiales').value.trim()
      }
    }, { seccion: 'Datos de MW', descripcion: 'Se actualizaron los Datos de MW.' });
    mostrarToast('Datos de MW guardados.');
  });
}

// ============================================================
// SECCIÓN: SISTEMA
// ============================================================

function renderSeccionSistema() {
  const cont = document.getElementById('seccion-sistema');
  const { sistema } = obtenerConfigSimple();

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Sistema</h3>
      <p class="cfg-card-sub">Configuraciones generales del portal.</p>
      <div class="cfg-form-grid">
        <label>Zona horaria
          <select id="cfgZonaHoraria">
            <option value="America/Mexico_City" ${sistema.zonaHoraria === 'America/Mexico_City' ? 'selected' : ''}>Ciudad de México (America/Mexico_City)</option>
            <option value="America/Tijuana" ${sistema.zonaHoraria === 'America/Tijuana' ? 'selected' : ''}>Tijuana (America/Tijuana)</option>
            <option value="America/Cancun" ${sistema.zonaHoraria === 'America/Cancun' ? 'selected' : ''}>Cancún (America/Cancun)</option>
          </select>
        </label>
        <label>Moneda
          <select id="cfgMoneda">
            <option value="MXN" ${sistema.moneda === 'MXN' ? 'selected' : ''}>Peso mexicano (MXN)</option>
            <option value="USD" ${sistema.moneda === 'USD' ? 'selected' : ''}>Dólar (USD)</option>
          </select>
        </label>
        <label>Formato de fecha
          <select id="cfgFormatoFecha">
            <option value="dd/mm/aaaa" ${sistema.formatoFecha === 'dd/mm/aaaa' ? 'selected' : ''}>31/12/2026</option>
            <option value="mm/dd/aaaa" ${sistema.formatoFecha === 'mm/dd/aaaa' ? 'selected' : ''}>12/31/2026</option>
          </select>
        </label>
        <label>Formato de cantidades
          <select id="cfgFormatoCantidad">
            <option value="1,234.56" ${sistema.formatoCantidad === '1,234.56' ? 'selected' : ''}>1,234.56</option>
            <option value="1.234,56" ${sistema.formatoCantidad === '1.234,56' ? 'selected' : ''}>1.234,56</option>
          </select>
        </label>
      </div>
      <label class="cfg-toggle-row">
        <input type="checkbox" id="cfgModoMantenimiento" ${sistema.modoMantenimiento ? 'checked' : ''}>
        <span>Modo mantenimiento (muestra un aviso en vez del portal)</span>
      </label>
      <button class="btn btn-primary" id="cfgGuardarSistema" type="button" style="width:auto;margin-top:10px;">Guardar cambios</button>

      <div class="cfg-disclosure">
        <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></span> Por seguridad, esta pantalla nunca muestra ni permite editar contraseñas, claves privadas, secretos de Firebase, API keys ni credenciales de ningún servicio.
      </div>
    </div>
  `;

  document.getElementById('cfgGuardarSistema').addEventListener('click', () => {
    guardarConfigSimple({
      sistema: {
        zonaHoraria: document.getElementById('cfgZonaHoraria').value,
        moneda: document.getElementById('cfgMoneda').value,
        formatoFecha: document.getElementById('cfgFormatoFecha').value,
        formatoCantidad: document.getElementById('cfgFormatoCantidad').value,
        modoMantenimiento: document.getElementById('cfgModoMantenimiento').checked
      }
    }, { seccion: 'Sistema', descripcion: 'Se actualizó la configuración de Sistema.' });
    mostrarToast('Configuración de Sistema guardada.');
  });
}

// ============================================================
// SECCIÓN: NOTIFICACIONES
// ============================================================

const EVENTOS_NOTIF_CONFIG = [
  { clave: 'solicitud_creada', label: 'Nueva solicitud de inscripción recibida (avisa a Admin)' },
  { clave: 'solicitud_aprobada', label: 'Solicitud de inscripción aprobada' },
  { clave: 'solicitud_rechazada', label: 'Solicitud de inscripción rechazada' },
  { clave: 'rango_candidata_detectada', label: 'Una líder cumple los requisitos de un nuevo rango (avisa a Admin)' },
  { clave: 'cambio_rango_confirmado', label: 'Cambio de rango confirmado (avisa a la persona)' },
  { clave: 'constancia_hito_detectado', label: 'Se cumplió un hito del Reto de Constancia (avisa a Admin)' },
  { clave: 'recompensa_constancia_entregada', label: 'Recompensa de Constancia entregada (avisa a la persona)' },
  { clave: 'apartado_vencido', label: 'El plazo de un apartado ya venció (avisa a Admin)' }
];

function renderSeccionNotificaciones() {
  const cont = document.getElementById('seccion-notificaciones');
  const { notificaciones } = obtenerConfigSimple();

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Notificaciones</h3>
      <p class="cfg-card-sub">Activa o desactiva qué eventos generan una notificación interna. Esta lista son los eventos que YA existen en el sistema — no se inventan eventos nuevos aquí.</p>
      <div class="cfg-notif-lista">
        ${EVENTOS_NOTIF_CONFIG.map(ev => `
          <label class="cfg-toggle-row">
            <input type="checkbox" data-cfg-notif="${ev.clave}" ${notificaciones[ev.clave] !== false ? 'checked' : ''}>
            <span>${escapeHTMLPersonas(ev.label)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `;

  cont.querySelectorAll('[data-cfg-notif]').forEach(chk => {
    chk.addEventListener('change', () => {
      const clave = chk.getAttribute('data-cfg-notif');
      const actual = obtenerConfigSimple().notificaciones;
      actual[clave] = chk.checked;
      guardarConfigSimple({ notificaciones: actual }, {
        seccion: 'Notificaciones',
        descripcion: `Se ${chk.checked ? 'activó' : 'desactivó'} la notificación: ${EVENTOS_NOTIF_CONFIG.find(e => e.clave === clave)?.label || clave}`
      });
      mostrarToast(chk.checked ? 'Notificación activada.' : 'Notificación desactivada.');
    });
  });
}

// ============================================================
// SECCIÓN: PLAN MW
// ============================================================

function renderSeccionPlanMW() {

  const cont = document.getElementById('seccion-planMW');
  const rangosConBono = ['plata', 'oro', 'diamante', 'corona'];

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Rangos — requisitos</h3>
      <p class="cfg-card-sub">Mismos umbrales reales del Plan MW. Cambiarlos aquí no recalcula ascensos ya confirmados.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table" id="cfgTablaRangos">
          <thead><tr><th>Rango</th><th>Personas activas</th><th>Producción grupal</th><th>Compra personal</th><th>% Equipo calificado</th></tr></thead>
          <tbody>
            ${RANGOS_MW.filter(r => r.key !== 'sin_rango').map(r => `
              <tr>
                <td><strong>${r.label}</strong></td>
                ${construirCeldaVersionada({ tipo: 'rango', parametro: `${r.key}_personas`, seccion: 'Plan MW', etiqueta: `Rango ${r.label} — personas activas`, tipoValor: 'numero' })}
                ${construirCeldaVersionada({ tipo: 'rango', parametro: `${r.key}_produccion`, seccion: 'Plan MW', etiqueta: `Rango ${r.label} — producción grupal`, tipoValor: 'moneda' })}
                ${construirCeldaVersionada({ tipo: 'rango', parametro: `${r.key}_compra`, seccion: 'Plan MW', etiqueta: `Rango ${r.label} — compra personal`, tipoValor: 'moneda' })}
                ${construirCeldaVersionada({ tipo: 'rango', parametro: `${r.key}_calificado`, seccion: 'Plan MW', etiqueta: `Rango ${r.label} — % equipo calificado`, tipoValor: 'porcentaje' })}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Comisiones por nivel</h3>
      <p class="cfg-card-sub">Mismo porcentaje que ya usa el módulo de Comisiones — no se duplica, se lee de aquí.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table" id="cfgTablaComisiones">
          <thead><tr><th>Nivel</th><th>Sin rango</th><th>Plata</th><th>Oro</th><th>Diamante</th><th>Corona</th></tr></thead>
          <tbody>
            ${[1, 2, 3, 4, 5].map(nivel => `
              <tr>
                <td><strong>Nivel ${nivel}</strong></td>
                ${['sin_rango', 'plata', 'oro', 'diamante', 'corona'].map(rango =>
                  construirCeldaVersionada({ tipo: 'comision', parametro: `nivel${nivel}_${rango}`, seccion: 'Comisiones', etiqueta: `Nivel ${nivel} · ${rango}`, tipoValor: 'porcentaje' })
                ).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Bonos por rango</h3>
      <p class="cfg-card-sub">Se pagan una sola vez, la primera vez que se alcanza el rango.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr>${rangosConBono.map(r => `<th>${r.charAt(0).toUpperCase() + r.slice(1)}</th>`).join('')}</tr></thead>
          <tbody><tr>${rangosConBono.map(r => construirCeldaVersionada({ tipo: 'bono', parametro: r, seccion: 'Plan MW', etiqueta: `Bono por rango — ${r}`, tipoValor: 'moneda' })).join('')}</tr></tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Reto de Constancia</h3>
      <p class="cfg-card-sub">Los meses de cada hito no son editables aquí (son la identidad del hito); el premio sí. No existe un "monto mínimo" en la lógica actual — el hito depende de meses cumplidos, no de un monto.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Meses</th><th>Premio</th></tr></thead>
          <tbody>
            ${HITOS_CONSTANCIA_PERSONA.map(h => `
              <tr>
                <td>${h.meses} meses</td>
                ${construirCeldaVersionada({ tipo: 'constancia', parametro: `hito_${h.meses}_meses`, seccion: 'Plan MW', etiqueta: `Reto de Constancia — ${h.meses} meses`, tipoValor: 'texto' })}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Rifa mensual</h3>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Meta mensual</th><th>Monto por boleto extra</th></tr></thead>
          <tbody><tr>
            ${construirCeldaVersionada({ tipo: 'rifa', parametro: 'meta_mensual', seccion: 'Plan MW', etiqueta: 'Rifa — meta mensual', tipoValor: 'moneda' })}
            ${construirCeldaVersionada({ tipo: 'rifa', parametro: 'monto_por_boleto_extra', seccion: 'Plan MW', etiqueta: 'Rifa — monto por boleto extra', tipoValor: 'moneda' })}
          </tr></tbody>
        </table>
      </div>
    </div>
  `;

  wireEventosConfigTabla(cont);

}

// ============================================================
// SECCIÓN: COMISIONES
// ============================================================

function renderSeccionComisionesConfig() {

  const cont = document.getElementById('seccion-comisiones');

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Periodos de pago</h3>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Periodo 1 — último día</th><th>Periodo 1 — día de pago</th><th>Periodo 2 — día de pago (mes siguiente)</th></tr></thead>
          <tbody><tr>
            ${construirCeldaVersionada({ tipo: 'periodo', parametro: 'p1_dia_fin', seccion: 'Comisiones', etiqueta: 'Periodo 1 — último día', tipoValor: 'numero' })}
            ${construirCeldaVersionada({ tipo: 'periodo', parametro: 'p1_dia_pago', seccion: 'Comisiones', etiqueta: 'Periodo 1 — día de pago', tipoValor: 'numero' })}
            ${construirCeldaVersionada({ tipo: 'periodo', parametro: 'p2_dia_pago', seccion: 'Comisiones', etiqueta: 'Periodo 2 — día de pago', tipoValor: 'numero' })}
          </tr></tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Fórmula</h3>
      <p class="cfg-card-sub">Comisión = (compra ÷ divisor de IVA) × porcentaje. Cambiar el divisor afecta cálculos financieros — requiere confirmación.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Divisor de IVA</th></tr></thead>
          <tbody><tr>${construirCeldaVersionada({ tipo: 'formula', parametro: 'iva_divisor', seccion: 'Comisiones', etiqueta: 'Divisor de IVA de la fórmula', tipoValor: 'numero' })}</tr></tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <h3 class="cfg-card-title">Redondeo</h3>
      <p class="cfg-card-sub">El sistema hoy siempre redondea a 2 decimales. Este parámetro queda declarado y con historial para cuando se necesiten otros modos — todavía no cambia el cálculo por sí solo.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Modo de redondeo</th></tr></thead>
          <tbody><tr>${construirCeldaVersionada({ tipo: 'redondeo', parametro: 'modo', seccion: 'Comisiones', etiqueta: 'Redondeo de comisiones', tipoValor: 'texto' })}</tr></tbody>
        </table>
      </div>
    </div>
  `;

  wireEventosConfigTabla(cont);

}

// ============================================================
// SECCIÓN: APARTADOS
// ============================================================

function renderSeccionApartadosConfig() {

  const cont = document.getElementById('seccion-apartados');

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Reglas de Apartados</h3>
      <p class="cfg-card-sub"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span> Cualquier cambio aquí solo aplica a ventanas de apartado <strong>nuevas</strong> — las que ya están abiertas conservan su depósito y fecha de vencimiento tal como se calcularon.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Depósito base</th><th>Ventana nacional</th><th>Ventana foránea</th></tr></thead>
          <tbody><tr>
            ${construirCeldaVersionada({ tipo: 'apartado', parametro: 'deposito_base', seccion: 'Apartados', etiqueta: 'Depósito base', tipoValor: 'moneda' })}
            ${construirCeldaVersionada({ tipo: 'apartado', parametro: 'ventana_normal_dias', seccion: 'Apartados', etiqueta: 'Ventana nacional (días)', tipoValor: 'dias' })}
            ${construirCeldaVersionada({ tipo: 'apartado', parametro: 'ventana_foranea_dias', seccion: 'Apartados', etiqueta: 'Ventana foránea (días)', tipoValor: 'dias' })}
          </tr></tbody>
        </table>
      </div>
    </div>
  `;

  wireEventosConfigTabla(cont);

}

// ============================================================
// SECCIÓN: FOTOGRAFÍAS DEL SITIO
// ============================================================
// Administra las fotografías fijas del sitio público (banners, carruseles,
// galerías). El catálogo de espacios y toda la lógica de guardado vive en
// js/fotos-sitio-modelo.js — aquí solo se arma la interfaz visual.

const FOTOS_SITIO_ICONO_ARRIBA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 15l6-6 6 6"/></svg>';
const FOTOS_SITIO_ICONO_ABAJO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>';
const FOTOS_SITIO_ICONO_ELIMINAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>';
const FOTOS_SITIO_ICONO_AGREGAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>';

async function renderSeccionFotos() {

  const cont = document.getElementById('seccion-fotos');
  if (!cont) return;

  cont.innerHTML = `<div class="cfg-card"><p class="cfg-card-sub" style="margin:0;">Cargando fotografías…</p></div>`;

  const secciones = typeof obtenerSeccionesFotosSitio === 'function' ? obtenerSeccionesFotosSitio() : [];
  const bloques = [];

  for (const sec of secciones) {
    const espacios = ESPACIOS_FOTOS_SITIO.filter(e => e.seccion === sec.seccion);
    const filas = [];
    for (const espacio of espacios) {
      filas.push(await construirBloqueEspacioFoto(espacio));
    }
    bloques.push(`
      <div class="cfg-card">
        <h3 class="cfg-card-title">${escapeHTMLPersonas(sec.seccionLabel)}</h3>
        ${filas.join('')}
      </div>
    `);
  }

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Fotografías del sitio</h3>
      <p class="cfg-card-sub" style="margin:0;">Administra las fotografías fijas que aparecen en el sitio público. Mientras no subas una fotografía para un espacio, se muestra automáticamente el logo MW — nunca queda un espacio roto.</p>
    </div>
    ${bloques.join('')}
  `;

  wireSeccionFotos(cont);

}

async function construirBloqueEspacioFoto(espacio) {

  const badge = (personalizada) => personalizada
    ? `<span class="badge badge-pagada">Fotografía personalizada</span>`
    : `<span class="badge badge-pendiente">Usando imagen predeterminada</span>`;

  if (espacio.tipo === 'unica') {

    const doc = obtenerFotosDeEspacio(espacio.seccion, espacio.ubicacion)[0] || null;
    let src = LOGO_MW_FALLBACK_FOTOS_SITIO;
    if (doc) {
      try { src = (await resolverSrcFotoSitio(doc)) || LOGO_MW_FALLBACK_FOTOS_SITIO; } catch (error) { src = LOGO_MW_FALLBACK_FOTOS_SITIO; }
    }
    const personalizada = !!doc;

    return `
      <div class="foto-espacio">
        <div class="foto-espacio-header">
          <div>
            <strong>${escapeHTMLPersonas(espacio.ubicacionLabel)}</strong>
            <span class="foto-espacio-ubicacion">${escapeHTMLPersonas(espacio.dondeAparece)}</span>
          </div>
          ${badge(personalizada)}
        </div>
        <div class="foto-espacio-unica">
          <div class="foto-espacio-thumb ${personalizada ? '' : 'foto-espacio-thumb-predeterminada'}">
            <img src="${src}" alt="">
          </div>
          <div class="foto-espacio-acciones">
            <button type="button" class="btn btn-outline" data-foto-cambiar="${espacio.seccion}:${espacio.ubicacion}">${personalizada ? 'Cambiar fotografía' : 'Agregar fotografía'}</button>
            ${personalizada ? `<button type="button" class="btn btn-outline" data-foto-eliminar="${doc.id}">Eliminar</button>` : ''}
          </div>
        </div>
      </div>
    `;

  }

  // tipo "multiple": galería/carrusel — sin límite de fotos
  const docs = obtenerFotosDeEspacio(espacio.seccion, espacio.ubicacion);
  const items = [];
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    let src = LOGO_MW_FALLBACK_FOTOS_SITIO;
    try { src = (await resolverSrcFotoSitio(doc)) || LOGO_MW_FALLBACK_FOTOS_SITIO; } catch (error) { src = LOGO_MW_FALLBACK_FOTOS_SITIO; }
    items.push(`
      <div class="foto-galeria-item">
        <div class="foto-galeria-item-foto"><img src="${src}" alt=""></div>
        <div class="foto-galeria-item-acciones">
          <button type="button" class="cfg-icon-btn" data-foto-mover="${doc.id}:-1" title="Mover arriba" ${i === 0 ? 'disabled' : ''}>${FOTOS_SITIO_ICONO_ARRIBA}</button>
          <button type="button" class="cfg-icon-btn" data-foto-mover="${doc.id}:1" title="Mover abajo" ${i === docs.length - 1 ? 'disabled' : ''}>${FOTOS_SITIO_ICONO_ABAJO}</button>
          <button type="button" class="cfg-icon-btn danger" data-foto-eliminar="${doc.id}" title="Eliminar">${FOTOS_SITIO_ICONO_ELIMINAR}</button>
        </div>
      </div>
    `);
  }

  return `
    <div class="foto-espacio">
      <div class="foto-espacio-header">
        <div>
          <strong>${escapeHTMLPersonas(espacio.ubicacionLabel)}</strong>
          <span class="foto-espacio-ubicacion">${escapeHTMLPersonas(espacio.dondeAparece)} · ${docs.length} fotografía${docs.length === 1 ? '' : 's'}</span>
        </div>
        ${badge(docs.length > 0)}
      </div>
      <div class="foto-galeria-grid">
        ${items.join('')}
        <button type="button" class="foto-galeria-agregar" data-foto-agregar="${espacio.seccion}:${espacio.ubicacion}">
          ${FOTOS_SITIO_ICONO_AGREGAR}
          Agregar fotografía
        </button>
      </div>
    </div>
  `;

}

function wireSeccionFotos(cont) {

  cont.querySelectorAll('[data-foto-cambiar], [data-foto-agregar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [seccion, ubicacion] = (btn.getAttribute('data-foto-cambiar') || btn.getAttribute('data-foto-agregar')).split(':');
      const espacio = obtenerEspacioFotoSitio(seccion, ubicacion);
      if (espacio) abrirModalSubirFotoSitio(espacio);
    });
  });

  cont.querySelectorAll('[data-foto-eliminar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-foto-eliminar');
      const doc = obtenerFotosSitioTodas().find(f => f.id === id);
      if (!doc) return;
      const espacio = obtenerEspacioFotoSitio(doc.seccion, doc.ubicacion);
      abrirAutorizacionAdmin({
        titulo: 'Eliminar fotografía',
        peligrosa: true,
        mensaje: `Vas a eliminar la fotografía de <strong>${escapeHTMLPersonas(espacio ? espacio.ubicacionLabel : doc.ubicacion)}</strong>. ${espacio && espacio.tipo === 'unica' ? 'El espacio volverá a mostrar el logo MW mientras no subas otra.' : 'Deja de mostrarse en la galería del sitio público.'}`,
        onConfirmar: () => {
          const resultado = eliminarFotoSitio(id, ADMIN_IDENTIDAD.usuarioNombre);
          if (resultado.ok) {
            if (typeof registrarAuditoriaAdmin === 'function') {
              registrarAuditoriaAdmin({
                modulo: 'fotos-sitio',
                accion: 'eliminar_foto',
                descripcion: `Fotografía eliminada — ${espacio ? `${espacio.seccionLabel} / ${espacio.ubicacionLabel}` : doc.ubicacion}`
              });
            }
            mostrarToast('Fotografía eliminada.');
            renderSeccionFotos();
          }
        }
      });
    });
  });

  cont.querySelectorAll('[data-foto-mover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [id, direccion] = btn.getAttribute('data-foto-mover').split(':');
      const resultado = reordenarFotoSitio(id, Number(direccion), ADMIN_IDENTIDAD.usuarioNombre);
      if (resultado.ok) renderSeccionFotos();
    });
  });

}

function abrirModalSubirFotoSitio(espacio) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '440px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">${FOTOS_SITIO_ICONO_AGREGAR}</div>
    <h3>${escapeHTMLPersonas(espacio.ubicacionLabel)}</h3>
    <p class="modal-sub">${escapeHTMLPersonas(espacio.dondeAparece)}</p>
    <label style="display:block;color:#3b2a54;font-size:11px;font-weight:600;margin:12px 0 6px;">Fotografía</label>
    <input type="file" id="fotoSitioArchivo" accept="image/*">
    <div class="foto-upload-preview" id="fotoSitioPreview">Selecciona una imagen para ver la vista previa aquí.</div>
    <div class="modal-note">JPG, PNG o WEBP — máximo 5 MB. Se muestra automáticamente en el sitio público al guardar.</div>
    <div id="fotoSitioError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="fotoSitioCancelarBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="fotoSitioGuardarBtn" type="button">Guardar</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('fotoSitioCancelarBtn')?.addEventListener('click', cerrar);

  let archivoSeleccionado = null;

  document.getElementById('fotoSitioArchivo')?.addEventListener('change', (e) => {
    const archivo = e.target.files?.[0] || null;
    const error = document.getElementById('fotoSitioError');
    const preview = document.getElementById('fotoSitioPreview');
    error.style.display = 'none';
    archivoSeleccionado = null;

    if (!archivo) return;

    const validacion = validarArchivoFotoSitio(archivo);
    if (!validacion.ok) {
      error.style.display = 'block';
      error.textContent = validacion.error;
      preview.innerHTML = 'Selecciona una imagen para ver la vista previa aquí.';
      return;
    }

    archivoSeleccionado = archivo;
    const url = URL.createObjectURL(archivo);
    preview.innerHTML = `<img src="${url}" alt="">`;
  });

  document.getElementById('fotoSitioGuardarBtn')?.addEventListener('click', async () => {

    const error = document.getElementById('fotoSitioError');
    error.style.display = 'none';

    if (!archivoSeleccionado) {
      error.style.display = 'block';
      error.textContent = 'Selecciona una imagen antes de guardar.';
      return;
    }

    const resultado = await subirFotoSitio({
      seccion: espacio.seccion,
      ubicacion: espacio.ubicacion,
      archivo: archivoSeleccionado,
      actualizadoPor: ADMIN_IDENTIDAD.usuarioNombre
    });

    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }

    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({
        modulo: 'fotos-sitio',
        accion: 'subir_foto',
        descripcion: `Fotografía guardada — ${espacio.seccionLabel} / ${espacio.ubicacionLabel}`
      });
    }

    cerrar();
    mostrarToast('Fotografía guardada — ya se muestra en el sitio público.');
    renderSeccionFotos();

  });

}

// ============================================================
// SECCIÓN: USUARIOS Y PERMISOS (solo lectura + aviso honesto)
// ============================================================

function renderSeccionUsuarios() {

  const cont = document.getElementById('seccion-usuarios');
  const filas = [
    ['Dashboard / Catálogo / Apartados / Calendario / Lista de deseos / Actividad', 'si', 'si', 'si', '—', '—'],
    ['Nómina', 'si', 'si', '—', '—', '—'],
    ['Comisiones', 'si', '—', '—', 'equipo propio', '—'],
    ['Plan MW (seguimiento y alertas)', 'si', '—', '—', '—', '—'],
    ['Solicitudes de inscripción / INE', 'si', '—', '—', '—', '—'],
    ['Configuración', 'si', '—', '—', '—', '—'],
    ['Su propia cuenta / equipo', 'si', 'si', 'si', 'si', 'si']
  ];

  const personas = typeof obtenerPersonas === 'function' ? obtenerPersonas() : [];
  const internas = typeof obtenerCuentasInternas === 'function' ? obtenerCuentasInternas() : [];
  const lideresParaSelect = personas.filter(p => p.tipo === 'lider');

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Usuarios y permisos</h3>
      <p class="cfg-card-sub">Esta tabla es informativa: refleja el acceso que YA existe hoy en el sistema (qué páginas tiene cada rol en su portal), no un panel de permisos editable.</p>
      <div class="catalog-table-wrap cfg-tabla-wrap">
        <table class="catalog-table">
          <thead><tr><th>Permiso</th><th>Administrativo</th><th>RH</th><th>Staff</th><th>Líder</th><th>Emprendedora</th></tr></thead>
          <tbody>
            ${filas.map(f => `<tr>${f.map((c, i) => i === 0 ? `<td>${escapeHTMLPersonas(c)}</td>` : `<td style="text-align:center;">${c === 'si' ? '<span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></span>' : c}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="cfg-disclosure">
        <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span> <strong>Límite de seguridad real:</strong> hoy este acceso se controla solo con qué liga existe en el menú de cada portal (JavaScript) — no hay reglas de seguridad de Firebase todavía, así que técnicamente no es una barrera infranqueable. Ocultar un botón no reemplaza una regla de seguridad real. Esto queda pendiente para cuando el sistema se conecte a Firebase con Security Rules.
        <br><br>
        Tampoco existe hoy más de una cuenta de Administrativo, así que la regla "un admin no puede darse permisos financieros a sí mismo sin confirmación especial" no aplica todavía — se deja documentada aquí para cuando exista un sistema de múltiples cuentas de Admin.
      </div>
    </div>

    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:0.4rem;">
        <div>
          <h3 class="cfg-card-title" style="margin-bottom:0.15rem;">Cuentas — Emprendedoras/Líderes</h3>
          <p class="cfg-card-sub" style="margin-bottom:0;">Crear cuentas nuevas, ver/restablecer su contraseña o eliminarlas.</p>
        </div>
        <button class="btn btn-primary" id="cfgCrearCuentaPersonaBtn" style="width:auto;" type="button">＋ Crear cuenta</button>
      </div>
      <div class="catalog-table-wrap cfg-tabla-wrap" style="margin-top:10px;">
        <table class="catalog-table">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Tipo</th><th>Estado</th><th>Contraseña</th><th>Acciones</th></tr></thead>
          <tbody>
            ${personas.length ? personas.map(p => `
              <tr>
                <td>${escapeHTMLPersonas(nombreCompletoPersona(p))}</td>
                <td>${escapeHTMLPersonas(p.usuario)}</td>
                <td>${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'}</td>
                <td><span class="badge ${p.estado === 'activa' ? 'badge-pagada' : 'badge-pendiente'}">${escapeHTMLPersonas(ESTADOS_CUENTA_PERSONA[p.estado] || p.estado)}</span></td>
                <td style="white-space:nowrap;">
                  <span class="cfg-password-texto" data-password-real="${escapeAttributePersonas(p.password || '(sin contraseña)')}" style="font-family:monospace;">••••••••</span>
                  <button type="button" class="cfg-icon-btn" data-cfg-ver-password title="Mostrar/ocultar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </td>
                <td style="white-space:nowrap;">
                  <button type="button" class="cfg-icon-btn" data-cfg-reset-persona="${p.id}" title="Restablecer contraseña"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13L19 4"/><path d="M15 8l2 2"/></svg></button>
                  <button type="button" class="cfg-icon-btn" data-cfg-eliminar-persona="${p.id}" title="Eliminar cuenta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="6" class="catalog-empty-cell">Todavía no hay cuentas registradas.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>

    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:0.4rem;">
        <div>
          <h3 class="cfg-card-title" style="margin-bottom:0.15rem;">Cuentas internas — Staff / RH / Admin</h3>
          <p class="cfg-card-sub" style="margin-bottom:0;">Sirven para reautorizar acciones en Apartados, Catálogo, Lista de deseos, Nómina y Calendario.</p>
        </div>
        <button class="btn btn-primary" id="cfgCrearCuentaInternaBtn" style="width:auto;" type="button">＋ Crear cuenta</button>
      </div>
      <div class="catalog-table-wrap cfg-tabla-wrap" style="margin-top:10px;">
        <table class="catalog-table">
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Contraseña</th><th>Acciones</th></tr></thead>
          <tbody>
            ${internas.length ? internas.map(c => `
              <tr>
                <td>${escapeHTMLPersonas(c.nombre)}</td>
                <td>${escapeHTMLPersonas(c.usuario)}</td>
                <td>${escapeHTMLPersonas(ROLES_CUENTA_INTERNA[c.rol] || c.rol)}</td>
                <td style="white-space:nowrap;">
                  <span class="cfg-password-texto" data-password-real="${escapeAttributePersonas(c.password || '(sin contraseña)')}" style="font-family:monospace;">••••••••</span>
                  <button type="button" class="cfg-icon-btn" data-cfg-ver-password title="Mostrar/ocultar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg></button>
                </td>
                <td style="white-space:nowrap;">
                  <button type="button" class="cfg-icon-btn" data-cfg-reset-interna="${c.id}" title="Restablecer contraseña"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13L19 4"/><path d="M15 8l2 2"/></svg></button>
                  <button type="button" class="cfg-icon-btn" data-cfg-eliminar-interna="${c.id}" title="Eliminar cuenta"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg></button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="5" class="catalog-empty-cell">Todavía no hay cuentas registradas.</td></tr>`}
          </tbody>
        </table>
      </div>

      <div class="cfg-disclosure">
        <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span> Las contraseñas se guardan en texto plano para que puedas recuperarlas si alguien las olvida — esto es aceptable únicamente porque este portal todavía no tiene un backend real. Con Firebase Auth, esto se reemplazará por "restablecer contraseña" en vez de "ver la contraseña actual".
        <br><br>
        <code>admin01</code> y <code>rh01</code> son las cuentas fijas de esta demo (Claudia y Recursos Humanos). Eliminarlas aquí no cierra su acceso al portal, porque ese acceso todavía no depende de esta lista — es solo la cuenta que usan para reautorizar acciones en Apartados/Catálogo/etc.
      </div>
    </div>
  `;

  wireCuentasPersonas(cont, lideresParaSelect);
  wireCuentasInternas(cont);

  cont.querySelectorAll('[data-cfg-ver-password]').forEach(btn => {
    btn.addEventListener('click', () => {
      const span = btn.previousElementSibling;
      if (!span) return;
      const mostrando = span.textContent === span.dataset.passwordReal;
      span.textContent = mostrando ? '••••••••' : span.dataset.passwordReal;
      btn.innerHTML = mostrando ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3.5 3.5l17 17"/><path d="M10.6 5.2A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a15.6 15.6 0 01-3.4 4.2M6.5 6.6A15.7 15.7 0 002 12s3.5 7 10 7a10.4 10.4 0 004.1-.8"/><path d="M9.9 10a3 3 0 004.1 4.1"/></svg>';
    });
  });

}

// ============================================================
// CUENTAS — Emprendedoras/Líderes
// ============================================================

function wireCuentasPersonas(cont, lideresParaSelect) {

  document.getElementById('cfgCrearCuentaPersonaBtn')?.addEventListener('click', () => abrirModalCrearCuentaPersona(lideresParaSelect));

  cont.querySelectorAll('[data-cfg-reset-persona]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalResetPassword('persona', btn.getAttribute('data-cfg-reset-persona')));
  });

  cont.querySelectorAll('[data-cfg-eliminar-persona]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cfg-eliminar-persona');
      const persona = obtenerPersonaPorId(id);
      if (!persona) return;
      abrirAutorizacionAdmin({
        titulo: 'Eliminar cuenta',
        peligrosa: true,
        mensaje: `Vas a eliminar por completo la cuenta de <strong>${escapeHTMLPersonas(nombreCompletoPersona(persona))}</strong> (${escapeHTMLPersonas(persona.usuario)}). Esta acción no se puede deshacer y puede dejar huérfanas referencias históricas (comisiones, actividad) que la mencionan por id. Si solo quieres desactivarla temporalmente, usa "Estado de cuenta: Baja" en Emprendedoras/Líderes en vez de eliminarla.`,
        onConfirmar: () => {
          const resultado = eliminarPersona(id);
          if (resultado.ok) {
            if (typeof registrarAuditoriaAdmin === 'function') {
              registrarAuditoriaAdmin({
                modulo: 'cuentas',
                accion: 'eliminar_cuenta_persona',
                descripcion: `Cuenta eliminada: ${nombreCompletoPersona(resultado.persona)} (${resultado.persona.usuario})`
              });
            }
            mostrarToast('Cuenta eliminada.');
            renderSeccionUsuarios();
          }
        }
      });
    });
  });

}

function abrirModalCrearCuentaPersona(lideresParaSelect) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '460px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">＋</div>
    <h3>Crear cuenta — Emprendedora/Líder</h3>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label>Nombre(s)<input type="text" id="cfgNuevoNombre"></label>
      <label>Apellidos<input type="text" id="cfgNuevoApellidos"></label>
      <label>Teléfono<input type="text" id="cfgNuevoTelefono"></label>
      <label>Correo<input type="email" id="cfgNuevoCorreo"></label>
      <label>Tipo
        <select id="cfgNuevoTipo">
          <option value="emprendedora">Emprendedora</option>
          <option value="lider">Líder</option>
        </select>
      </label>
      <label>Líder directa
        <select id="cfgNuevoLiderId">
          <option value="">— Ninguna (es líder raíz) —</option>
          ${lideresParaSelect.map(l => `<option value="${l.id}">${escapeHTMLPersonas(nombreCompletoPersona(l))}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="modal-note">El usuario y la contraseña temporal se generan automáticamente — mismo esquema que ya usa Solicitudes de inscripción (usuario MW#### + iniciales del nombre).</div>
    <div id="cfgCrearPersonaError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="cfgCancelarCrearPersonaBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="cfgConfirmarCrearPersonaBtn" type="button">Crear cuenta</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('cfgCancelarCrearPersonaBtn')?.addEventListener('click', cerrar);

  document.getElementById('cfgConfirmarCrearPersonaBtn')?.addEventListener('click', () => {

    const nombre = document.getElementById('cfgNuevoNombre').value.trim();
    const apellidos = document.getElementById('cfgNuevoApellidos').value.trim();
    const telefono = document.getElementById('cfgNuevoTelefono').value.trim();
    const correo = document.getElementById('cfgNuevoCorreo').value.trim();
    const tipo = document.getElementById('cfgNuevoTipo').value;
    const liderId = document.getElementById('cfgNuevoLiderId').value || null;
    const error = document.getElementById('cfgCrearPersonaError');

    if (!nombre || !telefono) {
      error.style.display = 'block';
      error.textContent = 'Nombre y teléfono son obligatorios.';
      return;
    }
    if (typeof existePersonaConCorreoOTelefono === 'function' && existePersonaConCorreoOTelefono(correo, telefono)) {
      error.style.display = 'block';
      error.textContent = 'Ya existe una cuenta con ese correo o teléfono.';
      return;
    }

    const nombreCompleto = [nombre, apellidos].filter(Boolean).join(' ');
    const credenciales = generarCredenciales(nombreCompleto);

    const nuevaPersona = crearPersonaEjemplo({
      id: `persona-${Date.now()}`,
      nombre, apellidos, tipo, categoria: 'normal', estado: 'activa',
      telefono, correo,
      usuario: credenciales.usuario,
      password: credenciales.passwordTemporal,
      numeroCuenta: credenciales.numeroCuenta,
      liderId, invitadaPor: liderId
    });

    const personas = obtenerPersonas();
    personas.push(nuevaPersona);
    guardarPersonas(personas);

    if (typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({
        modulo: 'cuentas',
        accion: 'crear_cuenta_persona',
        descripcion: `Cuenta creada desde Configuración: ${nombreCompleto} (${credenciales.usuario}) — ${tipo === 'lider' ? 'Líder' : 'Emprendedora'}`
      });
    }

    cerrar();
    mostrarToast(`Cuenta creada: ${credenciales.usuario} — contraseña temporal ${credenciales.passwordTemporal}`);
    renderSeccionUsuarios();

  });

}

// ============================================================
// CUENTAS — internas (Staff / RH / Admin)
// ============================================================

function wireCuentasInternas(cont) {

  document.getElementById('cfgCrearCuentaInternaBtn')?.addEventListener('click', abrirModalCrearCuentaInterna);

  cont.querySelectorAll('[data-cfg-reset-interna]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalResetPassword('interna', btn.getAttribute('data-cfg-reset-interna')));
  });

  cont.querySelectorAll('[data-cfg-eliminar-interna]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cfg-eliminar-interna');
      const cuenta = obtenerCuentasInternas().find(c => c.id === id);
      if (!cuenta) return;
      abrirAutorizacionAdmin({
        titulo: 'Eliminar cuenta interna',
        peligrosa: true,
        mensaje: `Vas a eliminar la cuenta de <strong>${escapeHTMLPersonas(cuenta.nombre)}</strong> (${escapeHTMLPersonas(cuenta.usuario)} — ${escapeHTMLPersonas(ROLES_CUENTA_INTERNA[cuenta.rol] || cuenta.rol)}). Ya no podrá usarla para reautorizar acciones.`,
        onConfirmar: () => {
          const resultado = eliminarCuentaInterna(id);
          if (resultado.ok) {
            mostrarToast('Cuenta eliminada.');
            renderSeccionUsuarios();
          }
        }
      });
    });
  });

}

function abrirModalCrearCuentaInterna() {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const sugerida = String(Math.floor(1000 + Math.random() * 9000));

  box.style.maxWidth = '420px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">＋</div>
    <h3>Crear cuenta interna</h3>
    <div class="cfg-form-grid" style="margin-top:10px;">
      <label class="cfg-span-2">Nombre completo<input type="text" id="cfgNuevoNombreInterno"></label>
      <label>Usuario<input type="text" id="cfgNuevoUsuarioInterno" placeholder="Ej. staff08"></label>
      <label>Rol
        <select id="cfgNuevoRolInterno">
          <option value="staff">Staff</option>
          <option value="rh">RH</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label class="cfg-span-2">Contraseña<input type="text" id="cfgNuevaPasswordInterna" value="${sugerida}"></label>
    </div>
    <div id="cfgCrearInternaError" class="auth-error" style="display:none;"></div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="cfgCancelarCrearInternaBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="cfgConfirmarCrearInternaBtn" type="button">Crear cuenta</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('cfgCancelarCrearInternaBtn')?.addEventListener('click', cerrar);

  document.getElementById('cfgConfirmarCrearInternaBtn')?.addEventListener('click', () => {

    const nombre = document.getElementById('cfgNuevoNombreInterno').value.trim();
    const usuario = document.getElementById('cfgNuevoUsuarioInterno').value.trim();
    const rol = document.getElementById('cfgNuevoRolInterno').value;
    const password = document.getElementById('cfgNuevaPasswordInterna').value.trim();
    const error = document.getElementById('cfgCrearInternaError');

    const resultado = crearCuentaInterna({ usuario, nombre, rol, password });
    if (!resultado.ok) {
      error.style.display = 'block';
      error.textContent = resultado.error;
      return;
    }

    cerrar();
    mostrarToast(`Cuenta interna creada: ${usuario}.`);
    renderSeccionUsuarios();

  });

}

// ============================================================
// RESTABLECER CONTRASEÑA (compartido por ambas tablas)
// ============================================================

function abrirModalResetPassword(tipo, id) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  let nombre, usuario;
  if (tipo === 'persona') {
    const persona = obtenerPersonaPorId(id);
    if (!persona) return;
    nombre = nombreCompletoPersona(persona);
    usuario = persona.usuario;
  } else {
    const cuenta = obtenerCuentasInternas().find(c => c.id === id);
    if (!cuenta) return;
    nombre = cuenta.nombre;
    usuario = cuenta.usuario;
  }

  const sugerida = tipo === 'persona'
    ? `${usuario}${generarIniciales(nombre)}`
    : String(Math.floor(1000 + Math.random() * 9000));

  box.style.maxWidth = '400px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13L19 4"/><path d="M15 8l2 2"/></svg></div>
    <h3>Restablecer contraseña</h3>
    <p class="modal-sub">${escapeHTMLPersonas(nombre)} · usuario ${escapeHTMLPersonas(usuario)}</p>
    <label class="cfg-field-label">Nueva contraseña</label>
    <input type="text" id="cfgNuevaPasswordInput" value="${escapeAttributePersonas(sugerida)}">
    <div class="modal-note"><strong>Compártela de forma segura.</strong> Quedará guardada aquí mismo por si la necesitas consultar después.</div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-outline" style="flex:1;" id="cfgCancelarResetBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="cfgConfirmarResetBtn" type="button">Guardar</button>
    </div>
  `;

  overlay.classList.add('open');
  const cerrar = () => overlay.classList.remove('open');
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  document.getElementById('cfgCancelarResetBtn')?.addEventListener('click', cerrar);

  document.getElementById('cfgConfirmarResetBtn')?.addEventListener('click', () => {

    const nueva = document.getElementById('cfgNuevaPasswordInput').value.trim();
    if (!nueva) return;

    const resultado = tipo === 'persona' ? restablecerPasswordPersona(id, nueva) : restablecerPasswordCuentaInterna(id, nueva);
    if (!resultado.ok) return;

    if (tipo === 'persona' && typeof registrarAuditoriaAdmin === 'function') {
      registrarAuditoriaAdmin({
        modulo: 'cuentas',
        accion: 'restablecer_password_persona',
        descripcion: `Contraseña restablecida para ${nombre} (${usuario})`
      });
    }

    cerrar();
    mostrarToast('Contraseña actualizada.');
    renderSeccionUsuarios();

  });

}

// ============================================================
// SECCIÓN: AUDITORÍA
// ============================================================

function renderSeccionAuditoria() {

  const cont = document.getElementById('seccion-auditoria');
  const historial = obtenerHistorialCambiosConfig();

  cont.innerHTML = `
    <div class="cfg-card">
      <h3 class="cfg-card-title">Historial de cambios</h3>
      <p class="cfg-card-sub">Cada modificación hecha desde Configuración queda aquí para siempre — no se puede borrar desde esta pantalla.</p>
      ${historial.length ? `
        <div class="cfg-auditoria-lista">
          ${historial.map(v => `
            <div class="cfg-auditoria-item">
              <div class="cfg-auditoria-fecha">${formatearFechaCfg(v.fechaModificacion)} · ${escapeHTMLPersonas(v.usuarioAdminNombre || v.usuarioAdminId)}</div>
              <div class="cfg-auditoria-campo">${escapeHTMLPersonas(v.seccion)} → ${escapeHTMLPersonas(v.etiqueta)}</div>
              <div class="cfg-auditoria-valores">${formatearValorConfig(v.valorAnterior)} → <strong>${formatearValorConfig(v.valor)}</strong></div>
              <div class="cfg-auditoria-vigencia">Vigente desde ${formatearFechaCfg(v.vigenteDesde)}${v.vigenteHasta ? ` hasta ${formatearFechaCfg(v.vigenteHasta)}` : ''}</div>
              ${v.motivo ? `<div class="cfg-auditoria-motivo">Motivo: ${escapeHTMLPersonas(v.motivo)}</div>` : ''}
            </div>
          `).join('')}
        </div>
      ` : `<p class="bp-sub" style="margin:0;">Todavía no se ha modificado ninguna configuración.</p>`}
    </div>
  `;

}
