import {
  pgTable,
  text,
  boolean,
  timestamp,
  bigserial,
  bigint,
  numeric,
  uuid,
  jsonb,
  date,
  unique,
  index,
} from "drizzle-orm/pg-core"

// --- data_sources ---

export const dataSources = pgTable("data_sources", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  enabled: boolean("enabled").default(true),
  tokenHash: text("token_hash"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// --- candles_history ---

export const candlesHistory = pgTable(
  "candles_history",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    source: text("source")
      .notNull()
      .references(() => dataSources.id),
    symbol: text("symbol").notNull(),
    tf: text("tf").notNull(),
    time: bigint("time", { mode: "number" }).notNull(),
    open: numeric("open").notNull(),
    high: numeric("high").notNull(),
    low: numeric("low").notNull(),
    close: numeric("close").notNull(),
    volume: bigint("volume", { mode: "number" }).notNull(),
  },
  (t) => [
    unique().on(t.source, t.symbol, t.tf, t.time),
    index("idx_candles_symbol_tf_time").on(t.symbol, t.tf, t.time),
    index("idx_candles_source").on(t.source),
  ]
)

// --- rules ---

export const rules = pgTable(
  "rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    logicJson: jsonb("logic_json").notNull(),
    symbol: text("symbol").notNull(),
    tf: text("tf").notNull().default("M5"),
    sourcePref: text("source_pref").references(() => dataSources.id),
    active: boolean("active").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index("idx_rules_user").on(t.userId),
    index("idx_rules_active").on(t.active),
  ]
)

// --- alerts ---

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    source: text("source")
      .notNull()
      .references(() => dataSources.id),
    symbol: text("symbol").notNull(),
    price: numeric("price").notNull(),
    message: text("message").notNull(),
    direction: text("direction"),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow(),
    acknowledged: boolean("acknowledged").default(false),
  },
  (t) => [
    index("idx_alerts_user").on(t.userId, t.triggeredAt),
    index("idx_alerts_rule").on(t.ruleId),
  ]
)

// --- backtest_results ---

export const backtestResults = pgTable(
  "backtest_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    ruleId: uuid("rule_id")
      .notNull()
      .references(() => rules.id, { onDelete: "cascade" }),
    source: text("source")
      .notNull()
      .references(() => dataSources.id),
    symbol: text("symbol").notNull(),
    tf: text("tf").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    metricsJson: jsonb("metrics_json").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => [index("idx_backtest_user").on(t.userId, t.createdAt)]
)

// --- user_settings ---

export const userSettings = pgTable("user_settings", {
  userId: uuid("user_id").primaryKey(),
  alertSound: boolean("alert_sound").default(true),
  os: text("os"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
})
