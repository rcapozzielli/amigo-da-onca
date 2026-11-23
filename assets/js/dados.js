// Acesso aos dados do site: participantes, configuração, planilhas (CSV) e envio para o Google Forms.
(function () {
  let cacheConfig = null;
  let cacheParticipantes = null;

  async function json(caminho) {
    const resp = await fetch(caminho, { cache: "no-cache" });
    if (!resp.ok) throw new Error(`${caminho}: ${resp.status}`);
    return resp.json();
  }

  async function config() {
    return (cacheConfig ||= await json("data/config.json"));
  }

  async function participantes() {
    return (cacheParticipantes ||= (await json("data/participantes.json")).map((n) => Onca.normalizar(n)));
  }

  // Devolve o sorteio ou null se ainda não aconteceu.
  async function sorteio() {
    const resp = await fetch("data/sorteio.json", { cache: "no-cache" });
    if (resp.status === 404) return null;
    if (!resp.ok) throw new Error("sorteio.json: " + resp.status);
    return resp.json();
  }

  // Parser de CSV simples (aspas, vírgulas e quebras de linha dentro de aspas).
  function parseCSV(texto) {
    const linhas = [];
    let linha = [], campo = "", aspas = false;
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i];
      if (aspas) {
        if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
        else if (c === '"') aspas = false;
        else campo += c;
      } else if (c === '"') aspas = true;
      else if (c === ",") { linha.push(campo); campo = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && texto[i + 1] === "\n") i++;
        linha.push(campo); linhas.push(linha); linha = []; campo = "";
      } else campo += c;
    }
    if (campo !== "" || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  // Lê um CSV publicado e devolve objetos {coluna_em_minusculas: valor}.
  async function lerCSV(url) {
    const resp = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
    if (!resp.ok) throw new Error("CSV: " + resp.status);
    const [cab, ...resto] = parseCSV(await resp.text());
    const chaves = cab.map((c) => c.trim().toLowerCase());
    return resto
      .filter((l) => l.some((v) => v.trim() !== ""))
      .map((l) => Object.fromEntries(chaves.map((k, i) => [k, (l[i] || "").trim()])));
  }

  function coluna(obj, trecho) {
    const k = Object.keys(obj).find((c) => c.includes(trecho));
    return k ? obj[k] : "";
  }

  // Nomes inscritos (conjunto). Lança erro se o formulário ainda não foi configurado.
  async function inscritos() {
    const cfg = await config();
    if (!cfg.cadastro.csv) throw new Error("sem-config");
    const linhas = await lerCSV(cfg.cadastro.csv);
    return new Set(linhas.map((l) => Onca.normalizar(coluna(l, "nome"))).filter(Boolean));
  }

  // Chave pública mais recente de cada inscrito: Map(nome -> chave base64).
  async function chavesInscritas() {
    const cfg = await config();
    if (!cfg.cadastro.csv) throw new Error("sem-config");
    const mapa = new Map();
    (await lerCSV(cfg.cadastro.csv)).forEach((l) => {
      const nome = Onca.normalizar(coluna(l, "nome"));
      if (nome) mapa.set(nome, coluna(l, "chave")); // linhas mais novas sobrescrevem as antigas
    });
    return mapa;
  }

  // Sugestões feitas para `nome`.
  async function sugestoesPara(nome) {
    const cfg = await config();
    if (!cfg.sugestoes.csv) return [];
    const linhas = await lerCSV(cfg.sugestoes.csv);
    return linhas
      .filter((l) => Onca.normalizar(coluna(l, "para")) === nome)
      .map((l) => coluna(l, "sugest"))
      .filter(Boolean);
  }

  // Quantas sugestões cada participante recebeu: Map(nome -> número). Não expõe o conteúdo.
  async function contagemSugestoes() {
    const cfg = await config();
    const mapa = new Map((await participantes()).map((n) => [n, 0]));
    if (!cfg.sugestoes.csv) return mapa;
    (await lerCSV(cfg.sugestoes.csv)).forEach((l) => {
      const n = Onca.normalizar(coluna(l, "para"));
      if (mapa.has(n)) mapa.set(n, mapa.get(n) + 1);
    });
    return mapa;
  }

  // Converte "11/22/2026 21:08:12" (formato da planilha) em Date. Devolve null se não entender.
  function lerData(texto) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})/.exec(texto || "");
    return m ? new Date(+m[3], +m[1] - 1, +m[2], +m[4], +m[5]) : null;
  }

  // Mensagens do mural, mais novas primeiro: [{nome, texto, data}].
  async function mensagensMural() {
    const cfg = await config();
    if (!cfg.mural || !cfg.mural.csv) throw new Error("sem-config");
    const nomes = new Set(await participantes());
    return (await lerCSV(cfg.mural.csv))
      .map((l) => ({
        nome: Onca.normalizar(coluna(l, "nome")),
        texto: coluna(l, "mensag"),
        data: lerData(coluna(l, "timestamp") || coluna(l, "carimbo")),
      }))
      .filter((m) => m.texto && nomes.has(m.nome))
      .reverse();
  }

  // Confere nome + senha contra a inscrição. Devolve "ok", "senha" (não bate) ou "sem-inscricao".
  async function conferirSenha(nome, senha) {
    const [chaves, par] = await Promise.all([chavesInscritas(), Onca.derivarChaves(nome, senha)]);
    const registrada = chaves.get(nome);
    if (!registrada) return "sem-inscricao";
    return registrada === Onca.b64(par.publicKey) ? "ok" : "senha";
  }

  // Envia para o Google Forms. Com no-cors não dá para ler a resposta: se não houve erro de rede, deu certo.
  async function enviarForm(formAction, campos) {
    const corpo = new URLSearchParams(campos);
    await fetch(formAction, { method: "POST", mode: "no-cors", body: corpo });
  }

  // Preenche um <select> com os participantes.
  async function preencherSelect(select, textoInicial) {
    const nomes = await participantes();
    select.innerHTML = "";
    const op0 = new Option(textoInicial, "");
    op0.disabled = true;
    op0.selected = true;
    select.add(op0);
    nomes.forEach((n) => select.add(new Option(n, n)));
  }

  // Mostra "X de N inscritos" e quem falta.
  async function mostrarProgresso(el) {
    try {
      const [nomes, feitos] = await Promise.all([participantes(), inscritos()]);
      const faltam = nomes.filter((n) => !feitos.has(n));
      const total = nomes.length - faltam.length;
      el.innerHTML = "";
      const p = document.createElement("p");
      p.innerHTML = `<strong>${total} de ${nomes.length}</strong> inscritos.`;
      el.appendChild(p);
      if (faltam.length) {
        const f = document.createElement("p");
        f.textContent = "Faltam: " + faltam.join(", ") + ". Cobrem no grupo! 📣";
        el.appendChild(f);
      } else {
        const f = document.createElement("p");
        f.textContent = "Todo mundo inscrito! Agora é com o organizador. 🐆";
        el.appendChild(f);
      }
    } catch (e) {
      el.textContent = e.message === "sem-config"
        ? "As inscrições ainda não abriram."
        : "Não consegui carregar a lista de inscritos agora.";
    }
  }

  window.Dados = { config, participantes, sorteio, inscritos, chavesInscritas, contagemSugestoes, mensagensMural, conferirSenha, sugestoesPara, enviarForm, preencherSelect, mostrarProgresso };
})();
