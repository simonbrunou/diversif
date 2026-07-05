ALTER TABLE `food_entries` ADD `meal_id` text;--> statement-breakpoint
CREATE INDEX `food_entries_meal_idx` ON `food_entries` (`meal_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `food_entries_meal_food_uq` ON `food_entries` (`meal_id`,`food_id`) WHERE "food_entries"."meal_id" is not null;