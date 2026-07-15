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

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await request.json()
    const symbol = String(body?.symbol || '').trim().toUpperCase()
    const date = String(body?.date || new Date().toISOString().slice(0, 10))
    if (!symbol) throw new Error('Fon kodu eksik')

    const response = await fetch('https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 Harcamac/1.0',
      },
      body: JSON.stringify({ fonKodu: symbol, dil: 'TR', periyod: String(periodFor(date)) }),
    })
    if (!response.ok) throw new Error('TEFAS fiyatı alınamadı')
    const payload = await response.json()
    const rows = Array.isArray(payload?.resultList) ? payload.resultList : []
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
