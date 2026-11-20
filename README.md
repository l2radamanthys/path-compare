# Patch Compare

Aplicación web local en Flask para comparar archivos entre dos directorios, visualizar diferencias inline o en una herramienta externa (como `diffuse`), y sincronizar archivos entre ambos proyectos.

## Funcionalidades

- **Interfaz a ancho completo** con grilla responsiva de 3 columnas (*Diferentes*, *Solo en Dir A*, *Solo en Dir B*) y panel colapsable de *Archivos Iguales*.
- **Buscador global y por categoría** con filtrado instantáneo y contadores dinámicos.
- **Copia y sincronización de archivos**:
  - Copiar archivos exclusivos de **Dir A → Dir B** o **Dir B → Dir A** (individual o en lote para los visibles).
  - Sobrescribir archivos en *Diferentes* (`A→B` / `B→A`) o eliminar archivos exclusivos con confirmación.
- **Vista previa de diff inline** (`difflib`) y apertura en herramienta externa (configurable mediante `PATCH_COMPARE_DIFF_CMD` o `DIFFUSE_CMD`, por defecto `diffuse`), con re-verificación automática al cerrar.
- **Vista en árbol de carpetas** intercambiable con lista plana.
- **Historial reciente, intercambio A ↔ B y presets rápidos de filtros** (`.git`, Python, Node/JS, IDE/Logs).

## Ejecución

```bash
make install
make run
```

Para usar otra herramienta de diff externa (por ejemplo `meld` o `code --diff`):

```bash
PATCH_COMPARE_DIFF_CMD="meld" make run
```
