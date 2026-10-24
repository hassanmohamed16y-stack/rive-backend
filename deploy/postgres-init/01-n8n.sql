-- Runs once, on the very first start of an empty Postgres volume.
-- n8n keeps its own data in a separate database on the same server.
CREATE DATABASE n8n;
