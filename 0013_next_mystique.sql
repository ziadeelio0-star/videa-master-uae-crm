CREATE TABLE `operatingCosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`excelCostId` varchar(64),
	`excelKey` varchar(320),
	`txDate` timestamp NOT NULL,
	`payee` varchar(320),
	`expenseAccount` varchar(320),
	`description` text,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'AED',
	`paidFrom` varchar(128),
	`reference` varchar(128),
	`rawCostType` varchar(128),
	`costCenter` varchar(128),
	`category` enum('salaries','rent','fuel','maintenance','utilities','phone_internet','office','it_equipment','marketing','legal','accounting','bank_fees','tax','other_operating') NOT NULL,
	`classification` enum('operating','inventory','shipping','other') NOT NULL,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `operatingCosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_op_cost_date` ON `operatingCosts` (`txDate`);--> statement-breakpoint
CREATE INDEX `idx_op_cost_category` ON `operatingCosts` (`category`);--> statement-breakpoint
CREATE INDEX `idx_op_cost_classification` ON `operatingCosts` (`classification`);--> statement-breakpoint
CREATE INDEX `idx_op_cost_excel_key` ON `operatingCosts` (`excelKey`);