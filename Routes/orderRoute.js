import express from 'express'
import  {placeOrder, placeOrderStripe, placeOrderRazorpay, allOrders, userOrders, updateStatus, verifyRazorpay} from '../Controllers/orderController.js'
import adminAuth from '../Middleware/adminAuth.js'
import authUser from '../Middleware/auth.js';

const orderRouter = express.Router();

//admin feature
orderRouter.post('/list',adminAuth,allOrders);
orderRouter.post('/status',adminAuth,updateStatus);

//payment features
orderRouter.post('/place',authUser,placeOrder)
orderRouter.post('/stripe',authUser,placeOrderStripe)
orderRouter.post('/razorpay',authUser,placeOrderRazorpay)
orderRouter.post('/verifyrazorpay',authUser,verifyRazorpay)

//user features
orderRouter.post('/userorders',authUser,userOrders);

export default orderRouter;