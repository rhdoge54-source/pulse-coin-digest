import { useEffect, useState } from "react";
import { Calendar, RefreshCw, TrendingUp, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TokenTransaction {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogo: string;
  totalBuyUSD: number;
  totalBuyNative: number;
  quantity: number;
  currentPrice: number;
  profitUSD: number;
  totalProfitUSD: number;
  pnlPercent: number;
  chartLink: string;
}

interface TodayTransactionsProps {
  walletAddress: string;
}

export const TodayTransactions = ({ walletAddress }: TodayTransactionsProps) => {
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchTodayData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-today-transactions', {
        body: { walletAddress }
      });

      if (error) throw error;
      
      setTransactions(data?.transactions || []);
      setLastUpdate(new Date());
      
      toast({
        title: "Data Updated",
        description: "Today's transactions loaded successfully",
      });
    } catch (error) {
      console.error("Error fetching today's transactions:", error);
      toast({
        title: "Error",
        description: "Failed to load transaction data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchTodayData, 30000);
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
      maximumFractionDigits: 6,
    }).format(value);
  };

  return (
    <div className="gradient-card rounded-xl p-6 card-shadow border border-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Hari Ini (WIB)</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Last update: {lastUpdate.toLocaleTimeString('id-ID')}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchTodayData}
            disabled={loading}
            className="border-border/50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-muted/30">
              <TableHead>Token</TableHead>
              <TableHead className="text-right">Total Pembelian (Today)</TableHead>
              <TableHead className="text-right">Jumlah Token (Today)</TableHead>
              <TableHead className="text-right">Profit Berjalan (Today)</TableHead>
              <TableHead className="text-right">Total Profit</TableHead>
              <TableHead className="text-right">PNL %</TableHead>
              <TableHead className="text-center">Chart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Loading today's transactions...
                </TableCell>
              </TableRow>
            ) : transactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No transactions found for today
                </TableCell>
              </TableRow>
            ) : (
              transactions.map((tx, index) => (
                <TableRow key={index} className="border-border/50 hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {tx.tokenLogo && (
                        <img src={tx.tokenLogo} alt={tx.tokenSymbol} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <div className="font-medium">{tx.tokenSymbol}</div>
                        <div className="text-xs text-muted-foreground">
                          {tx.tokenAddress.slice(0, 6)}...{tx.tokenAddress.slice(-4)}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div>{formatNumber(tx.totalBuyNative)} PLS</div>
                    <div className="text-sm text-muted-foreground">{formatCurrency(tx.totalBuyUSD)}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatNumber(tx.quantity)}</TableCell>
                  <TableCell className="text-right">
                    <span className={tx.profitUSD >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(tx.profitUSD)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={tx.totalProfitUSD >= 0 ? "text-success" : "text-destructive"}>
                      {formatCurrency(tx.totalProfitUSD)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={tx.pnlPercent >= 0 ? "text-success font-semibold" : "text-destructive font-semibold"}>
                      {tx.pnlPercent >= 0 ? '+' : ''}{tx.pnlPercent.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="bg-primary/10 hover:bg-primary/20 border-primary/30"
                      asChild
                    >
                      <a href={tx.chartLink} target="_blank" rel="noopener noreferrer">
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
