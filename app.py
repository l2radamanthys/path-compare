import difflib
import filecmp
import os
import shlex
import shutil
import subprocess
from pathlib import Path
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

DIFF_CMD_STR = (
    os.environ.get("PATCH_COMPARE_DIFF_CMD")
    or os.environ.get("DIFFUSE_CMD")
    or "diffuse"
)
MAX_DIFF_BYTES = 2 * 1024 * 1024  # 2 MB para vista previa inline


def _resolve_safe_path(base_dir_str: str, rel_file: str) -> tuple[Path, Path]:
    """Resuelve y valida que `rel_file` permanezca estrictamente dentro de `base_dir_str`."""
    if not base_dir_str or not rel_file:
        raise ValueError("Ruta base o archivo faltante.")
    base_dir = Path(base_dir_str).resolve()
    if not base_dir.is_dir():
        raise ValueError(f"El directorio base no existe: {base_dir}")
    target = (base_dir / rel_file).resolve()
    if not target.is_relative_to(base_dir) or target == base_dir:
        raise ValueError("Ruta de archivo fuera del directorio permitido.")
    return base_dir, target


def is_included(
    path: Path,
    relative_str: str,
    include_exts: list[str],
    exclude_exts: list[str],
    include_dirs: list[str],
    exclude_dirs: list[str],
) -> bool:
    """Evalúa si una ruta relativa cumple con los filtros configurados."""
    parts = Path(relative_str).parts

    # Excluir si alguna carpeta padre está en exclude_dirs
    if exclude_dirs:
        for part in parts[:-1]:
            if part in exclude_dirs:
                return False

    # Incluir solo si alguna carpeta padre está en include_dirs (archivos en raíz pasan)
    if include_dirs and len(parts) > 1:
        if not any(part in include_dirs for part in parts[:-1]):
            return False

    suffix = path.suffix.lower()

    if exclude_exts and suffix in exclude_exts:
        return False

    if include_exts and suffix not in include_exts:
        return False

    return True


def obtener_archivos(
    directorio: Path,
    include_exts: list[str],
    exclude_exts: list[str],
    include_dirs: list[str],
    exclude_dirs: list[str],
    warnings: list[str],
) -> set[str]:
    """Retorna rutas relativas de todos los archivos que pasen los filtros, podando carpetas excluidas."""
    archivos: set[str] = set()
    exclude_dirs_set = set(exclude_dirs)

    def _on_walk_error(err: OSError) -> None:
        warnings.append(f"No se pudo acceder a '{err.filename}': {err.strerror}")

    for ruta, dirnames, nombres in os.walk(directorio, onerror=_on_walk_error):
        # Poda temprana para evitar recorrer carpetas excluidas (node_modules, .git, .venv, etc.)
        if exclude_dirs_set:
            dirnames[:] = [d for d in dirnames if d not in exclude_dirs_set]

        for nombre in nombres:
            ruta_completa = Path(ruta) / nombre
            try:
                if not ruta_completa.is_file():
                    continue
            except OSError as exc:
                warnings.append(f"Omitido '{ruta_completa}': {exc}")
                continue

            relativa = ruta_completa.relative_to(directorio).as_posix()
            if is_included(
                ruta_completa,
                relativa,
                include_exts,
                exclude_exts,
                include_dirs,
                exclude_dirs,
            ):
                archivos.add(relativa)

    return archivos


def _is_binary_file(path: Path) -> bool:
    with path.open("rb") as fh:
        chunk = fh.read(8192)
    return b"\x00" in chunk


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html", form_data={})


@app.route("/compare", methods=["POST"])
def compare():
    dir_a_str = request.form.get("dir_a", "").strip()
    dir_b_str = request.form.get("dir_b", "").strip()
    raw_include_exts = request.form.get("include_exts", "")
    raw_exclude_exts = request.form.get("exclude_exts", "")
    raw_include_dirs = request.form.get("include_dirs", "")
    raw_exclude_dirs = request.form.get("exclude_dirs", "")

    form_data = {
        "dir_a": dir_a_str,
        "dir_b": dir_b_str,
        "include_exts": raw_include_exts,
        "exclude_exts": raw_exclude_exts,
        "include_dirs": raw_include_dirs,
        "exclude_dirs": raw_exclude_dirs,
    }

    if not dir_a_str or not dir_b_str:
        return render_template(
            "index.html",
            error="Ambos directorios son requeridos.",
            form_data=form_data,
        )

    dir_a = Path(dir_a_str).resolve()
    dir_b = Path(dir_b_str).resolve()

    if not dir_a.is_dir():
        return render_template(
            "index.html",
            error=f"ERROR: '{dir_a}' no es un directorio válido.",
            form_data=form_data,
        )
    if not dir_b.is_dir():
        return render_template(
            "index.html",
            error=f"ERROR: '{dir_b}' no es un directorio válido.",
            form_data=form_data,
        )

    def parse_filter(f_str: str) -> list[str]:
        if not f_str:
            return []
        return [item.strip() for item in f_str.split(",") if item.strip()]

    inc_exts = [
        (ext if ext.startswith(".") else f".{ext}").lower()
        for ext in parse_filter(raw_include_exts)
    ]
    exc_exts = [
        (ext if ext.startswith(".") else f".{ext}").lower()
        for ext in parse_filter(raw_exclude_exts)
    ]
    inc_dirs = parse_filter(raw_include_dirs)
    exc_dirs = parse_filter(raw_exclude_dirs)

    warnings: list[str] = []
    archivos_a = obtener_archivos(dir_a, inc_exts, exc_exts, inc_dirs, exc_dirs, warnings)
    archivos_b = obtener_archivos(dir_b, inc_exts, exc_exts, inc_dirs, exc_dirs, warnings)

    solo_en_a = sorted(archivos_a - archivos_b)
    solo_en_b = sorted(archivos_b - archivos_a)
    en_ambos = archivos_a & archivos_b

    diferentes: list[str] = []
    iguales: list[str] = []

    for archivo in sorted(en_ambos):
        ruta_a = dir_a / archivo
        ruta_b = dir_b / archivo
        try:
            if not filecmp.cmp(ruta_a, ruta_b, shallow=False):
                diferentes.append(archivo)
            else:
                iguales.append(archivo)
        except OSError as exc:
            warnings.append(f"No se pudo comparar '{archivo}': {exc}")

    return render_template(
        "results.html",
        dir_a=str(dir_a),
        dir_b=str(dir_b),
        diferentes=diferentes,
        iguales=iguales,
        solo_en_a=solo_en_a,
        solo_en_b=solo_en_b,
        include_exts=raw_include_exts,
        exclude_exts=raw_exclude_exts,
        include_dirs=raw_include_dirs,
        exclude_dirs=raw_exclude_dirs,
        warnings=warnings,
        diff_cmd=DIFF_CMD_STR,
    )


@app.route("/open_diffuse", methods=["POST"])
def open_diffuse():
    data = request.get_json(silent=True) or {}
    archivo = data.get("archivo")
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")

    try:
        _, ruta_a = _resolve_safe_path(dir_a_str, archivo)
        _, ruta_b = _resolve_safe_path(dir_b_str, archivo)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    cmd = shlex.split(DIFF_CMD_STR) + [str(ruta_a), str(ruta_b)]
    try:
        subprocess.run(cmd, check=True)
        are_equal = False
        try:
            if ruta_a.is_file() and ruta_b.is_file():
                are_equal = filecmp.cmp(ruta_a, ruta_b, shallow=False)
        except OSError:
            are_equal = False
        return jsonify({"success": True, "are_equal": are_equal})
    except FileNotFoundError:
        return (
            jsonify(
                {
                    "success": False,
                    "error": f"No se encontró el ejecutable '{cmd[0]}' en el sistema.",
                }
            ),
            500,
        )
    except subprocess.CalledProcessError as exc:
        return (
            jsonify({"success": False, "error": f"Error al ejecutar {cmd[0]}: {exc}"}),
            500,
        )
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/copy", methods=["POST"])
def copy_files():
    """Copia uno o varios archivos de Dir A -> Dir B o de Dir B -> Dir A."""
    data = request.get_json(silent=True) or {}
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")
    direction = data.get("direction")
    overwrite = bool(data.get("overwrite", False))

    if direction not in ("a_to_b", "b_to_a"):
        return jsonify({"success": False, "error": "Dirección inválida."}), 400

    archivos = data.get("archivos")
    if archivos is None:
        single = data.get("archivo")
        archivos = [single] if single else []

    if not isinstance(archivos, list) or not archivos:
        return jsonify({"success": False, "error": "No se especificaron archivos."}), 400

    src_base_str = dir_a_str if direction == "a_to_b" else dir_b_str
    dst_base_str = dir_b_str if direction == "a_to_b" else dir_a_str

    copied: list[str] = []
    errors: list[dict] = []

    for archivo in archivos:
        try:
            _, src_path = _resolve_safe_path(src_base_str, archivo)
            _, dst_path = _resolve_safe_path(dst_base_str, archivo)
        except ValueError as exc:
            errors.append({"file": archivo, "error": str(exc)})
            continue

        if not src_path.is_file():
            errors.append({"file": archivo, "error": "El archivo origen no existe."})
            continue

        if dst_path.exists() and not overwrite:
            errors.append(
                {
                    "file": archivo,
                    "error": "El archivo ya existe en el destino.",
                    "exists": True,
                }
            )
            continue

        try:
            dst_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_path, dst_path)
            copied.append(archivo)
        except OSError as exc:
            errors.append({"file": archivo, "error": str(exc)})

    if not copied and errors:
        status_code = 409 if all(e.get("exists") for e in errors) else 400
        return (
            jsonify(
                {
                    "success": False,
                    "copied": copied,
                    "errors": errors,
                    "error": errors[0]["error"],
                }
            ),
            status_code,
        )

    return jsonify({"success": True, "copied": copied, "errors": errors})


@app.route("/api/delete", methods=["POST"])
def delete_file():
    """Elimina un archivo exclusivo de Dir A o Dir B."""
    data = request.get_json(silent=True) or {}
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")
    side = data.get("side")
    archivo = data.get("archivo")

    if side not in ("a", "b"):
        return jsonify({"success": False, "error": "Lado inválido (use 'a' o 'b')."}), 400

    base_str = dir_a_str if side == "a" else dir_b_str
    try:
        _, target_path = _resolve_safe_path(base_str, archivo)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    if not target_path.is_file():
        return jsonify({"success": False, "error": "El archivo no existe."}), 404

    try:
        target_path.unlink()
        return jsonify({"success": True, "deleted": archivo})
    except OSError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/preview", methods=["POST"])
def preview_file():
    """Devuelve el contenido de un archivo de Dir A o Dir B para previsualización con resaltado."""
    data = request.get_json(silent=True) or {}
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")
    side = data.get("side")
    archivo = data.get("archivo")

    if side not in ("a", "b"):
        return jsonify({"success": False, "error": "Lado inválido (use 'a' o 'b')."}), 400

    base_str = dir_a_str if side == "a" else dir_b_str
    try:
        _, target_path = _resolve_safe_path(base_str, archivo)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    if not target_path.is_file():
        return jsonify({"success": False, "error": "El archivo no existe."}), 404

    try:
        size = target_path.stat().st_size
        ext = target_path.suffix.lower().lstrip(".")
        if size > MAX_DIFF_BYTES:
            return jsonify(
                {
                    "success": True,
                    "file": archivo,
                    "side": side,
                    "size": size,
                    "lines": 0,
                    "extension": ext,
                    "too_large": True,
                    "is_binary": False,
                    "content": "",
                }
            )

        if _is_binary_file(target_path):
            return jsonify(
                {
                    "success": True,
                    "file": archivo,
                    "side": side,
                    "size": size,
                    "lines": 0,
                    "extension": ext,
                    "too_large": False,
                    "is_binary": True,
                    "content": "",
                }
            )

        content = target_path.read_text(encoding="utf-8", errors="replace")
        line_count = len(content.splitlines()) if content else 0
        return jsonify(
            {
                "success": True,
                "file": archivo,
                "side": side,
                "size": size,
                "lines": line_count,
                "extension": ext,
                "too_large": False,
                "is_binary": False,
                "content": content,
            }
        )
    except OSError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/diff", methods=["POST"])
def preview_diff():
    """Genera un diff unificado inline entre los dos archivos."""
    data = request.get_json(silent=True) or {}
    archivo = data.get("archivo")
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")

    try:
        _, ruta_a = _resolve_safe_path(dir_a_str, archivo)
        _, ruta_b = _resolve_safe_path(dir_b_str, archivo)
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    if not ruta_a.is_file() or not ruta_b.is_file():
        return jsonify({"success": False, "error": "Uno de los archivos ya no existe."}), 404

    try:
        size_a = ruta_a.stat().st_size
        size_b = ruta_b.stat().st_size
        if size_a > MAX_DIFF_BYTES or size_b > MAX_DIFF_BYTES:
            return jsonify(
                {
                    "success": True,
                    "too_large": True,
                    "is_binary": False,
                    "diff_lines": [],
                    "stats": {"added": 0, "removed": 0},
                }
            )

        if _is_binary_file(ruta_a) or _is_binary_file(ruta_b):
            return jsonify(
                {
                    "success": True,
                    "too_large": False,
                    "is_binary": True,
                    "diff_lines": [],
                    "stats": {"added": 0, "removed": 0},
                }
            )

        lines_a = ruta_a.read_text(encoding="utf-8", errors="replace").splitlines()
        lines_b = ruta_b.read_text(encoding="utf-8", errors="replace").splitlines()

        diff_lines = list(
            difflib.unified_diff(
                lines_a,
                lines_b,
                fromfile=f"A/{archivo}",
                tofile=f"B/{archivo}",
                lineterm="",
                n=3,
            )
        )

        added = sum(1 for ln in diff_lines if ln.startswith("+") and not ln.startswith("+++"))
        removed = sum(1 for ln in diff_lines if ln.startswith("-") and not ln.startswith("---"))

        return jsonify(
            {
                "success": True,
                "too_large": False,
                "is_binary": False,
                "diff_lines": diff_lines,
                "stats": {"added": added, "removed": removed},
            }
        )
    except OSError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/browse", methods=["GET"])
def browse():
    """Devuelve las carpetas del directorio solicitado para navegar."""
    req_path = request.args.get("path", ".")

    try:
        target_dir = Path(req_path).resolve()

        if not target_dir.is_dir():
            target_dir = Path(".").resolve()

        parent = target_dir.parent

        dirs = []
        for entry in target_dir.iterdir():
            try:
                if entry.is_dir():
                    dirs.append({"name": entry.name, "path": str(entry.resolve())})
            except OSError:
                continue

        dirs.sort(key=lambda x: x["name"].lower())

        return jsonify(
            {
                "current_path": str(target_dir),
                "parent_path": str(parent) if parent != target_dir else None,
                "directories": dirs,
            }
        )
    except PermissionError:
        return jsonify({"error": "Sin permisos para leer este directorio."}), 403
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
