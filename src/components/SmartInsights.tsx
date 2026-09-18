import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Target, Lightbulb } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface SmartInsightsProps {
  toolsRevenue: number;
  sharpeningRevenue: number;
  grossMargin: number;
  outstanding: number;
  thisMonth: number;
  collectionRate: number;
  criticalCount: number;
  warningCount: number;
  monthlyTrend?: Array<{ month: string; total: number }>;
}

interface Insight {
  type: "positive" | "negative" | "warning" | "neutral";
  icon: React.ReactNode;
  title: string;
  description: string;
}

export default function SmartInsights(props: SmartInsightsProps) {
  const insights: Insight[] = [];
  const totalRevenue = props.toolsRevenue + props.sharpeningRevenue;

  // Insight 1: Revenue mix analysis
  const toolsShare = (props.toolsRevenue / totalRevenue) * 100;
  if (toolsShare > 65) {
    insights.push({
      type: "positive",
      icon: <Target className="w-4 h-4" />,
      title: "Strong Tools Performance",
      description: `Tools sales drive ${toolsShare.toFixed(0)}% of total revenue (${formatCurrency(props.toolsRevenue)}). Your core product line is your strongest asset.`,
    });
  } else if (toolsShare < 50) {
    insights.push({
      type: "warning",
      icon: <Lightbulb className="w-4 h-4" />,
      title: "Sharpening-Heavy Revenue Mix",
      description: `Service revenue (${(100 - toolsShare).toFixed(0)}%) exceeds product sales. Consider promoting tool sales to increase margins.`,
    });
  }

  // Insight 2: Margin analysis
  if (props.grossMargin > 50) {
    insights.push({
      type: "positive",
      icon: <TrendingUp className="w-4 h-4" />,
      title: "Excellent Profitability",
      description: `Gross margin of ${props.grossMargin.toFixed(1)}% on Tools sales is well above industry average. Healthy pricing strategy in place.`,
    });
  } else if (props.grossMargin < 30) {
    insights.push({
      type: "negative",
      icon: <TrendingDown className="w-4 h-4" />,
      title: "Margin Pressure Detected",
      description: `Gross margin at ${props.grossMargin.toFixed(1)}% is below target. Review pricing or supplier costs on tools sales.`,
    });
  }

  // Insight 3: Outstanding balance
  if (props.outstanding > 0) {
    const outstandingRatio = (props.outstanding / totalRevenue) * 100;
    if (outstandingRatio > 20) {
      insights.push({
        type: "negative",
        icon: <AlertTriangle className="w-4 h-4" />,
        title: "High Outstanding Balance",
        description: `${formatCurrency(props.outstanding)} pending collection (${outstandingRatio.toFixed(1)}% of revenue). Consider stricter payment terms.`,
      });
    } else {
      insights.push({
        type: "neutral",
        icon: <Target className="w-4 h-4" />,
        title: "Manageable Receivables",
        description: `${formatCurrency(props.outstanding)} outstanding represents ${outstandingRatio.toFixed(1)}% of revenue. Within healthy operating range.`,
      });
    }
  }

  // Insight 4: Critical overdue clients
  if (props.criticalCount > 0) {
    insights.push({
      type: "negative",
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "Urgent Collection Required",
      description: `${props.criticalCount} client${props.criticalCount > 1 ? "s" : ""} overdue 60+ days. Immediate follow-up needed to prevent bad debt.`,
    });
  }

  // Insight 5: Monthly trend with linear regression forecast
  if (props.monthlyTrend && props.monthlyTrend.length >= 2) {
    const last = props.monthlyTrend[props.monthlyTrend.length - 1];
    const previous = props.monthlyTrend[props.monthlyTrend.length - 2];
    if (last && previous && previous.total > 0) {
      const change = ((last.total - previous.total) / previous.total) * 100;
      if (change > 10) {
        insights.push({
          type: "positive",
          icon: <TrendingUp className="w-4 h-4" />,
          title: "Strong Month-over-Month Growth",
          description: `Revenue increased ${change.toFixed(1)}% from previous month. Keep the momentum going.`,
        });
      } else if (change < -10) {
        insights.push({
          type: "warning",
          icon: <TrendingDown className="w-4 h-4" />,
          title: "Revenue Decline Detected",
          description: `Revenue dropped ${Math.abs(change).toFixed(1)}% versus last month. Review sales pipeline and outreach.`,
        });
      }
    }

    // Linear regression forecast for next month (least squares)
    const series = props.monthlyTrend.slice(-6); // last 6 months
    if (series.length >= 3) {
      const n = series.length;
      const xs = series.map((_, i) => i);
      const ys = series.map((m) => m.total);
      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
      const sumXX = xs.reduce((acc, x) => acc + x * x, 0);
      const slope = (n * sumXY - sumX * sumY) / Math.max(1, n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      const forecast = Math.max(0, intercept + slope * n);
      const avgRecent = sumY / n;
      const forecastChange = avgRecent > 0 ? ((forecast - avgRecent) / avgRecent) * 100 : 0;
      insights.push({
        type: forecastChange >= 0 ? "positive" : "warning",
        icon: forecastChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />,
        title: "Next Month Forecast",
        description: `Linear projection from last ${n} months estimates next-month revenue at ${formatCurrency(forecast)} (${forecastChange >= 0 ? "+" : ""}${forecastChange.toFixed(1)}% vs. recent average).`,
      });
    }
  }

  // Insight 6: Collection rate
  if (props.collectionRate >= 95) {
    insights.push({
      type: "positive",
      icon: <Target className="w-4 h-4" />,
      title: "Outstanding Collection Discipline",
      description: `${props.collectionRate}% collection rate demonstrates excellent cash flow management.`,
    });
  } else if (props.collectionRate < 80) {
    insights.push({
      type: "warning",
      icon: <AlertTriangle className="w-4 h-4" />,
      title: "Collection Rate Needs Attention",
      description: `${props.collectionRate}% collection rate is below target. Strengthen invoicing and follow-up workflows.`,
    });
  }

  const colorMap = {
    positive: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", text: "text-emerald-900" },
    negative: { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-600", text: "text-rose-900" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-600", text: "text-amber-900" },
    neutral: { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-600", text: "text-slate-900" },
  };

  return (
    <div className="vm-card-elevated p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #01a451 0%, #019647 100%)" }}>
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="vm-eyebrow text-xs">Intelligence Layer</p>
            <h3 className="font-display text-2xl mt-1">Smart Insights</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
          <span className="w-2 h-2 rounded-full bg-emerald-500 vm-pulse" />
          <span className="text-xs font-semibold text-emerald-700">Live Analysis</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {insights.length === 0 ? (
          <div className="col-span-2 text-center py-8 text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p>Insights are warming up. Add more data to unlock observations.</p>
          </div>
        ) : (
          insights.map((insight, idx) => {
            const colors = colorMap[insight.type];
            return (
              <div
                key={idx}
                className={`${colors.bg} ${colors.border} border rounded-xl p-4 transition-all hover:shadow-md vm-fade-in`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className={`${colors.icon} mt-0.5 flex-shrink-0`}>{insight.icon}</div>
                  <div>
                    <p className={`${colors.text} font-semibold text-sm mb-1`}>{insight.title}</p>
                    <p className="text-xs text-slate-600 leading-relaxed">{insight.description}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
