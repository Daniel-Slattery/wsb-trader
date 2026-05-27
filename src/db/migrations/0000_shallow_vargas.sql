CREATE TABLE `agent_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_at` text DEFAULT (datetime('now')) NOT NULL,
	`top_picks` text NOT NULL,
	`selected_ticker` text NOT NULL,
	`reasoning` text NOT NULL,
	`raw_reddit` text,
	`raw_news` text,
	`skipped` integer DEFAULT 0,
	`skip_reason` text
);
--> statement-breakpoint
CREATE TABLE `equity_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snapshot_at` text DEFAULT (datetime('now')) NOT NULL,
	`total_equity` real NOT NULL,
	`cash` real NOT NULL,
	`invested_value` real NOT NULL,
	`open_positions_count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`buy_price` real NOT NULL,
	`quantity` integer NOT NULL,
	`buy_date` text NOT NULL,
	`sell_price` real,
	`sell_date` text,
	`status` text DEFAULT 'open' NOT NULL,
	`pnl` real,
	`pnl_pct` real,
	`agent_run_id` integer,
	FOREIGN KEY (`agent_run_id`) REFERENCES `agent_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`action` text NOT NULL,
	`price` real NOT NULL,
	`quantity` integer NOT NULL,
	`executed_at` text DEFAULT (datetime('now')) NOT NULL,
	`position_id` integer,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
