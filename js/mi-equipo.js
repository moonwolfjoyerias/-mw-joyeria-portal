// MW JOYERÍA — Mi equipo (Líder)
// Todo en esta página usa el registro REAL de personas
// (js/personas-ejemplo.js, calcularDescendenciaPersona) y las compras
// REALES ya liquidadas (js/compras-modelo.js) — ya no depende de
// EQUIPO_ARBOL_EJEMPLO (dataset de ejemplo desconectado, fusionado
// desde el prototipo "mi-equipo" en esta pasada).
function obtenerLiderActualId() {
  return typeof obtenerIdPersonaActualPortal === 'function' ? obtenerIdPersonaActualPortal() : 'me-lider';
}

let equipoMesSeleccionado = null;
let equipoZoomActual = 1;
let equipoResultadosBusqueda = [];
let equipoIndiceResultado = 0;

document.addEventListener('DOMContentLoaded', () => {
  // No hay ningún otro "tick" que corra en el portal de Líder (a
  // diferencia de Admin, donde admin-comun.js ya lo hace al abrir la
  // campana) — se corre aquí para que la alerta de inactividad esté al
  // día apenas la líder entra a Mi equipo.
  if (typeof procesarAlertasInactividadTodas === 'function') procesarAlertasInactividadTodas();

  equipoMesSeleccionado = mesKeyActualComprasModelo();
  renderEquipoMesSelect();
  renderNivelCards();
  renderArbolVisual();
  renderAlertasInactividadEquipo();
  renderGestionEquipo();
  renderReclamarEmprendedora();
  iniciarCuentaRegresivaEquipo();

  const btnExcel = document.getElementById('descargarArbolBtn');
  if (btnExcel) btnExcel.addEventListener('click', descargarArbolExcel);

  document.getElementById('reclamarBuscarInput')?.addEventListener('input', renderReclamarEmprendedora);

  document.getElementById('equipoMesSelect')?.addEventListener('change', (e) => {
    equipoMesSeleccionado = e.target.value;
    renderNivelCards();
    renderArbolVisual();
  });

  document.getElementById('verResumenLineaBtn')?.addEventListener('click', abrirModalResumenLinea);

  document.getElementById('equipoZoomInBtn')?.addEventListener('click', () => ajustarZoomEquipo(0.1));
  document.getElementById('equipoZoomOutBtn')?.addEventListener('click', () => ajustarZoomEquipo(-0.1));
  document.getElementById('equipoZoomResetBtn')?.addEventListener('click', () => { equipoZoomActual = 1; aplicarZoomEquipo(); });

  document.getElementById('equipoBuscarInput')?.addEventListener('input', (e) => {
    const btnClear = document.getElementById('equipoClearSearchBtn');
    if (btnClear) btnClear.style.display = e.target.value ? '' : 'none';
    buscarEnArbolEquipo(e.target.value);
  });
  document.getElementById('equipoClearSearchBtn')?.addEventListener('click', () => {
    const input = document.getElementById('equipoBuscarInput');
    if (input) input.value = '';
    document.getElementById('equipoClearSearchBtn').style.display = 'none';
    buscarEnArbolEquipo('');
  });
  document.getElementById('equipoPrevMatchBtn')?.addEventListener('click', () => moverResultadoBusquedaEquipo(-1));
  document.getElementById('equipoNextMatchBtn')?.addEventListener('click', () => moverResultadoBusquedaEquipo(1));
});

// ---------- Gestionar equipo (solicitar cambio de rama) ----------
//
// Antes era "solicitar baja" — ver nota de arquitectura en
// personas-ejemplo.js (crearSolicitudCambioRama). Solo las
// Emprendedoras directas dentro de sus primeros 5 días desde la
// inscripción pueden cambiarse de rama; dar de baja a alguien de tu
// equipo se sigue pidiendo por otro medio (contacta a Administración).
function renderGestionEquipo() {

  const wrap = document.getElementById('gestionEquipoLista');
  if (!wrap || typeof calcularDescendenciaPersona !== 'function') return;

  const liderReal = obtenerPersonaPorId(obtenerLiderActualId());
  if (!liderReal) { wrap.innerHTML = '<p class="equipo-modal-empty">No se pudo cargar tu equipo.</p>'; return; }

  const { conNivel } = calcularDescendenciaPersona(obtenerLiderActualId());
  const directas = conNivel
    .filter(n => n.nivel === 1)
    .map(n => n.persona)
    .filter(p => p.tipo === 'emprendedora' && p.estado !== 'baja');

  if (!directas.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Todavía no tienes emprendedoras directas en tu equipo.</p>';
    return;
  }

  wrap.innerHTML = directas.map(p => {
    if (p.solicitudCambioRamaPendiente) {
      return `
        <div class="equipo-modal-row">
          <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
          <span class="badge badge-ascenso" style="background:#fbe7e9;color:#a3272f;">Cambio de rama pendiente</span>
        </div>
      `;
    }
    if (!puedeSolicitarCambioRama(p)) {
      return `
        <div class="equipo-modal-row">
          <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
          <small style="color:var(--mw-text-muted);">Ya pasaron los 5 días desde su inscripción</small>
        </div>
      `;
    }
    return `
      <div class="equipo-modal-row">
        <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
        <button class="btn btn-outline" type="button" data-solicitar-cambio-rama="${p.id}">Solicitar cambio de rama</button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-solicitar-cambio-rama]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalCambioRama(btn.getAttribute('data-solicitar-cambio-rama'), liderReal));
  });

}

function abrirModalCambioRama(personaId, liderReal) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const otrasLideres = obtenerPersonas().filter(p => p.tipo === 'lider' && p.estado !== 'baja' && p.id !== liderReal.id);

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar cambio de rama de ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">Administración revisará tu solicitud y decidirá si la confirma.</p>
    <label for="liderDestinoSelect">¿A la rama de qué líder debería pasar?</label>
    <select id="liderDestinoSelect" style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;margin-bottom:1.1rem;">
      ${otrasLideres.map(l => `<option value="${l.id}">${escapeHTMLMiEquipo(nombreCompletoPersona(l))}</option>`).join('')}
    </select>
    <label for="motivoCambioRamaInput">Motivo (opcional)</label>
    <textarea id="motivoCambioRamaInput" rows="3" placeholder="Ej. se inscribió bajo mí por error, en realidad es invitada de..." style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>
    <div id="cambioRamaError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="confirmarSolicitarCambioRamaBtn">Enviar solicitud</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarSolicitarCambioRamaBtn').addEventListener('click', () => {
    const liderPropuestaId = document.getElementById('liderDestinoSelect').value;
    const motivo = document.getElementById('motivoCambioRamaInput').value.trim();
    const resultado = crearSolicitudCambioRama(personaId, {
      liderPropuestaId,
      motivo,
      solicitadoPorId: liderReal.id,
      solicitadoPorNombre: nombreCompletoPersona(liderReal)
    });
    if (!resultado.ok) {
      const error = document.getElementById('cambioRamaError');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }
    overlay.classList.remove('open');
    renderGestionEquipo();
    mostrarToast(`Se envió la solicitud de cambio de rama de ${nombreCompletoPersona(persona)} a Administración.`);
  });

}

// ---------- Alertas de inactividad (datos reales) ----------
//
// A diferencia del árbol visual de abajo (todavía sobre datos de
// ejemplo, ver nota de arquitectura al inicio del archivo), esta
// sección SÍ usa el registro real de personas — calcularDescendenciaPersona
// y persona.alertaInactividad (js/alertas-inactividad-modelo.js) — para
// que la líder vea de verdad a quién de su equipo hay que contactar.
function renderAlertasInactividadEquipo() {

  const wrap = document.getElementById('alertasInactividadLista');
  if (!wrap || typeof calcularDescendenciaPersona !== 'function') return;

  const { conNivel } = calcularDescendenciaPersona(obtenerLiderActualId());
  const conAlerta = conNivel
    .map(n => n.persona)
    .filter(p => p.alertaInactividad)
    .sort((a, b) => a.alertaInactividad.desde.localeCompare(b.alertaInactividad.desde));

  if (!conAlerta.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Todo tu equipo tiene actividad reciente — no hay alertas por ahora.</p>';
    return;
  }

  wrap.innerHTML = conAlerta.map(p => `
    <div class="equipo-modal-row">
      <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))} <span class="badge team-alert-badge">Sin actividad desde ${formatearFechaCortaMiEquipo(p.alertaInactividad.desde)}</span></span>
      <button class="btn btn-outline" type="button" data-contactar="${p.id}">Contactar por WhatsApp</button>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-contactar]').forEach(btn => {
    btn.addEventListener('click', () => abrirContactoWhatsappInactividad(obtenerPersonaPorId(btn.getAttribute('data-contactar'))));
  });

}

function formatearFechaCortaMiEquipo(fechaISO) {
  const fecha = new Date(fechaISO);
  if (Number.isNaN(fecha.getTime())) return '—';
  return fecha.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function abrirContactoWhatsappInactividad(persona) {

  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const numero = (persona.telefono || '').replace(/\D/g, '');
  const mensaje = `Hola ${persona.nombre}, ¿cómo estás? Hace tiempo no te veo comprar y quería saber cómo vas — ¿todo bien? Cualquier cosa que necesites, aquí estoy.`;
  const enlace = numero ? `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}` : '#';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Contactar a ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">Lleva sin llegar a la compra mínima desde el ${formatearFechaCortaMiEquipo(persona.alertaInactividad?.desde)}.</p>
    ${numero
      ? `<a class="btn btn-primary" style="width:100%;display:grid;place-items:center;text-decoration:none;" href="${enlace}" target="_blank" rel="noopener">Abrir WhatsApp</a>`
      : '<p class="auth-error">Esta persona no tiene un número de teléfono registrado.</p>'}
  `;

  overlay.classList.add('open');

}

// ---------- Reclamar una emprendedora de otra líder ----------
//
// La otra mitad del mismo flujo: si crees que una emprendedora recién
// inscrita (últimos 5 días) debía haber quedado bajo ti y no bajo
// quien la registró, puedes buscarla aquí y solicitar el cambio —
// misma solicitud que arriba, Admin decide igual.
function renderReclamarEmprendedora() {

  const wrap = document.getElementById('reclamarLista');
  if (!wrap) return;

  const liderReal = obtenerPersonaPorId(obtenerLiderActualId());
  if (!liderReal) return;

  const texto = (document.getElementById('reclamarBuscarInput')?.value || '').trim().toLowerCase();

  if (!texto) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Escribe un nombre para buscar.</p>';
    return;
  }

  const candidatas = obtenerPersonas().filter(p =>
    p.tipo === 'emprendedora' &&
    p.liderId !== liderReal.id &&
    puedeSolicitarCambioRama(p) &&
    nombreCompletoPersona(p).toLowerCase().includes(texto)
  );

  if (!candidatas.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">No hay emprendedoras recién inscritas (últimos 5 días) que coincidan.</p>';
    return;
  }

  wrap.innerHTML = candidatas.map(p => {
    const liderActual = p.liderId ? obtenerPersonaPorId(p.liderId) : null;
    return `
      <div class="equipo-modal-row">
        <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))} <small style="color:var(--mw-text-muted);">(actualmente con ${liderActual ? escapeHTMLMiEquipo(nombreCompletoPersona(liderActual)) : 'sin líder'})</small></span>
        <button class="btn btn-outline" type="button" data-reclamar="${p.id}">Solicitar a mi equipo</button>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('[data-reclamar]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalReclamar(btn.getAttribute('data-reclamar'), liderReal));
  });

}

function abrirModalReclamar(personaId, liderReal) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar a ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))} para tu equipo</h3>
    <p class="modal-sub">Administración revisará tu solicitud y decidirá si la confirma.</p>
    <label for="motivoReclamarInput">Motivo (opcional)</label>
    <textarea id="motivoReclamarInput" rows="3" placeholder="Ej. yo la invité, se inscribió bajo otra líder por error" style="width:100%;border:1px solid #ddd5e3;border-radius:7px;padding:10px 12px;font:inherit;color:#312044;resize:vertical;"></textarea>
    <div id="reclamarError" class="auth-error" style="display:none;"></div>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="confirmarReclamarBtn">Enviar solicitud</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarReclamarBtn').addEventListener('click', () => {
    const motivo = document.getElementById('motivoReclamarInput').value.trim();
    const resultado = crearSolicitudCambioRama(personaId, {
      liderPropuestaId: liderReal.id,
      motivo,
      solicitadoPorId: liderReal.id,
      solicitadoPorNombre: nombreCompletoPersona(liderReal)
    });
    if (!resultado.ok) {
      const error = document.getElementById('reclamarError');
      if (error) { error.textContent = resultado.error; error.style.display = 'block'; }
      return;
    }
    overlay.classList.remove('open');
    renderReclamarEmprendedora();
    mostrarToast(`Se envió tu solicitud para que ${nombreCompletoPersona(persona)} pase a tu equipo.`);
  });

}

function escapeHTMLMiEquipo(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------- Meses a consultar ----------
function obtenerMesesDisponiblesEquipo() {
  const meses = [];
  const hoy = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return meses;
}

const MESES_LARGO_EQUIPO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatearMesLabelEquipo(mesKey) {
  const [anio, mes] = mesKey.split('-').map(Number);
  const nombre = MESES_LARGO_EQUIPO[mes - 1] || mesKey;
  return `${nombre.charAt(0).toUpperCase()}${nombre.slice(1)} ${anio}`;
}

function renderEquipoMesSelect() {
  const sel = document.getElementById('equipoMesSelect');
  if (!sel) return;
  const meses = obtenerMesesDisponiblesEquipo();
  const actual = mesKeyActualComprasModelo();
  sel.innerHTML = meses.map(mk => `<option value="${mk}" ${mk === equipoMesSeleccionado ? 'selected' : ''}>${formatearMesLabelEquipo(mk)}${mk === actual ? ' (mes en curso)' : ''}</option>`).join('');
}

// Puntos reales (compras liquidadas) de una persona en un sub-periodo
// del mes que se está consultando — misma fuente que usa el resto del
// Plan MW (js/compras-modelo.js), nunca datos de ejemplo.
function puntosSubPeriodoEquipo(personaId, subPeriodo) {
  if (typeof obtenerComprasLiquidadasPersonaSubPeriodo !== 'function') return 0;
  return obtenerComprasLiquidadasPersonaSubPeriodo(personaId, equipoMesSeleccionado, subPeriodo).total;
}

// ---------- Tarjetas de nivel ----------
function renderNivelCards() {
  if (typeof calcularDescendenciaPersona !== 'function') return;
  const { conNivel } = calcularDescendenciaPersona(obtenerLiderActualId());
  const porNivel = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  conNivel.forEach(({ persona, nivel }) => {
    if (nivel >= 1 && nivel <= 5) porNivel[nivel].push(persona);
  });

  const grid = document.getElementById('nivelesGrid');
  grid.innerHTML = [1, 2, 3, 4, 5].map((nivel) => `
    <button class="team-level-card" style="text-align:left; cursor:pointer; width:100%;" data-nivel="${nivel}">
      <div class="icon-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
      </div>
      <h4>Nivel ${nivel}</h4>
      <span class="tl-count">${porNivel[nivel].length}</span>
      <span class="tl-sub">Personas · toca para ver</span>
    </button>
  `).join('');

  grid.querySelectorAll('[data-nivel]').forEach((btn) => {
    const nivel = Number(btn.getAttribute('data-nivel'));
    btn.addEventListener('click', () => abrirModalNivel(nivel, porNivel[nivel]));
  });
}

function abrirModalNivel(nivel, personas) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const filas = personas.length > 0
    ? personas.map(p => {
      const total = puntosSubPeriodoEquipo(p.id, 'p1') + puntosSubPeriodoEquipo(p.id, 'p2');
      return `
        <div class="equipo-modal-row">
          <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</span>
          <span class="em-puntos">${total > 0 ? total.toLocaleString('es-MX') + ' pts' : 'Sin datos'}</span>
        </div>
      `;
    }).join('')
    : '<div class="equipo-modal-empty">Todavía no hay integrantes en este nivel.</div>';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nivel ${nivel}</h3>
    <p class="modal-sub">Nombre y puntos de ${formatearMesLabelEquipo(equipoMesSeleccionado)}.</p>
    <div class="equipo-modal-list">${filas}</div>
  `;
  overlay.classList.add('open');
}

// ---------- Árbol visual conectado (zoom + buscador) ----------
function renderArbolVisual() {
  const liderId = obtenerLiderActualId();
  const lider = obtenerPersonaPorId(liderId);
  const contenedor = document.getElementById('orgTreeContainer');
  if (!contenedor) return;

  if (!lider || typeof calcularDescendenciaPersona !== 'function') {
    contenedor.innerHTML = '<div class="equipo-modal-empty">No se pudo cargar tu equipo.</div>';
    return;
  }

  const { porLider } = calcularDescendenciaPersona(liderId);

  function renderNode(persona, isSelf, depth) {
    const lvlClass = isSelf ? 'self' : `lvl-${((depth - 1) % 5) + 1}`;
    const total = puntosSubPeriodoEquipo(persona.id, 'p1') + puntosSubPeriodoEquipo(persona.id, 'p2');
    const nombre = nombreCompletoPersona(persona);
    const nodeHtml = `
      <div class="org-node ${lvlClass}" data-nombre="${escapeHTMLMiEquipo(nombre.toLowerCase())}">
        <span class="on-name">${escapeHTMLMiEquipo(nombre)}</span>
        <span class="on-tag">${isSelf ? 'Tú' : `Nivel ${depth}`}</span>
        <span class="on-points">${total.toLocaleString('es-MX')} pts</span>
      </div>`;
    const hijos = porLider[persona.id] || [];
    if (hijos.length === 0) return `<li>${nodeHtml}</li>`;
    return `<li>${nodeHtml}<ul>${hijos.map(h => renderNode(h, false, depth + 1)).join('')}</ul></li>`;
  }

  contenedor.innerHTML = `<div class="org-tree"><ul>${renderNode(lider, true, 0)}</ul></div>`;
  aplicarZoomEquipo();

  // En pantallas angostas el árbol es más ancho que la ventana y queda
  // centrado dentro de sí mismo (justify-content:center) — sin esto, el
  // scroll inicial (0) muestra el borde izquierdo del árbol completo, no
  // la raíz. Centramos el scroll para que "Tú (Líder)" quede a la vista.
  const wrap = document.getElementById('equipoTreeViewport');
  if (wrap) {
    requestAnimationFrame(() => {
      wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
    });
  }

  buscarEnArbolEquipo(document.getElementById('equipoBuscarInput')?.value || '');
}

function aplicarZoomEquipo() {
  const contenedor = document.getElementById('orgTreeContainer');
  if (contenedor) contenedor.style.cssText = `transform:scale(${equipoZoomActual});transform-origin:top center;transition:transform .15s ease;`;
  const label = document.getElementById('equipoZoomLabel');
  if (label) label.textContent = `${Math.round(equipoZoomActual * 100)}%`;
}

function ajustarZoomEquipo(delta) {
  equipoZoomActual = Math.min(1.6, Math.max(0.4, +(equipoZoomActual + delta).toFixed(2)));
  aplicarZoomEquipo();
}

function buscarEnArbolEquipo(texto) {
  const nodos = Array.from(document.querySelectorAll('#orgTreeContainer .org-node'));
  nodos.forEach(n => n.classList.remove('match', 'match-active'));

  const statusEl = document.getElementById('equipoSearchStatus');
  const navEl = document.getElementById('equipoSearchNav');
  const limpio = texto.trim().toLowerCase();

  if (!limpio) {
    equipoResultadosBusqueda = [];
    equipoIndiceResultado = 0;
    if (navEl) navEl.style.display = 'none';
    if (statusEl) statusEl.textContent = '';
    return;
  }

  equipoResultadosBusqueda = nodos.filter(n => (n.getAttribute('data-nombre') || '').includes(limpio));
  equipoIndiceResultado = 0;

  if (!equipoResultadosBusqueda.length) {
    if (navEl) navEl.style.display = 'none';
    if (statusEl) { statusEl.textContent = 'No se encontró a nadie con ese nombre en tu equipo.'; statusEl.className = 'status err'; }
    return;
  }

  if (statusEl) { statusEl.textContent = ''; statusEl.className = 'status'; }
  equipoResultadosBusqueda.forEach(n => n.classList.add('match'));
  if (navEl) navEl.style.display = equipoResultadosBusqueda.length > 1 ? 'flex' : 'none';
  resaltarResultadoActualEquipo();
}

function resaltarResultadoActualEquipo() {
  document.querySelectorAll('#orgTreeContainer .org-node.match-active').forEach(n => n.classList.remove('match-active'));
  const nodo = equipoResultadosBusqueda[equipoIndiceResultado];
  if (!nodo) return;
  nodo.classList.add('match-active');
  nodo.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  const counter = document.getElementById('equipoMatchCounter');
  if (counter) counter.textContent = `${equipoIndiceResultado + 1} / ${equipoResultadosBusqueda.length}`;
}

function moverResultadoBusquedaEquipo(delta) {
  if (!equipoResultadosBusqueda.length) return;
  equipoIndiceResultado = (equipoIndiceResultado + delta + equipoResultadosBusqueda.length) % equipoResultadosBusqueda.length;
  resaltarResultadoActualEquipo();
}

// ---------- Cuenta regresiva al cierre del periodo ----------
function calcularInfoPeriodoEquipo(fecha) {
  fecha = fecha || new Date();
  const year = fecha.getFullYear();
  const month = fecha.getMonth();
  const day = fecha.getDate();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  let siguienteInicio, etiquetaRango;
  if (day <= 15) {
    siguienteInicio = new Date(year, month, 16, 0, 0, 0);
    etiquetaRango = `Periodo 1: 1–15 de ${MESES_LARGO_EQUIPO[month]}`;
  } else {
    siguienteInicio = new Date(year, month + 1, 1, 0, 0, 0);
    etiquetaRango = `Periodo 2: 16–${diasEnMes} de ${MESES_LARGO_EQUIPO[month]}`;
  }
  return { siguienteInicio, etiquetaRango, periodoActual: day <= 15 ? 1 : 2 };
}

function actualizarCuentaRegresivaEquipo() {
  const info = calcularInfoPeriodoEquipo();
  let diff = Math.max(0, info.siguienteInicio.getTime() - Date.now());

  const dias = Math.floor(diff / 86400000); diff -= dias * 86400000;
  const horas = Math.floor(diff / 3600000); diff -= horas * 3600000;
  const minutos = Math.floor(diff / 60000); diff -= minutos * 60000;
  const segundos = Math.floor(diff / 1000);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = String(val).padStart(2, '0'); };
  set('equipoCdDays', dias);
  set('equipoCdHours', horas);
  set('equipoCdMinutes', minutos);
  set('equipoCdSeconds', segundos);

  const siguienteLabel = info.periodoActual === 1 ? 'Periodo 2' : 'Periodo 1 del próximo mes';
  const labelEl = document.getElementById('equipoPeriodLabel');
  if (labelEl) labelEl.textContent = `Estamos en ${info.etiquetaRango}. Cuenta regresiva para ${siguienteLabel}.`;
}

function iniciarCuentaRegresivaEquipo() {
  actualizarCuentaRegresivaEquipo();
  setInterval(actualizarCuentaRegresivaEquipo, 1000);
}

// ---------- Resumen por línea ----------
function abrirModalResumenLinea() {
  const liderId = obtenerLiderActualId();
  if (typeof calcularDescendenciaPersona !== 'function') return;

  const { conNivel } = calcularDescendenciaPersona(liderId);
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  if (!conNivel.length) {
    box.innerHTML = `
      <button class="modal-close" data-close>&times;</button>
      <h3>Resumen por línea</h3>
      <p class="modal-sub">Todavía no hay nadie en líneas debajo de ti.</p>
    `;
    overlay.classList.add('open');
    return;
  }

  const porNivel = {};
  conNivel.forEach(({ persona, nivel }) => { (porNivel[nivel] = porNivel[nivel] || []).push(persona); });
  const niveles = Object.keys(porNivel).map(Number).sort((a, b) => a - b);

  const bloques = niveles.map(nivel => {
    const personas = porNivel[nivel].slice().sort((a, b) => nombreCompletoPersona(a).localeCompare(nombreCompletoPersona(b)));
    let totalLinea = 0;
    const tarjetas = personas.map(p => {
      const p1 = puntosSubPeriodoEquipo(p.id, 'p1');
      const p2 = puntosSubPeriodoEquipo(p.id, 'p2');
      totalLinea += p1 + p2;
      return `
        <div class="person-card">
          <div class="pc-name">${escapeHTMLMiEquipo(nombreCompletoPersona(p))}</div>
          <div class="pc-points">
            <div>P1<b>${p1.toLocaleString('es-MX')}</b></div>
            <div>P2<b>${p2.toLocaleString('es-MX')}</b></div>
            <div class="pc-total">Total<b>${(p1 + p2).toLocaleString('es-MX')}</b></div>
          </div>
        </div>`;
    }).join('');
    return `
      <details class="level-block" ${nivel === 1 ? 'open' : ''}>
        <summary class="level-color-${((nivel - 1) % 5) + 1}">
          <span class="lb-title"><span class="lb-arrow">▶</span> Línea ${nivel}</span>
          <span class="lb-stats"><span><b>${personas.length}</b> persona(s)</span><span><b>${totalLinea.toLocaleString('es-MX')}</b> pts total</span></span>
        </summary>
        <div class="lb-body">${tarjetas}</div>
      </details>`;
  }).join('');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Resumen por línea</h3>
    <p class="modal-sub">${formatearMesLabelEquipo(equipoMesSeleccionado)}</p>
    <div class="level-summary-wrap">${bloques}</div>
  `;
  overlay.classList.add('open');
}

// ---------- Descargar árbol en Excel ----------
function descargarArbolExcel() {

  const liderId = obtenerLiderActualId();
  if (typeof calcularDescendenciaPersona !== 'function') return;
  const { conNivel } = calcularDescendenciaPersona(liderId);

  const filas = conNivel
    .filter(n => n.nivel >= 1 && n.nivel <= 5)
    .map(n => ({
      nivel: n.nivel,
      nombre: nombreCompletoPersona(n.persona),
      p1: puntosSubPeriodoEquipo(n.persona.id, 'p1'),
      p2: puntosSubPeriodoEquipo(n.persona.id, 'p2')
    }))
    .sort((a, b) => a.nivel - b.nivel || a.nombre.localeCompare(b.nombre));

  if (!filas.length) {
    mostrarToast('Todavía no hay integrantes en tu equipo para exportar.');
    return;
  }

  const encabezado = ['Nivel', 'Nombre', 'Puntos periodo 1', 'Puntos periodo 2', 'Puntos totales'];
  const cuerpo = filas.map(f => [f.nivel, f.nombre, f.p1.toFixed(2), f.p2.toFixed(2), (f.p1 + f.p2).toFixed(2)]);

  const csv = '﻿' + [encabezado, ...cuerpo]
    .map(fila => fila.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mi-arbol-mw-${equipoMesSeleccionado}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  mostrarToast('Excel generado.');

}
