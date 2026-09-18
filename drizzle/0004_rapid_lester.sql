ALTER TABLE `clients` ADD `latitude` double;--> statement-breakpoint
ALTER TABLE `clients` ADD `longitude` double;--> statement-breakpoint
ALTER TABLE `clients` ADD `geocodeSource` enum('google','manual','research');--> statement-breakpoint
ALTER TABLE `clients` ADD `geocodedAt` timestamp;