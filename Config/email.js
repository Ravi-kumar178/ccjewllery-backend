import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Create Resend client only if API key is provided
let resend = null;
console.log("\n📧 ===== EMAIL SERVICE INITIALIZATION =====");
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY);
    console.log("✅ Email service (Resend) initialized successfully");
    console.log("   API Key: " + process.env.RESEND_API_KEY.substring(0, 10) + "...");
  } catch (error) {
    console.warn("⚠️  Resend email service not configured:", error.message);
  }
} else {
  console.warn("❌ RESEND_API_KEY not found in environment variables");
  console.warn("   Email functionality will be disabled.");
  console.warn("   To enable emails:");
  console.warn("   1. Sign up at https://resend.com");
  console.warn("   2. Get your API key from the dashboard");
  console.warn("   3. Add RESEND_API_KEY=re_your_key to your .env file");
  console.warn("   4. Restart your server");
}
console.log("📧 ========================================\n");

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

    // Check if Resend returned an error in the response
    if (response?.error) {
      console.error("❌ Resend API returned an error:");
      console.error("   Status Code:", response.error.statusCode);
      console.error("   Message:", response.error.message);
      
      // Check for domain verification error
      if (response.error.message && response.error.message.includes('domain is not verified')) {
        console.error("\n💡 SOLUTION:");
        console.error("   The domain in EMAIL_FROM is not verified in Resend.");
        console.error("   For testing, update your .env file:");
        console.error("   EMAIL_FROM=onboarding@resend.dev");
        console.error("   Then restart your server.");
        console.error("   For production, verify your domain at: https://resend.com/domains\n");
      }
      
      return { 
        success: false, 
        error: response.error.message || 'Resend API error',
        details: response.error
      };
    }

    // Success - email was actually sent
    if (response?.id) {
      console.log("✅ Email sent successfully via Resend");
      console.log("   Response ID:", response.id);
      return { success: true, data: response };
    } else {
      console.warn("⚠️  Unexpected response from Resend:", JSON.stringify(response, null, 2));
      return { success: false, error: "Unexpected response from Resend API" };
    }
  } catch (error) {
    console.error("❌ Email send error:", error.message || error);
    if (error.response) {
      console.error("   Error details:", JSON.stringify(error.response, null, 2));
    }
    if (error.message) {
      console.error("   Full error message:", error.message);
    }
    // Check for common Resend errors
    if (error.message && error.message.includes('domain')) {
      console.error("   💡 TIP: Make sure your EMAIL_FROM domain is verified in Resend dashboard");
      console.error("   💡 For testing, use: onboarding@resend.dev");
    }
    return { success: false, error: error.message || error };
  }
};
