// MW JOYERÍA — Lista de deseos
// Depende de SOLICITUDES_EJEMPLO y ESTADOS_DESEOS (deseos-ejemplo.js).

let solicitudesActuales = [];

document.addEventListener('DOMContentLoaded', () => {
  solicitudesActuales = SOLICITUDES_EJEMPLO.map(s => ({ ...s }));
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

      const nueva = {
        id: 'd' + Date.now(),
        titulo: desc.length > 40 ? desc.slice(0, 40) + '…' : desc,
        descripcion: desc,
        fecha: 'Justo ahora',
        estado: 'pendiente',
        tieneFoto: !!(fileInput.files && fileInput.files[0]),
      };
      solicitudesActuales.unshift(nueva);
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

  if (solicitudesActuales.length === 0) {
    grid.innerHTML = '<p style="color:var(--mw-text-muted); grid-column:1/-1;">Aún no has enviado ninguna solicitud.</p>';
    return;
  }

  grid.innerHTML = solicitudesActuales.map((s) => {
    const cfg = ESTADOS_DESEOS[s.estado];
    return `
      <div class="solicitud-card" data-id="${s.id}">
        <div class="sc-top">
          <span class="status-badge ${s.estado}">${cfg.label}</span>
          <button class="sc-menu-btn" data-menu-btn="${s.id}" aria-label="Más opciones">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="18" r="1.6"/></svg>
          </button>
          <div class="sc-menu" id="menu-${s.id}">
            <button data-cancelar="${s.id}">Cancelar solicitud</button>
          </div>
        </div>
        ${s.tieneFoto ? `
          <div class="sc-photo"><img src="../assets/images/isotipo-morado.png" alt=""></div>
        ` : ''}
        <div class="sc-body">
          <h4>${s.titulo}</h4>
          <p class="sc-desc">${s.descripcion}</p>
          <div class="sc-fecha">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>
            ${s.fecha}
          </div>
          <div class="sc-status-line">
            <span>${cfg.mensaje}</span>
            ${cfg.cta ? `<a class="mini-btn" href="catalogo.html">Ver en catálogo</a>` : ''}
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
      solicitudesActuales = solicitudesActuales.filter(s => s.id !== id);
      renderSolicitudes();
      mostrarToast('Solicitud cancelada');
    });
  });
}
