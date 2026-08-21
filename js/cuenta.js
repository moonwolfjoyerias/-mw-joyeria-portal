// MW JOYERÍA — Mi cuenta
// Depende de CUENTA_EJEMPLO, RIFA_EJEMPLO, CONSTANCIA_EJEMPLO (cuenta-ejemplo.js).

document.addEventListener('DOMContentLoaded', () => {
  renderPerfil();
  renderRifa();
  renderConstancia();
});

function renderPerfil() {
  const iniciales = CUENTA_EJEMPLO.nombre.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  setText('perfilIniciales', iniciales);
  setText('perfilNombre', CUENTA_EJEMPLO.nombre);
  setText('perfilLider', `Equipo de ${CUENTA_EJEMPLO.lider}`);
  setText('perfilTelefono', CUENTA_EJEMPLO.telefono);
  setText('perfilCorreo', CUENTA_EJEMPLO.correo);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ---------- Rifa mensual ----------
function renderRifa() {
  const { montoAcumuladoMes, meta } = RIFA_EJEMPLO;
  const pctBase = Math.min(100, (montoAcumuladoMes / meta) * 100);

  document.getElementById('rifaFill').style.width = `${pctBase}%`;
  setText('rifaMontoActual', `$${montoAcumuladoMes.toLocaleString('es-MX')}`);
  setText('rifaMontoMeta', `$${meta.toLocaleString('es-MX')}`);

  const msg = document.getElementById('rifaMensaje');
  if (montoAcumuladoMes < meta) {
    const faltante = meta - montoAcumuladoMes;
    msg.textContent = `Te faltan $${faltante.toLocaleString('es-MX')} en compras este mes para ganar tu boleto de la rifa.`;
  } else {
    const extra = montoAcumuladoMes - meta;
    const boletosExtra = Math.floor(extra / 1000);
    const totalBoletos = 1 + boletosExtra;
    const faltanteSiguiente = 1000 - (extra % 1000);
    let texto = totalBoletos === 1
      ? '¡Ya tienes tu boleto para la rifa de este mes! 🎟️'
      : `¡Llevas ${totalBoletos} boletos para la rifa de este mes! 🎟️`;
    texto += ` Te faltan $${faltanteSiguiente.toLocaleString('es-MX')} para tu siguiente boleto extra.`;
    msg.textContent = texto;
  }
}

// ---------- Reto de Constancia ----------
function renderConstancia() {
  const { mesesCumplidos, montoMesActual, metaMes, hitos } = CONSTANCIA_EJEMPLO;

  // Progreso general a lo largo de la línea (0 -> primer hito -> ... -> último hito)
  const puntosLinea = [0, ...hitos.map(h => h.meses)];
  let segmentoActual = puntosLinea.length - 2;
  for (let i = 0; i < puntosLinea.length - 1; i++) {
    if (mesesCumplidos <= puntosLinea[i + 1]) { segmentoActual = i; break; }
  }
  const inicioSeg = puntosLinea[segmentoActual];
  const finSeg = puntosLinea[segmentoActual + 1];
  const fracSeg = finSeg > inicioSeg ? (mesesCumplidos - inicioSeg) / (finSeg - inicioSeg) : 1;
  const pctGeneral = Math.min(100, ((segmentoActual + fracSeg) / (puntosLinea.length - 1)) * 100);

  document.getElementById('constanciaFill').style.width = `${pctGeneral}%`;

  const nodesWrap = document.getElementById('constanciaNodes');
  nodesWrap.innerHTML = hitos.map(h => {
    const alcanzado = mesesCumplidos >= h.meses;
    return `
      <div class="timeline-node ${alcanzado ? 'reached' : ''}">
        <div class="node-circle">
          ${alcanzado
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'
            : `<span style="font-family:var(--font-heading); font-weight:700; font-size:0.85rem;">${h.meses}</span>`}
        </div>
        <span class="node-label">${h.meses}° mes<br>${h.premio}</span>
      </div>
    `;
  }).join('');

  setText('constanciaResumen', `Llevas ${mesesCumplidos} meses cumplidos de por vida.`);

  const siguienteHito = hitos.find(h => h.meses > mesesCumplidos);
  const nota = document.getElementById('constanciaNota');
  if (siguienteHito) {
    const faltan = siguienteHito.meses - mesesCumplidos;
    nota.textContent = `Te falta${faltan === 1 ? '' : 'n'} ${faltan} mes${faltan === 1 ? '' : 'es'} cumplido${faltan === 1 ? '' : 's'} para tu siguiente recompensa: ${siguienteHito.premio}.`;
  } else {
    nota.textContent = '¡Has alcanzado todas las recompensas! Pronto habrá una nueva categoría.';
  }

  const pctMes = Math.min(100, (montoMesActual / metaMes) * 100);
  document.getElementById('mesFill').style.width = `${pctMes}%`;
  setText('mesMontoActual', `$${montoMesActual.toLocaleString('es-MX')}`);
  setText('mesMontoMeta', `$${metaMes.toLocaleString('es-MX')}`);
}
