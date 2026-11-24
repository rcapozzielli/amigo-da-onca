// Confere que assets/js/cripto.js (o mesmo código do navegador) abre os envelopes gerados em Python.
// Chamado pelo teste_ponta_a_ponta.py. Baixa o tweetnacl da mesma CDN que o site usa.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const TWEETNACL = "https://cdnjs.cloudflare.com/ajax/libs/tweetnacl/1.0.3/nacl-fast.min.js";

(async () => {
  const fixture = JSON.parse(fs.readFileSync(process.argv[2], "utf-8"));

  const codigoNacl = await (await fetch(TWEETNACL)).text();
  // Roda no mesmo contexto (outro contexto teria outro Uint8Array e o tweetnacl recusaria).
  globalThis.self ||= globalThis; // o tweetnacl acha o gerador aleatório em self.crypto, como no navegador
  const mod = { exports: {} };
  vm.runInThisContext("(function (module) {" + codigoNacl + "\n})")(mod);
  globalThis.nacl = mod.exports;

  vm.runInThisContext(fs.readFileSync(path.join(__dirname, "..", "assets", "js", "cripto.js"), "utf-8"));
  const Onca = globalThis.Onca;

  for (const [nome, senha] of Object.entries(fixture.senhas)) {
    const par = await Onca.derivarChaves(nome, senha);
    const entrada = fixture.sorteio.pessoas[nome];
    if (Onca.b64(par.publicKey) !== entrada.chave) throw new Error(`chave pública diferente para ${nome}`);
    const tirou = Onca.abrir(entrada.pessoa, par.secretKey);
    if (tirou !== fixture.esperado[nome]) throw new Error(`envelope errado para ${nome}`);
  }
  const errado = await Onca.derivarChaves("Ana", "senha-errada");
  if (Onca.abrir(fixture.sorteio.pessoas.Ana.pessoa, errado.secretKey) !== null) throw new Error("senha errada abriu");
  console.log("ok - JS: chaves iguais às do Python, envelopes abertos, senha errada recusada");

  // Pedido anônimo: A pede para B, B responde com "foto", só A abre a resposta.
  const A = await Onca.derivarChaves("Ana", fixture.senhas.Ana);
  const [nomeB, senhaB] = Object.entries(fixture.senhas).find(([n]) => n !== "Ana");
  const B = await Onca.derivarChaves(nomeB, senhaB);
  const id = "11111111-2222-3333-4444-555555555555";
  const resp = await Onca.chaveResposta(id, A.secretKey);
  const resp2 = await Onca.chaveResposta(id, A.secretKey);
  if (Onca.b64(resp.publicKey) !== Onca.b64(resp2.publicKey)) throw new Error("chave de resposta não é determinística");
  const outra = await Onca.chaveResposta("outro-id", A.secretKey);
  if (Onca.b64(outra.publicKey) === Onca.b64(resp.publicKey)) throw new Error("chave de resposta repetida entre pedidos");

  const para = Onca.lacrar(JSON.stringify({ texto: "manda foto ção 🐆", resposta: Onca.b64(resp.publicKey) }), B.publicKey);
  const dono = Onca.lacrar(JSON.stringify({ id }), A.publicKey);
  if (Onca.deB64(para.ct).length % 256 !== 16) throw new Error("padding do envelope errado");
  const lido = Onca.abrirJSON(para, B.secretKey);
  if (!lido || lido.texto !== "manda foto ção 🐆") throw new Error("B não abriu o pedido");
  if (Onca.abrirJSON(para, A.secretKey) !== null) throw new Error("A abriu envelope que era do B");
  if (Onca.abrirJSON(dono, A.secretKey)?.id !== id) throw new Error("A não achou o próprio pedido");
  if (Onca.abrirJSON(dono, B.secretKey) !== null) throw new Error("B descobriu quem pediu");

  const foto = Uint8Array.from({ length: 300000 }, (_, i) => i % 251);
  const cif = Onca.cifrarBytes(foto);
  const respostaEnv = Onca.lacrar(JSON.stringify({ texto: "toma", fotos: [{ caminho: "x", chave: cif.chave, nonce: cif.nonce }] }),
    Onca.deB64(lido.resposta));
  const aberta = Onca.abrirJSON(respostaEnv, (await Onca.chaveResposta(id, A.secretKey)).secretKey);
  if (!aberta) throw new Error("A não abriu a resposta");
  if (Onca.abrirJSON(respostaEnv, B.secretKey) !== null) throw new Error("B abriu a resposta");
  const volta = Onca.decifrarBytes(cif.dados, aberta.fotos[0].chave, aberta.fotos[0].nonce);
  if (!volta || volta.length !== foto.length || volta.some((b, i) => b !== foto[i])) throw new Error("foto não voltou igual");
  const adulterado = cif.dados.slice(); adulterado[50] ^= 1;
  if (Onca.decifrarBytes(adulterado, cif.chave, cif.nonce) !== null) throw new Error("foto adulterada foi aceita");
  console.log("ok - pedido anônimo: só o destino lê, só quem pediu vê a resposta, foto volta igual");
})().catch((e) => { console.error(e.message); process.exit(1); });
