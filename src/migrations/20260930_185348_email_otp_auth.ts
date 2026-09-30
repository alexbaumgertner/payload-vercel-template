import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "auth_codes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"email" varchar NOT NULL,
  	"code_hash" varchar NOT NULL,
  	"expires_at" timestamp(3) with time zone NOT NULL,
  	"attempts" numeric DEFAULT 0,
  	"request_ip" varchar,
  	"delivered" boolean DEFAULT false,
  	"consumed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "auth_codes_id" integer;
  CREATE INDEX "auth_codes_email_idx" ON "auth_codes" USING btree ("email");
  CREATE INDEX "auth_codes_request_ip_idx" ON "auth_codes" USING btree ("request_ip");
  CREATE INDEX "auth_codes_updated_at_idx" ON "auth_codes" USING btree ("updated_at");
  CREATE INDEX "auth_codes_created_at_idx" ON "auth_codes" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_auth_codes_fk" FOREIGN KEY ("auth_codes_id") REFERENCES "public"."auth_codes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_auth_codes_id_idx" ON "payload_locked_documents_rels" USING btree ("auth_codes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "auth_codes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "auth_codes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_auth_codes_fk";
  
  DROP INDEX "payload_locked_documents_rels_auth_codes_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "auth_codes_id";`)
}
