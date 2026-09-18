CREATE TABLE `clientTools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`toolId` int NOT NULL,
	`machineId` int,
	`usageFrequency` enum('daily','weekly','monthly','occasional') NOT NULL DEFAULT 'monthly',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `clientTools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`contactPerson` varchar(255),
	`email` varchar(320),
	`phone` varchar(64),
	`address` text,
	`industry` varchar(128),
	`activityLevel` enum('high','medium','low','inactive') NOT NULL DEFAULT 'medium',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`machineType` varchar(128) NOT NULL,
	`brand` varchar(128),
	`model` varchar(128),
	`serialNumber` varchar(128),
	`specifications` text,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `machines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(128),
	`unitPrice` decimal(10,2) DEFAULT '0',
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`type` enum('purchase','sharpening') NOT NULL,
	`description` varchar(500) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('paid','pending','overdue') NOT NULL DEFAULT 'pending',
	`transactionDate` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_ct_client` ON `clientTools` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_ct_tool` ON `clientTools` (`toolId`);--> statement-breakpoint
CREATE INDEX `idx_client_name` ON `clients` (`companyName`);--> statement-breakpoint
CREATE INDEX `idx_client_industry` ON `clients` (`industry`);--> statement-breakpoint
CREATE INDEX `idx_machine_client` ON `machines` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_tool_name` ON `tools` (`name`);--> statement-breakpoint
CREATE INDEX `idx_tx_client` ON `transactions` (`clientId`);--> statement-breakpoint
CREATE INDEX `idx_tx_date` ON `transactions` (`transactionDate`);--> statement-breakpoint
CREATE INDEX `idx_tx_status` ON `transactions` (`status`);