CREATE TABLE `children` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `food_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`food_id` integer NOT NULL,
	`given_at` integer NOT NULL,
	`reaction` text NOT NULL,
	`notes` text,
	`logged_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `food_entries_child_idx` ON `food_entries` (`child_id`,`given_at`);--> statement-breakpoint
CREATE TABLE `foods` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`is_major_allergen` integer DEFAULT false NOT NULL,
	`allergen_type` text,
	`suggested_age_months` integer NOT NULL,
	`notes` text,
	`is_custom` integer DEFAULT false NOT NULL,
	`custom_for_child_id` integer,
	FOREIGN KEY (`custom_for_child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`code` text PRIMARY KEY NOT NULL,
	`child_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` integer,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`user_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `child_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);