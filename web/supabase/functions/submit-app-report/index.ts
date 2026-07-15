const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function limitedText(value: unknown, maximum = 5000) {
  return String(value ?? '').slice(0, maximum)
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders })

  try {
    const body = await request.json()
    const isFeedback = body?.type === 'feedback'
    const message = limitedText(body?.message, 4000).trim()
    if (isFeedback && !message) throw new Error('Mesaj boş olamaz')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase sunucu ortamı tanımlı değil')

    const response = await fetch(`${supabaseUrl}/rest/v1/app_reports`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        report_type: isFeedback ? 'feedback' : 'error',
        reporter_email: limitedText(body?.reporterEmail, 200),
        action: isFeedback ? null : limitedText(body?.action, 180) || 'Bilinmeyen işlem',
        message: isFeedback ? message : null,
        technical: isFeedback ? null : limitedText(body?.technical),
        context: body?.context && typeof body.context === 'object' ? body.context : {},
        page: limitedText(body?.page, 120),
        url: limitedText(body?.url, 600),
        user_agent: limitedText(body?.userAgent, 600),
        occurred_at: limitedText(body?.occurredAt, 80) || new Date().toISOString(),
      }),
    })
    if (!response.ok) throw new Error(`Bildirim kaydı oluşturulamadı: ${response.status} ${await response.text()}`)

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error(error)
    return new Response(JSON.stringify({ sent: false, error: error instanceof Error ? error.message : 'Rapor gönderilemedi' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
