import { Card } from "../ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { memo } from "react";

interface DashboardCardProps {
  number: number;
  name: string;
  icon: LucideIcon;
  color?: string;
  description?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  number,
  name,
  icon: Icon,
  color = "blue",
  description,
}) => {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-400/10 text-blue-700 dark:text-blue-400",
    green:
      "from-green-500/20 to-green-400/10 text-green-700 dark:text-green-400",
    purple:
      "from-purple-500/20 to-purple-400/10 text-purple-700 dark:text-purple-400",
    amber:
      "from-amber-500/20 to-amber-400/10 text-amber-700 dark:text-amber-400",
    rose: "from-rose-500/20 to-rose-400/10 text-rose-700 dark:text-rose-400",
    indigo:
      "from-indigo-500/20 to-indigo-400/10 text-indigo-700 dark:text-indigo-400",
    cyan: "from-cyan-500/20 to-cyan-400/10 text-cyan-700 dark:text-cyan-400",
  };

  const iconBgClasses = {
    blue: "bg-gradient-to-br from-blue-600 to-blue-400 text-white",
    green: "bg-gradient-to-br from-green-600 to-green-400 text-white",
    purple: "bg-gradient-to-br from-purple-600 to-purple-400 text-white",
    amber: "bg-gradient-to-br from-amber-600 to-amber-400 text-white",
    rose: "bg-gradient-to-br from-rose-600 to-rose-400 text-white",
    indigo: "bg-gradient-to-br from-indigo-600 to-indigo-400 text-white",
    cyan: "bg-gradient-to-br from-cyan-600 to-cyan-400 text-white",
  };

  const borderColorClasses = {
    blue: "border-blue-200 dark:border-blue-800/30",
    green: "border-green-200 dark:border-green-800/30",
    purple: "border-purple-200 dark:border-purple-800/30",
    amber: "border-amber-200 dark:border-amber-800/30",
    rose: "border-rose-200 dark:border-rose-800/30",
    indigo: "border-indigo-200 dark:border-indigo-800/30",
    cyan: "border-cyan-200 dark:border-cyan-800/30",
  };

  const bottomGradientClasses = {
    blue: "bg-gradient-to-r from-blue-500 to-blue-300",
    green: "bg-gradient-to-r from-green-500 to-green-300",
    purple: "bg-gradient-to-r from-purple-500 to-purple-300",
    amber: "bg-gradient-to-r from-amber-500 to-amber-300",
    rose: "bg-gradient-to-r from-rose-500 to-rose-300",
    indigo: "bg-gradient-to-r from-indigo-500 to-indigo-300",
    cyan: "bg-gradient-to-r from-cyan-500 to-cyan-300",
  };

  return (
    <motion.div
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.2 },
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className={cn(
          "overflow-hidden border rounded-xl hover:shadow-lg transition-all duration-300 backdrop-blur-sm min-h-[160px]",
          "bg-gradient-to-br dark:bg-gray-900/70",
          "relative group",
          colorClasses[color as keyof typeof colorClasses],
          borderColorClasses[color as keyof typeof borderColorClasses]
        )}
      >
        <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 z-0"></div>

        <div className="relative z-10 p-5">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <h2 className="font-semibold text-gray-800 dark:text-gray-100">
                {name}
              </h2>
              {description && (
                <p className="text-xs text-muted-foreground  leading-snug">
                  {description}
                </p>
              )}
            </div>

            <div
              className={cn(
                "rounded-lg w-12 h-12 flex items-center justify-center shadow-md",
                "transition-all duration-300",
                iconBgClasses[color as keyof typeof iconBgClasses]
              )}
            >
              <Icon className="size-6" />
            </div>
          </div>

          <div className="mt-6">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {number.toLocaleString()}
            </p>
          </div>
        </div>

        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1 z-10 transition-all duration-300 group-hover:h-1.5",
            bottomGradientClasses[color as keyof typeof bottomGradientClasses]
          )}
        />
      </Card>
    </motion.div>
  );
};

export default memo(DashboardCard);
