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
  renderMisCompras();
});

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
      </div>`;
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
    <p class="cfg-card-sub" style="margin-top:14px;">Cuenta como compra lo que pagaste en efectivo, con terminal o por transferencia; es lo que se toma en cuenta para tu rango, comisiones, rifa y constancia. Pronto podrás ver aquí pieza por pieza.</p>
  `;
}
