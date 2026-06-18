export type NumericLike = number | string | null;

export type AlertType = "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_STOP";

export interface PortfolioHolding {
  id: string;
  user_id: string;
  portfolio_id: string;
  ticker: string;
  name: string;
  shares: NumericLike;
  price_usd: NumericLike;
  cost_basis_usd: NumericLike;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
  logo_url: string;
  sell_plan_enabled: boolean;
  take_profit_pct: NumericLike;
  trailing_stop_pct: NumericLike;
  peak_profit_pct: NumericLike;
  portfolio_group: string;
  stop_loss_pct: NumericLike;
}

export interface AlertEventRecord {
  id: string;
  holding_id: string;
  ticker: string;
  alert_type: AlertType;
  trigger_price: NumericLike;
  profit_pct: NumericLike;
  message: string;
  created_at: string | null;
}

export interface CreateAlertEventInput {
  holdingId: string;
  ticker: string;
  alertType: AlertType;
  triggerPrice: number;
  profitPct: number;
  message: string;
}
