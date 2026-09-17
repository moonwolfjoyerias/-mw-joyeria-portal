// MW JOYERÍA — Staff: Mi cuenta
//
// Muestra el directorio de personal de Staff (foto, nombre, usuario —
// nunca la contraseña) y permite a cada persona consultar su propio
// recibo de nómina de la semana actual.
//
// Por seguridad, la autorización para ver un recibo debe coincidir
// exactamente con la persona de esa tarjeta: nadie puede ver el recibo
// de alguien más aunque tenga credenciales válidas de otro compañero.

let empleadoNominaPendiente = null;

document.addEventListener('DOMContentLoaded', () => {

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
      btn.addEventListener('click', () => abrirAutorizacionNomina(btn.dataset.nomina));
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
// AUTORIZACIÓN PARA VER EL RECIBO
// ============================================================

function abrirAutorizacionNomina(usuario) {

  empleadoNominaPendiente = obtenerPersonalStaffTotal().find(e => e.usuario === usuario);

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  if (!overlay || !box || !empleadoNominaPendiente) return;

  box.innerHTML = `

    <button class="modal-close" data-close>×</button>

    <div class="auth-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg></div>

    <h3>Autorizar consulta de nómina</h3>

    <p class="modal-sub">
      Solo ${escapeHTML(empleadoNominaPendiente.nombre)} puede ver este recibo.
      Ingresa tu nombre de usuario y contraseña para confirmarlo.
    </p>

    <div class="modal-context">
      <span>Empleado</span><strong>${escapeHTML(empleadoNominaPendiente.nombre)}</strong>
      <span>Usuario</span><strong>${escapeHTML(empleadoNominaPendiente.usuario)}</strong>
    </div>

    <div class="auth-warning">
      <span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg></span>
      <div>
        <strong>Recibo personal</strong>
        <small>Nadie más puede ver tu nómina, ni tú la de otra persona.</small>
      </div>
    </div>

    <label for="nominaUsuario">Usuario de empleado</label>
    <input id="nominaUsuario" type="text" autocomplete="username" placeholder="Ej. staff01">

    <label for="nominaPassword">Contraseña</label>
    <div class="password-wrap">
      <input id="nominaPassword" type="password" autocomplete="current-password" placeholder="Contraseña">
      <button type="button" id="mostrarPasswordNomina">Ver</button>
    </div>

    <div id="authError" style="display:none;" class="auth-error"></div>

    <button class="btn btn-primary" id="autorizarNominaBtn" style="width:100%;">Autorizar y ver recibo</button>

  `;

  overlay.classList.add('open');

  document.getElementById('mostrarPasswordNomina')?.addEventListener('click', () => {
    const input = document.getElementById('nominaPassword');
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('autorizarNominaBtn')?.addEventListener('click', validarAutorizacionNomina);

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    empleadoNominaPendiente = null;
    cerrarModalMiCuenta();
  });

  setTimeout(() => document.getElementById('nominaUsuario')?.focus(), 100);

}


function validarAutorizacionNomina() {

  const usuario = document.getElementById('nominaUsuario')?.value.trim();
  const password = document.getElementById('nominaPassword')?.value;
  const error = document.getElementById('authError');

  // La coincidencia debe ser exactamente con el empleado de la tarjeta
  // que se presionó, no con cualquier credencial válida de Staff.
  const coincide =
    empleadoNominaPendiente &&
    empleadoNominaPendiente.usuario === usuario &&
    empleadoNominaPendiente.password === password;

  if (!coincide) {

    if (error) {
      error.style.display = 'block';
      error.textContent = 'Usuario o contraseña incorrectos, o no coinciden con este empleado.';
    }

    return;

  }

  abrirReciboNomina(empleadoNominaPendiente);

}


// ============================================================
// RECIBO DE NÓMINA
// ============================================================

// Cruza el empleado de esta tarjeta (cuenta de login, sin datos
// financieros) con su registro REAL de Nómina por nombre — mismo
// patrón que empleadoNominaDeCuentaActividadStaff() en
// actividades-staff-modelo.js. Antes esta función mostraba un objeto
// de ejemplo (NOMINA_SEMANA_ACTUAL) genérico, igual para las 8 personas
// de Staff — ahora sí es el periodo real que RH capturó (o el borrador
// prellenado con su sueldo base si RH todavía no ha capturado nada
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
      <p class="modal-sub">No encontramos tu registro en Nómina todavía — pide a RH que verifique tu alta.</p>
      <button class="btn btn-outline" style="width:100%;" data-close>Cerrar</button>
    `;
    overlay.classList.add('open');
    box.querySelector('[data-close]')?.addEventListener('click', () => {
      empleadoNominaPendiente = null;
      cerrarModalMiCuenta();
    });
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

    <p class="modal-sub">Semana del ${escapeHTML(formatearRangoSemanaNomina(periodoKey))}${!periodo.guardado ? ' — RH todavía no ha capturado esta semana' : ''}</p>

    <div class="detail-grid">
      ${percepciones.map(c => `<div><span>${escapeHTML(c.nombre)}</span><strong>$${c.total.toLocaleString('es-MX')} MXN</strong></div>`).join('')}
      ${deducciones.map(c => `<div><span>${escapeHTML(c.nombre)}</span><strong>-$${c.total.toLocaleString('es-MX')} MXN</strong></div>`).join('')}
    </div>

    <div class="modal-note">
      <strong>Total a pagar:</strong> $${periodo.totalAPagar.toLocaleString('es-MX')} MXN
    </div>

    <button class="btn btn-outline" style="width:100%;" data-close>Cerrar</button>

  `;

  overlay.classList.add('open');

  box.querySelector('[data-close]')?.addEventListener('click', () => {
    empleadoNominaPendiente = null;
    cerrarModalMiCuenta();
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
