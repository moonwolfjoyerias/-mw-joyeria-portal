# -mw-joyeria-portal

Portal web de MW Joyería — sitio estático de páginas múltiples (HTML/CSS/JS
servidos directo, sin framework ni backend propio). Ver SETUP-FIREBASE.md
para la configuración de Firebase y AUDITORIA-FIREBASE.md para el plan de
migración.

## Empaquetado y minificación (opcional)

El sitio funciona tal cual, sirviendo los archivos de este repositorio
directamente — `npm run build` es opcional, para cuando convenga reducir
el número de peticiones y el peso de los `<script>` de cada página
(MEJ-03 de la auditoría del 1 de octubre de 2026):

```
npm install
npm run build
```

Genera una copia completa y lista para publicar en `dist/`, con los
`<script src="js/...">` de cada página fusionados y minificados (nunca
reordenados ni mezclados con los SDK de Firebase por CDN). `dist/` no se
versiona — se regenera con el comando de arriba cuando haga falta
publicar esa versión optimizada en vez de los archivos sueltos.

## BRILLO MW (monorepo multiplataforma)

Ver [docs/BRILLO-MW-ARQUITECTURA.md](docs/BRILLO-MW-ARQUITECTURA.md) para
la estructura propuesta (web + escritorio con Tauri + tablet con
Capacitor) y `src/types/brillo.ts` para el modelo de datos compartido.
`npm run typecheck` valida esos tipos; no afecta al sitio que se sirve.
