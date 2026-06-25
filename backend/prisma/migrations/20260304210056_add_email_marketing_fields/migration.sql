-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_opt_out" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_active_at" TIMESTAMP(3);
