// Home: o painel principal muda conforme a fase da brincadeira.
// Fase 1 (sem sorteio): progresso das inscrições + mural da vergonha + botão de inscrição.
// Fase 2 (sorteio publicado): botão grande para descobrir quem tirou.
(async function () {
  let painel = document.getElementById("painel");

  function el(tag, props = {}, ...filhos) {
    const e = Object.assign(document.createElement(tag), props);
    filhos.forEach((f) => e.append(f));
    return e;
  }

  // Nome guardado neste celular depois da inscrição (nunca a senha).
  function lembrado() {
    try { return localStorage.getItem("onca:inscrito"); } catch (e) { return null; }
  }

  function botao(href, texto, extra = "") {
    return el("a", { className: "botao botao-grande " + extra, href, textContent: texto });
  }

  async function faseInscricoes() {
    painel.innerHTML = "";
    painel.append(el("h2", { textContent: "✍️ Inscrições abertas" }));
    const eu = lembrado();
    if (eu) painel.append(el("p", { className: "voce-dentro" }, `✅ Você tá dentro, ${eu}! `,
      el("a", { href: "descobrir.html", textContent: "Testar minha senha" })));
    const area = el("div", {}, el("p", { textContent: "Aguardando mensagem. Essa ação pode levar alguns instantes." }));
    painel.append(area,
      el("p", { className: "painel-acao" }, botao("cadastro.html", "Tô dentro, me inscrever")),
      el("p", { className: "en", lang: "en", textContent: "Sign up and create your password." }));
    const painelOriginal = painel;
    painel = area; // o progresso entra na área, acima do botão
    try {
      const [nomes, feitos] = await Promise.all([Dados.participantes(), Dados.inscritos()]);
      area.innerHTML = "";
      const faltam = nomes.filter((n) => !feitos.has(n));
      const total = nomes.length - faltam.length;
      const pct = Math.round((total / nomes.length) * 100);

      painel.append(
        el("div", { className: "barra", role: "progressbar", ariaValueNow: pct, ariaValueMin: 0, ariaValueMax: 100 },
          el("div", { className: "barra-cheia", style: `width:${pct}%` })),
        el("p", { className: "barra-texto" }, el("strong", { textContent: `${total} de ${nomes.length}` }), " inscritos")
      );

      if (faltam.length) {
        const chips = el("p", { className: "chips" });
        faltam.forEach((n) => chips.append(el("span", { className: "chip", textContent: n })));
        painel.append(el("h3", { className: "vergonha-titulo", textContent: "🐌 Mural da vergonha" }), chips,
          el("p", { className: "vergonha-sub", textContent: "Ainda não se inscreveram. Tá ansioso? Cobra no grupo." }));
      } else {
        painel.append(el("p", { textContent: "Todo mundo dentro! Agora é com o organizador. Calma🖐️" }));
      }
    } catch (e) {
      area.innerHTML = "";
      painel.append(el("p", {
        textContent: e.message === "sem-config" ? "As inscrições ainda não abriram." : "Não consegui carregar os inscritos agora.",
      }));
    }
    painel = painelOriginal;
  }

  function faseSorteio() {
    painel.innerHTML = "";
    painel.append(
      el("h2", { textContent: "🥁 Sorteio liberado!" }),
      el("p", { textContent: "Confere se ninguém tá olhando e descobre quem você tirou." }),
      el("p", { className: "painel-acao" }, botao("descobrir.html", "🎁 Descobrir quem eu tirei")),
      el("p", { className: "en", lang: "en", textContent: "The draw is out. Find out who you got." }),
      el("p", { className: "vergonha-sub" }, "Esqueceu a senha? ", el("a", { href: "cadastro.html", textContent: "Inscreva-se de novo" }), " e avise o organizador.")
    );
  }

  try {
    (await Dados.sorteio()) ? faseSorteio() : await faseInscricoes();
  } catch (e) {
    await faseInscricoes();
  }

  // Ideia ruim do dia: muda uma vez por dia; "Outra" sorteia na hora.
  const saida = document.getElementById("ideia-dia");
  try {
    const ideias = await (await fetch("data/ideias.json", { cache: "no-cache" })).json();
    const dia = Math.floor(Date.now() / 86400000);
    let atual = dia % ideias.length;
    saida.textContent = ideias[atual];
    document.getElementById("outra-ideia").addEventListener("click", () => {
      let i;
      do { i = Math.floor(Math.random() * ideias.length); } while (i === atual && ideias.length > 1);
      atual = i;
      saida.textContent = ideias[i];
    });
  } catch (e) {
    saida.textContent = "Aguardando mensagem. Essa ação pode levar alguns instantes.";
  }
})();
