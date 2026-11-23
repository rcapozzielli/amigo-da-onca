// Contagem regressiva: preenche todo elemento com data-contador="dataViagem" (ou outra chave do CONFIG).
(function () {
  const alvos = document.querySelectorAll("[data-contador]");

  function formatar(ms) {
    const s = Math.floor(ms / 1000);
    return {
      dias: Math.floor(s / 86400),
      horas: Math.floor((s % 86400) / 3600),
      min: Math.floor((s % 3600) / 60),
      seg: s % 60,
    };
  }

  function atualizar() {
    alvos.forEach((el) => {
      const alvo = new Date(window.CONFIG[el.dataset.contador]).getTime();
      const falta = alvo - Date.now();
      if (falta <= 0) {
        if (el.dataset.formato === "linha") { el.textContent = el.dataset.fim || "Chegou! 🎉"; return; }
        el.innerHTML = `<p class="contador-fim">${el.dataset.fim || "Chegou! 🎉"}</p>`;
        return;
      }
      const t = formatar(falta);
      if (el.dataset.formato === "linha") {
        el.textContent = `${el.dataset.prefixo || "Faltam"} ${t.dias}d ${t.horas}h ${t.min}min ${t.seg}s`;
        return;
      }
      el.innerHTML = `
        <div><strong>${t.dias}</strong><span>dias</span></div>
        <div><strong>${t.horas}</strong><span>horas</span></div>
        <div><strong>${t.min}</strong><span>min</span></div>
        <div><strong>${t.seg}</strong><span>seg</span></div>`;
    });
  }

  atualizar();
  setInterval(atualizar, 1000);
})();
