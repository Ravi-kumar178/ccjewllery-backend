import express from "express";
import { getDashboardStats } from "../Controllers/adminDashboardController.js";

const router = express.Router();

router.get("/stats", getDashboardStats);

export default router;
