USE booking_system;
SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS appointment_services (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  service_id INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  price_snapshot DECIMAL(10,2) NOT NULL,
  duration_snapshot INT NOT NULL,
  service_name_snapshot VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_appointment_service_order (appointment_id, sort_order),
  INDEX idx_appointment_services_appointment (appointment_id),
  INDEX idx_appointment_services_service (service_id),
  CONSTRAINT fk_appointment_services_appointment
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  CONSTRAINT fk_appointment_services_service
    FOREIGN KEY (service_id) REFERENCES services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO appointment_services (
  appointment_id,
  service_id,
  sort_order,
  price_snapshot,
  duration_snapshot,
  service_name_snapshot,
  created_at
)
SELECT
  a.id,
  a.service_id,
  0,
  COALESCE(a.total_amount, s.price, 0),
  COALESCE(s.duration, 0),
  COALESCE(s.name, ''),
  a.created_at
FROM appointments a
JOIN services s ON s.id = a.service_id
LEFT JOIN appointment_services aps ON aps.appointment_id = a.id
WHERE aps.id IS NULL;
