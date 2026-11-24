// Pedido anônimo. Tudo é cifrado no celular antes de ir para o banco:
// - pedido: envelope para a chave de quem recebe (`para`) + cópia para a chave de quem pediu (`dono`);
// - resposta: envelope para uma "chave de resposta" que só quem pediu consegue recriar (cripto.js);
// - foto: redimensionada aqui (o que também apaga a localização do arquivo), cifrada e só então enviada.
// O site acha "o que é meu" tentando abrir cada envelope com a minha chave.
(async function () {
  const $ = (id) => document.getElementById(id);
  const MAX_FOTOS = 10;
  const LADO_MAX = 2560; // px: dá para imprimir em caneca/camiseta

  function el(tag, props = {}, ...filhos) {
    const e = Object.assign(document.createElement(tag), props);
    filhos.forEach((f) => e.append(f));
    return e;
  }
  const aviso = (alvo, classe, texto) => { alvo.className = classe; alvo.textContent = texto; };
  const quando = (iso) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  function fechar(texto) {
    $("fechado").classList.remove("oculto");
    if (texto) $("fechado-texto").textContent = texto;
  }

  let sorteio;
  try {
    sorteio = await Dados.sorteio();
  } catch (e) {
    return fechar("Não consegui carregar agora. Recarregue a página.");
  }
  if (!sorteio) return fechar();
  if (!(await Banco.configurado())) return fechar("Os pedidos abrem em breve. Calma🖐️");

  $("entrar").classList.remove("oculto");
  await Dados.preencherSelect($("nome"), "Escolha seu nome");
  try {
    const salvo = localStorage.getItem("onca:inscrito");
    if (salvo) $("nome").value = salvo;
  } catch (e) {}

  let eu = null; // { nome, par, tirou }

  $("form-entrar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("erro").classList.add("oculto");
    const nome = $("nome").value;
    if (!nome) return aviso($("erro"), "erro", "Escolha seu nome.");
    const entrada = sorteio.pessoas[nome];
    if (!entrada) return aviso($("erro"), "erro", "Você não entrou no sorteio. Fale com o organizador.");
    const botao = $("botao-entrar");
    botao.disabled = true;
    botao.textContent = "Aguardando mensagem…";
    try {
      const par = await Onca.derivarChaves(nome, $("senha").value);
      const tirou = Onca.b64(par.publicKey) === entrada.chave ? Onca.abrir(entrada.pessoa, par.secretKey) : null;
      if (!tirou) return aviso($("erro"), "erro", "Senha errada. Tá larpando?");
      $("senha").value = "";
      eu = { nome, par, tirou };
      $("entrar").classList.add("oculto");
      $("logado").classList.remove("oculto");
      prepararPedir();
      await carregar();
    } finally {
      botao.disabled = false;
      botao.textContent = "Entrar";
    }
  });

  $("botao-sair").addEventListener("click", () => location.reload());

  // ---------- Abas ----------
  document.querySelectorAll(".aba").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll(".aba").forEach((x) => x.setAttribute("aria-selected", x === b));
    document.querySelectorAll(".painel-aba").forEach((p) => p.classList.toggle("oculto", p.id !== "aba-" + b.dataset.aba));
  }));

  // ---------- Pedir ----------
  function prepararPedir() {
    const sel = $("pedir-para");
    sel.innerHTML = "";
    sel.append(el("option", { value: "", textContent: "Escolha a pessoa" }));
    Object.keys(sorteio.pessoas)
      .filter((n) => n !== eu.nome && n !== eu.tirou)
      .forEach((n) => sel.append(el("option", { value: n, textContent: n })));
  }

  $("form-pedir").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const saida = $("pedir-aviso");
    const para = $("pedir-para").value;
    const texto = $("pedir-texto").value.trim();
    if (!para) return aviso(saida, "erro", "Escolha pra quem pedir.");
    if (para === eu.nome || para === eu.tirou) return aviso(saida, "erro", "Pra essa pessoa não dá.");
    if (texto.length < 3) return aviso(saida, "erro", "Escreve o pedido aí.");

    const botao = $("pedir-enviar");
    botao.disabled = true;
    botao.textContent = "Lacrando…";
    try {
      const id = crypto.randomUUID();
      const resposta = await Onca.chaveResposta(id, eu.par.secretKey);
      await Banco.inserir("pedidos", {
        id,
        para: Onca.lacrar(JSON.stringify({ texto, resposta: Onca.b64(resposta.publicKey) }), Onca.deB64(sorteio.pessoas[para].chave)),
        dono: Onca.lacrar(JSON.stringify({ id, para, texto }), eu.par.publicKey),
      });
      $("pedir-texto").value = "";
      $("pedir-para").value = "";
      aviso(saida, "ok", `✅ Boa crack! Pedido lacrado pra ${para}. A resposta aparece em "Meus pedidos".`);
      await carregar();
    } catch (e) {
      aviso(saida, "erro", "Deu ruim no envio. Confere a internet e tenta de novo.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Mandar pedido";
    }
  });

  // ---------- Carregar e separar o que é meu ----------
  async function carregar() {
    const listaR = $("lista-recebidos"), listaM = $("lista-meus");
    listaR.textContent = listaM.textContent = "Aguardando mensagem. Essa ação pode levar alguns instantes.";
    let pedidos, respostas;
    try {
      [pedidos, respostas] = await Promise.all([
        Banco.listar("pedidos", "id,criado_em,para,dono"),
        Banco.listar("respostas", "id,pedido_id,criado_em,cifrado"),
      ]);
    } catch (e) {
      listaR.textContent = listaM.textContent = "Não consegui carregar agora. Tenta de novo daqui a pouco.";
      return;
    }

    const porPedido = new Map();
    respostas.forEach((r) => porPedido.set(r.pedido_id, [...(porPedido.get(r.pedido_id) || []), r]));

    const recebidos = [], meus = [];
    for (const p of pedidos) {
      const praMim = Onca.abrirJSON(p.para, eu.par.secretKey);
      if (praMim && typeof praMim.texto === "string" && praMim.resposta) recebidos.push({ ...p, conteudo: praMim });
      const meu = Onca.abrirJSON(p.dono, eu.par.secretKey);
      if (meu && meu.id === p.id) meus.push({ ...p, conteudo: meu });
    }

    $("num-recebidos").textContent = recebidos.length ? `(${recebidos.length})` : "";
    $("num-meus").textContent = meus.length ? `(${meus.length})` : "";

    listaR.innerHTML = "";
    if (!recebidos.length) listaR.textContent = "Ninguém te pediu nada ainda.";
    recebidos.reverse().forEach((p) => listaR.append(cartaoRecebido(p, (porPedido.get(p.id) || []).length)));

    listaM.innerHTML = "";
    if (!meus.length) listaM.textContent = "Você ainda não pediu nada.";
    for (const p of meus.reverse()) listaM.append(await cartaoMeu(p, porPedido.get(p.id) || []));
  }

  // ---------- Recebidos: ler e responder ----------
  function cartaoRecebido(p, jaRespondidas) {
    const texto = el("textarea", { maxLength: 1000, placeholder: "Mensagem (opcional se mandar foto)" });
    const fotos = el("input", { type: "file", accept: "image/*", multiple: true });
    const saida = el("p", { className: "oculto" });
    saida.setAttribute("role", "status");
    const barra = el("div", { className: "barra-cheia", style: "width:0%" });
    const progresso = el("div", { className: "barra oculto" }, barra);
    const botao = el("button", { className: "botao", type: "submit", textContent: "Responder" });
    const form = el("form", { className: "form-resposta", noValidate: true },
      el("label", { textContent: `Fotos (até ${MAX_FOTOS})` }), fotos,
      el("label", { textContent: "Mensagem" }), texto, progresso, saida,
      el("p", { style: "text-align:center;margin:12px 0 0" }, botao));
    const contador = el("p", { className: "vergonha-sub", textContent: jaRespondidas ? `Você já respondeu ${jaRespondidas}x.` : "" });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const arquivos = [...fotos.files];
      const msg = texto.value.trim();
      if (!arquivos.length && msg.length < 2) return aviso(saida, "erro", "Manda uma foto ou escreve alguma coisa.");
      if (arquivos.length > MAX_FOTOS) return aviso(saida, "erro", `No máximo ${MAX_FOTOS} fotos por resposta. Manda em mais de uma.`);
      botao.disabled = true;
      barra.style.width = "0%";
      progresso.classList.remove("oculto");
      try {
        const enviadas = [];
        for (const [i, arq] of arquivos.entries()) {
          aviso(saida, "aviso", `Preparando foto ${i + 1} de ${arquivos.length}…`);
          const cif = Onca.cifrarBytes(await prepararFoto(arq));
          const caminho = crypto.randomUUID() + ".bin";
          aviso(saida, "aviso", `Enviando foto ${i + 1} de ${arquivos.length}…`);
          await Banco.subirFoto(caminho, cif.dados, (f) => { barra.style.width = ((i + f) / arquivos.length) * 100 + "%"; });
          enviadas.push({ caminho, chave: cif.chave, nonce: cif.nonce });
        }
        await Banco.inserir("respostas", {
          pedido_id: p.id,
          cifrado: Onca.lacrar(JSON.stringify({ texto: msg, fotos: enviadas }), Onca.deB64(p.conteudo.resposta)),
        });
        barra.style.width = "100%";
        texto.value = "";
        fotos.value = "";
        aviso(saida, "ok", "✅ Boa crack! Resposta entregue. Só quem pediu vê.");
        contador.textContent = `Você já respondeu ${++jaRespondidas}x.`;
      } catch (e) {
        aviso(saida, "erro", e.message === "formato"
          ? "Não consegui abrir uma das fotos. Tenta mandar como JPG/PNG (print ou foto da galeria)."
          : "Deu ruim no envio. Confere a internet e tenta de novo.");
      } finally {
        botao.disabled = false;
        setTimeout(() => progresso.classList.add("oculto"), 1500);
      }
    });

    return el("article", { className: "pedido" },
      el("p", { className: "recado-topo" }, el("strong", { textContent: "Alguém pediu" }), el("span", { textContent: quando(p.criado_em) })),
      el("p", { className: "pedido-texto", textContent: p.conteudo.texto }),
      contador, form);
  }

  // Redimensiona para no máximo LADO_MAX e regrava em JPEG (sem EXIF/localização).
  async function prepararFoto(arquivo) {
    let img;
    try {
      img = await createImageBitmap(arquivo);
    } catch (e) {
      img = await new Promise((ok, falha) => {
        const i = new Image();
        i.onload = () => ok(i);
        i.onerror = () => falha(new Error("formato"));
        i.src = URL.createObjectURL(arquivo);
      });
    }
    const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
    const canvas = el("canvas", { width: Math.round(img.width * escala), height: Math.round(img.height * escala) });
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.9));
    if (!blob) throw new Error("formato");
    return new Uint8Array(await blob.arrayBuffer());
  }

  // ---------- Meus pedidos: ver respostas ----------
  async function cartaoMeu(p, respostas) {
    const card = el("article", { className: "pedido" },
      el("p", { className: "recado-topo" }, el("strong", { textContent: "Pra " + p.conteudo.para }), el("span", { textContent: quando(p.criado_em) })),
      el("p", { className: "pedido-texto", textContent: p.conteudo.texto }));
    const chave = await Onca.chaveResposta(p.id, eu.par.secretKey);
    let n = 0, abertas = 0;
    for (const r of respostas) {
      const c = Onca.abrirJSON(r.cifrado, chave.secretKey);
      if (!c) continue; // lixo, ou resposta que não é para esta chave
      abertas++;
      const bloco = el("div", { className: "resposta" },
        el("p", { className: "recado-topo" }, el("strong", { textContent: "Resposta" }), el("span", { textContent: quando(r.criado_em) })));
      if (c.texto) bloco.append(el("p", { className: "pedido-texto", textContent: c.texto }));
      if (Array.isArray(c.fotos) && c.fotos.length) {
        const grade = el("div", { className: "grade-fotos" });
        c.fotos.forEach((f) => grade.append(fotoDecifrada(f, ++n)));
        bloco.append(grade);
      }
      card.append(bloco);
    }
    if (!abertas) card.append(el("p", { className: "vergonha-sub", textContent: "Sem resposta ainda. Cobra no grupo (sem se entregar)." }));
    return card;
  }

  function fotoDecifrada(f, n) {
    const caixa = el("div", { className: "foto", textContent: "⏳" });
    Banco.baixarFoto(f.caminho).then((dados) => {
      const bytes = Onca.decifrarBytes(dados, f.chave, f.nonce);
      if (!bytes) throw new Error("decifrar");
      const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      caixa.textContent = "";
      caixa.append(
        el("a", { href: url, target: "_blank", rel: "noopener" }, el("img", { src: url, alt: "Foto " + n })),
        el("a", { className: "botao botao-mar baixar", href: url, download: `onca-${n}.jpg`, textContent: "Baixar" }));
    }).catch(() => { caixa.textContent = "❌ não abriu"; });
    return caixa;
  }
})();
