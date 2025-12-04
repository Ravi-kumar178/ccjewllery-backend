import express from "express";
// import { getDashboardStats } from "../Controllers/adminDashboardController.js";
import {getDashboardStats} from '../Controllers/dashboardController.js'

const router = express.Router();

router.get("/stats", getDashboardStats);

export default router;
