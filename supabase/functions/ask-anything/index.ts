import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  
  const { question, isWales, history } = await req.json();
  
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });
  
  const system = `You are a helpful UK landlord compliance assistant for The Landlord Mate platform. You provide clear, practical advice on landlord compliance, property law, and lettings regulations.${isWales ? ' The user is based in Wales so prioritise Welsh legislation including the Renting Homes (Wales) Act 2016, Rent Smart Wales requirements, Section 173 notices, and Written Occupation Contracts.' : ' Focus on English and UK-wide landlord law.'} Keep answers concise, practical and in plain English. Always recommend seeking professional legal advice for specific situations.`;

  const messages = [
    ...(history || []),
    { role: 'user', content: question }
  ];

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages,
  });

  return new Response(
    JSON.stringify({ answer: message.content[0].text }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
