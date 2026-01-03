import express from "express";
// import { getDashboardStats } from "../Controllers/adminDashboardController.js";
import {getDashboardStats, getAllUsers} from '../Controllers/dashboardController.js'

const router = express.Router();

// Test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ success: true, message: "Admin routes are working!" });
});

router.get("/stats", getDashboardStats);
router.get("/users", getAllUsers);

// Debug: Log route registration
console.log('Admin dashboard routes registered: /test, /stats, /users');

export default router;
