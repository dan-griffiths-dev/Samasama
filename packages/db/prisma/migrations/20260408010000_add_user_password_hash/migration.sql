ALTER TABLE "users"
ADD COLUMN "password_hash" TEXT;

UPDATE "users"
SET "password_hash" = '$2b$12$kETdpLVTILy/GqPm/C7bLeTqPzzHLFJA9EzaoEixN06lcgrk4WKxm'
WHERE "password_hash" IS NULL;

ALTER TABLE "users"
ALTER COLUMN "password_hash" SET NOT NULL;
