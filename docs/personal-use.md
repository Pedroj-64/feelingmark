# Personal use and importing your photos / Uso personal e importar tus fotos

## English

Run Feelingmark on your own computer, keep everything in a folder you choose, and move an existing library into it. **Nothing is uploaded to GitHub**: the repository only holds code; your photos and database live where you point `STORAGE_PATH` and `DATABASE_PATH`.

### 1. Start your private server
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark && pnpm install
mkdir -p ~/FeelingmarkData
export STORAGE_PATH=$HOME/FeelingmarkData/photos DATABASE_PATH=$HOME/FeelingmarkData/feelingmark.sqlite AUTH_TOKEN=$(openssl rand -hex 24)
cd apps/server && pnpm dev     # prints a QR to pair your phone (or open http://localhost:8787/pair); keep the token somewhere safe
```
Use absolute paths outside the repository. Back up that one folder (photos + `.sqlite`) and you have backed up everything.

### 2. Bring photos and videos from the phone (USB)
Enable *Developer options → USB debugging*, connect the cable and accept the prompt on the phone.
```bash
adb devices                                   # the phone should be listed as "device"
adb shell ls /sdcard/DCIM /sdcard/Pictures    # find the folder where the files landed
adb pull /sdcard/Pictures/Dots ~/FeelingmarkImport   # example: copy only that folder
```
`adb pull` copies only the folder you name.

### 3. Import: simulate first, then apply
```bash
cd apps/server
node src/import.ts ~/FeelingmarkImport            # SIMULATION: saves nothing, prints a report
node src/import.ts ~/FeelingmarkImport --apply    # imports (safe to repeat: duplicates are skipped)
```
The report tells you where each date came from: photo/video metadata, a date in the file name (`IMG_20240315_101500.jpg`), or only the file date. **If most files only have the file date, they will pile up on the download day**; the report warns you. Stored times are the camera's wall-clock time, so the calendar day is the one you lived.

Notes: HEIC photos and some video formats keep their original file; thumbnails of HEIC are not generated on the server. Videos play in the app with seeking; the monthly recap video uses photos only.

## Español

Ejecuta Feelingmark en tu propio computador, guarda todo en una carpeta que elijas y pasa a ella una biblioteca existente. **No se sube nada a GitHub**: el repositorio solo tiene código; tus fotos y la base de datos viven donde indiques con `STORAGE_PATH` y `DATABASE_PATH`.

### 1. Arranca tu servidor privado
```bash
git clone https://github.com/Pedroj-64/feelingmark && cd feelingmark && pnpm install
mkdir -p ~/FeelingmarkData
export STORAGE_PATH=$HOME/FeelingmarkData/photos DATABASE_PATH=$HOME/FeelingmarkData/feelingmark.sqlite AUTH_TOKEN=$(openssl rand -hex 24)
cd apps/server && pnpm dev     # imprime un QR para emparejar el teléfono (o abre http://localhost:8787/pair); guarda el token
```
Usa rutas absolutas fuera del repositorio. Respalda esa carpeta (fotos + `.sqlite`) y lo habrás respaldado todo.

### 2. Trae fotos y videos del teléfono (USB)
Activa *Opciones de desarrollador → Depuración USB*, conecta el cable y acepta el aviso en el teléfono.
```bash
adb devices                                   # el teléfono debe aparecer como "device"
adb shell ls /sdcard/DCIM /sdcard/Pictures    # busca la carpeta donde quedaron los archivos
adb pull /sdcard/Pictures/Dots ~/FeelingmarkImport   # ejemplo: copia solo esa carpeta
```
`adb pull` copia únicamente la carpeta que nombres.

### 3. Importa: primero simula, luego aplica
```bash
cd apps/server
node src/import.ts ~/FeelingmarkImport            # SIMULACIÓN: no guarda nada, imprime un informe
node src/import.ts ~/FeelingmarkImport --apply    # importa (se puede repetir: los duplicados se omiten)
```
El informe dice de dónde salió cada fecha: metadatos de la foto o del video, una fecha en el nombre del archivo (`IMG_20240315_101500.jpg`) o solo la fecha del archivo. **Si casi todo solo tiene la fecha del archivo, se amontonará en el día de la descarga**; el informe te avisa. Las horas guardadas son las del reloj de la cámara, así que el día del calendario es el que viviste.

Notas: las fotos HEIC y algunos formatos de video conservan su archivo original; el servidor no genera miniaturas de HEIC. Los videos se reproducen en la app con avance libre; el video resumen del mes usa solo fotos.
