import * as z from "zod";

export const signUpZodSchema = z
  .object({
    // `z.email()` is the Zod 4 top-level form. The chained `.nonempty()` is kept
    // because it is the only thing that reports an empty field as "required"
    // rather than "invalid address" — dropping it would make the message below
    // unreachable. `z.email()` still supports the chain, verified by the test
    // that asserts both messages.
    email: z.email().nonempty({ message: "Email is required" }),
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
