CREATE TABLE `prepared_meals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`child_id` integer NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`ingredient_food_ids` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prepared_meals_child_last_used_idx` ON `prepared_meals` (`child_id`,`last_used_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `prepared_meals_child_brand_name_uq` ON `prepared_meals` (`child_id`,`brand`,`name`);