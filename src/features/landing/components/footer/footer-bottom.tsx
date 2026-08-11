export function FooterBottom() {
  const year = new Date().getFullYear();

  return (
    <div className="border-border/30 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
      <p className="text-muted-foreground text-xs">
        &copy; {year} GitVision. All rights reserved.
      </p>
      <p className="text-muted-foreground/60 text-xs">
        Built with ❤️ for developers
      </p>
    </div>
  );
}
