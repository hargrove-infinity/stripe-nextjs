import type { ErrorResponse } from "@/types";
import type Stripe from "stripe";

import { and, eq } from "drizzle-orm";
import { ApiError } from "next/dist/server/api-utils";
import { NextResponse } from "next/server";
import z, { ZodError } from "zod";

import { db } from "@/db";
import { customerTable } from "@/db/schema";
import { stripe } from "@/stripe";
import { createCustomerInputSchema } from "@/validation";

type Customer = Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>;

export async function POST(req: Request): Promise<NextResponse<Customer | ErrorResponse>> {
  try {
    const body: unknown = await req.json();

    const input = createCustomerInputSchema.parse(body);

    const customerRecord = await db.query.customerTable.findFirst({
      where: and(eq(customerTable.email, input.email), eq(customerTable.name, input.name)),
    });

    // Customer exists in the database and is already linked to a Stripe customer
    if (customerRecord && customerRecord.stripeCustomerId) {
      const stripeCustomer = await stripe.customers.retrieve(customerRecord.stripeCustomerId);

      return NextResponse.json({
        message: "Stripe customer retrieved successfully",
        customer: stripeCustomer,
      });
    }

    // Customer exists in the database but is not linked to a Stripe customer
    if (customerRecord && !customerRecord.stripeCustomerId) {
      const stripeCustomer = await stripe.customers.create({
        ...input,
        metadata: {
          appCustomerId: customerRecord.id,
        },
      });

      await db
        .update(customerTable)
        .set({ stripeCustomerId: stripeCustomer.id })
        .where(eq(customerTable.id, customerRecord.id));

      return NextResponse.json({
        message: "Stripe customer created and linked successfully",
        customer: stripeCustomer,
      });
    }

    // Customer does not exist in the database
    const [createdCustomerRecord] = await db.insert(customerTable).values(input).returning();

    const stripeCustomer = await stripe.customers.create({
      ...input,
      metadata: {
        appCustomerId: createdCustomerRecord.id,
      },
    });

    await db
      .update(customerTable)
      .set({ stripeCustomerId: stripeCustomer.id })
      .where(eq(customerTable.id, createdCustomerRecord.id));

    return NextResponse.json({
      message: "Customer created and linked to Stripe successfully",
      customer: stripeCustomer,
    });
  } catch (error) {
    if (!(error instanceof Error)) {
      return NextResponse.json({ message: "Unknown error occurred" }, { status: 500 });
    }

    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }

    if (error instanceof ZodError) {
      const message = z.prettifyError(error);
      return NextResponse.json({ message }, { status: 422 });
    }

    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
