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

    // Process transfers to identify buys and sells
    const tokenMap = new Map();
    const CHAIN = PULSECHAIN_CHAIN_ID;

    if (transfersData.result) {
      for (const transfer of transfersData.result) {
        const tokenAddress = transfer.address;
        const isIncoming = transfer.to_address?.toLowerCase() === walletAddress.toLowerCase();
        const isOutgoing = transfer.from_address?.toLowerCase() === walletAddress.toLowerCase();
        
        if ((isIncoming || isOutgoing) && tokenAddress) {
          const value = parseFloat(transfer.value) / Math.pow(10, parseInt(transfer.token_decimals || '18'));
          
          if (!tokenMap.has(tokenAddress)) {
            tokenMap.set(tokenAddress, {
              tokenAddress,
              tokenSymbol: transfer.token_symbol || 'UNKNOWN',
              tokenLogo: transfer.token_logo || '',
              totalBuyUSD: 0,
              totalBuyNative: 0,
              buyQuantity: 0,
              sellQuantity: 0,
              currentPrice: 0,
              profitUSD: 0,
              totalProfitUSD: 0,
              pnlPercent: 0,
              chartLink: `https://dexscreener.com/pulsechain/${tokenAddress}`,
              buyTransactions: [],
              sellTransactions: [],
            });
          }

          const token = tokenMap.get(tokenAddress);
          
          if (isIncoming) {
            token.buyQuantity += value;
            token.buyTransactions.push(transfer);
          }
          
          if (isOutgoing) {
            token.sellQuantity += value;
            token.sellTransactions.push(transfer);
          }
        }
      }
    }

    // Get PLS price first for USD calculations
    let plsPrice = 0;
    try {
      const plsPriceResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${WPLS_ADDRESS}`
      );
      if (plsPriceResponse.ok) {
        const plsPriceData = await plsPriceResponse.json();
        if (plsPriceData.pairs && plsPriceData.pairs.length > 0) {
          plsPrice = parseFloat(plsPriceData.pairs[0].priceUsd || '0');
        }
      }
    } catch (error) {
      console.error('Error fetching PLS price:', error);
    }

    // Fetch current prices and calculate PnL
    const allTokens = Array.from(tokenMap.values());
    
    // Filter only tokens with buys today
    const transactions = allTokens.filter(tx => tx.buyQuantity > 0);
    
    let totalBuyUSDSum = 0;
    let totalCurrentValueSum = 0;
    
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
          }
        }

        // Calculate actual buy value by fetching transaction details
        let totalNativeSpent = 0;
        for (const transfer of tx.buyTransactions) {
          try {
            const txHash = transfer.transaction_hash;
            const txResponse = await fetch(
              `https://deep-index.moralis.io/api/v2.2/transaction/${txHash}?chain=${CHAIN}`,
              {
                headers: {
                  'X-API-Key': moralisApiKey,
                  'accept': 'application/json',
                },
              }
            );
            
            if (txResponse.ok) {
              const txData = await txResponse.json();
              // Get the value sent in the transaction (in native currency)
              if (txData.value) {
                const nativeValue = parseFloat(txData.value) / 1e18;
                totalNativeSpent += nativeValue;
              }
            }
          } catch (error) {
            console.error(`Error fetching tx ${transfer.transaction_hash}:`, error);
          }
        }

        tx.totalBuyNative = totalNativeSpent;
        tx.totalBuyUSD = totalNativeSpent * plsPrice;

        // If we couldn't get transaction values, estimate from token quantity
        if (tx.totalBuyUSD === 0 && tx.currentPrice > 0) {
          tx.totalBuyUSD = tx.buyQuantity * tx.currentPrice;
          tx.totalBuyNative = tx.totalBuyUSD / (plsPrice || 1);
        }

        // Calculate profit
        const remainingQuantity = tx.buyQuantity - tx.sellQuantity;
        const currentValue = remainingQuantity * tx.currentPrice;
        tx.profitUSD = currentValue - tx.totalBuyUSD;
        tx.totalProfitUSD = tx.profitUSD;
        tx.pnlPercent = tx.totalBuyUSD > 0 ? (tx.profitUSD / tx.totalBuyUSD) * 100 : 0;

        // Add to summary totals
        totalBuyUSDSum += tx.totalBuyUSD;
        totalCurrentValueSum += currentValue;

        // Set quantity to remaining quantity for display
        tx.quantity = remainingQuantity;
        tx.soldQuantity = tx.sellQuantity;

        // Remove transactions arrays from final output
        delete tx.buyTransactions;
        delete tx.sellTransactions;
        delete tx.buyQuantity;
        delete tx.sellQuantity;

      } catch (error) {
        console.error(`Error processing token ${tx.tokenAddress}:`, error);
      }
    }

    // Calculate summary
    const totalProfitUSD = totalCurrentValueSum - totalBuyUSDSum;
    const totalProfitPercent = totalBuyUSDSum > 0 ? (totalProfitUSD / totalBuyUSDSum) * 100 : 0;

    return new Response(
      JSON.stringify({ 
        transactions,
        summary: {
          totalBuyUSD: totalBuyUSDSum,
          totalCurrentValue: totalCurrentValueSum,
          totalProfitUSD: totalProfitUSD,
          totalProfitPercent: totalProfitPercent
        }
      }),
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
