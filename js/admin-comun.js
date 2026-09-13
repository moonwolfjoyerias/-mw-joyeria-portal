// MW JOYERÍA — Portal Admin: utilidades compartidas
// Usado por las páginas admin-*.html con funcionalidad real
// (Catálogo, Apartados, Calendario, Lista de deseos).
//
// Igual que RH, Admin tiene cuenta individual: NO vuelve a pedir
// credenciales en cada acción sensible. En su lugar, antes de
// ejecutar una acción sensible se muestra un modal de Autorización
// con un mensaje dinámico explicando exactamente qué está a punto de
// pasar (mismo patrón que js/rh-comun.js).
//
// ⚠️ TEMPORAL: localStorage simula la base de datos / Firestore.

// Identidad de quien inició sesión como Admin — antes era un valor fijo
// ('admin01'/'Claudia') sin importar quién entrara; ahora viene de la
// sesión real que crea js/auth-login.js (ver js/auth-guard.js, que se
// carga antes que este archivo en el <head> de cada página).
const ADMIN_IDENTIDAD = (function () {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.rol === 'admin') {
    return { usuarioId: sesion.cuentaId, usuarioNombre: sesion.nombre, rol: 'admin' };
  }
  // Respaldo si por algún motivo no hay sesión (no debería pasar: el
  // guardia de js/auth-guard.js ya manda a login.html antes de esto).
  return { usuarioId: 'admin01', usuarioNombre: 'Claudia', rol: 'admin' };
})();

const ADMIN_AUDITORIA_STORAGE_KEY = 'mw-auditoria-v1';

let _adminAccionConfirmar = null;

// ============================================================
// MODAL DE AUTORIZACIÓN (confirmación, sin credenciales)
// ============================================================

function abrirAutorizacionAdmin({ titulo = 'Autorización', mensaje, peligrosa = false, onConfirmar }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  _adminAccionConfirmar = onConfirmar;

  box.innerHTML = `
    <button class="modal-close" data-close>×</button>
    <div class="auth-icon ${peligrosa ? 'danger' : ''}">${peligrosa ? '!' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 12l5 5L20 6"/></svg>'}</div>
    <h3>${titulo}</h3>
    <p class="modal-sub">${mensaje}</p>
    <div class="modal-note"><strong>Administración.</strong> Esta acción quedará registrada a tu nombre.</div>
    <div style="display:flex;gap:10px;margin-top:6px;">
      <button class="btn btn-outline" style="flex:1;" id="adminCancelarBtn" type="button">Cancelar</button>
      <button class="btn ${peligrosa ? 'btn-danger' : 'btn-primary'}" style="flex:1;" id="adminConfirmarBtn" type="button">Confirmar</button>
    </div>
  `;

  overlay.classList.add('open');

  const cancelar = () => { _adminAccionConfirmar = null; cerrarModalOverlayAdmin(); };

  box.querySelector('[data-close]')?.addEventListener('click', cancelar);
  document.getElementById('adminCancelarBtn')?.addEventListener('click', cancelar);

  document.getElementById('adminConfirmarBtn')?.addEventListener('click', () => {
    const accion = _adminAccionConfirmar;
    _adminAccionConfirmar = null;
    cerrarModalOverlayAdmin();
    if (typeof accion === 'function') accion();
  });

}

function cerrarModalOverlayAdmin() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}


// ============================================================
// AUDITORÍA (preparada para Firebase — misma bitácora que RH)
// ============================================================

function registrarAuditoriaAdmin({ modulo, accion, descripcion }) {

  const registros = obtenerAuditoriaAdmin();

  registros.unshift({
    id: `AUD-${Date.now()}`,
    usuarioId: ADMIN_IDENTIDAD.usuarioId,
    usuarioNombre: ADMIN_IDENTIDAD.usuarioNombre,
    rol: ADMIN_IDENTIDAD.rol,
    modulo,
    accion,
    descripcion,
    fecha: new Date().toISOString()
  });

  localStorage.setItem(ADMIN_AUDITORIA_STORAGE_KEY, JSON.stringify(registros));

}

function obtenerAuditoriaAdmin() {
  try {
    const registros = JSON.parse(localStorage.getItem(ADMIN_AUDITORIA_STORAGE_KEY));
    return Array.isArray(registros) ? registros : [];
  } catch (error) {
    return [];
  }
}

// ============================================================
// CAMPANA DE NOTIFICACIONES — vista de Admin dividida por rol
// ============================================================
//
// Admin es el único rol que ve las tres bandejas a la vez (en vez de
// una sola bandeja filtrada como Emprendedora/Líder, Staff o RH — ver
// initNotifPanel en portal-common.js). Esta función existe solo aquí
// porque admin-comun.js se carga en todas las páginas de Admin; si
// existe, initNotifPanel la usa en vez de su propio render genérico.

// Admin NUNCA ve la bandeja 'emprendedora_lider' (esos avisos son para
// la propia Emprendedora/Líder sobre SU cuenta — boleto de rifa, evento,
// su apartado confirmado — y su link solo tiene sentido dentro de su
// propio portal; mostrarlos aquí llevaba a un 404). Lo que Admin SÍ debe
// ver sobre Emprendedoras/Líderes son los avisos que YA le tocan a ella
// (rolDestino:'admin'): ascensos de rango, solicitudes de inscripción y
// apartados vencidos — divididos del resto de avisos de Administración
// (los que le llegan de RH) usando el campo "origen".
const NOTIF_ADMIN_GRUPOS = [
  { rol: 'admin', origen: 'emprendedora_lider', titulo: 'Emprendedoras/Líderes' },
  { rol: 'admin', origen: 'rh', titulo: 'De Recursos Humanos' },
  { rol: 'staff', titulo: 'Staff' },
  { rol: 'rh', titulo: 'RH' }
];

// Las bandejas 'staff' y 'rh' traen links pensados para mostrarse DENTRO
// del portal de Staff/RH (una clave de PORTAL_LINKS como 'misActividades'
// o 'deseos', o un nombre de archivo literal como "staff-apartados.html"
// / "rh-nomina.html"). Solo 5 de las 14 páginas de Admin definen su
// propio PORTAL_LINKS, así que depender de esa variable llevaba a un 404
// en las otras 9 (empezando por el propio Dashboard). Admin tiene su
// propia página equivalente para cada función compartida (admin-*.html),
// así que este mapa fijo resuelve el link sin importar qué página de
// Admin tenga abierta la campana.
const ADMIN_NOTIF_LINK_MAP = {
  inicio: 'admin-portal.html',
  catalogo: 'admin-catalogo.html',
  apartados: 'admin-apartados.html',
  deseos: 'admin-lista-deseos.html',
  misActividades: 'admin-actividad-staff.html',
  calendario: 'admin-calendario.html',
  notificaciones: 'admin-mi-cuenta.html'
};

function resolverLinkNotifAdmin(link) {
  if (typeof link !== 'string') return link || '';
  if (ADMIN_NOTIF_LINK_MAP[link]) return ADMIN_NOTIF_LINK_MAP[link];
  if (/^(staff|rh)-/.test(link)) return link.replace(/^(staff|rh)-/, 'admin-');
  return link; // Ya es un nombre de archivo admin-*.html (o similar).
}

// Cada bandeja se muestra como un desplegable independiente (<details>)
// en vez de una lista plana larga — más fácil de escanear cuando hay
// varias bandejas con notificaciones a la vez. Se abre automáticamente
// la bandeja que tiene algo sin leer; una bandeja ya vista completa
// queda colapsada hasta que Admin decida abrirla.
function renderNotificacionesAdminAgrupadas(panel, badge) {

  if (!panel) return;

  // Estas 3 revisiones (ascensos de rango, hitos de Constancia y
  // apartados vencidos) antes solo se disparaban desde las 2-3 páginas
  // dueñas de cada tema (Emprendedoras/Líderes, Plan MW, Apartados) —
  // por eso el número de notificaciones sin leer cambiaba según qué
  // página hubiera visitado Admin antes. Se ejecutan aquí porque esta
  // función SÍ corre en las 14 páginas de Admin (personas-ejemplo.js,
  // apartados-modelo.js y plan-mw-admin.js ya se cargan en todas), así
  // el conteo es siempre el mismo sin importar desde dónde se abra la
  // campana.
  if (typeof verificarAscensosPendientes === 'function') verificarAscensosPendientes();
  if (typeof verificarRecompensasConstancia === 'function') verificarRecompensasConstancia();
  if (typeof verificarApartadosVencidosPendientes === 'function') verificarApartadosVencidosPendientes();

  const todas = typeof obtenerNotificacionesCompartidas === 'function' ? obtenerNotificacionesCompartidas() : [];
  const noLeidas = todas.filter(n => !n.leida).length;

  if (badge) {
    if (noLeidas > 0) { badge.textContent = noLeidas; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  }

  const grupos = NOTIF_ADMIN_GRUPOS.map(g => ({
    ...g,
    items: todas.filter(n =>
      (n.rolDestino || 'emprendedora_lider') === g.rol &&
      (!g.origen || (n.origen || 'emprendedora_lider') === g.origen)
    )
  }));

  if (!grupos.some(g => g.items.length)) {
    panel.innerHTML = '<div class="notif-empty">No tienes notificaciones nuevas.</div>';
    return;
  }

  panel.innerHTML = grupos.map(g => {
    if (!g.items.length) return '';
    const noLeidasGrupo = g.items.filter(n => !n.leida).length;
    return `
      <details class="notif-group" ${noLeidasGrupo > 0 ? 'open' : ''}>
        <summary>
          <span>${g.titulo}</span>
          <span class="notif-group-count ${noLeidasGrupo > 0 ? 'sin-leer' : ''}">${noLeidasGrupo > 0 ? noLeidasGrupo : g.items.length}</span>
        </summary>
        <div class="notif-group-items">
          ${g.items.map(n => `
            <a class="notif-item" href="${resolverLinkNotifAdmin(n.link)}" style="${n.leida ? 'opacity:0.6;' : ''}">${n.texto}</a>
          `).join('')}
        </div>
      </details>
    `;
  }).join('');

}
