// MW JOYERÍA — Datos bancarios para depósitos y transferencias
//
// Los datos que ven las emprendedoras/líderes al pagar un apartado o un
// pedido. Administración los edita en BRILLO → Configuración → Datos de MW
// (configuracion/simple → datosMW.datosBancarios). Mientras no se guarden
// allí, se usan los de abajo (confirmados por MW Joyería).
//
// El nombre DATOS_BANCARIOS_EJEMPLO se conserva porque lo usan
// apartados.js, catalogo.js y mi-pedido-carrito.js; cada campo se lee al
// momento, así que siempre sale el valor vigente de Configuración.

const DATOS_BANCARIOS_POR_OMISION = {
  banco: 'Banorte',
  titular: 'Claudia Chávez Jurado',
  clabe: '072700013511749308'
};

function _datosBancariosConfigurados() {
  try {
    const cfg = typeof obtenerConfigSimple === 'function' ? obtenerConfigSimple() : null;
    const d = cfg && cfg.datosMW && cfg.datosMW.datosBancarios;
    return d && typeof d === 'object' ? d : {};
  } catch (error) {
    return {};
  }
}

function _campoBancario(campo) {
  const v = _datosBancariosConfigurados()[campo];
  return typeof v === 'string' && v.trim() ? v.trim() : DATOS_BANCARIOS_POR_OMISION[campo];
}

const DATOS_BANCARIOS_EJEMPLO = {
  get banco() { return _campoBancario('banco'); },
  get titular() { return _campoBancario('titular'); },
  get clabe() { return _campoBancario('clabe'); }
};
