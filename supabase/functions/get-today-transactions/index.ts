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

    // Fetch wallet transactions from Moralis
    const moralisResponse = await fetch(
      `https://deep-index.moralis.io/api/v2.2/${walletAddress}?chain=${PULSECHAIN_CHAIN_ID}&from_date=${todayStartUTC.toISOString()}`,
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
    console.log('Moralis data received:', moralisData);

    // Process transactions and get unique tokens
    const tokenMap = new Map();

    if (moralisData.result) {
      for (const tx of moralisData.result) {
        // Filter for buy transactions (incoming tokens)
        if (tx.to_address?.toLowerCase() === walletAddress.toLowerCase() && tx.value) {
          const tokenAddress = tx.address || tx.token_address;
          if (!tokenAddress) continue;

          const value = parseFloat(tx.value) / Math.pow(10, parseInt(tx.decimals || '18'));
          const valueUSD = parseFloat(tx.value_usd || '0');

          if (!tokenMap.has(tokenAddress)) {
            tokenMap.set(tokenAddress, {
              tokenAddress,
              tokenSymbol: tx.token_symbol || 'UNKNOWN',
              tokenLogo: tx.token_logo || '',
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
          token.totalBuyUSD += valueUSD;
          token.quantity += value;
        }
      }
    }

    // Fetch current prices from DexScreener
    const transactions = Array.from(tokenMap.values());
    
    for (const tx of transactions) {
      try {
        const dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${tx.tokenAddress}`
        );
        
        if (dexResponse.ok) {
          const dexData = await dexResponse.json();
          if (dexData.pairs && dexData.pairs.length > 0) {
            const pair = dexData.pairs[0];
            tx.currentPrice = parseFloat(pair.priceUsd || '0');
            tx.tokenLogo = tx.tokenLogo || pair.info?.imageUrl || '';
            
            const currentValue = tx.quantity * tx.currentPrice;
            tx.profitUSD = currentValue - tx.totalBuyUSD;
            tx.totalProfitUSD = tx.profitUSD;
            tx.pnlPercent = tx.totalBuyUSD > 0 ? (tx.profitUSD / tx.totalBuyUSD) * 100 : 0;
          }
        }
      } catch (error) {
        console.error(`Error fetching price for ${tx.tokenAddress}:`, error);
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
