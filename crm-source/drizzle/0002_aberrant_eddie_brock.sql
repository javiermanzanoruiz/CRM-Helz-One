ALTER TABLE `clients` ADD `schedule_type` text DEFAULT 'fijo' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `training_schedule` text DEFAULT '' NOT NULL;