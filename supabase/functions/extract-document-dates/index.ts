import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The exact document_type values already used in the app and stored in public.documents.
// Do not invent new ones here without updating the frontend dropdown to match.
const DOCUMENT_TYPES = [
  'Gas Safety Certificate',
  'EICR (Electrical Report)',
  'EPC (Energy Performance)',
  'HMO Licence',
  'Rent Smart Wales Licence',
  'Deposit Certificate',
  'Tenancy Agreement',
  'Insurance',
  'Passport',
  'Driving Licence',
  'Other',
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { fileBase64, mimeType, documentTypeHint, batchId, fileName } = await req.json();

    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: 'Missing file data' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    const isPdf = mimeType === 'application/pdf';
    const contentBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: mimeType, data: fileBase64 } }
      : { type: 'image', source: { type: 'base64', media_type: mimeType, data: fileBase64 } };

    const typeList = DOCUMENT_TYPES.map((t) => `"${t}"`).join(', ');

    const prompt = `You are reading a UK landlord compliance document (e.g. Gas Safety Certificate, EICR, EPC, HMO Licence, Rent Smart Wales Licence, tenancy paperwork, or a right-to-rent identity document). Look at the attached document and extract the following.

1. document_type — exactly one of: ${typeList}. Use the exact wording above, character for character.
2. type_confidence — "high", "medium" or "low": how confident you are in that classification. NEVER guess the type. If the document is not clearly identifiable as one of the listed types, return "Other" with "low" confidence rather than picking the most likely candidate.
3. issue_date — when it was issued, or when the inspection took place. YYYY-MM-DD or null.
4. expiry_date — when it runs out, as printed on the document. YYYY-MM-DD or null.
5. expiry_source — "read" if the expiry date is actually printed on the document, or "derived" if you calculated it from the issue date using a standard validity period (Gas Safety Certificate = 12 months, domestic rental EICR = 5 years, EPC = 10 years). If no expiry is printed and no standard period applies, return null for expiry_date and null for expiry_source. Never invent an expiry date that is neither printed nor derivable this way. Gas Safety Records in particular usually print only an issue/inspection date.
6. confidence — "high", "medium" or "low": your confidence in the dates specifically, separate from type_confidence.
7. detected_address — any property address printed on the document, as free text, EXACTLY as it appears including line breaks replaced by ", ". Do not correct, complete, expand or tidy it. Null if no address is printed. If more than one address appears (for example an engineer's or issuing company's address as well as the property), return the one that is the inspected/licensed PROPERTY, not the issuer.
8. detected_postcode — the UK postcode of that property address only, normalised to uppercase with a single space before the final three characters (e.g. "CF64 1AB"). Null if no postcode is printed.
9. notes — a short note if anything is unclear, uncertain, or calculated rather than read directly. Otherwise an empty string.

${documentTypeHint ? `The user has already selected "${documentTypeHint}" as the document type. Use this unless the document clearly shows something different, and still return your own honest type_confidence.` : 'The user has NOT told you what this document is. Classify it yourself from its contents.'}

If — and only if — this document is an EICR (Electrical Installation Condition Report), also read the observations / classification codes section and extract:

10. eicr_code: the worst classification code actually found among the observations — one of "C1" (danger present, immediate remedial action required), "C2" (potentially dangerous, urgent remedial action required), "C3" (improvement recommended, not a legal requirement), "FI" (further investigation required) — or null if the report is fully satisfactory with no codes raised, or if this document isn't an EICR at all.
11. eicr_summary: a short, plain-English summary (1-2 sentences) of what that specific code means for this report and what the landlord needs to do next. Do not invent detail that isn't in the document.
12. eicr_deadline: any remediation deadline stated in the report for that observation, as YYYY-MM-DD, or null if none is given.
13. eicr_confidence: your confidence specifically in the EICR code you found — "high", "medium", or "low". A missed C1/C2 is dangerous and a false alarm erodes trust, so only report "high" when the code is clearly and unambiguously printed on the observations page; use "low" whenever you're not confident you located and read that section correctly, and say so in eicr_summary rather than guessing.

For any non-EICR document, or an EICR with no codes raised, set eicr_code, eicr_summary and eicr_deadline to null and eicr_confidence to null.

Respond with ONLY valid JSON, no other text, no markdown formatting, in exactly this shape:
{"document_type": "...", "type_confidence": "high|medium|low", "issue_date": "YYYY-MM-DD or null", "expiry_date": "YYYY-MM-DD or null", "expiry_source": "read|derived or null", "confidence": "high|medium|low", "detected_address": "... or null", "detected_postcode": "... or null", "notes": "...", "eicr_code": "C1|C2|C3|FI or null", "eicr_summary": "... or null", "eicr_deadline": "YYYY-MM-DD or null", "eicr_confidence": "high|medium|low or null"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 900,
        messages: [
          {
            role: 'user',
            content: [
              contentBlock,
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Anthropic API error:', data);
      return new Response(JSON.stringify({ error: 'AI extraction failed', details: data, batchId: batchId ?? null, fileName: fileName ?? null }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawText = data.content?.[0]?.text || '{}';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response:', rawText);
      return new Response(JSON.stringify({ error: 'Could not parse AI response', raw: rawText, batchId: batchId ?? null, fileName: fileName ?? null }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard rails: never let the AI hand back a document_type the app doesn't know about.
    if (!DOCUMENT_TYPES.includes(extracted.document_type)) {
      extracted.notes = `${extracted.notes ? extracted.notes + ' ' : ''}(Unrecognised type "${extracted.document_type}" returned by AI, filed as Other.)`;
      extracted.document_type = 'Other';
      extracted.type_confidence = 'low';
    }

    // Normalise the postcode server-side rather than trusting the model's formatting.
    if (typeof extracted.detected_postcode === 'string') {
      const pc = extracted.detected_postcode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      extracted.detected_postcode = pc.length >= 5 && pc.length <= 7
        ? `${pc.slice(0, pc.length - 3)} ${pc.slice(-3)}`
        : null;
    }

    // An expiry with no source is treated as read; a source with no expiry is meaningless.
    if (extracted.expiry_date && !extracted.expiry_source) extracted.expiry_source = 'read';
    if (!extracted.expiry_date) extracted.expiry_source = null;

    // Echo batch context back so the client can reconcile out-of-order responses.
    extracted.batchId = batchId ?? null;
    extracted.fileName = fileName ?? null;

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('extract-document-dates error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
