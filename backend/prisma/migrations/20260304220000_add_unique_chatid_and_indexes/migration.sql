-- Make chat_id unique (prevent duplicate Telegram links)
CREATE UNIQUE INDEX "telegram_links_chat_id_key" ON "telegram_links"("chat_id");

-- Drop the old non-unique index (replaced by unique constraint above)
DROP INDEX IF EXISTS "telegram_links_chat_id_idx";

-- Add missing indexes for gallery sorting and cleanup worker
CREATE INDEX "projects_is_public_published_at_idx" ON "projects"("is_public", "published_at");
CREATE INDEX "projects_expires_at_idx" ON "projects"("expires_at");
