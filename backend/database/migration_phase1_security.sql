-- FIX 4: Fix Race Condition - Add Unique Constraint on (staff_id, appointment_date, appointment_time)
-- This prevents double-booking at the database level

-- Drop existing constraint if it exists (for idempotency)
ALTER TABLE appointments DROP INDEX IF EXISTS unique_staff_time_slot;

-- Add unique constraint: A staff can only have one appointment at a specific time on a specific date
-- This constraint ignores cancelled appointments to allow rebooking of cancelled slots
ALTER TABLE appointments 
ADD UNIQUE KEY unique_staff_time_slot (staff_id, appointment_date, appointment_time, status);

-- Check for existing conflicts first
SELECT COUNT(*) as conflict_count FROM appointments 
GROUP BY staff_id, appointment_date, appointment_time 
HAVING COUNT(*) > 1 AND status != 'cancelled';

-- Create indexes for better performance on common queries
ALTER TABLE appointments ADD INDEX idx_user_id (user_id);
ALTER TABLE appointments ADD INDEX idx_staff_id (staff_id);
ALTER TABLE appointments ADD INDEX idx_service_id (service_id);
ALTER TABLE appointments ADD INDEX idx_appointment_date (appointment_date);
ALTER TABLE appointments ADD INDEX idx_status (status);

-- Create composite index for checking conflicts
ALTER TABLE appointments ADD INDEX idx_staff_date_time (staff_id, appointment_date, appointment_time);

-- Index on users table for better email lookups
ALTER TABLE users ADD INDEX idx_email (email);

-- Add timestamps if not already present
ALTER TABLE appointments ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;
