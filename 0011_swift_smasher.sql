ALTER TABLE `clients` ADD `outstandingBalance` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `oldestUnpaidDate` timestamp;--> statement-breakpoint
ALTER TABLE `clients` ADD `excelClientId` int;