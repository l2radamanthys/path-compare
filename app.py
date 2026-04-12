#!/usr/bin/env python3
"""
Comparador de directorios con apertura automática de Diffuse.
Uso: python comparar.py <carpeta_a> <carpeta_b>
"""

import os
import sys
import filecmp
import subprocess
from pathlib import Path

# Ruta al ejecutable de Diffuse (ajustá según tu sistema)
DIFFUSE_CMD = "diffuse"
ROOT_PATH = "~/Workspace/"


def obtener_archivos(directorio: Path) -> set[str]:
    """Retorna rutas relativas de todos los archivos en el directorio."""
    archivos = set()
    for ruta, _, nombres in os.walk(directorio):
        for nombre in nombres:
            ruta_completa = Path(ruta) / nombre
            relativa = ruta_completa.relative_to(directorio)
            archivos.add(str(relativa))
    return archivos


def comparar_directorios(dir_a: Path, dir_b: Path):
    archivos_a = obtener_archivos(dir_a)
    archivos_b = obtener_archivos(dir_b)

    solo_en_a = archivos_a - archivos_b
    solo_en_b = archivos_b - archivos_a
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

    return solo_en_a, solo_en_b, diferentes, iguales


def mostrar_resumen(solo_en_a, solo_en_b, diferentes, iguales, dir_a, dir_b):
    print(f"\n{'='*60}")
    print(f"  COMPARACIÓN: {dir_a.name}  vs  {dir_b.name}")
    print(f"{'='*60}")

    print(f"\n✅ Archivos iguales:        {len(iguales)}")
    print(f"🔴 Archivos diferentes:     {len(diferentes)}")
    print(f"📁 Solo en '{dir_a.name}':  {len(solo_en_a)}")
    print(f"📁 Solo en '{dir_b.name}':  {len(solo_en_b)}")

    if diferentes:
        print(f"\n--- Archivos con diferencias ---")
        for f in sorted(diferentes):
            print(f"  ≠  {f}")

    if solo_en_a:
        print(f"\n--- Solo en {dir_a.name} (nuevos/eliminados) ---")
        for f in sorted(solo_en_a):
            print(f"  +  {f}")

    if solo_en_b:
        print(f"\n--- Solo en {dir_b.name} (nuevos/eliminados) ---")
        for f in sorted(solo_en_b):
            print(f"  +  {f}")

    print()


def abrir_diffuse(archivos_diferentes, dir_a: Path, dir_b: Path):
    if not archivos_diferentes:
        print("No hay diferencias para comparar en Diffuse.")
        return

    print(f"Se abrirán {len(archivos_diferentes)} archivo(s) en Diffuse.")
    respuesta = input("¿Continuar? [s/N]: ").strip().lower()

    if respuesta != "s":
        print("Cancelado.")
        return

    for archivo in sorted(archivos_diferentes):
        ruta_a = str(dir_a / archivo)
        ruta_b = str(dir_b / archivo)
        print(f"  Abriendo: {archivo}")
        try:
            subprocess.run([DIFFUSE_CMD, ruta_a, ruta_b], check=True)
        except FileNotFoundError:
            print(
                f"  ERROR: No se encontró '{DIFFUSE_CMD}'. "
                f"Verificá que Diffuse esté instalado y en el PATH."
            )
            break
        except subprocess.CalledProcessError as e:
            print(f"  ERROR al abrir Diffuse: {e}")


def main():
    if len(sys.argv) != 3:
        print("Uso: python comparar.py <carpeta_a> <carpeta_b>")
        sys.exit(1)

    dir_a = Path(sys.argv[1]).resolve()
    dir_b = Path(sys.argv[2]).resolve()

    if not dir_a.is_dir():
        print(f"ERROR: '{dir_a}' no es un directorio válido.")
        sys.exit(1)
    if not dir_b.is_dir():
        print(f"ERROR: '{dir_b}' no es un directorio válido.")
        sys.exit(1)

    solo_en_a, solo_en_b, diferentes, iguales = comparar_directorios(dir_a, dir_b)
    mostrar_resumen(solo_en_a, solo_en_b, diferentes, iguales, dir_a, dir_b)
    abrir_diffuse(diferentes, dir_a, dir_b)


if __name__ == "__main__":
    main()
