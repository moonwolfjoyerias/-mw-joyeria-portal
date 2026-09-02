// MW JOYERÍA — Pestaña "Actividad" (Staff / RH / Admin)
// Muestra la bitácora compartida (js/auditoria-modelo.js): quién hizo
// qué y cuándo, en los 3 portales internos.

const MODULOS_ACTIVIDAD = {
  catalogo: 'Catálogo',
  apartados: 'Apartados',
  calendario: 'Calendario',
  lista_deseos: 'Lista de deseos',
  personas: 'Personas'
};

const ROLES_ACTIVIDAD = {
  staff: 'Staff',
  rh: 'RH',
  admin: 'Admin'
};

document.addEventListener('DOMContentLoaded', () => {

  // ACTIVIDAD_ROL_VISOR lo declara cada portal en su propio <script>
  // inline (admin/rh/staff-actividad.html). Solo Admin puede ver las
  // acciones de Admin — Staff y RH nunca las ven, aunque las suyas
  // propias sí quedan visibles entre ellos.
  if (typeof ACTIVIDAD_ROL_VISOR !== 'undefined' && ACTIVIDAD_ROL_VISOR !== 'admin') {
    document.querySelector('#filtroRolActividad option[value="admin"]')?.remove();
  }

  renderActividad();

  const filtro = document.getElementById('filtroRolActividad');
  if (filtro) filtro.addEventListener('change', renderActividad);

});

function renderActividad() {

  const wrap = document.getElementById('actividadBody');
  if (!wrap) return;

  const rolFiltro = document.getElementById('filtroRolActividad')?.value || '';
  const puedeVerAdmin = typeof ACTIVIDAD_ROL_VISOR === 'undefined' || ACTIVIDAD_ROL_VISOR === 'admin';

  const registros = obtenerAuditoriaCompartida()
    .filter(r => puedeVerAdmin || r.rol !== 'admin')
    .filter(r => !rolFiltro || r.rol === rolFiltro);

  const count = document.getElementById('actividadCount');
  if (count) count.textContent = `${registros.length} ${registros.length === 1 ? 'acción' : 'acciones'}`;

  if (!registros.length) {
    wrap.innerHTML = `
      <tr>
        <td colspan="3" class="catalog-empty-cell">
          <strong>Todavía no hay acciones registradas</strong>
          <span>Las acciones de Staff, RH y Admin aparecerán aquí en cuanto ocurran.</span>
        </td>
      </tr>
    `;
    return;
  }

  wrap.innerHTML = registros.map(renderFilaActividad).join('');

}

function renderFilaActividad(r) {

  const inicial = (r.usuarioNombre || '?').trim().charAt(0).toUpperCase();
  const rolLabel = ROLES_ACTIVIDAD[r.rol] || r.rol || '';
  const moduloLabel = MODULOS_ACTIVIDAD[r.modulo] || r.modulo || '';

  return `
    <tr>
      <td>
        <div class="activity-person">
          <span class="activity-avatar">${escapeHTMLActividad(inicial)}</span>
          <div>
            <strong>${escapeHTMLActividad(r.usuarioNombre || 'Usuario')}</strong>
            <span class="badge">${escapeHTMLActividad(rolLabel)}</span>
          </div>
        </div>
      </td>
      <td>
        <span class="activity-modulo">${escapeHTMLActividad(moduloLabel)}</span>
        <div class="catalog-description">${escapeHTMLActividad(r.descripcion || '')}</div>
      </td>
      <td><span class="activity-fecha">${formatearFechaActividad(r.fecha)}</span></td>
    </tr>
  `;

}

function formatearFechaActividad(fechaISO) {

  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '';

  return fecha.toLocaleString('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

}

function escapeHTMLActividad(texto) {

  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}
