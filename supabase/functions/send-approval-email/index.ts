import nodemailer from "npm:nodemailer@2.7.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, email, userName } = await req.json();

    if (!email || !userName) {
      return new Response(
        JSON.stringify({ error: "email and userName are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const smtpHost = Deno.env.get("MAILU_SMTP_HOST");
    const smtpPort = parseInt(Deno.env.get("MAILU_SMTP_PORT") || "587");
    const smtpUser = Deno.env.get("MAILU_SMTP_USER");
    const smtpPass = Deno.env.get("MAILU_SMTP_PASS");
    const fromEmail = Deno.env.get("MAILU_FROM_EMAIL") || smtpUser;
    const fromName = Deno.env.get("MAILU_FROM_NAME") || "Conexões 06:30";
    const appUrl = Deno.env.get("APP_URL") || "https://conexoes0630.vercel.app";

    if (!smtpHost || !smtpUser || !smtpPass) {
      throw new Error("SMTP credentials not configured");
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // Minimal HTML template — customize in Supabase Dashboard
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;padding:24px;">
        <h2>Olá, ${userName}!</h2>
        <p>Sua conta foi aprovada. Acesse o app:</p>
        <p><a href="${appUrl}/login">${appUrl}/login</a></p>
        <p>Equipe Conexões 06:30</p>
      </body>
      </html>
    `;

    const textContent = `Olá, ${userName}!\n\nSua conta foi aprovada. Acesse: ${appUrl}/login\n\nEquipe Conexões 06:30`;

    const info = await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: "Sua conta no Conexões 06:30 foi aprovada! 🎉",
      text: textContent,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
