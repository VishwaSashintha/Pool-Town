/**
 * PlaceholderPage — clean placeholder for sections under development.
 * Shows a meaningful empty state instead of a blank screen.
 */
import React from "react";
import { Construction } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ title, description }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div
        className="flex items-center justify-center w-16 h-16 rounded-2xl mb-6"
        style={{ backgroundColor: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}
      >
        <Construction className="w-8 h-8" style={{ color: "#38BDF8" }} />
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: "#F8FAFC" }}>
        {title}
      </h2>
      {description && (
        <p className="text-sm max-w-md" style={{ color: "#64748B" }}>
          {description}
        </p>
      )}
      <p className="text-xs mt-4" style={{ color: "#475569" }}>
        This section is being built. Core functionality is available in other modules.
      </p>
    </div>
  );
};
