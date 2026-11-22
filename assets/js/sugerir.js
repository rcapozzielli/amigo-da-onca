// Sugestão anônima de presente para um participante.
(async function () {
  const form = document.getElementById("form-sugestao");
  const selPara = document.getElementById("para");
  const texto = document.getElementById("texto");
  const botao = document.getElementById("botao-enviar");
  const erro = document.getElementById("erro");
  const sucesso = document.getElementById("sucesso");

  const mostrarErro = (msg) => { erro.textContent = msg; erro.classList.remove("oculto"); };

  await Dados.preencherSelect(selPara, "Escolha a vítima");

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.classList.add("oculto");
    sucesso.classList.add("oculto");

    const cfg = (await Dados.config()).sugestoes;
    if (!cfg.formAction) return mostrarErro("As sugestões ainda não abriram. Aguarde o organizador.");
    if (!selPara.value) return mostrarErro("Escolha para quem é a sugestão.");
    if (texto.value.trim().length < 3) return mostrarErro("Escreve a ideia aí, vai.");

    botao.disabled = true;
    try {
      await Dados.enviarForm(cfg.formAction, {
        [cfg.campoPara]: selPara.value,
        [cfg.campoTexto]: texto.value.trim(),
      });
      texto.value = "";
      sucesso.classList.remove("oculto");
    } catch (e) {
      mostrarErro("Deu ruim no envio. Confira a internet e tente de novo.");
    } finally {
      botao.disabled = false;
    }
  });
})();
