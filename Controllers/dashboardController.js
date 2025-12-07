import orderModel from "../Models/orderModel.js";
import productModel from "../Models/productModel.js";

export const getDashboardStats = async (req, res) => {
  try {
    // 1. Total Orders Count
    const totalOrders = await orderModel.countDocuments();

    // 2. Total Revenue (only paid/confirmed orders)
    const paidOrders = await orderModel.find({ payment: true });
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (o.amount || 0), 0);

    // 3. Total Products Count
    const totalProducts = await productModel.countDocuments();

    // 4. Total Unique Customers (unique email addresses from all orders)
    // Use aggregation to count distinct emails, filtering out null/empty values
    const uniqueCustomersResult = await orderModel.aggregate([
        {
            $match: {
                email: { $exists: true, $ne: null, $ne: '' }
            }
        },
        {
            $group: {
                _id: '$email'
            }
        },
        {
            $count: 'total'
        }
    ]);
    
    const totalUsers = uniqueCustomersResult && uniqueCustomersResult.length > 0 
        ? uniqueCustomersResult[0].total 
        : 0;

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
