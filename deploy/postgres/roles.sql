-- Run as the database owner after replacing the generated passwords through a
-- secret manager. Do not check passwords into this file.
CREATE ROLE agent_factory_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE agent_factory_worker LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;
CREATE ROLE agent_factory_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;

GRANT CONNECT ON DATABASE agent_factory TO agent_factory_app, agent_factory_worker, agent_factory_migrator;
GRANT USAGE ON SCHEMA public TO agent_factory_app, agent_factory_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agent_factory_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO agent_factory_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO agent_factory_app, agent_factory_worker;

-- The migrator owns schema changes but is not used by API or worker processes.
GRANT ALL ON SCHEMA public TO agent_factory_migrator;
