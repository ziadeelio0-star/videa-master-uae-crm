import { TrendingUp, Wrench, Sparkles as Spark, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface RevenueHeroProps {
  toolsRevenue: number;
  sharpeningRevenue: number;
  grossProfit: number;
  grossMargin: number;
}

export default function RevenueHero({ toolsRevenue, sharpeningRevenue, grossProfit, grossMargin }: RevenueHeroProps) {
  const total = toolsRevenue + sharpeningRevenue;
  const toolsShare = total > 0 ? (toolsRevenue / total) * 100 : 0;
  const sharpeningShare = total > 0 ? (sharpeningRevenue / total) * 100 : 0;

  return (
    <div className="vm-card-elevated p-8 lg:p-10 relative overflow-hidden">
      {/* Background accent */}
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.03] -translate-y-1/2 translate-x-1/2"
           style={{ background: "#01a451" }} />

      <div className="relative">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10 gap-4">
          <div>
            <p className="vm-eyebrow">Revenue Architecture</p>
            <h2 className="font-display text-3xl lg:text-4xl mt-3">Where every dirham comes from</h2>
            <p className="text-muted-foreground text-sm mt-2 max-w-xl">
              A live breakdown of revenue streams flowing into gross profit and margin performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="vm-stat-label">Total Revenue</p>
              <p className="font-display text-3xl mt-1 vm-gradient-text font-mono-num">{formatCurrency(total)}</p>
            </div>
          </div>
        </div>

        {/* Tree Structure */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-8">
          {/* Tools Branch */}
          <div className="vm-fade-in">
            <RevenueBranch
              icon={<Wrench className="w-5 h-5" />}
              label="Tools Sales"
              description="Cutting tools and accessories"
              value={toolsRevenue}
              share={toolsShare}
              isPrimary
            />
          </div>

          {/* Sharpening Branch */}
          <div className="vm-fade-in" style={{ animationDelay: "120ms" }}>
            <RevenueBranch
              icon={<Spark className="w-5 h-5" />}
              label="Sharpening Services"
              description="Re-grinding and maintenance"
              value={sharpeningRevenue}
              share={sharpeningShare}
            />
          </div>
        </div>

        {/* Connector */}
        <div className="flex items-center justify-center my-2">
          <div className="flex flex-col items-center text-muted-foreground/40">
            <div className="w-px h-6 bg-border" />
            <ArrowDown className="w-4 h-4" />
          </div>
        </div>

        {/* Profit + Margin */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="vm-card-dark p-6 vm-fade-in" style={{ animationDelay: "240ms" }}>
            <div className="flex items-start justify-between mb-3">
              <span className="vm-stat-label text-white/70">Gross Profit</span>
              <div className="px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold tracking-wider uppercase text-white/80">
                Net of COGS
              </div>
            </div>
            <p className="vm-stat-value text-white font-mono-num">{formatCurrency(grossProfit)}</p>
            <p className="text-xs text-white/60 mt-2">Revenue minus cost of goods sold</p>
          </div>

          <div className="vm-card-primary p-6 vm-fade-in" style={{ animationDelay: "320ms" }}>
            <div className="flex items-start justify-between mb-3">
              <span className="vm-stat-label text-white/80">Gross Margin</span>
              <TrendingUp className="w-5 h-5 text-white/80" />
            </div>
            <p className="vm-stat-value text-white font-mono-num">{grossMargin.toFixed(1)}%</p>
            <p className="text-xs text-white/70 mt-2">Profitability ratio on total revenue</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueBranch({
  icon,
  label,
  description,
  value,
  share,
  isPrimary = false,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: number;
  share: number;
  isPrimary?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border-2 transition-all hover:shadow-lg ${isPrimary ? "border-primary bg-primary/5" : "border-border bg-secondary/40"}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isPrimary ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground"}`}>
            {icon}
          </div>
          <div>
            <p className="vm-stat-label">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider ${isPrimary ? "bg-primary text-primary-foreground" : "bg-foreground/10 text-foreground"}`}>
          {share.toFixed(1)}%
        </div>
      </div>
      <p className="vm-stat-value font-mono-num">{formatCurrency(value)}</p>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isPrimary ? "bg-primary" : "bg-foreground/40"}`}
          style={{ width: `${share}%` }}
        />
      </div>

      {/* Connector */}
      <div className="flex justify-center mt-4 text-muted-foreground/40">
        <ArrowDown className="w-4 h-4" />
      </div>
    </div>
  );
}
