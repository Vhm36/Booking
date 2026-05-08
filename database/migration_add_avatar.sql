-- Migration: Thêm cột avatar cho users
-- File: migration_add_avatar.sql

ALTER TABLE users ADD COLUMN avatar VARCHAR(255) DEFAULT NULL AFTER phone;
