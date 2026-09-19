// MW JOYERÍA — Inicio de Emprendedora: resumen de apartados y lista de deseos
//
// Depende de apartados-modelo.js (piezas apartadas / próximo vencimiento,
// misma fuente que usa la página "Mis apartados") y de deseos-ejemplo.js
// (conteo de lista de deseos, misma fuente que usa esa página).

document.addEventListener('DOMContentLoaded', () => {
  renderResumenApartados();
  renderResumenListaDeseos();
});

function renderResumenApartados() {
  const statPiezas = document.getElementById('statPiezasApartadas');
  const statVencimiento = document.getElementById('statProximoVencimiento');
  if (!statPiezas && !statVencimiento) return;
  if (typeof obtenerVentanasApartado !== 'function') return;

  const idActual = (typeof obtenerIdPersonaActualPortal === 'function' && obtenerIdPersonaActualPortal()) || '';
  const ventanasPropias = idActual
    ? obtenerVentanasApartado().filter(v => v.usuarioId === idActual && v.estado !== 'cerrada')
    : [];

  if (statPiezas) {
    const piezas = ventanasPropias.flatMap(v => obtenerPiezasActivas(v));
    statPiezas.textContent = piezas.length;
  }

  if (statVencimiento) {
    const activas = ventanasPropias.filter(v => v.estado === 'activa' && v.fechaVencimiento);
    const proxima = activas.sort((a, b) => new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento))[0] || null;

    if (!proxima) {
      statVencimiento.textContent = 'No hay apartados';
    } else if (ventanaEstaVencida(proxima)) {
      statVencimiento.textContent = 'Vencido';
    } else {
      statVencimiento.textContent = new Date(proxima.fechaVencimiento).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
}

function renderResumenListaDeseos() {
  const statDeseos = document.getElementById('statListaDeseos');
  if (statDeseos && typeof SOLICITUDES_EJEMPLO !== 'undefined') {
    statDeseos.textContent = SOLICITUDES_EJEMPLO.length;
  }
}
