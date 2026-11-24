// Acesso ao Supabase (só o "Pedido anônimo" usa). Tudo que passa por aqui já está cifrado.
// A chave em data/config.json é a pública (anon/publishable): ela só lê e insere, as regras do banco
// (supabase/esquema.sql) proíbem editar ou apagar.
(function () {
  async function cfg() {
    const c = (await Dados.config()).supabase || {};
    if (!c.url || !c.chavePublica) throw new Error("sem-config");
    return c;
  }

  function cabecalhos(c, extra = {}) {
    const h = { apikey: c.chavePublica, ...extra };
    if (c.chavePublica.startsWith("eyJ")) h.Authorization = "Bearer " + c.chavePublica; // chave antiga (JWT)
    return h;
  }

  async function listar(tabela, colunas) {
    const c = await cfg();
    const r = await fetch(`${c.url}/rest/v1/${tabela}?select=${colunas}&order=criado_em.asc`, { headers: cabecalhos(c) });
    if (!r.ok) throw new Error(`${tabela}: ${r.status}`);
    return r.json();
  }

  async function inserir(tabela, linha) {
    const c = await cfg();
    const r = await fetch(`${c.url}/rest/v1/${tabela}`, {
      method: "POST",
      headers: cabecalhos(c, { "Content-Type": "application/json", Prefer: "return=minimal" }),
      body: JSON.stringify(linha),
    });
    if (!r.ok) throw new Error(`${tabela}: ${r.status} ${await r.text()}`);
  }

  // Sobe bytes (já cifrados) e chama aoProgredir(0..1) durante o envio.
  async function subirFoto(caminho, bytes, aoProgredir = () => {}) {
    const c = await cfg();
    return new Promise((ok, falha) => {
      const x = new XMLHttpRequest(); // fetch não informa progresso de upload
      x.open("POST", `${c.url}/storage/v1/object/fotos/${caminho}`);
      Object.entries(cabecalhos(c, { "Content-Type": "application/octet-stream", "x-upsert": "false" }))
        .forEach(([k, v]) => x.setRequestHeader(k, v));
      x.upload.onprogress = (e) => e.lengthComputable && aoProgredir(e.loaded / e.total);
      x.onload = () => (x.status < 300 ? ok() : falha(new Error("foto: " + x.status + " " + x.responseText)));
      x.onerror = () => falha(new Error("foto: rede"));
      x.send(new Blob([bytes]));
    });
  }

  async function baixarFoto(caminho) {
    const c = await cfg();
    const r = await fetch(`${c.url}/storage/v1/object/public/fotos/${caminho}`);
    if (!r.ok) throw new Error("foto: " + r.status);
    return new Uint8Array(await r.arrayBuffer());
  }

  window.Banco = { listar, inserir, subirFoto, baixarFoto, configurado: () => cfg().then(() => true, () => false) };
})();
