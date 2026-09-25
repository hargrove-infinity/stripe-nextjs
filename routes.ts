export const routes = {
  product: (id: string) => `/products/${id}`,
  checkoutSuccess: "/checkout/success",
} as const;
