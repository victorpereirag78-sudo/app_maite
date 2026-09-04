# Cómo publicar una actualización

La app instalada revisa **una vez por día** si hay una versión nueva. Para que
ese aviso aparezca hay que tocar **tres** archivos. Si falta alguno, el aviso no
sale o sale y no cambia nada.

## Los tres pasos

### 1. `version.json` — es lo que consulta la app instalada

```json
{
  "version": "2.3.0",
  "fecha": "2026-09-15",
  "notas": "Lo que cambió, en una línea. Se muestra en el cartel."
}
```

### 2. `js/app.js` — la versión que tiene el usuario en el teléfono

```js
const APP_VERSION = '2.3.0';
```

La app compara este número con el de `version.json`. Si el de `version.json` es
**mayor**, muestra el cartel. Por eso los dos tienen que quedar iguales al
publicar: si `version.json` queda más alto, el aviso saldría para siempre.

### 3. `service-worker.js` — para que el navegador baje los archivos nuevos

```js
const CACHE_NAME = 'alfajores-v2.3.0';
```

Si este nombre no cambia, el navegador sigue usando los archivos guardados y la
actualización nunca llega, aunque el cartel aparezca.

> **Si agregaste un archivo `.js` nuevo**, sumalo también a la lista `ASSETS` de
> `service-worker.js` y a los `<script>` de `index.html`.

## Numeración

`MAYOR.MENOR.PARCHE` — por ejemplo `2.3.1`:

- **PARCHE** (`2.3.0` → `2.3.1`): corregiste un error
- **MENOR** (`2.3.1` → `2.4.0`): agregaste algo nuevo
- **MAYOR** (`2.4.0` → `3.0.0`): cambio grande

Se comparan como números, así que `2.10.0` es posterior a `2.9.0`.

## Cómo lo ve la usuaria

1. Abre la app. Si pasaron más de 24 h desde la última revisión, consulta
   `version.json` (también revisa al volver a la app y cada 24 h si la deja abierta).
2. Si hay una versión nueva, aparece abajo un cartel:
   **"Hay una versión nueva v2.3.0"** con las notas del cambio.
3. **Actualizar** → aplica y recarga. **Después** → lo esconde hasta la próxima vez
   que abra la app.
4. También puede forzar la revisión desde el menú, en **Buscar actualización**.

La versión nueva **nunca** se activa sola: espera a que toque "Actualizar". Es a
propósito, para que la app no se recargue en medio de una venta a medio cargar.

## Para probar antes de publicar

Subí solo `version.json` con un número más alto y abrí la app: tiene que salir el
cartel. Después dejá los tres archivos en el mismo número y publicá.
