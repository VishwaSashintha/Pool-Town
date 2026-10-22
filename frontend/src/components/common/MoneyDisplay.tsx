import React from "react";
import { formatLKR } from "@/lib/money";

interface MoneyDisplayProps {
  paise: number;
  className?: string;
  showDecimals?: boolean;
  highlightZero?: boolean;
}

export const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  paise,
  className = "",
  showDecimals = true,
  highlightZero = false,
}) => {
  const isZero = paise === 0;
  const isNegative = paise < 0;

  let colorClass = "text-foreground";
  if (isNegative) {
    colorClass = "text-rose-400";
  } else if (isZero && highlightZero) {
    colorClass = "text-muted-foreground";
  }

  return (
    <span className={`font-mono font-medium tracking-tight ${colorClass} ${className}`}>
      {formatLKR(paise, showDecimals)}
    </span>
  );
};
