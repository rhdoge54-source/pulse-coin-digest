import { useEffect, useState } from "react";
import { PieChart, RefreshCw, ExternalLink, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PortfolioToken {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogo: string;
  avgBuyPrice: number;
  quantity: number;
  currentPrice: number;
  valueUSD: number;
  unrealizedPnlUSD: number;
  unrealizedPnlPercent: number;
  totalProfitUSD: number;
  chartLink: string;
}

interface PortfolioSummaryProps {
  walletAddress: string;
}

export const PortfolioSummary = ({ walletAddress }: PortfolioSummaryProps) => {
  const [portfolio, setPortfolio] = useState<PortfolioToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPortfolioData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-portfolio-summary', {
        body: { walletAddress }
      });

      if (error) throw error;
      
      setPortfolio(data?.portfolio || []);
      setLastUpdate(new Date());
      
      toast({
        title: "Portfolio Updated",
        description: "Portfolio summary loaded successfully",
      });
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      toast({
        title: "Error",
        description: "Failed to load portfolio data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPortfolioData, 30000);
    return () => clearInterval(interval);
  }, [walletAddress]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    }).format(value);
  };

  const totalValue = portfolio.reduce((sum, token) => sum + token.valueUSD, 0);
  const totalPnL = portfolio.reduce((sum, token) => sum + token.unrealizedPnlUSD, 0);

  return (
    <div className="gradient-card rounded-xl p-6 card-shadow border border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Portfolio Ringkas (All Time)</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString('id-ID')}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchPortfolioData}
            disabled={loading}
            className="border-border/50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Portfolio Stats */}
      {!loading && portfolio.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
            <div className="text-sm text-muted-foreground mb-1">Total Portfolio Value</div>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-4 border border-border/30">
            <div className="text-sm text-muted-foreground mb-1">Total Unrealized PnL</div>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatCurrency(totalPnL)} ({((totalPnL / (totalValue - totalPnL)) * 100).toFixed(2)}%)
            </div>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-muted/30">
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Avg Buy Price</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">Value (USD)</TableHead>
              <TableHead className="text-right">Unrealized PnL</TableHead>
              <TableHead className="text-right">Unrealized PnL %</TableHead>
              <TableHead className="text-right">Total Profit</TableHead>
              <TableHead className="text-center">Chart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  Loading portfolio...
                </TableCell>
              </TableRow>
            ) : portfolio.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                  No portfolio data available
                </TableCell>
              </TableRow>
            ) : (
              portfolio.map((token, index) => (
                <TableRow key={index} className="border-border/50 hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {token.tokenLogo && (
                        <img src={token.tokenLogo} alt={token.tokenSymbol} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="font-medium">{token.tokenSymbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {token.tokenAddress.slice(0, 6)}...{token.tokenAddress.slice(-4)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(token.avgBuyPrice)}</TableCell>
                  <TableCell className="text-right">{formatNumber(token.quantity)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(token.currentPrice)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(token.valueUSD)}</TableCell>
                  <TableCell className="text-right">
                    <span className={token.unrealizedPnlUSD >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(token.unrealizedPnlUSD)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={token.unrealizedPnlPercent >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {token.unrealizedPnlPercent >= 0 ? '+' : ''}{token.unrealizedPnlPercent.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={token.totalProfitUSD >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {formatCurrency(token.totalProfitUSD)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-primary/10 hover:bg-primary/20 border-primary/30"
                      asChild
                    >
                      <a href={token.chartLink} target="_blank" rel="noopener noreferrer">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        DexScreener
                        <ExternalLink className="w-3 h-3 ml-1" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
