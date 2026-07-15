const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function yahooSymbol(symbol: string) {
  const cleaned = symbol.trim().toUpperCase().replace(/\s+/g, '')
  if (!cleaned) return ''
  if (cleaned.endsWith('.IS')) return cleaned
  if (cleaned.includes('.')) return cleaned
  return `${cleaned}.IS`
}

function latestNumber(values: unknown[]) {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return null
}

function unixDayRange(dateText?: string) {
  if (!dateText) return null
  const today = new Date().toISOString().slice(0, 10)
  if (dateText >= today) return null
  const targetEnd = new Date(`${dateText}T23:59:59+03:00`)
  const start = new Date(`${dateText}T00:00:00+03:00`)
  if (Number.isNaN(start.getTime())) return null
  start.setDate(start.getDate() - 10)
  const end = new Date(targetEnd)
  end.setDate(end.getDate() + 1)
  return { period1: Math.floor(start.getTime() / 1000), period2: Math.floor(end.getTime() / 1000), targetEnd: Math.floor(targetEnd.getTime() / 1000) }
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await request.json()
    const symbols = Array.isArray(body?.symbols) ? body.symbols.map(String) : []
    const dateRange = unixDayRange(typeof body?.date === 'string' ? body.date : undefined)
    const preserveSymbols = body?.preserveSymbols === true
    const uniqueSymbols = [...new Set(symbols.map(symbol => preserveSymbols ? symbol.trim().toUpperCase() : yahooSymbol(symbol)).filter(Boolean))]
    const ranges: Record<string, { range: string; interval: string }> = {
      '1G': { range: '1d', interval: '5m' }, '1H': { range: '7d', interval: '30m' },
      '1A': { range: '1mo', interval: '1d' }, '3A': { range: '3mo', interval: '1d' },
      '6A': { range: '6mo', interval: '1d' }, '1Y': { range: '1y', interval: '1d' },
      '5Y': { range: '5y', interval: '1wk' },
      'Maks.': { range: 'max', interval: '1mo' },
    }
    const historyRange = typeof body?.range === 'string' ? ranges[body.range] : null

    const quotes = await Promise.all(uniqueSymbols.map(async symbol => {
      const exactRange = body?.range === '1H'
        ? `period1=${Math.floor(Date.now() / 1000) - 7 * 86400}&period2=${Math.floor(Date.now() / 1000)}&interval=30m`
        : null
      const query = dateRange
        ? `period1=${dateRange.period1}&period2=${dateRange.period2}&interval=1d`
        : exactRange || (historyRange ? `range=${historyRange.range}&interval=${historyRange.interval}` : 'range=1d&interval=1m')
      const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?${query}`
      const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 Harcamac/1.0' } })
      if (!response.ok) return null
      const payload = await response.json()
      const result = payload?.chart?.result?.[0]
      const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
      const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
      let price: number | null = null
      if (dateRange) {
        for (let index = timestamps.length - 1; index >= 0; index -= 1) {
          const close = closes[index]
          if (Number(timestamps[index]) <= dateRange.targetEnd && typeof close === 'number' && Number.isFinite(close) && close > 0) {
            price = close
            break
          }
        }
      }
      price ||= latestNumber(closes) || result?.meta?.regularMarketPrice || result?.meta?.chartPreviousClose
      if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null
      return {
        symbol,
        price,
        previousClose: result?.meta?.chartPreviousClose || result?.meta?.previousClose,
        currency: result?.meta?.currency || 'TRY',
        marketTime: result?.meta?.regularMarketTime || null,
        points: historyRange ? timestamps.flatMap((timestamp: number, index: number) => {
          const close = closes[index]
          return Number(timestamp) <= Math.floor(Date.now() / 1000) && typeof close === 'number' && Number.isFinite(close) && close > 0 ? [{ timestamp, price: close }] : []
        }).sort((left: { timestamp: number }, right: { timestamp: number }) => left.timestamp - right.timestamp) : undefined,
      }
    }))

    return new Response(JSON.stringify({ quotes: quotes.filter(Boolean) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Quote fetch failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
