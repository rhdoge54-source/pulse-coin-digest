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

    console.log(`Fetching today's transactions for wallet: ${walletAddress}`);

    const moralisApiKey = Deno.env.get('MORALIS_API_KEY');
    if (!moralisApiKey) {
      throw new Error('Moralis API key not configured');
    }

    // Get today's date in WIB timezone (UTC+7)
    const now = new Date();
    const wibOffset = 7 * 60; // 7 hours in minutes
    const wibTime = new Date(now.getTime() + wibOffset * 60 * 1000);
    const todayStart = new Date(wibTime.getFullYear(), wibTime.getMonth(), wibTime.getDate());
    const todayStartUTC = new Date(todayStart.getTime() - wibOffset * 60 * 1000);

    // PulseChain chain ID
    const PULSECHAIN_CHAIN_ID = '0x171';
    const WPLS_ADDRESS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27';

    // Fetch ERC20 token transfers for the wallet
    const transfersResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}/erc20/transfers?chain=${PULSECHAIN_CHAIN_ID}&from_date=${todayStartUTC.toISOString()}`,
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
    console.log(`Received ${transfersData.result?.length || 0} token transfers`);

    // Process transfers to identify buys (incoming tokens)
    const tokenMap = new Map();

    if (transfersData.result) {
      for (const transfer of transfersData.result) {
        const tokenAddress = transfer.address;
        const isIncoming = transfer.to_address?.toLowerCase() === walletAddress.toLowerCase();
        
        // Only track incoming transfers (buys) for today
        if (isIncoming && tokenAddress) {
          const value = parseFloat(transfer.value) / Math.pow(10, parseInt(transfer.token_decimals || '18'));
          
          if (!tokenMap.has(tokenAddress)) {
            tokenMap.set(tokenAddress, {
              tokenAddress,
              tokenSymbol: transfer.token_symbol || 'UNKNOWN',
              tokenLogo: transfer.token_logo || '',
              totalBuyUSD: 0,
              totalBuyNative: 0,
              quantity: 0,
              currentPrice: 0,
              profitUSD: 0,
              totalProfitUSD: 0,
              pnlPercent: 0,
              chartLink: `https://dexscreener.com/pulsechain/${tokenAddress}`,
            });
          }

          const token = tokenMap.get(tokenAddress);
          token.quantity += value;
        }
      }
    }

    // Fetch current prices and calculate PnL
    const transactions = Array.from(tokenMap.values());
    
    for (const tx of transactions) {
      try {
        // Get price from DexScreener
        const dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tx.tokenAddress}`
        );
        
        if (dexResponse.ok) {
          const dexData = await dexResponse.json();
          if (dexData.pairs && dexData.pairs.length > 0) {
            const pair = dexData.pairs[0];
            tx.currentPrice = parseFloat(pair.priceUsd || '0');
            tx.tokenLogo = tx.tokenLogo || pair.info?.imageUrl || '';
            
            // Calculate buy value based on current price (approximation since we don't have historical prices)
            const currentValue = tx.quantity * tx.currentPrice;
            tx.totalBuyUSD = currentValue; // Simplified - ideally would use buy price
            tx.totalBuyNative = currentValue / (pair.priceNative || 1);
            
            // For today's buys, profit is the difference from entry
            tx.profitUSD = 0; // Same day buys typically haven't changed much
            tx.totalProfitUSD = 0;
            tx.pnlPercent = 0;
          }
        }

        // Try to get historical buy price from Moralis token price API
        try {
          const priceResponse = await fetch(
            `https://deep-index.moralis.io/api/v2.2/erc20/${tx.tokenAddress}/price?chain=${PULSECHAIN_CHAIN_ID}`,
            {
              headers: {
                'X-API-Key': moralisApiKey,
                'accept': 'application/json',
              },
            }
          );
          
          if (priceResponse.ok) {
            const priceData = await priceResponse.json();
            const buyPrice = parseFloat(priceData.usdPrice || '0');
            if (buyPrice > 0) {
              tx.totalBuyUSD = tx.quantity * buyPrice;
              const currentValue = tx.quantity * tx.currentPrice;
              tx.profitUSD = currentValue - tx.totalBuyUSD;
              tx.totalProfitUSD = tx.profitUSD;
              tx.pnlPercent = tx.totalBuyUSD > 0 ? (tx.profitUSD / tx.totalBuyUSD) * 100 : 0;
            }
          }
        } catch (error) {
          console.error(`Error fetching price for ${tx.tokenAddress}:`, error);
        }
      } catch (error) {
        console.error(`Error processing token ${tx.tokenAddress}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ transactions }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in get-today-transactions:', error);
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
