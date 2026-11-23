ALTER TABLE `transactions` ADD `voided_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `voided_by` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `void_reason` text;