CREATE TABLE `purchase_returns` (
	`id` text PRIMARY KEY NOT NULL,
	`return_number` text NOT NULL,
	`supplier_name` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`processed_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`processed_at` text,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_returns_return_number_unique` ON `purchase_returns` (`return_number`);--> statement-breakpoint
CREATE INDEX `products_name_idx` ON `products` (`name`);--> statement-breakpoint
CREATE INDEX `products_category_idx` ON `products` (`category_id`);--> statement-breakpoint
CREATE INDEX `products_active_stock_idx` ON `products` (`is_active`,`stock_qty`);--> statement-breakpoint
CREATE INDEX `shifts_user_status_idx` ON `shifts` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `shifts_open_at_idx` ON `shifts` (`open_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_product_time_idx` ON `stock_movements` (`product_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `stock_movements_type_time_idx` ON `stock_movements` (`type`,`created_at`);--> statement-breakpoint
CREATE INDEX `transaction_items_trx_idx` ON `transaction_items` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_items_product_idx` ON `transaction_items` (`product_id`);--> statement-breakpoint
CREATE INDEX `transactions_time_idx` ON `transactions` (`transaction_time`);--> statement-breakpoint
CREATE INDEX `transactions_shift_idx` ON `transactions` (`shift_id`);--> statement-breakpoint
CREATE INDEX `transactions_user_idx` ON `transactions` (`user_id`);