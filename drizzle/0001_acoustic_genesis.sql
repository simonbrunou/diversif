CREATE TABLE `tip_dismissals` (
	`user_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	`reminder_key` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `child_id`, `reminder_key`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade
);
