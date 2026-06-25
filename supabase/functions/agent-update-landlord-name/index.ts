import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SERVICE_ROLE_KEY")
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, landlordId, fullName } = await req.json();
    if (!agentId || !landlordId || !fullName) {
      return new Response(JSON.stringify({ error: "agentId, landlordId, and fullName are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkedProperty } = await supabaseAdmin
      .from("properties")
      .select("id")
      .eq("user_id", landlordId)
      .eq("added_by_agent_id", agentId)
      .maybeSingle();

    if (!linkedProperty) {
      const { data: agentRow } = await supabaseAdmin.from("users").select("email").eq("id", agentId).single();
      const { data: viaEmail } = await supabaseAdmin
        .from("properties")
        .select("id")
        .eq("user_id", landlordId)
        .eq("agent_email", (agentRow?.email || "").toLowerCase())
        .maybeSingle();
      if (!viaEmail) {
        return new Response(JSON.stringify({ error: "This landlord isn't linked to your agency" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error } = await supabaseAdmin.from("users").update({ full_name: fullName.trim() }).eq("id", landlordId);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
