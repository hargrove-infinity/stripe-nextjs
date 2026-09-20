CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	CONSTRAINT "customers_email_unique" UNIQUE("email")
);
