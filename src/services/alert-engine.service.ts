import { env } from "../config/env.js";
import { AlertType, PortfolioHolding } from "../types/holding.js";
import { formatThaiDateTime } from "../utils/date.js";
import { escapeHtml } from "../utils/html.js";
import {
  formatShares,
  formatSignedPercent,
  formatUsd,
  roundTo,
  toNumber,
} from "../utils/number.js";

interface EvaluatedAlert {
  type: AlertType;
  message: string;
  triggerPrice: number;
  profitPct: number;
}

const ALERT_PRIORITY: AlertType[] = [
  "STOP_LOSS",
  "TRAILING_STOP",
  "TAKE_PROFIT",
];

function buildAlertMessage(input: {
  icon: string;
  title: string;
  holding: PortfolioHolding;
  currentPrice: number;
  entryPrice: number;
  profitPct: number;
  details: string[];
}): string {
  const { icon, title, holding, currentPrice, entryPrice, profitPct, details } =
    input;
  const safeTicker = escapeHtml(holding.ticker);
  const safeName = holding.name ? escapeHtml(holding.name) : "";

  return [
    `<b>${safeTicker}</b>${safeName ? ` • ${safeName}` : ""} ${icon} <b>${title}</b>`,
    "",
    `ราคาปัจจุบัน: <b>${formatUsd(currentPrice)}</b>`,
    `ราคาเข้า: ${formatUsd(entryPrice)}`,
    `กำไร/ขาดทุน: <b>${formatSignedPercent(profitPct)}</b>`,
    `จำนวนหุ้น: ${formatShares(toNumber(holding.shares))}`,
    ...details,
  ].join("\n");
}

export function evaluateHoldingAlert(input: {
  holding: PortfolioHolding;
  currentPrice: number;
}): {
  profitPct: number;
  nextPeakProfitPct: number;
  alerts: EvaluatedAlert[];
} {
  const { holding, currentPrice } = input;
  const entryPrice = toNumber(holding.price_usd);
  const shares = toNumber(holding.shares);
  const takeProfitPct = toNumber(holding.take_profit_pct);
  const stopLossPct = toNumber(holding.stop_loss_pct);
  const trailingStopPct = toNumber(holding.trailing_stop_pct);
  const storedPeakProfitPct =
    holding.peak_profit_pct === null ? null : toNumber(holding.peak_profit_pct);

  if (entryPrice <= 0) {
    throw new Error(`Holding ${holding.id} has invalid entry price`);
  }

  const profitPct = roundTo(((currentPrice - entryPrice) / entryPrice) * 100);
  const nextPeakProfitPct =
    storedPeakProfitPct === null
      ? profitPct
      : Math.max(storedPeakProfitPct, profitPct);

  const candidateAlerts: Partial<Record<AlertType, EvaluatedAlert>> = {};

  if (takeProfitPct > 0 && profitPct >= takeProfitPct) {
    candidateAlerts.TAKE_PROFIT = {
      type: "TAKE_PROFIT",
      triggerPrice: currentPrice,
      profitPct,
      message: buildAlertMessage({
        icon: "🟢",
        title: "ถึงเป้าทำกำไร",
        holding,
        currentPrice,
        entryPrice,
        profitPct,
        details: [`เป้าหมายกำไร: ${formatSignedPercent(takeProfitPct)}`],
      }),
    };
  }

  if (stopLossPct > 0 && profitPct <= -stopLossPct) {
    candidateAlerts.STOP_LOSS = {
      type: "STOP_LOSS",
      triggerPrice: currentPrice,
      profitPct,
      message: buildAlertMessage({
        icon: "🔴",
        title: "ถึงจุดตัดขาดทุน",
        holding,
        currentPrice,
        entryPrice,
        profitPct,
        details: [`จุดตัดขาดทุน: ${formatSignedPercent(-stopLossPct)}`],
      }),
    };
  }

  if (
    trailingStopPct > 0 &&
    nextPeakProfitPct > 0 &&
    profitPct <= nextPeakProfitPct - trailingStopPct
  ) {
    candidateAlerts.TRAILING_STOP = {
      type: "TRAILING_STOP",
      triggerPrice: currentPrice,
      profitPct,
      message: buildAlertMessage({
        icon: "🟡",
        title: "หลุด Trailing Stop",
        holding,
        currentPrice,
        entryPrice,
        profitPct,
        details: [
          `กำไรสูงสุด: ${formatSignedPercent(nextPeakProfitPct)}`,
          `Trailing Stop: ${trailingStopPct.toFixed(2)}%`,
        ],
      }),
    };
  }

  const selectedAlert = ALERT_PRIORITY.map(
    (type) => candidateAlerts[type],
  ).find((alert): alert is EvaluatedAlert => Boolean(alert));

  return {
    profitPct,
    nextPeakProfitPct: roundTo(nextPeakProfitPct),
    alerts: selectedAlert ? [selectedAlert] : [],
  };
}
