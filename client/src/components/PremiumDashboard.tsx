import { useState } from "react";
import { ChevronRight, TrendingUp, Users, DollarSign, PieChart } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface PremiumDashboardProps {
  toolsRevenue: number;
  sharpeningRevenue: number;
  grossProfit: number;
  grossMargin: number;
  outstanding: number;
  thisMonth: number;
  clientCount: number;
  avgInvoiceValue: number;
}

type DashboardTab = "revenue" | "profitability" | "receivables" | "clients";

const BRAND_COLORS = {
  primary: "#01a451",
  dark: "#2d3436",
  light: "#f5f6fa",
  border: "#e8eaed",
  text: "#666",
  lightText: "#999",
};

export default function PremiumDashboard(props: PremiumDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("revenue");

  const totalRevenue = props.toolsRevenue + props.sharpeningRevenue;
  const toolsPercent = ((props.toolsRevenue / totalRevenue) * 100).toFixed(1);
  const sharpeningPercent = ((props.sharpeningRevenue / totalRevenue) * 100).toFixed(1);

  const tabs: Array<{ id: DashboardTab; label: string; icon: React.ReactNode }> = [
    { id: "revenue", label: "Revenue", icon: <DollarSign className="w-4 h-4" /> },
    { id: "profitability", label: "Profitability", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "receivables", label: "Receivables", icon: <PieChart className="w-4 h-4" /> },
    { id: "clients", label: "Clients", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="w-full rounded-3xl p-8 md:p-12 shadow-lg border" style={{ backgroundColor: BRAND_COLORS.light, borderColor: BRAND_COLORS.border }}>
      
      {/* Header */}
      <div className="mb-12">
        <h1 
          className="text-4xl md:text-5xl font-bold mb-2"
          style={{ color: BRAND_COLORS.dark }}
        >
          Dashboard
        </h1>
        <p style={{ color: BRAND_COLORS.text }}>
          Executive overview of Videa Master Pro Tools Trading LLC
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 md:gap-4 mb-12 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
              activeTab === tab.id
                ? "shadow-lg scale-105"
                : "hover:shadow-md"
            }`}
            style={{
              backgroundColor: activeTab === tab.id ? BRAND_COLORS.primary : "white",
              color: activeTab === tab.id ? "white" : BRAND_COLORS.dark,
              borderColor: activeTab === tab.id ? BRAND_COLORS.primary : BRAND_COLORS.border,
              border: "2px solid",
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Sections */}
      <div className="min-h-[600px]">
        
        {/* Revenue Tab */}
        {activeTab === "revenue" && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Tools Sales Card */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2 hover:scale-105"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.primary,
                }}
                onClick={() => setActiveTab("profitability")}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.primary }}
                    >
                      Tools Revenue
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      {formatCurrency(props.toolsRevenue)}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      {toolsPercent}% of total revenue
                    </p>
                  </div>
                  <DollarSign 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.primary }}
                  />
                </div>

              </div>

              {/* Sharpening Services Card */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.border,
                }}
                onClick={() => setActiveTab("profitability")}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      Sharpening Revenue
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      {formatCurrency(props.sharpeningRevenue)}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      {sharpeningPercent}% of total revenue
                    </p>
                  </div>
                  <DollarSign 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.dark }}
                  />
                </div>

              </div>
            </div>

            {/* Total Revenue Summary */}
            <div
              className="rounded-2xl p-8 shadow-md border-2"
              style={{
                backgroundColor: "white",
                borderColor: BRAND_COLORS.border,
              }}
            >
              <p style={{ color: BRAND_COLORS.text }} className="text-sm font-semibold uppercase mb-3">
                Total Revenue
              </p>
              <p 
                className="text-5xl font-bold"
                style={{ color: BRAND_COLORS.primary }}
              >
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </div>
        )}

        {/* Profitability Tab */}
        {activeTab === "profitability" && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Gross Profit Card */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: BRAND_COLORS.dark,
                  borderColor: BRAND_COLORS.dark,
                }}
                onClick={() => setActiveTab("revenue")}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: "#ccc" }}
                    >
                      Gross Profit
                    </p>
                    <p className="text-4xl font-bold mb-2 text-white">
                      {formatCurrency(props.grossProfit)}
                    </p>
                    <p style={{ color: "#999" }} className="text-sm">
                      From Tools only
                    </p>
                  </div>
                  <TrendingUp 
                    className="w-12 h-12 opacity-20 group-hover:opacity-40 transition-opacity text-white"
                  />
                </div>

              </div>

              {/* Gross Margin Card */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: BRAND_COLORS.primary,
                  borderColor: BRAND_COLORS.primary,
                }}
                onClick={() => setActiveTab("revenue")}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4 text-white"
                    >
                      Gross Margin
                    </p>
                    <p className="text-5xl font-bold mb-2 text-white">
                      {props.grossMargin.toFixed(1)}%
                    </p>
                    <p style={{ color: "rgba(255,255,255,0.7)" }} className="text-sm">
                      Profitability ratio
                    </p>
                  </div>
                  <TrendingUp 
                    className="w-12 h-12 opacity-20 group-hover:opacity-40 transition-opacity text-white"
                  />
                </div>

              </div>
            </div>

            {/* Profitability Insight */}
            <div
              className="rounded-2xl p-8 shadow-md border-2"
              style={{
                backgroundColor: "white",
                borderColor: BRAND_COLORS.border,
              }}
            >
              <p style={{ color: BRAND_COLORS.text }} className="text-sm font-semibold uppercase mb-4">
                Profitability Breakdown
              </p>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p style={{ color: BRAND_COLORS.lightText }} className="text-xs uppercase mb-2">Tools Margin</p>
                  <p className="text-3xl font-bold" style={{ color: BRAND_COLORS.primary }}>
                    {props.grossMargin.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p style={{ color: BRAND_COLORS.lightText }} className="text-xs uppercase mb-2">Tools Revenue</p>
                  <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.dark }}>
                    {formatCurrency(props.toolsRevenue)}
                  </p>
                </div>
                <div>
                  <p style={{ color: BRAND_COLORS.lightText }} className="text-xs uppercase mb-2">Gross Profit</p>
                  <p className="text-2xl font-bold" style={{ color: BRAND_COLORS.dark }}>
                    {formatCurrency(props.grossProfit)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Receivables Tab */}
        {activeTab === "receivables" && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Outstanding Balance */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.border,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      Outstanding Balance
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: "#d32f2f" }}
                    >
                      {formatCurrency(props.outstanding)}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      Pending & overdue
                    </p>
                  </div>
                  <PieChart 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: "#d32f2f" }}
                  />
                </div>

              </div>

              {/* This Month Revenue */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.primary,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.primary }}
                    >
                      This Month
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      {formatCurrency(props.thisMonth)}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      Revenue this month
                    </p>
                  </div>
                  <TrendingUp 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.primary }}
                  />
                </div>

              </div>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === "clients" && (
          <div className="animate-fadeIn space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Client Count */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.primary,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.primary }}
                    >
                      Client Portfolio
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      {props.clientCount}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      Companies in database
                    </p>
                  </div>
                  <Users 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.primary }}
                  />
                </div>
              </div>

              {/* Avg Invoice Value */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.border,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      Avg Invoice Value
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.dark }}
                    >
                      {formatCurrency(props.avgInvoiceValue)}
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      Per transaction
                    </p>
                  </div>
                  <DollarSign 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.dark }}
                  />
                </div>
              </div>

              {/* Collection Rate */}
              <div
                className="rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer group border-2"
                style={{
                  backgroundColor: "white",
                  borderColor: BRAND_COLORS.primary,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p 
                      className="text-xs font-bold uppercase tracking-widest mb-4"
                      style={{ color: BRAND_COLORS.primary }}
                    >
                      Collection Rate
                    </p>
                    <p 
                      className="text-4xl font-bold mb-2"
                      style={{ color: BRAND_COLORS.primary }}
                    >
                      100%
                    </p>
                    <p style={{ color: BRAND_COLORS.lightText }} className="text-sm">
                      Payment collection
                    </p>
                  </div>
                  <TrendingUp 
                    className="w-12 h-12 opacity-10 group-hover:opacity-20 transition-opacity"
                    style={{ color: BRAND_COLORS.primary }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Add animation keyframes to global styles
const style = document.createElement("style");
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
`;
document.head.appendChild(style);
