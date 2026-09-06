-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_description_idx" ON "Product" USING GIN ("description" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "Product_shortDescription_idx" ON "Product" USING GIN ("shortDescription" gin_trgm_ops);
