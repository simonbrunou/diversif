PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_food_entries`("id", "child_id", "food_id", "given_at", "reaction", "notes", "logged_by", "created_at") SELECT "id", "child_id", "food_id", "given_at", "reaction", "notes", "logged_by", "created_at" FROM `food_entries`;--> statement-breakpoint
DROP TABLE `food_entries`;--> statement-breakpoint
ALTER TABLE `__new_food_entries` RENAME TO `food_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `food_entries_child_idx` ON `food_entries` (`child_id`,`given_at`);--> statement-breakpoint
CREATE INDEX `webauthn_challenges_expires_idx` ON `webauthn_challenges` (`expires_at`);