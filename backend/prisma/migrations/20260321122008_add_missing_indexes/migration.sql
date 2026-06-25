-- CreateIndex
CREATE INDEX "deployments_project_id_status_idx" ON "deployments"("project_id", "status");

-- CreateIndex
CREATE INDEX "deployments_created_at_idx" ON "deployments"("created_at");

-- CreateIndex
CREATE INDEX "domains_verified_ssl_status_idx" ON "domains"("verified", "ssl_status");

-- CreateIndex
CREATE INDEX "reports_reporter_ip_created_at_idx" ON "reports"("reporter_ip", "created_at");

-- CreateIndex
CREATE INDEX "subscriptions_status_current_period_end_idx" ON "subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "subscriptions_prodamus_subscription_id_idx" ON "subscriptions"("prodamus_subscription_id");

-- CreateIndex
CREATE INDEX "users_plan_idx" ON "users"("plan");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_last_active_at_idx" ON "users"("last_active_at");

-- CreateIndex
CREATE INDEX "users_email_opt_out_created_at_idx" ON "users"("email_opt_out", "created_at");
