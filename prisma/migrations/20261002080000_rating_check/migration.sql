-- Prisma cannot express CHECK constraints; enforce the 1-5 rating range in the database too.
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_rating_range` CHECK (`rating` BETWEEN 1 AND 5);
