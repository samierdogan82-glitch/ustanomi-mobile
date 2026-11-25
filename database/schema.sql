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

-- ============================================================================
-- Talent Discovery Feed (Like-Boosted Ranking) & "Seninle Çalışmak İstiyorum" Direct Hire
-- ============================================================================

CREATE TABLE IF NOT EXISTS talent_posts (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pro_user_id INT UNSIGNED NOT NULL,
  pro_handle VARCHAR(64) NOT NULL,
  cluster_code VARCHAR(40) NOT NULL DEFAULT 'HOME_TECH',
  skill_title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  starting_price_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  likes_count INT UNSIGNED NOT NULL DEFAULT 0,
  work_requests_count INT UNSIGNED NOT NULL DEFAULT 0,
  trending_score INT UNSIGNED NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_talent_pro FOREIGN KEY (pro_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_talent_trending (trending_score DESC, likes_count DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS direct_hire_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  request_code VARCHAR(32) NOT NULL UNIQUE,
  talent_post_id INT UNSIGNED NOT NULL,
  customer_user_id INT UNSIGNED NOT NULL,
  pro_user_id INT UNSIGNED NOT NULL,
  offered_budget_kurus BIGINT UNSIGNED NOT NULL,
  pro_net_share_kurus BIGINT UNSIGNED NOT NULL,
  platform_fee_kurus BIGINT UNSIGNED NOT NULL,
  customer_note TEXT NOT NULL,
  preferred_schedule VARCHAR(120) NOT NULL DEFAULT 'En Kısa Sürede',
  status ENUM('SENT', 'ACCEPTED_BY_PRO', 'IN_ESCROW', 'COMPLETED', 'DECLINED') NOT NULL DEFAULT 'SENT',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_hire_talent FOREIGN KEY (talent_post_id) REFERENCES talent_posts(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_hire_customer FOREIGN KEY (customer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_hire_pro FOREIGN KEY (pro_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_hire_pro_status (pro_user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Commercial KYC Identity Verification (TCKN / VKN / IBAN) & Password Reset OTP
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_kyc_identities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL UNIQUE,
  tckn_sha256 CHAR(64) NOT NULL UNIQUE,
  tckn_masked CHAR(11) NOT NULL,
  vkn_masked VARCHAR(16) NULL,
  iban_masked VARCHAR(34) NULL,
  birth_year SMALLINT UNSIGNED NULL,
  kvkk_consent_at DATETIME NOT NULL,
  escrow_contract_consent_at DATETIME NOT NULL,
  kyc_status ENUM('VERIFIED_ALGORITHMIC', 'NVİ_KPS_VERIFIED', 'SUSPENDED') NOT NULL DEFAULT 'VERIFIED_ALGORITHMIC',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_kyc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_sha256 CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  request_ip VARCHAR(45) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_reset_user_expires (user_id, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- B2B Industrial / Auto Repair / Spare Parts Tenders & Sealed Private Proforma Bids
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_tenders (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  tender_code VARCHAR(32) NOT NULL UNIQUE,
  buyer_user_id INT UNSIGNED NOT NULL,
  tender_category ENUM('AUTO_REPAIR_PARTS', 'INDUSTRIAL_MANUFACTURING', 'WHOLESALE_PROCUREMENT') NOT NULL DEFAULT 'AUTO_REPAIR_PARTS',
  title VARCHAR(180) NOT NULL,
  vehicle_or_machine_spec VARCHAR(180) NOT NULL,
  parts_bom_list TEXT NOT NULL,
  city VARCHAR(80) NOT NULL DEFAULT 'İstanbul',
  status ENUM('OPEN_FOR_SEALED_BIDS', 'PROFORMA_CONTRACT_LOCKED', 'IN_ESCROW_POOL', 'DELIVERED_RELEASED', 'CANCELLED') NOT NULL DEFAULT 'OPEN_FOR_SEALED_BIDS',
  locked_proforma_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_tender_buyer FOREIGN KEY (buyer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_tender_cat_status (tender_category, status, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS b2b_sealed_proforma_bids (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proforma_ref_code VARCHAR(40) NOT NULL UNIQUE,
  contract_ref_code VARCHAR(40) NOT NULL UNIQUE,
  tender_id INT UNSIGNED NOT NULL,
  supplier_user_id INT UNSIGNED NOT NULL,
  supplier_company_title VARCHAR(160) NOT NULL,
  part_origin_type ENUM('ORIGINAL_OEM', 'CERTIFIED_EQUIVALENT', 'CUSTOM_MANUFACTURED') NOT NULL DEFAULT 'ORIGINAL_OEM',
  parts_description TEXT NOT NULL,
  parts_amount_kurus BIGINT UNSIGNED NOT NULL,
  labor_amount_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  kdv_rate_percent TINYINT UNSIGNED NOT NULL DEFAULT 20,
  kdv_amount_kurus BIGINT UNSIGNED NOT NULL,
  grand_total_kurus BIGINT UNSIGNED NOT NULL,
  supplier_net_share_kurus BIGINT UNSIGNED NOT NULL,
  escrow_pool_fee_kurus BIGINT UNSIGNED NOT NULL,
  warranty_months SMALLINT UNSIGNED NOT NULL DEFAULT 12,
  delivery_days SMALLINT UNSIGNED NOT NULL DEFAULT 2,
  valid_until_date DATE NOT NULL,
  escrow_provider ENUM('IYZICO_ESCROW', 'PAYTR_ESCROW') NOT NULL DEFAULT 'IYZICO_ESCROW',
  status ENUM('SEALED_SUBMITTED', 'BUYER_ACCEPTED_ESCROW', 'REJECTED') NOT NULL DEFAULT 'SEALED_SUBMITTED',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proforma_tender FOREIGN KEY (tender_id) REFERENCES b2b_tenders(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_proforma_supplier FOREIGN KEY (supplier_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_proforma_tender_supplier (tender_id, supplier_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Omnichannel Social Media & Commercial Marketplace Auto-Sync (Sahibinden, IG, TikTok, Maps, WA)
-- ============================================================================

CREATE TABLE IF NOT EXISTS external_commerce_connections (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  connector_code ENUM(
    'SAHIBINDEN_STORE',
    'INSTAGRAM_BUSINESS',
    'TIKTOK_CREATOR',
    'GOOGLE_BUSINESS_MAPS',
    'WHATSAPP_CATALOG',
    'TRENDYOL_HEPSIBURADA'
  ) NOT NULL,
  source_url VARCHAR(500) NOT NULL,
  external_handle_or_store VARCHAR(140) NOT NULL,
  imported_items_count INT UNSIGNED NOT NULL DEFAULT 0,
  auto_sync_enabled TINYINT(1) NOT NULL DEFAULT 1,
  synced_payload_json JSON NULL,
  last_synced_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ext_conn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_user_connector (user_id, connector_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Instagram Direct (DM) Chat & In-Thread Proforma Escrow Approval Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS dm_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  thread_code VARCHAR(48) NOT NULL,
  sender_user_id INT UNSIGNED NOT NULL,
  recipient_user_id INT UNSIGNED NOT NULL,
  message_type ENUM('TEXT', 'PROFORMA_ESCROW_CARD', 'LOCATION_PIN') NOT NULL DEFAULT 'TEXT',
  message_body TEXT NOT NULL,
  proforma_total_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  pro_net_share_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  is_escrow_locked TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_dm_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_dm_recipient FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_dm_thread_created (thread_code, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- Work-In-Progress Live Streams & Profession-Specific Gift Ledger (Kuruş-Exact)
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_work_streams (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stream_code VARCHAR(32) NOT NULL UNIQUE,
  streamer_user_id INT UNSIGNED NOT NULL,
  cluster_code ENUM('HOME_TECH', 'AUTO_LOGISTICS', 'EVENTS_MEDIA', 'DIGITAL_AI', 'PERSONAL_WELLNESS', 'EDUCATION_CONSULT') NOT NULL DEFAULT 'HOME_TECH',
  work_title VARCHAR(180) NOT NULL,
  current_stage_label VARCHAR(140) NOT NULL,
  city VARCHAR(80) NOT NULL DEFAULT 'İstanbul',
  viewer_count INT UNSIGNED NOT NULL DEFAULT 0,
  total_gift_coins BIGINT UNSIGNED NOT NULL DEFAULT 0,
  creator_net_earned_kurus BIGINT UNSIGNED NOT NULL DEFAULT 0,
  stream_status ENUM('LIVE', 'ENDED', 'SUSPENDED') NOT NULL DEFAULT 'LIVE',
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  CONSTRAINT fk_live_streamer FOREIGN KEY (streamer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_live_cluster_status (cluster_code, stream_status, viewer_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS live_gift_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_code VARCHAR(64) NOT NULL UNIQUE,
  stream_id BIGINT UNSIGNED NOT NULL,
  sender_user_id INT UNSIGNED NOT NULL,
  streamer_user_id INT UNSIGNED NOT NULL,
  cluster_code ENUM('HOME_TECH', 'AUTO_LOGISTICS', 'EVENTS_MEDIA', 'DIGITAL_AI', 'PERSONAL_WELLNESS', 'EDUCATION_CONSULT') NOT NULL,
  gift_code VARCHAR(40) NOT NULL,
  gift_tier ENUM('STANDARD', 'PRO', 'LEGEND') NOT NULL DEFAULT 'STANDARD',
  quantity SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  total_coins INT UNSIGNED NOT NULL,
  gross_amount_kurus BIGINT UNSIGNED NOT NULL,
  creator_net_kurus BIGINT UNSIGNED NOT NULL,
  platform_fee_kurus BIGINT UNSIGNED NOT NULL,
  supporter_note VARCHAR(240) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_gift_stream FOREIGN KEY (stream_id) REFERENCES live_work_streams(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_gift_sender FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_gift_streamer FOREIGN KEY (streamer_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_gift_streamer_created (streamer_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
