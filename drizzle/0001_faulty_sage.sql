CREATE TABLE `action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer NOT NULL,
	`title` text NOT NULL,
	`owner` text DEFAULT '待认领' NOT NULL,
	`due_at` text,
	`status` text DEFAULT '待执行' NOT NULL,
	`priority` text DEFAULT '普通' NOT NULL,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `issue_evidence` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` integer NOT NULL,
	`source_name` text NOT NULL,
	`author` text NOT NULL,
	`message_time` text NOT NULL,
	`excerpt` text NOT NULL,
	`is_key` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`severity` text NOT NULL,
	`status` text DEFAULT '处理中' NOT NULL,
	`impact` text DEFAULT '影响待核实' NOT NULL,
	`owner` text DEFAULT '待认领' NOT NULL,
	`due_at` text,
	`updated_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`risk_reason` text DEFAULT '' NOT NULL,
	`next_step` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT 'CURRENT_TIMESTAMP' NOT NULL,
	`closed_at` text
);
