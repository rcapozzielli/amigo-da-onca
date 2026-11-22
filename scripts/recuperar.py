"""Redefine o acesso de quem esqueceu a senha, sem mostrar quem a pessoa tirou.

Passo a passo:
1. A pessoa entra no site e se inscreve de novo, com uma senha nova.
2. Você roda:   python scripts/recuperar.py "Nome da Pessoa"
3. Faz commit e push de data/sorteio.json.

O script abre o envelope de recuperação só na memória, lacra de novo com a chave nova da pessoa
e atualiza o sorteio. Nada é impresso.
"""

import argparse
import json
import sys

from nacl.public import PublicKey

import onca


def trocar_chave(sorteio: dict, nome: str, chave_nova_b64: str, recuperacao) -> None:
    entrada = sorteio["pessoas"][nome]
    tirou = onca.abrir(entrada["recuperacao"], recuperacao)
    entrada["pessoa"] = onca.lacrar(tirou, PublicKey(onca.de_b64(chave_nova_b64)))
    entrada["chave"] = chave_nova_b64
    del tirou


def main() -> None:
    p = argparse.ArgumentParser(description="Redefine a senha de um participante")
    p.add_argument("nome", help="nome exatamente como em data/participantes.json")
    p.add_argument("--csv", help="URL ou arquivo do CSV de inscrições (padrão: data/config.json)")
    args = p.parse_args()

    if not onca.ARQ_SORTEIO.exists():
        sys.exit("Ainda não há sorteio. Antes do sorteio, basta a pessoa se inscrever de novo.")

    nome = onca.normalizar(args.nome)
    sorteio = json.loads(onca.ARQ_SORTEIO.read_text(encoding="utf-8"))
    if nome not in sorteio["pessoas"]:
        sys.exit(f"'{nome}' não está no sorteio. Nomes: {', '.join(sorteio['pessoas'])}")

    origem = args.csv or onca.ler_config()["cadastro"]["csv"]
    chaves = onca.ler_inscricoes(origem).get(nome, [])
    if not chaves:
        sys.exit(f"Não achei inscrição de '{nome}' no CSV.")
    chave_nova = chaves[-1]
    if chave_nova == sorteio["pessoas"][nome]["chave"]:
        sys.exit("A inscrição mais recente é a mesma de antes. Peça para a pessoa se inscrever de novo "
                 "com a senha nova (e espere uns minutos a planilha atualizar).")

    trocar_chave(sorteio, nome, chave_nova, onca.ler_chave_recuperacao())
    onca.salvar_json(onca.ARQ_SORTEIO, sorteio)
    print(f"Pronto: '{nome}' agora entra com a senha nova. Faça commit e push de data/sorteio.json.")


if __name__ == "__main__":
    main()
