import orderModel from '../Models/orderModel.js'
import Cart from '../Models/cartModel.js'
import productModel from '../Models/productModel.js'
import https from 'https'

//global variable
const deliveryCharge = 10

// Generate unique order number
const generateOrderNumber = () => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ORD-${timestamp}-${random}`;
}

// Generate COD transaction reference
const generateCODReference = () => {
    return `COD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

// Authorize.Net configuration
const AUTHNET_LOGIN_ID = process.env.AUTHNET_LOGIN_ID || 'SANDBOX_LOGIN'
const AUTHNET_TRANSACTION_KEY = process.env.AUTHNET_TRANSACTION_KEY || 'SANDBOX_KEY'
const AUTHNET_MODE = process.env.AUTHNET_MODE || 'sandbox' // 'sandbox' or 'production'
const AUTHNET_ENDPOINT = AUTHNET_MODE === 'production' 
  ? 'api.authorize.net' 
  : 'apitest.authorize.net'

// Helper function to call Authorize.Net API
const callAuthorizeNet = (payload) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)
        console.log('Authorize.Net Request:', postData.substring(0, 200))
        
        // For testing in sandbox mode, simulate the response based on card number
        // ONLY simulate if explicitly in sandbox mode AND using test credentials
        if (AUTHNET_MODE === 'sandbox' && 
            (AUTHNET_LOGIN_ID === 'SANDBOX_LOGIN' || AUTHNET_TRANSACTION_KEY === 'SANDBOX_KEY')) {
            console.log('SANDBOX MODE - Simulating Authorize.Net response (using test credentials)')
            // Simulate Authorize.Net response based on test card
            const cardNumber = payload.createTransactionRequest.transactionRequest.payment.creditCard.cardNumber
            
            setTimeout(() => {
                if (cardNumber === '4111111111111111') {
                    // Approved test card
                    resolve({
                        transactionResponse: {
                            responseCode: '1',
                            transId: 'SIM_' + Date.now(),
                            responseReason: 'This transaction has been approved.'
                        }
                    })
                } else if (cardNumber === '4222222222222220') {
                    // Declined test card
                    resolve({
                        transactionResponse: {
                            responseCode: '2',
                            transId: null,
                            responseReason: 'This transaction has been declined.'
                        }
                    })
                } else {
                    reject(new Error('Invalid test card. Use 4111111111111111 (approved) or 4222222222222220 (declined)'))
                }
            }, 500)
            return
        }
        
        // Production mode or sandbox with real credentials - use real API
        if (AUTHNET_MODE === 'production') {
            console.log('PRODUCTION MODE - Processing real payment through Authorize.Net')
        } else {
            console.log('SANDBOX MODE - Using Authorize.Net sandbox API')
        }
        
        const options = {
            hostname: AUTHNET_ENDPOINT,
            port: 443,
            path: '/xml/v1/request.json',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }

        const req = https.request(options, (res) => {
            let data = ''
            res.on('data', (chunk) => { data += chunk })
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data))
                } catch (e) {
                    reject(new Error(`Failed to parse response: ${e.message}`))
                }
            })
        })

        req.on('error', reject)
        req.write(postData)
        req.end()
    })
}

//placing orders using cod method
const placeOrder = async(req,res) => {

    try {
        const{ cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone } = req.body;

        if(!cartId || !firstName || !lastName || !email || !street || !city || !state || !zipCode || !country || !phone) {
            return res.status(400).json({success:false, message:"All fields except amount are required (amount can be computed from cart)"})
        }

        const cart = await Cart.findById(cartId);
        if(!cart) return res.status(404).json({success:false, message:'Cart not found'})
        if(!cart.items || cart.items.length === 0) return res.status(400).json({success:false, message:'Cart is empty'})

        // compute amount if not provided by summing product prices
        let finalAmount = amount ? Number(amount) : 0;
        if(!amount){
            for(const it of cart.items){
                try{
                    const prod = await productModel.findById(it.productId);
                    const price = prod && prod.price ? Number(prod.price) : 0;
                    finalAmount += price * (Number(it.quantity) || 1);
                }catch(e){
                    // ignore missing product price
                }
            }
            // optionally add delivery charge
            finalAmount += deliveryCharge;
        }

        // Generate unique order number and COD reference
        const orderNumber = generateOrderNumber();
        const codReference = generateCODReference();

        const orderData = {
            cartId,
            items: cart.items,
            amount: finalAmount,
            firstName,
            lastName,
            email,
            street,
            city,
            state,
            zipCode,
            country,
            phone,
            paymentMethod: "COD",
            payment: false,
            transactionId: codReference, // COD reference number
            orderNumber: orderNumber,
            paymentStatus: 'pending', // COD is pending until delivery
            paymentDetails: {
                gateway: 'COD',
                transactionId: codReference,
                responseCode: 'COD',
                responseMessage: 'Cash on Delivery - Payment pending',
                processedAt: new Date()
            }
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Mark cart as checkedout
        await Cart.findByIdAndUpdate(cartId, { status: 'checkedout' });

        return res.json({
            success: true, 
            message: "Order Placed", 
            order: newOrder,
            orderNumber: orderNumber,
            transactionId: codReference
        })
        
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
    
}
//placing orders using cod method
const placeOrderStripe = async(req,res) => {

}
//placing orders using Authorize.Net
const placeOrderAuthNet = async(req,res) => {
    try {
        const{ cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone, cardNumber, cardExpiry, cardCVV } = req.body;

        if(!cartId || !firstName || !lastName || !email || !street || !city || !state || !zipCode || !country || !phone || !cardNumber || !cardExpiry || !cardCVV) {
            return res.status(400).json({success:false, message:"All fields including card details are required"})
        }

        const cart = await Cart.findById(cartId);
        if(!cart) return res.status(404).json({success:false, message:'Cart not found'})
        if(!cart.items || cart.items.length === 0) return res.status(400).json({success:false, message:'Cart is empty'})

        // compute amount if not provided
        let finalAmount = amount ? Number(amount) : 0;
        if(!amount){
            for(const it of cart.items){
                try{
                    const prod = await productModel.findById(it.productId);
                    const price = prod && prod.price ? Number(prod.price) : 0;
                    finalAmount += price * (Number(it.quantity) || 1);
                }catch(e){
                    // ignore
                }
            }
            finalAmount += deliveryCharge;
        }

        // Parse card expiry (MM/YY)
        const [expMonth, expYear] = cardExpiry.split('/')
        if(!expMonth || !expYear) return res.status(400).json({success:false, message:"Card expiry format should be MM/YY"})

        // Generate unique order number
        const orderNumber = generateOrderNumber();

        // Create order FIRST (pending state)
        const orderData = {
            cartId,
            items: cart.items,
            amount: finalAmount,
            firstName,
            lastName,
            email,
            street,
            city,
            state,
            zipCode,
            country,
            phone,
            paymentMethod: "Authorize.Net",
            payment: false,
            transactionId: null,
            orderNumber: orderNumber,
            paymentStatus: 'pending'
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Call Authorize.Net API
        const payload = {
            createTransactionRequest: {
                merchantAuthentication: {
                    name: AUTHNET_LOGIN_ID,
                    transactionKey: AUTHNET_TRANSACTION_KEY
                },
                refId: newOrder._id.toString(),
                transactionRequest: {
                    transactionType: "authCaptureTransaction",
                    amount: finalAmount.toFixed(2),
                    payment: {
                        creditCard: {
                            cardNumber: cardNumber.replace(/\s/g, ''),
                            expirationDate: `20${expYear}-${expMonth}`,
                            cardCode: cardCVV
                        }
                    },
                    billTo: {
                        firstName,
                        lastName,
                        address: street,
                        city,
                        state,
                        zip: zipCode,
                        country,
                        phoneNumber: phone,
                        email
                    }
                }
            }
        }

        const response = await callAuthorizeNet(payload);
        
        // Check if transaction was successful
        if(response?.transactionResponse?.responseCode === "1") {
            // Success - Payment approved
            const transactionId = response.transactionResponse.transId;
            const responseCode = response.transactionResponse.responseCode;
            const responseMessage = response.transactionResponse.responseReason || "Payment approved";
            
            await orderModel.findByIdAndUpdate(newOrder._id, {
                payment: true,
                transactionId: transactionId,
                status: "Paid",
                paymentStatus: 'completed',
                paymentDate: new Date(),
                paymentDetails: {
                    gateway: 'AUTHORIZE_NET',
                    transactionId: transactionId,
                    responseCode: responseCode,
                    responseMessage: responseMessage,
                    processedAt: new Date()
                }
            });
            await Cart.findByIdAndUpdate(cartId, { status: 'completed' });

            // Fetch updated order
            const updatedOrder = await orderModel.findById(newOrder._id);

            return res.json({
                success: true, 
                message: "Payment successful", 
                order: updatedOrder,
                orderNumber: orderNumber,
                transactionId: transactionId
            })
        } else {
            // Payment failed
            const errorMessage = response?.transactionResponse?.errors?.[0]?.errorText || 
                                response?.transactionResponse?.responseReason || 
                                "Payment declined";
            const responseCode = response?.transactionResponse?.responseCode || '0';
            
            await orderModel.findByIdAndUpdate(newOrder._id, { 
                status: "Payment Failed",
                paymentStatus: 'failed',
                paymentDetails: {
                    gateway: 'AUTHORIZE_NET',
                    transactionId: null,
                    responseCode: responseCode,
                    responseMessage: errorMessage,
                    processedAt: new Date()
                }
            });
            
            return res.status(400).json({
                success: false, 
                message: `Payment failed: ${errorMessage}`,
                order: newOrder,
                orderNumber: orderNumber
            })
        }

    } catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}
//placing orders using razorpay method - COMMENTED OUT
// const placeOrderRazorpay = async(req,res) => {
// 
//     try {
//         const { cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone } = req.body;
// 
//         if(!cartId || !firstName || !lastName || !email || !street || !city || !state || !zipCode || !country || !phone) {
//             return res.status(400).json({success:false, message:"All fields except amount are required (amount can be computed from cart)"})
//         }
// 
//         const cart = await Cart.findById(cartId);
//         if(!cart) return res.status(404).json({success:false, message:'Cart not found'})
//         if(!cart.items || cart.items.length === 0) return res.status(400).json({success:false, message:'Cart is empty'})
// 
//         let finalAmount = amount ? Number(amount) : 0;
//         if(!amount){
//             for(const it of cart.items){
//                 try{
//                     const prod = await productModel.findById(it.productId);
//                     const price = prod && prod.price ? Number(prod.price) : 0;
//                     finalAmount += price * (Number(it.quantity) || 1);
//                 }catch(e){
//                     // ignore
//                 }
//             }
//             finalAmount += deliveryCharge;
//         }
// 
//         const orderData = {
//             cartId,
//             items: cart.items,
//             amount: finalAmount,
//             firstName,
//             lastName,
//             email,
//             street,
//             city,
//             state,
//             zipCode,
//             country,
//             phone,
//             paymentMethod:"Razorpay",
//             payment: false
//         }
// 
//         const newOrder = new orderModel(orderData);
//         await newOrder.save()
// 
//         const options = {
//             amount: finalAmount*100,
//             currency: currency.toUpperCase(),
//             receipt: newOrder._id.toString()
//         }
// 
//         await razorpayInstance.orders.create(options,(error,order)=>{
//             if(error){
//                 console.log(error);
//                 return res.json({success:false, message:error})
//             }
//             else{
//                 res.json({success:true, order})
//             }
//         })
// 
//     } 
//     catch (error) {
//         console.log(error);
//         return res.json({success: false, message:error.message}) 
//     }
// 
// }


//verify razorpay - COMMENTED OUT
// const verifyRazorpay = async(req,res)=>{
//     try {
//         
//         const{ cartId, razorpay_order_id } = req.body;
// 
//         const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
//         if(orderInfo.status === 'paid'){
//             await orderModel.findByIdAndUpdate(orderInfo.receipt,{payment:true});
//             await Cart.findByIdAndUpdate(cartId, { status: 'completed' });
//             return res.json({success:true, message:'Payment successful'})
//         }
//         else{
//             return res.json({success:false, message:'Payment failed'})
//         }
// 
// 
//     }
//      catch (error) {
//         console.log(error);
//         return res.json({success: false, message:error.message}) 
//     }
// }


//placing orders using cod method
const allOrders = async(req,res) => {
    try {
        const orders = await orderModel.find({}).sort({ date: -1 }); // Latest first
        // Include payment tracking info
        const ordersWithTracking = orders.map(order => ({
            ...order.toObject(),
            orderNumber: order.orderNumber,
            transactionId: order.transactionId,
            paymentStatus: order.paymentStatus,
            paymentDetails: order.paymentDetails,
            paymentDate: order.paymentDate
        }));
        return res.json({success:true, orders: ordersWithTracking, total: orders.length})
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}
//get orders by cart (public)
const getOrderByCart = async(req,res) => {
    try {
        const {cartId} = req.body;
        if(!cartId) return res.status(400).json({success:false, message:"cartId is required"})
        const order = await orderModel.findOne({cartId});
        if(!order) return res.status(404).json({success:false, message:"Order not found"})
        return res.json({
            success: true, 
            order: order,
            orderNumber: order.orderNumber,
            transactionId: order.transactionId,
            paymentStatus: order.paymentStatus
        })
    }
     catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}

//get order by transaction ID (public - for tracking payments)
const getOrderByTransactionId = async(req,res) => {
    try {
        const {transactionId} = req.body;
        if(!transactionId) return res.status(400).json({success:false, message:"transactionId is required"})
        const order = await orderModel.findOne({transactionId});
        if(!order) return res.status(404).json({success:false, message:"Order not found with this transaction ID"})
        return res.json({
            success: true, 
            order: order,
            orderNumber: order.orderNumber,
            transactionId: order.transactionId,
            paymentStatus: order.paymentStatus,
            paymentDetails: order.paymentDetails
        })
    }
     catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}

//get order by order number (public - for tracking orders)
const getOrderByOrderNumber = async(req,res) => {
    try {
        const {orderNumber} = req.body;
        if(!orderNumber) return res.status(400).json({success:false, message:"orderNumber is required"})
        const order = await orderModel.findOne({orderNumber});
        if(!order) return res.status(404).json({success:false, message:"Order not found with this order number"})
        return res.json({
            success: true, 
            order: order,
            orderNumber: order.orderNumber,
            transactionId: order.transactionId,
            paymentStatus: order.paymentStatus,
            paymentDetails: order.paymentDetails
        })
    }
     catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}
//placing orders using cod method
const updateStatus = async(req,res) => {
    try {
        const{orderId,status} = req.body;
        await orderModel.findByIdAndUpdate(orderId,{status});
        return res.json({success:true,message:'Status Updated'})
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}

export {placeOrder, placeOrderStripe, placeOrderAuthNet, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus}