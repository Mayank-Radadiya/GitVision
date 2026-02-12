export type NavItem = {
  name: string;
  href: string;
  sectionId: string;
};

export const NAVIGATION: NavItem[] = [
  { name: "Features", href: "#features", sectionId: "features" },
  { name: "Pricing", href: "#pricing", sectionId: "pricing" },
  { name: "Contact", href: "#footer", sectionId: "footer" },
];

export const GITHUB_REPO_URL = "https://github.com/Mayank-Radadiya/GitVision";

export const SCROLL_SPY_OFFSET = 100;
export const SCROLL_THRESHOLD = 20;
export const MOBILE_BREAKPOINT = 768;
