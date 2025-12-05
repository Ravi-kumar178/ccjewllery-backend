import express from 'express'
import  {placeOrder, placeOrderStripe, placeOrderAuthNet, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus, testEmail} from '../Controllers/orderController.js'
import adminAuth from '../Middleware/adminAuth.js'

const orderRouter = express.Router();

//admin feature
orderRouter.post('/list',adminAuth,allOrders);
orderRouter.post('/status',adminAuth,updateStatus);

//public payment features (no authentication - anyone can place order)
orderRouter.post('/place', placeOrder)
orderRouter.post('/authnet', placeOrderAuthNet)

//public order lookup
orderRouter.post('/getorder', getOrderByCart);
orderRouter.post('/getbytransaction', getOrderByTransactionId);
orderRouter.post('/getbyordernumber', getOrderByOrderNumber);

//test email endpoint
orderRouter.post('/test-email', testEmail);

export default orderRouter;