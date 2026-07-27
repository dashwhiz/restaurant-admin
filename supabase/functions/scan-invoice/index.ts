/// <reference path="./deno.d.ts" />
// Supabase Edge Function: scan-invoice
//
// Keeps the Anthropic API key OFF the browser. The client sends
// { base64, mimeType }; this proxies the image/PDF to Claude Vision and returns
// structured invoice JSON. See docs/features/invoice-scan.md.
//
// Already deployed. To redeploy after editing this file (see docs/deploy.md):
//   supabase link --project-ref sawvyrwtnwrqiwhnzypw
//   supabase functions deploy scan-invoice
//
// Handled problems return HTTP 200 with { "error": "..." } so the client can show
// a clean Macedonian message; only unexpected failures use non-2xx.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const PROMPT = `You are analyzing a Macedonian restaurant supply invoice, fiscal receipt, or delivery note (фактура / фискална сметка / испратница). The text is usually in Macedonian Cyrillic.
Read it carefully and extract EVERY product line. Return ONLY valid JSON — no explanation, no markdown, no backticks, no reasoning text before or after.

Return exactly this structure:
{
  "supplier": "добавувач / supplier name, or null",
  "invoice_number": "број на фактура or null",
  "invoice_date": "YYYY-MM-DD or null",
  "doc_type": "invoice | fiscal | note",
  "items": [
    {
      "name": "product name EXACTLY as printed (keep Macedonian Cyrillic; do NOT translate)",
      "quantity": 5,
      "unit": "kg",
      "price_without_ddv": 100.00,
      "ddv_rate": 18,
      "price_with_ddv": 118.00
    }
  ]
}

Rules:
- Keep product names in their original language/script (Macedonian). Do NOT translate to English — the app matches them against a Macedonian code list.
- Extract EVERY product line, even if some prices are missing.
- Units must be one of: L, ml, kg, g, bottle, can, piece, portion, pack, bag, box. Map Macedonian units: КГ/kg→kg, Л/L→L, КОМ/ПАРЧ→piece, ПОР→portion. If a case/carton shows a piece count, convert to pieces.
- DDV (ДДВ, VAT) is a percentage — usually 5, 10, or 18 in North Macedonia. Put the number only (e.g. 18), not "18%".
- price_without_ddv = unit price before VAT; price_with_ddv = unit price including VAT. Prices are PER SINGLE UNIT, not line totals. If only one price is shown, decide from the document type: a fiscal receipt (фискална сметка) prices INCLUDE VAT (fill price_with_ddv, leave price_without_ddv null); an invoice usually lists price without VAT (fill price_without_ddv). Use null for any price you cannot read.
- doc_type: "fiscal" for a фискална сметка, "note" for испратница/белешка, otherwise "invoice".
- If nothing is readable, return { "supplier": null, "invoice_number": null, "invoice_date": null, "doc_type": "invoice", "items": [] }`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Trim: a key pasted into the dashboard often carries a trailing newline or
  // space, which makes the header invalid and comes back as a bare 401.
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim();
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY не е поставен на серверот.' });

  // Anthropic takes API keys (sk-ant-api…) on x-api-key, but OAuth tokens
  // (sk-ant-oat…) on Authorization: Bearer with an extra beta header. Sending
  // one in the other's slot is rejected as a 401.
  const isOauthToken = apiKey.startsWith('sk-ant-oat');
  const authHeaders: Record<string, string> = isOauthToken
    ? { Authorization: `Bearer ${apiKey}`, 'anthropic-beta': 'oauth-2025-04-20' }
    : { 'x-api-key': apiKey };

  try {
    const { base64, mimeType } = await req.json();
    if (typeof base64 !== 'string' || !base64) return json({ error: 'Нема слика во барањето.' });
    // ~12M base64 chars ≈ a 9 MB file. Caps the cost/abuse of a single call.
    if (base64.length > 12_000_000) return json({ error: 'Сликата е преголема (макс ~9 MB).' });

    const isPDF = mimeType === 'application/pdf';
    const contentBlock = isPDF
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType || 'image/jpeg', data: base64 } };

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        ...authHeaders,
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 8000,
        messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: PROMPT }] }],
      }),
    });

    if (!resp.ok) {
      // Read as text first: a 401 from an edge/proxy layer isn't always JSON,
      // and .json() swallowing it is why this surfaced as a bare status code.
      const raw = await resp.text().catch(() => '');
      let detail = '';
      try {
        detail = JSON.parse(raw)?.error?.message ?? '';
      } catch {
        detail = raw.slice(0, 200);
      }
      if (resp.status === 401) {
        // Never log the key itself — shape only, enough to spot a bad paste.
        console.error(
          `Anthropic 401. key length=${apiKey.length}, prefix=${apiKey.slice(0, 12)}, ` +
            `oauth=${isOauthToken}, detail=${detail || '(empty body)'}`,
        );
        return json({
          error: `Anthropic одби автентикација (401). ${detail || 'Провери го клучот во Edge Functions → Secrets.'}`,
        });
      }
      return json({ error: detail || `Anthropic грешка ${resp.status}` });
    }

    const data = await resp.json();
    if (data.stop_reason === 'max_tokens') {
      return json({ error: 'Фактурата е предолга за еден скен — обиди се со помал дел.' });
    }

    const text = (data.content?.find((c: { type: string }) => c.type === 'text')?.text as string) || '{}';
    let clean = text.replace(/```json|```/g, '').trim();
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1);

    try {
      return json(JSON.parse(clean));
    } catch {
      return json({ error: 'Claude врати неочекуван формат. Обиди се повторно.' });
    }
  } catch (e) {
    // Return 200 so the client's { error } contract surfaces the real message.
    return json({ error: (e as Error).message });
  }
});
