import { useState } from "react";
import { WalletInput } from "@/components/WalletInput";
import { TodayTransactions } from "@/components/TodayTransactions";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { Wallet, TrendingUp } from "lucide-react";

const Index = () => {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isTracking, setIsTracking] = useState(false);

  const handleDetect = (address: string) => {
    setWalletAddress(address);
    setIsTracking(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {!isTracking ? (
        /* Wallet Input View */
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md space-y-8">
            <div className="text-center">
              <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
                <Wallet className="w-12 h-12 text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">PulseChain Tracker</h1>
              <p className="text-muted-foreground">
                Masukkan alamat wallet Anda untuk melacak portfolio
              </p>
            </div>
            <div className="gradient-card rounded-xl p-6 card-shadow border border-border/50">
              <WalletInput onDetect={handleDetect} />
            </div>
          </div>
        </div>
      ) : (
        /* Portfolio View */
        <TodayTransactions walletAddress={walletAddress} />
      )}
    </div>
  );
};

export default Index;
