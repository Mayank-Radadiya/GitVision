import { cn } from "@/shared/lib/utils";

interface GradientHeadingProps {
  as?: "h1" | "h2" | "h3" | "h4";
  children: React.ReactNode;
  className?: string;
}

const SIZE_CLASSES: Record<string, string> = {
  h1: "text-3xl md:text-4xl lg:text-5xl",
  h2: "text-3xl md:text-4xl",
  h3: "text-2xl md:text-3xl",
  h4: "text-xl md:text-2xl",
};

export function GradientHeading({
  as: Component = "h2",
  children,
  className,
}: GradientHeadingProps) {
  return (
    <Component
      className={cn(
        "bg-linear-to-r from-blue-500 to-purple-600 bg-clip-text font-bold text-transparent",
        SIZE_CLASSES[Component] || SIZE_CLASSES.h2,
        className,
      )}
    >
      {children}
    </Component>
  );
}
