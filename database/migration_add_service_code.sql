-- Migration: Add service_code column to services table
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_code VARCHAR(50) UNIQUE DEFAULT NULL;
