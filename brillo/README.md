# BRILLO MW

Apps de caja (Tauri) y tablet (Capacitor) de MW Joyería. Proyecto
independiente de la página web: todo vive en esta carpeta y **no
modifica ningún archivo fuera de `brillo/`**. Comparte con la página el
mismo proyecto de Firebase, leyendo sus colecciones y escribiendo solo
en colecciones propias con prefijo `brillo`.

```
cd brillo
npm install
npm run typecheck
```

Arquitectura, reglas de convivencia y pendientes:
[docs/BRILLO-MW-ARQUITECTURA.md](docs/BRILLO-MW-ARQUITECTURA.md).
