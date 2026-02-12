export function FooterBottom() {
  const year = new Date().getFullYear();

  return (
    <div className="flex flex-col sm:flex-row justify-between items-center border-t border-border/30 pt-6 gap-3">
      <p className="text-xs text-muted-foreground">
        &copy; {year} GitVision. All rights reserved.
      </p>
      <p className="text-xs text-muted-foreground/60">
        Built with ❤️ for developers
      </p>
    </div>
  );
}
