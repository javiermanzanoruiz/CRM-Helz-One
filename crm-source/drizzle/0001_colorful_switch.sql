CREATE TABLE `monthly_dues` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`service_period` text NOT NULL,
	`amount_due_cents` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `monthly_dues_owner_client_period_uq` ON `monthly_dues` (`owner_id`,`client_id`,`service_period`);--> statement-breakpoint
CREATE INDEX `monthly_dues_owner_period_idx` ON `monthly_dues` (`owner_id`,`service_period`);--> statement-breakpoint
ALTER TABLE `clients` ADD `fee_frozen` integer DEFAULT 0 NOT NULL;