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
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-primary">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                PulseChain Tracker
              </h1>
              <p className="text-sm text-muted-foreground">Multi-Chain Crypto Money Manager</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Wallet Input Section */}
        <div className="gradient-card rounded-xl p-6 card-shadow border border-border/50">
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Wallet Address</h2>
          </div>
          <WalletInput onDetect={handleDetect} />
        </div>

        {/* Data Tables */}
        {isTracking && walletAddress && (
          <>
            <TodayTransactions walletAddress={walletAddress} />
            <PortfolioSummary walletAddress={walletAddress} />
          </>
        )}

        {/* Empty State */}
        {!isTracking && (
          <div className="text-center py-20">
            <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
              <Wallet className="w-12 h-12 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Enter Your Wallet Address</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Paste your EVM wallet address above to start tracking your PulseChain portfolio and PnL
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Index;
