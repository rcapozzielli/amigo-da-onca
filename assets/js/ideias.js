// Carrega data/ideias.json, mostra o catálogo e sorteia uma ideia aleatória.
(async function () {
  const lista = document.getElementById("lista-ideias");
  const saida = document.getElementById("ideia-sorteada");
  const botao = document.getElementById("botao-ideia");

  let ideias = [];
  try {
    const resp = await fetch("data/ideias.json", { cache: "no-cache" });
    ideias = await resp.json();
  } catch (e) {
    lista.innerHTML = "<li>Não consegui carregar as ideias. Tente recarregar a página.</li>";
    return;
  }

  lista.innerHTML = "";
  ideias.forEach((texto) => {
    const li = document.createElement("li");
    li.textContent = texto;
    lista.appendChild(li);
  });

  let ultima = -1;
  botao.addEventListener("click", () => {
    if (ideias.length === 0) return;
    let i;
    do { i = Math.floor(Math.random() * ideias.length); } while (i === ultima && ideias.length > 1);
    ultima = i;
    saida.textContent = ideias[i];
  });
})();
