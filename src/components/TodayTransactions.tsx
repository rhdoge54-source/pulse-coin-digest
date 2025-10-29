import { useEffect, useState } from "react";
import { RefreshCw, TrendingUp, TrendingDown, Copy, ExternalLink, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface TokenTransaction {
  tokenAddress: string;
  tokenSymbol: string;
  tokenLogo: string;
  totalBuyUSD: number;
  totalBuyNative: number;
  buyQuantity: number;
  sellQuantity: number;
  currentPrice: number;
  currentValue: number;
  profitUSD: number;
  pnlPercent: number;
  priceChange24h: number;
  chartLink: string;
}

interface DailySummary {
  totalBuyUSD: number;
  totalCurrentValue: number;
  totalProfitUSD: number;
  totalProfitPercent: number;
}

interface TodayTransactionsProps {
  walletAddress: string;
}

export const TodayTransactions = ({ walletAddress }: TodayTransactionsProps) => {
  const [transactions, setTransactions] = useState<TokenTransaction[]>([]);
  const [summary, setSummary] = useState<DailySummary>({
    totalBuyUSD: 0,
    totalCurrentValue: 0,
    totalProfitUSD: 0,
    totalProfitPercent: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchTodayData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-today-transactions', {
        body: { walletAddress }
      });

      if (error) throw error;
      
      setTransactions(data?.transactions || []);
      setSummary(data?.summary || {
        totalBuyUSD: 0,
        totalCurrentValue: 0,
        totalProfitUSD: 0,
        totalProfitPercent: 0
      });
      
      toast({
        title: "Data Diperbarui",
        description: "Data hari ini berhasil dimuat",
      });
    } catch (error) {
      console.error("Error fetching today's transactions:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data transaksi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayData();
  }, [walletAddress]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)}M`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)}K`;
    }
    return value.toFixed(2);
  };

  const formatPrice = (value: number) => {
    if (value < 0.000001) {
      return `$${value.toFixed(10)}`;
    } else if (value < 0.01) {
      return `$${value.toFixed(6)}`;
    }
    return `$${value.toFixed(4)}`;
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: "Tersalin",
      description: "Alamat token disalin ke clipboard",
    });
  };

  return (
    <div className="min-h-screen bg-background p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">Wallet</h1>
          <div className="text-4xl font-bold">{formatCurrency(summary.totalCurrentValue)}</div>
          {!loading && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Pembelian Awal:</span>
              <span className="text-sm font-semibold">{formatCurrency(summary.totalBuyUSD)}</span>
              <span className="text-sm text-muted-foreground">•</span>
              <span className="text-sm text-muted-foreground">Profit:</span>
              <span className={`text-sm font-semibold ${summary.totalProfitUSD >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(summary.totalProfitUSD)} ({summary.totalProfitPercent >= 0 ? '+' : ''}{summary.totalProfitPercent.toFixed(2)}%)
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
          >
            <DollarSign className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={fetchTodayData}
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Daily Movers */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Hari Ini (WIB)</h2>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Memuat transaksi hari ini...
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            Tidak ada transaksi untuk hari ini
          </div>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="grid grid-cols-[200px_1fr_120px_120px] gap-4 px-4 py-2 text-sm text-muted-foreground">
              <div>Token</div>
              <div className="text-right">Price</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Value</div>
            </div>

            {/* Token List */}
            {transactions.map((tx, index) => (
              <div 
                key={index} 
                className="grid grid-cols-[200px_1fr_120px_120px] gap-4 px-4 py-4 rounded-lg hover:bg-muted/30 transition-colors items-center"
              >
                {/* Token Info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {tx.tokenLogo && (
                      <img 
                        src={tx.tokenLogo} 
                        alt={tx.tokenSymbol} 
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold">{tx.tokenSymbol}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <button 
                        onClick={() => copyAddress(tx.tokenAddress)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <a 
                        href={tx.chartLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <RefreshCw className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right">
                  <div className="font-medium">{formatPrice(tx.currentPrice)}</div>
                  <div className={`text-sm flex items-center justify-end gap-1 ${tx.priceChange24h >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {tx.priceChange24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(tx.priceChange24h).toFixed(2)}%
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div className="font-medium">{formatNumber(tx.buyQuantity - tx.sellQuantity)}</div>
                  <div className="text-sm text-muted-foreground">
                    Buy: {formatNumber(tx.buyQuantity)}
                  </div>
                </div>

                {/* Value */}
                <div className="text-right">
                  <div className="font-semibold text-lg">{formatCurrency(tx.currentValue)}</div>
                  <div className={`text-sm ${tx.profitUSD >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {tx.profitUSD >= 0 ? '+' : ''}{formatCurrency(tx.profitUSD)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
