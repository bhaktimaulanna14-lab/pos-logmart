CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`target_type` text NOT NULL,
	`product_id` text,
	`category_id` text,
	`value` integer NOT NULL,
	`min_qty` integer DEFAULT 1 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `promotions_period_idx` ON `promotions` (`is_active`,`start_date`,`end_date`);--> statement-breakpoint
CREATE INDEX `promotions_product_idx` ON `promotions` (`product_id`);--> statement-breakpoint
CREATE INDEX `promotions_category_idx` ON `promotions` (`category_id`);--> statement-breakpoint
ALTER TABLE `transaction_items` ADD `discount` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transaction_items` ADD `promotion_id` text;--> statement-breakpoint
ALTER TABLE `transaction_items` ADD `promotion_name` text;