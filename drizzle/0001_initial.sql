CREATE TABLE `library_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `papers` (
	`owner_id` text NOT NULL,
	`id` text NOT NULL,
	`document` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`file_key` text,
	`file_size` integer,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`)
);
