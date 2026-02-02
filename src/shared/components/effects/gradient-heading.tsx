import { cn } from "@/shared/lib/utils";

interface GradientHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4";
  children: React.ReactNode;
  className?: string;
}

export function GradientHeading({
  as: Component = "h2",
  children,
  className,
}: GradientHeadingProps) {
  return (
    <Component
      className={cn(
        "font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent",
        Component === "h1" && "text-3xl md:text-4xl lg:text-5xl",
        Component === "h2" && "text-3xl md:text-4xl",
        Component === "h3" && "text-2xl md:text-3xl",
        Component === "h4" && "text-xl md:text-2xl",
        className
      )}
    >
      {children}
    </Component>
  );
}
