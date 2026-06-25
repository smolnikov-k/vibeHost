-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "email_verify_code" TEXT,
ADD COLUMN     "email_verify_expires" TIMESTAMP(3);
