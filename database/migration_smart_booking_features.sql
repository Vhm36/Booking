-- Migration: Smart Booking Features
-- Adds columns for RFM segmentation, cancellation scoring, sentiment tracking, and appointment reminders

-- 1. Users table: RFM & customer classification
ALTER TABLE users ADD COLUMN IF NOT EXISTS customer_segment VARCHAR(30) DEFAULT 'New';
ALTER TABLE users ADD COLUMN IF NOT EXISTS rfm_score VARCHAR(10) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rfm_updated_at TIMESTAMP NULL DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS date_of_birth DATE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cancellation_count INT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS noshow_count INT DEFAULT 0;

-- 2. Appointments table: reminder tracking
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminder_sent TINYINT(1) DEFAULT 0;

-- 3. Chat messages: sentiment analysis
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20) DEFAULT NULL;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS escalated TINYINT(1) DEFAULT 0;

-- 4. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_segment ON users(customer_segment);
CREATE INDEX IF NOT EXISTS idx_appointments_reminder ON appointments(appointment_date, appointment_time, reminder_sent);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sentiment ON chat_messages(sentiment);
