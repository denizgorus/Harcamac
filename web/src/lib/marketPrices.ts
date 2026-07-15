import type { Asset } from '../types'
import { supabase } from './supabase'
import bistCatalog from '../data/bistCatalog.json'
import tefasCatalog from '../data/tefasCatalog.json'

export type MarketPrice = {
  id: string
  symbol: string
  price: number
  previousClose?: number
}

export type AssetCatalogItem = {
  kind: string
  symbol: string
  name: string
  yahooSymbol?: string
  exchange?: string
  dataSource?: 'yahoo' | 'tefas'
  fundType?: string
}

export const assetCatalog: AssetCatalogItem[] = [
  ...(bistCatalog as AssetCatalogItem[]).map(item => ({ ...item, exchange: 'BIST', dataSource: 'yahoo' as const })),
  ...(tefasCatalog as AssetCatalogItem[]),
  { kind: 'Altın', symbol: 'XAUTRYG', name: 'Gram Altın', yahooSymbol: 'GC=F', dataSource: 'yahoo' },
  { kind: 'Altın', symbol: 'XAGTRYG', name: 'Gram Gümüş', yahooSymbol: 'SI=F', dataSource: 'yahoo' },
  { kind: 'Altın', symbol: 'FIZIKI-XAUTRYG', name: 'Fiziki Gram Altın', yahooSymbol: 'GC=F', dataSource: 'yahoo' },
  { kind: 'Altın', symbol: 'FIZIKI-XAGTRYG', name: 'Fiziki Gram Gümüş', yahooSymbol: 'SI=F', dataSource: 'yahoo' },
  { kind: 'Kripto', symbol: 'BTC', name: 'Bitcoin', yahooSymbol: 'BTC-USD' },
  { kind: 'Kripto', symbol: 'ETH', name: 'Ethereum', yahooSymbol: 'ETH-USD' },
  { kind: 'Kripto', symbol: 'SOL', name: 'Solana', yahooSymbol: 'SOL-USD' },
  { kind: 'Döviz', symbol: 'USD', name: 'Amerikan Doları', yahooSymbol: 'USDTRY=X', dataSource: 'yahoo' },
  { kind: 'Döviz', symbol: 'EUR', name: 'Euro', yahooSymbol: 'EURTRY=X', dataSource: 'yahoo' },
  { kind: 'Döviz', symbol: 'GBP', name: 'İngiliz Sterlini', yahooSymbol: 'GBPTRY=X', dataSource: 'yahoo' },
  { kind: 'Döviz', symbol: 'CHF', name: 'İsviçre Frangı', yahooSymbol: 'CHFTRY=X', dataSource: 'yahoo' },
  { kind: 'Döviz', symbol: 'JPY', name: 'Japon Yeni', yahooSymbol: 'JPYTRY=X', dataSource: 'yahoo' },
]

function bistYahooSymbol(symbol: string) {
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

function localDay(date: Date) {
  return date.toISOString().slice(0, 10)
}

function isTodayOrLater(date: string) {
  return date >= localDay(new Date())
}

async function fetchWithYahoo(symbol: string) {
  const base = import.meta.env.DEV ? '/api/yahoo' : 'https://query2.finance.yahoo.com'
  const response = await fetch(`${base}/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1m`)
  if (!response.ok) throw new Error(`${symbol} fiyatı alınamadı`)
  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const price = latestNumber(closes) || result?.meta?.regularMarketPrice
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error(`${symbol} için fiyat bulunamadı`)
  return { symbol, price, previousClose: result?.meta?.chartPreviousClose || result?.meta?.previousClose }
}

async function fetchHistoricalWithYahoo(symbol: string, date: string) {
  if (isTodayOrLater(date)) return (await fetchWithYahoo(symbol)).price
  const targetEnd = new Date(`${date}T23:59:59+03:00`)
  const start = new Date(`${date}T00:00:00+03:00`)
  start.setDate(start.getDate() - 10)
  const end = new Date(targetEnd)
  end.setDate(end.getDate() + 1)
  const period1 = Math.floor(start.getTime() / 1000)
  const period2 = Math.floor(end.getTime() / 1000)
  const base = import.meta.env.DEV ? '/api/yahoo' : 'https://query2.finance.yahoo.com'
  const response = await fetch(`${base}/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${period1}&period2=${period2}&interval=1d`)
  if (!response.ok) throw new Error(`${symbol} tarihsel fiyatı alınamadı`)
  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  let price: number | null = null
  for (let index = timestamps.length - 1; index >= 0; index -= 1) {
    const close = closes[index]
    if (Number(timestamps[index]) <= Math.floor(targetEnd.getTime() / 1000) && typeof close === 'number' && Number.isFinite(close) && close > 0) {
      price = close
      break
    }
  }
  price ||= latestNumber(closes) || result?.meta?.chartPreviousClose
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) throw new Error(`${symbol} için tarihsel fiyat bulunamadı`)
  return price
}

function tefasPeriod(date: string) {
  const days = Math.max(0, Math.ceil((Date.now() - new Date(`${date}T12:00:00+03:00`).getTime()) / 86400000))
  const months = Math.ceil(days / 30) + 1
  return [1, 3, 6, 12, 36, 60].find(period => period >= months) || 60
}

async function fetchHistoricalWithTefas(symbol: string, date: string) {
  const response = await fetch('/api/tefas/api/funds/fonFiyatBilgiGetir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fonKodu: symbol, dil: 'TR', periyod: tefasPeriod(date) }),
  })
  if (!response.ok) throw new Error(`${symbol} TEFAS fiyatı alınamadı`)
  const payload = await response.json()
  const rows = Array.isArray(payload?.resultList) ? payload.resultList : []
  const datedRows = rows.filter((item: { tarih?: string; fiyat?: number }) => item.tarih && item.tarih <= date && Number(item.fiyat) > 0)
  const pricedRows = rows.filter((item: { fiyat?: number }) => Number(item.fiyat) > 0)
  const row = datedRows[datedRows.length - 1] || pricedRows[pricedRows.length - 1]
  if (!row?.fiyat) throw new Error(`${symbol} için TEFAS fiyatı bulunamadı`)
  return Number(row.fiyat)
}

export function marketSymbolFor(item: AssetCatalogItem) {
  if (item.kind === 'Hisse' || item.kind === 'Fon') return bistYahooSymbol(item.yahooSymbol || item.symbol)
  return item.yahooSymbol || item.symbol
}

export async function fetchHistoricalAssetPrice(item: AssetCatalogItem, date: string) {
  if (item.dataSource === 'tefas') {
    if (import.meta.env.DEV) return fetchHistoricalWithTefas(item.symbol, date)
    const { data, error } = await supabase.functions.invoke('tefas-fund-prices', { body: { symbol: item.symbol, date } })
    if (error || !data?.price) throw new Error(`${item.symbol} TEFAS fiyatı alınamadı`)
    return Number(data.price)
  }
  if (item.kind === 'Hisse' || item.kind === 'Fon') {
    const symbol = marketSymbolFor(item)
    if (!import.meta.env.DEV) {
      const { data, error } = await supabase.functions.invoke('yahoo-bist-prices', { body: { symbols: [symbol], date } })
      const quote = !error && Array.isArray(data?.quotes) ? data.quotes[0] : null
      if (quote?.price) return Number(quote.price)
    }
    try {
      return await fetchHistoricalWithYahoo(symbol, date)
    } catch {
      return (await fetchWithYahoo(symbol)).price
    }
  }
  if (item.kind === 'Altın') {
    const metalSymbol = item.yahooSymbol || item.symbol
    let metalUsd: number
    let usdTry: number
    try {
      metalUsd = await fetchHistoricalWithYahoo(metalSymbol, date)
    } catch {
      metalUsd = (await fetchWithYahoo(metalSymbol)).price
    }
    try {
      usdTry = await fetchHistoricalWithYahoo('USDTRY=X', date)
    } catch {
      usdTry = (await fetchWithYahoo('USDTRY=X')).price
    }
    const gramsPerTroyOunce = 31.1034768
    return item.symbol === 'XAGTRYG' ? (metalUsd * usdTry) / gramsPerTroyOunce : (metalUsd * usdTry) / gramsPerTroyOunce
  }
  if (item.kind === 'Kripto') {
    const cryptoSymbol = item.yahooSymbol || `${item.symbol}-USD`
    let cryptoUsd: number
    let usdTry: number
    try {
      cryptoUsd = await fetchHistoricalWithYahoo(cryptoSymbol, date)
    } catch {
      cryptoUsd = (await fetchWithYahoo(cryptoSymbol)).price
    }
    try {
      usdTry = await fetchHistoricalWithYahoo('USDTRY=X', date)
    } catch {
      usdTry = (await fetchWithYahoo('USDTRY=X')).price
    }
    return cryptoUsd * usdTry
  }
  if (item.kind === 'Döviz') return fetchHistoricalWithYahoo(item.yahooSymbol || `${item.symbol}TRY=X`, date)
  return null
}

export async function fetchBistPrices(assets: Asset[]): Promise<MarketPrice[]> {
  const bistAssets = assets.filter(asset => {
    if (asset.kind === 'Hisse') return Boolean(asset.symbol.trim())
    if (asset.kind !== 'Fon') return false
    return assetCatalog.some(item => item.kind === 'Fon' && item.symbol === asset.symbol && item.exchange === 'BIST')
  })
  const symbolsById = new Map(bistAssets.map(asset => [asset.id, bistYahooSymbol(asset.symbol)]))
  const symbols = [...symbolsById.values()]
  let bistQuotes: MarketPrice[] = []

  if (symbols.length) {
    const { data, error } = await supabase.functions.invoke('yahoo-bist-prices', { body: { symbols } })
    if (!error && Array.isArray(data?.quotes)) {
      bistQuotes = bistAssets.flatMap(asset => {
        const symbol = symbolsById.get(asset.id)
        const quote = data.quotes.find((item: MarketPrice) => item.symbol === symbol)
        return quote ? [{ id: asset.id, symbol: quote.symbol, price: quote.price, previousClose: quote.previousClose }] : []
      })
    } else {
      const quotes = await Promise.allSettled(bistAssets.map(async asset => ({ id: asset.id, ...(await fetchWithYahoo(bistYahooSymbol(asset.symbol))) })))
      bistQuotes = quotes.flatMap(result => result.status === 'fulfilled' ? [result.value] : [])
    }
  }

  const tefasAssets = assets.flatMap(asset => {
    if (asset.kind !== 'Fon' || bistAssets.some(item => item.id === asset.id)) return []
    const catalogItem = assetCatalog.find(item => item.kind === 'Fon' && item.symbol === asset.symbol && item.dataSource === 'tefas')
    return catalogItem ? [{ asset, catalogItem }] : []
  })
  const tefasResults = await Promise.allSettled(tefasAssets.map(async ({ asset, catalogItem }) => ({
    id: asset.id,
    symbol: asset.symbol,
    price: await fetchHistoricalAssetPrice(catalogItem, localDay(new Date())),
  })))
  const tefasQuotes = tefasResults.flatMap(result => result.status === 'fulfilled' && result.value.price ? [result.value as MarketPrice] : [])
  return [...bistQuotes, ...tefasQuotes]
}
