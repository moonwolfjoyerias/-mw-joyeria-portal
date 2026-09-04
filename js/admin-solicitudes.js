// MW JOYERÍA — Admin: Solicitudes de inscripción
//
// Ver, buscar, filtrar y resolver (aprobar/rechazar) las solicitudes
// que Emprendedoras y Líderes envían desde "Mi cuenta". Reutiliza
// js/solicitudes-modelo.js para toda la lógica (nada de datos ni
// reglas paralelas), y js/admin-comun.js para la autorización
// administrativa (abrirAutorizacionAdmin) y la bitácora
// (registrarAuditoriaAdmin, ya usada dentro de solicitudes-modelo.js).

document.addEventListener('DOMContentLoaded', () => {

  renderListaSolicitudesAdmin();

  document.getElementById('solicitudSearchInput')?.addEventListener('input', renderListaSolicitudesAdmin);
  document.getElementById('solicitudFilterEstado')?.addEventListener('change', renderListaSolicitudesAdmin);
  document.getElementById('solicitudOrden')?.addEventListener('change', renderListaSolicitudesAdmin);

});

// ============================================================
// LISTA
// ============================================================

function renderListaSolicitudesAdmin() {

  const body = document.getElementById('solicitudesBody');
  if (!body) return;

  const texto = (document.getElementById('solicitudSearchInput')?.value || '').toLowerCase().trim();
  const estadoFiltro = document.getElementById('solicitudFilterEstado')?.value || '';
  const orden = document.getElementById('solicitudOrden')?.value || 'reciente';

  let solicitudes = obtenerSolicitudes().filter(s => {
    if (estadoFiltro && s.estado !== estadoFiltro) return false;
    if (texto) {
      const coincide =
        s.nombreCompleto.toLowerCase().includes(texto) ||
        s.solicitanteNombre.toLowerCase().includes(texto);
      if (!coincide) return false;
    }
    return true;
  });

  solicitudes.sort((a, b) => orden === 'antigua'
    ? a.fechaSolicitud.localeCompare(b.fechaSolicitud)
    : b.fechaSolicitud.localeCompare(a.fechaSolicitud));

  const pendientes = obtenerSolicitudes().filter(s => s.estado === 'pendiente').length;
  const chip = document.getElementById('solicitudesPendingCount');
  if (chip) chip.textContent = `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;

  if (!solicitudes.length) {
    body.innerHTML = `
      <tr>
        <td colspan="5" class="catalog-empty-cell">
          <strong>No hay solicitudes que coincidan</strong>
          <span>Prueba con otro nombre o cambia los filtros.</span>
        </td>
      </tr>
    `;
    return;
  }

  body.innerHTML = solicitudes.map(s => `
    <tr>
      <td><strong>${escapeHTMLSolAdmin(s.nombreCompleto)}</strong></td>
      <td>${escapeHTMLSolAdmin(s.solicitanteNombre)} <span class="badge">${s.solicitanteRol === 'lider' ? 'Líder' : 'Emprendedora'}</span></td>
      <td><span class="badge estado-badge ${s.estado}">${ESTADOS_SOLICITUD[s.estado] || s.estado}</span></td>
      <td>${formatearFechaSolAdmin(s.fechaSolicitud)}</td>
      <td><button class="action-btn detail-action" data-ver="${s.id}">Ver detalle</button></td>
    </tr>
  `).join('');

  body.querySelectorAll('[data-ver]').forEach(btn => {
    btn.addEventListener('click', () => abrirDetalleSolicitudAdmin(btn.getAttribute('data-ver')));
  });

}

// ============================================================
// DETALLE
// ============================================================

function abrirDetalleSolicitudAdmin(id) {

  const solicitud = obtenerSolicitudPorId(id);
  if (!solicitud) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const esPendiente = solicitud.estado === 'pendiente';

  box.style.maxWidth = '520px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">👤</div>
    <h3>Solicitud de inscripción</h3>
    <p class="modal-sub">Revisada como parte del proceso de alta de nuevas Emprendedoras.</p>

    <h4 class="profile-section-title">Solicitante</h4>
    <div class="detail-grid">
      <div><span>Nombre</span><strong>${escapeHTMLSolAdmin(solicitud.solicitanteNombre)}</strong></div>
      <div><span>Rol</span><strong>${solicitud.solicitanteRol === 'lider' ? 'Líder' : 'Emprendedora'}</strong></div>
      <div><span>ID / cuenta</span><strong>${escapeHTMLSolAdmin(solicitud.solicitanteId)}</strong></div>
      <div><span>Fecha de solicitud</span><strong>${formatearFechaSolAdmin(solicitud.fechaSolicitud)}</strong></div>
    </div>

    <h4 class="profile-section-title" style="margin-top:18px;">Nueva persona</h4>
    <div class="detail-grid">
      <div><span>Nombre completo</span><strong>${escapeHTMLSolAdmin(solicitud.nombreCompleto)}</strong></div>
      <div><span>Celular</span><strong>${escapeHTMLSolAdmin(solicitud.telefono)}</strong></div>
      <div><span>Correo</span><strong>${escapeHTMLSolAdmin(solicitud.correo)}</strong></div>
      <div><span>Estado</span><strong>${ESTADOS_SOLICITUD[solicitud.estado] || solicitud.estado}</strong></div>
    </div>

    <div class="modal-note confidential-warning">
      🔒 Información confidencial. Uso exclusivo administrativo.
    </div>
    <div class="ine-preview">
      <img src="${solicitud.ineUrl}" alt="INE de ${escapeAttributeSolAdmin(solicitud.nombreCompleto)}">
    </div>

    ${!esPendiente ? construirResolucionHTML(solicitud) : ''}

    ${esPendiente ? `
      <div class="profile-actions" style="border-top:0;padding-top:0;">
        <button class="btn btn-primary" id="aprobarSolicitudBtn" type="button">Aprobar solicitud</button>
        <button class="btn btn-danger" id="rechazarSolicitudBtn" type="button">Rechazar solicitud</button>
      </div>
    ` : ''}
  `;

  overlay.classList.add('open');

  if (esPendiente) {
    document.getElementById('aprobarSolicitudBtn')?.addEventListener('click', () => abrirConfirmarAprobarAdmin(solicitud));
    document.getElementById('rechazarSolicitudBtn')?.addEventListener('click', () => abrirModalRechazarAdmin(solicitud));
  }

}

function construirResolucionHTML(solicitud) {

  if (solicitud.estado === 'rechazada') {
    return `
      <div class="solicitud-motivo" style="margin-top:16px;">
        <strong style="display:block;margin-bottom:4px;">Motivo del rechazo</strong>
        ${escapeHTMLSolAdmin(solicitud.motivoRechazo)}
      </div>
      <p class="bp-sub" style="margin-top:10px;">
        Revisado por ${escapeHTMLSolAdmin(solicitud.revisadoPor)} · ${formatearFechaSolAdmin(solicitud.fechaRevision)}
      </p>
    `;
  }

  if (solicitud.estado === 'aprobada' && solicitud.credenciales) {
    return `
      <h4 class="profile-section-title" style="margin-top:18px;">Cuenta creada</h4>
      <div class="detail-grid">
        <div><span>Usuario</span><strong>${escapeHTMLSolAdmin(solicitud.credenciales.usuario)}</strong></div>
        <div><span>Contraseña temporal</span><strong>${escapeHTMLSolAdmin(solicitud.credenciales.passwordTemporal)}</strong></div>
      </div>
      <p class="bp-sub" style="margin-top:10px;">
        Aprobada por ${escapeHTMLSolAdmin(solicitud.revisadoPor)} · ${formatearFechaSolAdmin(solicitud.fechaRevision)}
      </p>
    `;
  }

  return '';

}

// ============================================================
// APROBAR
// ============================================================

function abrirConfirmarAprobarAdmin(solicitud) {

  abrirAutorizacionAdmin({
    titulo: 'Aprobar solicitud',
    mensaje: `¿Confirmas la aprobación de esta solicitud? Se creará una nueva cuenta de Emprendedora y ${escapeHTMLSolAdmin(solicitud.solicitanteNombre)} quedará registrado(a) como su líder directa.`,
    onConfirmar: () => {

      const resultado = aprobarSolicitud(solicitud.id, {
        adminId: ADMIN_IDENTIDAD.usuarioId,
        adminNombre: ADMIN_IDENTIDAD.usuarioNombre
      });

      if (!resultado.ok) {
        mostrarToastSolAdmin(resultado.error);
        renderListaSolicitudesAdmin();
        return;
      }

      renderListaSolicitudesAdmin();
      mostrarPantallaCredencialesAdmin(resultado);

    }
  });

}

function mostrarPantallaCredencialesAdmin({ solicitud, persona, credenciales }) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '460px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon">✓</div>
    <h3>Cuenta creada correctamente</h3>
    <p class="modal-sub">Entrega estas credenciales manualmente a la nueva Emprendedora. No se envían por correo automáticamente.</p>

    <div class="detail-grid">
      <div class="full" style="grid-column:1/-1;"><span>Nombre</span><strong>${escapeHTMLSolAdmin(nombreCompletoPersona(persona))}</strong></div>
      <div><span>Usuario</span><strong id="credUsuario">${escapeHTMLSolAdmin(credenciales.usuario)}</strong></div>
      <div><span>Contraseña temporal</span><strong id="credPassword">${escapeHTMLSolAdmin(credenciales.passwordTemporal)}</strong></div>
      <div><span>Rol</span><strong>Emprendedora</strong></div>
      <div><span>Líder</span><strong>${escapeHTMLSolAdmin(solicitud.solicitanteNombre)}</strong></div>
    </div>

    <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;">
      <button class="btn btn-outline" style="flex:1;" id="copiarUsuarioBtn" type="button">Copiar usuario</button>
      <button class="btn btn-outline" style="flex:1;" id="copiarPasswordBtn" type="button">Copiar contraseña</button>
    </div>
    <button class="btn btn-outline" style="width:100%;margin-top:8px;" id="copiarCredencialesBtn" type="button">Copiar credenciales</button>
    <button class="btn btn-primary" style="width:100%;" data-close type="button">Listo</button>
  `;

  overlay.classList.add('open');

  document.getElementById('copiarUsuarioBtn')?.addEventListener('click', (e) => copiarTextoSolAdmin(credenciales.usuario, e.target));
  document.getElementById('copiarPasswordBtn')?.addEventListener('click', (e) => copiarTextoSolAdmin(credenciales.passwordTemporal, e.target));
  document.getElementById('copiarCredencialesBtn')?.addEventListener('click', (e) => copiarTextoSolAdmin(
    `Usuario: ${credenciales.usuario}\nContraseña temporal: ${credenciales.passwordTemporal}`,
    e.target
  ));

}

// ============================================================
// RECHAZAR
// ============================================================

function abrirModalRechazarAdmin(solicitud) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.style.maxWidth = '460px';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <div class="auth-icon danger">!</div>
    <h3>Rechazar solicitud</h3>
    <p class="modal-sub">Explica por qué se rechaza la solicitud de <strong>${escapeHTMLSolAdmin(solicitud.nombreCompleto)}</strong>. ${escapeHTMLSolAdmin(solicitud.solicitanteNombre)} podrá ver este motivo.</p>

    <label for="motivoRechazoInput">Motivo del rechazo *</label>
    <textarea id="motivoRechazoInput" rows="3" placeholder="Ej. La información proporcionada está incompleta." style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>

    <div id="motivoError" class="auth-error" style="display:none;"></div>

    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-outline" style="flex:1;" data-close type="button">Cancelar</button>
      <button class="btn btn-danger" style="flex:1;" id="confirmarRechazoBtn" type="button">Rechazar solicitud</button>
    </div>
  `;

  overlay.classList.add('open');

  document.getElementById('confirmarRechazoBtn')?.addEventListener('click', () => {

    const motivo = document.getElementById('motivoRechazoInput')?.value.trim();

    if (!motivo) {
      const error = document.getElementById('motivoError');
      if (error) { error.textContent = 'Escribe el motivo del rechazo.'; error.style.display = 'block'; }
      return;
    }

    const resultado = rechazarSolicitud(solicitud.id, {
      adminId: ADMIN_IDENTIDAD.usuarioId,
      adminNombre: ADMIN_IDENTIDAD.usuarioNombre,
      motivo
    });

    if (!resultado.ok) {
      const error = document.getElementById('motivoError');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }

    overlay.classList.remove('open');
    renderListaSolicitudesAdmin();
    mostrarToastSolAdmin(`Solicitud de ${solicitud.nombreCompleto} rechazada.`);

  });

}

// ============================================================
// UTILIDADES
// ============================================================

function copiarTextoSolAdmin(texto, boton) {
  navigator.clipboard?.writeText(texto);
  const original = boton.textContent;
  boton.textContent = 'Copiado ✓';
  setTimeout(() => { boton.textContent = original; }, 1500);
}

function mostrarToastSolAdmin(mensaje) {
  let toast = document.getElementById('mwToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mwToast';
    toast.className = 'mw-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = mensaje;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

function formatearFechaSolAdmin(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function escapeHTMLSolAdmin(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttributeSolAdmin(texto) {
  return escapeHTMLSolAdmin(texto);
}
