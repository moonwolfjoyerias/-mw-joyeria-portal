// MW JOYERÍA — Utilidades de DOM compartidas (MEJ-01 de la auditoría)
//
// escapeHTML/escapeAttribute/setText vivían copiadas de forma
// independiente en más de 30 archivos (varias con su propio sufijo,
// como escapeHTMLNomina o setTextDash, solo para no chocar con otra
// copia cargada en la misma página) — ya causó una desincronización
// real: un fix de cerrarModal en Catálogo que nunca se replicó en
// Apartados. Punto único de verdad: cualquier corrección futura a estas
// tres funciones se hace aquí UNA sola vez. Los archivos que ya tenían
// un nombre con sufijo lo conservan (para no tocar cada lugar donde se
// llamaba), pero ahora ese nombre es solo un delegado de una línea hacia
// las de aquí, nunca una copia completa de la lógica.
//
// Se carga ANTES que cualquier controlador que use alguna de las tres
// — ver el <script> de cada página.

function escapeHTML(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttribute(texto) {
  return escapeHTML(texto);
}

function setText(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}
