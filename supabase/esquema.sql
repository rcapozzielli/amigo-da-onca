-- Banco do "Pedido anônimo". Rode UMA vez no SQL Editor do Supabase.
--
-- Tudo o que entra aqui chega CIFRADO do celular: nem quem administra o projeto lê texto ou vê foto.
-- O site usa só a chave pública (anon/publishable). Ela pode ler e inserir, mas nunca editar ou apagar.

-- Pedidos: `para` é o envelope para quem recebe; `dono` é o envelope para quem pediu (cópia do pedido).
create table if not exists public.pedidos (
  id        uuid primary key,
  criado_em timestamptz not null default now(),
  para      jsonb not null check (pg_column_size(para) < 8000),
  dono      jsonb not null check (pg_column_size(dono) < 8000)
);

-- Respostas: envelope para a chave de resposta do pedido (texto + chaves das fotos).
create table if not exists public.respostas (
  id        uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id),
  criado_em timestamptz not null default now(),
  cifrado   jsonb not null check (pg_column_size(cifrado) < 30000)
);

alter table public.pedidos   enable row level security;
alter table public.respostas enable row level security;

-- Permissões do site: ler e inserir. Sem update e sem delete.
revoke all on public.pedidos, public.respostas from anon, authenticated;
grant select, insert on public.pedidos, public.respostas to anon;

drop policy if exists "site le pedidos" on public.pedidos;
drop policy if exists "site cria pedidos" on public.pedidos;
drop policy if exists "site le respostas" on public.respostas;
drop policy if exists "site cria respostas" on public.respostas;
create policy "site le pedidos"     on public.pedidos   for select to anon using (true);
create policy "site cria pedidos"   on public.pedidos   for insert to anon with check (true);
create policy "site le respostas"   on public.respostas for select to anon using (true);
create policy "site cria respostas" on public.respostas for insert to anon with check (true);

-- Fotos: bucket público, mas cada arquivo é um blob cifrado (sem a chave, é ruído).
-- Limite de 15 MB por arquivo e só aceita o tipo "application/octet-stream" (o blob cifrado).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 15728640, array['application/octet-stream'])
on conflict (id) do update
  set public = true, file_size_limit = 15728640, allowed_mime_types = array['application/octet-stream'];

drop policy if exists "site sobe fotos" on storage.objects;
create policy "site sobe fotos" on storage.objects for insert to anon with check (bucket_id = 'fotos');
