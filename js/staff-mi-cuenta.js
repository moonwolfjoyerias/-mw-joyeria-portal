// MW JOYERÍA — Staff: Mi cuenta
//
// Muestra el directorio de personal de Staff (foto, nombre, usuario —
// nunca la contraseña) y permite a cada persona consultar su propio
// recibo de nómina de la semana actual.
//
// SEC-09 de la auditoría: antes, ver un recibo exigía reingresar
// usuario/contraseña de ESE empleado — una comparación en texto plano
// en el navegador, fácil de saltarse desde la consola. Como SEC-02 (la
// ronda de altos) ya cerró el acceso real a nivel de Firestore, este
// candado nunca protegía nada que las reglas no protegieran ya; se
// quitó para no dar una falsa sensación de seguridad.

document.addEventListener('DOMContentLoaded', async () => {

  if (typeof cuentasInternasRepoListo !== 'undefined') await cuentasInternasRepoListo;
  if (typeof nominaRepoListo !== 'undefined') await nominaRepoListo;

  renderEmployeeGrid();
  inicializarEventosMiCuenta();

});


// ============================================================
// DIRECTORIO DE PERSONAL
// ============================================================

// Incluye también las cuentas de Staff creadas desde Admin →
// Configuración → Usuarios y permisos → Cuentas (js/cuentas-internas-modelo.js)
// — sin esto, una cuenta nueva no aparecería aquí ni podría autorizar
// su propio recibo.
function obtenerPersonalStaffTotal() {
  const extra = typeof obtenerCuentasInternas === 'function' ? obtenerCuentasInternas().filter(c => c.rol === 'staff') : [];
  return PERSONAL_STAFF_EJEMPLO.concat(extra);
}

function renderEmployeeGrid() {

  const grid = document.getElementById('employeeGrid');

  if (!grid) return;

  grid.innerHTML = obtenerPersonalStaffTotal().map(empleado => `
    <div class="employee-card">
      <span class="profile-avatar employee-avatar">${obtenerIniciales(empleado.nombre)}</span>
      <strong>${escapeHTML(empleado.nombre)}</strong>
      <span class="catalog-description">Usuario: ${escapeHTML(empleado.usuario)}</span>
      <button class="btn btn-primary" data-nomina="${empleado.usuario}">Ver nómina de la semana actual</button>
    </div>
  `).join('');

}


function obtenerIniciales(nombre) {
  return nombre.split(' ').map(parte => parte[0]).join('').slice(0, 2).toUpperCase();
}


function inicializarEventosMiCuenta() {

  const grid = document.getElementById('employeeGrid');

  if (grid) {
    grid.querySelectorAll('[data-nomina]').forEach(btn => {
      btn.addEventListener('click', () => {
        const empleado = obtenerPersonalStaffTotal().find(e => e.usuario === btn.dataset.nomina);
        if (empleado) abrirReciboNomina(empleado);
      });
    });
  }


  const overlay = document.getElementById('modalOverlay');

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) cerrarModalMiCuenta();
    });
  }

}


// ============================================================
// RECIBO DE NÓMINA
// ============================================================

// Cruza el empleado de esta tarjeta (cuenta de login, sin datos
// financieros) con su registro REAL de Nómina por nombre — mismo
// patrón que empleadoNominaDeCuentaActividadStaff() en
// actividades-staff-modelo.js. Antes esta función mostraba un objeto
// de ejemplo (NOMINA_SEMANA_ACTUAL) genérico, igual para las 8 personas
// de Staff — ahora sí es el periodo real que Encargado capturó (o el borrador
// prellenado con su sueldo base si Encargado todavía no ha capturado nada
// esta semana).
function abrirReciboNomina(empleado) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box) return;

  const empleadoNominaReal = typeof obtenerEmpleadosNomina === 'function'
    ? obtenerEmpleadosNomina().find(e => e.nombre === empleado.nombre)
    : null;

  if (!empleadoNominaReal) {
    box.innerHTML = `
      <button class="modal-close" data-close>×</button>
      <span class="eyebrow">Recibo de nómina</span>
      <h3 style="margin-top:5px;">${escapeHTML(empleado.nombre)}</h3>
      <p class="modal-sub">No encontramos tu registro en Nómina todavía — pide a Encargado que verifique tu alta.</p>
      <button class="btn btn-outline" style="width:100%;" data-close>Cerrar</button>
    `;
    overlay.classList.add('open');
    box.querySelector('[data-close]')?.addEventListener('click', cerrarModalMiCuenta);
    return;
  }

  const periodoKey = obtenerPeriodoActualNomina();
  const periodo = obtenerPeriodoNomina(empleadoNominaReal.id, periodoKey);
  const percepciones = periodo.conceptos.filter(c => c.tipo === 'percepcion');
  const deducciones = periodo.conceptos.filter(c => c.tipo === 'deduccion');

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <span class="eyebrow">Recibo de nómina</span>

    <h3 style="margin-top:5px;">${escapeHTML(empleado.nombre)}</h3>

    <p class="modal-sub">Semana del ${escapeHTML(formatearRangoSemanaNomina(periodoKey))}${!periodo.guardado ? ' — Encargado todavía no ha capturado esta semana' : ''}</p>

    <div class="detail-grid">
      ${percepciones.map(c => `<div><span>${escapeHTML(c.nombre)}</span><strong>$${c.total.toLocaleString('es-MX')} MXN</strong></div>`).join('')}
      ${deducciones.map(c => `<div><span>${escapeHTML(c.nombre)}</span><strong>-$${c.total.toLocaleString('es-MX')} MXN</strong></div>`).join('')}
    </div>

    <div class="modal-note">
      <strong>Total a pagar:</strong> $${periodo.totalAPagar.toLocaleString('es-MX')} MXN
    </div>

    ${periodo.firmaEmpleado?.firmado
      ? `<div class="modal-note"><strong>Firmado de recibido</strong> el ${new Date(periodo.firmaEmpleado.fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })}.</div>`
      : periodo.guardado
        ? `<button class="btn btn-primary" style="width:100%;margin-bottom:8px;" id="firmarReciboBtn">Firmar</button>`
        : ''}
    <button class="btn btn-outline" style="width:100%;" data-close>Cerrar</button>

  `;

  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', cerrarModalMiCuenta);

  document.getElementById('firmarReciboBtn')?.addEventListener('click', () => abrirConfirmarFirmaRecibo(empleado, empleadoNominaReal, periodoKey));

}

// Modal extra de confirmación (Sección "Firmar") — separado del recibo
// para que firmar sea una acción deliberada, no un clic accidental
// sobre el mismo botón que abre el recibo.
function abrirConfirmarFirmaRecibo(empleado, empleadoNominaReal, periodoKey) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>
    <h3>Confirmar firma</h3>
    <p class="modal-sub">¿Confirmas que firmas de recibido esta nómina? Esta acción queda registrada a tu nombre y no se puede deshacer.</p>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" id="cancelarFirmaBtn" type="button">Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" id="confirmarFirmaBtn" type="button">Confirmar</button>
    </div>
  `;
  overlay.classList.add('open');

  const volverAlRecibo = () => abrirReciboNomina(empleado);

  box.querySelector('[data-close]')?.addEventListener('click', volverAlRecibo);
  document.getElementById('cancelarFirmaBtn')?.addEventListener('click', volverAlRecibo);

  document.getElementById('confirmarFirmaBtn')?.addEventListener('click', () => {
    const resultado = firmarReciboNomina(empleadoNominaReal.id, periodoKey, {
      usuarioId: empleado.usuario,
      usuarioNombre: empleado.nombre
    });
    if (!resultado.ok) { mostrarToast(resultado.error); volverAlRecibo(); return; }
    mostrarToast('Firmaste de recibido tu nómina.');
    abrirReciboNomina(empleado);
  });

}


// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalMiCuenta() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}


function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
