import express from "express";
import { createMessage } from "../Controllers/contactController.js";

const router = express.Router();

router.post("/", createMessage);

export default router;
