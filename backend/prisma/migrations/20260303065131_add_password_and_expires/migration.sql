-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "password_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_hash" TEXT;
