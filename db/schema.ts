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

export const issues = sqliteTable("issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  severity: text("severity").notNull(),
  status: text("status").notNull().default("处理中"),
  impact: text("impact").notNull().default("影响待核实"),
  owner: text("owner").notNull().default("待认领"),
  dueAt: text("due_at"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  riskReason: text("risk_reason").notNull().default(""),
  nextStep: text("next_step").notNull().default(""),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  closedAt: text("closed_at"),
});

export const issueEvidence = sqliteTable("issue_evidence", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").notNull(),
  sourceName: text("source_name").notNull(),
  author: text("author").notNull(),
  messageTime: text("message_time").notNull(),
  excerpt: text("excerpt").notNull(),
  isKey: integer("is_key", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const actionItems = sqliteTable("action_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: integer("issue_id").notNull(),
  title: text("title").notNull(),
  owner: text("owner").notNull().default("待认领"),
  dueAt: text("due_at"),
  status: text("status").notNull().default("待执行"),
  priority: text("priority").notNull().default("普通"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});
