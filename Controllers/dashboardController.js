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
    // Use aggregation to get distinct emails, case-insensitive and filtering out null/empty values
    const includeEmails = req.query.includeEmails === 'true';
    
    const uniqueCustomersPipeline = [
        {
            $match: {
                email: { 
                    $exists: true, 
                    $ne: null, 
                    $ne: '',
                    $type: 'string'
                }
            }
        },
        {
            $project: {
                emailLower: { $toLower: { $trim: { input: '$email' } } }
            }
        },
        {
            $match: {
                emailLower: { $ne: '' }
            }
        },
        {
            $group: {
                _id: '$emailLower'
            }
        }
    ];

    // If we need the list of emails, get them; otherwise just count
    let uniqueEmails = [];
    let totalUsers = 0;

    if (includeEmails) {
        // Get the list of unique emails
        const uniqueEmailsResult = await orderModel.aggregate([
            ...uniqueCustomersPipeline,
            {
                $project: {
                    _id: 0,
                    email: '$_id'
                }
            },
            {
                $sort: { email: 1 }
            }
        ]);
        uniqueEmails = uniqueEmailsResult.map(item => item.email);
        totalUsers = uniqueEmails.length;
    } else {
        // Just count
        const uniqueCustomersResult = await orderModel.aggregate([
            ...uniqueCustomersPipeline,
            {
                $count: 'total'
            }
        ]);
        totalUsers = uniqueCustomersResult && uniqueCustomersResult.length > 0 
            ? uniqueCustomersResult[0].total 
            : 0;
    }
    
    // Debug logging
    console.log('Unique customers count:', totalUsers);
    if (includeEmails) {
        console.log('Unique emails:', uniqueEmails);
    }

    const response = {
      success: true,
      stats: {
        revenue: totalRevenue,
        orders: totalOrders,
        products: totalProducts,
        users: totalUsers
      }
    };

    // Include unique emails list if requested
    if (includeEmails) {
      response.stats.uniqueEmails = uniqueEmails;
    }

    return res.json(response);

  } catch (error) {
    console.log(error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    console.log('=== getAllUsers endpoint called ===');
    
    // Get all orders with emails and process them to extract unique users
    const allOrders = await orderModel.find({
      email: { $exists: true, $ne: null, $ne: '' }
    }).lean();
    
    console.log(`Found ${allOrders.length} orders with emails`);
    
    // Group orders by unique email (case-insensitive)
    const emailMap = {};
    allOrders.forEach(order => {
      if (!order.email || typeof order.email !== 'string') return;
      
      const emailLower = order.email.toLowerCase().trim();
      if (!emailLower) return;
      
      // Initialize user data if this is the first order for this email
      if (!emailMap[emailLower]) {
        emailMap[emailLower] = {
          email: emailLower,
          firstName: order.firstName || '',
          lastName: order.lastName || '',
          orders: 0,
          totalSpent: 0,
          firstOrderDate: order.date,
          lastOrderDate: order.date
        };
      }
      
      // Update stats
      emailMap[emailLower].orders += 1;
      if (order.payment === true) {
        emailMap[emailLower].totalSpent += (order.amount || 0);
      }
      
      // Update dates
      if (order.date) {
        if (!emailMap[emailLower].firstOrderDate || order.date < emailMap[emailLower].firstOrderDate) {
          emailMap[emailLower].firstOrderDate = order.date;
        }
        if (!emailMap[emailLower].lastOrderDate || order.date > emailMap[emailLower].lastOrderDate) {
          emailMap[emailLower].lastOrderDate = order.date;
        }
      }
    });
    
    // Convert to array of users with stats
    const usersWithStats = Object.values(emailMap).map(userData => {
      // Determine status based on spending
      let status = 'New';
      if (userData.totalSpent >= 3000) {
        status = 'VIP';
      } else if (userData.totalSpent >= 1000 || userData.orders >= 5) {
        status = 'Regular';
      }

      // Use first order date as joined date
      const joinedDate = userData.firstOrderDate 
        ? new Date(userData.firstOrderDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      // Create name from firstName and lastName
      const fullName = [userData.firstName, userData.lastName]
        .filter(Boolean)
        .join(' ') || userData.email;

      return {
        _id: `user_${userData.email.replace(/[^a-z0-9]/g, '_')}`, // Create a safe ID from email
        name: fullName,
        email: userData.email,
        orders: userData.orders,
        spent: userData.totalSpent,
        joined: joinedDate,
        status: status,
        profileImage: null
      };
    });

    // Sort by total spent (descending)
    usersWithStats.sort((a, b) => b.spent - a.spent);

    // Calculate stats
    const totalUsers = usersWithStats.length;
    const activeUsers = usersWithStats.filter(u => u.orders > 0).length;
    const vipUsers = usersWithStats.filter(u => u.status === 'VIP').length;

    // Get list of all unique email IDs
    const uniqueEmails = usersWithStats.map(u => u.email).sort();

    console.log(`Returning ${totalUsers} unique users from orders`);
    console.log(`Unique emails: ${uniqueEmails.join(', ')}`);
    console.log(`Active users: ${activeUsers}, VIP users: ${vipUsers}`);
    console.log('=== getAllUsers completed ===');

    return res.json({
      success: true,
      users: usersWithStats,
      stats: {
        totalUsers,
        activeUsers,
        vipUsers
      },
      uniqueEmails: uniqueEmails // List of all unique email IDs from orders
    });

  } catch (error) {
    console.error('=== Error in getAllUsers ===');
    console.error(error);
    return res.status(500).json({ 
      success: false, 
      message: error.message,
      error: error.stack 
    });
  }
};
