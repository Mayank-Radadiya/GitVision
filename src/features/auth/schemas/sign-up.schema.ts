import * as z from "zod";

export const signUpZodSchema = z
  .object({
    email: z.string().email().nonempty({ message: "Email is required" }),
    password: z
      .string()
      .nonempty({ message: "Password is required" })
      .min(6, { message: "Password should contain at least 6 characters" })
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(
        /[@$!%*?&]/,
        "Password must contain at least one special character",
      ),
    confirmPassword: z
      .string()
      .nonempty({ message: "Confirm password is required" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });
