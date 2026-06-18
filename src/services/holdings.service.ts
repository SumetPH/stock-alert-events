import { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase.js";
import {
  AlertEventRecord,
  AlertType,
  CreateAlertEventInput,
  PortfolioHolding
} from "../types/holding.js";

function throwIfError(error: PostgrestError | null, context: string): void {
  if (error) {
    throw new Error(`${context}: ${error.message}`);
  }
}

export async function getActiveSellPlanHoldings(): Promise<PortfolioHolding[]> {
  const { data, error } = await supabase
    .from("portfolio_holdings")
    .select("*")
    .eq("sell_plan_enabled", true)
    .gt("shares", 0)
    .gt("price_usd", 0)
    .or("take_profit_pct.gt.0,stop_loss_pct.gt.0,trailing_stop_pct.gt.0");

  throwIfError(error, "Failed to fetch active sell plan holdings");

  return (data ?? []) as PortfolioHolding[];
}

export async function updatePeakProfitPct(holdingId: string, peakProfitPct: number): Promise<void> {
  const { error } = await supabase
    .from("portfolio_holdings")
    .update({
      peak_profit_pct: peakProfitPct,
      updated_at: new Date().toISOString()
    })
    .eq("id", holdingId)
    .or(`peak_profit_pct.is.null,peak_profit_pct.lt.${peakProfitPct}`);

  throwIfError(error, `Failed to update peak profit for holding ${holdingId}`);
}

export async function hasAlertEvent(holdingId: string, alertType: AlertType): Promise<boolean> {
  const { data, error } = await supabase
    .from("stock_alert_events")
    .select("id")
    .eq("holding_id", holdingId)
    .eq("alert_type", alertType)
    .maybeSingle();

  throwIfError(error, `Failed to check alert event for holding ${holdingId}`);

  return Boolean(data);
}

export async function createAlertEvent(input: CreateAlertEventInput): Promise<void> {
  const payload: Omit<AlertEventRecord, "id" | "created_at"> = {
    holding_id: input.holdingId,
    ticker: input.ticker,
    alert_type: input.alertType,
    trigger_price: input.triggerPrice,
    profit_pct: input.profitPct,
    message: input.message
  };

  const { error } = await supabase.from("stock_alert_events").insert(payload);

  throwIfError(error, `Failed to create alert event for holding ${input.holdingId}`);
}
