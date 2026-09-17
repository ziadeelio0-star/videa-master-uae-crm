ALTER TABLE `clients` ADD `outstandingBalance` decimal(12,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `clients` ADD `oldestUnpaidDate` timestamp;