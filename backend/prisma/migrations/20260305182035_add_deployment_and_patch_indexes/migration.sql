-- CreateIndex
CREATE INDEX "deployments_project_id_version_idx" ON "deployments"("project_id", "version");

-- CreateIndex
CREATE INDEX "visual_patches_project_id_enabled_idx" ON "visual_patches"("project_id", "enabled");
