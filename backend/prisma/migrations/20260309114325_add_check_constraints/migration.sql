-- Add CHECK constraints for data integrity

-- Validate email format using regex
ALTER TABLE "users" ADD CONSTRAINT "chk_user_email_format"
  CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Ensure storage_used (sizeBytes on Project) is non-negative
ALTER TABLE "projects" ADD CONSTRAINT "chk_project_size_bytes_non_negative"
  CHECK ("size_bytes" >= 0);

-- Ensure User storageUsed is non-negative
ALTER TABLE "users" ADD CONSTRAINT "chk_user_storage_used_non_negative"
  CHECK ("storage_used" >= 0);

-- Ensure User storageLimit is positive
ALTER TABLE "users" ADD CONSTRAINT "chk_user_storage_limit_positive"
  CHECK ("storage_limit" > 0);
