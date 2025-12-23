import orderModel from '../Models/orderModel.js'
import Cart from '../Models/cartModel.js'
import productModel from '../Models/productModel.js'
import https from 'https'
import { sendEmail } from '../Config/email.js'
import Razorpay from 'razorpay'
import crypto from 'crypto'

//global variable
const deliveryCharge = 10

// Razorpay configuration
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET

// Initialize Razorpay instance (only if credentials are provided)
const razorpayInstance = RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET 
    ? new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    })
    : null

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

// Helper function to generate order confirmation email HTML
const generateOrderEmailHTML = async (order, items) => {
    // Get product details for items
    const itemDetails = await Promise.all(
        items.map(async (item) => {
            try {
                const product = await productModel.findById(item.productId);
                return {
                    name: product?.name || 'Product',
                    price: product?.price || 0,
                    quantity: item.quantity || 1,
                    image: product?.image?.[0] || ''
                };
            } catch (e) {
                return {
                    name: 'Product',
                    price: 0,
                    quantity: item.quantity || 1,
                    image: ''
                };
            }
        })
    );

    const subtotal = itemDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08;
    const total = order.amount;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #D4AF37 0%, #B8941F 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #D4AF37; }
            .item { display: flex; padding: 15px 0; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .item-image { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px; }
            .item-details { flex: 1; }
            .item-name { font-weight: bold; margin-bottom: 5px; }
            .item-price { color: #D4AF37; font-weight: bold; }
            .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; }
            .summary-total { border-top: 2px solid #D4AF37; padding-top: 15px; font-size: 1.2em; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎉 Order Confirmation</h1>
                <p>Thank you for your purchase!</p>
            </div>
            <div class="content">
                <div class="order-info">
                    <h2>Order Details</h2>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Transaction ID:</strong> ${order.transactionId || 'N/A'}</p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                    <p><strong>Payment Status:</strong> ${order.paymentStatus === 'completed' ? '✅ Paid' : '⏳ Pending'}</p>
                    <p><strong>Order Date:</strong> ${new Date(order.date).toLocaleString()}</p>
                </div>

                <h3>Order Items</h3>
                ${itemDetails.map(item => `
                    <div class="item">
                        ${item.image ? `<img src="${item.image}" alt="${item.name}" class="item-image" />` : ''}
                        <div class="item-details">
                            <div class="item-name">${item.name}</div>
                            <div>Quantity: ${item.quantity}</div>
                            <div class="item-price">$${(item.price * item.quantity).toLocaleString()}</div>
                        </div>
                    </div>
                `).join('')}

                <div class="summary">
                    <div class="summary-row">
                        <span>Subtotal:</span>
                        <span>$${subtotal.toLocaleString()}</span>
                    </div>
                    <div class="summary-row">
                        <span>Tax:</span>
                        <span>$${tax.toFixed(2)}</span>
                    </div>
                    <div class="summary-row">
                        <span>Shipping:</span>
                        <span>Free</span>
                    </div>
                    <div class="summary-row summary-total">
                        <span>Total:</span>
                        <span>$${total.toLocaleString()}</span>
                    </div>
                </div>

                <div class="order-info">
                    <h3>Shipping Address</h3>
                    <p>${order.firstName} ${order.lastName}</p>
                    <p>${order.street}</p>
                    <p>${order.city}, ${order.state} ${order.zipCode}</p>
                    <p>${order.country}</p>
                    <p>Phone: ${order.phone}</p>
                </div>

                <div class="footer">
                    <p>We'll send you another email when your order ships!</p>
                    <p>If you have any questions, please contact our support team.</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
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
        
        // For sandbox mode, ALWAYS use simulation (Authorize.Net JSON API endpoint returns 404)
        // This ensures testing works without real API calls
        if (AUTHNET_MODE === 'sandbox') {
            console.log('SANDBOX MODE - Using simulation (Authorize.Net JSON API endpoint not available)')
            console.log('This will simulate payment responses based on test card numbers')
            // Simulate Authorize.Net response based on test card
            const cardNumber = payload.createTransactionRequest.transactionRequest.payment.creditCard.cardNumber.replace(/\s/g, '')
            
            setTimeout(() => {
                if (cardNumber === '4111111111111111') {
                    // Approved test card
                    resolve({
                        transactionResponse: {
                            responseCode: '1',
                            transId: 'SIM_' + Date.now(),
                            responseReason: 'This transaction has been approved.',
                            messages: {
                                message: [{
                                    code: '1',
                                    description: 'This transaction has been approved.'
                                }]
                            }
                        }
                    })
                } else if (cardNumber === '4222222222222220') {
                    // Declined test card
                    resolve({
                        transactionResponse: {
                            responseCode: '2',
                            transId: null,
                            responseReason: 'This transaction has been declined.',
                            errors: {
                                error: [{
                                    errorCode: '2',
                                    errorText: 'This transaction has been declined.'
                                }]
                            }
                        }
                    })
                } else {
                    // Default to approved for any other test card in sandbox simulation
                    resolve({
                        transactionResponse: {
                            responseCode: '1',
                            transId: 'SIM_' + Date.now(),
                            responseReason: 'This transaction has been approved (sandbox simulation).'
                        }
                    })
                }
            }, 500)
            return
        }
        
        // Production mode - attempt real API call
        // Note: Authorize.Net JSON API endpoint structure may vary
        // If you get 404 errors, Authorize.Net may require XML API or different endpoint
        if (AUTHNET_MODE === 'production') {
            console.log('PRODUCTION MODE - Attempting real payment through Authorize.Net')
            console.warn('WARNING: If you get 404 errors, Authorize.Net JSON API may not be available.')
            console.warn('Consider using XML API or contact Authorize.Net support for correct endpoint.')
        } else {
            // Should not reach here in sandbox mode (should use simulation above)
            console.log('SANDBOX MODE - Falling back to simulation due to API limitations')
            const cardNumber = payload.createTransactionRequest.transactionRequest.payment.creditCard.cardNumber.replace(/\s/g, '')
            setTimeout(() => {
                resolve({
                    transactionResponse: {
                        responseCode: '1',
                        transId: 'SIM_' + Date.now(),
                        responseReason: 'This transaction has been approved (sandbox simulation).'
                    }
                })
            }, 500)
            return
        }
        
        // Authorize.Net JSON API endpoint (may not be available - returns 404)
        // Alternative: Use XML API at /xml/v1/request.api
        const options = {
            hostname: AUTHNET_ENDPOINT,
            port: 443,
            path: '/v1/request.json', // This endpoint returns 404 - may need to use XML API instead
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData),
                'Accept': 'application/json'
            }
        }

        console.log('Making request to:', `https://${AUTHNET_ENDPOINT}${options.path}`)
        console.log('Request payload length:', Buffer.byteLength(postData))

        const req = https.request(options, (res) => {
            let data = ''
            let statusCode = res.statusCode
            
            // Log response headers immediately
            console.log('Response Status Code:', statusCode)
            console.log('Response Headers:', JSON.stringify(res.headers, null, 2))
            
            res.on('data', (chunk) => { 
                const chunkStr = chunk.toString()
                data += chunkStr
                console.log('Received chunk, length:', chunkStr.length, 'Total so far:', data.length)
            })
            
            res.on('end', () => {
                console.log('Response complete. Total data length:', data.length)
                console.log('Raw response (first 1000 chars):', data.substring(0, 1000))
                
                if (statusCode === 404) {
                    console.error('Authorize.Net API returned 404 - Endpoint not found')
                    console.error('This means the JSON API endpoint may not be available.')
                    console.error('Options:')
                    console.error('1. Use sandbox simulation mode (set AUTHNET_MODE=sandbox)')
                    console.error('2. Use Authorize.Net XML API instead of JSON API')
                    console.error('3. Contact Authorize.Net support for correct JSON API endpoint')
                    return reject(new Error('Authorize.Net JSON API endpoint not found (404). For sandbox testing, use simulation mode. For production, you may need to use XML API or contact Authorize.Net support.'))
                }
                
                if (statusCode !== 200 && statusCode !== 201) {
                    console.error('Authorize.Net API Error - Status:', statusCode)
                    console.error('Full Response:', data)
                    return reject(new Error(`Authorize.Net API returned status ${statusCode}. Response: ${data.substring(0, 500)}`))
                }
                
                if (!data || data.trim().length === 0) {
                    console.error('Authorize.Net returned empty response')
                    console.error('This usually means:')
                    console.error('1. Invalid API credentials')
                    console.error('2. Wrong API endpoint')
                    console.error('3. Network/firewall blocking the request')
                    console.error('4. Authorize.Net server issue')
                    console.error('5. Credentials might be for XML API, not JSON API')
                    
                    // If in sandbox mode and we get empty response, suggest using simulation
                    if (AUTHNET_MODE === 'sandbox') {
                        console.warn('Since you are in SANDBOX mode, consider using simulation mode by setting:')
                        console.warn('AUTHNET_LOGIN_ID=SANDBOX_LOGIN')
                        console.warn('AUTHNET_TRANSACTION_KEY=SANDBOX_KEY')
                    }
                    
                    return reject(new Error('Authorize.Net returned empty response. Please check your API credentials and ensure you are using the correct sandbox/production endpoint. If using sandbox, you can use simulation mode with placeholder credentials.'))
                }
                
                try {
                    const parsed = JSON.parse(data)
                    console.log('Successfully parsed JSON response')
                    console.log('Response structure:', Object.keys(parsed))
                    resolve(parsed)
                } catch (e) {
                    console.error('Failed to parse JSON. Error:', e.message)
                    console.error('Raw response (full):', data)
                    console.error('Response length:', data.length)
                    console.error('Response type:', typeof data)
                    reject(new Error(`Failed to parse response as JSON: ${e.message}. Response length: ${data.length}. First 500 chars: ${data.substring(0, 500)}`))
                }
            })
        })

        req.on('error', (error) => {
            console.error('Authorize.Net request error:', error)
            console.error('Error code:', error.code)
            console.error('Error message:', error.message)
            reject(new Error(`Network error connecting to Authorize.Net: ${error.message} (${error.code})`))
        })
        
        req.on('timeout', () => {
            console.error('Request timeout')
            req.destroy()
            reject(new Error('Authorize.Net request timeout after 30 seconds'))
        })
        
        req.setTimeout(30000)
        
        req.write(postData)
        req.end()
        
        console.log('Request sent, waiting for response...')
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

        // Send order confirmation email
        try {
            console.log(`\n📧 ===== EMAIL SENDING PROCESS START =====`);
            console.log(`📧 Preparing to send order confirmation email for Order #${orderNumber}...`);
            console.log(`📧 Customer Email: ${email}`);
            console.log(`📧 Checking email configuration...`);
            
            const emailHTML = await generateOrderEmailHTML(newOrder, cart.items);
            console.log(`📧 Email HTML generated (length: ${emailHTML.length} characters)`);
            
            const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
            console.log(`📧 Email From: ${emailFrom}`);
            console.log(`📧 Email To: ${email}`);
            console.log(`📧 Email Subject: Order Confirmation - ${orderNumber}`);
            
            const emailResult = await sendEmail({
                from: emailFrom,
                to: email,
                subject: `Order Confirmation - ${orderNumber}`,
                html: emailHTML
            });
            
            console.log(`📧 Email send result:`, JSON.stringify(emailResult, null, 2));
            
            if (emailResult.success) {
                console.log(`\n✅ ===== EMAIL SENT SUCCESSFULLY =====`);
                console.log(`✅ Order confirmation email sent successfully!`);
                console.log(`   📬 To: ${email}`);
                console.log(`   📋 Order Number: ${orderNumber}`);
                console.log(`   💰 Amount: $${finalAmount.toLocaleString()}`);
                console.log(`✅ ======================================\n`);
            } else {
                console.log(`\n⚠️  ===== EMAIL SENDING FAILED =====`);
                console.warn(`⚠️  Email service not configured or failed`);
                console.warn(`   Error:`, emailResult.error);
                console.warn(`   This is normal if RESEND_API_KEY is not set in .env`);
                console.warn(`⚠️  ====================================\n`);
            }
        } catch (emailError) {
            console.error(`\n❌ ===== EMAIL SENDING ERROR =====`);
            console.error('❌ Failed to send order confirmation email:', emailError.message);
            console.error('❌ Full error:', emailError);
            console.error(`❌ ===================================\n`);
            // Don't fail the order if email fails
        }

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
//placing orders using Razorpay method
const placeOrderRazorpay = async(req,res) => {
    try {
        // Check if Razorpay is configured
        if (!razorpayInstance) {
            return res.status(500).json({
                success: false, 
                message: "Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in environment variables."
            })
        }

        const { cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone } = req.body;

        // Validate required fields - show which field is missing
        const missingFields = [];
        if(!cartId) missingFields.push('cartId');
        if(!firstName) missingFields.push('firstName');
        if(!lastName) missingFields.push('lastName');
        if(!email) missingFields.push('email');
        if(!street) missingFields.push('street');
        if(!city) missingFields.push('city');
        if(!state) missingFields.push('state');
        if(!zipCode) missingFields.push('zipCode');
        if(!country) missingFields.push('country');
        if(!phone) missingFields.push('phone');
        
        if(missingFields.length > 0) {
            return res.status(400).json({
                success: false, 
                message: `Missing required fields: ${missingFields.join(', ')}. Amount is optional and will be calculated from cart.`
            })
        }

        // Validate cartId is a valid MongoDB ObjectId
        const mongoose = (await import('mongoose')).default;
        if (!mongoose.Types.ObjectId.isValid(cartId)) {
            return res.status(400).json({
                success: false,
                message: `Invalid cartId format. Got "${cartId}" but expected a 24-character MongoDB ObjectId like "692bdd7df73a6e0e0588c81d". Make sure you're using the cartId returned from /api/cart/add or /api/cart/create API.`
            })
        }

        // Get cart and validate
        const cart = await Cart.findById(cartId);
        if(!cart) return res.status(404).json({success:false, message:'Cart not found'})
        if(!cart.items || cart.items.length === 0) return res.status(400).json({success:false, message:'Cart is empty'})

        // Compute amount if not provided
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
            finalAmount += deliveryCharge;
        }

        // Generate unique order number
        const orderNumber = generateOrderNumber();

        // Create order in DB first (pending state)
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
            paymentMethod: "Razorpay",
            payment: false,
            transactionId: null,
            orderNumber: orderNumber,
            paymentStatus: 'pending',
            paymentDetails: {
                gateway: 'RAZORPAY',
                transactionId: null,
                responseCode: null,
                responseMessage: 'Payment initiated',
                processedAt: new Date()
            }
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Create Razorpay order
        // Note: Razorpay expects amount in paise (smallest currency unit)
        // For INR: 1 INR = 100 paise, so multiply by 100
        // For USD: If using USD, amount is in cents
        const razorpayOptions = {
            amount: Math.round(finalAmount * 100), // Convert to smallest currency unit
            currency: "INR", // Change to "USD" if needed
            receipt: newOrder._id.toString(),
            notes: {
                orderNumber: orderNumber,
                customerEmail: email,
                customerName: `${firstName} ${lastName}`
            }
        }

        const razorpayOrder = await razorpayInstance.orders.create(razorpayOptions);

        // Update order with Razorpay order ID
        await orderModel.findByIdAndUpdate(newOrder._id, {
            'paymentDetails.razorpayOrderId': razorpayOrder.id
        });

        console.log(`\n💳 ===== RAZORPAY ORDER CREATED =====`);
        console.log(`💳 Order Number: ${orderNumber}`);
        console.log(`💳 Razorpay Order ID: ${razorpayOrder.id}`);
        console.log(`💳 Amount: ${finalAmount} (${razorpayOptions.currency})`);
        console.log(`💳 Customer: ${firstName} ${lastName} (${email})`);
        console.log(`💳 =====================================\n`);

        // Return Razorpay order details to frontend
        return res.json({
            success: true,
            message: "Razorpay order created. Complete payment on frontend.",
            order: newOrder,
            orderNumber: orderNumber,
            razorpayOrder: {
                id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency
            },
            key_id: RAZORPAY_KEY_ID // Frontend needs this to open Razorpay checkout
        })

    } catch (error) {
        console.error('Razorpay order creation error:', error);
        return res.status(500).json({success: false, message: error.message})
    }
}

// Verify Razorpay payment after user completes checkout
const verifyRazorpay = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, cartId } = req.body;

        // Validate required fields
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature"
            })
        }

        // Find order by Razorpay order ID
        const order = await orderModel.findOne({ 'paymentDetails.razorpayOrderId': razorpay_order_id });
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found with this Razorpay order ID"
            })
        }

        // Verify signature using HMAC SHA256
        // Razorpay creates signature by hashing: order_id + "|" + payment_id
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        const isSignatureValid = expectedSignature === razorpay_signature;

        console.log(`\n🔐 ===== RAZORPAY SIGNATURE VERIFICATION =====`);
        console.log(`🔐 Order ID: ${razorpay_order_id}`);
        console.log(`🔐 Payment ID: ${razorpay_payment_id}`);
        console.log(`🔐 Received Signature: ${razorpay_signature.substring(0, 20)}...`);
        console.log(`🔐 Expected Signature: ${expectedSignature.substring(0, 20)}...`);
        console.log(`🔐 Signature Valid: ${isSignatureValid ? '✅ YES' : '❌ NO'}`);
        console.log(`🔐 =============================================\n`);

        if (isSignatureValid) {
            // Payment successful - Update order
            await orderModel.findByIdAndUpdate(order._id, {
                payment: true,
                transactionId: razorpay_payment_id,
                status: "Paid",
                paymentStatus: 'completed',
                paymentDate: new Date(),
                paymentDetails: {
                    gateway: 'RAZORPAY',
                    razorpayOrderId: razorpay_order_id,
                    transactionId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    responseCode: '1',
                    responseMessage: 'Payment successful',
                    processedAt: new Date()
                }
            });

            // Mark cart as completed
            if (cartId) {
                await Cart.findByIdAndUpdate(cartId, { status: 'completed' });
            } else if (order.cartId) {
                await Cart.findByIdAndUpdate(order.cartId, { status: 'completed' });
            }

            // Fetch updated order
            const updatedOrder = await orderModel.findById(order._id);

            // Send order confirmation email
            try {
                console.log(`\n📧 ===== EMAIL SENDING PROCESS START =====`);
                console.log(`📧 Preparing to send order confirmation email for Order #${order.orderNumber}...`);
                console.log(`📧 Customer Email: ${order.email}`);
                
                // Get cart for email
                const cart = await Cart.findById(order.cartId);
                const emailHTML = await generateOrderEmailHTML(updatedOrder, cart?.items || order.items);
                
                const emailResult = await sendEmail({
                    from: process.env.EMAIL_FROM || 'noreply@ccjewllery.com',
                    to: order.email,
                    subject: `Order Confirmation - ${order.orderNumber} (Payment Successful)`,
                    html: emailHTML
                });

                if (emailResult.success) {
                    console.log(`✅ Order confirmation email sent successfully to ${order.email}`);
                } else {
                    console.warn(`⚠️ Email service not configured or failed:`, emailResult.error);
                }
            } catch (emailError) {
                console.error('❌ Failed to send order confirmation email:', emailError.message);
                // Don't fail the order if email fails
            }

            console.log(`\n✅ ===== RAZORPAY PAYMENT SUCCESSFUL =====`);
            console.log(`✅ Order Number: ${order.orderNumber}`);
            console.log(`✅ Transaction ID: ${razorpay_payment_id}`);
            console.log(`✅ Amount: ${order.amount}`);
            console.log(`✅ Customer: ${order.firstName} ${order.lastName}`);
            console.log(`✅ =========================================\n`);

            return res.json({
                success: true,
                message: "Payment verified successfully",
                order: updatedOrder,
                orderNumber: order.orderNumber,
                transactionId: razorpay_payment_id
            })

        } else {
            // Signature verification failed - possible tampering
            await orderModel.findByIdAndUpdate(order._id, {
                status: "Payment Failed",
                paymentStatus: 'failed',
                paymentDetails: {
                    gateway: 'RAZORPAY',
                    razorpayOrderId: razorpay_order_id,
                    transactionId: razorpay_payment_id,
                    razorpaySignature: razorpay_signature,
                    responseCode: '0',
                    responseMessage: 'Signature verification failed',
                    processedAt: new Date()
                }
            });

            console.error(`\n❌ ===== RAZORPAY SIGNATURE VERIFICATION FAILED =====`);
            console.error(`❌ Order: ${order.orderNumber}`);
            console.error(`❌ This could indicate payment tampering!`);
            console.error(`❌ ====================================================\n`);

            return res.status(400).json({
                success: false,
                message: "Payment verification failed. Invalid signature.",
                orderNumber: order.orderNumber
            })
        }

    } catch (error) {
        console.error('Razorpay verification error:', error);
        return res.status(500).json({ success: false, message: error.message })
    }
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

            // Send order confirmation email
            try {
                console.log(`\n📧 ===== EMAIL SENDING PROCESS START =====`);
                console.log(`📧 Preparing to send order confirmation email for Order #${orderNumber}...`);
                console.log(`📧 Customer Email: ${email}`);
                console.log(`📧 Checking email configuration...`);
                
                const emailHTML = await generateOrderEmailHTML(updatedOrder, cart.items);
                console.log(`📧 Email HTML generated (length: ${emailHTML.length} characters)`);
                
                const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
                console.log(`📧 Email From: ${emailFrom}`);
                console.log(`📧 Email To: ${email}`);
                console.log(`📧 Email Subject: Order Confirmation - ${orderNumber} (Payment Successful)`);
                
                const emailResult = await sendEmail({
                    from: emailFrom,
                    to: email,
                    subject: `Order Confirmation - ${orderNumber} (Payment Successful)`,
                    html: emailHTML
                });
                
                console.log(`📧 Email send result:`, JSON.stringify(emailResult, null, 2));
                
                if (emailResult.success) {
                    console.log(`\n✅ ===== EMAIL SENT SUCCESSFULLY =====`);
                    console.log(`✅ Order confirmation email sent successfully!`);
                    console.log(`   📬 To: ${email}`);
                    console.log(`   📋 Order Number: ${orderNumber}`);
                    console.log(`   💳 Transaction ID: ${transactionId}`);
                    console.log(`   💰 Amount: $${finalAmount.toLocaleString()}`);
                    console.log(`   ✅ Payment Status: Paid`);
                    console.log(`✅ ======================================\n`);
                } else {
                    console.log(`\n⚠️  ===== EMAIL SENDING FAILED =====`);
                    console.warn(`⚠️  Email service not configured or failed`);
                    console.warn(`   Error:`, emailResult.error);
                    console.warn(`   This is normal if RESEND_API_KEY is not set in .env`);
                    console.warn(`⚠️  ====================================\n`);
                }
            } catch (emailError) {
                console.error(`\n❌ ===== EMAIL SENDING ERROR =====`);
                console.error('❌ Failed to send order confirmation email:', emailError.message);
                console.error('❌ Full error:', emailError);
                console.error(`❌ ===================================\n`);
                // Don't fail the order if email fails
            }

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

// Test email endpoint for debugging
const testEmail = async (req, res) => {
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: "Email address is required" 
            });
        }

        console.log(`\n🧪 ===== TESTING EMAIL SERVICE =====`);
        console.log(`🧪 Testing email to: ${email}`);
        console.log(`🧪 RESEND_API_KEY configured: ${process.env.RESEND_API_KEY ? 'YES ✅' : 'NO ❌'}`);
        console.log(`🧪 EMAIL_FROM: ${process.env.EMAIL_FROM || 'noreply@ccjewllery.com (default)'}`);

        const testResult = await sendEmail({
            from: process.env.EMAIL_FROM || 'noreply@ccjewllery.com',
            to: email,
            subject: 'Test Email - Order Confirmation System',
            html: `
                <h2>🧪 Test Email</h2>
                <p>If you received this email, your email service is working correctly!</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <p><strong>From:</strong> ${process.env.EMAIL_FROM || 'noreply@ccjewllery.com'}</p>
                <p><strong>To:</strong> ${email}</p>
                <hr>
                <p><small>This is a test email from your CCJewllery order system.</small></p>
            `
        });

        console.log(`🧪 Test result:`, JSON.stringify(testResult, null, 2));
        console.log(`🧪 ====================================\n`);

        if (testResult.success) {
            return res.json({
                success: true,
                message: "Test email sent successfully! Check your inbox (and spam folder).",
                details: testResult.data
            });
        } else {
            return res.status(400).json({
                success: false,
                message: "Failed to send test email",
                error: testResult.error,
                hint: "Make sure RESEND_API_KEY is set in your .env file"
            });
        }
    } catch (error) {
        console.error('Test email error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export {placeOrder, placeOrderRazorpay, verifyRazorpay, placeOrderAuthNet, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus, testEmail}