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

  // Mural (celular e telas estreitas)
  const mural = document.createElement("section");
  mural.className = "mural-figurinhas";
  mural.setAttribute("aria-label", "Figurinhas");
  sorteadas.forEach((f) => mural.appendChild(criar(f)));
  const main = document.querySelector("main");
  if (main) main.appendChild(mural);
})();
