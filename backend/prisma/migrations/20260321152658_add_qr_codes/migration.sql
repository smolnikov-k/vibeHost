-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'QR-код',
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "fg_color" TEXT NOT NULL DEFAULT '#000000',
    "bg_color" TEXT NOT NULL DEFAULT '#ffffff',
    "dot_style" TEXT NOT NULL DEFAULT 'square',
    "corner_square_style" TEXT NOT NULL DEFAULT 'square',
    "corner_dot_style" TEXT NOT NULL DEFAULT 'square',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qr_codes_project_id_idx" ON "qr_codes"("project_id");

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
