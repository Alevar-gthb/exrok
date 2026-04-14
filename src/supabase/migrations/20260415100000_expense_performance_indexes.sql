-- Improve common expense and approval query paths.
create index if not exists idx_expenses_status_transaction_date
  on public.expenses (status, transaction_date desc);

create index if not exists idx_expenses_project_transaction_date
  on public.expenses (project_id, transaction_date desc);

create index if not exists idx_expenses_employee_type_status
  on public.expenses (employee_id, type, status);

create index if not exists idx_expense_approvals_expense_created_at
  on public.expense_approvals (expense_id, created_at);
