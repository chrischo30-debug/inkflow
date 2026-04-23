-- Rename is_admin to is_superuser for clarity.
ALTER TABLE artists RENAME COLUMN is_admin TO is_superuser;
