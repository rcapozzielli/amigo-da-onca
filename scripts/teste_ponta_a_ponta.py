"""Teste completo com participantes fictícios (não toca nos arquivos reais do projeto).

Uso:  python scripts/teste_ponta_a_ponta.py
Se o Node.js estiver instalado, também confere que o navegador (assets/js/cripto.js) abre os
envelopes gerados pelo Python.
"""

import csv
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import onca
import recuperar
import sortear

SENHAS = {"Ana": "abacaxi1", "Bruno": "tubarão22", "Cação": "senha-boa", "Duda": "123456", "Ênio": "juquehy!"}


def escrever_csv(caminho: Path, linhas):
    with caminho.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Carimbo de data/hora", "Nome", "Chave"])
        for nome, chave in linhas:
            w.writerow(["01/12/2026 10:00:00", nome, chave])


def rodar(modulo, *argumentos) -> int:
    sys.argv = [modulo.__name__, *argumentos]
    try:
        modulo.main()
        return 0
    except SystemExit as e:
        return 0 if e.code in (None, 0) else 1


def verifica(condicao, mensagem):
    if not condicao:
        raise SystemExit("FALHOU: " + mensagem)
    print("ok -", mensagem)


def main():
    tmp = Path(tempfile.mkdtemp(prefix="onca_teste_"))
    (tmp / "segredos").mkdir()
    onca.ARQ_PARTICIPANTES = tmp / "participantes.json"
    onca.ARQ_SORTEIO = tmp / "sorteio.json"
    onca.ARQ_CHAVE_RECUPERACAO = tmp / "segredos" / "chave_recuperacao.txt"
    csv_path = tmp / "inscricoes.csv"

    nomes = list(SENHAS)
    onca.salvar_json(onca.ARQ_PARTICIPANTES, nomes)
    chaves = {n: onca.chave_da_senha(n, s) for n, s in SENHAS.items()}
    pub = {n: onca.b64(bytes(k.public_key)) for n, k in chaves.items()}

    # 1) Falta gente: não pode sortear
    escrever_csv(csv_path, [(n, pub[n]) for n in nomes[:-1]])
    verifica(rodar(sortear, "--csv", str(csv_path)) == 1 and not onca.ARQ_SORTEIO.exists(),
             "sorteio recusado enquanto falta inscrição")

    # 2) Todos inscritos (Ana com uma inscrição antiga duplicada): sorteia
    chave_velha_ana = onca.b64(bytes(onca.chave_da_senha("Ana", "senha-antiga").public_key))
    escrever_csv(csv_path, [("Ana", chave_velha_ana)] + [(n, pub[n]) for n in nomes])
    verifica(rodar(sortear, "--csv", str(csv_path), "--sim") == 0, "sorteio feito com todos inscritos")
    sorteio = json.loads(onca.ARQ_SORTEIO.read_text(encoding="utf-8"))

    # 3) Não sorteia de novo sem --refazer
    verifica(rodar(sortear, "--csv", str(csv_path), "--sim") == 1, "não refaz sorteio sem --refazer")

    # 4) Cada um abre o seu; ninguém tira a si mesmo; todos são tirados uma vez
    tirados = {n: onca.abrir(sorteio["pessoas"][n]["pessoa"], chaves[n]) for n in nomes}
    verifica(all(n != t for n, t in tirados.items()), "ninguém tirou a si mesmo")
    verifica(sorted(tirados.values()) == sorted(nomes), "cada pessoa foi tirada exatamente uma vez")
    verifica(sorteio["pessoas"]["Ana"]["chave"] == pub["Ana"], "duplicado: usou a inscrição mais recente")

    # 5) A chave de um não abre o envelope de outro
    try:
        onca.abrir(sorteio["pessoas"]["Bruno"]["pessoa"], chaves["Ana"])
        abriu = True
    except Exception:
        abriu = False
    verifica(not abriu, "a chave da Ana não abre o envelope do Bruno")

    # 6) Tamanho dos envelopes é igual para todos (não entrega o tamanho do nome)
    tamanhos = {len(e["pessoa"]["ct"]) for e in sorteio["pessoas"].values()}
    verifica(len(tamanhos) == 1, "envelopes com tamanho fixo")

    # 7) Recuperação: Duda esqueceu a senha e se inscreveu de novo
    nova = onca.chave_da_senha("Duda", "nova-senha-duda")
    with csv_path.open("a", encoding="utf-8", newline="") as f:
        csv.writer(f).writerow(["02/12/2026 09:00:00", "Duda", onca.b64(bytes(nova.public_key))])
    verifica(rodar(recuperar, "Duda", "--csv", str(csv_path)) == 0, "recuperar.py rodou")
    sorteio = json.loads(onca.ARQ_SORTEIO.read_text(encoding="utf-8"))
    verifica(onca.abrir(sorteio["pessoas"]["Duda"]["pessoa"], nova) == tirados["Duda"],
             "Duda abre com a senha nova e o resultado é o mesmo")
    try:
        onca.abrir(sorteio["pessoas"]["Duda"]["pessoa"], chaves["Duda"])
        velha_abre = True
    except Exception:
        velha_abre = False
    verifica(not velha_abre, "senha antiga da Duda não funciona mais")

    # 8) Compatibilidade com o navegador (Node.js)
    if shutil.which("node"):
        js = Path(__file__).with_name("teste_cripto_js.cjs")
        senhas = dict(SENHAS, Duda="nova-senha-duda")
        fixture = tmp / "fixture.json"
        fixture.write_text(json.dumps({"sorteio": sorteio, "senhas": senhas, "esperado": tirados},
                                      ensure_ascii=False), encoding="utf-8")
        r = subprocess.run(["node", str(js), str(fixture)], capture_output=True, text=True, encoding="utf-8")
        print(r.stdout.strip())
        verifica(r.returncode == 0, "cripto.js (navegador) abre os envelopes do Python" + (" — " + r.stderr if r.returncode else ""))
    else:
        print("(Node.js não encontrado: pulei o teste do navegador)")

    shutil.rmtree(tmp)
    print("\nTUDO CERTO 🐆")


if __name__ == "__main__":
    main()
