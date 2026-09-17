import { ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/format";

interface RevenueTreeProps {
  toolsRevenue: number;
  sharpeningRevenue: number;
  grossProfit: number;
  grossMargin: number;
}

export default function RevenueTree({
  toolsRevenue,
  sharpeningRevenue,
  grossProfit,
  grossMargin,
}: RevenueTreeProps) {
  const totalRevenue = toolsRevenue + sharpeningRevenue;
  
  // Brand colors: #01a451 (primary green), light black (#2d3436), light grey (#f5f6fa)
  const brandGreen = "#01a451";
  const darkText = "#2d3436";
  const lightGrey = "#f5f6fa";

  return (
    <div 
      className="w-full rounded-2xl border p-8 shadow-sm"
      style={{ 
        backgroundColor: lightGrey,
        borderColor: "#e8eaed"
      }}
    >
      {/* Title */}
      <div className="text-center mb-12">
        <h2 
          className="text-2xl font-bold"
          style={{ color: darkText }}
        >
          Revenue Structure
        </h2>
        <p 
          className="text-sm mt-1"
          style={{ color: "#666" }}
        >
          Total Revenue: {formatCurrency(totalRevenue)}
        </p>
      </div>

      {/* Main Container */}
      <div className="flex flex-col items-center gap-8">
        
        {/* Level 1: Two Revenue Branches */}
        <div className="w-full flex justify-center gap-12 md:gap-20">
          
          {/* Tools Branch */}
          <div className="flex flex-col items-center gap-4">
            <div 
              className="w-48 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border-2"
              style={{ 
                backgroundColor: "white",
                borderColor: brandGreen
              }}
            >
              <p 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: brandGreen }}
              >
                Tools Sales
              </p>
              <p 
                className="text-3xl font-bold mt-2"
                style={{ color: darkText }}
              >
                {formatCurrency(toolsRevenue)}
              </p>
              <p 
                className="text-xs mt-2"
                style={{ color: "#999" }}
              >
                Purchase transactions
              </p>
            </div>
            <ArrowDown 
              className="w-6 h-6"
              style={{ color: "#ccc" }}
            />
          </div>

          {/* Sharpening Branch */}
          <div className="flex flex-col items-center gap-4">
            <div 
              className="w-48 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow border-2"
              style={{ 
                backgroundColor: "white",
                borderColor: "#ccc"
              }}
            >
              <p 
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: darkText }}
              >
                Sharpening Services
              </p>
              <p 
                className="text-3xl font-bold mt-2"
                style={{ color: darkText }}
              >
                {formatCurrency(sharpeningRevenue)}
              </p>
              <p 
                className="text-xs mt-2"
                style={{ color: "#999" }}
              >
                Service revenue
              </p>
            </div>
            <ArrowDown 
              className="w-6 h-6"
              style={{ color: "#ccc" }}
            />
          </div>
        </div>

        {/* Connecting Line */}
        <div className="w-full flex justify-center">
          <div 
            className="h-8 w-1"
            style={{ 
              backgroundImage: `linear-gradient(to bottom, #ccc, #e8eaed)`
            }}
          ></div>
        </div>

        {/* Level 2: Profitability Metrics */}
        <div className="w-full flex justify-center gap-12 md:gap-20">
          
          {/* Gross Profit */}
          <div 
            className="w-48 rounded-xl p-6 shadow-lg border-2"
            style={{ 
              backgroundColor: darkText,
              borderColor: darkText
            }}
          >
            <p 
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "#ccc" }}
            >
              Gross Profit
            </p>
            <p 
              className="text-3xl font-bold mt-2"
              style={{ color: "white" }}
            >
              {formatCurrency(grossProfit)}
            </p>
            <p 
              className="text-xs mt-2"
              style={{ color: "#999" }}
            >
              From Tools only
            </p>
          </div>

          {/* Gross Margin */}
          <div 
            className="w-48 rounded-xl p-6 shadow-lg border-2"
            style={{ 
              backgroundColor: brandGreen,
              borderColor: brandGreen
            }}
          >
            <p 
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "white" }}
            >
              Gross Margin
            </p>
            <p 
              className="text-3xl font-bold mt-2"
              style={{ color: "white" }}
            >
              {grossMargin.toFixed(1)}%
            </p>
            <p 
              className="text-xs mt-2"
              style={{ color: "rgba(255,255,255,0.7)" }}
            >
              Profitability ratio
            </p>
          </div>
        </div>

        {/* Summary Stats */}
        <div 
          className="w-full mt-8 pt-8"
          style={{ 
            borderTopColor: "#e8eaed",
            borderTopWidth: "1px"
          }}
        >
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p 
                className="text-xs uppercase font-semibold"
                style={{ color: "#999" }}
              >
                Tools %
              </p>
              <p 
                className="text-xl font-bold mt-1"
                style={{ color: darkText }}
              >
                {((toolsRevenue / totalRevenue) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p 
                className="text-xs uppercase font-semibold"
                style={{ color: "#999" }}
              >
                Sharpening %
              </p>
              <p 
                className="text-xl font-bold mt-1"
                style={{ color: darkText }}
              >
                {((sharpeningRevenue / totalRevenue) * 100).toFixed(1)}%
              </p>
            </div>
            <div>
              <p 
                className="text-xs uppercase font-semibold"
                style={{ color: "#999" }}
              >
                Total Revenue
              </p>
              <p 
                className="text-xl font-bold mt-1"
                style={{ color: brandGreen }}
              >
                {formatCurrency(totalRevenue)}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
