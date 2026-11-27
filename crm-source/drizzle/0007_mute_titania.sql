CREATE TABLE `tanita_assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`assessment_date` text NOT NULL,
	`weight_kg` real,
	`body_fat_percent` real,
	`muscle_mass_kg` real,
	`visceral_fat` integer,
	`bmi` real,
	`basal_metabolism_kcal` integer,
	`body_water_percent` real,
	`price_cents` integer DEFAULT 2000 NOT NULL,
	`paid` integer DEFAULT 0 NOT NULL,
	`payment_method` text DEFAULT 'efectivo' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tanita_assessments_owner_client_date_idx` ON `tanita_assessments` (`owner_id`,`client_id`,`assessment_date`);