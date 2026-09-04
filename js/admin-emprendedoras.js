// MW JOYERÍA — Admin: Emprendedoras / Líderes
//
// Centro único de gestión de personas para Administración: buscar,
// filtrar, consultar el perfil completo (Información, Compras,
// Apartados, Plan MW y — si es Líder — Equipo y Rango) y editar.
//
// Reutiliza:
// - js/personas-ejemplo.js — registro de personas (nuevo, ver ese archivo).
// - js/apartados-modelo.js + js/staff-apartados-ejemplo.js — MISMAS
//   ventanas de apartado que usan Staff/RH/Admin, sin datos paralelos.
// - js/lider-ejemplo.js (RANGOS_MW) — MISMOS umbrales de rango reales.
// - js/admin-comun.js — abrirAutorizacionAdmin / registrarAuditoriaAdmin.
//
// ⚠️ TEMPORAL: localStorage simula la base de datos. Se reemplaza por
// Firestore en Fase 3.

let personaSeleccionadaId = null;
let modoEdicionPersona = false;
let liderSeleccionadoEdicion = null; // { id, nombre } mientras se edita
let equipoAutocompleteSeleccionado = null;

document.addEventListener('DOMContentLoaded', () => {

  verificarAscensosPendientes();
  renderFiltroLideres();
  renderFiltroRangos();
  aplicarBusquedaPersonas();
  inicializarEventosPersonas();

});

// ============================================================
// FILTROS
// ============================================================

function renderFiltroLideres() {
  const select = document.getElementById('filterLider');
  if (!select) return;
  const lideres = obtenerPersonas().filter(p => p.tipo === 'lider');
  select.innerHTML = `<option value="">Todas las líderes</option>` +
    lideres.map(l => `<option value="${l.id}">${escapeHTMLPersonas(nombreCompletoPersona(l))}</option>`).join('');
}

function renderFiltroRangos() {
  const select = document.getElementById('filterRango');
  if (!select) return;
  select.innerHTML = `<option value="">Todos los rangos</option>` +
    RANGOS_MW.map(r => `<option value="${r.key}">${r.label}</option>`).join('');
}

function inicializarEventosPersonas() {

  document.getElementById('personaSearchInput')?.addEventListener('input', aplicarBusquedaPersonas);
  document.getElementById('filterTipo')?.addEventListener('change', aplicarBusquedaPersonas);
  document.getElementById('filterEstado')?.addEventListener('change', aplicarBusquedaPersonas);
  document.getElementById('filterCategoria')?.addEventListener('change', aplicarBusquedaPersonas);
  document.getElementById('filterLider')?.addEventListener('change', aplicarBusquedaPersonas);
  document.getElementById('filterRango')?.addEventListener('change', aplicarBusquedaPersonas);

  document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modalOverlay') cerrarModalPersonas();
  });

}

function aplicarBusquedaPersonas() {

  const texto = (document.getElementById('personaSearchInput')?.value || '').toLowerCase().trim();
  const tipo = document.getElementById('filterTipo')?.value || '';
  const estado = document.getElementById('filterEstado')?.value || '';
  const categoria = document.getElementById('filterCategoria')?.value || '';
  const liderId = document.getElementById('filterLider')?.value || '';
  const rango = document.getElementById('filterRango')?.value || '';

  const personas = obtenerPersonas().filter(p => {

    if (texto) {
      const nombreCompleto = nombreCompletoPersona(p).toLowerCase();
      const coincide =
        nombreCompleto.includes(texto) ||
        (p.usuario || '').toLowerCase().includes(texto) ||
        (p.telefono || '').toLowerCase().includes(texto);
      if (!coincide) return false;
    }

    if (tipo && p.tipo !== tipo) return false;
    if (estado && p.estado !== estado) return false;
    if (categoria && p.categoria !== categoria) return false;
    if (liderId && p.liderId !== liderId) return false;
    if (rango && (p.tipo !== 'lider' || p.rangoActualKey !== rango)) return false;

    return true;

  }).sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b), 'es'));

  renderResultadosPersonas(personas);

}

// ============================================================
// RESULTADOS
// ============================================================

function renderResultadosPersonas(personas) {

  const lista = document.getElementById('personaResultsList');
  const count = document.getElementById('personaResultCount');
  if (!lista) return;

  if (count) count.textContent = `${personas.length} persona${personas.length === 1 ? '' : 's'}`;

  if (!personas.length) {
    lista.innerHTML = `
      <div class="catalog-empty-cell" style="padding:2.5rem 1rem;">
        <strong>No encontramos personas</strong>
        <span>Prueba con otro nombre, usuario o teléfono.</span>
      </div>
    `;
    return;
  }

  const todas = obtenerPersonas();

  lista.innerHTML = personas.map(p => crearTarjetaResultadoPersona(p, todas)).join('');

  lista.querySelectorAll('.persona-result-card[data-ver-perfil]').forEach(card => {
    card.addEventListener('click', () => seleccionarPersonaAdmin(card.getAttribute('data-ver-perfil')));
  });

}

function crearTarjetaResultadoPersona(p, todas) {

  const inicial = (p.nombre || '?').trim().charAt(0).toUpperCase();
  const lider = p.liderId ? todas.find(l => l.id === p.liderId) : null;
  const activa = p.id === personaSeleccionadaId;

  return `
    <div class="persona-result-card ${activa ? 'active' : ''}" data-ver-perfil="${p.id}">
      <span class="persona-result-avatar">${escapeHTMLPersonas(inicial)}</span>
      <span class="persona-result-body">
        <strong>${escapeHTMLPersonas(nombreCompletoPersona(p))}</strong>
        <span class="persona-result-meta">
          <span class="badge">${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'}</span>
          <span class="badge estado-badge ${p.estado}">${ESTADOS_CUENTA_PERSONA[p.estado] || p.estado}</span>
          <span class="badge">${CATEGORIAS_PERSONA[p.categoria] || p.categoria}</span>
          ${p.tipo === 'lider' ? `<span class="badge">${rangoLabel(p.rangoActualKey)}</span>` : ''}
          ${p.ascensoPendiente ? `<span class="badge badge-ascenso">⬆ Sube de rango</span>` : ''}
        </span>
        <span class="persona-result-meta">
          ${lider ? `Líder: ${escapeHTMLPersonas(nombreCompletoPersona(lider))}` : 'Sin líder asignada'}
        </span>
      </span>
      <button type="button" class="action-btn detail-action" data-ver-perfil="${p.id}">Ver perfil</button>
    </div>
  `;

}

function rangoLabel(key) {
  return RANGOS_MW.find(r => r.key === key)?.label || 'Sin Rango';
}

// ============================================================
// SELECCIÓN Y PANEL DE DETALLE
// ============================================================

function seleccionarPersonaAdmin(id) {

  personaSeleccionadaId = id;
  modoEdicionPersona = false;
  liderSeleccionadoEdicion = null;

  aplicarBusquedaPersonas();
  renderDetallePersona();

}

function renderDetallePersona() {

  const empty = document.getElementById('personaDetailEmpty');
  const content = document.getElementById('personaDetailContent');
  if (!empty || !content) return;

  const persona = obtenerPersonaPorId(personaSeleccionadaId);

  if (!persona) {
    empty.hidden = false;
    content.hidden = true;
    return;
  }

  empty.hidden = true;
  content.hidden = false;

  const esLider = persona.tipo === 'lider';
  const inicial = (persona.nombre || '?').trim().charAt(0).toUpperCase();

  content.innerHTML = `
    <div class="people-detail-header">
      <span class="people-detail-avatar">${escapeHTMLPersonas(inicial)}</span>
      <div>
        <h3>${escapeHTMLPersonas(nombreCompletoPersona(persona))}</h3>
        <div class="people-detail-badges">
          <span class="badge">${esLider ? 'Líder' : 'Emprendedora'}</span>
          <span class="badge estado-badge ${persona.estado}">${ESTADOS_CUENTA_PERSONA[persona.estado] || persona.estado}</span>
          <span class="badge">${CATEGORIAS_PERSONA[persona.categoria] || persona.categoria}</span>
          ${esLider ? `<span class="badge">${rangoLabel(persona.rangoActualKey)}</span>` : ''}
          ${persona.ascensoPendiente ? `<span class="badge badge-ascenso">⬆ Sube de rango</span>` : ''}
        </div>
      </div>
      <button class="modal-close" type="button" id="cerrarPerfilBtn" style="position:static;">×</button>
    </div>

    <div class="profile-tabs" id="profileTabs">
      <button type="button" class="profile-tab-btn active" data-tab="info">Información</button>
      <button type="button" class="profile-tab-btn" data-tab="compras">Compras</button>
      <button type="button" class="profile-tab-btn" data-tab="apartados">Apartados</button>
      <button type="button" class="profile-tab-btn" data-tab="planmw">Plan MW</button>
      ${esLider ? `<button type="button" class="profile-tab-btn" data-tab="equipo">Equipo y Rango</button>` : ''}
    </div>

    <div class="profile-section" data-section="info"></div>
    <div class="profile-section" data-section="compras" hidden></div>
    <div class="profile-section" data-section="apartados" hidden></div>
    <div class="profile-section" data-section="planmw" hidden></div>
    ${esLider ? `<div class="profile-section" data-section="equipo" hidden></div>` : ''}

    <div class="profile-actions" id="profileActions"></div>
  `;

  document.getElementById('cerrarPerfilBtn')?.addEventListener('click', () => {
    personaSeleccionadaId = null;
    modoEdicionPersona = false;
    aplicarBusquedaPersonas();
    renderDetallePersona();
  });

  content.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => cambiarTabPerfil(btn.getAttribute('data-tab')));
  });

  renderSeccionInfoPersona(persona, false);
  renderSeccionComprasPersona(persona);
  renderSeccionApartadosPersona(persona);
  renderSeccionPlanMWPersona(persona);
  if (esLider) renderSeccionEquipoPersona(persona);

  renderAccionesPerfil(persona);

}

function cambiarTabPerfil(tab) {
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
  });
  document.querySelectorAll('.profile-section').forEach(sec => {
    sec.hidden = sec.getAttribute('data-section') !== tab;
  });
  // El árbol se dibuja mientras su pestaña está oculta (scrollWidth/
  // clientWidth miden 0 ahí), así que el centrado solo puede calcularse
  // hasta que la pestaña "equipo" realmente se muestra.
  if (tab === 'equipo') centrarArbolEquipoAdmin();
}

function centrarArbolEquipoAdmin() {
  const wrap = document.getElementById('orgTreeContainerAdmin')?.closest('.org-tree-wrap');
  if (!wrap) return;
  requestAnimationFrame(() => {
    wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
  });
}

function renderAccionesPerfil(persona) {

  const wrap = document.getElementById('profileActions');
  if (!wrap) return;

  if (!modoEdicionPersona) {
    wrap.innerHTML = `<button class="btn btn-outline" id="editarPerfilBtn" type="button">Editar</button>`;
    document.getElementById('editarPerfilBtn')?.addEventListener('click', () => entrarModoEdicionPersona(persona));
    return;
  }

  wrap.innerHTML = `
    <button class="btn btn-primary" id="guardarPerfilBtn" type="button">Guardar cambios</button>
    <button class="btn btn-outline" id="cancelarPerfilBtn" type="button">Cancelar</button>
    ${persona.tipo === 'emprendedora' ? `<button class="btn btn-outline" id="convertirLiderBtn" type="button" style="margin-left:auto;">Convertir en Líder</button>` : ''}
  `;

  document.getElementById('guardarPerfilBtn')?.addEventListener('click', () => guardarInformacionPersona(persona));
  document.getElementById('cancelarPerfilBtn')?.addEventListener('click', () => cancelarEdicionPersona(persona));
  document.getElementById('convertirLiderBtn')?.addEventListener('click', () => abrirConfirmarConvertirLider(persona));

}

// ============================================================
// SECCIÓN: INFORMACIÓN
// ============================================================

function renderSeccionInfoPersona(persona, editando) {

  const sec = document.querySelector('.profile-section[data-section="info"]');
  if (!sec) return;

  if (!editando) {
    const lider = persona.liderId ? obtenerPersonaPorId(persona.liderId) : null;
    sec.innerHTML = `
      <h4 class="profile-section-title">Información</h4>
      <div class="detail-grid">
        <div><span>Nombre</span><strong>${escapeHTMLPersonas(persona.nombre)}</strong></div>
        <div><span>Apellidos</span><strong>${escapeHTMLPersonas(persona.apellidos) || '—'}</strong></div>
        <div><span>Teléfono</span><strong>${escapeHTMLPersonas(persona.telefono) || '—'}</strong></div>
        <div><span>Correo</span><strong>${escapeHTMLPersonas(persona.correo) || '—'}</strong></div>
        <div><span>Usuario</span><strong>${escapeHTMLPersonas(persona.usuario) || '—'}</strong></div>
        <div><span>Fecha de alta</span><strong>${formatearFechaPersonas(persona.fechaAlta)}</strong></div>
        <div><span>Categoría</span><strong>${CATEGORIAS_PERSONA[persona.categoria] || persona.categoria}</strong></div>
        <div><span>Estado de cuenta</span><strong>${ESTADOS_CUENTA_PERSONA[persona.estado] || persona.estado}</strong></div>
        <div><span>Líder actual</span><strong>${lider ? escapeHTMLPersonas(nombreCompletoPersona(lider)) : 'Sin líder asignada'}</strong></div>
        <div><span>Tipo de cuenta</span><strong>${persona.tipo === 'lider' ? 'Líder' : 'Emprendedora'}</strong></div>
      </div>
    `;
    return;
  }

  liderSeleccionadoEdicion = persona.liderId
    ? { id: persona.liderId, nombre: nombreCompletoPersona(obtenerPersonaPorId(persona.liderId) || {}) }
    : null;

  sec.innerHTML = `
    <h4 class="profile-section-title">Información (editando)</h4>
    <div class="form-grid">
      <div class="form-field">
        <label>Nombre *</label>
        <input id="editNombre" type="text" value="${escapeAttributePersonas(persona.nombre)}">
      </div>
      <div class="form-field">
        <label>Apellidos</label>
        <input id="editApellidos" type="text" value="${escapeAttributePersonas(persona.apellidos)}">
      </div>
      <div class="form-field">
        <label>Teléfono</label>
        <input id="editTelefono" type="text" value="${escapeAttributePersonas(persona.telefono)}">
      </div>
      <div class="form-field">
        <label>Correo</label>
        <input id="editCorreo" type="email" value="${escapeAttributePersonas(persona.correo)}">
      </div>
      <div class="form-field">
        <label>Usuario</label>
        <input id="editUsuario" type="text" value="${escapeAttributePersonas(persona.usuario)}">
      </div>
      <div class="form-field">
        <label>Categoría</label>
        <select id="editCategoria">
          ${Object.entries(CATEGORIAS_PERSONA).map(([key, label]) => `
            <option value="${key}" ${persona.categoria === key ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>Estado de cuenta</label>
        <select id="editEstado">
          ${Object.entries(ESTADOS_CUENTA_PERSONA).map(([key, label]) => `
            <option value="${key}" ${persona.estado === key ? 'selected' : ''}>${label}</option>
          `).join('')}
        </select>
      </div>
      <div class="form-field full">
        <label>Líder actual</label>
        <div class="persona-autocomplete" id="liderAutocompleteWrap">
          <input type="text" id="liderAutocompleteInput" autocomplete="off" placeholder="Escribir nombre..." value="${escapeAttributePersonas(liderSeleccionadoEdicion?.nombre || '')}">
          <div class="persona-autocomplete-list" id="liderAutocompleteList" hidden></div>
        </div>
        <small class="field-help">Deja vacío si no tiene líder asignada.</small>
      </div>
    </div>
  `;

  crearAutocompletePersonas({
    inputEl: document.getElementById('liderAutocompleteInput'),
    listEl: document.getElementById('liderAutocompleteList'),
    obtenerCandidatos: (texto) => obtenerPersonas().filter(p =>
      p.tipo === 'lider' && p.id !== persona.id && nombreCompletoPersona(p).toLowerCase().includes(texto)
    ),
    onSeleccionar: (p) => { liderSeleccionadoEdicion = { id: p.id, nombre: nombreCompletoPersona(p) }; },
    onLimpiar: () => { liderSeleccionadoEdicion = null; }
  });

}

function entrarModoEdicionPersona(persona) {
  modoEdicionPersona = true;
  renderSeccionInfoPersona(persona, true);
  renderAccionesPerfil(persona);
  if (persona.tipo === 'lider') renderSeccionEquipoPersona(persona);
  // Compras/Apartados/Plan MW no tienen nada que editar aquí — se
  // deshabilitan para mantener al usuario en Información o Equipo.
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    const tab = btn.getAttribute('data-tab');
    btn.disabled = tab !== 'info' && tab !== 'equipo';
  });
  cambiarTabPerfil('info');
}

function cancelarEdicionPersona(persona) {
  modoEdicionPersona = false;
  liderSeleccionadoEdicion = null;
  renderSeccionInfoPersona(persona, false);
  renderAccionesPerfil(persona);
  if (persona.tipo === 'lider') renderSeccionEquipoPersona(persona);
  document.querySelectorAll('.profile-tab-btn').forEach(btn => { btn.disabled = false; });
}

function guardarInformacionPersona(persona) {

  const nombre = document.getElementById('editNombre')?.value.trim();
  if (!nombre) { mostrarToastPersonas('Escribe el nombre de la persona.'); return; }

  const cambios = {
    nombre,
    apellidos: document.getElementById('editApellidos')?.value.trim() || '',
    telefono: document.getElementById('editTelefono')?.value.trim() || '',
    correo: document.getElementById('editCorreo')?.value.trim() || '',
    usuario: document.getElementById('editUsuario')?.value.trim() || '',
    categoria: document.getElementById('editCategoria')?.value || persona.categoria,
    estado: document.getElementById('editEstado')?.value || persona.estado,
    liderId: liderSeleccionadoEdicion ? liderSeleccionadoEdicion.id : null
  };

  abrirAutorizacionAdmin({
    titulo: 'Guardar cambios',
    mensaje: `Vas a actualizar la información de ${escapeHTMLPersonas(nombreCompletoPersona(persona))}. Esta acción quedará registrada.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === persona.id);
      if (!actual) return;

      Object.assign(actual, cambios);
      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'editar_informacion',
        descripcion: `Información actualizada: ${nombreCompletoPersona(actual)}`
      });

      modoEdicionPersona = false;
      liderSeleccionadoEdicion = null;

      renderFiltroLideres();
      aplicarBusquedaPersonas();
      renderDetallePersona();

      mostrarToastPersonas(`Cambios guardados por ${ADMIN_IDENTIDAD.usuarioNombre}.`);

    }
  });

}

// ============================================================
// CONVERTIR EN LÍDER
// ============================================================

function abrirConfirmarConvertirLider(persona) {

  abrirAutorizacionAdmin({
    titulo: 'Convertir en Líder',
    mensaje: `Estás a punto de convertir a ${escapeHTMLPersonas(nombreCompletoPersona(persona))} de Emprendedora a Líder. Esta acción quedará registrada.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === persona.id);
      if (!actual) return;

      actual.tipo = 'lider';
      actual.rangoActualKey = actual.rangoActualKey || 'sin_rango';
      actual.stats = actual.stats || {
        personasActivas: 0, produccionGrupalMes: 0, equipoCalificadoPct: 0,
        compraPersonalPeriodo1: 0, compraPersonalPeriodo2: 0
      };

      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'convertir_lider',
        descripcion: `${nombreCompletoPersona(actual)} fue convertida de Emprendedora a Líder`
      });

      modoEdicionPersona = false;
      liderSeleccionadoEdicion = null;

      renderFiltroLideres();
      aplicarBusquedaPersonas();
      renderDetallePersona();

      mostrarToastPersonas(`${nombreCompletoPersona(actual)} ahora es Líder.`);

    }
  });

}

// ============================================================
// SECCIÓN: COMPRAS (derivado de piezas liquidadas en Apartados)
// ============================================================

function ventanasDePersona(persona) {
  return calcularVentanasStaffActuales().filter(v => v.usuarioId === persona.id);
}

function renderSeccionComprasPersona(persona) {

  const sec = document.querySelector('.profile-section[data-section="compras"]');
  if (!sec) return;

  const ventanas = ventanasDePersona(persona);
  const compras = [];

  ventanas.forEach(v => {
    (v.apartados || []).forEach(pieza => {
      if (pieza.estado === 'liquidada') compras.push({ ventana: v, pieza });
    });
  });

  const totalAcumulado = compras.reduce((suma, c) => suma + Number(c.pieza.total || 0), 0);

  if (!compras.length) {
    sec.innerHTML = `
      <h4 class="profile-section-title">Compras</h4>
      <div class="catalog-empty-cell" style="padding:2rem 1rem;">
        <strong>Sin compras registradas todavía</strong>
        <span>Aquí aparecerán las piezas que ${escapeHTMLPersonas(persona.nombre)} liquide en Apartados.</span>
      </div>
    `;
    return;
  }

  sec.innerHTML = `
    <h4 class="profile-section-title">Compras</h4>
    <div class="detail-grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px;">
      <div><span>Compras liquidadas</span><strong>${compras.length}</strong></div>
      <div><span>Total acumulado</span><strong>$${formatearDineroPersonas(totalAcumulado)} MXN</strong></div>
    </div>
    ${compras.map(({ ventana, pieza }) => `
      <div class="compra-item">
        <div class="compra-item-head">
          <strong>${escapeHTMLPersonas(pieza.producto)}</strong>
          <strong>$${formatearDineroPersonas(pieza.total)} MXN</strong>
        </div>
        <small>${escapeHTMLPersonas(pieza.variante || 'Sin variante')} · Ventana ${escapeHTMLPersonas(ventana.id)} · ${formatearFechaPersonas(pieza.fechaSolicitud || ventana.fechaInicio)}</small>
      </div>
    `).join('')}
  `;

}

// ============================================================
// SECCIÓN: APARTADOS (misma estructura/lógica que Staff/RH/Admin)
// ============================================================

function renderSeccionApartadosPersona(persona) {

  const sec = document.querySelector('.profile-section[data-section="apartados"]');
  if (!sec) return;

  const ventanas = ventanasDePersona(persona);

  if (!ventanas.length) {
    sec.innerHTML = `
      <h4 class="profile-section-title">Apartados</h4>
      <div class="catalog-empty-cell" style="padding:2rem 1rem;">
        <strong>Sin apartados registrados</strong>
        <span>${escapeHTMLPersonas(persona.nombre)} no tiene ventanas de apartado activas ni anteriores.</span>
      </div>
    `;
    return;
  }

  sec.innerHTML = `
    <h4 class="profile-section-title">Apartados</h4>
    ${ventanas.map(v => `
      <div class="apartado-item">
        <div class="apartado-item-head">
          <strong>Ventana ${escapeHTMLPersonas(v.id)}</strong>
          <span class="badge">${ESTADOS_VENTANA_MODELO[v.estado] || v.estado}</span>
        </div>
        <small>
          Categoría: ${CATEGORIAS_APARTADO[v.categoria]?.etiqueta || v.categoria}
          · Depósito: $${formatearDineroPersonas(v.depositoApartadoDisponible)} MXN
          ${v.metodoDeposito ? `(${escapeHTMLPersonas(v.metodoDeposito)})` : ''}
          · Ventana desde ${formatearFechaPersonas(v.fechaInicio)}
          ${v.fechaVencimiento ? `hasta ${formatearFechaPersonas(v.fechaVencimiento)}` : ''}
        </small>
        <div class="apartado-piezas">
          ${(v.apartados || []).map(pieza => `
            <div class="apartado-pieza-row">
              <span>${escapeHTMLPersonas(pieza.producto)} ${pieza.variante ? `· ${escapeHTMLPersonas(pieza.variante)}` : ''}</span>
              <span>$${formatearDineroPersonas(pieza.saldo)} MXN saldo · ${ESTADOS_PIEZA_MODELO[pieza.estado] || pieza.estado}</span>
            </div>
          `).join('') || '<div class="apartado-pieza-row"><span>Sin piezas registradas</span></div>'}
        </div>
      </div>
    `).join('')}
  `;

}

// ============================================================
// SECCIÓN: PLAN MW (Reto de Constancia + boletos de rifa)
// ============================================================

function calcularBoletosRifaPersona(rifa) {
  const { montoAcumuladoMes, meta } = rifa;
  if (montoAcumuladoMes < meta) {
    return { totalBoletos: 0, mensaje: `Faltan $${formatearDineroPersonas(meta - montoAcumuladoMes)} MXN en compras este mes para el boleto de la rifa.` };
  }
  const extra = montoAcumuladoMes - meta;
  const boletosExtra = Math.floor(extra / 1000);
  return { totalBoletos: 1 + boletosExtra, mensaje: `${1 + boletosExtra} boleto${boletosExtra ? 's' : ''} de rifa este mes.` };
}

function renderSeccionPlanMWPersona(persona) {

  const sec = document.querySelector('.profile-section[data-section="planmw"]');
  if (!sec) return;

  const { mesesCumplidos, montoMesActual, metaMes } = persona.constancia;
  const boletos = calcularBoletosRifaPersona(persona.rifa);
  const pctConstancia = Math.min(100, (montoMesActual / metaMes) * 100);
  const pctRifa = Math.min(100, (persona.rifa.montoAcumuladoMes / persona.rifa.meta) * 100);

  sec.innerHTML = `
    <h4 class="profile-section-title">Plan MW</h4>

    <div class="detail-grid" style="grid-template-columns:1fr 1fr;margin-bottom:16px;">
      <div><span>Reto de Constancia — meses cumplidos</span><strong>${mesesCumplidos}</strong></div>
      <div><span>Compra del mes en curso</span><strong>$${formatearDineroPersonas(montoMesActual)} / $${formatearDineroPersonas(metaMes)} MXN</strong></div>
    </div>
    <div class="timeline-wrap" style="margin-bottom:18px;">
      <div class="timeline-track"><div class="timeline-fill" style="width:${pctConstancia}%"></div></div>
    </div>

    <div class="detail-grid" style="grid-template-columns:1fr 1fr 1fr;margin-bottom:10px;">
      ${HITOS_CONSTANCIA_PERSONA.map(h => `
        <div>
          <span>${h.meses} meses</span>
          <strong>${mesesCumplidos >= h.meses ? '✓ ' : ''}${h.premio}</strong>
        </div>
      `).join('')}
    </div>

    <h4 class="profile-section-title" style="margin-top:22px;">Boletos de rifa (mes en curso)</h4>
    <div class="detail-grid" style="grid-template-columns:1fr 1fr;margin-bottom:10px;">
      <div><span>Próximo beneficio</span><strong>${boletos.mensaje}</strong></div>
      <div><span>Compra acumulada del mes</span><strong>$${formatearDineroPersonas(persona.rifa.montoAcumuladoMes)} / $${formatearDineroPersonas(persona.rifa.meta)} MXN</strong></div>
    </div>
    <div class="timeline-wrap">
      <div class="timeline-track"><div class="timeline-fill" style="width:${pctRifa}%"></div></div>
    </div>
  `;

}

// ============================================================
// SECCIÓN: EQUIPO Y RANGO (solo Líderes)
// ============================================================

function renderSeccionEquipoPersona(persona) {

  const sec = document.querySelector('.profile-section[data-section="equipo"]');
  if (!sec) return;

  const equipo = obtenerPersonas().filter(p => p.liderId === persona.id);

  sec.innerHTML = `
    <h4 class="profile-section-title">Rango</h4>
    ${construirRangoChecklistHTML(persona)}

    <h4 class="profile-section-title" style="margin-top:24px;">Equipo</h4>
    <p class="bp-sub" style="margin-top:-6px;">Toca un nivel para ver nombres, o consulta el árbol completo — igual que lo ve la líder en su propio portal.</p>

    <div class="team-levels-grid" id="nivelesGridAdmin"></div>

    <div class="org-tree-card" style="margin-top:16px;">
      <div class="org-tree-card-header">
        <h3>Árbol del equipo</h3>
      </div>
      <div class="org-tree-wrap">
        <div id="orgTreeContainerAdmin"></div>
      </div>
    </div>

    ${modoEdicionPersona ? `
      <h4 class="profile-section-title" style="margin-top:24px;">Gestionar equipo directo</h4>
      <div class="team-chip-list" id="equipoChipList">
        ${equipo.length
          ? equipo.map(m => `
            <span class="team-chip">
              ${escapeHTMLPersonas(nombreCompletoPersona(m))}
              <button type="button" data-quitar-equipo="${m.id}">×</button>
            </span>
          `).join('')
          : `<span class="team-chip-empty">Sin integrantes directos todavía.</span>`}
      </div>
      <div class="form-field full">
        <label>Agregar integrante</label>
        <div class="persona-autocomplete" id="equipoAutocompleteWrap">
          <input type="text" id="equipoAutocompleteInput" autocomplete="off" placeholder="Escribir nombre...">
          <div class="persona-autocomplete-list" id="equipoAutocompleteList" hidden></div>
        </div>
      </div>
    ` : ''}

    <a class="btn btn-outline" style="display:inline-block;margin-top:16px;" href="admin-comisiones.html">Ver comisiones →</a>
  `;

  renderNivelesEquipoAdmin(persona);
  renderArbolEquipoAdmin(persona);

  document.getElementById('confirmarAscensoBtn')?.addEventListener('click', () => abrirConfirmarAscensoRango(persona));

  sec.querySelectorAll('[data-quitar-equipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      const integrante = obtenerPersonaPorId(btn.getAttribute('data-quitar-equipo'));
      if (integrante) abrirConfirmarQuitarEquipo(persona, integrante);
    });
  });

  if (modoEdicionPersona) {
    crearAutocompletePersonas({
      inputEl: document.getElementById('equipoAutocompleteInput'),
      listEl: document.getElementById('equipoAutocompleteList'),
      obtenerCandidatos: (texto) => obtenerPersonas().filter(p =>
        p.id !== persona.id && p.liderId !== persona.id && nombreCompletoPersona(p).toLowerCase().includes(texto)
      ),
      onSeleccionar: (p) => abrirConfirmarAgregarEquipo(persona, p),
      limpiarInputAlSeleccionar: true
    });
  }

}

// ============================================================
// EQUIPO: NIVELES + ÁRBOL (misma vista que usa la líder en su propio
// portal — js/mi-equipo.js — pero recorriendo el registro de Admin
// por liderId en vez de EQUIPO_ARBOL_EJEMPLO).
// ============================================================

// Todas las personas cuya cadena de liderId llega hasta raizId,
// con su profundidad (nivel 1 = integrantes directos).
function calcularDescendenciaPersona(raizId) {

  const porLider = {};
  obtenerPersonas().forEach(p => {
    if (!p.liderId) return;
    (porLider[p.liderId] = porLider[p.liderId] || []).push(p);
  });

  const conNivel = [];
  (function recorrer(id, nivel) {
    (porLider[id] || []).forEach(hijo => {
      conNivel.push({ persona: hijo, nivel });
      recorrer(hijo.id, nivel + 1);
    });
  })(raizId, 1);

  return { conNivel, porLider };

}

function renderNivelesEquipoAdmin(persona) {

  const grid = document.getElementById('nivelesGridAdmin');
  if (!grid) return;

  const { conNivel } = calcularDescendenciaPersona(persona.id);
  const porNivel = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  conNivel.forEach(({ persona: p, nivel }) => { if (porNivel[nivel]) porNivel[nivel].push(p); });

  grid.innerHTML = [1, 2, 3, 4, 5].map(nivel => `
    <button class="team-level-card" style="text-align:left;cursor:pointer;width:100%;" type="button" data-nivel-admin="${nivel}">
      <div class="icon-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
      </div>
      <h4>Nivel ${nivel}</h4>
      <span class="tl-count">${porNivel[nivel].length}</span>
      <span class="tl-sub">Personas · toca para ver</span>
    </button>
  `).join('');

  grid.querySelectorAll('[data-nivel-admin]').forEach(btn => {
    const nivel = Number(btn.getAttribute('data-nivel-admin'));
    btn.addEventListener('click', () => abrirModalNivelAdmin(nivel, porNivel[nivel]));
  });

}

function abrirModalNivelAdmin(nivel, personas) {

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const filas = personas.length
    ? personas.map(p => `
      <div class="equipo-modal-row">
        <span>${escapeHTMLPersonas(nombreCompletoPersona(p))} <span class="badge">${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'}</span></span>
        <span class="em-puntos">${ESTADOS_CUENTA_PERSONA[p.estado] || p.estado}</span>
      </div>
    `).join('')
    : '<div class="equipo-modal-empty">Todavía no hay integrantes en este nivel.</div>';

  box.style.maxWidth = '';
  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nivel ${nivel}</h3>
    <p class="modal-sub">Personas en este nivel de la estructura.</p>
    <div class="equipo-modal-list">${filas}</div>
  `;
  overlay.classList.add('open');

}

function renderArbolEquipoAdmin(persona) {

  const contenedor = document.getElementById('orgTreeContainerAdmin');
  if (!contenedor) return;

  const { porLider } = calcularDescendenciaPersona(persona.id);

  function metricaNodo(p) {
    return p.tipo === 'lider'
      ? `$${formatearDineroPersonas(p.stats.produccionGrupalMes)} MXN`
      : `$${formatearDineroPersonas(p.constancia.montoMesActual)} MXN este mes`;
  }

  function renderNodo(p, esRaiz, nivel) {
    const lvlClass = esRaiz ? 'self' : `lvl-${((nivel - 1) % 5) + 1}`;
    const hijos = porLider[p.id] || [];
    const nodeHtml = `
      <div class="org-node ${lvlClass}">
        <span class="on-name">${escapeHTMLPersonas(nombreCompletoPersona(p))}</span>
        <span class="on-tag">${esRaiz ? (p.tipo === 'lider' ? 'Líder' : 'Emprendedora') : `Nivel ${nivel}`}</span>
        <span class="on-points">${metricaNodo(p)}</span>
      </div>
    `;
    if (!hijos.length) return `<li>${nodeHtml}</li>`;
    return `<li>${nodeHtml}<ul>${hijos.map(h => renderNodo(h, false, nivel + 1)).join('')}</ul></li>`;
  }

  contenedor.innerHTML = `<div class="org-tree"><ul>${renderNodo(persona, true, 0)}</ul></div>`;

  // Si la pestaña "equipo" ya está visible en este momento (el usuario
  // reabrió el mismo perfil), centra de una vez; si no, cambiarTabPerfil
  // se encarga cuando el usuario la abra.
  centrarArbolEquipoAdmin();

}

// Requisitos del SIGUIENTE rango comparados contra los datos actuales
// de la líder. La usan tanto el checklist visual como la verificación
// automática de ascensos (verificarAscensosPendientes).
function calcularAscensoRango(persona) {

  const idxActual = RANGOS_MW.findIndex(r => r.key === persona.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];

  if (!siguiente) return { siguiente: null, items: [], elegible: false };

  const { personasActivas, produccionGrupalMes, equipoCalificadoPct, compraPersonalPeriodo1, compraPersonalPeriodo2 } = persona.stats;
  const compraMinima = Math.min(compraPersonalPeriodo1, compraPersonalPeriodo2);

  const items = [
    { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}` },
    { label: 'Compra personal (ambos periodos)', cumple: compraMinima >= siguiente.compra, valores: `$${formatearDineroPersonas(compraPersonalPeriodo1)} y $${formatearDineroPersonas(compraPersonalPeriodo2)} / $${formatearDineroPersonas(siguiente.compra)}` },
    { label: 'Equipo calificado', cumple: equipoCalificadoPct >= siguiente.calificado, valores: `${equipoCalificadoPct}% / ${siguiente.calificado}%` },
    { label: 'Producción grupal', cumple: produccionGrupalMes >= siguiente.produccion, valores: `$${formatearDineroPersonas(produccionGrupalMes)} / $${formatearDineroPersonas(siguiente.produccion)}` }
  ];

  return { siguiente, items, elegible: items.every(it => it.cumple) };

}

// Revisa a todas las líderes y, si alguna ya cumple los requisitos del
// siguiente rango, avisa a Administración (notificación) para que
// confirme el ascenso manualmente — nunca sube de rango sola.
function verificarAscensosPendientes() {

  const personas = obtenerPersonas();
  let huboCambios = false;

  personas.filter(p => p.tipo === 'lider').forEach(persona => {

    const { siguiente, elegible } = calcularAscensoRango(persona);

    if (elegible && siguiente) {

      if (!persona.ascensoPendiente || persona.ascensoPendiente.rangoKey !== siguiente.key) {

        persona.ascensoPendiente = { rangoKey: siguiente.key, detectadoEn: new Date().toISOString() };
        huboCambios = true;

        if (typeof agregarNotificacion === 'function') {
          agregarNotificacion({
            texto: `${nombreCompletoPersona(persona)} cumple los requisitos para subir a ${siguiente.label}. Revisa y confirma su ascenso.`,
            link: 'admin-emprendedoras-lideres.html',
            paraId: 'admin01'
          });
        }

      }

    } else if (persona.ascensoPendiente) {
      // Ya no cumple (p. ej. se editaron sus datos) — se limpia sin notificar.
      delete persona.ascensoPendiente;
      huboCambios = true;
    }

  });

  if (huboCambios) guardarPersonas(personas);

}

function abrirConfirmarAscensoRango(persona) {

  const siguienteLabel = rangoLabel(persona.ascensoPendiente.rangoKey);

  abrirAutorizacionAdmin({
    titulo: 'Confirmar subida de rango',
    mensaje: `${escapeHTMLPersonas(nombreCompletoPersona(persona))} cumple los requisitos para subir a ${siguienteLabel}. ¿Confirmas su ascenso? Se actualizará su rango y se le notificará para que prepares sus premios.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === persona.id);
      if (!actual || !actual.ascensoPendiente) return;

      const rangoAnterior = rangoLabel(actual.rangoActualKey);
      actual.rangoActualKey = actual.ascensoPendiente.rangoKey;
      delete actual.ascensoPendiente;
      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'ascenso_rango',
        descripcion: `${nombreCompletoPersona(actual)} subió de rango: ${rangoAnterior} → ${siguienteLabel}`
      });

      if (typeof agregarNotificacion === 'function') {
        agregarNotificacion({
          texto: `¡Felicidades! Tu rango subió a ${siguienteLabel}. Sigue así ✦`,
          link: 'cuenta',
          paraId: actual.id
        });
      }

      renderFiltroLideres();
      aplicarBusquedaPersonas();
      renderDetallePersona();
      mostrarToastPersonas(`${nombreCompletoPersona(actual)} ahora es ${siguienteLabel}.`);

    }
  });

}

function construirRangoChecklistHTML(persona) {

  const { siguiente, items } = calcularAscensoRango(persona);

  const nodos = RANGOS_MW.map(r => {
    const alcanzado = persona.stats.produccionGrupalMes >= r.produccion;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>'}
        </div>
        <span class="node-label">${r.label}</span>
      </div>
    `;
  }).join('');

  const maxProduccion = RANGOS_MW[RANGOS_MW.length - 1].produccion;
  const pctFill = Math.min(100, (persona.stats.produccionGrupalMes / maxProduccion) * 100);

  if (!siguiente) {
    return `
      <div class="rank-progress-main">
        <h3>Rango actual: ${rangoLabel(persona.rangoActualKey).toUpperCase()} ✦</h3>
        <p class="rp-sub">Ya está en el rango más alto.</p>
        <div class="timeline-wrap timeline-dark">
          <div class="timeline-track"><div class="timeline-fill" style="width:${pctFill}%"></div></div>
          <div class="timeline-nodes">${nodos}</div>
        </div>
      </div>
    `;
  }

  return `
    <div class="rank-progress-main">
      <h3>Rango actual: ${rangoLabel(persona.rangoActualKey).toUpperCase()} ✦</h3>
      <p class="rp-sub">Progreso hacia ${siguiente.label.toUpperCase()}</p>
      <div class="timeline-wrap timeline-dark">
        <div class="timeline-track"><div class="timeline-fill" style="width:${pctFill}%"></div></div>
        <div class="timeline-nodes">${nodos}</div>
      </div>
      <div class="rank-checklist">
        ${items.map(it => `
          <div class="check-item ${it.cumple ? 'met' : 'unmet'}">
            <span class="check-icon">
              ${it.cumple
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
            </span>
            <span class="check-label">${it.label}</span>
            <span class="check-values">${it.valores}</span>
          </div>
        `).join('')}
      </div>
    </div>
    ${persona.ascensoPendiente ? `
      <div class="ascenso-banner">
        <div>
          <strong>🎉 ¡Lista para subir de rango!</strong>
          <p>Cumple todos los requisitos para ${rangoLabel(persona.ascensoPendiente.rangoKey)}. Confirma su ascenso y prepara sus premios.</p>
        </div>
        <button class="btn btn-primary" id="confirmarAscensoBtn" type="button">Confirmar subida de rango</button>
      </div>
    ` : ''}
  `;

}

function abrirConfirmarAgregarEquipo(lider, integrante) {

  abrirAutorizacionAdmin({
    titulo: 'Agregar integrante',
    mensaje: `Vas a asignar a ${escapeHTMLPersonas(nombreCompletoPersona(integrante))} como integrante del equipo de ${escapeHTMLPersonas(nombreCompletoPersona(lider))}. Esta acción quedará registrada.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === integrante.id);
      if (!actual) return;

      actual.liderId = lider.id;
      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'equipo_agregar',
        descripcion: `${nombreCompletoPersona(actual)} asignada al equipo de ${nombreCompletoPersona(lider)}`
      });

      renderFiltroLideres();
      renderSeccionEquipoPersona(lider);
      mostrarToastPersonas(`${nombreCompletoPersona(actual)} se agregó al equipo.`);

    }
  });

}

function abrirConfirmarQuitarEquipo(lider, integrante) {

  abrirAutorizacionAdmin({
    titulo: 'Quitar integrante',
    peligrosa: true,
    mensaje: `Vas a quitar a ${escapeHTMLPersonas(nombreCompletoPersona(integrante))} del equipo de ${escapeHTMLPersonas(nombreCompletoPersona(lider))}. Quedará sin líder asignada. Esta acción quedará registrada.`,
    onConfirmar: () => {

      const personas = obtenerPersonas();
      const actual = personas.find(p => p.id === integrante.id);
      if (!actual) return;

      actual.liderId = null;
      guardarPersonas(personas);

      registrarAuditoriaAdmin({
        modulo: 'personas',
        accion: 'equipo_quitar',
        descripcion: `${nombreCompletoPersona(actual)} removida del equipo de ${nombreCompletoPersona(lider)}`
      });

      renderFiltroLideres();
      renderSeccionEquipoPersona(lider);
      mostrarToastPersonas(`${nombreCompletoPersona(actual)} se quitó del equipo.`);

    }
  });

}

// ============================================================
// AUTOCOMPLETADO DE PERSONAS (reutilizado por Líder y Equipo)
// ============================================================

function crearAutocompletePersonas({ inputEl, listEl, obtenerCandidatos, onSeleccionar, onLimpiar, limpiarInputAlSeleccionar }) {

  if (!inputEl || !listEl) return;

  inputEl.addEventListener('input', () => {

    const texto = inputEl.value.toLowerCase().trim();

    if (onLimpiar) onLimpiar();

    if (!texto) {
      listEl.hidden = true;
      listEl.innerHTML = '';
      return;
    }

    const candidatos = obtenerCandidatos(texto).slice(0, 8);

    if (!candidatos.length) {
      listEl.innerHTML = `<div class="persona-autocomplete-empty">Sin coincidencias.</div>`;
      listEl.hidden = false;
      return;
    }

    listEl.innerHTML = candidatos.map(p => `
      <button type="button" class="persona-autocomplete-item" data-persona-id="${p.id}">
        <span>${escapeHTMLPersonas(nombreCompletoPersona(p))}</span>
        <small>${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'}${p.liderId ? ` · Líder actual: ${escapeHTMLPersonas(nombreCompletoPersona(obtenerPersonaPorId(p.liderId) || {}))}` : ''}</small>
      </button>
    `).join('');

    listEl.hidden = false;

    listEl.querySelectorAll('[data-persona-id]').forEach(item => {
      item.addEventListener('click', () => {
        const persona = obtenerPersonaPorId(item.getAttribute('data-persona-id'));
        if (!persona) return;
        onSeleccionar(persona);
        if (limpiarInputAlSeleccionar) {
          inputEl.value = '';
        } else {
          inputEl.value = nombreCompletoPersona(persona);
        }
        listEl.hidden = true;
        listEl.innerHTML = '';
      });
    });

  });

  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !listEl.contains(e.target)) {
      listEl.hidden = true;
    }
  });

}

// ============================================================
// UTILIDADES
// ============================================================

function cerrarModalPersonas() {
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function mostrarToastPersonas(mensaje) {
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

function formatearDineroPersonas(numero) {
  return Number(numero || 0).toLocaleString('es-MX');
}

function formatearFechaPersonas(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escapeHTMLPersonas(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttributePersonas(texto) {
  return escapeHTMLPersonas(texto);
}
