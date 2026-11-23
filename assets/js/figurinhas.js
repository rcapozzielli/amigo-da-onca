// Decoração: "figurinhas" com as piadas internas do grupo.
// Telas largas: adesivos tortos nas laterais. Celular: um mural com rolagem lateral antes do rodapé.
(function () {
  const FIGURINHAS = [
    { img: "matue.jpg", legenda: "greatest musician alive" },
    { img: "honda-city.jpg", legenda: "o carro legal" },
    { img: "zaza.png", legenda: "zaza 🍃" },
    { img: "gnomo.jpg", legenda: "ele vai sair andando" },
    { img: "tabela.jpg", legenda: "gestão Gabão" },
    { img: "mangueira.jpg", legenda: "uma tabela e uma mangueira bastaram" },
    { img: "juquehy.jpg", legenda: "todos os caminhos levam a Juquehy" },
    { img: "onca.jpg", legenda: "amigo da onça = traíra judas" },
    { img: "juquehy-2.jpg", legenda: "400 metros (confia)" },
    { img: "juquehy-3.jpg", legenda: "a praia, depois da meia maratona" },
    { img: "juquehy-4.jpg", legenda: "vista do quarto legal (mentira)" },
    { img: "juquehy-5.jpg", legenda: "Juquehy 2027" },
    { img: "juquehy-6.jpg", legenda: "do lado do shopping, juro" },
    { img: "honda-city-2.jpg", legenda: "o carro legal" },
    { img: "honda-city-3.jpg", legenda: "carro legal, versão branca" },
    { img: "honda-city-4.jpg", legenda: "carro legal visto de trás" },
    { img: "zaza-2.jpg", legenda: "zaza 🍃" },
    { img: "zaza-3.jpg", legenda: "zaza (macro)" },
    { img: "zaza-4.jpg", legenda: "zaza, versão botânica" },
    { img: "matue-show.jpg", legenda: "only hard bars from tuezin" },
    { texto: "400 m = 0,4 km", sub: "engenharia porraaa" },
    { texto: "Aguardando mensagem…", sub: "essa ação pode levar alguns instantes" },
    { texto: "+300", sub: "plano C" },
    { texto: "casa golpe ✗", sub: "obrigado, Lilian" },
    { texto: "larper detectado", sub: "🚨" },
    { texto: "Calma🖐️", sub: "tá ansioso?" },
  ];

  // O homem (fotos enviadas pelo organizador)
  const MATEMAGICO = [
    "Him.", "the Mr. President", "the canibal", "What day were you born?", "a magician",
    "he's famous on tiktok", "the alibaba", "se inspire vendo o homem", "related to Ezra Miller",
    "que dia você nasceu?", "o homem",
  ].map((legenda, i) => ({ img: "mm-" + String(i).padStart(2, "0") + ".jpg", legenda, homem: true }));

  function embaralhar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function criar(f) {
    const el = document.createElement("figure");
    el.className = "figurinha" + (f.texto ? " figurinha-texto" : "");
    el.style.setProperty("--giro", (Math.random() * 16 - 8).toFixed(1) + "deg");
    if (f.homem) el.classList.add("figurinha-homem");
    if (f.img) {
      const img = document.createElement("img");
      img.src = "assets/img/fig/" + f.img;
      img.alt = f.legenda;
      img.loading = "lazy";
      el.appendChild(img);
      const cap = document.createElement("figcaption");
      cap.textContent = f.legenda;
      el.appendChild(cap);
    } else {
      const t = document.createElement("strong");
      t.textContent = f.texto;
      const s = document.createElement("span");
      s.textContent = f.sub;
      el.append(t, s);
    }
    el.addEventListener("click", () => {
      el.classList.remove("chacoalha");
      void el.offsetWidth; // reinicia a animação
      el.classList.add("chacoalha");
    });
    return el;
  }

  // Laterais: metade é o homem, metade são as outras piadas
  const homens = embaralhar(MATEMAGICO);
  const outras = embaralhar(FIGURINHAS);
  const sorteadas = [];
  for (let i = 0; i < Math.max(homens.length, outras.length); i++) {
    if (homens[i]) sorteadas.push(homens[i]);
    if (outras[i]) sorteadas.push(outras[i]);
  }

  // Laterais (só aparecem em telas largas, via CSS)
  const lados = document.createElement("div");
  lados.className = "figurinhas-laterais";
  lados.setAttribute("aria-hidden", "true");
  sorteadas.slice(0, 6).forEach((f, i) => {
    const el = criar(f);
    el.style.top = 90 + Math.floor(i / 2) * 230 + Math.random() * 40 + "px";
    // alterna o lado a cada linha, para o homem aparecer dos dois lados
    el.classList.add((i + Math.floor(i / 2)) % 2 ? "lado-direito" : "lado-esquerdo");
    lados.appendChild(el);
  });
  document.body.appendChild(lados);

  // ---------- Celular e telas estreitas (o CSS esconde isso nas telas largas) ----------
  // Só figurinhas com foto: as de texto ficam ilegíveis em tamanho pequeno.
  const comFoto = sorteadas.filter((f) => f.img);

  function mini(f, classe) {
    const el = criar(f);
    el.classList.add("figurinha-mini", classe);
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  // 2) Leque de 3 figurinhas no topo, logo abaixo do título
  const hero = document.querySelector("main .hero");
  if (hero) {
    const leque = document.createElement("div");
    leque.className = "leque-figurinhas";
    comFoto.slice(0, 3).forEach((f) => leque.appendChild(mini(f, "no-leque")));
    hero.appendChild(leque);
  }

  // 1) Uma figurinha colada no canto de cada card.
  // O painel da home é pulado porque o conteúdo dele é redesenhado pelo home.js.
  const cards = [...document.querySelectorAll("main > section.cartao")].filter((c) => c.id !== "painel");
  cards.forEach((card, i) => {
    const f = comFoto[(3 + i) % comFoto.length];
    card.classList.add("com-figurinha");
    const el = mini(f, "no-canto");
    el.style.setProperty("--giro", (i % 2 ? 9 : -7) + "deg");
    card.appendChild(el);
  });
})();
