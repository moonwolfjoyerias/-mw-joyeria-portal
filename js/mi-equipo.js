// MW JOYERÍA — Mi equipo (Líder)
// Depende de EQUIPO_ARBOL_EJEMPLO (equipo-ejemplo.js) para las tarjetas
// de nivel y el árbol visual — dataset de ejemplo, sin vínculo por
// sesión a una persona real todavía (limitación conocida y ya
// reportada). "Gestionar equipo" (solicitar baja) SÍ usa el registro
// real de personas (js/personas-ejemplo.js), porque una solicitud de
// baja necesita ejecutarse sobre una persona real que Admin pueda
// encontrar y confirmar — no tendría sentido pedir la baja de alguien
// que no existe en el sistema real.
// ⚠️ TEMPORAL: 'ana-torres' se usa como identidad fija de "la Líder con
// sesión abierta" (misma convención que RH_EMPLEADO/ADMIN_EMPLEADO en
// otros portales) hasta que exista sesión real vinculada a una persona.
const LIDER_ACTUAL_ID_REAL = 'ana-torres';

document.addEventListener('DOMContentLoaded', () => {
  renderNivelCards();
  renderArbolVisual();
  renderGestionEquipo();

  const btnPdf = document.getElementById('descargarArbolBtn');
  if (btnPdf) btnPdf.addEventListener('click', descargarArbolPDF);
});

// ---------- Gestionar equipo (solicitar baja — Sección 15.3) ----------
function renderGestionEquipo() {

  const wrap = document.getElementById('gestionEquipoLista');
  if (!wrap || typeof calcularDescendenciaPersona !== 'function') return;

  const liderReal = obtenerPersonaPorId(LIDER_ACTUAL_ID_REAL);
  if (!liderReal) { wrap.innerHTML = '<p class="equipo-modal-empty">No se pudo cargar tu equipo.</p>'; return; }

  const { conNivel } = calcularDescendenciaPersona(LIDER_ACTUAL_ID_REAL);
  const equipo = conNivel.map(n => n.persona).filter(p => p.estado !== 'baja');

  if (!equipo.length) {
    wrap.innerHTML = '<p class="equipo-modal-empty">Todavía no tienes integrantes en tu equipo.</p>';
    return;
  }

  wrap.innerHTML = equipo.map(p => `
    <div class="equipo-modal-row">
      <span>${escapeHTMLMiEquipo(nombreCompletoPersona(p))} <small style="color:var(--mw-text-muted);">(${p.tipo === 'lider' ? 'Líder' : 'Emprendedora'})</small></span>
      ${p.solicitudBajaPendiente
        ? '<span class="badge badge-ascenso" style="background:#fbe7e9;color:#a3272f;">Baja pendiente de revisión</span>'
        : `<button class="btn btn-outline" type="button" data-solicitar-baja="${p.id}">Solicitar baja</button>`}
    </div>
  `).join('');

  wrap.querySelectorAll('[data-solicitar-baja]').forEach(btn => {
    btn.addEventListener('click', () => abrirModalSolicitarBaja(btn.getAttribute('data-solicitar-baja'), liderReal));
  });

}

function abrirModalSolicitarBaja(personaId, liderReal) {

  const persona = obtenerPersonaPorId(personaId);
  if (!persona) return;

  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Solicitar baja de ${escapeHTMLMiEquipo(nombreCompletoPersona(persona))}</h3>
    <p class="modal-sub">Administración revisará tu solicitud y decidirá si la confirma.</p>
    <label for="motivoBajaInput">Motivo (opcional)</label>
    <textarea id="motivoBajaInput" rows="3" placeholder="Ej. ya no está participando en el negocio"></textarea>
    <button class="btn btn-primary" style="width:100%;margin-top:10px;" id="confirmarSolicitarBajaBtn">Enviar solicitud</button>
  `;
  overlay.classList.add('open');

  document.getElementById('confirmarSolicitarBajaBtn').addEventListener('click', () => {
    const motivo = document.getElementById('motivoBajaInput').value.trim();
    const resultado = crearSolicitudBajaPersona(personaId, {
      motivo,
      solicitadoPorId: liderReal.id,
      solicitadoPorNombre: nombreCompletoPersona(liderReal)
    });
    overlay.classList.remove('open');
    if (!resultado.ok) { mostrarToast(resultado.error); return; }
    renderGestionEquipo();
    mostrarToast(`Se envió la solicitud de baja de ${nombreCompletoPersona(persona)} a Administración.`);
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

function calcularProfundidades() {
  const depthById = { yo: 0 };
  let added = true;
  while (added) {
    added = false;
    EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
      if (m.leaderId && depthById.hasOwnProperty(m.leaderId) && !depthById.hasOwnProperty(m.id)) {
        depthById[m.id] = depthById[m.leaderId] + 1;
        added = true;
      }
    });
  }
  return depthById;
}

// ---------- Tarjetas de nivel ----------
function renderNivelCards() {
  const depths = calcularProfundidades();
  const porNivel = { 1: [], 2: [], 3: [], 4: [], 5: [] };

  EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
    const d = depths[m.id];
    if (d >= 1 && d <= 5) porNivel[d].push(m);
  });

  const grid = document.getElementById('nivelesGrid');
  grid.innerHTML = [1, 2, 3, 4, 5].map((nivel) => `
    <button class="team-level-card" style="text-align:left; cursor:pointer; width:100%;" data-nivel="${nivel}">
      <div class="icon-circle">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
      </div>
      <h4>Nivel ${nivel}</h4>
      <span class="tl-count">${porNivel[nivel].length}</span>
      <span class="tl-sub">Personas activas · toca para ver</span>
    </button>
  `).join('');

  grid.querySelectorAll('[data-nivel]').forEach((btn) => {
    btn.addEventListener('click', () => abrirModalNivel(Number(btn.getAttribute('data-nivel')), porNivel[Number(btn.getAttribute('data-nivel'))]));
  });
}

function abrirModalNivel(nivel, personas) {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');

  const filas = personas.length > 0
    ? personas.map(p => `
      <div class="equipo-modal-row">
        <span>${p.nombre}</span>
        <span class="em-puntos">${p.puntos != null ? p.puntos.toLocaleString('es-MX') + ' pts' : 'Sin datos'}</span>
      </div>
    `).join('')
    : '<div class="equipo-modal-empty">Todavía no hay integrantes en este nivel.</div>';

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Nivel ${nivel}</h3>
    <p class="modal-sub">Nombre y puntos de producción grupal acumulados este mes.</p>
    <div class="equipo-modal-list">${filas}</div>
  `;
  overlay.classList.add('open');
}

// ---------- Árbol visual conectado ----------
function renderArbolVisual() {
  const byId = {};
  EQUIPO_ARBOL_EJEMPLO.forEach(m => { byId[m.id] = { ...m, children: [] }; });
  EQUIPO_ARBOL_EJEMPLO.forEach(m => {
    if (m.leaderId && byId[m.leaderId]) byId[m.leaderId].children.push(byId[m.id]);
  });

  function renderNode(node, isSelf, depth) {
    const lvlClass = isSelf ? 'self' : `lvl-${((depth - 1) % 5) + 1}`;
    const puntosLine = node.puntos != null ? `<span class="on-points">${node.puntos.toLocaleString('es-MX')} pts</span>` : '';
    const nodeHtml = `
      <div class="org-node ${lvlClass}">
        <span class="on-name">${node.nombre}</span>
        <span class="on-tag">${isSelf ? 'Tú' : `Nivel ${depth}`}</span>
        ${puntosLine}
      </div>`;
    if (node.children.length === 0) return `<li>${nodeHtml}</li>`;
    return `<li>${nodeHtml}<ul>${node.children.map(c => renderNode(c, false, depth + 1)).join('')}</ul></li>`;
  }

  document.getElementById('orgTreeContainer').innerHTML = `<div class="org-tree"><ul>${renderNode(byId['yo'], true, 0)}</ul></div>`;

  // En pantallas angostas el árbol es más ancho que la ventana y queda
  // centrado dentro de sí mismo (justify-content:center) — sin esto, el
  // scroll inicial (0) muestra el borde izquierdo del árbol completo, no
  // la raíz. Centramos el scroll para que "Tú (Líder)" quede a la vista.
  const wrap = document.getElementById('orgTreeContainer')?.closest('.org-tree-wrap');
  if (wrap) {
    requestAnimationFrame(() => {
      wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2;
    });
  }
}

// ---------- Descargar árbol en PDF ----------
async function descargarArbolPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
    return;
  }

  const viewport = document.getElementById('orgTreeContainer');

  try {

    // Espera a que las fuentes web terminen de cargar — capturar antes de
    // tiempo es una causa común de que html2canvas genere un lienzo vacío.
    if (document.fonts?.ready) await document.fonts.ready;

    const canvas = await html2canvas(viewport, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: viewport.scrollWidth,
      windowHeight: viewport.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');

    const { jsPDF } = window.jspdf;
    const orientacion = canvas.width > canvas.height ? 'l' : 'p';
    const pdf = new jsPDF({ orientation: orientacion, unit: 'pt', format: [canvas.width, canvas.height] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('mi-arbol-mw.pdf');

  } catch (error) {
    console.error('Error al generar el PDF del árbol:', error);
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
  }

}
