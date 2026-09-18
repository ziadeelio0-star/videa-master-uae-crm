ALTER TABLE `transactions` ADD `itemId` varchar(128);--> statement-breakpoint
CREATE INDEX `idx_tx_item_id` ON `transactions` (`itemId`);