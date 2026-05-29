PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`buy_price` real NOT NULL,
	`quantity` real NOT NULL,
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
INSERT INTO `__new_positions`("id", "ticker", "buy_price", "quantity", "buy_date", "sell_price", "sell_date", "status", "pnl", "pnl_pct", "agent_run_id") SELECT "id", "ticker", "buy_price", "quantity", "buy_date", "sell_price", "sell_date", "status", "pnl", "pnl_pct", "agent_run_id" FROM `positions`;--> statement-breakpoint
DROP TABLE `positions`;--> statement-breakpoint
ALTER TABLE `__new_positions` RENAME TO `positions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_trades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticker` text NOT NULL,
	`action` text NOT NULL,
	`price` real NOT NULL,
	`quantity` real NOT NULL,
	`executed_at` text DEFAULT (datetime('now')) NOT NULL,
	`position_id` integer,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_trades`("id", "ticker", "action", "price", "quantity", "executed_at", "position_id") SELECT "id", "ticker", "action", "price", "quantity", "executed_at", "position_id" FROM `trades`;--> statement-breakpoint
DROP TABLE `trades`;--> statement-breakpoint
ALTER TABLE `__new_trades` RENAME TO `trades`;