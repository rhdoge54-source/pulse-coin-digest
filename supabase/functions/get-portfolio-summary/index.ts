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

    // Fetch all ERC20 token transfers for the wallet
    const transfersResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers?chain=${PULSECHAIN_CHAIN_ID}&limit=100`,
      {
        headers: {
          'X-API-Key': moralisApiKey,
          'accept': 'application/json',
        },
      }
    );

    if (!transfersResponse.ok) {
      const errorText = await transfersResponse.text();
      console.error('Moralis API error:', errorText);
      throw new Error(`Moralis API error: ${transfersResponse.status}`);
    }

    const transfersData = await transfersResponse.json();
    console.log(`Received ${transfersData.result?.length || 0} total token transfers`);

    // Process all transfers to calculate portfolio
    const tokenMap = new Map();

    if (transfersData.result) {
      for (const transfer of transfersData.result) {
        const tokenAddress = transfer.address;
        if (!tokenAddress) continue;

        const value = parseFloat(transfer.value) / Math.pow(10, parseInt(transfer.token_decimals || '18'));

        if (!tokenMap.has(tokenAddress)) {
          tokenMap.set(tokenAddress, {
            tokenAddress,
            tokenSymbol: transfer.token_symbol || 'UNKNOWN',
            tokenLogo: transfer.token_logo || '',
            totalBought: 0,
            totalSold: 0,
            totalBuyValueUSD: 0,
            totalSellValueUSD: 0,
            buyCount: 0,
            sellCount: 0,
          });
        }

        const token = tokenMap.get(tokenAddress);
        
        // Determine if buy or sell
        const isIncoming = transfer.to_address?.toLowerCase() === walletAddress.toLowerCase();
        if (isIncoming) {
          token.totalBought += value;
          token.buyCount++;
        } else if (transfer.from_address?.toLowerCase() === walletAddress.toLowerCase()) {
          token.totalSold += value;
          token.sellCount++;
        }
      }
    }

    // Calculate portfolio metrics and fetch current prices
    const portfolio = [];

    for (const [tokenAddress, tokenData] of tokenMap.entries()) {
      const currentQuantity = tokenData.totalBought - tokenData.totalSold;
      
      // Only include tokens with positive balance
      if (currentQuantity <= 0.000001) continue;

      // Fetch current price
      let currentPrice = 0;
      let tokenLogo = tokenData.tokenLogo;
      let avgBuyPrice = 0;
      
      try {
        // Get current price from DexScreener
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

        // Try to get price history from Moralis
        try {
          const priceResponse = await fetch(
            `https://deep-index.moralis.io/api/v2.2/erc20/${tokenAddress}/price?chain=${PULSECHAIN_CHAIN_ID}`,
            {
              headers: {
                'X-API-Key': moralisApiKey,
                'accept': 'application/json',
              },
            }
          );
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            avgBuyPrice = parseFloat(priceData.usdPrice || currentPrice);
            
            // Calculate buy/sell values
            if (tokenData.buyCount > 0) {
              tokenData.totalBuyValueUSD = tokenData.totalBought * avgBuyPrice;
            }
            if (tokenData.sellCount > 0) {
              tokenData.totalSellValueUSD = tokenData.totalSold * avgBuyPrice;
            }
          }
        } catch (error) {
          avgBuyPrice = currentPrice; // Fallback to current price
        }
      } catch (error) {
        console.error(`Error fetching price for ${tokenAddress}:`, error);
        continue;
      }

      // If we couldn't get average buy price, estimate it
      if (avgBuyPrice === 0 && tokenData.totalBuyValueUSD > 0) {
        avgBuyPrice = tokenData.totalBuyValueUSD / tokenData.totalBought;
      } else if (avgBuyPrice === 0) {
        avgBuyPrice = currentPrice;
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
