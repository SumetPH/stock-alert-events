import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const MAX_ATTEMPTS = 2;

async function fetchQuoteWithRetry(ticker: string): Promise<number | null> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const url = new URL(FINNHUB_QUOTE_URL);
      url.searchParams.set("symbol", ticker);
      url.searchParams.set("token", env.FINNHUB_API_KEY);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!response.ok) {
        throw new Error(`Finnhub returned HTTP ${response.status}`);
      }

      const payload = (await response.json()) as { c?: number | null };
      const currentPrice = payload.c;

      if (typeof currentPrice !== "number" || !Number.isFinite(currentPrice) || currentPrice <= 0) {
        logger.warn("finnhub", "Invalid current price received", { ticker, currentPrice });
        return null;
      }

      return currentPrice;
    } catch (error) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      const message = error instanceof Error ? error.message : "Unknown error";
      logger.warn("finnhub", "Quote fetch attempt failed", {
        ticker,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        error: message
      });

      if (isLastAttempt) {
        return null;
      }

      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }

  return null;
}

export async function getQuotes(
  tickers: string[]
): Promise<Record<string, { currentPrice: number }>> {
  const uniqueTickers = [...new Set(tickers.map((ticker) => ticker.trim().toUpperCase()).filter(Boolean))];
  logger.info("finnhub", "Fetching quotes", {
    requestedTickers: tickers.length,
    uniqueTickers: uniqueTickers.length
  });

  const quoteEntries = await Promise.all(
    uniqueTickers.map(async (ticker) => {
      const currentPrice = await fetchQuoteWithRetry(ticker);
      return currentPrice ? [ticker, { currentPrice }] : null;
    })
  );

  logger.info("finnhub", "Finished fetching quotes", {
    successfulQuotes: quoteEntries.filter((entry) => entry !== null).length
  });

  return Object.fromEntries(quoteEntries.filter((entry): entry is [string, { currentPrice: number }] => entry !== null));
}
