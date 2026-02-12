import { memo } from "react";
import { FooterBrand } from "./footer-brand";
import { FooterLinks } from "./footer-links";
import { FooterBottom } from "./footer-bottom";

function Footer() {
  return (
    <footer
      id="footer"
      className="border-t border-border/40 bg-gradient-to-b from-background to-background/95"
    >
      <div className="container max-w-7xl mx-auto px-6 py-14">
        {/* Gradient divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent mb-12" />

        {/* Main grid: brand + link columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
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
