-- SQL dump generated using DBML (dbml.dbdiagram.io)
-- Database: PostgreSQL
-- Generated at: 2025-05-12T16:43:10.105Z

CREATE TABLE "users" (
  "id" serial PRIMARY KEY,
  "username" varchar UNIQUE NOT NULL,
  "password_hash" varchar NOT NULL,
  "full_name" varchar,
  "email" varchar UNIQUE,
  "role" varchar NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "orders" (
  "id" serial PRIMARY KEY,
  "city" varchar,
  "subdivision" varchar,
  "pick_up_point" varchar,
  "order_number" varchar,
  "order_date" timestamp,
  "delivery_date" timestamp,
  "customer_id" varchar,
  "telephone" varchar,
  "name" varchar,
  "last_name" varchar,
  "birthday" date,
  "car_brand" varchar,
  "car_model" varchar,
  "category" varchar,
  "brand" varchar,
  "article_number" varchar,
  "product" varchar,
  "quantity" int,
  "revenue" float,
  "cost_price" float,
  "entry_date" timestamp,
  "entry_user" varchar,
  "session_id" int,
  "client_id" int
);

CREATE TABLE "companies" (
  "id" serial PRIMARY KEY,
  "name" varchar NOT NULL,
  "inn" varchar UNIQUE NOT NULL,
  "kpp" varchar,
  "legal_address" varchar,
  "actual_address" varchar,
  "bank_details" varchar,
  "contact_persons" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "company_representatives" (
  "id" serial PRIMARY KEY,
  "company_id" int NOT NULL,
  "full_name" varchar NOT NULL,
  "position" varchar,
  "email" varchar,
  "phone" varchar,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "field_mappings" (
  "id" serial PRIMARY KEY,
  "client_id" int NOT NULL,
  "name" varchar(255) NOT NULL,
  "mapping" jsonb NOT NULL,
  "sample_data_url" text,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp DEFAULT (now())
);

CREATE TABLE "import_history" (
  "id" serial PRIMARY KEY,
  "client_id" int,
  "user_id" int NOT NULL,
  "file_name" varchar NOT NULL,
  "custom_name" varchar(255),
  "source_type" varchar,
  "source_link" varchar,
  "status" varchar NOT NULL,
  "field_mapping_id" int,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "dictionaries" (
  "id" serial PRIMARY KEY,
  "type" varchar NOT NULL,
  "value" varchar NOT NULL,
  "extra" varchar,
  "user_id" int,
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "aliases" (
  "id" serial PRIMARY KEY,
  "dictionary_id" int NOT NULL,
  "alias" varchar NOT NULL,
  "user_id" int,
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "blocklists" (
  "id" serial PRIMARY KEY,
  "company_id" int,
  "user_id" int,
  "phone" varchar NOT NULL,
  "is_deleted" boolean DEFAULT false,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp
);

CREATE TABLE "clients" (
  "id" serial PRIMARY KEY,
  "name" varchar NOT NULL,
  "logo_url" TEXT,
  "created_at" timestamp DEFAULT (now()),
  "updated_at" timestamp
);

ALTER TABLE "company_representatives" ADD FOREIGN KEY ("company_id") REFERENCES "companies" ("id");

ALTER TABLE "field_mappings" ADD FOREIGN KEY ("client_id") REFERENCES "clients" ("id");

ALTER TABLE "import_history" ADD FOREIGN KEY ("client_id") REFERENCES "clients" ("id");

ALTER TABLE "import_history" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "import_history" ADD FOREIGN KEY ("field_mapping_id") REFERENCES "field_mappings" ("id");

ALTER TABLE "dictionaries" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "aliases" ADD FOREIGN KEY ("dictionary_id") REFERENCES "dictionaries" ("id");

ALTER TABLE "aliases" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "blocklists" ADD FOREIGN KEY ("company_id") REFERENCES "companies" ("id");

ALTER TABLE "blocklists" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "orders" ADD FOREIGN KEY ("client_id") REFERENCES "clients" ("id");

-- Добавление администратора по умолчанию
-- ВАЖНО: Этот INSERT будет пытаться выполниться при каждом применении schema.sql.
-- Если пользователь 'admin' уже существует, это вызовет ошибку уникальности.
INSERT INTO users (username, password_hash, full_name, email, role, user_type, client_id, company_id, created_at, updated_at)
SELECT 'admin', '$2b$10$4SluI.tlGqV7ZYD4Db3WR.kb5UFqolBXOdvhhDcBbIhsnsEdu6xxu', 'Администратор', 'dda_5000@mail.ru', 'admin', 'INTERNAL', NULL, NULL, NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'admin');
