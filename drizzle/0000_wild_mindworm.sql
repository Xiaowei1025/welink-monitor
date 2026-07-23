CREATE TABLE `message_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_id` text NOT NULL,
	`source_type` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`lookback_days` integer,
	`cursor_message_id` text,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `report_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`status` text NOT NULL,
	`source_count` integer DEFAULT 0 NOT NULL,
	`message_count` integer DEFAULT 0 NOT NULL,
	`report_markdown` text,
	`started_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`completed_at` text
);
