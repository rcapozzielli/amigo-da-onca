"""Faz o sorteio do Amigo da Onça sem mostrar os pares para ninguém.

Uso (na pasta do projeto):
    python scripts/sortear.py                 # sorteia se todos estiverem inscritos
    python scripts/sortear.py --forcar        # sorteia só com quem já se inscreveu
    python scripts/sortear.py --refazer       # apaga o sorteio anterior e sorteia de novo

O que ele faz:
1. Lê data/participantes.json e as inscrições (CSV da planilha do Forms de cadastro).
2. Se faltar alguém, para e mostra quem falta (a menos que use --forcar).
3. Sorteia (ninguém tira a si mesmo) e lacra o resultado de cada pessoa com a chave pública dela
   e com uma chave de recuperação nova.
4. Grava data/sorteio.json (público, cifrado) e segredos/chave_recuperacao.txt (NUNCA vai pro git).
Em nenhum momento os pares são impressos ou salvos às claras.
"""

import argparse
import sys
from datetime import datetime, timezone

from nacl.public import PrivateKey, PublicKey

import onca


def montar_sorteio(nomes, chaves_publicas, recuperacao: PrivateKey) -> dict:
    """Recebe nomes e {nome: chave_b64}; devolve o conteúdo de sorteio.json."""
    pares = onca.sortear_pares(nomes)
    pessoas = {}
    for quem, tirou in pares.items():
        chave = chaves_publicas[quem]
        pessoas[quem] = {
            "chave": chave,
            "pessoa": onca.lacrar(tirou, PublicKey(onca.de_b64(chave))),
            "recuperacao": onca.lacrar(tirou, recuperacao.public_key),
        }
    del pares  # não deixa os pares por aí
    return {
        "versao": 1,
        "geradoEm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "recuperacaoPub": onca.b64(bytes(recuperacao.public_key)),
        "pessoas": pessoas,
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Sorteio secreto do Amigo da Onça")
    p.add_argument("--csv", help="URL ou arquivo do CSV de inscrições (padrão: data/config.json)")
    p.add_argument("--forcar", action="store_true", help="sorteia mesmo faltando inscrições")
    p.add_argument("--refazer", action="store_true", help="substitui um sorteio já existente")
    p.add_argument("--sim", action="store_true", help="não pergunta nada (aceita inscrições duplicadas)")
    args = p.parse_args()

    if onca.ARQ_SORTEIO.exists() and not args.refazer:
        sys.exit("Já existe um sorteio (data/sorteio.json). Use --refazer se quiser sortear de novo.")

    origem = args.csv or onca.ler_config()["cadastro"]["csv"]
    if not origem:
        sys.exit("Erro: configure cadastro.csv em data/config.json ou passe --csv.")

    nomes = onca.ler_participantes()
    inscricoes = onca.ler_inscricoes(origem)

    desconhecidos = sorted(set(inscricoes) - set(nomes))
    if desconhecidos:
        print("Aviso: inscrições com nomes fora da lista (ignoradas):", ", ".join(desconhecidos))

    faltam = [n for n in nomes if n not in inscricoes]
    print(f"Inscritos: {len(nomes) - len(faltam)} de {len(nomes)}")
    if faltam:
        print("Faltam:", ", ".join(faltam))
        if not args.forcar:
            sys.exit("Sorteio NÃO feito. Espere todos se inscreverem ou use --forcar.")
        nomes = [n for n in nomes if n in inscricoes]

    duplicados = [n for n in nomes if len(inscricoes[n]) > 1]
    if duplicados:
        print("Atenção: estes nomes se inscreveram mais de uma vez:", ", ".join(duplicados))
        print("Será usada a inscrição MAIS RECENTE. Confirme com essas pessoas se foram elas mesmas.")
        if not args.sim and input("Continuar? (s/N) ").strip().lower() != "s":
            sys.exit("Sorteio cancelado.")

    chaves = {n: inscricoes[n][-1] for n in nomes}
    recuperacao = PrivateKey.generate()
    sorteio = montar_sorteio(nomes, chaves, recuperacao)

    onca.ARQ_CHAVE_RECUPERACAO.parent.mkdir(exist_ok=True)
    onca.ARQ_CHAVE_RECUPERACAO.write_text(onca.b64(bytes(recuperacao)) + "\n", encoding="ascii")
    onca.salvar_json(onca.ARQ_SORTEIO, sorteio)

    print(f"Sorteio feito para {len(nomes)} pessoas. Ninguém viu nada. 🐆")
    print("Agora: git add data/sorteio.json && git commit -m \"sorteio\" && git push")
    print("Guarde segredos/chave_recuperacao.txt (NÃO faça commit dela).")


if __name__ == "__main__":
    main()
