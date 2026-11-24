# Amigo da Onça 🐆: Réveillon em Juquehy

Amigo secreto de presentes **ruins**: cada um dá um presente horrível e engraçado para quem tirou.

**Site:** https://rcapozzielli.github.io/amigo-da-onca/

Site estático (GitHub Pages), sem backend. O sorteio é secreto, inclusive para o organizador:
o resultado de cada pessoa fica criptografado com uma chave que sai da senha que só ela conhece.

## Regra de ouro do repositório
Este repositório é **público**. A pasta `segredos/` (chave de recuperação) fica só no computador do
organizador e está no `.gitignore`. **Nunca faça commit dela.**

---

## Como funciona (resumo)

| Etapa | Quem | Onde |
|---|---|---|
| 1. Inscrição: escolhe o nome e cria uma senha | cada participante | `cadastro.html` |
| 2. Sorteio | organizador | `python scripts/sortear.py` |
| 3. Revelação: nome + senha → mostra quem tirou | cada participante | `descobrir.html` |
| Sugestões anônimas de presente (a qualquer momento) | qualquer um | `sugerir.html` |

- Na inscrição, o celular transforma a senha em um par de chaves (PBKDF2 + Curve25519).
  Só a **chave pública** vai para a planilha. A senha nunca sai do celular.
- O sorteio lacra o nome sorteado de cada pessoa com a chave pública dela e grava
  `data/sorteio.json`. Esse arquivo é público, mas ninguém consegue ler os envelopes sem a senha certa.
- O script **nunca imprime os pares**.
- As sugestões ficam numa planilha. A página de revelação mostra só as sugestões para quem você tirou.

Os dados ficam em dois Google Forms usados como "banco de dados" escondido. O site envia as
respostas para eles e lê as planilhas publicadas como CSV. A configuração está em `data/config.json`.

---

## Guia do organizador

### 0. Preparar o computador (uma vez)
```
pip install -r scripts/requirements.txt
python scripts/teste_ponta_a_ponta.py     # deve terminar com "TUDO CERTO"
```

### 1. Abrir as inscrições
Mande no grupo do WhatsApp:

> 🐆 *AMIGO DA ONÇA* 🐆
> Amigo secreto de presente RUIM no réveillon de Juquehy!
> 1. Entra aqui: https://rcapozzielli.github.io/amigo-da-onca/cadastro.html
> 2. Escolhe seu nome e cria uma senha (ANOTA ELA!)
> 3. Quando todo mundo se inscrever, eu libero o sorteio e vocês descobrem quem tiraram no mesmo site.
> E dá pra mandar sugestão anônima de presente pros outros em "Sugerir" 😈

A página de inscrição mostra quem falta. A lista pode levar ~5 min para atualizar.

### 2. Fazer o sorteio
Quando todo mundo estiver inscrito:
```
python scripts/sortear.py
```
- Se faltar alguém, ele **não sorteia** e mostra quem falta.
- Para sortear só com quem já se inscreveu, use `--forcar`.
- Se alguém se inscreveu duas vezes, ele avisa e usa a inscrição mais recente. Confirme com a pessoa.
- Ele cria `data/sorteio.json` e `segredos/chave_recuperacao.txt`.

Depois publique **só o sorteio**:
```
git add data/sorteio.json
git commit -m "sorteio liberado"
git push
```
Em ~1 minuto o site atualiza. Mande no grupo:

> 🥁 Sorteio liberado! Descobre quem você tirou: https://rcapozzielli.github.io/amigo-da-onca/descobrir.html

Guarde `segredos/chave_recuperacao.txt`. Sem ela, não dá para redefinir a senha de ninguém.

### 3. Alguém esqueceu a senha
1. A pessoa entra em **Inscrição**, marca "Quero trocar minha senha" e cria uma senha nova.
2. Espere ~5 min (a planilha atualizar) e rode:
   ```
   python scripts/recuperar.py "Nome da pessoa"
   ```
3. `git add data/sorteio.json && git commit -m "nova senha" && git push`

O script abre o resultado da pessoa só na memória e tranca de novo com a chave nova. Nada aparece na tela.

### Refazer o sorteio do zero
`python scripts/sortear.py --refazer`, depois commit e push. Todo mundo vai ter um resultado novo.

### Mural de mensagens (terceiro Forms)
1. Crie um Forms "Mural" com duas perguntas: `Nome` (resposta curta) e `Mensagem` (parágrafo).
   Publique, deixe "qualquer pessoa com o link", sem login.
2. Vincule a uma planilha e publique a aba como CSV (igual aos outros dois).
3. Preencha `mural` em `data/config.json` (formAction, campoNome, campoMensagem, csv).
Para apagar uma mensagem, apague a linha na planilha.

### Pedido anônimo (Supabase)
Quem tirou alguém pede foto/material para outra pessoa sem se identificar. Fica em `pedidos.html`.
- Pedido, resposta e fotos são cifrados no celular antes de sair. No banco só tem ruído:
  nem o organizador nem quem administra o Supabase lê ou vê nada.
- O pedido vai para a chave pública de quem recebe (a mesma do sorteio). A resposta vai para uma
  "chave de resposta" que só quem pediu recria (sai da senha dele + id do pedido).
- As fotos são reduzidas para no máximo 2560 px (dá para imprimir) e perdem o EXIF (localização).

Configurar (uma vez):
1. Crie um projeto em supabase.com (plano gratuito).
2. Abra **SQL Editor**, cole `supabase/esquema.sql` e rode. Ele cria as tabelas, as regras de acesso
   (só ler e inserir) e o bucket `fotos`.
3. Em **Project Settings > API**, copie a URL do projeto e a chave **pública** (anon / publishable)
   para `data/config.json` > `supabase`. Essa chave foi feita para ficar pública.
   **Nunca** copie a chave `service_role` / secret para o repositório.

Manutenção:
- Projeto gratuito pausa após um tempo sem uso. Se a página disser "Não consegui carregar", abra o
  painel do Supabase e clique em **Restore/Resume**.
- Zerar dados de teste (SQL Editor): `truncate public.respostas, public.pedidos;` e apague os
  arquivos do bucket `fotos` em **Storage**.
- Depois da viagem: apague o projeto em **Project Settings > General > Delete project**.
- Esqueceu a senha? Depois do `recuperar.py` a pessoa pede de novo; respostas antigas ficam presas
  na senha antiga.

### Noite da troca ("É HOJE")
Preencha `dataTroca` em `assets/js/config.js` (ex.: `"2026-12-31T20:00:00-03:00"`).
No dia, a home vira a tela "É HOJE" com contador e a roleta de quem começa.

### Mudou CSS ou JS?
Rode `python scripts/versao.py` antes do commit. Ele atualiza o `?v=...` dos arquivos nas páginas
e obriga o navegador de todo mundo a baixar a versão nova.

### Trocar participantes
Edite `data/participantes.json` **antes** das inscrições. O nome faz parte da chave: se você mudar
um nome depois que a pessoa se inscreveu, ela precisa se inscrever de novo.

---

## Sobre o sigilo (honestamente)
- Ninguém vê os pares: nem o site, nem o GitHub, nem a planilha, nem o organizador.
- O organizador só conseguiria ver se trapaceasse de propósito: alterando o script ou usando a
  chave de recuperação. Sem servidor, essa é a garantia possível.
- Senhas fracas podem ser adivinhadas por quem baixar o arquivo público e tentar muitas senhas.
  A derivação é lenta de propósito (600 mil iterações), mas use uma senha razoável.
- As planilhas publicadas (inscrições e sugestões) são públicas para quem souber o link.
  O site só não exibe as sugestões para quem não deve ver.

## Estrutura
```
index.html, regras.html, ideias.html       páginas informativas
cadastro.html, descobrir.html, sugerir.html páginas com dados
assets/js/cripto.js                         criptografia no navegador (tweetnacl)
assets/js/dados.js                          planilhas, Forms, participantes
data/participantes.json                     lista de nomes
data/config.json                            links dos Forms e planilhas (nada secreto)
data/ideias.json                            catálogo de presentes ruins
data/sorteio.json                           criado pelo sorteio (cifrado)
scripts/onca.py                             funções compartilhadas (Python)
scripts/sortear.py, scripts/recuperar.py    sorteio e redefinição de senha
scripts/teste_ponta_a_ponta.py              teste com participantes fictícios
```
