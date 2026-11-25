-- ============================================================================
-- Ustanomi - Güvenli Havuz (Escrow) & Doğrulanmış Usta Ağı (MySQL 8.0+ Schema)
-- InnoDB, UTF8MB4, Foreign Keys, Escrow State Machine & Document Upload Audit
-- ============================================================================

CREATE DATABASE IF NOT EXISTS ustanomi_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE ustanomi_db;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  role ENUM('CUSTOMER', 'MASTER', 'ADMIN') NOT NULL DEFAULT 'CUSTOMER',
  is_verified_master TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_active (role, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_requests (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(32) NOT NULL UNIQUE,
  customer_id INT UNSIGNED NOT NULL,
  master_id INT UNSIGNED NULL,
  category VARCHAR(80) NOT NULL,
  city VARCHAR(80) NOT NULL,
  district VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  agreed_amount_cents BIGINT UNSIGNED NOT NULL DEFAULT 0,
  escrow_status ENUM(
    'PENDING_PAYMENT',
    'FUNDS_HELD_IN_POOL',
    'WORK_IN_PROGRESS',
    'CUSTOMER_APPROVED_RELEASED',
    'DISPUTED',
    'REFUNDED'
  ) NOT NULL DEFAULT 'PENDING_PAYMENT',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_req_customer FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_req_master FOREIGN KEY (master_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_req_customer_status (customer_id, escrow_status),
  INDEX idx_req_master_status (master_id, escrow_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS escrow_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  service_request_id INT UNSIGNED NOT NULL,
  provider ENUM('PAYTR', 'IYZICO') NOT NULL,
  provider_reference VARCHAR(120) NOT NULL UNIQUE,
  amount_cents BIGINT UNSIGNED NOT NULL,
  status ENUM('HELD', 'RELEASED_TO_MASTER', 'REFUNDED_TO_CUSTOMER') NOT NULL DEFAULT 'HELD',
  webhook_verified TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_escrow_req FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS uploaded_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uploader_user_id INT UNSIGNED NOT NULL,
  service_request_id INT UNSIGNED NULL,
  doc_category ENUM('SITE_PHOTO', 'DAMAGE_REPORT', 'MEB_MYK_CERTIFICATE') NOT NULL,
  stored_filename VARCHAR(120) NOT NULL UNIQUE,
  detected_mime VARCHAR(64) NOT NULL,
  file_size_bytes INT UNSIGNED NOT NULL,
  sha256_checksum CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_doc_user FOREIGN KEY (uploader_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_doc_req FOREIGN KEY (service_request_id) REFERENCES service_requests(id) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX idx_doc_user_cat (uploader_user_id, doc_category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS security_audit_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_user_id INT UNSIGNED NULL,
  actor_role VARCHAR(32) NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(64) NULL,
  ip_address VARCHAR(45) NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_action_created (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- AI Studio Lead -> Pro Offer -> Single Acceptance & Split-Payment Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS sub_merchants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  sub_merchant_key VARCHAR(64) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  specialty VARCHAR(120) NOT NULL,
  iban VARCHAR(34) NOT NULL,
  rating DECIMAL(3,2) NOT NULL DEFAULT 4.90,
  verified TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_submerchant_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS leads (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_customer_id INT UNSIGNED NOT NULL,
  phone VARCHAR(20) NOT NULL,
  service_title VARCHAR(180) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Genel Tadilat',
  city VARCHAR(80) NOT NULL DEFAULT 'İstanbul',
  details TEXT NOT NULL,
  urgency VARCHAR(80) NOT NULL DEFAULT 'Bu Hafta İçinde',
  verified TINYINT(1) NOT NULL DEFAULT 1,
  state ENUM(
    'DRAFT',
    'OPEN_FOR_OFFERS',
    'OFFER_ACCEPTED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED'
  ) NOT NULL DEFAULT 'OPEN_FOR_OFFERS',
  accepted_offer_id INT UNSIGNED NULL,
  assigned_pro_user_id INT UNSIGNED NULL,
  assigned_job_id VARCHAR(48) NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lead_owner FOREIGN KEY (owner_customer_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_leads_state_category (state, category, city),
  INDEX idx_leads_owner (owner_customer_id, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pro_offers (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lead_id INT UNSIGNED NOT NULL,
  pro_user_id INT UNSIGNED NOT NULL,
  sub_merchant_id VARCHAR(64) NOT NULL,
  pro_display_name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL,
  price_kurus BIGINT UNSIGNED NOT NULL,
  estimated_duration VARCHAR(80) NOT NULL,
  warranty_label VARCHAR(120) NOT NULL,
  proposal_note TEXT NOT NULL,
  state ENUM(
    'PENDING',
    'ACCEPTED',
    'COMPLETED',
    'REJECTED',
    'WITHDRAWN',
    'EXPIRED'
  ) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_offer_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_offer_pro FOREIGN KEY (pro_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_offers_lead_state (lead_id, state),
  INDEX idx_offers_pro_state (pro_user_id, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ledger_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(64) NOT NULL UNIQUE,
  idempotency_key VARCHAR(96) NOT NULL UNIQUE,
  lead_id INT UNSIGNED NOT NULL,
  offer_id INT UNSIGNED NOT NULL,
  sub_merchant_id VARCHAR(64) NOT NULL,
  total_amount_kurus BIGINT UNSIGNED NOT NULL,
  sub_merchant_share_kurus BIGINT UNSIGNED NOT NULL,
  platform_commission_kurus BIGINT UNSIGNED NOT NULL,
  payment_gateway ENUM('IYZICO_ESCROW', 'PAYTR_ESCROW') NOT NULL DEFAULT 'IYZICO_ESCROW',
  escrow_status ENUM('HAVUZ_HESAPTA', 'USTAYA_AKTARILDI', 'IADE_EDILDI') NOT NULL DEFAULT 'HAVUZ_HESAPTA',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ledger_lead FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_ledger_offer FOREIGN KEY (offer_id) REFERENCES pro_offers(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Universal Professions, Urgent Job Feed & Instagram/TikTok Pro Showcase Tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS pro_social_profiles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  handle VARCHAR(64) NOT NULL UNIQUE,
  profession_title VARCHAR(140) NOT NULL,
  cluster_code VARCHAR(40) NOT NULL DEFAULT 'HOME_TECH',
  city VARCHAR(80) NOT NULL DEFAULT 'İstanbul',
  district VARCHAR(80) NOT NULL DEFAULT 'Kadıköy',
  availability_mode ENUM('OPEN', 'CLOSED', 'ON_DUTY_24_7', 'AUTO') NOT NULL DEFAULT 'AUTO',
  open_hour TINYINT UNSIGNED NOT NULL DEFAULT 8,
  close_hour TINYINT UNSIGNED NOT NULL DEFAULT 20,
  response_time_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 4,
  followers_count INT UNSIGNED NOT NULL DEFAULT 0,
  price_menu_json JSON NULL,
  story_highlights_json JSON NULL,
  media_grid_json JSON NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_social_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_social_cluster_mode (cluster_code, availability_mode, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS urgent_job_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  urgent_post_code VARCHAR(32) NOT NULL UNIQUE,
  customer_user_id INT UNSIGNED NOT NULL,
  cluster_code VARCHAR(40) NOT NULL,
  urgency_code ENUM('EMERGENCY_30M', 'TODAY', 'SCHEDULED') NOT NULL DEFAULT 'EMERGENCY_30M',
  city VARCHAR(80) NOT NULL DEFAULT 'İstanbul',
  district VARCHAR(80) NOT NULL DEFAULT 'Kadıköy',
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  estimated_budget_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('OPEN', 'MATCHED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_urgent_customer FOREIGN KEY (customer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_urgent_open_cluster (status, urgency_code, cluster_code, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
