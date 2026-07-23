import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messageSources = sqliteTable("message_sources", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  targetId: text("target_id").notNull(),
  sourceType: text("source_type").notNull(),
  note: text("note").notNull().default(""),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lookbackDays: integer("lookback_days"),
  cursorMessageId: text("cursor_message_id"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const reportRuns = sqliteTable("report_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status").notNull(),
  sourceCount: integer("source_count").notNull().default(0),
  messageCount: integer("message_count").notNull().default(0),
  reportMarkdown: text("report_markdown"),
  startedAt: text("started_at").notNull().default("CURRENT_TIMESTAMP"),
  completedAt: text("completed_at"),
});
