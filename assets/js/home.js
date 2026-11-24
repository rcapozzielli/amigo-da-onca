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

  // Fase 3: dia da troca (de 00:00 do dia até 6h depois do horário marcado).
  function ehDiaDaTroca() {
    if (!window.CONFIG.dataTroca) return false;
    const troca = new Date(window.CONFIG.dataTroca);
    const inicio = new Date(troca); inicio.setHours(0, 0, 0, 0);
    const agora = new Date();
    return agora >= inicio && agora <= new Date(troca.getTime() + 6 * 3600000);
  }

  async function faseTroca() {
    const troca = new Date(window.CONFIG.dataTroca);
    const relogio = el("p", { className: "relogio-troca" });
    const roleta = el("p", { className: "roleta", textContent: "?" });
    const girar = el("button", { className: "botao", type: "button", textContent: "🎰 Quem começa?" });
    painel.innerHTML = "";
    painel.append(
      el("h2", { textContent: "🎁 É HOJE!" }), relogio,
      el("h3", { className: "vergonha-titulo", textContent: "Roleta: quem entrega primeiro" }), roleta,
      el("p", {}, girar),
      el("p", { className: "painel-acao" }, botao("descobrir.html", "Esqueci quem eu tirei")),
    );
    const tique = () => {
      const falta = troca - Date.now();
      if (falta <= 0) { relogio.textContent = "É AGORA! Cada um com seu presente horrível. 🐆"; return; }
      const s = Math.floor(falta / 1000);
      relogio.textContent = `Faltam ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min ${s % 60}s`;
    };
    tique(); setInterval(tique, 1000);

    const nomes = await Dados.participantes();
    girar.addEventListener("click", () => {
      girar.disabled = true;
      let passos = 0;
      const total = 25 + Math.floor(Math.random() * 10);
      const rodar = () => {
        roleta.textContent = nomes[Math.floor(Math.random() * nomes.length)];
        if (++passos < total) setTimeout(rodar, 40 + passos * 6); // vai desacelerando
        else { roleta.classList.add("roleta-fim"); girar.disabled = false; }
      };
      roleta.classList.remove("roleta-fim");
      rodar();
    });
  }

  async function montarPainel() {
    try {
      if (ehDiaDaTroca()) return await faseTroca();
      (await Dados.sorteio()) ? faseSorteio() : await faseInscricoes();
    } catch (e) {
      await faseInscricoes();
    }
  }

  // Termômetro: barras com o número de sugestões de cada um.
  async function montarTermometro() {
    const caixa = document.getElementById("termometro");
    try {
      const contagem = [...(await Dados.contagemSugestoes()).entries()].sort((a, b) => b[1] - a[1]);
      const max = Math.max(1, ...contagem.map(([, n]) => n));
      caixa.innerHTML = "";
      contagem.forEach(([nome, n], i) => {
        const fogo = n === 0 ? "🧊" : i === 0 ? "🔥🔥🔥" : n >= max / 2 ? "🔥" : "";
        caixa.append(el("div", { className: "termo-linha" },
          el("span", { className: "termo-nome", textContent: nome }),
          el("span", { className: "termo-barra" }, el("span", { style: `width:${(n / max) * 100}%` })),
          el("span", { className: "termo-num", textContent: `${n} ${fogo}` })));
      });
    } catch (e) {
      caixa.textContent = "Não consegui carregar o termômetro agora.";
    }
  }

  // Prévia do mural: as 3 mensagens mais novas.
  async function montarMural() {
    const caixa = document.getElementById("mural-previa");
    try {
      const msgs = (await Dados.mensagensMural()).slice(0, 3);
      caixa.innerHTML = "";
      if (!msgs.length) return caixa.append(el("p", { textContent: "Ninguém escreveu nada ainda. Seja o primeiro larper." }));
      msgs.forEach((m) => caixa.append(window.Mural.cartao(m)));
    } catch (e) {
      caixa.textContent = e.message === "sem-config" ? "O mural abre em breve. Calma🖐️" : "Não consegui carregar o mural agora.";
    }
  }

  // Ideia ruim do dia: muda uma vez por dia; "Outra" sorteia na hora.
  async function montarIdeia() {
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
  }

  // Pedido anônimo: só o total (os pedidos são cifrados; ninguém sabe de quem nem pra quem).
  async function montarPedidos() {
    const saida = document.getElementById("pedidos-total");
    try {
      saida.textContent = (await Banco.listar("pedidos", "id")).length;
    } catch (e) {
      saida.textContent = e.message === "sem-config" ? "em breve" : "?";
    }
  }

  // Tudo carrega em paralelo: a planilha lenta não segura o resto da página.
  montarPainel(); montarTermometro(); montarMural(); montarIdeia(); montarPedidos();
})();
