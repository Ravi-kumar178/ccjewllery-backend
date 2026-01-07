import express from 'express'
import  {placeOrder, placeOrderRazorpay, verifyRazorpay, placeOrderAuthNet, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus, testEmail, testOrderEmails, testPayment} from '../Controllers/orderController.js'
import adminAuth from '../Middleware/adminAuth.js'

const orderRouter = express.Router();

//admin feature
orderRouter.post('/list',adminAuth,allOrders);
orderRouter.post('/status',adminAuth,updateStatus);

//public payment features (no authentication - anyone can place order)
orderRouter.post('/place', placeOrder)
orderRouter.post('/authnet', placeOrderAuthNet)
orderRouter.post('/razorpay', placeOrderRazorpay)
orderRouter.post('/verifyrazorpay', verifyRazorpay)

//public order lookup
orderRouter.post('/getorder', getOrderByCart);
orderRouter.post('/getbytransaction', getOrderByTransactionId);
orderRouter.post('/getbyordernumber', getOrderByOrderNumber);

//test email endpoints
orderRouter.post('/test-email', testEmail);
orderRouter.post('/test-order-emails', testOrderEmails);
orderRouter.post('/test-payment', testPayment);

export default orderRouter;




# PORT = 4000
# MONGODB_URL = "mongodb+srv://bhardwajravi2025:cLqhB5jOli967RQ1@ravi-db.u6k88ef.mongodb.net/ccjewellary?appName=Ravi-db"
# CLOUDINARY_API_KEY = "735875637969391"
# CLOUDINARY_SECRET_KEY = "V9lYFBxDgn6ZMC0NZgYYVMJoBuU"
# CLOUDINARY_NAME = "dxxodwlyf"
# JWT_SECRET = "ravikumar"
# ADMIN_LOGIN = "admin@forever.com"
# ADMIN_PASSWORD = "qwerty123"
# RAZORPAY_KEY_SECRET = 'k7svjtkPxlsxK89okLSYxLrS'
# RAZORPAY_KEY_ID = 'rzp_test_tb9Izoc8w1ghmr'
# AUTHNET_LOGIN_ID = "5KP3u95bQpv"
# AUTHNET_TRANSACTION_KEY = "346HZ32z0fnL58Zv"
# AUTHNET_MODE = "sandbox"
RESEND_API_KEY = "re_bx2qxTTC_9etVSMtxJLEJyQXu9rDayLPZ"
ADMIN_EMAIL = "1js20is089@gmail.com"
 
# MongoDB Connection String
# Using 127.0.0.1 instead of localhost to force IPv4 connection
MONGODB_URL="mongodb+srv://bhardwajravi2025:cLqhB5jOli967RQ1@ravi-db.u6k88ef.mongodb.net/ccjewellary?appName=Ravi-db"
 
# Server Port
PORT=4000
 
# Cloudinary Configuration (Required for product image uploads)
CLOUDINARY_NAME=dxxodwlyf
CLOUDINARY_API_KEY=735875637969391
CLOUDINARY_SECRET_KEY=V9lYFBxDgn6ZMC0NZgYYVMJoBuU
 
# JWT Secret (for authentication - currently disabled but kept for future use)
JWT_SECRET=ravikumar
 
# Admin Credentials (for admin login)
ADMIN_LOGIN=admin@forever.com
ADMIN_PASSWORD=qwerty123
 
# Authorize.Net Configuration (Required for credit card payments)
AUTHNET_LOGIN_ID = "97nWLXa2X"
AUTHNET_TRANSACTION_KEY = "4bN8p82QFC8a9Nhf"
AUTHNET_MODE = "production"
# Change to 'production' when ready for live payments
# AUTHNET_MODE=production
# AUTHNET_LOGIN_ID=your_production_login_id
# AUTHNET_TRANSACTION_KEY=your_production_transaction_key
 
 
RAZORPAY_KEY_SECRET = 'KdLyQfiuSVRiCY8hEz7jbEh1'
RAZORPAY_KEY_ID = 'rzp_test_us_RuYmJenu8VuHzd'
EMAIL_FROM=noreply@ccjeweler.com

