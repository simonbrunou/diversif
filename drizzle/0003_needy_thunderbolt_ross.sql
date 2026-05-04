PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_children` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_children`("id", "name", "birth_date", "created_by", "created_at") SELECT "id", "name", "birth_date", "created_by", "created_at" FROM `children`;--> statement-breakpoint
DROP TABLE `children`;--> statement-breakpoint
ALTER TABLE `__new_children` RENAME TO `children`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_food_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`food_id` integer NOT NULL,
	`given_at` integer NOT NULL,
	`reaction` text NOT NULL,
	`notes` text,
	`logged_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_food_entries`("id", "child_id", "food_id", "given_at", "reaction", "notes", "logged_by", "created_at") SELECT "id", "child_id", "food_id", "given_at", "reaction", "notes", "logged_by", "created_at" FROM `food_entries`;--> statement-breakpoint
DROP TABLE `food_entries`;--> statement-breakpoint
ALTER TABLE `__new_food_entries` RENAME TO `food_entries`;--> statement-breakpoint
CREATE INDEX `food_entries_child_idx` ON `food_entries` (`child_id`,`given_at`);--> statement-breakpoint
CREATE TABLE `__new_invitations` (
	`code` text PRIMARY KEY NOT NULL,
	`child_id` integer NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`used_by` integer,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_invitations`("code", "child_id", "created_by", "created_at", "expires_at", "used_at", "used_by") SELECT "code", "child_id", "created_by", "created_at", "expires_at", "used_at", "used_by" FROM `invitations`;--> statement-breakpoint
DROP TABLE `invitations`;--> statement-breakpoint
ALTER TABLE `__new_invitations` RENAME TO `invitations`;--> statement-breakpoint
CREATE INDEX `invitations_expires_at_idx` ON `invitations` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD `tos_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `privacy_accepted_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `age_confirmed_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `last_login_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `last_export_at` integer;--> statement-breakpoint
CREATE INDEX `users_last_login_at_idx` ON `users` (`last_login_at`);--> statement-breakpoint
CREATE INDEX `sessions_expires_at_idx` ON `sessions` (`expires_at`);