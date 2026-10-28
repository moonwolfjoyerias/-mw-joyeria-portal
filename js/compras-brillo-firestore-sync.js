// MW JOYERÍA — Compras confirmadas por BRILLO MW (caja de la tienda)
//
// Una compra hecha por la página (pieza de apartado LIQUIDADA) ya no cuenta
// sola: cuenta hasta que Encargado o Administración la confirma en BRILLO.
// Lo que se cobra directamente en BRILLO (liquidar un apartado en BRILLO o
// una venta de caja a una e/l) cuenta al momento.
//
// En Firestore (lo escribe BRILLO; la página solo lo lee):
//   comprasBrillo/pz__<ventanaId>__<piezaId>
//     { tipo: 'apartado', ventanaId, piezaId, personaId, estado: 'confirmada'|'rechazada',
//       fechaCuenta, fechaLiquidacion, origen: 'pagina'|'brillo', por, porRol, en, motivo }
//   comprasBrillo/vt__<folio>
//     { tipo: 'venta', personaId, normal, souvenir, fechaCuenta, folio, estado: 'confirmada', ... }
//
// fechaCuenta = la fecha en que esa compra suma (quincena/mes de comisión,
// constancia, rifa…). La decide BRILLO al confirmar: las compras liquidadas
// antes de que empezara la confirmación cuentan en su fecha original; las
// nuevas, el día que se confirman.
//
// Sin Firestore (modo demo con localStorage) no hay BRILLO que confirme:
// todo sigue contando como antes.

const COMPRAS_BRILLO_COLECCION = 'comprasBrillo';

// false solo en el modo demo sin Firestore (ver arriba).
let COMPRAS_BRILLO_ACTIVO = false;
// id del documento → datos
let COMPRAS_BRILLO_DOCS = new Map();
// personaId → [{ fechaCuenta, normal, souvenir }] (ventas de caja de BRILLO)
let COMPRAS_BRILLO_VENTAS = new Map();

function idConfirmacionPiezaBrillo(ventanaId, piezaId) {
  return `pz__${ventanaId}__${piezaId}`;
}

function _indexarComprasBrillo(docs) {
  COMPRAS_BRILLO_DOCS = new Map(docs.map(d => [d.id, d.datos]));
  COMPRAS_BRILLO_VENTAS = new Map();
  docs.forEach(({ datos }) => {
    if (datos.tipo !== 'venta' || datos.estado !== 'confirmada' || !datos.personaId || !datos.fechaCuenta) return;
    const lista = COMPRAS_BRILLO_VENTAS.get(datos.personaId) || [];
    lista.push({ fechaCuenta: String(datos.fechaCuenta), normal: Number(datos.normal) || 0, souvenir: Number(datos.souvenir) || 0 });
    COMPRAS_BRILLO_VENTAS.set(datos.personaId, lista);
  });
}

function _sesionComprasBrillo() {
  return typeof obtenerSesionActiva === 'function' ? obtenerSesionActiva() : null;
}

function _esperarSesionComprasBrillo() {
  return new Promise(resolve => {
    const inicio = Date.now();
    (function revisar() {
      const sesion = _sesionComprasBrillo();
      if (sesion || Date.now() - inicio > 15000) return resolve(sesion);
      setTimeout(revisar, 150);
    })();
  });
}

async function cargarComprasBrilloRepo() {
  if (!dbFirestore) return;
  COMPRAS_BRILLO_ACTIVO = true;
  // Una Emprendedora solo necesita las suyas; Admin/Staff/Encargado y Líder
  // (cálculos de equipo) leen todas.
  let consulta = dbFirestore.collection(COMPRAS_BRILLO_COLECCION);
  if (/\/portal\/emprendedora\//.test(window.location.pathname)) {
    const sesion = await _esperarSesionComprasBrillo();
    const personaId = sesion && sesion.tipo === 'persona' ? sesion.personaId : null;
    consulta = consulta.where('personaId', '==', String(personaId || '-'));
  }
  try {
    await new Promise((resolve, reject) => {
      let primera = true;
      consulta.onSnapshot(snap => {
        _indexarComprasBrillo(snap.docs.map(d => ({ id: d.id, datos: d.data() || {} })));
        if (primera) { primera = false; resolve(); return; }
        // En vivo: BRILLO confirmó, rechazó o cobró algo — se recalculan
        // las pantallas que muestran compras.
        window.dispatchEvent(new CustomEvent('mw:compras-brillo-actualizadas'));
      }, error => {
        if (primera) { primera = false; reject(error); }
      });
    });
  } catch (error) {
    // Sin estos datos ninguna compra de la página contaría; mejor avisar
    // que mostrar rangos y comisiones en cero.
    console.error('No se pudieron cargar las compras confirmadas por BRILLO:', error);
    if (typeof mostrarToast === 'function') {
      mostrarToast('No se pudieron cargar las compras confirmadas en BRILLO. Revisa tu conexión y vuelve a cargar la página.');
    }
    COMPRAS_BRILLO_DOCS = new Map();
    COMPRAS_BRILLO_VENTAS = new Map();
  }
}

// Estado de una pieza liquidada frente a BRILLO:
//   { cuenta: true, fecha }  → cuenta en esa fecha
//   { cuenta: false, estado: 'pendiente'|'rechazada' }
function confirmacionCompraPiezaBrillo(ventanaId, pieza, fechaLiquidacion) {
  if (!COMPRAS_BRILLO_ACTIVO) return { cuenta: true, fecha: fechaLiquidacion };
  const datos = COMPRAS_BRILLO_DOCS.get(idConfirmacionPiezaBrillo(ventanaId, pieza.id));
  if (!datos) return { cuenta: false, estado: 'pendiente' };
  if (datos.estado !== 'confirmada' || !datos.fechaCuenta) return { cuenta: false, estado: 'rechazada' };
  return { cuenta: true, fecha: String(datos.fechaCuenta) };
}

// Ventas de caja de BRILLO de una persona (ya cuentan, no se confirman).
function comprasCajaBrilloPersona(personaId) {
  return COMPRAS_BRILLO_VENTAS.get(personaId) || [];
}

const comprasBrilloListo = cargarComprasBrilloRepo();
