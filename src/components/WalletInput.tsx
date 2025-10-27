import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface WalletInputProps {
  onDetect: (address: string) => void;
}

export const WalletInput = ({ onDetect }: WalletInputProps) => {
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const validateEVMAddress = (addr: string): boolean => {
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    return evmRegex.test(addr);
  };

  const handleDetect = () => {
    setError("");
    
    if (!address.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    if (!validateEVMAddress(address)) {
      setError("Invalid EVM wallet address format");
      toast({
        title: "Invalid Address",
        description: "Please enter a valid EVM wallet address (0x...)",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Wallet Detected",
      description: "Loading your PulseChain portfolio...",
    });
    
    onDetect(address);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="0x... (EVM Wallet Address)"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleDetect()}
            className={`bg-background/50 border-border/50 focus:border-primary transition-colors ${
              error ? "border-destructive" : ""
            }`}
          />
          {error && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
          )}
        </div>
        <Button 
          onClick={handleDetect}
          className="bg-gradient-primary hover:opacity-90 transition-opacity glow-effect"
        >
          <Search className="w-4 h-4 mr-2" />
          Detect
        </Button>
      </div>
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {error}
        </p>
      )}
    </div>
  );
};
