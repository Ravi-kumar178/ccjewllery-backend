import express from 'express'
import  {placeOrder, placeOrderRazorpay, verifyRazorpay, placeOrderAuthNet, placeOrderStripe, confirmStripePayment, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus, testEmail, testOrderEmails, testPayment} from '../Controllers/orderController.js'
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
orderRouter.post('/stripe', placeOrderStripe)
orderRouter.post('/confirmstripe', confirmStripePayment)

//public order lookup
orderRouter.post('/getorder', getOrderByCart);
orderRouter.post('/getbytransaction', getOrderByTransactionId);
orderRouter.post('/getbyordernumber', getOrderByOrderNumber);

//test email endpoints
orderRouter.post('/test-email', testEmail);
orderRouter.post('/test-order-emails', testOrderEmails);
orderRouter.post('/test-payment', testPayment);

export default orderRouter;


