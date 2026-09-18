CREATE TABLE `syncState` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source` varchar(64) NOT NULL,
	`fileHash` varchar(128) NOT NULL,
	`fileName` varchar(320),
	`summaryJson` text,
	`lastSyncAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `syncState_id` PRIMARY KEY(`id`),
	CONSTRAINT `syncState_source_unique` UNIQUE(`source`)
);
