// MW JOYERÍA — Lectura del reporte de Aronium (Excel .xlsx) en el navegador
//
// Aronium exporta el reporte "Ventas por formas de pago y cliente"
// (SalesPaymentTypesCustomers, generado con FastReport) como .xlsx. Este
// archivo lo lee SIN librerías externas: un .xlsx es un .zip con XML
// adentro, así que basta con abrir el zip (DecompressionStream, nativo del
// navegador), leer los textos compartidos y la hoja, y armar las filas.
//
// Formato del reporte (visto en un archivo real):
//   - Una fila por cliente: "NOMBRE [MW25xxx] (000123)" | RFC | montos…
//     El número entre paréntesis es el número de cliente de Aronium; la
//     columna RFC trae el código de Aronium (MW25xxx) o "---".
//   - Viene PAGINADO: cada grupo de ~45 clientes se repite en 3 bloques de
//     columnas, cada uno con su propia fila de encabezado "Cliente | RFC |
//     <formas de pago>" (ej. Cambio físico/Crédito/Efectivo/Gala, luego
//     Regalo/Souvenir/Terminal, luego Transferencia/Total).
//   - No trae fechas ni piezas — solo el total por forma de pago del periodo
//     que se eligió en Aronium al exportar.

// ============================================================
// ZIP (.xlsx) — lector mínimo
// ============================================================

async function _inflarDeflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Este navegador no puede abrir archivos de Excel. Usa una versión reciente de Chrome, Edge, Safari o Firefox.');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Regresa un Map nombre → función async que entrega el texto del archivo.
function _leerEntradasZip(buffer) {
  const datos = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  // Fin del directorio central: firma 0x06054b50, buscando desde el final.
  let fin = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (datos.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es un Excel (.xlsx) válido.');
  const totalEntradas = datos.getUint16(fin + 10, true);
  let p = datos.getUint32(fin + 16, true);
  const entradas = new Map();
  const decodificador = new TextDecoder('utf-8');
  for (let n = 0; n < totalEntradas; n++) {
    if (datos.getUint32(p, true) !== 0x02014b50) break;
    const metodo = datos.getUint16(p + 10, true);
    const tamComprimido = datos.getUint32(p + 20, true);
    const largoNombre = datos.getUint16(p + 28, true);
    const largoExtra = datos.getUint16(p + 30, true);
    const largoComentario = datos.getUint16(p + 32, true);
    const offsetLocal = datos.getUint32(p + 42, true);
    const nombre = decodificador.decode(bytes.subarray(p + 46, p + 46 + largoNombre));
    entradas.set(nombre, async () => {
      const lnNombre = datos.getUint16(offsetLocal + 26, true);
      const lnExtra = datos.getUint16(offsetLocal + 28, true);
      const inicio = offsetLocal + 30 + lnNombre + lnExtra;
      const contenido = bytes.subarray(inicio, inicio + tamComprimido);
      const crudo = metodo === 0 ? contenido : await _inflarDeflateRaw(contenido);
      return decodificador.decode(crudo);
    });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

function _columnaANumero(letras) {
  let n = 0;
  for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
}

// Primera hoja del libro → arreglo de filas (cada fila, arreglo de celdas
// con texto o número; null donde no hay nada).
async function leerFilasXlsx(archivo) {
  const entradas = _leerEntradasZip(await archivo.arrayBuffer());
  const parser = new DOMParser();

  const compartidos = [];
  if (entradas.has('xl/sharedStrings.xml')) {
    const xml = parser.parseFromString(await entradas.get('xl/sharedStrings.xml')(), 'application/xml');
    for (const si of Array.from(xml.getElementsByTagName('si'))) {
      compartidos.push(Array.from(si.getElementsByTagName('t')).map(t => t.textContent).join(''));
    }
  }

  const nombreHoja = [...entradas.keys()].filter(n => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort()[0];
  if (!nombreHoja) throw new Error('El Excel no tiene ninguna hoja.');
  const hoja = parser.parseFromString(await entradas.get(nombreHoja)(), 'application/xml');

  const filas = [];
  for (const fila of Array.from(hoja.getElementsByTagName('row'))) {
    const indiceFila = Number(fila.getAttribute('r')) - 1;
    const celdas = [];
    for (const c of Array.from(fila.getElementsByTagName('c'))) {
      const ref = c.getAttribute('r') || '';
      const col = _columnaANumero((ref.match(/^[A-Z]+/) || ['A'])[0]);
      const tipo = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0];
      let valor = null;
      if (tipo === 's' && v) valor = compartidos[Number(v.textContent)] ?? '';
      else if (tipo === 'inlineStr') valor = Array.from(c.getElementsByTagName('t')).map(t => t.textContent).join('');
      else if (tipo === 'str' && v) valor = v.textContent;
      else if (v && v.textContent !== '') valor = Number(v.textContent);
      celdas[col] = valor;
    }
    filas[indiceFila] = Array.from({ length: celdas.length }, (_, i) => (celdas[i] === undefined ? null : celdas[i]));
  }
  return Array.from({ length: filas.length }, (_, i) => filas[i] || []);
}

// ============================================================
// Reporte "Ventas por formas de pago y cliente"
// ============================================================

// Nombre de forma de pago tal como viene en Aronium → clave interna.
const FORMAS_PAGO_ARONIUM = {
  'CAMBIO FISICO': 'cambioFisico',
  'CREDITO': 'credito',
  'EFECTIVO': 'efectivo',
  'GALA': 'gala',
  'REGALO': 'regalo',
  'SOUVENIR': 'souvenir',
  'TERMINAL': 'terminal',
  'TRANSFERENCIA': 'transferencia',
  'TOTAL': 'total'
};

// Decisión del equipo: solo esto cuenta como compra de la e/l (Mis compras,
// rango, comisiones, rifa y constancia). Lo demás (crédito, Gala, cambios
// físicos, regalos, souvenirs) se guarda como referencia pero no suma.
const FORMAS_PAGO_QUE_CUENTAN = ['efectivo', 'terminal', 'transferencia'];

const ETIQUETAS_FORMAS_PAGO = {
  efectivo: 'Efectivo', terminal: 'Terminal', transferencia: 'Transferencia',
  credito: 'Crédito', gala: 'Gala', cambioFisico: 'Cambio físico',
  regalo: 'Regalo', souvenir: 'Souvenir'
};

// Clientes de Aronium que nunca son una e/l.
const CLIENTES_INTERNOS_ARONIUM = /^(CLIENTE GENERAL|GARANTIA|MW JOYERIA)\b/i;

function normalizarNombreAronium(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function _redondear(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

// filas (de leerFilasXlsx) → { clientes: [...], formas: [...], totalReporte,
// advertencias: [...] }. Cada cliente: { aroniumId, codigoAronium, nombre,
// nombreNormalizado, interno, pagos: {efectivo, …}, cuenta, totalReporte }.
function interpretarReporteAronium(filas) {
  const porCliente = new Map();
  const formasVistas = new Set();
  const advertencias = [];
  let encabezado = null;
  let totalesFilas = {};

  filas.forEach((fila, i) => {
    const primera = typeof fila[0] === 'string' ? fila[0].trim() : fila[0];
    if (primera === 'Cliente') {
      encabezado = {};
      fila.forEach((celda, col) => {
        if (col < 2 || typeof celda !== 'string' || !celda.trim()) return;
        const clave = FORMAS_PAGO_ARONIUM[celda.trim().toUpperCase()];
        if (clave) { encabezado[col] = clave; formasVistas.add(clave); }
        else advertencias.push(`Forma de pago desconocida en la fila ${i + 1}: "${celda.trim()}" (no se tomó en cuenta).`);
      });
      return;
    }
    if (!encabezado || !primera) return;
    if (primera === 'Total') {
      Object.entries(encabezado).forEach(([col, clave]) => {
        if (typeof fila[col] === 'number') totalesFilas[clave] = (totalesFilas[clave] || 0) + fila[col];
      });
      return;
    }
    const texto = String(primera);
    const m = texto.match(/\((\d+)\)\s*$/);
    if (!m) return;
    const aroniumId = m[1];
    let cliente = porCliente.get(aroniumId);
    if (!cliente) {
      const rfc = typeof fila[1] === 'string' ? fila[1].trim() : '';
      const codigoAronium = /^MW\d+$/i.test(rfc) ? rfc.toUpperCase() : '';
      let nombre = texto.replace(/\(\d+\)\s*$/, '');
      if (codigoAronium) nombre = nombre.split(/\s+/).filter(p => p.toUpperCase() !== codigoAronium).join(' ');
      nombre = nombre.replace(/\s+/g, ' ').trim();
      cliente = {
        aroniumId,
        codigoAronium,
        nombre,
        nombreNormalizado: normalizarNombreAronium(nombre),
        interno: CLIENTES_INTERNOS_ARONIUM.test(nombre),
        pagos: {}
      };
      porCliente.set(aroniumId, cliente);
    }
    Object.entries(encabezado).forEach(([col, clave]) => {
      const valor = fila[col];
      if (typeof valor === 'number') cliente.pagos[clave] = _redondear((cliente.pagos[clave] || 0) + valor);
    });
  });

  const clientes = [...porCliente.values()].map(c => {
    const totalReporte = _redondear(c.pagos.total || 0);
    delete c.pagos.total;
    const sumaFormas = _redondear(Object.values(c.pagos).reduce((s, v) => s + v, 0));
    if (formasVistas.has('total') && Math.abs(sumaFormas - totalReporte) > 0.05) {
      advertencias.push(`${c.nombre}: la suma de formas de pago ($${sumaFormas}) no coincide con su total en el reporte ($${totalReporte}).`);
    }
    const cuenta = _redondear(FORMAS_PAGO_QUE_CUENTAN.reduce((s, f) => s + (c.pagos[f] || 0), 0));
    return { ...c, totalReporte: formasVistas.has('total') ? totalReporte : sumaFormas, cuenta };
  });

  if (!clientes.length) {
    throw new Error('No se encontró ningún cliente en el archivo. ¿Es el reporte "Ventas por formas de pago y cliente" de Aronium?');
  }

  const totalReporte = _redondear(totalesFilas.total || clientes.reduce((s, c) => s + c.totalReporte, 0));
  return {
    clientes,
    formas: [...formasVistas].filter(f => f !== 'total'),
    totalReporte,
    advertencias
  };
}

async function leerReporteAronium(archivo) {
  return interpretarReporteAronium(await leerFilasXlsx(archivo));
}
