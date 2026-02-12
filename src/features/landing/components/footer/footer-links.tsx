import Link from "next/link";
import { FOOTER_LINKS } from "./constants";

export function FooterLinks() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
      {FOOTER_LINKS.map((group) => (
        <div key={group.title}>
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {group.title}
          </h3>
          <ul className="space-y-3">
            {group.links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-200"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
