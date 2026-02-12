import Link from "next/link";
import Image from "next/image";
import { SOCIAL_LINKS } from "./constants";

export function FooterBrand() {
  return (
    <div className="space-y-5">
      <Link
        href="/"
        className="group flex items-center gap-3 transition-all duration-300"
      >
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-background via-background to-background ring-1 ring-primary/20 overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-primary/10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-80" />
          <Image
            src="/Github.svg"
            alt="GitVision Logo"
            width={26}
            height={26}
            className="relative z-10 transition-transform duration-300 group-hover:scale-110"
          />
        </div>
        <span className="text-xl font-bold tracking-tight">
          Git<span className="text-primary">Vision</span>
        </span>
      </Link>

      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
        AI-powered GitHub repository analysis that visualizes code patterns and
        provides meaningful insights into your development process.
      </p>

      {/* Social links */}
      <div className="flex items-center gap-4">
        {SOCIAL_LINKS.map((social) => (
          <Link
            key={social.label}
            href={social.href}
            aria-label={social.label}
            className="text-muted-foreground hover:text-primary transition-colors duration-200"
          >
            <social.icon className="h-4.5 w-4.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
