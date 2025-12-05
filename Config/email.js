import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

// Create Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({from, to, subject, html }) => {
  try {
    const response = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    return { success: true, data: response };
  } catch (error) {
    console.error("Email send error:", error);
    return { success: false, error };
  }
};
