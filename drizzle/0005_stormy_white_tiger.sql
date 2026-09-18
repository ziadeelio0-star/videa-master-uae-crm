CREATE TABLE `portfolioCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`billed` decimal(14,2) NOT NULL DEFAULT '0',
	`paid` decimal(14,2) NOT NULL DEFAULT '0',
	`outstanding` decimal(14,2) NOT NULL DEFAULT '0',
	`thisMonth` decimal(14,2) NOT NULL DEFAULT '0',
	`cachedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portfolioCache_id` PRIMARY KEY(`id`)
);
