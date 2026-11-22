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

  global.Onca = { normalizar, b64, deB64, derivarChaves, abrir, ITERACOES };
})(typeof window !== "undefined" ? window : globalThis);
