-- Create enums
CREATE TYPE "EmailEventStatus" AS ENUM ('PENDING', 'SENT', 'SKIPPED', 'FAILED');
CREATE TYPE "PaymentEventStatus" AS ENUM ('PROCESSING', 'PROCESSED', 'FAILED');

-- Create email_events table
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'transactional',
    "user_id" TEXT,
    "status" "EmailEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload_hash" TEXT,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- Create payment_events table
CREATE TABLE "payment_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'prodamus',
    "provider_event_id" TEXT NOT NULL,
    "order_id" TEXT,
    "status" "PaymentEventStatus" NOT NULL DEFAULT 'PROCESSING',
    "last_error" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- Indexes and constraints
CREATE UNIQUE INDEX "email_events_dedupe_key_key" ON "email_events"("dedupe_key");
CREATE INDEX "email_events_user_id_created_at_idx" ON "email_events"("user_id", "created_at");
CREATE INDEX "email_events_event_type_created_at_idx" ON "email_events"("event_type", "created_at");
CREATE INDEX "email_events_status_created_at_idx" ON "email_events"("status", "created_at");

CREATE UNIQUE INDEX "payment_events_provider_provider_event_id_key" ON "payment_events"("provider", "provider_event_id");
CREATE INDEX "payment_events_status_created_at_idx" ON "payment_events"("status", "created_at");

ALTER TABLE "email_events"
  ADD CONSTRAINT "email_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
