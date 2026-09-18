CREATE TABLE `apiConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(128) NOT NULL,
	`value` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `apiConfig_id` PRIMARY KEY(`id`),
	CONSTRAINT `apiConfig_key_unique` UNIQUE(`key`)
);
