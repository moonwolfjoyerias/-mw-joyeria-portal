// MW JOYERÍA — Comportamiento compartido del portal privado
// Se usa en el dashboard de cada rol. Depende de que existan (si aplican
// en la página) los elementos con estos IDs/clases, y de los arrays de
// datos de ejemplo (NOTIFICACIONES_EJEMPLO, EVENTOS_EJEMPLO).

document.addEventListener('DOMContentLoaded', async () => {
  // FASE 2 (Firebase): el badge de notificaciones de Admin (dentro de
  // initNotifPanel → admin-comun.js) revisa apartados vencidos — espera
  // a que la caché tenga datos reales antes de calcular ese conteo.
  if (typeof apartadosRepoListo !== 'undefined') await apartadosRepoListo;
  if (typeof notificacionesRepoListo !== 'undefined') await notificacionesRepoListo;
  initNotifPanel();
  initProfileMenu();
  initTemaMenu();
  initModal();
  renderEventos();
  initEventsScroll();
  initResumenDatePill();
  initSidebarMovil();
});

// ---------- UI-01 de la auditoría: menú lateral colapsable en móvil ----------
// Antes, en una pantalla angosta, .sidebar se apilaba COMPLETA (los
// 10-15 enlaces del menú) arriba de .main-content en los 5 roles —
// había que desplazarse por todo el menú antes de llegar al contenido
// de cada página. Se agrega aquí (una sola vez, para las 44 páginas del
// portal que cargan este archivo) un botón de hamburguesa que colapsa
// <nav> dentro de .sidebar; la regla de qué se ve en cada ancho vive en
// css/styles.css (.sidebar nav / .sidebar.sidebar-abierta nav).
function initSidebarMovil() {
  const sidebar = document.querySelector('.sidebar');
  const nav = sidebar?.querySelector('nav');
  const brand = sidebar?.querySelector('.brand-link');
  if (!sidebar || !nav || !brand) return;

  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'sidebar-toggle';
  boton.setAttribute('aria-label', 'Abrir/cerrar menú');
  boton.setAttribute('aria-expanded', 'false');
  boton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>';
  boton.addEventListener('click', () => {
    const abierta = sidebar.classList.toggle('sidebar-abierta');
    boton.setAttribute('aria-expanded', String(abierta));
  });
  brand.after(boton);

  // Si cambia de tamaño (o al navegar a otra página del portal) nunca
  // debe quedar "abierta" heredada en un ancho donde ya no aplica.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 720) sidebar.classList.remove('sidebar-abierta');
  });
}

// ---------- Iniciales a partir de un nombre ----------
// Ej. "María Camila" → "MC". Reutilizable en cualquier burbuja de
// perfil (encabezado, tarjeta de Mi cuenta, avatares en tablas) para
// que dejen de estar escritas a mano — solo hace falta pasarle el
// nombre real de la cuenta cuando exista.
function obtenerInicialesPerfil(nombre) {
  return String(nombre || '').trim().split(/\s+/).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');
}

// ---------- Nombre de la persona con sesión abierta (Emprendedora/Líder) ----------
// Antes esto siempre devolvía a 'me-emprendedora' / 'me-lider' (los
// registros de ejemplo de js/personas-ejemplo.js), sin importar quién
// hubiera iniciado sesión de verdad. Ahora usa la sesión real que crea
// js/auth-login.js (ver js/auth-guard.js) — se usa para que las
// notificaciones a Staff/Encargado digan explícitamente de quién se trata en
// vez de un genérico "una emprendedora" (ver js/catalogo.js, js/apartados.js).
function obtenerNombrePersonaActualPortal() {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.tipo === 'persona' && sesion.nombre) return sesion.nombre;

  // Respaldo si por algún motivo no hay sesión (no debería pasar: el
  // guardia de js/auth-guard.js ya manda a login.html antes de esto).
  if (typeof obtenerPersonaPorId !== 'function') return null;
  const esLider = window.location.pathname.includes('/portal/lider/');
  const persona = obtenerPersonaPorId(esLider ? 'me-lider' : 'me-emprendedora');
  if (!persona) return null;
  return typeof nombreCompletoPersona === 'function' ? nombreCompletoPersona(persona) : persona.nombre;
}

// ---------- Id real (personas-ejemplo.js) de la persona con sesión abierta ----------
// El id real de la sesión (sesion.personaId), NO un slug derivado del
// nombre — 'me-lider'/'me-emprendedora' no son slugs de sus nombres de
// display ("Líder"/"Claudia Ramírez"), así que usar slugUsuarioId(nombre)
// aquí generaría un id distinto al persona.id real, rompiendo el cruce
// con el perfil de Admin y entre páginas (Catálogo/Apartar vs. Mis
// apartados). Úsalo en vez de slugUsuarioId() para todo lo que necesite
// identificar a la persona real (ventanas de apartado, crédito, etc.).
function obtenerIdPersonaActualPortal() {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  if (sesion && sesion.tipo === 'persona' && sesion.personaId) return sesion.personaId;
  const esLider = window.location.pathname.includes('/portal/lider/');
  return esLider ? 'me-lider' : 'me-emprendedora';
}

// ---------- Fecha del día (pill "Resumen operativo" en Apartados) ----------
function initResumenDatePill() {
  const el = document.getElementById('summaryDate');
  if (!el) return;
  const texto = new Date().toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  el.textContent = texto.charAt(0).toUpperCase() + texto.slice(1);
}

// FEAT-03 pedida tras lanzar a producción: un aviso de lista de deseos
// "ya está disponible" trae productoId (ver agregarNotificacion en
// notificaciones-modelo.js) — se agrega como ?apartar=<id> a la URL ya
// resuelta por PORTAL_LINKS, para que catalogo.js abra el modal de
// Apartar directo en ese producto en vez de solo llevarla al catálogo.
function resolverHrefNotificacion(n) {
  const base = (typeof PORTAL_LINKS !== 'undefined' && PORTAL_LINKS[n.link]) || n.link;
  if (!n.productoId) return base;
  return `${base}${base.includes('?') ? '&' : '?'}apartar=${encodeURIComponent(n.productoId)}`;
}

// ---------- Campana de notificaciones ----------
// Cada rol solo ve su propia bandeja (Emprendedora/Líder, Staff o Encargado),
// detectada automáticamente por la URL — ver obtenerRolPortalActual()
// en notificaciones-modelo.js. Admin es la única excepción: en vez de
// una bandeja filtrada, ve las tres divididas (renderNotificacionesAdminAgrupadas
// en admin-comun.js, si esta página la cargó).
function initNotifPanel() {
  const bell = document.getElementById('notifBell');
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('notifBadge');
  if (!bell || !panel) return;

  renderNotifPanelPropio(panel, badge);
  wireNotifBellToggle(bell, panel);
}

// NOTIF-04 de la auditoría: separado de initNotifPanel para poder
// repintar la campana cada vez que llega algo nuevo por la suscripción
// en vivo de notificaciones-firestore-sync.js (ver
// actualizarPanelNotificacionesEnVivo más abajo) sin volver a enganchar
// el clic de abrir/cerrar — wireNotifBellToggle no es idempotente
// (apila un listener nuevo cada vez que se llama), así que solo se
// llama UNA vez, desde initNotifPanel.
function renderNotifPanelPropio(panel, badge) {
  if (typeof renderNotificacionesAdminAgrupadas === 'function') {
    renderNotificacionesAdminAgrupadas(panel, badge);
    return;
  }

  // Si la página cargó js/notificaciones-modelo.js, la lista puede
  // crecer en vivo (por ejemplo, al aprobar/rechazar una Solicitud de
  // inscripción) y se filtra por la bandeja del rol actual. Si no, se
  // mantiene el arreglo estático de siempre (ya solo tiene ejemplos de
  // la bandeja de Emprendedora/Líder).
  const rolActual = typeof obtenerRolPortalActual === 'function' ? obtenerRolPortalActual() : null;
  let notificaciones;
  if (typeof obtenerNotificacionesPorRol === 'function' && rolActual) {
    notificaciones = obtenerNotificacionesPorRol(rolActual);
  } else if (typeof obtenerNotificacionesCompartidas === 'function') {
    notificaciones = obtenerNotificacionesCompartidas();
  } else if (typeof NOTIFICACIONES_EJEMPLO !== 'undefined') {
    notificaciones = rolActual ? NOTIFICACIONES_EJEMPLO.filter(n => (n.rolDestino || 'emprendedora_lider') === rolActual) : NOTIFICACIONES_EJEMPLO;
  } else {
    notificaciones = [];
  }

  const noLeidas = notificaciones.filter(n => !n.leida).length;

  if (badge) {
    if (noLeidas > 0) { badge.textContent = noLeidas; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  }

  if (notificaciones.length > 0) {
    panel.innerHTML = '<div class="notif-header">Notificaciones</div>' +
      notificaciones.map(n => `
        <div class="notif-item-row">
          <a class="notif-item" data-notif-id="${n.id}" href="${resolverHrefNotificacion(n)}" style="${n.leida ? 'opacity:0.6;' : ''}">${n.texto}</a>
          <button type="button" class="notif-delete-btn" data-notif-delete="${n.id}" aria-label="Borrar notificación" title="Borrar">&times;</button>
        </div>
      `).join('');
  } else {
    panel.innerHTML = '<div class="notif-empty">No tienes notificaciones nuevas.</div>';
  }
}

// Llamada desde notificaciones-firestore-sync.js cada vez que la
// suscripción en vivo trae un cambio — vuelve a pintar la campana con
// los datos ya actualizados en NOTIFICACIONES_CACHE, sin esperar a que
// la persona refresque la página.
function actualizarPanelNotificacionesEnVivo() {
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('notifBadge');
  if (!panel) return;
  renderNotifPanelPropio(panel, badge);
}

// Abrir/cerrar el panel al hacer clic en la campana — se reutiliza tal
// cual para el panel agrupado de Admin.
function wireNotifBellToggle(bell, panel) {
  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    closeProfileMenu();
    panel.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && e.target !== bell) panel.classList.remove('open');
  });
}

// ---------- Menú de perfil ----------
function closeProfileMenu() {
  const menu = document.getElementById('profileMenu');
  if (menu) menu.classList.remove('open');
}

function initProfileMenu() {
  const btn = document.getElementById('profileBtn');
  const menu = document.getElementById('profileMenu');
  if (!btn || !menu) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const notifPanel = document.getElementById('notifPanel');
    if (notifPanel) notifPanel.classList.remove('open');
    menu.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && e.target !== btn) menu.classList.remove('open');
  });
}

// ---------- Tema (claro/oscuro) en la burbuja de perfil ----------
// El botón/opciones se inyectan aquí (no se escriben a mano en las 46
// páginas del portal) porque todas comparten el mismo #profileMenu —
// aplicar el tema en sí (antes de pintar la página) vive en
// js/auth-guard.js, que se carga primero.
function initTemaMenu() {
  const menu = document.getElementById('profileMenu');
  if (!menu || typeof establecerTema !== 'function') return;

  const bloque = document.createElement('div');
  bloque.className = 'profile-menu-tema';
  bloque.innerHTML = `
    <span class="profile-menu-tema-label">Tema</span>
    <div class="profile-menu-tema-opciones">
      <button type="button" data-tema-opcion="claro">Claro</button>
      <button type="button" data-tema-opcion="oscuro">Oscuro</button>
    </div>
  `;

  const cerrarSesionLink = menu.querySelector('a.danger');
  if (cerrarSesionLink) menu.insertBefore(bloque, cerrarSesionLink);
  else menu.appendChild(bloque);

  const marcarOpcionActiva = () => {
    const actual = obtenerTemaGuardado();
    bloque.querySelectorAll('[data-tema-opcion]').forEach(btn => {
      btn.classList.toggle('activo', btn.getAttribute('data-tema-opcion') === actual);
    });
  };
  marcarOpcionActiva();

  bloque.querySelectorAll('[data-tema-opcion]').forEach(btn => {
    btn.addEventListener('click', () => {
      establecerTema(btn.getAttribute('data-tema-opcion'));
      marcarOpcionActiva();
    });
  });
}

// ---------- Modal (cambiar teléfono / foto de perfil) ----------
function initModal() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const templates = {
    telefono: `
      <button class="modal-close" data-close>&times;</button>
      <h3>Cambiar teléfono</h3>
      <p class="modal-sub">Actualiza el número donde te podemos contactar.</p>
      <div class="modal-note"><span class="icon-inline"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3.5L2.5 20h19L12 3.5z"/><path d="M12 9.5v5"/><circle cx="12" cy="17" r="0.75" fill="currentColor" stroke="none"/></svg></span> Vista de prueba: este cambio todavía no se guarda (pendiente de conectar con el sistema real).</div>
      <label for="inputTelefono">Nuevo teléfono</label>
      <input type="tel" id="inputTelefono" placeholder="444 000 0000">
      <button class="btn btn-primary" style="width:100%;" data-close>Guardar</button>
    `,
  };

  document.querySelectorAll('[data-modal]').forEach((trigger) => {
    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      const key = trigger.getAttribute('data-modal');
      box.innerHTML = templates[key] || '';
      overlay.classList.add('open');
      closeProfileMenu();
    });
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.hasAttribute('data-close')) {
      overlay.classList.remove('open');
    }
  });
}

// ---------- Utilidad de fechas (compartida) ----------
const MESES_CORTOS = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
const DIAS_CORTOS = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];

function formatearFechaCorta(fechaISO) {
  const [y, m, d] = fechaISO.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return {
    dia: String(d).padStart(2, '0'),
    mes: MESES_CORTOS[m - 1],
    diaSemana: DIAS_CORTOS[fecha.getDay()],
  };
}

// ---------- Próximos eventos ----------
function renderEventos() {
  const row = document.getElementById('eventsRow');
  if (!row) return;

  // Igual que las notificaciones más arriba: se intenta primero el
  // calendario real (refleja altas/ediciones/bajas hechas desde el
  // módulo de Calendario) y solo se cae al arreglo de ejemplo si esta
  // página no cargó eventos-modelo.js.
  let eventos;
  if (typeof cargarEventosCompartidos === 'function') {
    eventos = cargarEventosCompartidos();
  } else if (typeof EVENTOS_EJEMPLO !== 'undefined') {
    eventos = EVENTOS_EJEMPLO;
  } else {
    return;
  }

  const hoyStr = new Date().toISOString().slice(0, 10);
  const proximos = eventos
    .filter(ev => ev.fecha >= hoyStr)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  row.innerHTML = proximos.map((ev) => {
    const { dia, mes, diaSemana } = formatearFechaCorta(ev.fecha);
    return `
    <div class="event-card">
      <div class="event-date-box">
        <span class="mes">${mes}</span>
        <span class="dia">${dia}</span>
        <span class="dia-semana">${diaSemana}</span>
      </div>
      <div class="event-photo"></div>
      <div class="event-body">
        <h4>${ev.titulo}</h4>
        <div class="event-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
          ${ev.hora}
        </div>
        <div class="event-meta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s7-7.58 7-12a7 7 0 10-14 0c0 4.42 7 12 7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>
          ${ev.lugarTexto}
        </div>
        <a class="event-link" href="${(typeof PORTAL_LINKS !== 'undefined' && PORTAL_LINKS.calendario) || 'calendario.html'}">Ver detalles →</a>
      </div>
    </div>
  `;
  }).join('');
}

function initEventsScroll() {
  const btn = document.getElementById('eventsScrollBtn');
  const row = document.getElementById('eventsRow');
  if (!btn || !row) return;
  btn.addEventListener('click', () => {
    row.scrollBy({ left: 320, behavior: 'smooth' });
  });
}

// ---------- Toast (aviso flotante reutilizable) ----------
function mostrarToast(mensaje) {
  let toast = document.getElementById('appToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'appToast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 3000);
}
