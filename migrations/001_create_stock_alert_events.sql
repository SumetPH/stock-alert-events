CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "public"."stock_alert_events" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "holding_id" text NOT NULL,
    "ticker" text NOT NULL,
    "alert_type" text NOT NULL,
    "trigger_price" numeric(15,4) NOT NULL,
    "profit_pct" numeric(15,4) NOT NULL,
    "message" text NOT NULL DEFAULT '',
    "created_at" timestamp DEFAULT now(),
    CONSTRAINT "stock_alert_events_holding_id_fkey"
      FOREIGN KEY ("holding_id")
      REFERENCES "public"."portfolio_holdings"("id")
      ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS stock_alert_events_unique_condition
ON public.stock_alert_events (holding_id, alert_type);
