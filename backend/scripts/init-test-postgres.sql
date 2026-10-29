CREATE ROLE ipes_test LOGIN CREATEDB NOSUPERUSER NOCREATEROLE PASSWORD 'ipes_test_local';
COMMENT ON DATABASE ipes_test_control IS 'ipes-isolated-tests-v1';
