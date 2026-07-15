const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[character] || character))
}

function limitedText(value: unknown, maximum = 5000) {
  return String(value ?? '').slice(0, maximum)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) throw new Error('RESEND_API_KEY tanımlı değil')
    const target = Deno.env.get('ERROR_REPORT_EMAIL')
    if (!target) throw new Error('ERROR_REPORT_EMAIL tanımlı değil')

    const body = await request.json()
    const action = limitedText(body?.action, 180) || 'Bilinmeyen işlem'
    const context = body?.context && typeof body.context === 'object' ? body.context : {}
    const contextRows = Object.entries(context).slice(0, 30).map(([key, value]) =>
      `<tr><td style="padding:6px 10px;color:#66736c">${escapeHtml(key)}</td><td style="padding:6px 10px;font-weight:600">${escapeHtml(value)}</td></tr>`
    ).join('')
    const sender = Deno.env.get('ERROR_REPORT_FROM') || 'Harcamaç <onboarding@resend.dev>'
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender,
        to: [target],
        subject: `[Harcamaç hata] ${action}`,
        html: `<div style="font-family:Arial,sans-serif;color:#202521;max-width:680px"><h2>Harcamaç hata bildirimi</h2><p><b>İşlem:</b> ${escapeHtml(action)}</p><p><b>Kullanıcı:</b> ${escapeHtml(limitedText(body?.reporterEmail, 200))}</p><p><b>Sayfa:</b> ${escapeHtml(limitedText(body?.page, 120))}</p><p><b>Zaman:</b> ${escapeHtml(limitedText(body?.occurredAt, 80))}</p><table style="width:100%;border-collapse:collapse;background:#f5f7f5">${contextRows}</table><h3>Teknik ayrıntı</h3><pre style="white-space:pre-wrap;background:#151916;color:#f4f7f4;padding:14px;border-radius:6px">${escapeHtml(limitedText(body?.technical))}</pre><p style="font-size:12px;color:#66736c">${escapeHtml(limitedText(body?.url, 600))}<br>${escapeHtml(limitedText(body?.userAgent, 600))}</p></div>`,
      }),
    })
    if (!response.ok) throw new Error(`E-posta servisi ${response.status} döndürdü`)
    const result = await response.json()
    return new Response(JSON.stringify({ sent: true, id: result?.id }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    return new Response(JSON.stringify({ sent: false, error: error instanceof Error ? error.message : 'Rapor gönderilemedi' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
