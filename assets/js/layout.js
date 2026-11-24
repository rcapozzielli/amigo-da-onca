// Cabeçalho e rodapé compartilhados por todas as páginas.
(function () {
  const paginas = [
    { href: "index.html", texto: "Início" },
    { href: "descobrir.html", texto: "Descobrir" },
    { href: "mural.html", texto: "Mural" },
    { href: "pedidos.html", texto: "Pedidos" },
    { href: "sugerir.html", texto: "Sugerir" },
    { href: "ideias.html", texto: "Ideias" },
    { href: "regras.html", texto: "Regras" },
  ];

  const atual = location.pathname.split("/").pop() || "index.html";

  const menu = paginas
    .map((p) => `<a href="${p.href}"${p.href === atual ? ' aria-current="page"' : ""}>${p.texto}</a>`)
    .join("");

  document.body.insertAdjacentHTML(
    "afterbegin",
    `<header class="topo"><div class="topo-inner">
       <a class="logo" href="index.html">🐆 Amigo da Onça</a>
       <nav class="menu" aria-label="Menu">${menu}</nav>
     </div></header>`
  );

  document.body.insertAdjacentHTML(
    "beforeend",
    `<footer class="rodape">Réveillon Juquehy 2027 · vibecodado no Claude por um larper · <a href="creditos.html">créditos das imagens</a></footer>`
  );
})();
