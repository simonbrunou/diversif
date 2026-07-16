PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_food_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`food_id` integer NOT NULL,
	`given_at` integer NOT NULL,
	`reaction` text NOT NULL,
	`texture` text,
	`notes` text,
	`logged_by` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`meal_id` text,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`food_id`) REFERENCES `foods`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`logged_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	CONSTRAINT "food_entries_texture_check" CHECK(texture in ('lisse', 'moulinee', 'ecrasee', 'petits-morceaux', 'morceaux', 'finger')),
	CONSTRAINT "food_entries_reaction_check" CHECK(reaction in ('ras', 'inconfort', 'reaction'))
);
--> statement-breakpoint
INSERT INTO `__new_food_entries`("id", "child_id", "food_id", "given_at", "reaction", "texture", "notes", "logged_by", "created_at", "updated_at", "meal_id") SELECT "id", "child_id", "food_id", "given_at", "reaction", "texture", "notes", "logged_by", "created_at", "updated_at", "meal_id" FROM `food_entries`;--> statement-breakpoint
DROP TABLE `food_entries`;--> statement-breakpoint
ALTER TABLE `__new_food_entries` RENAME TO `food_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `food_entries_child_idx` ON `food_entries` (`child_id`,`given_at`);--> statement-breakpoint
CREATE INDEX `food_entries_meal_idx` ON `food_entries` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `food_entries_meal_food_uq` ON `food_entries` (`meal_id`,`food_id`) WHERE "food_entries"."meal_id" is not null;--> statement-breakpoint
CREATE INDEX `invitations_created_by_idx` ON `invitations` (`created_by`);--> statement-breakpoint
CREATE INDEX `invitations_used_by_idx` ON `invitations` (`used_by`);--> statement-breakpoint
CREATE INDEX `memberships_child_id_idx` ON `memberships` (`child_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `sessions` (`user_id`);