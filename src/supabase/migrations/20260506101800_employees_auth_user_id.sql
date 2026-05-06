alter table public.employees
  add column if not exists auth_user_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'employees_auth_user_id_fkey'
  ) then
    alter table public.employees
      add constraint employees_auth_user_id_fkey
      foreign key (auth_user_id)
      references auth.users(id)
      on delete set null;
  end if;
end $$;

create unique index if not exists employees_auth_user_id_unique_idx
  on public.employees (auth_user_id)
  where auth_user_id is not null;
