// MW JOYERÍA — Mi cuenta (Líder)
// Depende de: PERFIL_LIDER_EJEMPLO, RIFA_LIDER_EJEMPLO, CONSTANCIA_LIDER_EJEMPLO,
// COMISIONES_PCT (lider-cuenta-ejemplo.js) + RANGOS_MW, LIDER_EJEMPLO (lider-ejemplo.js)
// + EQUIPO_ARBOL_EJEMPLO (equipo-ejemplo.js).

document.addEventListener('DOMContentLoaded', () => {
  renderPerfilLider();
  renderRifaLider();
  renderConstanciaLider();
  renderProgresoRangoCuenta();
  renderTicketComisiones();
});

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString('es-MX')}`;
}
function idxRango(key) {
  return RANGOS_MW.findIndex(r => r.key === key);
}

// ---------- Perfil ----------
function renderPerfilLider() {
  const iniciales = 'LI';
  setText('perfilIniciales', iniciales);
  setText('perfilNombre', PERFIL_LIDER_EJEMPLO.nombre);
  setText('perfilLider', `Líder ${RANGOS_MW[idxRango(LIDER_EJEMPLO.rangoActualKey)].label}`);
  setText('perfilTelefono', PERFIL_LIDER_EJEMPLO.telefono);
  setText('perfilCorreo', PERFIL_LIDER_EJEMPLO.correo);
}

// ---------- Rifa mensual ----------
function renderRifaLider() {
  const { montoAcumuladoMes, meta } = RIFA_LIDER_EJEMPLO;
  const pctBase = Math.min(100, (montoAcumuladoMes / meta) * 100);
  document.getElementById('rifaFill').style.width = `${pctBase}%`;
  setText('rifaMontoActual', fmtMoney(montoAcumuladoMes));
  setText('rifaMontoMeta', fmtMoney(meta));

  const msg = document.getElementById('rifaMensaje');
  if (montoAcumuladoMes < meta) {
    msg.textContent = `Te faltan ${fmtMoney(meta - montoAcumuladoMes)} en compras este mes para ganar tu boleto de la rifa.`;
  } else {
    const extra = montoAcumuladoMes - meta;
    const boletosExtra = Math.floor(extra / 1000);
    const totalBoletos = 1 + boletosExtra;
    const faltanteSiguiente = 1000 - (extra % 1000);
    let texto = totalBoletos === 1 ? '¡Ya tienes tu boleto para la rifa de este mes! 🎟️' : `¡Llevas ${totalBoletos} boletos para la rifa de este mes! 🎟️`;
    texto += ` Te faltan ${fmtMoney(faltanteSiguiente)} para tu siguiente boleto extra.`;
    msg.textContent = texto;
  }
}

// ---------- Reto de Constancia ----------
function renderConstanciaLider() {
  const { comprasCumplidas, montoMesActual, metaMes, hitos } = CONSTANCIA_LIDER_EJEMPLO;
  const puntosLinea = [0, ...hitos.map(h => h.compras)];
  let segmentoActual = puntosLinea.length - 2;
  for (let i = 0; i < puntosLinea.length - 1; i++) {
    if (comprasCumplidas <= puntosLinea[i + 1]) { segmentoActual = i; break; }
  }
  const inicioSeg = puntosLinea[segmentoActual];
  const finSeg = puntosLinea[segmentoActual + 1];
  const fracSeg = finSeg > inicioSeg ? (comprasCumplidas - inicioSeg) / (finSeg - inicioSeg) : 1;
  const pctGeneral = Math.min(100, ((segmentoActual + fracSeg) / (puntosLinea.length - 1)) * 100);
  document.getElementById('constanciaFill').style.width = `${pctGeneral}%`;

  document.getElementById('constanciaNodes').innerHTML = hitos.map(h => {
    const alcanzado = comprasCumplidas >= h.compras;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.compras}</span>`}
        </div>
        <span class="node-label">${h.compras}° compra<br>${h.premio}</span>
      </div>
    `;
  }).join('');

  setText('constanciaResumen', `Llevas ${comprasCumplidas} compras cumplidas.`);
  const siguienteHito = hitos.find(h => h.compras > comprasCumplidas);
  const nota = document.getElementById('constanciaNota');
  nota.textContent = siguienteHito
    ? `Te falta${siguienteHito.compras - comprasCumplidas === 1 ? '' : 'n'} ${siguienteHito.compras - comprasCumplidas} compra${siguienteHito.compras - comprasCumplidas === 1 ? '' : 's'} para tu siguiente recompensa: ${siguienteHito.premio}.`
    : '¡Has alcanzado todas las recompensas! Pronto habrá una nueva categoría.';

  const pctMes = Math.min(100, (montoMesActual / metaMes) * 100);
  document.getElementById('mesFill').style.width = `${pctMes}%`;
  setText('mesMontoActual', fmtMoney(montoMesActual));
  setText('mesMontoMeta', fmtMoney(metaMes));
}

// ---------- Progreso de rango (detalle completo) ----------
function renderProgresoRangoCuenta() {
  const idxActual = idxRango(LIDER_EJEMPLO.rangoActualKey);
  const esUltimo = idxActual === RANGOS_MW.length - 1;
  const siguiente = esUltimo ? null : RANGOS_MW[idxActual + 1];
  const { personasActivas, produccionGrupalMes, equipoCalificadoPct, compraPersonalPeriodo1, compraPersonalPeriodo2 } = LIDER_EJEMPLO.stats;

  setText('cuentaRangoActual', RANGOS_MW[idxActual].label.toUpperCase());

  document.getElementById('cuentaRankNodes').innerHTML = RANGOS_MW.map(r => {
    const alcanzado = produccionGrupalMes >= r.produccion;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="4"/></svg>'}
        </div>
        <span class="node-label">${r.label}<br>${fmtMoney(r.produccion)}</span>
      </div>
    `;
  }).join('');

  const maxProduccion = RANGOS_MW[RANGOS_MW.length - 1].produccion;
  document.getElementById('cuentaRankFill').style.width = `${Math.min(100, (produccionGrupalMes / maxProduccion) * 100)}%`;

  const titulo = document.getElementById('cuentaProgresoTitulo');
  const sub = document.getElementById('cuentaProgresoSub');
  if (siguiente) {
    titulo.textContent = `Progreso hacia ${siguiente.label.toUpperCase()}`;
    const faltante = Math.max(0, siguiente.produccion - produccionGrupalMes);
    sub.textContent = faltante > 0
      ? `Te faltan ${fmtMoney(faltante)} de producción grupal para alcanzar ${siguiente.label}.`
      : `¡Ya cumples la producción grupal para ${siguiente.label}!`;

    const compraMinima = Math.min(compraPersonalPeriodo1, compraPersonalPeriodo2);
    const items = [
      { label: 'Personas activas', cumple: personasActivas >= siguiente.personas, valores: `${personasActivas} / ${siguiente.personas}` },
      { label: 'Compra personal (ambos periodos)', cumple: compraMinima >= siguiente.compra, valores: `${fmtMoney(compraPersonalPeriodo1)} y ${fmtMoney(compraPersonalPeriodo2)} / ${fmtMoney(siguiente.compra)}` },
      { label: 'Equipo calificado', cumple: equipoCalificadoPct >= siguiente.calificado, valores: `${equipoCalificadoPct}% / ${siguiente.calificado}%` },
    ];
    document.getElementById('cuentaChecklist').innerHTML = items.map(it => `
      <div class="check-item light ${it.cumple ? 'met' : 'unmet'}">
        <span class="check-icon">${it.cumple ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>' : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>'}</span>
        <span class="check-label">${it.label}</span>
        <span class="check-values">${it.valores}</span>
      </div>
    `).join('');
  } else {
    titulo.textContent = '¡Estás en el rango más alto!';
    sub.textContent = 'Sigue así para mantenerte en Corona el próximo mes.';
    document.getElementById('cuentaChecklist').innerHTML = '';
  }
}

// ---------- Ticket de comisiones ----------
function calcularProfundidadesEquipo() {
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

function renderTicketComisiones() {
  const depths = calcularProfundidadesEquipo();
  const produccionPorNivel = [0, 0, 0, 0, 0];
  EQUIPO_ARBOL_EJEMPLO.forEach((m) => {
    const d = depths[m.id];
    if (d >= 1 && d <= 5 && m.puntos) produccionPorNivel[d - 1] += m.puntos;
  });

  const pcts = COMISIONES_PCT[LIDER_EJEMPLO.rangoActualKey];
  const wrap = document.getElementById('ticketNiveles');
  let total = 0;

  wrap.innerHTML = produccionPorNivel.map((produccion, i) => {
    const pct = pcts[i];
    const comision = (produccion / 1.16) * (pct / 100);
    total += comision;
    return `
      <div class="ct-row">
        <div>
          <span class="ct-level">Nivel ${i + 1}</span>
          <span class="ct-detail">${fmtMoney(produccion)} en compras × ${pct}%</span>
        </div>
        <span class="ct-amount">${fmtMoney(comision)}</span>
      </div>
    `;
  }).join('');

  setText('ticketTotal', fmtMoney(total));
  setText('ticketRango', RANGOS_MW[idxRango(LIDER_EJEMPLO.rangoActualKey)].label);
}
// ---------- Próxima fecha de pago ----------
const MESES_PAGO = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function renderProximoPago() {
  const hoy = new Date();
  const dia = hoy.getDate();
  let mes = hoy.getMonth();
  let anio = hoy.getFullYear();
  let fechaPago;

  if (dia <= 20) {
    fechaPago = new Date(anio, mes, 20);
  } else {
    mes += 1;
    if (mes > 11) { mes = 0; anio += 1; }
    fechaPago = new Date(anio, mes, 5);
  }
  setText('proximoPago', `${fechaPago.getDate()} de ${MESES_PAGO[fechaPago.getMonth()]}`);
}
