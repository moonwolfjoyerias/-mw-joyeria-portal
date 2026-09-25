// MW JOYERÍA — Portal Encargado: utilidades compartidas
// Usado por todas las páginas encargado-*.html.
//
// A diferencia de Staff (usuario + contraseña en cada acción sensible),
// Encargado tiene cuenta individual: NO vuelve a pedir credenciales. En su
// lugar, antes de ejecutar una acción sensible se muestra un modal de
// Autorización con un mensaje dinámico explicando exactamente qué está
// a punto de pasar (ver PROMPT MAESTRO PORTAL Encargado, secciones 15-20).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.

// Identidad de quien inició sesión como Encargado — antes era un valor fijo
// ('encargado01'/'Encargado') sin importar quién entrara; ahora viene de
// la sesión real que crea js/auth-login.js (ver js/auth-guard.js, que se
// carga antes que este archivo en el <head> de cada página).
const ENCARGADO_IDENTIDAD = (function () {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.rol === 'encargado') {
    return { usuarioId: sesion.cuentaId, usuarioNombre: sesion.nombre, rol: 'encargado' };
  }
  // Respaldo si por algún motivo no hay sesión (no debería pasar: el
  // guardia de js/auth-guard.js ya manda a login.html antes de esto).
  return { usuarioId: 'encargado01', usuarioNombre: 'Encargado', rol: 'encargado' };
})();

const ENCARGADO_AUDITORIA_STORAGE_KEY = 'mw-auditoria-v1';

let _encargadoAccionConfirmar = null;

// ============================================================
// MODAL DE AUTORIZACIÓN (confirmación, sin credenciales)
// ============================================================

// onConfirmar: función que ejecuta la acción real cuando el usuario
// pulsa "Confirmar". peligrosa: true para acciones destructivas
// (eliminar, cancelar) — cambia el color del ícono y del botón.
function abrirAutorizacionEncargado({ titulo = 'Autorización', mensaje, peligrosa = false, onConfirmar }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  _encargadoAccionConfirmar = onConfirmar;

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon ${peligrosa ? 'danger' : ''}">${peligrosa ? '!' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg>'}</div>
    <h3>${titulo}</h3>
    <p class="modal-sub">${mensaje}</p>
    <div class="modal-note"><strong>Encargado.</strong> Esta acción quedará registrada a tu nombre.</div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" id="encargadoCancelarBtn" type="button">Cancelar</button>
      <button class="btn ${peligrosa ? 'btn-danger' : 'btn-primary'}" style="flex:1;" id="encargadoConfirmarBtn" type="button">Confirmar</button>
    </div>
  `;

  overlay.classList.add('open');

  const cancelar = () => { _encargadoAccionConfirmar = null; cerrarModalOverlayEncargado(); };

  box.querySelector('[data-close]')?.addEventListener('click', cancelar);
  document.getElementById('encargadoCancelarBtn')?.addEventListener('click', cancelar);

  document.getElementById('encargadoConfirmarBtn')?.addEventListener('click', () => {
    const accion = _encargadoAccionConfirmar;
    _encargadoAccionConfirmar = null;
    cerrarModalOverlayEncargado();
    if (typeof accion === 'function') accion();
  });

}

function cerrarModalOverlayEncargado() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}


// ============================================================
// AUDITORÍA (preparada para Firebase)
// ============================================================

// Registra únicamente acciones que modifican, crean, eliminan o
// cambian estados — nunca búsquedas, filtros o navegación.
function registrarAuditoriaEncargado({ modulo, accion, descripcion }) {

  const registros = obtenerAuditoriaEncargado();

  registros.unshift({
    id: `AUD-${Date.now()}`,
    usuarioId: ENCARGADO_IDENTIDAD.usuarioId,
    usuarioNombre: ENCARGADO_IDENTIDAD.usuarioNombre,
    rol: ENCARGADO_IDENTIDAD.rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(ENCARGADO_AUDITORIA_STORAGE_KEY, JSON.stringify(registros));

}

function obtenerAuditoriaEncargado() {
  try {
    const registros = JSON.parse(localStorage.getItem(ENCARGADO_AUDITORIA_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

// ============================================================
// PERMISOS POR MÓDULO (ver MODULOS_PERMISO_ENCARGADO en
// js/cuentas-internas-modelo.js) — a diferencia de Staff (una sola
// cuenta compartida, sin permisos por persona), cada cuenta de
// Encargado trae su propio permiso por módulo. Inicio y Mi cuenta
// siempre están disponibles (no aparecen en este mapa) — todo lo demás
// se oculta del menú, y si alguien llega directo a la URL sin permiso,
// se le regresa a Inicio.
// ============================================================

const ENCARGADO_MODULO_POR_PAGINA = {
  'encargado-nomina.html': 'nomina',
  'encargado-actividad-staff.html': 'actividadesStaff',
  'encargado-catalogo.html': 'catalogo',
  'encargado-apartados.html': 'apartados',
  'encargado-lista-deseos.html': 'listaDeseos',
  'encargado-calendario.html': 'calendario',
  'encargado-actividad.html': 'actividad'
};

function obtenerCuentaEncargadoActual() {
  return typeof obtenerCuentasInternas === 'function'
    ? obtenerCuentasInternas().find(c => c.id === ENCARGADO_IDENTIDAD.usuarioId) || null
    : null;
}

function aplicarPermisosEncargadoEnPagina() {

  const cuenta = obtenerCuentaEncargadoActual();
  if (!cuenta || typeof tienePermisoEncargado !== 'function') return;

  document.querySelectorAll('.sidebar nav a[href]').forEach(link => {
    const archivo = link.getAttribute('href').split('/').pop();
    const modulo = ENCARGADO_MODULO_POR_PAGINA[archivo];
    if (modulo && !tienePermisoEncargado(cuenta, modulo)) link.remove();
  });

  const paginaActual = window.location.pathname.split('/').pop();
  const moduloActual = ENCARGADO_MODULO_POR_PAGINA[paginaActual];
  if (moduloActual && !tienePermisoEncargado(cuenta, moduloActual)) {
    window.location.replace('encargado-portal.html');
  }

}

document.addEventListener('DOMContentLoaded', aplicarPermisosEncargadoEnPagina);
