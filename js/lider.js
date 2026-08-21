// MW JOYERÍA — Dashboard de Líder (Inicio)
// Depende de RANGOS_MW, LIDER_EJEMPLO, EQUIPO_NIVELES_EJEMPLO (lider-ejemplo.js).

document.addEventListener('DOMContentLoaded', () => {
  renderRankHero();
  renderStatCards();
  renderProgresoRango();
  renderEquipoNiveles();
});

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
  const { personasActivas, produccionGrupalMes, equipoCalificadoPct } = LIDER_EJEMPLO.stats;
  setText('statPersonas', personasActivas);
  setText('statProduccion', fmtMoney(produccionGrupalMes));
  setText('statCalificado', `${equipoCalificadoPct}%`);
  setText('statRango', RANGOS_MW[idxRango(LIDER_EJEMPLO.rangoActualKey)].label.toUpperCase());
}

function renderProgresoRango() {
  const idxActual = idxRango(LIDER_EJEMPLO.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];
  const { personasActivas, produccionGrupalMes, equipoCalificadoPct, compraPersonalPeriodo1, compraPersonalPeriodo2 } = LIDER_EJEMPLO.stats;

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
    tituloProgreso.textContent = `Progreso hacia ${siguiente.label.toUpperCase()} ✦`;
    const faltante = Math.max(0, siguiente.produccion - produccionGrupalMes);
    subProgreso.textContent = faltante > 0
      ? `Te faltan ${fmtMoney(faltante)} de producción grupal para alcanzar ${siguiente.label}.`
      : `¡Ya cumples la producción grupal para ${siguiente.label}! Revisa los demás requisitos abajo.`;
  } else {
    tituloProgreso.textContent = '¡Estás en el rango más alto! ✦';
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
      cumple: equipoCalificadoPct >= siguiente.calificado,
      valores: `${equipoCalificadoPct}% / ${siguiente.calificado}%`,
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
