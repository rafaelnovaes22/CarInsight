-- Setup Database FaciliAuto MVP
-- Execute com: psql -U postgres -f setup-database.sql

-- Criar database
CREATE DATABASE faciliauto_mvp;

-- Criar usuário
CREATE USER faciliauto WITH PASSWORD 'faciliauto2025';

-- Conceder privilégios
GRANT ALL PRIVILEGES ON DATABASE faciliauto_mvp TO faciliauto;

-- Conectar ao banco e conceder privilégios no schema public
\c faciliauto_mvp
GRANT ALL ON SCHEMA public TO faciliauto;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO faciliauto;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO faciliauto;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO faciliauto;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO faciliauto;

-- Confirmar
\l faciliauto_mvp
