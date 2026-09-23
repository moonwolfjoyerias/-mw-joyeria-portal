// MW JOYERÍA — Dashboard de Líder (Inicio)
// Depende de RANGOS_MW, LIDER_EJEMPLO, EQUIPO_NIVELES_EJEMPLO (lider-ejemplo.js).

document.addEventListener('DOMContentLoaded', () => {
  renderRankHero();
  renderStatCards();
  renderProgresoRango();
  renderEquipoNiveles();

  document.getElementById('verBeneficiosBtn')?.addEventListener('click', abrirModalBeneficios);
});

// Tabla de referencia: qué gana cada rango (comisión por nivel de
// equipo + bono al alcanzarlo) — a diferencia de renderProgresoRango(),
// que solo muestra el avance de ESTA líder, aquí se listan TODOS los
// rangos para que sepa qué hay más adelante en el Plan MW.
function abrirModalBeneficios() {
  const overlay = document.getElementById('modalOverlay');
  const box = document.getElementById('modalBox');
  if (!overlay || !box) return;

  const rangosConBeneficio = RANGOS_MW.filter(r => r.key !== 'sin_rango');

  box.innerHTML = `
    <button class="modal-close" data-close>&times;</button>
    <h3>Beneficios por rango</h3>
    <p class="modal-sub">Lo que gana cada rango del Plan MW — comisión por nivel de tu equipo y el bono al alcanzarlo.</p>
    <div style="overflow-x:auto;margin-top:0.8rem;">
      <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
        <thead>
          <tr style="text-align:left;border-bottom:1px solid var(--mw-border);">
            <th style="padding:0.5rem 0.6rem;">Rango</th>
            <th style="padding:0.5rem 0.6rem;">Nivel 1</th>
            <th style="padding:0.5rem 0.6rem;">Nivel 2</th>
            <th style="padding:0.5rem 0.6rem;">Nivel 3</th>
            <th style="padding:0.5rem 0.6rem;">Nivel 4</th>
            <th style="padding:0.5rem 0.6rem;">Nivel 5</th>
            <th style="padding:0.5rem 0.6rem;">Bono al subir</th>
          </tr>
        </thead>
        <tbody>
          ${rangosConBeneficio.map(r => {
            const pct = (typeof COMISIONES_PCT !== 'undefined' && COMISIONES_PCT[r.key]) || [0, 0, 0, 0, 0];
            const bono = (typeof BONOS_RANGO !== 'undefined' && BONOS_RANGO[r.key]) || 0;
            const esActual = r.key === LIDER_EJEMPLO.rangoActualKey;
            return `
              <tr style="border-bottom:1px solid var(--mw-border);${esActual ? 'background:var(--mw-lilac-soft);' : ''}">
                <td style="padding:0.5rem 0.6rem;font-weight:600;">${r.label}${esActual ? ' <span style="font-weight:400;color:var(--mw-purple);">(tú)</span>' : ''}</td>
                ${pct.map(p => `<td style="padding:0.5rem 0.6rem;">${p > 0 ? p + '%' : '—'}</td>`).join('')}
                <td style="padding:0.5rem 0.6rem;">${fmtMoney(bono)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p class="modal-sub" style="margin-top:0.8rem;">Los niveles son las generaciones de tu red (hasta 5 niveles hacia abajo).</p>
    <p class="modal-sub">El bono por rango se otorga una sola vez: la primera vez que alcanzas ese rango. Si bajas y vuelves a alcanzarlo, no se vuelve a pagar.</p>
  `;
  box.classList.add('modal-box-wide');
  overlay.classList.add('open');

  const cerrar = () => {
    overlay.classList.remove('open');
    box.classList.remove('modal-box-wide');
  };
  box.querySelector('[data-close]')?.addEventListener('click', cerrar);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) cerrar(); }, { once: true });
}

function idxRango(key) {
  return RANGOS_MW.findIndex(r => r.key === key);
}

function fmtMoney(n) {
  return `$${n.toLocaleString('es-MX')}`;
}

function renderRankHero() {
  const idx = idxRango(LIDER_EJEMPLO.rangoActualKey);
  const rango = RANGOS_MW[idx];
  setText('rankHeroLabel', rango.label.toUpperCase());
  const esUltimo = idx === RANGOS_MW.length - 1;
  setText('rankHeroNote', esUltimo ? '¡Has alcanzado el rango más alto!' : '¡Vas por un camino incréible!');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderStatCards() {
  const { personasActivas, produccionGrupalMes, personasCalificadas } = LIDER_EJEMPLO.stats;
  setText('statPersonas', personasActivas);
  setText('statProduccion', fmtMoney(produccionGrupalMes));
  setText('statCalificado', personasCalificadas);
  setText('statRango', RANGOS_MW[idxRango(LIDER_EJEMPLO.rangoActualKey)].label.toUpperCase());
}

function renderProgresoRango() {
  const idxActual = idxRango(LIDER_EJEMPLO.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];
  const { personasActivas, produccionGrupalMes, personasCalificadas, compraPersonalPeriodo1, compraPersonalPeriodo2 } = LIDER_EJEMPLO.stats;

  // Línea de tiempo (todos los rangos, avance según producción grupal acumulada)
  const nodesWrap = document.getElementById('rankNodes');
  nodesWrap.innerHTML = RANGOS_MW.map(r => {
    const alcanzado = produccionGrupalMes >= r.produccion;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>'}
        </div>
        <span class="node-label">${r.label}<br>${fmtMoney(r.produccion)}</span>
      </div>
    `;
  }).join('');

  const maxProduccion = RANGOS_MW[RANGOS_MW.length - 1].produccion;
  const pctFill = Math.min(100, (produccionGrupalMes / maxProduccion) * 100);
  document.getElementById('rankFill').style.width = `${pctFill}%`;

  const tituloProgreso = document.getElementById('progresoTitulo');
  const subProgreso = document.getElementById('progresoSub');
  if (siguiente) {
    tituloProgreso.innerHTML = `Progreso hacia ${siguiente.label.toUpperCase()} <span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg></span>`;
    const faltante = Math.max(0, siguiente.produccion - produccionGrupalMes);
    subProgreso.textContent = faltante > 0
      ? `Te faltan ${fmtMoney(faltante)} de producción grupal para alcanzar ${siguiente.label}.`
      : `¡Ya cumples la producción grupal para ${siguiente.label}! Revisa los demás requisitos abajo.`;
  } else {
    tituloProgreso.innerHTML = '¡Estás en el rango más alto! <span class="icon-inline"><svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9L12 2z"/></svg></span>';
    subProgreso.textContent = 'Sigue así para mantenerte en Corona el próximo mes.';
  }

  // Checklist de los otros 3 requisitos, comparados contra el SIGUIENTE rango
  const checklist = document.getElementById('rankChecklist');
  if (!siguiente) {
    checklist.innerHTML = '';
    return;
  }

  const compraMinima = Math.min(compraPersonalPeriodo1, compraPersonalPeriodo2);
  const items = [
    {
      label: 'Personas activas',
      cumple: personasActivas >= siguiente.personas,
      valores: `${personasActivas} / ${siguiente.personas}`,
    },
    {
      label: 'Compra personal (ambos periodos)',
      cumple: compraMinima >= siguiente.compra,
      valores: `${fmtMoney(compraPersonalPeriodo1)} y ${fmtMoney(compraPersonalPeriodo2)} / ${fmtMoney(siguiente.compra)}`,
    },
    {
      label: 'Equipo calificado',
      cumple: personasCalificadas >= siguiente.calificado,
      valores: `${personasCalificadas} / ${siguiente.calificado} personas`,
    },
  ];

  checklist.innerHTML = items.map(it => `
    <div class="check-item ${it.cumple ? 'met' : 'unmet'}">
      <span class="check-icon">
        ${it.cumple
          ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}
      </span>
      <span class="check-label">${it.label}</span>
      <span class="check-values">${it.valores}</span>
    </div>
  `).join('');

  // Panel de siguiente rango (beneficios)
  setText('nextRankLabel', siguiente.label.toUpperCase());
}

function renderEquipoNiveles() {
  const wrap = document.getElementById('equipoNivelesGrid');
  wrap.innerHTML = EQUIPO_NIVELES_EJEMPLO.map(n => {
    const avatares = n.nombres.slice(0, 4).map(nom => {
      const iniciales = nom.split(' ').map(p => p[0]).join('').toUpperCase();
      return `<span class="tl-avatar">${iniciales}</span>`;
    }).join('');
    const extra = n.nombres.length > 4 ? `<span class="tl-avatar more">+${n.nombres.length - 4}</span>` : '';
    const contenidoAvatares = n.personasActivas > 0
      ? `<div class="tl-avatars">${avatares}${extra}</div>`
      : `<span class="tl-empty">Sin integrantes todavía</span>`;

    return `
      <div class="team-level-card">
        <div class="icon-circle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="3.5"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </div>
        <h4>Nivel ${n.nivel}</h4>
        <span class="tl-count">${n.personasActivas}</span>
        <span class="tl-sub">Personas activas</span>
        ${contenidoAvatares}
      </div>
    `;
  }).join('');
}
