// supabase/functions/send-compliance-results/index.ts
//
// Deploy with: supabase functions deploy send-compliance-results
// Needs RESEND_API_KEY secret already set (same one your other functions use).
//
// Called from compliance-checker.html straight after the row is inserted
// into compliance_checks. Takes the answers + counts and sends a plain,
// personal-feeling summary email from support@thelandlordmate.com.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM = "The Landlord Mate <support@thelandlordmate.com>";
const APP_URL = "https://app.thelandlordmate.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Same copy as the frontend RULES object, kept in sync manually.
// If you edit findings wording in compliance-checker.html, mirror it here.
const RULES: Record<string, Record<string, [string, string, string]>> = {
  gas: {
    "Yes": ["green", "Gas safety certificate", "In date. Remember it needs renewing every 12 months."],
    "No": ["red", "No gas safety certificate", "This is a criminal offence, not a civil one. Prosecution can follow, and it blocks you from serving a Section 173 notice."],
    "Not sure": ["amber", "Gas safety unconfirmed", "If you can't put your hand on the certificate and check the date, treat it as overdue until you can."],
    "No gas at the property": ["green", "No gas appliances", "Nothing needed here."],
  },
  eicr: {
    "Yes": ["green", "EICR in date", "Five-year cycle. Worth diarising the renewal now."],
    "No": ["red", "No EICR", "Electrical safety is part of the fitness for human habitation standard in Wales. Without it the property may be legally unfit, and you can't serve a Section 173 notice."],
    "Not sure": ["amber", "EICR unconfirmed", "Check the date on the report. Anything over five years old needs redoing."],
  },
  epc: {
    "Yes": ["green", "EPC in place", "Valid for ten years from the date of issue."],
    "No": ["red", "No EPC", "You need one before marketing the property, and the contract-holder must be given a copy. Penalties apply and it affects your ability to serve notice."],
    "Not sure": ["amber", "EPC unconfirmed", "EPCs are on the public register, so this one's quick to check."],
  },
  hmo: {
    "Yes": ["green", "HMO licence current", "Keep an eye on the expiry, these run to a fixed term."],
    "No": ["red", "Unlicensed HMO", "Operating an HMO without a licence risks prosecution and a rent repayment order, meaning you may have to pay back rent already received."],
    "Not sure": ["amber", "HMO status unclear", "Worth confirming with your local authority. The definition catches more properties than most landlords expect."],
    "Not an HMO": ["green", "Not an HMO", "Nothing needed here."],
  },
  rsw: {
    "Yes, registered and licensed": ["green", "Rent Smart Wales in order", "Registration lasts five years. Diarise the renewal."],
    "Registered but no licence": ["amber", "Registered, not licensed", "Registration alone isn't enough if you manage the property yourself. You need a licence too, or an agent who holds one."],
    "No": ["red", "Not registered with Rent Smart Wales", "Registration is a legal requirement for every Welsh landlord. Enforcement can mean a fixed penalty or prosecution, and you cannot serve a Section 173 notice while unlicensed."],
    "Not sure": ["amber", "Rent Smart Wales status unclear", "You can check your registration status directly on the Rent Smart Wales website."],
  },
  deposit: {
    "Yes": ["green", "Deposit protected", "Make sure the prescribed information was served as well as the money being protected."],
    "No": ["red", "Deposit not protected", "The contract-holder can claim compensation, and you're barred from serving a Section 173 notice until it's resolved."],
    "Not sure": ["amber", "Deposit protection unconfirmed", "All three schemes let you look up a deposit online. Worth doing today."],
    "I don't hold a deposit": ["green", "No deposit held", "Nothing needed here."],
  },
};

const COLOURS: Record<string, string> = {
  red: "#C4453D",
  amber: "#D9903B",
  green: "#3E8E62",
};

function buildFindingsHtml(answers: Record<string, string>): { html: string; reds: number; ambers: number } {
  let reds = 0, ambers = 0;
  const rows = Object.entries(answers).map(([key, value]) => {
    const rule = RULES[key]?.[value];
    if (!rule) return "";
    const [level, title, detail] = rule;
    if (level === "red") reds++;
    if (level === "amber") ambers++;
    return `
      <tr>
        <td style="padding:14px 0;border-bottom:1px solid #EAE6DC;vertical-align:top;width:14px;">
          <div style="width:9px;height:9px;border-radius:50%;background:${COLOURS[level]};margin-top:6px;"></div>
        </td>
        <td style="padding:14px 0 14px 12px;border-bottom:1px solid #EAE6DC;">
          <strong style="font-size:15px;color:#0D1B2A;">${title}</strong><br>
          <span style="font-size:14px;color:#5B6B7C;">${detail}</span>
        </td>
      </tr>`;
  }).join("");
  return { html: rows, reds, ambers };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, answers } = await req.json();

    if (!email || !answers) {
      return new Response(JSON.stringify({ error: "Missing email or answers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { html: findingsHtml, reds, ambers } = buildFindingsHtml(answers);

    let headline = "You're properly on top of this";
    let subhead = "Everything checks out. The tricky bit is staying that way, since these all expire on different dates and nobody reminds you.";
    let bandColour = COLOURS.green;

    if (reds > 0) {
      headline = reds === 1 ? "There's one thing you need to sort" : `There are ${reds} things you need to sort`;
      subhead = "Nothing disastrous, but each one below has a real consequence if it's left, and a couple stop you serving notice on a tenant until they're fixed.";
      bandColour = COLOURS.red;
    } else if (ambers > 0) {
      headline = ambers === 1 ? "One thing you're not sure about" : `${ambers} things you're not sure about`;
      subhead = "Might be fine, might not be, you don't actually know right now. Worth turning those maybes into a yes or no.";
      bandColour = COLOURS.amber;
    }

    const html = `
    <div style="background:#0D1B2A;padding:32px 16px;font-family:-apple-system,Helvetica,Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#F7F5F0;border-radius:14px;overflow:hidden;">
        <div style="background:${bandColour};padding:22px 28px;">
          <p style="margin:0;color:#fff;font-size:13px;letter-spacing:.06em;text-transform:uppercase;opacity:.85;">Your results</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:22px;line-height:1.3;">${headline}</h1>
        </div>
        <div style="padding:26px 28px;">
          <p style="margin:0 0 22px;color:#3B4A59;font-size:15px;line-height:1.6;">${subhead}</p>
          <table style="width:100%;border-collapse:collapse;">
            ${findingsHtml}
          </table>
          <div style="margin-top:28px;padding:22px;background:#0D1B2A;border-radius:10px;text-align:center;">
            <p style="margin:0 0 14px;color:#B9C6D3;font-size:14px;">
              The Landlord Mate tracks all of this automatically and reminds you before anything expires.
            </p>
            <a href="${APP_URL}" style="display:inline-block;background:#D9B455;color:#0D1B2A;text-decoration:none;font-weight:600;font-size:15px;padding:13px 26px;border-radius:8px;">
              Try it free for 7 days
            </a>
            <p style="margin:12px 0 0;color:#5B6B7C;font-size:12px;">No card needed. £9/month or £99/year after your trial.</p>
          </div>
          <p style="margin:26px 0 0;color:#8A97A3;font-size:12px;line-height:1.6;">
            This is general guidance, not legal advice. If you're unsure about anything above, check directly with Rent Smart Wales or a solicitor.
          </p>
        </div>
        <div style="padding:18px 28px;border-top:1px solid #EAE6DC;">
          <p style="margin:0;color:#8A97A3;font-size:12px;">
            The Landlord Mate Ltd &middot; Penarth, Wales &middot;
            <a href="https://thelandlordmate.com" style="color:#8A97A3;">thelandlordmate.com</a>
          </p>
        </div>
      </div>
    </div>`;

    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: email,
        subject: "Here's where you actually stand",
        html,
      }),
    });

    if (!resendRes.ok) {
      const err = await resendRes.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
