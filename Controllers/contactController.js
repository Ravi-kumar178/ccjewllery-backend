import Contact from "../Models/contactModel.js";
import { sendEmail } from "../Config/email.js";

export const createMessage = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    if (!firstName || !lastName || !email || !phone || !message) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const newMessage = await Contact.create({
      firstName,
      lastName,
      email,
      phone,
      message,
    });

    //send to admin
    await sendEmail({
      from: "Contact Form <onboarding@resend.dev>",
      to: process.env.ADMIN_EMAIL,    
      subject: "New Contact Form Message",
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Phone:</strong> ${phone}</p>
        <p><strong>Message:</strong> ${message}</p>
      `,
    });


    await sendEmail({
      from: "Support <onboarding@resend.dev>",
      to: email,
      subject: "We received your message!",
      html: `
        <h3>Hello ${firstName},</h3>
        <p>Thank you for contacting us. We received your message and will reply soon.</p>
        <p><strong>Your message:</strong></p>
        <blockquote>${message}</blockquote>
        <br/>
        <p>Regards,<br/>Support Team</p>
      `,
    });

    res.status(201).json({
      success: true,
      msg: "Message sent successfully",
      data: newMessage,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
