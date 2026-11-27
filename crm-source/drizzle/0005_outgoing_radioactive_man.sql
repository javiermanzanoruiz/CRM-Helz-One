CREATE TABLE `cross_sell_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text DEFAULT 'otro' NOT NULL,
	`status` text DEFAULT 'planificada' NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`expected_units` integer DEFAULT 0 NOT NULL,
	`initial_investment_cents` integer DEFAULT 0 NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cross_sell_offers_owner_status_idx` ON `cross_sell_offers` (`owner_id`,`status`);