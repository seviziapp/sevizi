// Sèvizi — shared PayDunya checkout-invoice client, used by every
// paydunya-create-*-invoice and paydunya-*-webhook Edge Function. Extracted
// so the API surface (headers, endpoints, request/response shapes) exists
// in exactly one place instead of being copy-pasted per function.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PaydunyaEnv = {
  masterKey: string;
  privateKey: string;
  publicKey: string;
  token: string;
  mode: string;
};

function readEnv(): PaydunyaEnv {
  return {
    masterKey: Deno.env.get('PAYDUNYA_MASTER_KEY')!,
    privateKey: Deno.env.get('PAYDUNYA_PRIVATE_KEY')!,
    publicKey: Deno.env.get('PAYDUNYA_PUBLIC_KEY')!,
    token: Deno.env.get('PAYDUNYA_TOKEN')!,
    // 'test' while integrating (PayDunya test API keys), 'live' once real
    // keys are in use — see the PayDunya dashboard's "API keys" page.
    mode: Deno.env.get('PAYDUNYA_MODE') ?? 'live',
  };
}

function authHeaders(env: PaydunyaEnv): Record<string, string> {
  return {
    'PAYDUNYA-MASTER-KEY': env.masterKey,
    'PAYDUNYA-PRIVATE-KEY': env.privateKey,
    'PAYDUNYA-PUBLIC-KEY': env.publicKey,
    'PAYDUNYA-TOKEN': env.token,
  };
}

export async function createInvoice(input: {
  totalAmount: number;
  description: string;
  callbackUrl: string;
  returnUrl?: string;
  cancelUrl?: string;
  customData: Record<string, unknown>;
  storeName?: string;
}): Promise<{ token: string; invoiceUrl: string }> {
  const env = readEnv();
  const res = await fetch('https://app.paydunya.com/api/v1/checkout-invoice/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(env) },
    body: JSON.stringify({
      mode: env.mode,
      invoice: { total_amount: input.totalAmount, description: input.description },
      store: { name: input.storeName ?? 'Sèvizi' },
      actions: {
        cancel_url: input.cancelUrl ?? 'https://sevizi.app',
        return_url: input.returnUrl ?? 'https://sevizi.app',
        callback_url: input.callbackUrl,
      },
      custom_data: input.customData,
    }),
  });
  const data = await res.json();
  if (data.response_code !== '00' || !data.token) {
    throw new Error(data.response_text ?? "Échec de la création de la facture PayDunya.");
  }
  return { token: data.token as string, invoiceUrl: `https://paydunya.com/checkout/invoice/${data.token}` };
}

// Re-confirms an invoice's real status directly with PayDunya — the only
// source of truth a webhook should ever trust, never the raw callback body.
export async function confirmInvoice(token: string): Promise<{ status: string; [key: string]: unknown }> {
  const env = readEnv();
  const res = await fetch(`https://app.paydunya.com/api/v1/checkout-invoice/confirm/${token}`, {
    headers: authHeaders(env),
  });
  return res.json();
}

function extractTokenFromBody(body: any): string | undefined {
  // PayDunya's JSON shape is { data: { invoice: { token } } }; also accept the
  // already-unwrapped shapes so a form field like data={"invoice":{...}} works.
  return body?.data?.invoice?.token ?? body?.data?.token ?? body?.invoice?.token ?? body?.token;
}

// Pulls the PayDunya invoice token out of an anonymous webhook request.
// PayDunya's real IPN is application/x-www-form-urlencoded with PHP-style
// bracket keys (data[invoice][token]=…, data[status]=…, data[hash]=…) — the
// previous version only understood JSON or a single "data" JSON field, so
// every genuine callback threw "token manquant" and no payment was ever
// confirmed automatically. All known shapes are accepted now: JSON, bracket
// form fields, a data=<json> form field, or a plain token field. Whatever
// token comes out is still only a *lookup key* — the webhooks re-confirm the
// real status with PayDunya before granting anything, so a forged callback
// cannot unlock anything.
export async function extractWebhookToken(req: Request): Promise<string> {
  const raw = await req.text();
  const trimmed = raw.trim();
  let token: string | undefined;

  if (trimmed.startsWith('{')) {
    try { token = extractTokenFromBody(JSON.parse(trimmed)); } catch { /* fall through to form parsing */ }
  }

  if (!token) {
    const params = new URLSearchParams(raw);
    token =
      params.get('data[invoice][token]') ??
      params.get('data[token]') ??
      params.get('invoice[token]') ??
      params.get('token') ??
      undefined;
    if (!token) {
      const dataField = params.get('data');
      if (dataField) {
        try { token = extractTokenFromBody(JSON.parse(dataField)); } catch { /* not JSON */ }
      }
    }
  }

  if (!token) throw new Error('token manquant');
  return token;
}
