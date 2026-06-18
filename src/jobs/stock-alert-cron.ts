import cron from "node-cron";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { evaluateHoldingAlert } from "../services/alert-engine.service.js";
import { getQuotes } from "../services/finnhub.service.js";
import {
  createAlertEvent,
  getActiveSellPlanHoldings,
  hasAlertEvent,
  updatePeakProfitPct,
} from "../services/holdings.service.js";
import { sendTelegramMessage } from "../services/telegram.service.js";
import { formatThaiDateTime } from "../utils/date.js";
import { toNumber } from "../utils/number.js";

const CRON_EXPRESSIONS = [
  "30,40,50 20 * * 1-5",
  "*/10 21-23 * * 1-5",
  "*/10 0-1 * * 2-6",
  "0 2 * * 2-6",
];

let isRunning = false;
const ALERT_SEPARATOR = "\n\n--------------------\n\n";

interface RunStockAlertJobOptions {
  dryRun?: boolean;
}

interface PendingAlertEvent {
  holdingId: string;
  ticker: string;
  alertType: "TAKE_PROFIT" | "STOP_LOSS" | "TRAILING_STOP";
  triggerPrice: number;
  profitPct: number;
  message: string;
}

function buildCombinedAlertMessage(alerts: PendingAlertEvent[]): string {
  const header = [
    `📣 <b>สรุป Stock Alert</b>`,
    `จำนวนแจ้งเตือน: <b>${alerts.length}</b>`,
    `เวลารายงาน: ${formatThaiDateTime(new Date(), env.CRON_TIMEZONE)}`,
  ].join("\n");

  const body = alerts
    .map((alert, index) => [alert.message].join("\n"))
    .join(ALERT_SEPARATOR);

  return [header, body].join("\n\n━━━━━━━━━━━━━━━━━━\n\n");
}

export async function runStockAlertJob(
  options: RunStockAlertJobOptions = {},
): Promise<void> {
  const { dryRun = false } = options;

  if (isRunning) {
    logger.warn(
      "stock-alert-job",
      "Previous run is still in progress. Skipping overlap.",
    );
    return;
  }

  isRunning = true;
  const startedAt = Date.now();
  let alertCount = 0;
  const pendingAlerts: PendingAlertEvent[] = [];

  try {
    logger.info("stock-alert-job", "Started", { dryRun });

    const holdings = await getActiveSellPlanHoldings();
    logger.info("stock-alert-job", "Loaded active holdings", {
      holdings: holdings.length,
    });

    if (holdings.length === 0) {
      logger.info("stock-alert-job", "No eligible holdings found");
      return;
    }

    const tickers = holdings.map((holding) => holding.ticker);
    const quotes = await getQuotes(tickers);
    logger.info("stock-alert-job", "Quotes fetched", {
      uniqueTickersWithQuotes: Object.keys(quotes).length,
    });

    for (const holding of holdings) {
      try {
        const normalizedTicker = holding.ticker.trim().toUpperCase();
        const quote = quotes[normalizedTicker];

        if (!quote) {
          logger.warn("stock-alert-job", "Missing quote for holding", {
            ticker: normalizedTicker,
            holdingId: holding.id,
          });
          continue;
        }

        const evaluation = evaluateHoldingAlert({
          holding,
          currentPrice: quote.currentPrice,
        });

        logger.info("stock-alert-job", "Holding evaluated", {
          holdingId: holding.id,
          ticker: normalizedTicker,
          currentPrice: quote.currentPrice,
          profitPct: evaluation.profitPct,
          nextPeakProfitPct: evaluation.nextPeakProfitPct,
          alerts: evaluation.alerts.map((alert) => alert.type),
        });

        const previousPeak =
          holding.peak_profit_pct === null
            ? null
            : toNumber(holding.peak_profit_pct);
        if (evaluation.shouldUpdatePeakProfitPct) {
          if (dryRun) {
            logger.info(
              "stock-alert-job",
              "Dry run: skipped peak profit update",
              {
                holdingId: holding.id,
                previousPeak,
                nextPeakProfitPct: evaluation.nextPeakProfitPct,
              },
            );
          } else {
            await updatePeakProfitPct(holding.id, evaluation.nextPeakProfitPct);
          }
        }

        for (const alert of evaluation.alerts) {
          const alreadyAlerted = dryRun
            ? false
            : await hasAlertEvent(holding.id, alert.type);
          if (alreadyAlerted) {
            logger.info("stock-alert-job", "Duplicate alert skipped", {
              holdingId: holding.id,
              alertType: alert.type,
            });
            continue;
          }

          if (dryRun) {
            logger.info("stock-alert-job", "Dry run: alert would be sent", {
              holdingId: holding.id,
              ticker: normalizedTicker,
              alertType: alert.type,
              triggerPrice: alert.triggerPrice,
              profitPct: alert.profitPct,
            });
          } else {
            pendingAlerts.push({
              holdingId: holding.id,
              ticker: normalizedTicker,
              alertType: alert.type,
              triggerPrice: alert.triggerPrice,
              profitPct: alert.profitPct,
              message: alert.message,
            });
          }

          alertCount += 1;
          logger.info(
            "stock-alert-job",
            dryRun ? "Dry run alert evaluated" : "Alert sent",
            {
              holdingId: holding.id,
              alertType: alert.type,
              profitPct: Number(alert.profitPct.toFixed(2)),
            },
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        logger.error("stock-alert-job", "Failed to process holding", {
          holdingId: holding.id,
          error: message,
        });
      }
    }

    if (dryRun && alertCount > 0) {
      logger.info("stock-alert-job", "Dry run summary", {
        alertCount,
      });
    }

    if (!dryRun && pendingAlerts.length > 0) {
      const combinedMessage = buildCombinedAlertMessage(pendingAlerts);
      logger.info("stock-alert-job", "Sending combined Telegram alert", {
        alertCount: pendingAlerts.length,
      });

      await sendTelegramMessage(combinedMessage);

      for (const alert of pendingAlerts) {
        await createAlertEvent({
          holdingId: alert.holdingId,
          ticker: alert.ticker,
          alertType: alert.alertType,
          triggerPrice: alert.triggerPrice,
          profitPct: alert.profitPct,
          message: alert.message,
        });
      }

      logger.info(
        "stock-alert-job",
        "Combined Telegram alert sent and events stored",
        {
          alertCount: pendingAlerts.length,
        },
      );
    }
  } finally {
    isRunning = false;
    const durationMs = Date.now() - startedAt;
    logger.info("stock-alert-job", "Finished", {
      durationMs,
      alertCount,
      dryRun,
    });
  }
}

export function startStockAlertCron(): void {
  for (const expression of CRON_EXPRESSIONS) {
    cron.schedule(
      expression,
      () => {
        void runStockAlertJob();
      },
      {
        timezone: env.CRON_TIMEZONE,
      },
    );
  }

  logger.info("stock-alert-job", "Cron scheduled", {
    timezone: env.CRON_TIMEZONE,
    expressions: CRON_EXPRESSIONS,
  });
}
