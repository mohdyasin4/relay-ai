import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    const origin = req.headers.get("origin") || "*";

    const body = await req.json();
    console.log("Incoming body:", body);

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log("Env vars loaded:", { hasUrl: !!url, hasKey: !!key });

    const supabase = createClient(url, key);

    const { data, error } = await supabase
      .from("User") // 👈 make sure this matches exactly in your DB
      .update({
        status: body.status,
        lastSeen: body.timestamp,
      })
      .eq("id", body.userId)
      .select();

    if (error) {
      console.error("Supabase update error:", error);
      throw error;
    }

    console.log("Update result:", data);

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": origin, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Function error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || String(err) }),
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      }
    );
  }
});
