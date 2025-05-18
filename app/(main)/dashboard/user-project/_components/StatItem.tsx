export const StatItem = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <div className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 transition-colors">
    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted/60">
      {icon}
    </div>
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);
