-- ============================================================
-- supabase/migrations/003_audit_triggers.sql
-- Trigger otomatis catat INSERT/UPDATE/DELETE ke audit_logs
-- Jalankan SETELAH 001_schema.sql
-- ============================================================

-- ─── TRIGGER FUNCTION ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO audit_logs (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    user_id,
    created_at
  ) VALUES (
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    TG_OP,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    auth.uid(),
    NOW()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ─── TRIGGER: expenses ────────────────────────────────────────
CREATE TRIGGER trg_audit_expenses
AFTER INSERT OR UPDATE OR DELETE ON expenses
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ─── TRIGGER: employees ───────────────────────────────────────
CREATE TRIGGER trg_audit_employees
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();

-- ─── TRIGGER: inventory_items ─────────────────────────────────
CREATE TRIGGER trg_audit_inventory
AFTER INSERT OR UPDATE OR DELETE ON inventory_items
FOR EACH ROW EXECUTE FUNCTION fn_audit_log();
