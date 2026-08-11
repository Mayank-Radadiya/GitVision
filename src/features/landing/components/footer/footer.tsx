import { memo } from "react";
import { FooterBrand } from "./footer-brand";
import { FooterLinks } from "./footer-links";
import { FooterBottom } from "./footer-bottom";

function Footer() {
  return (
    <footer
      id="footer"
      className="border-border/40 from-background to-background/95 border-t bg-linear-to-b"
    >
      <div className="container mx-auto max-w-7xl px-6 py-14">
        {/* Gradient divider */}
        <div className="via-primary/30 mb-12 h-px w-full bg-linear-to-r from-transparent to-transparent" />

        {/* Main grid: brand + link columns */}
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <FooterBrand />
          </div>
          <div className="lg:col-span-3">
            <FooterLinks />
          </div>
        </div>

        <FooterBottom />
      </div>
    </footer>
  );
}

export default memo(Footer);
