-- Add submission date for expense request date tracking.
alter table public.expenses
add column if not exists submission_date date not null default current_date;

-- Optional index to keep list sorting/filtering responsive as data grows.
create index if not exists idx_expenses_submission_date
  on public.expenses (submission_date desc);
