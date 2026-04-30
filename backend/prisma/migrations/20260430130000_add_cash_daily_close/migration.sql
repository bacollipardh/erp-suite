CREATE TYPE "cash_daily_close_status" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

CREATE TABLE "cash_daily_closes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "finance_account_id" UUID NOT NULL,
    "business_date" DATE NOT NULL,
    "status" "cash_daily_close_status" NOT NULL DEFAULT 'OPEN',
    "opening_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_in" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "total_out" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "expected_closing_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "counted_cash_amount" DECIMAL(18,2),
    "difference_amount" DECIMAL(18,2),
    "opening_notes" TEXT,
    "closing_notes" TEXT,
    "opened_by" UUID NOT NULL,
    "closed_by" UUID,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cash_daily_closes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cash_daily_closes_finance_account_id_business_date_key"
    ON "cash_daily_closes"("finance_account_id", "business_date");
CREATE INDEX "cash_daily_closes_business_date_status_idx"
    ON "cash_daily_closes"("business_date", "status");
CREATE INDEX "cash_daily_closes_finance_account_id_status_idx"
    ON "cash_daily_closes"("finance_account_id", "status");
CREATE INDEX "cash_daily_closes_opened_by_idx"
    ON "cash_daily_closes"("opened_by");
CREATE INDEX "cash_daily_closes_closed_by_idx"
    ON "cash_daily_closes"("closed_by");

ALTER TABLE "cash_daily_closes"
    ADD CONSTRAINT "cash_daily_closes_finance_account_id_fkey"
    FOREIGN KEY ("finance_account_id") REFERENCES "finance_accounts"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_daily_closes"
    ADD CONSTRAINT "cash_daily_closes_opened_by_fkey"
    FOREIGN KEY ("opened_by") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "cash_daily_closes"
    ADD CONSTRAINT "cash_daily_closes_closed_by_fkey"
    FOREIGN KEY ("closed_by") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
