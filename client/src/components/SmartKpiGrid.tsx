import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { Link } from "wouter";

interface KpiCardData {
  label: string;
  value: string;
  sublabel?: string;
  trend?: { value: number; label: string };
  variant: "primary" | "dark" | "light" | "outline";
  icon?: React.ReactNode;
  href?: string;
}

interface SmartKpiGridProps {
  cards: KpiCardData[];
}

export default function SmartKpiGrid({ cards }: SmartKpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => (
        <SmartKpiCard key={idx} {...card} index={idx} />
      ))}
    </div>
  );
}

function SmartKpiCard({ label, value, sublabel, trend, variant, icon, href, index }: KpiCardData & { index: number }) {
  const variantStyles = {
    primary: {
      container: "vm-card-primary",
      label: "text-white/80",
      value: "text-white",
      sublabel: "text-white/70",
      iconBg: "bg-white/20",
    },
    dark: {
      container: "vm-card-dark",
      label: "text-white/70",
      value: "text-white",
      sublabel: "text-white/60",
      iconBg: "bg-white/10",
    },
    light: {
      container: "vm-card-elevated",
      label: "text-muted-foreground",
      value: "text-foreground",
      sublabel: "text-muted-foreground",
      iconBg: "bg-primary/10",
    },
    outline: {
      container: "vm-card",
      label: "text-muted-foreground",
      value: "text-foreground",
      sublabel: "text-muted-foreground",
      iconBg: "bg-primary/10",
    },
  };

  const styles = variantStyles[variant];

  const content = (
    <div
      className={`${styles.container} p-6 vm-fade-in relative overflow-hidden group`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="flex items-start justify-between mb-4">
        <span className={`vm-stat-label ${styles.label}`}>{label}</span>
        {icon && (
          <div className={`${styles.iconBg} w-9 h-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110`}>
            {icon}
          </div>
        )}
      </div>
      <div className={`vm-stat-value ${styles.value} font-mono-num`}>{value}</div>
      {(sublabel || trend) && (
        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                trend.value > 0 ? "text-emerald-500" : trend.value < 0 ? "text-rose-500" : "text-slate-500"
              }`}
            >
              {trend.value > 0 ? <ArrowUpRight className="w-3 h-3" /> : trend.value < 0 ? <ArrowDownRight className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {trend.value > 0 ? "+" : ""}{trend.value.toFixed(1)}%
            </span>
          )}
          {sublabel && <span className={`text-xs ${styles.sublabel}`}>{sublabel}</span>}
        </div>
      )}

      {/* Decorative corner accent */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-5 transition-transform group-hover:scale-150"
           style={{ background: variant === "primary" || variant === "dark" ? "white" : "#01a451" }} />
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
