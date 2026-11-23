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
    prepararTeste();
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
    botao.textContent = "Aguardando mensagem. Essa ação pode levar alguns instantes.";
    try {
      const par = await Onca.derivarChaves(nome, senha);
      const tirou = Onca.b64(par.publicKey) === entrada.chave ? Onca.abrir(entrada.pessoa, par.secretKey) : null;
      if (!tirou) {
        return mostrarErro("Senha errada. Tá larpando? (Wrong password.) Se você refez a inscrição depois do sorteio, peça para o organizador liberar a senha nova.");
      }

      $("senha").value = "";
      $("entrar").classList.add("oculto");
      $("nome-sorteado").textContent = tirou;
      $("resultado").classList.remove("oculto");

      $("nome-sugestoes").textContent = tirou;
      const lista = $("lista-sugestoes");
      lista.innerHTML = "<li>Aguardando mensagem. Essa ação pode levar alguns instantes.</li>";
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

  // Antes do sorteio: confere se a senha digitada gera a mesma chave que está na planilha.
  async function prepararTeste() {
    $("testar").classList.remove("oculto");
    await Dados.preencherSelect($("teste-nome"), "Escolha seu nome");
    try { // celular que já se inscreveu: deixa o nome escolhido
      const salvo = localStorage.getItem("onca:inscrito");
      if (salvo) $("teste-nome").value = salvo;
    } catch (e) {}

    const resultado = $("teste-resultado");
    const mostrar = (classe, texto) => { resultado.className = classe; resultado.textContent = texto; };

    $("form-testar").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const nome = $("teste-nome").value;
      if (!nome) return mostrar("erro", "Escolha seu nome.");
      const botao = $("botao-testar");
      botao.disabled = true;
      botao.textContent = "Aguardando mensagem…";
      try {
        const [chaves, par] = await Promise.all([Dados.chavesInscritas(), Onca.derivarChaves(nome, $("teste-senha").value)]);
        const registrada = chaves.get(nome);
        if (!registrada) {
          mostrar("erro", "Não achei sua inscrição. Se você acabou de se inscrever, espere uns 5 minutos e teste de novo.");
        } else if (registrada === Onca.b64(par.publicKey)) {
          mostrar("ok", `✅ Tá inscrito e a senha bate, ${nome}. Boa crack!`);
        } else {
          mostrar("erro", "❌ Essa senha não bate com a sua inscrição. Esqueceu? Faz a inscrição de novo com uma senha nova (antes do sorteio é de boa).");
        }
      } catch (e) {
        mostrar("erro", "Não consegui conferir agora. Tenta de novo daqui a pouco.");
      } finally {
        botao.disabled = false;
        botao.textContent = "Testar";
      }
    });
  }
})();
