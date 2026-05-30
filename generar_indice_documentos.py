import os
import json
from datetime import datetime

# Carpeta real usada por la app. No cambiar salvo que también cambie la carpeta física.
CARPETA_DOCUMENTOS = "documentos"

ARCHIVO_JSON = "documentos-index.json"
ARCHIVO_JS = "documentos-index.js"

EXTENSIONES_PERMITIDAS = {
    ".pdf",
    ".html",
    ".htm",
    ".docx",
    ".xlsx",
    ".xls",
    ".txt",
    ".csv"
}

def titulo_desde_nombre(nombre):
    base = os.path.splitext(nombre)[0]
    return base.replace("_", " ").replace("-", " ").strip().title()

def generar_indice():
    documentos = []

    if not os.path.isdir(CARPETA_DOCUMENTOS):
        print(f"No existe la carpeta: {CARPETA_DOCUMENTOS}")
        return

    for archivo in sorted(os.listdir(CARPETA_DOCUMENTOS), key=lambda x: x.lower()):
        ruta = os.path.join(CARPETA_DOCUMENTOS, archivo)

        if not os.path.isfile(ruta):
            continue

        extension = os.path.splitext(archivo)[1].lower()

        if extension not in EXTENSIONES_PERMITIDAS:
            continue

        documentos.append({
            "titulo": titulo_desde_nombre(archivo),
            "archivo": f"{CARPETA_DOCUMENTOS}/{archivo}",
            "nombre": archivo,
            "tipo": extension.replace(".", "").upper(),
            "descripcion": "Documento de referencia operativo."
        })

    salida = {
        "actualizado": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "documentos": documentos
    }

    with open(ARCHIVO_JSON, "w", encoding="utf-8") as f:
        json.dump(salida, f, ensure_ascii=False, indent=2)

    with open(ARCHIVO_JS, "w", encoding="utf-8") as f:
        f.write("window.DOCUMENTOS_INDEX = ")
        json.dump(salida, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"Índice generado correctamente: {len(documentos)} documentos")
    print(f"Archivos actualizados: {ARCHIVO_JSON} y {ARCHIVO_JS}")

if __name__ == "__main__":
    generar_indice()
