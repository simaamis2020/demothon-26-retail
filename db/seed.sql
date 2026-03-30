-- ============================================================
-- Demothon-26 Retail Demo — MySQL Seed Script
-- Run: mysql -u root -p demo < db/seed.sql
-- ============================================================

USE demo;

-- ── Drop existing tables (safe re-run) ───────────────────────
DROP TABLE IF EXISTS purchase_history;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS customers;

-- ── Customers ────────────────────────────────────────────────
CREATE TABLE customers (
  customer_id   VARCHAR(20)  PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,  -- plaintext for demo only
  loyalty_tier  VARCHAR(20)  NOT NULL,
  points        INT          DEFAULT 0,
  discount_pct  INT          DEFAULT 0
);

INSERT INTO customers VALUES
  ('C001', 'Anna',  'anna@email.com',  'demo123', 'Gold',   2840, 18),
  ('C002', 'James', 'james@email.com', 'demo123', 'Silver', 1120, 11),
  ('C003', 'Maya',  'maya@email.com',  'demo123', 'New',    0,    0);

-- ── Products ─────────────────────────────────────────────────
CREATE TABLE products (
  plu           VARCHAR(10)    PRIMARY KEY,
  name          VARCHAR(150)   NOT NULL,
  category      VARCHAR(50),
  price_per_lb  DECIMAL(5,2),
  organic       BOOLEAN        DEFAULT FALSE,
  conventional_plu VARCHAR(10),        -- links organic to its conventional twin
  stock_store   INT            DEFAULT 0,
  stock_online  BOOLEAN        DEFAULT TRUE,
  aisle         VARCHAR(10)
);

INSERT INTO products VALUES
  ('4011',  'Bananas — Conventional',  'Fruit', 0.79, FALSE, NULL,   48, TRUE,  'A2'),
  ('94011', 'Bananas — Organic',       'Fruit', 0.95, TRUE,  '4011', 22, TRUE,  'A2'),
  ('4053',  'Broccoli — Conventional', 'Veg',   1.29, FALSE, NULL,   30, TRUE,  'A4'),
  ('94053', 'Broccoli — Organic',      'Veg',   1.79, TRUE,  '4053', 15, TRUE,  'A4'),
  ('3000',  'Kale Bunch — Organic',    'Veg',   2.49, TRUE,  NULL,   20, TRUE,  'A3'),
  ('4046',  'Avocado — Conventional',  'Fruit', 1.09, FALSE, NULL,   35, TRUE,  'A5'),
  ('94046', 'Avocado — Organic',       'Fruit', 1.39, TRUE,  '4046', 12, TRUE,  'A5');

-- ── Purchase history ─────────────────────────────────────────
CREATE TABLE purchase_history (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  customer_id   VARCHAR(20),
  product_plu   VARCHAR(10),
  product_name  VARCHAR(150),
  organic       BOOLEAN,
  purchased_at  DATE,
  quantity_lb   DECIMAL(4,2)
);

-- Anna: consistent organic buyer
INSERT INTO purchase_history (customer_id, product_plu, product_name, organic, purchased_at, quantity_lb) VALUES
  ('C001', '94011', 'Bananas — Organic',       TRUE,  '2025-12-01', 1.5),
  ('C001', '3000',  'Kale Bunch — Organic',    TRUE,  '2025-12-01', 1.0),
  ('C001', '94046', 'Avocado — Organic',       TRUE,  '2025-12-08', 0.5),
  ('C001', '94011', 'Bananas — Organic',       TRUE,  '2025-12-08', 2.0),
  ('C001', '94053', 'Broccoli — Organic',      TRUE,  '2025-12-15', 1.2),
  ('C001', '94011', 'Bananas — Organic',       TRUE,  '2025-12-22', 1.5),
  ('C001', '3000',  'Kale Bunch — Organic',    TRUE,  '2025-12-22', 1.0),
  ('C001', '94011', 'Bananas — Organic',       TRUE,  '2026-01-05', 2.0),
  ('C001', '94046', 'Avocado — Organic',       TRUE,  '2026-01-12', 1.0),
  ('C001', '94011', 'Bananas — Organic',       TRUE,  '2026-01-19', 1.5);

-- James: conventional buyer, no organic history
INSERT INTO purchase_history (customer_id, product_plu, product_name, organic, purchased_at, quantity_lb) VALUES
  ('C002', '4011',  'Bananas — Conventional',  FALSE, '2025-12-03', 2.0),
  ('C002', '4053',  'Broccoli — Conventional', FALSE, '2025-12-03', 1.0),
  ('C002', '4046',  'Avocado — Conventional',  FALSE, '2025-12-10', 1.5),
  ('C002', '4011',  'Bananas — Conventional',  FALSE, '2025-12-17', 2.0),
  ('C002', '4053',  'Broccoli — Conventional', FALSE, '2025-12-24', 1.0),
  ('C002', '4011',  'Bananas — Conventional',  FALSE, '2026-01-07', 2.5);

-- Maya: no history (new customer)
