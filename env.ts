import { envSchema } from "./validation";

export const env = envSchema.parse(process.env);
