const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function periodFor(date: string) {
  const days = Math.max(0, Math.ceil((Date.now() - new Date(`${date}T12:00:00+03:00`).getTime()) / 86400000))
  const months = Math.ceil(days / 30) + 1
  return [1, 3, 6, 12, 36, 60].find(period => period >= months) || 60
}

const rangePeriods: Record<string, number> = {
  '1G': 1,
  '1H': 1,
  '1A': 1,
  '3A': 3,
  '6A': 6,
  '1Y': 12,
  '5Y': 60,
  'Maks.': 60,
}

async function tefasRequest(path: string, body: Record<string, unknown>) {
  const response = await fetch(`https://www.tefas.gov.tr/api/funds/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0 Harcamac/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error('TEFAS verisi alınamadı')
  return response.json()
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await request.json()
    const symbol = String(body?.symbol || '').trim().toUpperCase()
    const date = String(body?.date || new Date().toISOString().slice(0, 10))
    if (!symbol) throw new Error('Fon kodu eksik')

    if (body?.action === 'detail') {
      const detailPayload = await tefasRequest('fonBilgiGetir', { fonKodu: symbol, dil: 'TR' })
      const detail = Array.isArray(detailPayload?.resultList) ? detailPayload.resultList[0] || null : null
      return new Response(JSON.stringify({ symbol, detail }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const range = String(body?.range || '')
    const period = rangePeriods[range] || periodFor(date)
    const payload = await tefasRequest('fonFiyatBilgiGetir', { fonKodu: symbol, dil: 'TR', periyod: String(period) })
    const rows = Array.isArray(payload?.resultList) ? payload.resultList : []

    if (range) {
      const now = Date.now()
      const start = new Date(now)
      if (range === '1G') start.setDate(start.getDate() - 1)
      if (range === '1H') start.setDate(start.getDate() - 7)
      if (range === '1A') start.setMonth(start.getMonth() - 1)
      if (range === '3A') start.setMonth(start.getMonth() - 3)
      if (range === '6A') start.setMonth(start.getMonth() - 6)
      if (range === '1Y') start.setFullYear(start.getFullYear() - 1)
      if (range === '5Y') start.setFullYear(start.getFullYear() - 5)
      if (range === 'Maks.') start.setTime(0)
      if (range !== '1G' && range !== '1H') start.setHours(0, 0, 0, 0)
      const points = rows.flatMap((item: { tarih?: string; fiyat?: number }) => {
        const timestamp = item.tarih ? Math.floor(new Date(`${item.tarih}T12:00:00+03:00`).getTime() / 1000) : 0
        return timestamp * 1000 >= start.getTime() && timestamp * 1000 <= now && Number(item.fiyat) > 0 ? [{ timestamp, price: Number(item.fiyat) }] : []
      }).sort((left: { timestamp: number }, right: { timestamp: number }) => left.timestamp - right.timestamp)
      return new Response(JSON.stringify({ symbol, points }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const datedRows = rows.filter((item: { tarih?: string; fiyat?: number }) => item.tarih && item.tarih <= date && Number(item.fiyat) > 0)
    const pricedRows = rows.filter((item: { fiyat?: number }) => Number(item.fiyat) > 0)
    const row = datedRows[datedRows.length - 1] || pricedRows[pricedRows.length - 1]
    if (!row?.fiyat) throw new Error(`${symbol} için fiyat bulunamadı`)

    return new Response(JSON.stringify({ symbol, date: row.tarih, price: Number(row.fiyat) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'TEFAS isteği başarısız' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
