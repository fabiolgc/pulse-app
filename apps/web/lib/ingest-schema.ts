import { z } from "zod/v4"

export const SOURCE_IDS = ["mt5", "cedro", "nelogica", "synthetic"] as const

export const tickDataSchema = z.object({
  bid: z.number(),
  ask: z.number(),
  last: z.number(),
  volume: z.number(),
})

export const candleDataSchema = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
})

export const ingestEnvelopeSchema = z.object({
  v: z.literal(1),
  source: z.enum(SOURCE_IDS),
  type: z.enum(["tick", "candle", "heartbeat"]),
  symbol: z.string().min(1),
  tf: z.string().optional(),
  ts: z.number().int().positive(),
  data: z.union([tickDataSchema, candleDataSchema, z.object({})]),
})

export type IngestEnvelope = z.infer<typeof ingestEnvelopeSchema>

export function validateIngestMessage(raw: unknown): IngestEnvelope {
  return ingestEnvelopeSchema.parse(raw)
}
