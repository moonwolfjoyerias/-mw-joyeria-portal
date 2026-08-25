// MW JOYERÍA — Comportamiento compartido del portal privado
// Se usa en el dashboard de cada rol. Depende de que existan (si aplican
// en la página) los elementos con estos IDs/clases, y de los arrays de
// datos de ejemplo (NOTIFICACIONES_EJEMPLO, EVENTOS_EJEMPLO).

document.addEventListener('DOMContentLoaded', () => {
  initNotifPanel();
  initProfileMenu();
  initModal();
  renderEventos();
  initEventsScroll();
});

// ---------- Campana de notificaciones ----------
function initNotifPanel() {
  const bell = document.getElementById('notifBell');
  const panel = document.getElementById('notifPanel');
  const badge = document.getElementById('notifBadge');
  if (!bell || !panel) return;

  const noLeidas = (typeof NOTIFICACIONES_EJEMPLO !== 'undefined')
    ? NOTIFICACIONES_EJEMPLO.filter(n => !n.leida).length : 0;

  if (badge) {
    if (noLeidas > 0) { badge.textContent = noLeidas; badge.style.display = 'flex'; }
    else { badge.style.display = 'none'; }
  }

  if (typeof NOTIFICACIONES_EJEMPLO !== 'undefined' && NOTIFICACIONES_EJEMPLO.length > 0) {
    panel.innerHTML = '<div class="notif-header">Notificaciones</div>' +
      NOTIFICACIONES_EJEMPLO.map(n => `
        <a class="notif-item" href="${(typeof PORTAL_LINKS !== 'undefined' && PORTAL_LINKS[n.link]) || n.link}" style="${n.leida ? 'opacity:0.6;' : ''}">${n.texto}</a>
      `).join('');
  } else {
    panel.innerHTML = '<div class="notif-empty">No tienes notificaciones nuevas.</div>';
  }

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
      <div class="modal-note">⚠️ Vista de prueba: este cambio todavía no se guarda (pendiente de conectar con el sistema real).</div>
      <label for="inputTelefono">Nuevo teléfono</label>
      <input type="tel" id="inputTelefono" placeholder="444 000 0000">
      <button class="btn btn-primary" style="width:100%;" data-close>Guardar</button>
    `,
    foto: `
      <button class="modal-close" data-close>&times;</button>
      <h3>Cambiar foto de perfil</h3>
      <p class="modal-sub">Sube una foto para tu perfil.</p>
      <div class="modal-note">⚠️ Vista de prueba: este cambio todavía no se guarda (pendiente de conectar con el sistema real).</div>
      <label for="inputFoto">Elegir imagen</label>
      <input type="file" id="inputFoto" accept="image/*">
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
  if (!row || typeof EVENTOS_EJEMPLO === 'undefined') return;

  const hoyStr = new Date().toISOString().slice(0, 10);
  const proximos = EVENTOS_EJEMPLO
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
        <a class="event-link" href="${typeof CALENDARIO_HREF !== 'undefined' ? CALENDARIO_HREF : 'calendario.html'}">Ver detalles →</a>
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
