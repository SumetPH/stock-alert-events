import { env } from "./config/env.js";
import { startStockAlertCron } from "./jobs/stock-alert-cron.js";
import { logger } from "./lib/logger.js";
import { sendTestTelegramMessage } from "./services/telegram.service.js";

async function bootstrap(): Promise<void> {
  const command = process.argv[2] ?? "start";

  logger.info("bootstrap", "Stock alert service starting", {
    timezone: env.CRON_TIMEZONE,
    command
  });

  if (command === "run-once") {
    await import("./jobs/stock-alert-cron.js").then(({ runStockAlertJob }) => runStockAlertJob());
    return;
  }

  if (command === "run-dry") {
    await import("./jobs/stock-alert-cron.js").then(({ runStockAlertJob }) =>
      runStockAlertJob({ dryRun: true })
    );
    return;
  }

  if (command === "test-telegram") {
    await sendTestTelegramMessage();
    return;
  }

  startStockAlertCron();
}

void bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  logger.error("bootstrap", "Service failed to start", { error: message });
  process.exit(1);
});
