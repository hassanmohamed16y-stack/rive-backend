-- Speed up public product listing queries that filter by status (e.g. ACTIVE-only).
CREATE INDEX "Product_status_idx" ON "Product"("status");
