-- CreateTable
CREATE TABLE "visual_patches" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "selector" TEXT NOT NULL,
    "xpath" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visual_patches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visual_patches_project_id_idx" ON "visual_patches"("project_id");

-- AddForeignKey
ALTER TABLE "visual_patches" ADD CONSTRAINT "visual_patches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
