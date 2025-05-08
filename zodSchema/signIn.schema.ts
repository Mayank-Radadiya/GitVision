import * as z from "zod";

export const signInZodSchema = z.object({
  email: z
    .string()
    .nonempty({ message: "Email is required" })
    .email({ message: "Enter valid Email" }),

  password: z
    .string()
    .nonempty({ message: " Password is required" })
    .min(6, "Password should contain at least 6 characters"),
});
