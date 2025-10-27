import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress } = await req.json();
    
    if (!walletAddress) {
      throw new Error('Wallet address is required');
    }

    console.log(`Fetching portfolio summary for wallet: ${walletAddress}`);

    const moralisApiKey = Deno.env.get('MORALIS_API_KEY');
    if (!moralisApiKey) {
      throw new Error('Moralis API key not configured');
    }

    // PulseChain chain ID
    const PULSECHAIN_CHAIN_ID = '0x171';

    // Fetch all wallet transactions from Moralis
    const moralisResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}?chain=${PULSECHAIN_CHAIN_ID}`,
      {
        headers: {
          'X-API-Key': moralisApiKey,
          'accept': 'application/json',
        },
      }
    );

    if (!moralisResponse.ok) {
      const errorText = await moralisResponse.text();
      console.error('Moralis API error:', errorText);
      throw new Error(`Moralis API error: ${moralisResponse.status}`);
    }

    const moralisData = await moralisResponse.json();
    console.log('Moralis portfolio data received');

    // Process all transactions to calculate portfolio
    const tokenMap = new Map();

    if (moralisData.result) {
      for (const tx of moralisData.result) {
        const tokenAddress = tx.address || tx.token_address;
        if (!tokenAddress) continue;

        const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.decimals || '18'));
        const valueUSD = parseFloat(tx.value_usd || '0');

        if (!tokenMap.has(tokenAddress)) {
          tokenMap.set(tokenAddress, {
            tokenAddress,
            tokenSymbol: tx.token_symbol || 'UNKNOWN',
            tokenLogo: tx.token_logo || '',
            totalBought: 0,
            totalSold: 0,
            totalBuyValueUSD: 0,
            totalSellValueUSD: 0,
            transactions: [],
          });
        }

        const token = tokenMap.get(tokenAddress);
        
        // Determine if buy or sell
        if (tx.to_address?.toLowerCase() === walletAddress.toLowerCase()) {
          // Buy transaction
          token.totalBought += value;
          token.totalBuyValueUSD += valueUSD;
        } else if (tx.from_address?.toLowerCase() === walletAddress.toLowerCase()) {
          // Sell transaction
          token.totalSold += value;
          token.totalSellValueUSD += valueUSD;
        }
        
        token.transactions.push({
          value,
          valueUSD,
          timestamp: tx.block_timestamp,
        });
      }
    }

    // Calculate portfolio metrics
    const portfolio = [];

    for (const [tokenAddress, tokenData] of tokenMap.entries()) {
      const currentQuantity = tokenData.totalBought - tokenData.totalSold;
      
      // Only include tokens with positive balance
      if (currentQuantity <= 0) continue;

      const avgBuyPrice = tokenData.totalBuyValueUSD / tokenData.totalBought || 0;
      
      // Fetch current price from DexScreener
      let currentPrice = 0;
      let tokenLogo = tokenData.tokenLogo;
      
      try {
        const dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
        );
        
        if (dexResponse.ok) {
          const dexData = await dexResponse.json();
          if (dexData.pairs && dexData.pairs.length > 0) {
            const pair = dexData.pairs[0];
            currentPrice = parseFloat(pair.priceUsd || '0');
            tokenLogo = tokenLogo || pair.info?.imageUrl || '';
          }
        }
      } catch (error) {
        console.error(`Error fetching price for ${tokenAddress}:`, error);
      }

      const valueUSD = currentQuantity * currentPrice;
      const costBasis = currentQuantity * avgBuyPrice;
      const unrealizedPnlUSD = valueUSD - costBasis;
      const unrealizedPnlPercent = costBasis > 0 ? (unrealizedPnlUSD / costBasis) * 100 : 0;
      
      // Calculate realized profit from sells
      const realizedProfit = tokenData.totalSellValueUSD - (tokenData.totalSold * avgBuyPrice);
      const totalProfitUSD = unrealizedPnlUSD + realizedProfit;

      portfolio.push({
        tokenAddress,
        tokenSymbol: tokenData.tokenSymbol,
        tokenLogo,
        avgBuyPrice,
        quantity: currentQuantity,
        currentPrice,
        valueUSD,
        unrealizedPnlUSD,
        unrealizedPnlPercent,
        totalProfitUSD,
        chartLink: `https://dexscreener.com/pulsechain/${tokenAddress}`,
      });
    }

    // Sort by value (highest first)
    portfolio.sort((a, b) => b.valueUSD - a.valueUSD);

    return new Response(
      JSON.stringify({ portfolio }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in get-portfolio-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
