CREATE TABLE `product_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`expiry_date` text NOT NULL,
	`remaining_qty` integer NOT NULL,
	`source` text NOT NULL,
	`reference_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `product_batches_product_expiry_idx` ON `product_batches` (`product_id`,`expiry_date`);