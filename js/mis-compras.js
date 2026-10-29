// MW JOYERÍA — Mis compras (Emprendedora / Líder)
//
// Muestra las compras de la persona con sesión abierta tal como las
// registra la tienda en Aronium, por quincena (Admin las carga en Admin →
// Compras Aronium; ver js/compras-aronium-firestore-sync.js). Solo lee
// el documento de la propia persona (comprasAroniumPersona/{su id}).
//
// Por ahora Aronium entrega totales por forma de pago, no pieza por pieza;
// cuando se pueda exportar el detalle de cada ticket, esta misma página
// mostrará las piezas.

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof comprasAroniumListo !== 'undefined') await comprasAroniumListo;
  if (typeof comprasBrilloListo !== 'undefined') await comprasBrilloListo;
  renderMisCompras();
  window.addEventListener('mw:compras-brillo-actualizadas', renderMisCompras);
});

// Compras confirmadas o cobradas en la tienda con BRILLO MW (revisión de
// oct-2026): apartados liquidados ya confirmados y compras en caja. Las
// quincenas con archivo de Aronium se toman de Aronium (arriba).
function htmlComprasBrilloMisCompras() {
  const sesion = typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
  const personaId = sesion && sesion.personaId;
  if (!personaId || typeof registrosComprasBrilloPersona !== 'function') return '';
  const registros = registrosComprasBrilloPersona(personaId);
  const filas = registros.map(r => {
    const fecha = r.fechaCuenta || r.en;
    const fechaTexto = fecha ? new Date(fecha).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    if (r.tipo === 'venta') {
      const monto = Number(r.normal || 0) + Number(r.souvenir || 0);
      return `<div class="compra-quincena-desglose"><span>${fechaTexto} · Compra en tienda (ticket ${escapeHTML(String(r.folio || ''))})</span><strong>${fmtMoneyMisCompras(monto)}</strong></div>`;
    }
    const estado = r.estado === 'confirmada' ? '' : ' <span class="no-cuenta">(no se confirmó, no cuenta)</span>';
    return `<div class="compra-quincena-desglose"><span>${fechaTexto} · Apartado: ${escapeHTML(String(r.producto || 'Pieza'))}${estado}</span><strong>${fmtMoneyMisCompras(r.monto)}</strong></div>`;
  });
  return `
    <div class="compra-quincena" style="margin-top:14px;">
      <div class="compra-quincena-cabeza"><h3>Confirmadas en la tienda</h3></div>
      ${filas.join('') || '<div class="compra-quincena-desglose"><span>Todavía no hay compras confirmadas en la tienda.</span></div>'}
      <div class="compra-quincena-desglose"><span>Tus apartados liquidados aparecen aquí cuando la tienda los confirma; desde ese momento cuentan para tu rango, comisiones, rifa y constancia.</span></div>
    </div>`;
}

function fmtMoneyMisCompras(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function etiquetaQuincenaMisCompras(clave) {
  const [anio, mes, sub] = clave.split('-');
  const nombreMes = new Date(Number(anio), Number(mes) - 1, 1).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  return `${sub === 'p1' ? '1ª' : '2ª'} quincena de ${nombreMes}`;
}

function fechaCortaMisCompras(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}

function renderMisCompras() {
  const wrap = document.getElementById('misComprasContenido');
  if (!wrap) return;

  const mias = (typeof COMPRAS_ARONIUM_MIAS !== 'undefined' && COMPRAS_ARONIUM_MIAS) || {};
  // Todas las quincenas ya cargadas por la tienda: las que no traen compras
  // suyas también se muestran (en $0), para que se vea que sí se revisaron.
  const claves = [...new Set([...(typeof quincenasAroniumImportadas === 'function' ? quincenasAroniumImportadas() : []), ...Object.keys(mias)])]
    .sort().reverse();

  if (!claves.length) {
    wrap.innerHTML = `
      <div class="cfg-card">
        <h3 class="cfg-card-title">Todavía no hay compras registradas</h3>
        <p class="cfg-card-sub" style="margin:0;">La tienda carga tus compras cada quincena. En cuanto se carguen, aparecerán aquí.</p>
      </div>${htmlComprasBrilloMisCompras()}`;
    return;
  }

  const anioActual = String(new Date().getFullYear());
  const totalAnio = claves.filter(c => c.startsWith(anioActual)).reduce((s, c) => s + Number((mias[c] && mias[c].cuenta) || 0), 0);

  wrap.innerHTML = `
    <div class="compras-total-anio">
      <span>Tus compras en ${anioActual}</span>
      <strong>${fmtMoneyMisCompras(totalAnio)}</strong>
    </div>
    <div class="compras-quincenas">
      ${claves.map(clave => {
        const q = mias[clave];
        const rango = q ? `${fechaCortaMisCompras(q.desde)} al ${fechaCortaMisCompras(q.hasta)}` : '';
        if (!q) {
          return `
            <div class="compra-quincena">
              <div class="compra-quincena-cabeza">
                <h3>${etiquetaQuincenaMisCompras(clave)}</h3>
                <span class="compra-quincena-monto">${fmtMoneyMisCompras(0)}</span>
              </div>
              <div class="compra-quincena-desglose"><span>Sin compras registradas en esta quincena.</span></div>
            </div>`;
        }
        const pagos = q.pagos || {};
        const cuentan = FORMAS_PAGO_QUE_CUENTAN.filter(f => pagos[f]).map(f => `<span>${ETIQUETAS_FORMAS_PAGO[f]}: <strong>${fmtMoneyMisCompras(pagos[f])}</strong></span>`);
        const noCuentan = Object.keys(pagos).filter(f => !FORMAS_PAGO_QUE_CUENTAN.includes(f) && pagos[f]).map(f => `<span class="no-cuenta">${ETIQUETAS_FORMAS_PAGO[f] || f}: ${fmtMoneyMisCompras(pagos[f])}</span>`);
        return `
          <div class="compra-quincena">
            <div class="compra-quincena-cabeza">
              <h3>${etiquetaQuincenaMisCompras(clave)} <span class="aronium-meta">${rango}</span></h3>
              <span class="compra-quincena-monto">${fmtMoneyMisCompras(q.cuenta)}</span>
            </div>
            <div class="compra-quincena-desglose">${cuentan.join('') || '<span>Sin pagos en efectivo, terminal o transferencia.</span>'}</div>
            ${noCuentan.length ? `<div class="compra-quincena-desglose"><span class="no-cuenta">No cuentan como compra:</span>${noCuentan.join('')}</div>` : ''}
          </div>`;
      }).join('')}
    </div>
    ${htmlComprasBrilloMisCompras()}
    <p class="cfg-card-sub" style="margin-top:14px;">Cuenta como compra lo que pagaste en efectivo, con terminal o por transferencia; es lo que se toma en cuenta para tu rango, comisiones, rifa y constancia.</p>
  `;
}
