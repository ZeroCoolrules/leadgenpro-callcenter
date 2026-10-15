-- LeadGen Pro Database Schema
-- Created: 2026-04-07
-- Compatible with MySQL 5.7+ / MariaDB 10.3+

-- Create database (run this first, or create via cPanel)
-- CREATE DATABASE IF NOT EXISTS leadgen_pro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE leadgen_pro;

-- =====================================================
-- TABLE: users (for authentication)
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    company_name VARCHAR(200),
    phone VARCHAR(20),
    role ENUM('admin', 'manager', 'sales_rep') DEFAULT 'sales_rep',
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    email_verified BOOLEAN DEFAULT FALSE,
    api_key VARCHAR(64) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email),
    INDEX idx_api_key (api_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: leads (main lead storage)
-- =====================================================
CREATE TABLE IF NOT EXISTS leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    phone2 VARCHAR(20),
    company_name VARCHAR(200),
    job_title VARCHAR(150),
    website VARCHAR(255),
    linkedin_url VARCHAR(255),
    industry VARCHAR(100),
    company_size ENUM('1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'),
    revenue_range VARCHAR(50),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    zip_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'United States',
    source ENUM('web_scraper', 'email_hunter', 'social_media', 'landing_page', 'ai_outreach', 'cold_call', 'manual_entry', 'import', 'referral', 'other') NOT NULL,
    source_details VARCHAR(255),
    quality ENUM('hot', 'warm', 'cold', 'unqualified') DEFAULT 'warm',
    status ENUM('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost', 'nurture', 'disqualified') DEFAULT 'new',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    assigned_to INT,
    tags JSON,
    notes TEXT,
    custom_fields JSON,
    last_contacted_at TIMESTAMP NULL,
    next_follow_up TIMESTAMP NULL,
    deal_value DECIMAL(12,2),
    probability INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_quality (quality),
    INDEX idx_source (source),
    INDEX idx_email (email),
    INDEX idx_company (company_name),
    INDEX idx_created_at (created_at),
    INDEX idx_assigned (assigned_to),
    INDEX idx_follow_up (next_follow_up)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: lead_activities (tracking all interactions)
-- =====================================================
CREATE TABLE IF NOT EXISTS lead_activities (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lead_id INT NOT NULL,
    user_id INT,
    activity_type ENUM('call', 'email', 'sms', 'meeting', 'note', 'status_change', 'ai_call', 'voicemail', 'website_visit', 'email_open', 'link_click') NOT NULL,
    direction ENUM('inbound', 'outbound', 'internal') DEFAULT 'outbound',
    subject VARCHAR(255),
    content TEXT,
    duration_seconds INT,
    call_recording_url VARCHAR(500),
    ai_transcript TEXT,
    ai_sentiment ENUM('positive', 'neutral', 'negative'),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_lead_id (lead_id),
    INDEX idx_activity_type (activity_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: campaigns (marketing campaigns)
-- =====================================================
CREATE TABLE IF NOT EXISTS campaigns (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    type ENUM('email', 'cold_call', 'ai_call', 'sms', 'linkedin', 'mixed') NOT NULL,
    status ENUM('draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled') DEFAULT 'draft',
    description TEXT,
    target_audience JSON,
    script_template TEXT,
    email_template_id INT,
    ai_voice_profile VARCHAR(50),
    ai_settings JSON,
    start_date TIMESTAMP NULL,
    end_date TIMESTAMP NULL,
    total_leads INT DEFAULT 0,
    contacted_leads INT DEFAULT 0,
    responses INT DEFAULT 0,
    meetings_booked INT DEFAULT 0,
    conversions INT DEFAULT 0,
    cost DECIMAL(10,2),
    revenue_generated DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: campaign_leads (junction table)
-- =====================================================
CREATE TABLE IF NOT EXISTS campaign_leads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    campaign_id INT NOT NULL,
    lead_id INT NOT NULL,
    status ENUM('pending', 'contacted', 'responded', 'converted', 'failed', 'opted_out') DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    responded_at TIMESTAMP NULL,
    ai_call_id VARCHAR(100),
    ai_call_duration INT,
    ai_recording_url VARCHAR(500),
    ai_transcript TEXT,
    ai_outcome ENUM('meeting_booked', 'callback_requested', 'not_interested', 'voicemail', 'no_answer', 'wrong_number', 'other'),
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    UNIQUE KEY unique_campaign_lead (campaign_id, lead_id),
    INDEX idx_campaign_id (campaign_id),
    INDEX idx_lead_id (lead_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: email_templates
-- =====================================================
CREATE TABLE IF NOT EXISTS email_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT,
    body_text TEXT,
    category ENUM('cold_outreach', 'follow_up', 'meeting_request', 'proposal', 'breakup', 'nurture', 'other') DEFAULT 'cold_outreach',
    variables JSON,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    ai_prompt TEXT,
    performance_opens INT DEFAULT 0,
    performance_clicks INT DEFAULT 0,
    performance_replies INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: call_scripts
-- =====================================================
CREATE TABLE IF NOT EXISTS call_scripts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    industry VARCHAR(100),
    target_role VARCHAR(100),
    script_type ENUM('intro', 'demo', 'followup', 'referral', 'close', 'voicemail') DEFAULT 'intro',
    tone ENUM('consultative', 'direct', 'friendly', 'urgent') DEFAULT 'consultative',
    opening TEXT,
    hook TEXT,
    value_proposition TEXT,
    ask TEXT,
    close TEXT,
    objections JSON,
    is_ai_optimized BOOLEAN DEFAULT FALSE,
    performance_calls INT DEFAULT 0,
    performance_success_rate DECIMAL(5,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_industry (industry)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: api_integrations (store API keys securely)
-- =====================================================
CREATE TABLE IF NOT EXISTS api_integrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    api_secret_encrypted TEXT,
    settings JSON,
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_service (user_id, service_name),
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: settings (user preferences)
-- =====================================================
CREATE TABLE IF NOT EXISTS settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    timezone VARCHAR(50) DEFAULT 'America/New_York',
    date_format VARCHAR(20) DEFAULT 'MM/DD/YYYY',
    currency VARCHAR(3) DEFAULT 'USD',
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    daily_call_limit INT DEFAULT 100,
    ai_auto_schedule BOOLEAN DEFAULT FALSE,
    ai_objection_handling BOOLEAN DEFAULT TRUE,
    ai_voicemail_drop BOOLEAN DEFAULT TRUE,
    ai_sentiment_analysis BOOLEAN DEFAULT TRUE,
    working_hours_start TIME DEFAULT '09:00:00',
    working_hours_end TIME DEFAULT '17:00:00',
    working_days JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: subscriptions (for SaaS billing)
-- =====================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name VARCHAR(50) NOT NULL,
    plan_tier ENUM('starter', 'professional', 'enterprise', 'agency') DEFAULT 'starter',
    status ENUM('active', 'cancelled', 'past_due', 'trialing') DEFAULT 'trialing',
    price DECIMAL(10,2) NOT NULL,
    billing_cycle ENUM('monthly', 'annual') DEFAULT 'monthly',
    trial_ends_at TIMESTAMP NULL,
    current_period_start TIMESTAMP NULL,
    current_period_end TIMESTAMP NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    payment_method_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    features JSON,
    limits JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sms_conversations (Agentic SMS Dispatch)
-- One row per lead phone number the SMS agent is talking to.
-- Individual messages reuse lead_activities (activity_type='sms').
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lead_id INT,
    phone VARCHAR(20) NOT NULL,
    status ENUM('ai_active', 'human_handoff', 'resolved') DEFAULT 'ai_active',
    unread_count INT DEFAULT 0,
    last_message_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_phone (user_id, phone),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sms_availability (bookable slots for the SMS scheduling agent)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_availability (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    day_of_week TINYINT NOT NULL, -- 0 = Sunday ... 6 = Saturday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sms_appointments (booked via the SMS agent or manually)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_appointments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lead_id INT,
    client_name VARCHAR(200) NOT NULL,
    client_phone VARCHAR(20) NOT NULL,
    service_type VARCHAR(150) NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status ENUM('pending', 'confirmed', 'cancelled', 'no_show', 'completed') DEFAULT 'confirmed',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sms_reminders (auto-scheduled reminders for appointments)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    appointment_id INT NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    recipient_name VARCHAR(200),
    message TEXT NOT NULL,
    send_at DATETIME NOT NULL,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES sms_appointments(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_send_at (send_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- TABLE: sms_handoffs (escalations to a human operator)
-- =====================================================
CREATE TABLE IF NOT EXISTS sms_handoffs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    lead_id INT,
    phone VARCHAR(20) NOT NULL,
    lead_name VARCHAR(200),
    reason ENUM('confused', 'risky', 'angry', 'payment_related', 'manual') DEFAULT 'manual',
    status ENUM('pending', 'resolved') DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- Extend settings with Agentic SMS Dispatch configuration
-- (kept as one JSON column, consistent with ai_settings/features/limits above)
-- =====================================================
ALTER TABLE settings ADD COLUMN sms_agent_settings JSON;

-- =====================================================
-- INSERT SAMPLE DATA
-- =====================================================

-- Sample admin user (password: admin123 - change in production!)
-- Password hash is for 'admin123' using bcrypt
INSERT INTO users (email, password_hash, first_name, last_name, company_name, role, status, api_key) VALUES
('admin@leadgenpro.com', '$2y$12$JFkUa20q0EvpaU8O3D7cJO0qckANbTMx.zy3jUE6MfeHJde3sQWqe', 'Admin', 'User', 'LeadGen Pro', 'admin', 'active', CONCAT('lgp_', SUBSTRING(MD5(RAND()), 1, 32)));

-- Sample settings for admin
INSERT INTO settings (user_id, timezone, working_hours_start, working_hours_end, working_days, sms_agent_settings) VALUES
(1, 'America/New_York', '09:00:00', '17:00:00', '["monday","tuesday","wednesday","thursday","friday"]',
'{"systemPrompt": "You are the friendly, efficient AI SMS assistant for this business. Greet leads, answer questions about services, and book appointments. Keep replies short and SMS-friendly (under 160 characters when possible).", "blockedWords": ["scam", "spam", "hack", "fraud", "illegal"], "optOutStrings": ["stop", "unsubscribe", "cancel", "quit"], "allowAIReplies": true, "appointmentDurationMinutes": 60, "availableServices": ["Consultation", "Follow-up", "Demo"], "twilioAccountSid": "", "twilioAuthToken": "", "twilioPhoneNumber": "", "openaiApiKey": ""}');

-- Sample SMS availability (Mon-Fri, business hours) for admin
INSERT INTO sms_availability (user_id, day_of_week, start_time, end_time) VALUES
(1, 1, '09:00:00', '12:00:00'), (1, 1, '13:00:00', '17:00:00'),
(1, 2, '09:00:00', '12:00:00'), (1, 2, '13:00:00', '17:00:00'),
(1, 3, '09:00:00', '12:00:00'), (1, 3, '13:00:00', '17:00:00'),
(1, 4, '09:00:00', '12:00:00'), (1, 4, '13:00:00', '17:00:00'),
(1, 5, '09:00:00', '12:00:00'), (1, 5, '13:00:00', '17:00:00');

-- Sample subscription
INSERT INTO subscriptions (user_id, plan_name, plan_tier, status, price, billing_cycle, features, limits) VALUES
(1, 'Professional', 'professional', 'trialing', 97.00, 'monthly', 
'{"ai_calls": true, "email_automation": true, "analytics": true, "api_access": true}',
'{"max_leads": 10000, "max_campaigns": 50, "max_ai_calls_per_day": 500, "max_users": 5}');

-- Sample email templates
INSERT INTO email_templates (user_id, name, subject, body_html, body_text, category) VALUES
(1, 'Cold Outreach - SaaS', 'Quick question about {{company}}', 
'<p>Hi {{first_name}},</p><p>I noticed {{company}} is growing fast...</p>', 
'Hi {{first_name}}, I noticed {{company}}...', 'cold_outreach');

-- Sample call script
INSERT INTO call_scripts (user_id, name, industry, target_role, script_type, tone, opening, hook, value_proposition, ask, close, objections) VALUES
(1, 'SaaS Intro - CEOs', 'saas', 'ceo', 'intro', 'consultative',
'Hi {{name}}, this is {{caller_name}} from {{company}}. Do you have 30 seconds?',
'I am reaching out because I noticed many founders are struggling with {{pain_point}}.',
'What we do is simple: {{value_prop}}. The result? 30-40% improvement in 60 days.',
'I would love to show you how this works. Do you have 15 minutes Tuesday or Wednesday?',
'What do you say we start with a brief conversation?',
'[{"objection": "Not interested", "response": "I understand. Most say that initially..."}]');

-- =====================================================
-- VIEWS FOR REPORTING
-- =====================================================

-- View: Lead summary with activity count
CREATE OR REPLACE VIEW lead_summary AS
SELECT 
    l.*,
    u.first_name as assigned_first_name,
    u.last_name as assigned_last_name,
    COUNT(a.id) as activity_count,
    MAX(a.created_at) as last_activity_date
FROM leads l
LEFT JOIN users u ON l.assigned_to = u.id
LEFT JOIN lead_activities a ON l.id = a.lead_id
GROUP BY l.id;

-- View: Campaign performance
CREATE OR REPLACE VIEW campaign_performance AS
SELECT 
    c.*,
    COUNT(cl.id) as total_leads_added,
    SUM(CASE WHEN cl.status = 'contacted' THEN 1 ELSE 0 END) as contacted_count,
    SUM(CASE WHEN cl.status = 'responded' THEN 1 ELSE 0 END) as response_count,
    SUM(CASE WHEN cl.status = 'converted' THEN 1 ELSE 0 END) as conversion_count,
    ROUND((SUM(CASE WHEN cl.status = 'converted' THEN 1 ELSE 0 END) / COUNT(cl.id)) * 100, 2) as conversion_rate
FROM campaigns c
LEFT JOIN campaign_leads cl ON c.id = cl.campaign_id
GROUP BY c.id;

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

DELIMITER //

-- Procedure: Get leads for AI campaign
CREATE PROCEDURE GetLeadsForAICampaign(
    IN p_user_id INT,
    IN p_quality VARCHAR(20),
    IN p_limit INT
)
BEGIN
    SELECT 
        id, first_name, last_name, phone, company_name, job_title, industry
    FROM leads 
    WHERE user_id = p_user_id 
    AND status = 'new'
    AND (p_quality IS NULL OR quality = p_quality)
    AND phone IS NOT NULL
    ORDER BY created_at DESC
    LIMIT p_limit;
END //

-- Procedure: Log AI call result
CREATE PROCEDURE LogAICallResult(
    IN p_campaign_id INT,
    IN p_lead_id INT,
    IN p_call_id VARCHAR(100),
    IN p_duration INT,
    IN p_recording_url VARCHAR(500),
    IN p_transcript TEXT,
    IN p_outcome VARCHAR(50),
    IN p_sentiment VARCHAR(20)
)
BEGIN
    -- Update campaign_leads
    UPDATE campaign_leads 
    SET 
        status = CASE 
            WHEN p_outcome = 'meeting_booked' THEN 'converted'
            WHEN p_outcome IN ('callback_requested', 'not_interested') THEN 'responded'
            ELSE 'contacted'
        END,
        ai_call_id = p_call_id,
        ai_call_duration = p_duration,
        ai_recording_url = p_recording_url,
        ai_transcript = p_transcript,
        ai_outcome = p_outcome,
        sent_at = NOW()
    WHERE campaign_id = p_campaign_id AND lead_id = p_lead_id;

    -- Add activity log
    INSERT INTO lead_activities (lead_id, activity_type, direction, content, duration_seconds, call_recording_url, ai_transcript, ai_sentiment)
    VALUES (p_lead_id, 'ai_call', 'outbound', CONCAT('AI Call Outcome: ', p_outcome), p_duration, p_recording_url, p_transcript, p_sentiment);

    -- Update lead status
    UPDATE leads 
    SET 
        status = CASE 
            WHEN p_outcome = 'meeting_booked' THEN 'qualified'
            ELSE 'contacted'
        END,
        last_contacted_at = NOW()
    WHERE id = p_lead_id;
END //

DELIMITER ;

-- =====================================================
-- TRIGGERS
-- =====================================================

DELIMITER //

-- Trigger: Update campaign stats when lead status changes
CREATE TRIGGER update_campaign_stats
AFTER UPDATE ON campaign_leads
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        UPDATE campaigns 
        SET 
            contacted_leads = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status IN ('contacted', 'responded', 'converted')),
            responses = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status IN ('responded', 'converted')),
            meetings_booked = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND ai_outcome = 'meeting_booked'),
            conversions = (SELECT COUNT(*) FROM campaign_leads WHERE campaign_id = NEW.campaign_id AND status = 'converted')
        WHERE id = NEW.campaign_id;
    END IF;
END //

-- Trigger: Log lead creation activity
CREATE TRIGGER log_lead_created
AFTER INSERT ON leads
FOR EACH ROW
BEGIN
    INSERT INTO lead_activities (lead_id, user_id, activity_type, direction, content)
    VALUES (NEW.id, NEW.user_id, 'note', 'internal', CONCAT('Lead created via ', NEW.source));
END //

DELIMITER ;
