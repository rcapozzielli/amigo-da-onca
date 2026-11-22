"""Funções compartilhadas pelos scripts do Amigo da Onça.

Criptografia (compatível com assets/js/cripto.js):
- Chave da pessoa: PBKDF2-SHA256(senha, salt="amigo-da-onca:" + nome, 600000 iterações) -> 32 bytes,
  usados direto como chave secreta Curve25519 (igual a nacl.box.keyPair.fromSecretKey no tweetnacl).
- Envelope: nacl box com chave efêmera (quem abre só precisa da própria chave secreta).
- A mensagem tem tamanho fixo (preenchida com espaços) para o tamanho do envelope não revelar o nome.
"""

import base64
import csv
import hashlib
import io
import json
import random
import unicodedata
import urllib.request
from pathlib import Path

from nacl.public import Box, PrivateKey, PublicKey
from nacl.utils import random as bytes_aleatorios

RAIZ = Path(__file__).resolve().parent.parent
ARQ_PARTICIPANTES = RAIZ / "data" / "participantes.json"
ARQ_CONFIG = RAIZ / "data" / "config.json"
ARQ_SORTEIO = RAIZ / "data" / "sorteio.json"
ARQ_CHAVE_RECUPERACAO = RAIZ / "segredos" / "chave_recuperacao.txt"

ITERACOES = 600_000
TAMANHO_MENSAGEM = 96  # bytes; nomes maiores que isso são recusados


def b64(dados: bytes) -> str:
    return base64.b64encode(dados).decode("ascii")


def de_b64(texto: str) -> bytes:
    return base64.b64decode(texto)


def normalizar(nome: str) -> str:
    return unicodedata.normalize("NFC", nome.strip())


def chave_da_senha(nome: str, senha: str) -> PrivateKey:
    """Mesma derivação do navegador. Usada só nos testes (o sorteio nunca vê senhas)."""
    sal = ("amigo-da-onca:" + normalizar(nome)).encode("utf-8")
    semente = hashlib.pbkdf2_hmac("sha256", senha.encode("utf-8"), sal, ITERACOES, 32)
    return PrivateKey(semente)


def lacrar(texto: str, destino: PublicKey) -> dict:
    """Cria um envelope que só a chave secreta correspondente a `destino` abre."""
    dados = texto.encode("utf-8")
    if len(dados) > TAMANHO_MENSAGEM:
        raise ValueError("Nome grande demais para o envelope.")
    dados = dados + b" " * (TAMANHO_MENSAGEM - len(dados))
    efemera = PrivateKey.generate()
    nonce = bytes_aleatorios(Box.NONCE_SIZE)
    cifrado = Box(efemera, destino).encrypt(dados, nonce).ciphertext
    return {"epk": b64(bytes(efemera.public_key)), "nonce": b64(nonce), "ct": b64(cifrado)}


def abrir(envelope: dict, chave: PrivateKey) -> str:
    box = Box(chave, PublicKey(de_b64(envelope["epk"])))
    dados = box.decrypt(de_b64(envelope["ct"]), de_b64(envelope["nonce"]))
    return dados.decode("utf-8").rstrip(" ")


def ler_participantes() -> list[str]:
    nomes = [normalizar(n) for n in json.loads(ARQ_PARTICIPANTES.read_text(encoding="utf-8"))]
    if len(set(nomes)) != len(nomes):
        raise SystemExit("Erro: há nomes repetidos em data/participantes.json.")
    return nomes


def ler_config() -> dict:
    return json.loads(ARQ_CONFIG.read_text(encoding="utf-8"))


def baixar_texto(origem: str) -> str:
    """Lê um CSV de uma URL (planilha publicada) ou de um arquivo local."""
    if origem.startswith("http"):
        with urllib.request.urlopen(origem, timeout=30) as resp:
            return resp.read().decode("utf-8")
    return Path(origem).read_text(encoding="utf-8")


def ler_inscricoes(origem: str) -> dict[str, list[str]]:
    """Devolve {nome: [chave1, chave2, ...]} na ordem em que chegaram (a última é a mais recente)."""
    leitor = csv.reader(io.StringIO(baixar_texto(origem)))
    cabecalho = [c.strip().lower() for c in next(leitor)]
    try:
        i_nome = next(i for i, c in enumerate(cabecalho) if "nome" in c)
        i_chave = next(i for i, c in enumerate(cabecalho) if "chave" in c)
    except StopIteration:
        raise SystemExit("Erro: o CSV de inscrições precisa ter colunas 'Nome' e 'Chave'.")

    inscricoes: dict[str, list[str]] = {}
    for linha in leitor:
        if len(linha) <= max(i_nome, i_chave):
            continue
        nome, chave = normalizar(linha[i_nome]), linha[i_chave].strip()
        try:
            if len(de_b64(chave)) != 32:
                continue
        except Exception:
            continue  # chave inválida: ignora a linha
        inscricoes.setdefault(nome, []).append(chave)
    return inscricoes


def sortear_pares(nomes: list[str]) -> dict[str, str]:
    """Derangement aleatório: ninguém tira a si mesmo."""
    if len(nomes) < 2:
        raise SystemExit("Erro: precisa de pelo menos 2 participantes.")
    rng = random.SystemRandom()
    while True:
        embaralhado = nomes[:]
        rng.shuffle(embaralhado)
        if all(a != b for a, b in zip(nomes, embaralhado)):
            return dict(zip(nomes, embaralhado))


def ler_chave_recuperacao() -> PrivateKey:
    if not ARQ_CHAVE_RECUPERACAO.exists():
        raise SystemExit(f"Erro: não achei {ARQ_CHAVE_RECUPERACAO}. Ela é criada pelo sortear.py.")
    return PrivateKey(de_b64(ARQ_CHAVE_RECUPERACAO.read_text(encoding="ascii").strip()))


def salvar_json(caminho: Path, dados) -> None:
    caminho.write_text(json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
