# UI review / Revisión de la interfaz (2026-10-16)

Reviewed against [`DESIGN.md`](../DESIGN.md) with real screenshots (light and dark, 390 px) and the code. Each item was checked, not guessed. / Revisada contra `DESIGN.md` con capturas reales (claro y oscuro, 390 px) y el código; cada punto está comprobado.

Legend / Leyenda: **Impact / Impacto** high·mid·low · **Effort / Esfuerzo** S·M·L

## What already works / Lo que ya funciona
Palette and dark mode are coherent; calendar, day view, albums and settings share one language; touch targets ≥ 44 px; WCAG AA text contrast (tested); screen-reader labels (tested in the accessibility tree). / Paleta y modo oscuro coherentes; las cuatro pantallas comparten lenguaje; objetivos táctiles ≥ 44 px; contraste de texto AA (con test); etiquetas para lector de pantalla.

## Backlog

| # | Finding / Hallazgo | Evidence / Evidencia | Impact | Effort |
|---|---|---|---|---|
| 1 | **Portrait photos are cropped** in the day view (fixed 4:3, `cover`). Store `width`/`height` on upload and render the real aspect ratio. / **Las fotos verticales se recortan** en la vista de día. Guardar ancho y alto al subir y mostrar la proporción real. | `day.tsx`: `height: w * 0.75` + `contentFit="cover"` | high | M |
| 2 | **Typography is the system font.** `DESIGN.md` specifies Fraunces (titles) + Geist; neither is loaded, so the app looks generic and differs per device. / **La tipografía es la del sistema**; el diseño pide Fraunces + Geist y no se cargan. | no `expo-font`, no `fontFamily` anywhere | high | S |
| 3 | **Calendar grid touches the screen edges** (no 16 px gutter): column 1 numbers sit at x≈2. / La rejilla del calendario toca los bordes (sin margen de 16 px). | `const cell = Math.min(width, 720) / 7` with no padding | high | S |
| 4 | **Raw-text date field to move a photo** (`AAAA-MM-DD`, one per photo) is clumsy and noisy. Use the native date picker behind a "Move" action. / **Mover una foto con un campo de texto crudo** es torpe; usar el selector de fecha nativo. | day view screenshot | high | M |
| 5 | **Input borders fail non-text contrast** (WCAG 1.4.11 needs 3:1): 1.22:1 light, 1.40:1 dark. Day cells with only a note are almost invisible in dark (1.11:1). / **Los bordes de los campos no cumplen el contraste** de componentes (1,22:1 claro; 1,40:1 oscuro). | computed from `colors.ts` | mid | S |
| 6 | **Settings can't tell you if the connection works.** Add a "Test connection" button with clear success/error, a Disconnect action and the app version. / **Ajustes no dice si la conexión funciona**: añadir "Probar conexión", "Desconectar" y la versión. | settings screenshot | high | S |
| 7 | **No loading or empty-state design.** The grid flashes empty while fetching; the empty state is one line of text (DESIGN.md asks for skeletons and a composed empty state). / **Sin estados de carga ni vacío diseñados.** | no skeleton code | mid | M |
| 8 | **The logo never appears in the app.** Use it in the empty state, Settings ("About") and a splash moment. / **El logo no aparece en la app.** | no asset usage | mid | S |
| 9 | **No motion** (DESIGN.md: spring sheets, staggered reveals, reduced-motion fallback). Month change and day opening are abrupt. / **Sin movimiento** (resortes, escalonado, `reduced motion`). | no animation code | mid | M |
| 10 | **Web is a single 720 px column**; DESIGN.md describes calendar + day detail side by side on wide screens. / **La web es una sola columna**; el diseño describe dos paneles en pantallas anchas. | no breakpoint logic | mid | L |
| 11 | **Photos stacked at equal size** in the day view; DESIGN.md asks for an asymmetric masonry. Do it together with #1. / **Fotos apiladas iguales**; el diseño pide mosaico asimétrico (junto con el 1). | day view screenshot | low | M |
| 12 | **Tab bar has text only** (icons were hidden to avoid default placeholders). Add 3 custom line icons in the brand style. / **La barra de pestañas solo tiene texto**; añadir 3 iconos propios. | tabs layout | low | S |
| 13 | **Albums list isn't available offline** and has no year grouping once there are many months. / **La lista de álbumes no funciona sin conexión** ni agrupa por año. | albums screen | low | M |
| 14 | **Month video can't be previewed in the app**: the button opens the browser. An in-app player (`expo-video`) would feel native. / **El video del mes se abre en el navegador**; un reproductor integrado sería más nativo. | share/video flow | low | M |

## Suggested order / Orden sugerido
1. Quick wins (S): #3 gutter, #2 fonts, #5 borders, #6 connection test, #8 logo, #12 icons.
2. Photo quality (M): #1 aspect ratio + #11 masonry, #4 date picker.
3. Polish (M/L): #7 states, #9 motion, #10 wide layout, #13, #14.

Each item should land with a screenshot in the PR. / Cada punto debe llegar con una captura en el PR.
