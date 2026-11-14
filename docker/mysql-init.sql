-- Extra databases for Prisma's shadow DB (migrate dev) and the automated tests.
CREATE DATABASE IF NOT EXISTS doodi_shadow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS doodi_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON doodi.* TO 'doodi'@'%';
GRANT ALL PRIVILEGES ON doodi_shadow.* TO 'doodi'@'%';
GRANT ALL PRIVILEGES ON doodi_test.* TO 'doodi'@'%';
FLUSH PRIVILEGES;
