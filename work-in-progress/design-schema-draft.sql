-- DRAFT ONLY. Not deployed or security-reviewed; do not run against production.
-- Proposed isolation for shared designs. Does not modify existing storefront tables.
begin;
create schema clutch_app_private;
revoke all on schema clutch_app_private from public;
grant usage on schema clutch_app_private to authenticated;

-- Bootstrap accounts separately using verified auth.users UUIDs, never public signup.
create table clutch_app_private.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  active boolean not null default true
);
revoke all on clutch_app_private.members from public, anon, authenticated;

create function clutch_app_private.member_role() returns text
language sql stable security definer set search_path = pg_catalog
as $$ select role from clutch_app_private.members where user_id = auth.uid() and active $$;
revoke all on function clutch_app_private.member_role() from public;
grant execute on function clutch_app_private.member_role() to authenticated;

create table public.clutch_app_designs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 150),
  garment text not null check (garment in ('hoodie','tee','shorts')),
  canvas jsonb not null default '{}'::jsonb,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.clutch_app_design_revisions (
  revision_id bigint generated always as identity primary key,
  design_id uuid not null references public.clutch_app_designs(id) on delete cascade,
  snapshot jsonb not null,
  edited_by uuid not null references auth.users(id),
  edited_at timestamptz not null default now()
);
revoke all on public.clutch_app_designs, public.clutch_app_design_revisions from public, anon, authenticated;
grant select, insert, update, delete on public.clutch_app_designs to authenticated;
grant select on public.clutch_app_design_revisions to authenticated;
alter table public.clutch_app_designs enable row level security;
alter table public.clutch_app_design_revisions enable row level security;
create policy designs_select on public.clutch_app_designs for select to authenticated using (clutch_app_private.member_role() in ('owner','staff'));
create policy designs_insert on public.clutch_app_designs for insert to authenticated with check (clutch_app_private.member_role() in ('owner','staff') and created_by = auth.uid() and updated_by = auth.uid());
create policy designs_update on public.clutch_app_designs for update to authenticated using (clutch_app_private.member_role() in ('owner','staff')) with check (clutch_app_private.member_role() in ('owner','staff') and updated_by = auth.uid());
create policy designs_delete on public.clutch_app_designs for delete to authenticated using (clutch_app_private.member_role() = 'owner');
create policy revisions_select on public.clutch_app_design_revisions for select to authenticated using (clutch_app_private.member_role() in ('owner','staff'));

create function clutch_app_private.prepare_design() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid(); new.created_at := now();
  else
    new.id := old.id; new.created_by := old.created_by; new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid(); new.updated_at := now();
  return new;
end $$;
create trigger prepare_design before insert or update on public.clutch_app_designs for each row execute function clutch_app_private.prepare_design();

create function clutch_app_private.save_revision() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  insert into public.clutch_app_design_revisions (design_id, snapshot, edited_by)
  values (new.id, to_jsonb(new), new.updated_by);
  return new;
end $$;
revoke all on function clutch_app_private.save_revision() from public;
create trigger save_revision after insert or update on public.clutch_app_designs for each row execute function clutch_app_private.save_revision();
commit;
-- Before deployment: independent review, test with all roles, test conflict handling,
-- seed verified memberships, and connect the UI. Existing table policies remain unchanged.
