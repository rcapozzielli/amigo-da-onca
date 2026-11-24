// Criptografia do Amigo da Onça (compatível com scripts/onca.py).
// Depende do tweetnacl (variável global `nacl`), carregado antes deste arquivo.
//
// - A senha vira uma chave com PBKDF2-SHA256 (600 mil iterações, sal = nome). Isso é lento de propósito:
//   dificulta quem tentar adivinhar senhas.
// - Dessa chave secreta sai a chave pública, que é a única coisa enviada na inscrição.
// - O resultado do sorteio vem num "envelope" (nacl box) que só a chave secreta da pessoa abre.
(function (global) {
  const ITERACOES = 600000;

  function normalizar(nome) {
    return nome.normalize("NFC").trim();
  }

  function b64(bytes) {
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  }

  function deB64(texto) {
    return Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
  }

  async function derivarChaves(nome, senha) {
    const enc = new TextEncoder();
    const base = await crypto.subtle.importKey("raw", enc.encode(senha), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: enc.encode("amigo-da-onca:" + normalizar(nome)), iterations: ITERACOES },
      base,
      256
    );
    return nacl.box.keyPair.fromSecretKey(new Uint8Array(bits));
  }

  // Devolve o texto do envelope, ou null se a chave não abrir.
  function abrir(envelope, chaveSecreta) {
    const dados = nacl.box.open(deB64(envelope.ct), deB64(envelope.nonce), deB64(envelope.epk), chaveSecreta);
    if (!dados) return null;
    return new TextDecoder().decode(dados).replace(/ +$/, "");
  }

  // ---------- Pedido anônimo ----------

  // Envelope para a chave pública `destino` (bytes). O texto é completado com espaços até um múltiplo
  // de 256 bytes, para o tamanho do envelope não entregar o tamanho da mensagem. `abrir` tira os espaços.
  function lacrar(texto, destino) {
    const dados = new TextEncoder().encode(texto);
    const cheio = new Uint8Array(Math.ceil((dados.length + 1) / 256) * 256).fill(32);
    cheio.set(dados);
    const efemera = nacl.box.keyPair();
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const ct = nacl.box(cheio, nonce, destino, efemera.secretKey);
    return { epk: b64(efemera.publicKey), nonce: b64(nonce), ct: b64(ct) };
  }

  function abrirJSON(envelope, chaveSecreta) {
    try {
      const texto = abrir(envelope, chaveSecreta);
      return texto === null ? null : JSON.parse(texto);
    } catch (e) {
      return null; // envelope malformado: trata como "não é para mim"
    }
  }

  // Par de chaves para receber as respostas de um pedido. Sai da chave secreta de quem pediu + id do
  // pedido, então dá para recriar quando quiser sem guardar nada.
  async function chaveResposta(idPedido, chaveSecreta) {
    const prefixo = new TextEncoder().encode("amigo-da-onca:resposta:" + idPedido);
    const tudo = new Uint8Array(prefixo.length + chaveSecreta.length);
    tudo.set(prefixo);
    tudo.set(chaveSecreta, prefixo.length);
    const semente = new Uint8Array(await crypto.subtle.digest("SHA-256", tudo));
    return nacl.box.keyPair.fromSecretKey(semente);
  }

  // Cifra bytes (foto) com uma chave aleatória. Quem tem {chave, nonce} decifra.
  function cifrarBytes(bytes) {
    const chave = nacl.randomBytes(nacl.secretbox.keyLength);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
    return { dados: nacl.secretbox(bytes, nonce, chave), chave: b64(chave), nonce: b64(nonce) };
  }

  function decifrarBytes(dados, chave, nonce) {
    return nacl.secretbox.open(dados, deB64(nonce), deB64(chave)); // null se não bater
  }

  global.Onca = {
    normalizar, b64, deB64, derivarChaves, abrir, ITERACOES,
    lacrar, abrirJSON, chaveResposta, cifrarBytes, decifrarBytes,
  };
})(typeof window !== "undefined" ? window : globalThis);
