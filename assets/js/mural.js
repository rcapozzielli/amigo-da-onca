// Mural de mensagens: só inscritos postam (nome + senha conferidos no celular), e todo mundo lê.
// Também exporta Mural.cartao, usado na prévia da home.
(function () {
  function quando(data) {
    if (!data) return "";
    const min = Math.floor((Date.now() - data.getTime()) / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    if (min < 1440) return `há ${Math.floor(min / 60)} h`;
    return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function cartao(m) {
    const card = document.createElement("article");
    card.className = "recado";
    card.style.setProperty("--giro", (Math.random() * 3 - 1.5).toFixed(1) + "deg");
    const topo = document.createElement("p");
    topo.className = "recado-topo";
    const nome = document.createElement("strong");
    nome.textContent = m.nome;
    const hora = document.createElement("span");
    hora.textContent = quando(m.data);
    topo.append(nome, hora);
    const texto = document.createElement("p");
    texto.className = "recado-texto";
    texto.textContent = m.texto;
    card.append(topo, texto);
    return card;
  }

  window.Mural = { cartao };

  // ---------- Página mural.html ----------
  const form = document.getElementById("form-mural");
  if (!form) return;
  const $ = (id) => document.getElementById(id);
  const aviso = (classe, texto) => { $("mural-aviso").className = classe; $("mural-aviso").textContent = texto; };

  async function carregar() {
    const lista = $("lista-mural");
    try {
      const msgs = await Dados.mensagensMural();
      lista.innerHTML = "";
      if (!msgs.length) lista.textContent = "Ninguém escreveu nada ainda. Seja o primeiro larper.";
      msgs.forEach((m) => lista.append(cartao(m)));
    } catch (e) {
      lista.textContent = e.message === "sem-config" ? "O mural abre em breve. Calma🖐️" : "Não consegui carregar o mural agora.";
    }
  }

  (async function () {
    await Dados.preencherSelect($("mural-nome"), "Escolha seu nome");
    try {
      const salvo = localStorage.getItem("onca:inscrito");
      if (salvo) $("mural-nome").value = salvo;
    } catch (e) {}
    carregar();
  })();

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const cfg = (await Dados.config()).mural || {};
    const nome = $("mural-nome").value;
    const texto = $("mural-texto").value.trim();
    if (!cfg.formAction) return aviso("erro", "O mural ainda não abriu.");
    if (!nome) return aviso("erro", "Escolha seu nome.");
    if (texto.length < 2) return aviso("erro", "Escreve alguma coisa aí.");

    const botao = $("mural-enviar");
    botao.disabled = true;
    botao.textContent = "Aguardando mensagem…";
    try {
      const r = await Dados.conferirSenha(nome, $("mural-senha").value);
      if (r === "sem-inscricao") return aviso("erro", "Só quem tá inscrito pode postar. Se acabou de se inscrever, espera uns 5 min.");
      if (r === "senha") return aviso("erro", "Senha errada. Tá larpando?");
      await Dados.enviarForm(cfg.formAction, { [cfg.campoNome]: nome, [cfg.campoMensagem]: texto });
      $("mural-texto").value = "";
      $("mural-senha").value = "";
      aviso("ok", "✅ Boa crack! Sua mensagem aparece no mural em alguns minutos.");
      $("lista-mural").prepend(cartao({ nome, texto, data: new Date() })); // mostra já, antes da planilha atualizar
    } catch (e) {
      aviso("erro", "Deu ruim no envio. Confere a internet e tenta de novo.");
    } finally {
      botao.disabled = false;
      botao.textContent = "Postar";
    }
  });
})();
