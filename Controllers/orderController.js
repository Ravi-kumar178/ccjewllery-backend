import orderModel from '../Models/orderModel.js'
import Cart from '../Models/cartModel.js'
import productModel from '../Models/productModel.js'
import razorpay from 'razorpay'
import https from 'https'

//global variable
const currency = 'inr'
const deliveryCharge = 10

// Authorize.Net configuration
const AUTHNET_LOGIN_ID = process.env.AUTHNET_LOGIN_ID || 'SANDBOX_LOGIN'
const AUTHNET_TRANSACTION_KEY = process.env.AUTHNET_TRANSACTION_KEY || 'SANDBOX_KEY'
const AUTHNET_MODE = process.env.AUTHNET_MODE || 'sandbox' // 'sandbox' or 'production'
const AUTHNET_ENDPOINT = AUTHNET_MODE === 'production' 
  ? 'api.authorize.net' 
  : 'apitest.authorize.net'

//razorpay instance
const razorpayInstance = new razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
});

// Helper function to call Authorize.Net API
const callAuthorizeNet = (payload) => {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload)
        console.log('Authorize.Net Request:', postData.substring(0, 200))
        
        // For testing in sandbox mode, simulate the response based on card number
        if (AUTHNET_MODE === 'sandbox' || process.env.NODE_ENV === 'development') {
            console.log('SANDBOX MODE - Simulating Authorize.Net response')
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
            paymentMethod:"COD",
            payment:false
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Mark cart as checkedout
        await Cart.findByIdAndUpdate(cartId, { status: 'checkedout' });

        return res.json({success:true, message:"Order Placed", order: newOrder})
        
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
            paymentMethod:"Authorize.Net",
            payment:false,
            transactionId: null
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
            // Success
            const transactionId = response.transactionResponse.transId;
            await orderModel.findByIdAndUpdate(newOrder._id, {
                payment: true,
                transactionId,
                status: "Paid"
            });
            await Cart.findByIdAndUpdate(cartId, { status: 'completed' });

            return res.json({
                success:true, 
                message:"Payment successful", 
                order: {
                    ...newOrder.toObject(),
                    payment: true,
                    transactionId
                }
            })
        } else {
            // Payment failed
            const errorMessage = response?.transactionResponse?.errors?.[0]?.errorText || "Payment declined"
            await orderModel.findByIdAndUpdate(newOrder._id, { status: "Payment Failed" });
            
            return res.status(400).json({
                success:false, 
                message: `Payment failed: ${errorMessage}`,
                order: newOrder
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
        const orders = await orderModel.find({});
        return res.json({success:true,orders})
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
        return res.json({success:true, order})
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

export {placeOrder, placeOrderStripe, placeOrderAuthNet, allOrders, getOrderByCart, updateStatus}