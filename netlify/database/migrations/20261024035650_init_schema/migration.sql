CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"actor_id" integer,
	"actor_email" varchar(120),
	"action" varchar(60) NOT NULL,
	"resource_type" varchar(40),
	"resource_id" varchar(100),
	"status" varchar(20) NOT NULL,
	"ip_address" varchar(45),
	"user_agent" varchar(255),
	"details" text
);
--> statement-breakpoint
CREATE TABLE "document_permissions" (
	"id" serial PRIMARY KEY,
	"document_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"permission_level" varchar(10) NOT NULL,
	"granted_by_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "uq_doc_user_permission" UNIQUE("document_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" serial PRIMARY KEY,
	"uuid" varchar(36) NOT NULL UNIQUE,
	"owner_id" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"original_filename" varchar(255) NOT NULL,
	"storage_filename" varchar(255) NOT NULL UNIQUE,
	"file_size" integer NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_extension" varchar(20) NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"category" varchar(50) DEFAULT 'Other' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revoked_tokens" (
	"id" serial PRIMARY KEY,
	"jti" varchar(36) NOT NULL UNIQUE,
	"user_id" integer NOT NULL,
	"revoked_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"email" varchar(120) NOT NULL UNIQUE,
	"username" varchar(64) NOT NULL UNIQUE,
	"password_hash" varchar(256) NOT NULL,
	"full_name" varchar(120) NOT NULL,
	"role" varchar(20) DEFAULT 'owner' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	"avatar_url" text
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_document_id_documents_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "document_permissions" ADD CONSTRAINT "document_permissions_granted_by_id_users_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_id_users_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "revoked_tokens" ADD CONSTRAINT "revoked_tokens_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;