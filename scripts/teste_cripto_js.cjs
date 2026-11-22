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
})().catch((e) => { console.error(e.message); process.exit(1); });
