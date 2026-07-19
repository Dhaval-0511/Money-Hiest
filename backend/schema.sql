-- ============================================================
-- Personal Expense & Goals Tracker — PostgreSQL Schema
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(120),
    default_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- MONTH BUDGETS ----------
CREATE TABLE IF NOT EXISTS month_budgets (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    month                   DATE NOT NULL, -- always stored as first-of-month
    salary                  NUMERIC(12,2) NOT NULL DEFAULT 0,
    parental_travel_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
    parental_bill_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
    other_income            NUMERIC(12,2) NOT NULL DEFAULT 0,
    template_type           VARCHAR(20) NOT NULL DEFAULT 'Option1',
    pct_expenses            NUMERIC(5,2) NOT NULL DEFAULT 75,
    pct_investments         NUMERIC(5,2) NOT NULL DEFAULT 15,
    pct_upskilling          NUMERIC(5,2) NOT NULL DEFAULT 5,
    pct_lifestyle           NUMERIC(5,2) NOT NULL DEFAULT 5,
    planned_bills           NUMERIC(12,2) NOT NULL DEFAULT 0,
    planned_shopping        NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, month)
);

-- ---------- CATEGORIES ----------
CREATE TABLE IF NOT EXISTS categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    month_budget_id UUID NOT NULL REFERENCES month_budgets(id) ON DELETE CASCADE,
    head_type       VARCHAR(20) NOT NULL CHECK (head_type IN
                        ('Expenses','Bills','Shopping','Investments','Upskilling','Lifestyle')),
    name            VARCHAR(120) NOT NULL,
    planned_amount  NUMERIC(12,2) DEFAULT 0,
    actual_amount   NUMERIC(12,2) NOT NULL DEFAULT 0, -- denormalized, kept in sync by trigger
    is_recurring_bill BOOLEAN NOT NULL DEFAULT false,
    due_date        DATE,
    is_custom       BOOLEAN NOT NULL DEFAULT false,
    is_hidden       BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_categories_budget ON categories(month_budget_id);

-- ---------- TRANSACTIONS ----------
CREATE TABLE IF NOT EXISTS transactions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id     UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- denormalized for fast filtering
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(10) NOT NULL CHECK (payment_method IN ('Cash','Online')),
    funding_source  VARCHAR(20) NOT NULL DEFAULT 'Personal'
                        CHECK (funding_source IN ('Personal','TravelAllowance','BillAllowance')),
    txn_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    note            TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, txn_date);

-- ---------- GOALS ----------
CREATE TABLE IF NOT EXISTS goals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(120) NOT NULL,
    target_amount   NUMERIC(12,2) NOT NULL CHECK (target_amount > 0),
    current_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
    deadline        DATE,
    status          VARCHAR(12) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Completed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- GOAL CONTRIBUTIONS ----------
CREATE TABLE IF NOT EXISTS goal_contributions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id         UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method  VARCHAR(10) NOT NULL CHECK (payment_method IN ('Cash','Online')),
    contributed_on  DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGERS: keep category.actual_amount and goal.current_amount in sync
-- ============================================================

CREATE OR REPLACE FUNCTION recalc_category_actual() RETURNS TRIGGER AS $$
DECLARE
    target_cat UUID;
BEGIN
    target_cat := COALESCE(NEW.category_id, OLD.category_id);
    UPDATE categories
       SET actual_amount = (
            SELECT COALESCE(SUM(amount),0) FROM transactions WHERE category_id = target_cat
       )
     WHERE id = target_cat;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_txn_recalc ON transactions;
CREATE TRIGGER trg_txn_recalc
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION recalc_category_actual();

CREATE OR REPLACE FUNCTION recalc_goal_amount() RETURNS TRIGGER AS $$
DECLARE
    target_goal UUID;
BEGIN
    target_goal := COALESCE(NEW.goal_id, OLD.goal_id);
    UPDATE goals
       SET current_amount = (
            SELECT COALESCE(SUM(amount),0) FROM goal_contributions WHERE goal_id = target_goal
           ),
           status = CASE WHEN (
                SELECT COALESCE(SUM(amount),0) FROM goal_contributions WHERE goal_id = target_goal
            ) >= target_amount THEN 'Completed' ELSE status END,
           updated_at = now()
     WHERE id = target_goal;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_goal_recalc ON goal_contributions;
CREATE TRIGGER trg_goal_recalc
AFTER INSERT OR UPDATE OR DELETE ON goal_contributions
FOR EACH ROW EXECUTE FUNCTION recalc_goal_amount();
