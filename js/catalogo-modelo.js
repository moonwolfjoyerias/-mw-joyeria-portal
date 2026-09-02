// MW JOYERÍA — Modelo de precios del catálogo
//
// El "precio etiqueta" es el precio que aparece en todos los
// catálogos (Staff, RH, Admin, líderes y emprendedoras). Sobre ese
// precio se aplica un % de descuento para calcular el "precio
// emprendedora". El descuento sugerido depende del material, pero
// siempre queda editable pieza por pieza.

const DESCUENTOS_POR_MATERIAL = {
  'oro-laminado': 60,
  'acero-inoxidable': 40,
  'exhibidores': 30,
  'souvenirs': 0,
  'fantasia': 0,
  'otros': 0
};

function descuentoSugerido(material) {
  return DESCUENTOS_POR_MATERIAL[material] ?? 0;
}

function calcularPrecioEmprendedora(precioEtiqueta, descuento) {
  const precio = Number(precioEtiqueta) || 0;
  const pct = Number(descuento) || 0;
  return Math.round(precio * (1 - pct / 100));
}
