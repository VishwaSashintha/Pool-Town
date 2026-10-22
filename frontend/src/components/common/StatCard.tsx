import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendType?: "up" | "down" | "neutral";
  accentColor?: "emerald" | "amber" | "blue" | "purple";
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendType = "neutral",
  accentColor = "emerald",
}) => {
  const colorMap = {
    emerald: "from-emerald-500/10 to-transparent text-emerald-400 border-emerald-500/20",
    amber: "from-amber-500/10 to-transparent text-amber-400 border-amber-500/20",
    blue: "from-cyan-500/10 to-transparent text-cyan-400 border-cyan-500/20",
    purple: "from-purple-500/10 to-transparent text-purple-400 border-purple-500/20",
  };

  const iconBgMap = {
    emerald: "bg-emerald-500/15 text-emerald-400",
    amber: "bg-amber-500/15 text-amber-400",
    blue: "bg-cyan-500/15 text-cyan-400",
    purple: "bg-purple-500/15 text-purple-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-b p-5 glass-panel glass-panel-hover ${colorMap[accentColor]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${iconBgMap[accentColor]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold tracking-tight text-foreground">{value}</div>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        {trend && (
          <p
            className={`mt-2 text-xs font-medium ${
              trendType === "up"
                ? "text-emerald-400"
                : trendType === "down"
                ? "text-rose-400"
                : "text-muted-foreground"
            }`}
          >
            {trend}
          </p>
        )}
      </div>
    </div>
  );
};
