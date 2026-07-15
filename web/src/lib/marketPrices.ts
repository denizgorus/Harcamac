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

export type MarketRange = '1G' | '1H' | '1A' | '3A' | '6A' | '1Y' | '5Y'
export type MarketHistoryPoint = { timestamp: number; price: number }
export type FundSnapshot = {
  fonKategori?: string
  gunlukGetiri?: number
  kategoriDerece?: number
  kategoriFonSay?: number
  pazarPayi?: number
  payAdet?: number
  portBuyukluk?: number
  sonFiyat?: number
  yatirimciSayi?: number
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
  { kind: 'Endeks', symbol: 'XU100', name: 'BIST 100', yahooSymbol: 'XU100.IS', exchange: 'BIST', dataSource: 'yahoo' },
  { kind: 'Endeks', symbol: 'SPX', name: 'S&P 500', yahooSymbol: '^GSPC', exchange: 'NYSE', dataSource: 'yahoo' },
  { kind: 'Endeks', symbol: 'NDX', name: 'NASDAQ 100', yahooSymbol: '^NDX', exchange: 'NASDAQ', dataSource: 'yahoo' },
  { kind: 'Endeks', symbol: 'DJI', name: 'Dow Jones', yahooSymbol: '^DJI', exchange: 'NYSE', dataSource: 'yahoo' },
  { kind: 'Hisse', symbol: 'AAPL', name: 'Apple Inc.', yahooSymbol: 'AAPL', exchange: 'NASDAQ', dataSource: 'yahoo' },
  { kind: 'Hisse', symbol: 'MSFT', name: 'Microsoft Corp.', yahooSymbol: 'MSFT', exchange: 'NASDAQ', dataSource: 'yahoo' },
  { kind: 'Para', symbol: 'TL', name: 'Türk Lirası' },
  { kind: 'Para', symbol: 'USD', name: 'Amerikan Doları', yahooSymbol: 'USDTRY=X', dataSource: 'yahoo' },
  { kind: 'Para', symbol: 'EUR', name: 'Euro', yahooSymbol: 'EURTRY=X', dataSource: 'yahoo' },
  { kind: 'Para', symbol: 'GBP', name: 'İngiliz Sterlini', yahooSymbol: 'GBPTRY=X', dataSource: 'yahoo' },
  { kind: 'Para', symbol: 'CHF', name: 'İsviçre Frangı', yahooSymbol: 'CHFTRY=X', dataSource: 'yahoo' },
  { kind: 'Para', symbol: 'JPY', name: 'Japon Yeni', yahooSymbol: 'JPYTRY=X', dataSource: 'yahoo' },
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
    body: JSON.stringify({ fonKodu: symbol, dil: 'TR', periyod: String(tefasPeriod(date)) }),
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
  if ((item.kind === 'Hisse' || item.kind === 'Fon') && item.exchange === 'BIST') return bistYahooSymbol(item.yahooSymbol || item.symbol)
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
  if (item.kind === 'Para') return item.symbol === 'TL' || item.symbol === 'TRY' ? 1 : fetchHistoricalWithYahoo(item.yahooSymbol || `${item.symbol}TRY=X`, date)
  if (item.yahooSymbol) return fetchHistoricalWithYahoo(item.yahooSymbol, date)
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

const rangeDays: Record<MarketRange, number> = { '1G': 1, '1H': 7, '1A': 30, '3A': 90, '6A': 180, '1Y': 365, '5Y': 1825 }
const yahooRanges: Record<MarketRange, { range: string; interval: string }> = {
  '1G': { range: '1d', interval: '5m' }, '1H': { range: '5d', interval: '30m' },
  '1A': { range: '1mo', interval: '1d' }, '3A': { range: '3mo', interval: '1d' },
  '6A': { range: '6mo', interval: '1d' }, '1Y': { range: '1y', interval: '1wk' }, '5Y': { range: '5y', interval: '1mo' },
}

async function fetchYahooHistory(symbol: string, range: MarketRange): Promise<MarketHistoryPoint[]> {
  const selection = yahooRanges[range]
  if (!import.meta.env.DEV) {
    const { data, error } = await supabase.functions.invoke('yahoo-bist-prices', { body: { symbols: [symbol], range } })
    const points = !error && Array.isArray(data?.quotes?.[0]?.points) ? data.quotes[0].points : []
    if (points.length > 1) return points as MarketHistoryPoint[]
  }
  const base = import.meta.env.DEV ? '/api/yahoo' : 'https://query2.finance.yahoo.com'
  const response = await fetch(`${base}/v8/finance/chart/${encodeURIComponent(symbol)}?range=${selection.range}&interval=${selection.interval}`)
  if (!response.ok) throw new Error(`${symbol} grafiği alınamadı`)
  const payload = await response.json()
  const result = payload?.chart?.result?.[0]
  const timestamps = Array.isArray(result?.timestamp) ? result.timestamp : []
  const closes = Array.isArray(result?.indicators?.quote?.[0]?.close) ? result.indicators.quote[0].close : []
  return timestamps.flatMap((timestamp: number, index: number) => typeof closes[index] === 'number' ? [{ timestamp, price: closes[index] }] : [])
}

async function fetchTefasHistory(symbol: string, range: MarketRange) {
  if (!import.meta.env.DEV) {
    const { data, error } = await supabase.functions.invoke('tefas-fund-prices', { body: { symbol, range } })
    if (!error && Array.isArray(data?.points) && data.points.length > 1) return data.points as MarketHistoryPoint[]
    throw new Error(`${symbol} TEFAS grafiği alınamadı`)
  }
  const period = ({ '1G': 1, '1H': 1, '1A': 1, '3A': 3, '6A': 6, '1Y': 12, '5Y': 60 } as const)[range]
  const response = await fetch('/api/tefas/api/funds/fonFiyatBilgiGetir', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fonKodu: symbol, dil: 'TR', periyod: String(period) }),
  })
  if (!response.ok) throw new Error(`${symbol} TEFAS grafiği alınamadı`)
  const payload = await response.json()
  const cutoff = Date.now() - rangeDays[range] * 86400000
  return (Array.isArray(payload?.resultList) ? payload.resultList : []).flatMap((item: { tarih?: string; fiyat?: number }) => {
    const timestamp = item.tarih ? Math.floor(new Date(`${item.tarih}T12:00:00+03:00`).getTime() / 1000) : 0
    return timestamp * 1000 >= cutoff && Number(item.fiyat) > 0 ? [{ timestamp, price: Number(item.fiyat) }] : []
  })
}

export async function fetchFundSnapshot(symbol: string): Promise<FundSnapshot | null> {
  if (!import.meta.env.DEV) {
    const { data, error } = await supabase.functions.invoke('tefas-fund-prices', { body: { symbol, action: 'detail' } })
    if (error) return null
    return data?.detail || null
  }
  const response = await fetch('/api/tefas/api/funds/fonBilgiGetir', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ fonKodu: symbol, dil: 'TR' }),
  })
  if (!response.ok) return null
  const payload = await response.json()
  return Array.isArray(payload?.resultList) ? payload.resultList[0] || null : null
}

function fallbackHistory(asset: Asset, range: MarketRange): MarketHistoryPoint[] {
  const points = range === '1G' ? 36 : range === '1H' ? 42 : 48
  const end = Date.now()
  const start = end - rangeDays[range] * 86400000
  const from = Math.max(0.0001, Number(asset.average_cost) || Number(asset.current_price) || 1)
  const to = Math.max(0.0001, Number(asset.current_price) || from)
  return Array.from({ length: points }, (_, index) => {
    const progress = index / (points - 1)
    const wave = Math.sin(index * 1.73) * 0.012 + Math.sin(index * 0.47) * 0.008
    return { timestamp: Math.round((start + (end - start) * progress) / 1000), price: Math.max(0.0001, from + (to - from) * progress) * (1 + wave) }
  })
}

export async function fetchAssetHistory(asset: Asset, range: MarketRange): Promise<MarketHistoryPoint[]> {
  const item = assetCatalog.find(candidate => candidate.kind === asset.kind && candidate.symbol === asset.symbol)
    || assetCatalog.find(candidate => candidate.symbol === asset.symbol)
  try {
    if (item?.dataSource === 'tefas') {
      const points = await fetchTefasHistory(item.symbol, range)
      if (points.length > 1) return points
    }
    if (!item || item.kind !== 'Para' || item.symbol !== 'TL') {
      const symbol = item ? marketSymbolFor(item) : asset.kind === 'Hisse' ? bistYahooSymbol(asset.symbol) : asset.symbol
      let points = await fetchYahooHistory(symbol, range)
      if (item?.kind === 'Altın') {
        const usdTry = await fetchHistoricalWithYahoo('USDTRY=X', localDay(new Date()))
        points = points.map(point => ({ ...point, price: point.price * usdTry / 31.1034768 }))
      } else if (item?.kind === 'Kripto') {
        const usdTry = await fetchHistoricalWithYahoo('USDTRY=X', localDay(new Date()))
        points = points.map(point => ({ ...point, price: point.price * usdTry }))
      }
      if (points.length > 1) return points
    }
  } catch { /* Fall back to the position curve when a provider is unavailable. */ }
  return fallbackHistory(asset, range)
}
