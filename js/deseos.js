// MW JOYERÍA — Mi lista de deseos (Emprendedora/Líder)
//
// Antes esto era un prototipo aislado: SOLICITUDES_EJEMPLO se
// reiniciaba en cada carga de página y "Enviar solicitud" nunca
// guardaba nada real — ni siquiera en localStorage de este navegador.
// Ahora usa el mismo modelo real que ya administra Staff/Encargado/
// Admin (js/lista-deseos-modelo.js + js/lista-deseos-firestore-sync.js):
// "Enviar solicitud" crea una solicitud real con destinatario
// "emprendedora" y tu propio personaId — visible de inmediato en la
// pantalla de Lista de deseos de Staff/Encargado/Admin, en cualquier
// dispositivo.
//
// La foto de referencia sigue siendo solo informativa en este
// formulario (el modelo real de Lista de deseos no tiene un campo de
// imagen por pieza) — no se guarda, igual que antes.

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof listaDeseosRepoListo !== 'undefined') await listaDeseosRepoListo;

  renderSolicitudes();
  initFormulario();

  document.addEventListener('click', (e) => {
    document.querySelectorAll('.sc-menu.open').forEach(menu => {
      if (!menu.contains(e.target) && e.target.getAttribute('data-menu-btn') === null) {
        menu.classList.remove('open');
      }
    });
  });
});

function esLiderPortalDeseos() {
  return window.location.pathname.includes('/portal/lider/');
}

function miIdentidadDeseos() {
  return {
    id: typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : null,
    nombre: typeof obtenerNombrePersonaActualPortal === 'function' ? obtenerNombrePersonaActualPortal() : null,
    rol: esLiderPortalDeseos() ? 'lider' : 'emprendedora'
  };
}

function obtenerSolicitudesPropias() {
  const { id } = miIdentidadDeseos();
  return (typeof obtenerListaDeseos === 'function' ? obtenerListaDeseos() : [])
    .filter(s => s.personaId === id)
    .sort((a, b) => (b.fechaCreacion || '').localeCompare(a.fechaCreacion || ''));
}

function initFormulario() {
  const textarea = document.getElementById('deseoDescripcion');
  const counter = document.getElementById('charCounter');
  const form = document.getElementById('deseoForm');
  const fileInput = document.getElementById('deseoFoto');
  const dzText = document.getElementById('dzText');

  if (textarea && counter) {
    textarea.addEventListener('input', () => {
      counter.textContent = `${textarea.value.length}/500`;
    });
  }

  if (fileInput && dzText) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        dzText.textContent = fileInput.files[0].name;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const desc = textarea.value.trim();
      if (!desc) {
        textarea.style.borderColor = '#B3312C';
        textarea.focus();
        return;
      }
      textarea.style.borderColor = '';

      const { id, nombre, rol } = miIdentidadDeseos();
      const resultado = typeof crearSolicitudListaDeseos === 'function'
        ? crearSolicitudListaDeseos({
          destinatario: 'emprendedora',
          personaId: id,
          piezas: [{ producto: desc, cantidad: 1 }],
          creadoPorId: id,
          creadoPorNombre: nombre,
          creadoPorRol: rol
        })
        : { ok: false, error: 'No se pudo conectar con Lista de deseos.' };

      if (!resultado.ok) {
        mostrarToast(resultado.error || 'No se pudo enviar tu solicitud.');
        return;
      }

      renderSolicitudes();
      form.reset();
      if (counter) counter.textContent = '0/500';
      if (dzText) dzText.textContent = 'Arrastra tu imagen aquí o da clic para seleccionar';

      mostrarToast('Tu solicitud fue enviada — nuestro equipo la revisará pronto');
    });
  }
}

function renderSolicitudes() {
  const grid = document.getElementById('solicitudesGrid');
  if (!grid) return;

  const solicitudes = obtenerSolicitudesPropias();

  if (solicitudes.length === 0) {
    grid.innerHTML = '<p style="color:var(--mw-text-muted); grid-column:1/-1;">Aún no has enviado ninguna solicitud.</p>';
    return;
  }

  grid.innerHTML = solicitudes.map((s) => {
    const cfg = ESTADOS_DESEOS[s.estado] || { label: s.estado, mensaje: '' };
    const badgeClase = (typeof BADGE_ESTADOS_LISTA_DESEOS !== 'undefined' && BADGE_ESTADOS_LISTA_DESEOS[s.estado]) || 'badge-pendiente';
    const pieza = s.piezas && s.piezas[0];
    const descripcion = pieza ? pieza.producto : '';
    const titulo = descripcion.length > 40 ? descripcion.slice(0, 40) + '…' : descripcion;
    return `
      <div class="ld-solicitud-card" data-id="${s.id}">
        <div class="sc-top">
          <span class="badge ${badgeClase}">${cfg.label}</span>
          ${s.estado === 'pendiente' ? `
          <button class="sc-menu-btn" data-menu-btn="${s.id}" aria-label="Más opciones">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18" r="1.6"/></svg>
          </button>
          <div class="sc-menu" id="menu-${s.id}">
            <button data-cancelar="${s.id}">Cancelar solicitud</button>
          </div>
          ` : ''}
        </div>
        <div class="sc-body">
          <h4>${escapeHTMLDeseos(titulo)}</h4>
          <p class="sc-desc">${escapeHTMLDeseos(descripcion)}</p>
          <div class="sc-fecha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
            ${formatearFechaDeseos(s.fechaCreacion)}
          </div>
          <div class="sc-status-line">
            <span>${escapeHTMLDeseos(cfg.mensaje)}</span>
            ${cfg.cta ? `<a class="mini-btn" href="${typeof PORTAL_LINKS !== 'undefined' ? PORTAL_LINKS.catalogo : '../catalogo.html'}">Ver en catálogo</a>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('[data-menu-btn]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-menu-btn');
      document.querySelectorAll('.sc-menu.open').forEach(m => { if (m.id !== `menu-${id}`) m.classList.remove('open'); });
      document.getElementById(`menu-${id}`).classList.toggle('open');
    });
  });
  grid.querySelectorAll('[data-cancelar]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-cancelar');
      const { id: miId, nombre, rol } = miIdentidadDeseos();
      actualizarEstadoListaDeseos(id, 'cancelada', { usuarioId: miId, usuarioNombre: nombre, usuarioRol: rol });
      renderSolicitudes();
      mostrarToast('Solicitud cancelada');
    });
  });
}

function formatearFechaDeseos(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  const fechaTexto = fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const horaTexto = fecha.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' });
  return `${fechaTexto} · ${horaTexto}`;
}

function escapeHTMLDeseos(texto) {
  return escapeHTML(texto);
}
