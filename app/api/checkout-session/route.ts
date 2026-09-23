import type { ErrorResponse } from "@/types";

import { eq } from "drizzle-orm";
import { ApiError } from "next/dist/server/api-utils";
import { NextResponse } from "next/server";
import z, { ZodError } from "zod";

import { db } from "@/db";
import { customerTable } from "@/db/schema";
import { env } from "@/env";
import { routes } from "@/routes";
import { stripe } from "@/stripe";
import { createCheckoutSessionSchema } from "@/validation";

type CheckoutSessionUrl = { url: string | null };

export async function POST(
  req: Request,
): Promise<NextResponse<CheckoutSessionUrl | ErrorResponse>> {
  try {
    const body: unknown = await req.json();

    const input = createCheckoutSessionSchema.parse(body);

    const customer = await db.query.customerTable.findFirst({
      where: eq(customerTable.id, input.customerId),
    });

    if (!customer?.stripeCustomerId) {
      throw new ApiError(500, "Customer does not have stripe id");
    }

    const product = await stripe.products.retrieve(input.productId);

    if (!product.default_price) {
      throw new ApiError(422, "Price is missing");
    }

    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price.id;

    const session = await stripe.checkout.sessions.create({
      customer: customer.stripeCustomerId,
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}${routes.checkoutSuccess}`,
      cancel_url: `${env.APP_URL}${routes.product(input.productId)}`,
    });

    return NextResponse.json({ url: session.url });
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
