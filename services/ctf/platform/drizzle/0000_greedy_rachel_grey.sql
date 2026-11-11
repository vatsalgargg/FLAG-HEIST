CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_users_username_unique` ON `admin_users` (`username`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`message` text NOT NULL,
	`severity` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`created_by` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_announcements_is_active` ON `announcements` (`is_active`);--> statement-breakpoint
CREATE INDEX `idx_announcements_created_at` ON `announcements` (`created_at`);--> statement-breakpoint
CREATE TABLE `challenges` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`points` integer NOT NULL,
	`flag_hash` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hints` (
	`id` text PRIMARY KEY NOT NULL,
	`challenge_id` integer NOT NULL,
	`cost` integer NOT NULL,
	`content` text NOT NULL,
	`display_order` integer NOT NULL,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `hints_revealed` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`hint_id` text NOT NULL,
	`revealed_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`hint_id`) REFERENCES `hints`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_hints_revealed_team_id` ON `hints_revealed` (`team_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_hints_revealed_team_hint` ON `hints_revealed` (`team_id`,`hint_id`);--> statement-breakpoint
CREATE TABLE `score_log` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_score_log_team_id` ON `score_log` (`team_id`);--> statement-breakpoint
CREATE TABLE `solves` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`challenge_id` integer NOT NULL,
	`solved_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`challenge_id`) REFERENCES `challenges`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_solves_team_id` ON `solves` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_solves_challenge_id` ON `solves` (`challenge_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_solves_team_challenge` ON `solves` (`team_id`,`challenge_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`team_name` text NOT NULL,
	`member_emails` text NOT NULL,
	`team_size` integer NOT NULL,
	`password_hash` text NOT NULL,
	`auth_version` integer DEFAULT 0 NOT NULL,
	`accepted_rules_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `teams_team_name_unique` ON `teams` (`team_name`);--> statement-breakpoint
CREATE INDEX `idx_teams_team_name` ON `teams` (`team_name`);