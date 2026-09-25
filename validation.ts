import z from "zod";

export const envSchema = z.object({
  APP_URL: z.url(),
  STRIPE_SECRET_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
});

export const createProductInputSchema = z.object({
  productId: z.string().min(1),
});

export const createCustomerInputSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
});

export const createCheckoutSessionSchema = z.object({
  productId: z.string().min(1),
  customerId: z.string().min(1),
});
