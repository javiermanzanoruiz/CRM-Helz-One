CREATE TABLE `checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`session_date` text NOT NULL,
	`session_type` text DEFAULT 'Entrenamiento' NOT NULL,
	`attendance` text DEFAULT 'realizada' NOT NULL,
	`effort` integer,
	`satisfaction` integer,
	`discomfort` integer,
	`notes` text DEFAULT '' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `checkins_owner_client_date_idx` ON `checkins` (`owner_id`,`client_id`,`session_date`);--> statement-breakpoint
CREATE TABLE `clients` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`service` text DEFAULT '' NOT NULL,
	`monthly_fee_cents` integer DEFAULT 0 NOT NULL,
	`payment_day` integer DEFAULT 5 NOT NULL,
	`payment_method` text DEFAULT 'transferencia' NOT NULL,
	`frequency` text DEFAULT '' NOT NULL,
	`start_date` text DEFAULT '' NOT NULL,
	`next_review_date` text DEFAULT '' NOT NULL,
	`goal` text DEFAULT '' NOT NULL,
	`training_notes` text DEFAULT '' NOT NULL,
	`testimonial_consent` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `clients_owner_status_idx` ON `clients` (`owner_id`,`status`);--> statement-breakpoint
CREATE INDEX `clients_owner_name_idx` ON `clients` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`contact` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'nuevo' NOT NULL,
	`next_action_date` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `leads_owner_stage_idx` ON `leads` (`owner_id`,`stage`);--> statement-breakpoint
CREATE INDEX `leads_owner_action_idx` ON `leads` (`owner_id`,`next_action_date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text,
	`lead_id` text,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`status` text DEFAULT 'pendiente' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `tasks_owner_status_due_idx` ON `tasks` (`owner_id`,`status`,`due_date`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`transaction_date` text NOT NULL,
	`direction` text NOT NULL,
	`category` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`client_id` text,
	`service_period` text DEFAULT '' NOT NULL,
	`payment_method` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`reconciled` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_owner_date_idx` ON `transactions` (`owner_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `transactions_owner_period_idx` ON `transactions` (`owner_id`,`service_period`,`direction`);