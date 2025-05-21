import { memo } from "react";

// Simple reusable stat item
const IconHolder = ({
  icon,
  label,
  value,
  bgColor = "bg-emerald-100 dark:bg-emerald-900/30",
  textColor = "text-emerald-600 dark:text-emerald-400",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bgColor?: string;
  textColor?: string;
}) => (
  <div className="flex items-center gap-2">
    <div
      className={`w-7.5 h-7.5 ${bgColor} p-1.5 rounded-lg flex items-center justify-center ${textColor}`}
    >
      {icon}
    </div>
    <span className="text-muted-foreground">{label}:</span>
    <span className="text-foreground font-medium">{value}</span>
  </div>
);

export default memo(IconHolder);
