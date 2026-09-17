ALTER TABLE `transactions` ADD `dueDate` timestamp;--> statement-breakpoint
ALTER TABLE `transactions` ADD `agingBucket` enum('not_due','0_30','31_60','61_90','90_plus');