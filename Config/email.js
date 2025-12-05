import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Create Resend client only if API key is provided
let resend = null;
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("✅ Email service (Resend) initialized successfully");
  } catch (error) {
    console.warn("⚠️  Resend email service not configured:", error.message);
  }
} else {
  console.warn("⚠️  RESEND_API_KEY not found in environment variables");
  console.warn("   Email functionality will be disabled. Add RESEND_API_KEY to your .env file to enable emails.");
}

export const sendEmail = async ({from, to, subject, html }) => {
  // If Resend is not configured, return a no-op response
  if (!resend) {
    console.warn("❌ Email service not configured. Email would have been sent to:", to);
    console.warn("   To enable emails, add RESEND_API_KEY to your .env file");
    return { success: false, error: "Email service not configured" };
  }

  try {
    console.log(`📤 Sending email via Resend...`);
    console.log(`   From: ${from}`);
    console.log(`   To: ${to}`);
    console.log(`   Subject: ${subject}`);
    
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    console.log("✅ Email sent successfully via Resend");
    console.log("   Response ID:", response?.id || "N/A");
    return { success: true, data: response };
  } catch (error) {
    console.error("❌ Email send error:", error.message || error);
    if (error.response) {
      console.error("   Error details:", JSON.stringify(error.response, null, 2));
    }
    return { success: false, error: error.message || error };
  }
};
