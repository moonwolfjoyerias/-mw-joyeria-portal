// MW JOYERÍA — Mi equipo (Líder)
// Depende de EQUIPO_ARBOL_EJEMPLO (equipo-ejemplo.js).
// La lógica de niveles y el árbol visual están adaptados de la herramienta
// "Árbol del Equipo" de la señora, pero alimentados por nuestros propios
// datos de ejemplo (sin su sistema de registro/almacenamiento).

document.addEventListener('DOMContentLoaded', () => {
  renderNivelCards();
  renderArbolVisual();

  const btnPdf = document.getElementById('descargarArbolBtn');
  if (btnPdf) btnPdf.addEventListener('click', descargarArbolPDF);
});

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
}

// ---------- Descargar árbol en PDF ----------
async function descargarArbolPDF() {
  if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
    mostrarToast('No se pudo generar el PDF — intenta de nuevo en un momento.');
    return;
  }
  const viewport = document.getElementById('orgTreeContainer');
  const canvas = await html2canvas(viewport, { backgroundColor: '#ffffff', scale: 2 });
  const imgData = canvas.toDataURL('image/png');

  const { jsPDF } = window.jspdf;
  const orientacion = canvas.width > canvas.height ? 'l' : 'p';
  const pdf = new jsPDF({ orientation: orientacion, unit: 'pt', format: [canvas.width, canvas.height] });
  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
  pdf.save('mi-arbol-mw.pdf');
}
