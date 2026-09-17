import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Transactions from "./pages/Transactions";
import Analytics from "./pages/Analytics";
import StockHistory from "./pages/StockHistory";
import OperatingCost from "./pages/OperatingCost";
import Settings from "./pages/Settings";
import MapPage from "./pages/Map";
import { ReceivablesPage } from "./pages/Receivables";
import Invoices from "./pages/Invoices";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientDetail} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/stock-history" component={StockHistory} />
      <Route path="/operating-cost" component={OperatingCost} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/map" component={MapPage} />
      <Route path="/receivables" component={ReceivablesPage} />
      <Route path="/invoices" component={Invoices} />
      <Route path="/settings" component={Settings} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
