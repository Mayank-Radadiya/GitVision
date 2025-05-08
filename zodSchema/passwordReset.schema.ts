import * as z from "zod";

export const passwordResetSchema = z
  .object({
    password: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(6, { message: "Password should contain at least 6 characters" })
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[@$!%*?&]/,
        "Password must contain at least one special character"
      ),

    conformPassword: z
      .string()
      .nonempty({ message: "Confirm password is required" }),
  })
  .refine((data) => data.password === data.conformPassword, {
    message: "Passwords must match",
    path: ["conformPassword"],
  });
