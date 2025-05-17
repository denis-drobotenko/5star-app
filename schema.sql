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
  "session_id" varchar
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
  "company_id" int NOT NULL,
  "client_field" varchar NOT NULL,
  "system_field" varchar NOT NULL,
  "created_at" timestamp DEFAULT (now())
);

CREATE TABLE "import_history" (
  "id" serial PRIMARY KEY,
  "company_id" int NOT NULL,
  "user_id" int NOT NULL,
  "file_name" varchar NOT NULL,
  "source_type" varchar,
  "source_link" varchar,
  "status" varchar NOT NULL,
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

ALTER TABLE "field_mappings" ADD FOREIGN KEY ("company_id") REFERENCES "companies" ("id");

ALTER TABLE "import_history" ADD FOREIGN KEY ("company_id") REFERENCES "companies" ("id");

ALTER TABLE "import_history" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "dictionaries" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "aliases" ADD FOREIGN KEY ("dictionary_id") REFERENCES "dictionaries" ("id");

ALTER TABLE "aliases" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");

ALTER TABLE "blocklists" ADD FOREIGN KEY ("company_id") REFERENCES "companies" ("id");

ALTER TABLE "blocklists" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id");
