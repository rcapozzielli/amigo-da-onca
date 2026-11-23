"""Atualiza o número de versão (?v=...) dos CSS/JS em todas as páginas.

Rode antes de cada commit que muda CSS ou JS:  python scripts/versao.py
Isso obriga o navegador de todo mundo a baixar os arquivos novos (sem isso, o
GitHub Pages deixa o navegador usar a cópia antiga por até 10 minutos).
"""
import re
import time
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
versao = time.strftime("%Y%m%d%H%M")
padrao = re.compile(r'((?:src|href)="assets/[^"?]+\.(?:js|css))(?:\?v=[0-9]+)?"')

for pagina in sorted(RAIZ.glob("*.html")):
    texto = pagina.read_text(encoding="utf-8")
    novo = padrao.sub(rf'\1?v={versao}"', texto)
    if novo != texto:
        pagina.write_text(novo, encoding="utf-8")
        print(f"{pagina.name}: v={versao}")
