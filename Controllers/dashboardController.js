import orderModel from "../Models/orderModel.js";
import productModel from "../Models/productModel.js";
import userModel from "../Models/userModel.js";

export const getDashboardStats = async (req, res) => {
  try {
    // 1. Total Orders Count
    const totalOrders = await orderModel.countDocuments();

    // 2. Total Revenue (only paid/confirmed orders)
    const paidOrders = await orderModel.find({ payment: true });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    // 3. Total Products Count
    const totalProducts = await productModel.countDocuments();

    // 4. Total Users Count
    const totalUsers = await userModel.countDocuments();

    return res.json({
      success: true,
      stats: {
        revenue: totalRevenue,
        orders: totalOrders,
        products: totalProducts,
        users: totalUsers
      }
    });

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
