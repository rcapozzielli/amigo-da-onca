// Revelação: a senha vira chave no celular e abre o envelope do sorteio. Nada é enviado para lugar nenhum.
(async function () {
  const $ = (id) => document.getElementById(id);
  const mostrarErro = (msg) => { $("erro").textContent = msg; $("erro").classList.remove("oculto"); };

  let sorteio;
  try {
    sorteio = await Dados.sorteio();
  } catch (e) {
    $("entrar").classList.remove("oculto");
    return mostrarErro("Não consegui carregar o sorteio. Recarregue a página.");
  }

  if (!sorteio) {
    $("nao-liberado").classList.remove("oculto");
    Dados.mostrarProgresso($("progresso"));
    return;
  }

  $("entrar").classList.remove("oculto");
  await Dados.preencherSelect($("nome"), "Escolha seu nome");

  $("form-entrar").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    $("erro").classList.add("oculto");

    const nome = $("nome").value;
    const senha = $("senha").value;
    if (!nome) return mostrarErro("Escolha seu nome.");
    const entrada = sorteio.pessoas[nome];
    if (!entrada) return mostrarErro("Você não entrou neste sorteio. Fale com o organizador.");

    const botao = $("botao-entrar");
    botao.disabled = true;
    botao.textContent = "Abrindo o envelope… 🥁";
    try {
      const par = await Onca.derivarChaves(nome, senha);
      const tirou = Onca.b64(par.publicKey) === entrada.chave ? Onca.abrir(entrada.pessoa, par.secretKey) : null;
      if (!tirou) {
        return mostrarErro("Senha errada. Se você refez a inscrição depois do sorteio, peça para o organizador liberar a senha nova.");
      }

      $("senha").value = "";
      $("entrar").classList.add("oculto");
      $("nome-sorteado").textContent = tirou;
      $("resultado").classList.remove("oculto");

      $("nome-sugestoes").textContent = tirou;
      const lista = $("lista-sugestoes");
      lista.innerHTML = "<li>Carregando…</li>";
      $("bloco-sugestoes").classList.remove("oculto");
      try {
        const sugestoes = await Dados.sugestoesPara(tirou);
        lista.innerHTML = "";
        if (!sugestoes.length) lista.innerHTML = "<li>Ninguém sugeriu nada ainda. Você está por conta própria. 😈</li>";
        sugestoes.forEach((s) => {
          const li = document.createElement("li");
          li.textContent = s;
          lista.appendChild(li);
        });
      } catch (e) {
        lista.innerHTML = "<li>Não consegui carregar as sugestões agora.</li>";
      }
    } finally {
      botao.disabled = false;
      botao.textContent = "Revelar 🥁";
    }
  });

  $("botao-esconder").addEventListener("click", () => {
    $("resultado").classList.add("oculto");
    $("bloco-sugestoes").classList.add("oculto");
    $("nome-sorteado").textContent = "";
    $("entrar").classList.remove("oculto");
  });
})();
