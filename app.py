import os
import filecmp
import subprocess
from pathlib import Path
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

DIFFUSE_CMD = "diffuse"

def is_included(path: Path, relative_str: str, include_exts: list, exclude_exts: list, include_dirs: list, exclude_dirs: list) -> bool:
    """Evaluate if a given path should be included based on filters.
    All filters should be applied on the relative path."""
    
    parts = Path(relative_str).parts
    
    # Check exclude_dirs (if any part of the path is in the excluded dirs)
    if exclude_dirs:
        for part in parts[:-1]: # exclude the file name itself for dir checks
            if part in exclude_dirs:
                return False
    
    # Check include_dirs
    if include_dirs:
        in_included_dir = False
        if len(parts) > 1:
            for part in parts[:-1]:
                if part in include_dirs:
                    in_included_dir = True
                    break
        else:
            in_included_dir = True # Files in the root are included unless a specific root logic is requested
        if len(parts) > 1 and not in_included_dir:
            return False
            
    suffix = path.suffix.lower()
    
    # Check exclude extensions
    if exclude_exts and suffix in exclude_exts:
        return False
        
    # Check include extensions
    if include_exts and suffix not in include_exts:
        return False
    
    return True

def obtener_archivos(directorio: Path, include_exts: list, exclude_exts: list, include_dirs: list, exclude_dirs: list) -> set[str]:
    """Retorna rutas relativas de todos los archivos en el directorio que pasen los filtros."""
    archivos = set()
    for ruta, _, nombres in os.walk(directorio):
        for nombre in nombres:
            ruta_completa = Path(ruta) / nombre
            relativa = ruta_completa.relative_to(directorio)
            if is_included(ruta_completa, str(relativa), include_exts, exclude_exts, include_dirs, exclude_dirs):
                archivos.add(str(relativa))
    return archivos

@app.route("/", methods=["GET"])
def index():
    return render_template("index.html")

@app.route("/compare", methods=["POST"])
def compare():
    dir_a_str = request.form.get("dir_a", "").strip()
    dir_b_str = request.form.get("dir_b", "").strip()
    
    if not dir_a_str or not dir_b_str:
        return render_template("index.html", error="Ambos directorios son requeridos.")
        
    dir_a = Path(dir_a_str).resolve()
    dir_b = Path(dir_b_str).resolve()

    if not dir_a.is_dir():
        return render_template("index.html", error=f"ERROR: '{dir_a}' no es un directorio válido.")
    if not dir_b.is_dir():
        return render_template("index.html", error=f"ERROR: '{dir_b}' no es un directorio válido.")

    # Parse filters
    def parse_filter(f_str):
        if not f_str: return []
        return [item.strip() for item in f_str.split(",") if item.strip()]

    raw_include_exts = request.form.get("include_exts", "")
    raw_exclude_exts = request.form.get("exclude_exts", "")
    raw_include_dirs = request.form.get("include_dirs", "")
    raw_exclude_dirs = request.form.get("exclude_dirs", "")

    # Extensions filtering
    inc_exts_raw = parse_filter(raw_include_exts)
    exc_exts_raw = parse_filter(raw_exclude_exts)
    inc_exts = [ext if ext.startswith(".") else f".{ext}" for ext in inc_exts_raw]
    exc_exts = [ext if ext.startswith(".") else f".{ext}" for ext in exc_exts_raw]
    
    # Directors filtering
    inc_dirs = parse_filter(raw_include_dirs)
    exc_dirs = parse_filter(raw_exclude_dirs)

    archivos_a = obtener_archivos(dir_a, inc_exts, exc_exts, inc_dirs, exc_dirs)
    archivos_b = obtener_archivos(dir_b, inc_exts, exc_exts, inc_dirs, exc_dirs)

    solo_en_a = list(archivos_a - archivos_b)
    solo_en_b = list(archivos_b - archivos_a)
    en_ambos = archivos_a & archivos_b

    diferentes = []
    iguales = []

    for archivo in sorted(en_ambos):
        ruta_a = dir_a / archivo
        ruta_b = dir_b / archivo
        if not filecmp.cmp(ruta_a, ruta_b, shallow=False):
            diferentes.append(archivo)
        else:
            iguales.append(archivo)

    return render_template("results.html",
                           dir_a=str(dir_a),
                           dir_b=str(dir_b),
                           diferentes=sorted(diferentes),
                           iguales=sorted(iguales),
                           solo_en_a=sorted(solo_en_a),
                           solo_en_b=sorted(solo_en_b),
                           include_exts=raw_include_exts,
                           exclude_exts=raw_exclude_exts,
                           include_dirs=raw_include_dirs,
                           exclude_dirs=raw_exclude_dirs)

@app.route("/open_diffuse", methods=["POST"])
def open_diffuse():
    data = request.json
    archivo = data.get("archivo")
    dir_a_str = data.get("dir_a")
    dir_b_str = data.get("dir_b")
    
    if not archivo or not dir_a_str or not dir_b_str:
        return jsonify({"success": False, "error": "Faltan parámetros"}), 400
        
    ruta_a = Path(dir_a_str) / archivo
    ruta_b = Path(dir_b_str) / archivo
    
    try:
        subprocess.run([DIFFUSE_CMD, str(ruta_a), str(ruta_b)], check=True)
        return jsonify({"success": True})
    except FileNotFoundError:
        return jsonify({"success": False, "error": f"No se encontró el ejecutable '{DIFFUSE_CMD}' en el sistema."}), 500
    except subprocess.CalledProcessError as e:
        return jsonify({"success": False, "error": f"Error al ejecutar Diffuse: {e}"}), 500
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/browse", methods=["GET"])
def browse():
    """Devuelve las carpetas del directorio solicitado para navegar."""
    req_path = request.args.get("path", ".")
    
    try:
        target_dir = Path(req_path).resolve()
        
        if not target_dir.is_dir():
            target_dir = Path(".").resolve() # Fallback to current run dir
            
        parent = target_dir.parent
        
        dirs = []
        for d in target_dir.iterdir():
            if d.is_dir():
                dirs.append({"name": d.name, "path": str(d.resolve())})
        
        # Sort alphabetically
        dirs.sort(key=lambda x: x["name"].lower())
        
        return jsonify({
            "current_path": str(target_dir),
            "parent_path": str(parent) if parent != target_dir else None,
            "directories": dirs
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, port=5000)
