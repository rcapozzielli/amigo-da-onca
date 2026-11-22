// Inscrição: deriva a chave da senha no próprio celular e envia só a chave pública.
(async function () {
  const form = document.getElementById("form-cadastro");
  const selNome = document.getElementById("nome");
  const senha = document.getElementById("senha");
  const senha2 = document.getElementById("senha2");
  const botao = document.getElementById("botao-enviar");
  const erro = document.getElementById("erro");
  const jaInscrito = document.getElementById("ja-inscrito");
  const confirma = document.getElementById("confirma-reinscricao");

  const mostrarErro = (msg) => { erro.textContent = msg; erro.classList.remove("oculto"); };

  await Dados.preencherSelect(selNome, "Escolha seu nome");
  Dados.mostrarProgresso(document.getElementById("progresso"));

  if (await Dados.sorteio().catch(() => null)) {
    document.getElementById("aviso-sorteado").classList.remove("oculto");
  }

  let inscritos = new Set();
  Dados.inscritos().then((s) => (inscritos = s)).catch(() => {});

  selNome.addEventListener("change", () => {
    confirma.checked = false;
    jaInscrito.classList.toggle("oculto", !inscritos.has(selNome.value));
  });

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    erro.classList.add("oculto");

    const cfg = (await Dados.config()).cadastro;
    if (!cfg.formAction) return mostrarErro("As inscrições ainda não abriram. Aguarde o organizador.");
    if (!selNome.value) return mostrarErro("Escolha seu nome.");
    if (senha.value.length < 6) return mostrarErro("A senha precisa ter pelo menos 6 caracteres.");
    if (senha.value !== senha2.value) return mostrarErro("As duas senhas não são iguais.");
    if (inscritos.has(selNome.value) && !confirma.checked) {
      return mostrarErro("Você já está inscrito. Marque a caixinha se quiser trocar a senha.");
    }

    botao.disabled = true;
    botao.textContent = "Fabricando seu cadeado… 🔐";
    try {
      const par = await Onca.derivarChaves(selNome.value, senha.value);
      await Dados.enviarForm(cfg.formAction, {
        [cfg.campoNome]: selNome.value,
        [cfg.campoChave]: Onca.b64(par.publicKey),
      });
      form.classList.add("oculto");
      document.getElementById("nome-ok").textContent = selNome.value;
      document.getElementById("sucesso").classList.remove("oculto");
    } catch (e) {
      mostrarErro("Deu ruim no envio. Confira a internet e tente de novo.");
      botao.disabled = false;
      botao.textContent = "Me inscrever";
    }
  });
})();
