import type { Indicators, RuleCondition, RuleLogic } from "@/types"

interface EvaluationContext {
  indicators: Indicators
  patterns: string[]
  price: number
  prevIndicators?: Indicators
}

function evaluateCondition(
  condition: RuleCondition,
  ctx: EvaluationContext
): boolean {
  const { indicator } = condition

  switch (indicator) {
    case "rsi": {
      const period = (condition.period as number) ?? 14
      const operator = condition.operator as string
      const value = condition.value as number
      const rsiValue = ctx.indicators.rsi[period]
      if (rsiValue == null || isNaN(rsiValue)) return false
      return compareValues(rsiValue, operator, value)
    }

    case "ema": {
      const period = condition.period as number
      const operator = condition.operator as string
      const emaValue = ctx.indicators.ema[period]
      if (emaValue == null) return false
      if (operator === "above_price") return ctx.price > emaValue
      if (operator === "below_price") return ctx.price < emaValue
      return false
    }

    case "ema_cross": {
      const fast = condition.fast as number
      const slow = condition.slow as number
      const direction = condition.direction as string
      const fastEma = ctx.indicators.ema[fast]
      const slowEma = ctx.indicators.ema[slow]
      if (fastEma == null || slowEma == null) return false
      if (!ctx.prevIndicators) {
        // Without previous data, check current relative position
        return direction === "above" ? fastEma > slowEma : fastEma < slowEma
      }
      const prevFast = ctx.prevIndicators.ema[fast]
      const prevSlow = ctx.prevIndicators.ema[slow]
      if (prevFast == null || prevSlow == null) return false
      if (direction === "above") {
        return prevFast <= prevSlow && fastEma > slowEma
      }
      return prevFast >= prevSlow && fastEma < slowEma
    }

    case "macd_cross_signal": {
      const direction = condition.direction as string
      const { macd, signal } = ctx.indicators.macd
      if (isNaN(macd) || isNaN(signal)) return false
      if (!ctx.prevIndicators) {
        return direction === "above" ? macd > signal : macd < signal
      }
      const prevMacd = ctx.prevIndicators.macd.macd
      const prevSignal = ctx.prevIndicators.macd.signal
      if (direction === "above") {
        return prevMacd <= prevSignal && macd > signal
      }
      return prevMacd >= prevSignal && macd < signal
    }

    case "bb_position": {
      const position = condition.position as string
      const { upper, lower } = ctx.indicators.bb
      if (isNaN(upper) || isNaN(lower)) return false
      if (position === "above_upper") return ctx.price > upper
      if (position === "below_lower") return ctx.price < lower
      if (position === "inside") return ctx.price >= lower && ctx.price <= upper
      return false
    }

    case "atr": {
      const period = (condition.period as number) ?? 14
      const operator = condition.operator as string
      const value = condition.value as number
      const atrValue = ctx.indicators.atr[period]
      if (atrValue == null || isNaN(atrValue)) return false
      return compareValues(atrValue, operator, value)
    }

    case "volume": {
      // Volume evaluation requires external avg — simplified here
      const operator = condition.operator as string
      if (operator === "above_avg") return true
      if (operator === "below_avg") return false
      return false
    }

    case "candle_pattern": {
      const pattern = condition.pattern as string
      return ctx.patterns.includes(pattern)
    }

    default:
      return false
  }
}

function compareValues(
  actual: number,
  operator: string,
  expected: number
): boolean {
  switch (operator) {
    case "less_than":
      return actual < expected
    case "greater_than":
      return actual > expected
    case "equals":
      return Math.abs(actual - expected) < 0.001
    default:
      return false
  }
}

export interface EvaluateRuleParams {
  rule: RuleLogic
  indicators: Indicators
  patterns: string[]
  price: number
  prevIndicators?: Indicators
}

export function evaluateRule({
  rule,
  indicators,
  patterns,
  price,
  prevIndicators,
}: EvaluateRuleParams): boolean {
  const ctx: EvaluationContext = {
    indicators,
    patterns,
    price,
    prevIndicators,
  }

  const conditionsMet = rule.conditions.every((c) =>
    evaluateCondition(c, ctx)
  )
  if (!conditionsMet) return false

  if (rule.filters.length > 0) {
    const filtersMet = rule.filters.every((f) => evaluateCondition(f, ctx))
    if (!filtersMet) return false
  }

  return true
}
