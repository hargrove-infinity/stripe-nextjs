import type { ErrorResponse } from "@/types";

import { ApiError } from "next/dist/server/api-utils";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import z, { ZodError } from "zod";

import { stripe } from "@/stripe";
import { createProductInputSchema } from "@/validation";

type Product = {
  product_id: string;
  name: string;
  description: string | null;
  first_image: string | null;
  price_id: string;
  amount: Stripe.Decimal | null;
  currency: string;
  type: Stripe.Price.Type;
  recurring_interval: Stripe.Price.Recurring.Interval | null;
};

export async function POST(req: Request): Promise<NextResponse<Product | ErrorResponse>> {
  try {
    const body: unknown = await req.json();

    const input = createProductInputSchema.parse(body);

    const product = await stripe.products.retrieve(input.productId);

    if (!product.default_price) {
      throw new ApiError(422, "Price is missing");
    }

    const priceId =
      typeof product.default_price === "string"
        ? product.default_price
        : product.default_price.id;

    const price = await stripe.prices.retrieve(priceId);

    const relatedProduct: Product = {
      product_id: product.id,
      name: product.name,
      description: product.description,
      first_image: product.images[0] || null,
      price_id: priceId,
      amount: price.unit_amount_decimal,
      currency: price.currency,
      type: price.type,
      recurring_interval: price.recurring?.interval || null,
    };

    return NextResponse.json(relatedProduct);
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

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        { message: "Unable to retrieve product information" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}
