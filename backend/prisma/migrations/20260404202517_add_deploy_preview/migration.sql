-- AlterEnum
ALTER TYPE "DeployStatus" ADD VALUE 'PREVIEW';

-- AlterTable
ALTER TABLE "deployments" ADD COLUMN     "preview_slug" TEXT;
