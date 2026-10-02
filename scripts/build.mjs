#!/usr/bin/env node
// MW JOYERÍA — Empaquetado y minificación (MEJ-03 de la auditoría)
//
// Antes cada página cargaba entre 10 y 30 etiquetas <script> locales sin
// comprimir. Este script NO reescribe los archivos fuente ni cambia
// nada de lo que hoy se sirve — genera una copia completa y lista para
// publicar en dist/, con cada tramo de <script src="js/...">
// CONSECUTIVO de una página fusionado en un solo archivo minificado.
//
// Por qué "tramo consecutivo" y no "todo junto": varias páginas
// intercalan un <script> inline o los SDK de Firebase por CDN entre sus
// propios archivos locales (el orden ahí SÍ importa — por ejemplo
// firebase-config.js debe cargar antes que firebase-init.js, y ambos
// antes de cualquier *-firestore-sync.js). Fusionar solo los tramos
// contiguos de scripts locales nunca cambia el orden de ejecución real
// de la página — simplemente reduce cada tramo a una sola petición ya
// minificada, sea de 2 o de 20 archivos.
//
// No decide CÓMO se despliega dist/ (no hay firebase.json/netlify.toml/
// GitHub Action en el repo todavía) — eso lo define quien lo publique.
// `npm run build` deja dist/ listo para servir tal cual, como una copia
// completa del sitio.

import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, cp, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'scripts']);
// js/ se copia completo (no solo lo que se fusiona en bundles): los
// tramos de un solo archivo (ver agruparTramos) se dejan tal cual, con
// su <script src="js/archivo.js"> original, así que ese archivo
// necesita seguir existiendo en dist/js/ para esa referencia.
const COPY_VERBATIM_DIRS = ['css', 'assets', 'js'];

const LOCAL_SCRIPT_RE = /^(\s*)<script src="(?!https?:\/\/)([^"]+\.js)(\?[^"]*)?"><\/script>\s*$/;

async function findHtmlFiles(dir, out = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await findHtmlFiles(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.html')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

// js/fotos-sitio-modelo.js calcula su propia ruta con
// document.currentScript.src (para construir la URL de respaldo del
// logo según la profundidad de la página) — funciona solo mientras SEA
// su propia etiqueta <script>. Si se fusiona con otros archivos en un
// bundle, document.currentScript.src pasa a ser la URL del bundle,
// nunca la de este archivo, y el cálculo de ruta queda roto. Se excluye
// del agrupado a propósito — se deja intacta como su propia etiqueta,
// igual que ya pasa con cualquier tramo de un solo archivo.
const NO_FUSIONABLES = ['fotos-sitio-modelo.js'];

// Agrupa las líneas de un HTML en "tramos" de <script src="*.js"> LOCAL
// consecutivos (nunca cruza un <script> externo, inline, el archivo de
// NO_FUSIONABLES, u otra línea que no sea una de estas etiquetas — ver
// el porqué en la cabecera).
function agruparTramos(lineas) {
  const tramos = [];
  let actual = null;
  lineas.forEach((linea, i) => {
    const m = LOCAL_SCRIPT_RE.exec(linea);
    const esNoFusionable = m && NO_FUSIONABLES.some(nombre => m[2].endsWith('/' + nombre) || m[2] === nombre);
    if (m && !esNoFusionable) {
      if (!actual) {
        actual = { inicio: i, fin: i, indent: m[1], archivos: [] };
        tramos.push(actual);
      }
      actual.fin = i;
      actual.archivos.push(m[2]);
    } else {
      actual = null;
    }
  });
  // Un tramo de 1 solo archivo no vale la pena fusionarlo (ya es una
  // sola petición) — se deja tal cual, no se toca esa línea.
  return tramos.filter(t => t.archivos.length > 1);
}

let totalOriginal = 0;
let totalBundled = 0;
let bundleCount = 0;

async function procesarHtml(htmlPath) {
  const rel = path.relative(ROOT, htmlPath);
  const htmlDir = path.dirname(htmlPath);
  const contenido = await readFile(htmlPath, 'utf-8');
  const lineas = contenido.split('\n');
  const tramos = agruparTramos(lineas);

  const distHtmlPath = path.join(DIST, rel);
  await mkdir(path.dirname(distHtmlPath), { recursive: true });

  if (!tramos.length) {
    await writeFile(distHtmlPath, contenido);
    return;
  }

  const bundlesDir = path.join(DIST, 'js', 'bundles');
  await mkdir(bundlesDir, { recursive: true });

  const lineasFinal = [...lineas];

  for (let t = tramos.length - 1; t >= 0; t--) {
    const tramo = tramos[t];
    const fuentes = [];
    let tamanoOriginal = 0;
    for (const archivoRelativo of tramo.archivos) {
      const archivoAbs = path.resolve(htmlDir, archivoRelativo);
      const codigo = await readFile(archivoAbs, 'utf-8');
      tamanoOriginal += Buffer.byteLength(codigo, 'utf-8');
      fuentes.push(`// ---- ${path.relative(ROOT, archivoAbs)} ----\n${codigo}`);
    }
    const concatenado = fuentes.join('\n;\n');

    const resultado = await esbuild.transform(concatenado, {
      minify: true,
      loader: 'js',
      target: 'es2018',
      legalComments: 'none'
    });

    bundleCount += 1;
    totalOriginal += tamanoOriginal;
    totalBundled += Buffer.byteLength(resultado.code, 'utf-8');

    const nombreBundle = `${rel.replace(/[\\/]/g, '-').replace(/\.html$/, '')}-${t}.js`;
    await writeFile(path.join(bundlesDir, nombreBundle), resultado.code);

    const profundidad = rel.split(path.sep).length - 1;
    const prefijoRelativo = profundidad > 0 ? '../'.repeat(profundidad) : '';
    const tagBundle = `${tramo.indent}<script src="${prefijoRelativo}js/bundles/${nombreBundle}"></script>`;

    lineasFinal.splice(tramo.inicio, tramo.fin - tramo.inicio + 1, tagBundle);
  }

  await writeFile(distHtmlPath, lineasFinal.join('\n'));
}

async function copiarVerbatim(nombre) {
  const origen = path.join(ROOT, nombre);
  if (!existsSync(origen)) return;
  const destino = path.join(DIST, nombre);
  await cp(origen, destino, { recursive: true });
}

async function main() {
  if (existsSync(DIST)) {
    await rm(DIST, { recursive: true, force: true });
  }
  await mkdir(DIST, { recursive: true });

  for (const dir of COPY_VERBATIM_DIRS) {
    await copiarVerbatim(dir);
  }

  const htmlFiles = await findHtmlFiles(ROOT);
  for (const htmlPath of htmlFiles) {
    await procesarHtml(htmlPath);
  }

  const ahorro = totalOriginal ? (100 * (1 - totalBundled / totalOriginal)).toFixed(1) : '0.0';
  console.log(`\n${htmlFiles.length} páginas procesadas, ${bundleCount} bundles generados.`);
  console.log(`JS original en tramos fusionados: ${(totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`JS minificado resultante:         ${(totalBundled / 1024).toFixed(1)} KB (-${ahorro}%)`);
  console.log(`\nListo en dist/ — sirve esa carpeta tal cual para probarlo.`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
