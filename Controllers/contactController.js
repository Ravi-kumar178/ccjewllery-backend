import Contact from "../Models/contactModel.js";

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

    res.status(201).json({
      success: true,
      msg: "Message sent successfully",
      data: newMessage,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
