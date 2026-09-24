CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host_token` text NOT NULL,
	`guest_token` text,
	`host_name` text NOT NULL,
	`guest_name` text,
	`board` text NOT NULL,
	`turn` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`winner` integer,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
