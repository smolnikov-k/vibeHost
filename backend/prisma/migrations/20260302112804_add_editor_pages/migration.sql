-- CreateTable
CREATE TABLE "editor_pages" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "gjs_data" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "editor_pages_project_id_idx" ON "editor_pages"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "editor_pages_project_id_path_key" ON "editor_pages"("project_id", "path");

-- AddForeignKey
ALTER TABLE "editor_pages" ADD CONSTRAINT "editor_pages_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
