import type { Candle, Indicators } from "@/types"

/** Exponential Moving Average */
export function computeEma(closes: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const ema: number[] = [closes[0]]
  for (let i = 1; i < closes.length; i++) {
    ema.push(closes[i] * k + ema[i - 1] * (1 - k))
  }
  return ema
}

/** Relative Strength Index */
export function computeRsi(closes: number[], period: number = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN)
  if (closes.length < period + 1) return rsi

  let avgGain = 0
  let avgLoss = 0
  for (let i = 1; i <= period; i++) {
    const delta = closes[i] - closes[i - 1]
    if (delta > 0) avgGain += delta
    else avgLoss -= delta
  }
  avgGain /= period
  avgLoss /= period

  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i] - closes[i - 1]
    const gain = delta > 0 ? delta : 0
    const loss = delta < 0 ? -delta : 0
    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)
  }
  return rsi
}

/** MACD (12, 26, 9) */
export function computeMacd(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = computeEma(closes, fastPeriod)
  const emaSlow = computeEma(closes, slowPeriod)
  const macdLine = emaFast.map((v, i) => v - emaSlow[i])
  const signalLine = computeEma(macdLine, signalPeriod)
  const histogram = macdLine.map((v, i) => v - signalLine[i])
  return { macd: macdLine, signal: signalLine, histogram }
}

/** Bollinger Bands (20, 2) */
export function computeBollingerBands(
  closes: number[],
  period: number = 20,
  stdMultiplier: number = 2
): { upper: number[]; middle: number[]; lower: number[] } {
  const upper: number[] = new Array(closes.length).fill(NaN)
  const middle: number[] = new Array(closes.length).fill(NaN)
  const lower: number[] = new Array(closes.length).fill(NaN)

  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / period
    const variance =
      slice.reduce((sum, val) => sum + (val - mean) ** 2, 0) / period
    const std = Math.sqrt(variance)
    middle[i] = mean
    upper[i] = mean + stdMultiplier * std
    lower[i] = mean - stdMultiplier * std
  }
  return { upper, middle, lower }
}

/** Average True Range */
export function computeAtr(candles: Candle[], period: number = 14): number[] {
  const atr: number[] = new Array(candles.length).fill(NaN)
  if (candles.length < 2) return atr

  const trueRanges: number[] = [candles[0].high - candles[0].low]
  for (let i = 1; i < candles.length; i++) {
    const { high, low } = candles[i]
    const prevClose = candles[i - 1].close
    trueRanges.push(
      Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
    )
  }

  if (trueRanges.length < period) return atr
  let sum = 0
  for (let i = 0; i < period; i++) sum += trueRanges[i]
  atr[period - 1] = sum / period

  for (let i = period; i < trueRanges.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + trueRanges[i]) / period
  }
  return atr
}

/** Detect simple candle patterns */
export function detectCandlePatterns(candles: Candle[]): string[] {
  if (candles.length < 2) return []
  const patterns: string[] = []
  const curr = candles[candles.length - 1]
  const prev = candles[candles.length - 2]
  const body = Math.abs(curr.close - curr.open)
  const range = curr.high - curr.low
  const isGreen = curr.close > curr.open
  const upperWick = curr.high - Math.max(curr.open, curr.close)
  const lowerWick = Math.min(curr.open, curr.close) - curr.low

  // Doji
  if (range > 0 && body / range < 0.1) {
    patterns.push("doji")
  }
  // Hammer (bullish)
  if (lowerWick > body * 2 && upperWick < body * 0.5 && range > 0) {
    patterns.push("hammer")
  }
  // Bullish engulfing
  if (
    isGreen &&
    prev.close < prev.open &&
    curr.open <= prev.close &&
    curr.close >= prev.open
  ) {
    patterns.push("engulfing_bull")
  }
  // Bearish engulfing
  if (
    !isGreen &&
    prev.close > prev.open &&
    curr.open >= prev.close &&
    curr.close <= prev.open
  ) {
    patterns.push("engulfing_bear")
  }
  // Marubozu bull
  if (isGreen && range > 0 && body / range > 0.9) {
    patterns.push("marubozu_bull")
  }
  // Marubozu bear
  if (!isGreen && range > 0 && body / range > 0.9) {
    patterns.push("marubozu_bear")
  }

  return patterns
}

/** Build full indicator snapshot from candle array */
export function buildIndicators(candles: Candle[]): Indicators {
  const closes = candles.map((c) => c.close)
  const ema9 = computeEma(closes, 9)
  const ema21 = computeEma(closes, 21)
  const rsi14 = computeRsi(closes, 14)
  const macd = computeMacd(closes)
  const bb = computeBollingerBands(closes)
  const atr14 = computeAtr(candles, 14)
  const last = closes.length - 1

  return {
    ema: {
      9: ema9[last],
      21: ema21[last],
    },
    rsi: {
      14: rsi14[last],
    },
    macd: {
      macd: macd.macd[last],
      signal: macd.signal[last],
      histogram: macd.histogram[last],
    },
    bb: {
      upper: bb.upper[last],
      middle: bb.middle[last],
      lower: bb.lower[last],
    },
    atr: {
      14: atr14[last],
    },
  }
}
