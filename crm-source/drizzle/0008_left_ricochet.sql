CREATE TABLE `professional_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`client_id` text NOT NULL,
	`professional_role` text NOT NULL,
	`note` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `professional_notes_owner_client_role_date_idx` ON `professional_notes` (`owner_id`,`client_id`,`professional_role`,`created_at`);