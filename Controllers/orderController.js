import orderModel from '../Models/orderModel.js'
import Cart from '../Models/cartModel.js'
import productModel from '../Models/productModel.js'
import https from 'https'
import { sendEmail } from '../Config/email.js'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import pkg from 'authorizenet'
import Stripe from 'stripe'
const { APIContracts: ApiContracts, APIControllers: ApiControllers } = pkg

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

// Stripe configuration
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY

// Initialize Stripe instance (only if credentials are provided)
const stripeInstance = STRIPE_SECRET_KEY 
    ? new Stripe(STRIPE_SECRET_KEY, {
        apiVersion: '2024-12-18.acacia'
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

// Helper function to convert country name to ISO 3166-1 alpha-2 code
const getCountryCode = (countryName) => {
    if (!countryName) return 'US'; // Default to US if empty
    
    // Convert to lowercase for case-insensitive matching
    const country = countryName.trim().toLowerCase();
    
    // Common country name to ISO code mapping
    const countryMap = {
        'india': 'IN',
        'united states': 'US',
        'usa': 'US',
        'united states of america': 'US',
        'united kingdom': 'GB',
        'uk': 'GB',
        'canada': 'CA',
        'australia': 'AU',
        'germany': 'DE',
        'france': 'FR',
        'italy': 'IT',
        'spain': 'ES',
        'japan': 'JP',
        'china': 'CN',
        'brazil': 'BR',
        'mexico': 'MX',
        'russia': 'RU',
        'south korea': 'KR',
        'netherlands': 'NL',
        'belgium': 'BE',
        'switzerland': 'CH',
        'austria': 'AT',
        'sweden': 'SE',
        'norway': 'NO',
        'denmark': 'DK',
        'finland': 'FI',
        'poland': 'PL',
        'portugal': 'PT',
        'greece': 'GR',
        'turkey': 'TR',
        'saudi arabia': 'SA',
        'uae': 'AE',
        'united arab emirates': 'AE',
        'singapore': 'SG',
        'malaysia': 'MY',
        'thailand': 'TH',
        'indonesia': 'ID',
        'philippines': 'PH',
        'vietnam': 'VN',
        'south africa': 'ZA',
        'egypt': 'EG',
        'israel': 'IL',
        'new zealand': 'NZ',
        'argentina': 'AR',
        'chile': 'CL',
        'colombia': 'CO',
        'peru': 'PE',
        'bangladesh': 'BD',
        'pakistan': 'PK',
        'sri lanka': 'LK',
        'nepal': 'NP',
    };
    
    // Check if it's already a 2-character code
    if (country.length === 2 && /^[A-Za-z]{2}$/.test(country)) {
        return country.toUpperCase();
    }
    
    // Look up in map
    const code = countryMap[country];
    if (code) {
        return code;
    }
    
    // If not found, default to US for Stripe compatibility
    console.warn(`Country "${countryName}" not found in mapping, defaulting to US`);
    return 'US';
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

// Helper function to generate admin notification email HTML
const generateAdminOrderEmailHTML = async (order, items) => {
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
            .header { background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .order-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #2563eb; }
            .item { display: flex; padding: 15px 0; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .item-image { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px; }
            .item-details { flex: 1; }
            .item-name { font-weight: bold; margin-bottom: 5px; }
            .item-price { color: #2563eb; font-weight: bold; }
            .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; }
            .summary-total { border-top: 2px solid #2563eb; padding-top: 15px; font-size: 1.2em; font-weight: bold; }
            .alert { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 8px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📦 New Order Received</h1>
                <p>Order #${order.orderNumber}</p>
            </div>
            <div class="content">
                <div class="alert">
                    <strong>⚠️ Action Required:</strong> Process this order and update status in admin dashboard.
                </div>

                <div class="order-info">
                    <h2>Order Details</h2>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Order ID:</strong> ${order._id}</p>
                    <p><strong>Transaction ID:</strong> ${order.transactionId || 'N/A'}</p>
                    <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
                    <p><strong>Payment Status:</strong> ${order.paymentStatus === 'completed' ? '✅ Paid' : '⏳ Pending'}</p>
                    <p><strong>Order Status:</strong> ${order.status}</p>
                    <p><strong>Order Date:</strong> ${new Date(order.date).toLocaleString()}</p>
                    <p><strong>Total Amount:</strong> <strong style="color: #2563eb; font-size: 1.2em;">$${total.toLocaleString()}</strong></p>
                </div>

                <div class="order-info">
                    <h2>Customer Information</h2>
                    <p><strong>Name:</strong> ${order.firstName} ${order.lastName}</p>
                    <p><strong>Email:</strong> ${order.email}</p>
                    <p><strong>Phone:</strong> ${order.phone}</p>
                </div>

                <div class="order-info">
                    <h2>Shipping Address</h2>
                    <p>${order.firstName} ${order.lastName}</p>
                    <p>${order.street}</p>
                    <p>${order.city}, ${order.state} ${order.zipCode}</p>
                    <p>${order.country}</p>
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
            </div>
        </div>
    </body>
    </html>
    `;
}

// Authorize.Net configuration
const AUTHNET_LOGIN_ID = process.env.AUTHNET_LOGIN_ID
const AUTHNET_TRANSACTION_KEY = process.env.AUTHNET_TRANSACTION_KEY
const AUTHNET_MODE = process.env.AUTHNET_MODE || 'sandbox' // 'sandbox' or 'production'

// Helper function to process payment using Official Authorize.Net SDK
const processAuthorizeNetPayment = (paymentData) => {
    return new Promise((resolve, reject) => {
        console.log(`\n💳 ===== AUTHORIZE.NET PAYMENT (${AUTHNET_MODE.toUpperCase()} MODE) =====`);
        console.log(`💳 API Login ID: ${AUTHNET_LOGIN_ID ? AUTHNET_LOGIN_ID.substring(0, 5) + '...' : 'NOT SET'}`);
        console.log(`💳 Amount: $${paymentData.amount}`);
        console.log(`💳 Customer: ${paymentData.firstName} ${paymentData.lastName}`);
        
        // Check if credentials are configured
        if (!AUTHNET_LOGIN_ID || !AUTHNET_TRANSACTION_KEY) {
            console.error('❌ Authorize.Net credentials not configured!');
            return reject(new Error('Authorize.Net credentials not configured. Please set AUTHNET_LOGIN_ID and AUTHNET_TRANSACTION_KEY in environment variables.'));
        }

        // Set up merchant authentication
        const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
        merchantAuthenticationType.setName(AUTHNET_LOGIN_ID);
        merchantAuthenticationType.setTransactionKey(AUTHNET_TRANSACTION_KEY);

        // Set up credit card
        const creditCard = new ApiContracts.CreditCardType();
        creditCard.setCardNumber(paymentData.cardNumber.replace(/\s/g, ''));
        creditCard.setExpirationDate(paymentData.expirationDate); // Format: YYYY-MM
        creditCard.setCardCode(paymentData.cardCVV);

        // Set up payment type
        const paymentType = new ApiContracts.PaymentType();
        paymentType.setCreditCard(creditCard);

        // Set up billing address
        const billTo = new ApiContracts.CustomerAddressType();
        billTo.setFirstName(paymentData.firstName);
        billTo.setLastName(paymentData.lastName);
        billTo.setAddress(paymentData.street);
        billTo.setCity(paymentData.city);
        billTo.setState(paymentData.state);
        billTo.setZip(paymentData.zipCode);
        billTo.setCountry(paymentData.country);
        billTo.setPhoneNumber(paymentData.phone);
        billTo.setEmail(paymentData.email);

        // Set up order details
        const orderDetails = new ApiContracts.OrderType();
        orderDetails.setInvoiceNumber(paymentData.orderNumber);
        orderDetails.setDescription(`Order ${paymentData.orderNumber}`);

        // Set up transaction request
        const transactionRequestType = new ApiContracts.TransactionRequestType();
        transactionRequestType.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
        transactionRequestType.setPayment(paymentType);
        transactionRequestType.setAmount(paymentData.amount);
        transactionRequestType.setBillTo(billTo);
        transactionRequestType.setOrder(orderDetails);

        // Create the full request
        const createRequest = new ApiContracts.CreateTransactionRequest();
        createRequest.setMerchantAuthentication(merchantAuthenticationType);
        createRequest.setTransactionRequest(transactionRequestType);

        // Create controller and set environment
        const controller = new ApiControllers.CreateTransactionController(createRequest.getJSON());
        
        // Set environment based on mode
        // Using direct URLs since SDK constants may not be available in ES modules
        const PRODUCTION_ENDPOINT = 'https://api.authorize.net/xml/v1/request.api';
        const SANDBOX_ENDPOINT = 'https://apitest.authorize.net/xml/v1/request.api';
        
        if (AUTHNET_MODE === 'production') {
            controller.setEnvironment(PRODUCTION_ENDPOINT);
            console.log('💳 Environment: PRODUCTION (api.authorize.net)');
        } else {
            controller.setEnvironment(SANDBOX_ENDPOINT);
            console.log('💳 Environment: SANDBOX (apitest.authorize.net)');
        }

        console.log('💳 Sending payment request...');

        // Execute the request
        controller.execute(() => {
            const apiResponse = controller.getResponse();
            const response = new ApiContracts.CreateTransactionResponse(apiResponse);

            console.log('💳 Response received');

            if (response !== null) {
                if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
                    const transactionResponse = response.getTransactionResponse();
                    
                    if (transactionResponse !== null) {
                        const responseCode = transactionResponse.getResponseCode();
                        
                        if (responseCode === '1') {
                            // Transaction approved
                            const transId = transactionResponse.getTransId();
                            const authCode = transactionResponse.getAuthCode();
                            
                            console.log(`✅ Transaction APPROVED!`);
                            console.log(`   Transaction ID: ${transId}`);
                            console.log(`   Auth Code: ${authCode}`);
                            console.log(`💳 ============================================\n`);
                            
                            resolve({
                                success: true,
                                transactionResponse: {
                                    responseCode: responseCode,
                                    transId: transId,
                                    authCode: authCode,
                                    responseReason: 'This transaction has been approved.'
                                }
                            });
                        } else if (responseCode === '2') {
                            // Transaction declined
                            const errors = transactionResponse.getErrors();
                            const errorText = errors ? errors.getError()[0].getErrorText() : 'Transaction declined';
                            
                            console.log(`❌ Transaction DECLINED: ${errorText}`);
                            console.log(`💳 ============================================\n`);
                            
                            resolve({
                                success: false,
                                transactionResponse: {
                                    responseCode: responseCode,
                                    transId: null,
                                    responseReason: errorText,
                                    errors: { error: [{ errorText: errorText }] }
                                }
                            });
                        } else {
                            // Other response code (held, error, etc.)
                            const errors = transactionResponse.getErrors();
                            const errorText = errors ? errors.getError()[0].getErrorText() : 'Transaction error';
                            
                            console.log(`⚠️ Transaction response code: ${responseCode}`);
                            console.log(`   Message: ${errorText}`);
                            console.log(`💳 ============================================\n`);
                            
                            resolve({
                                success: false,
                                transactionResponse: {
                                    responseCode: responseCode,
                                    transId: null,
                                    responseReason: errorText
                                }
                            });
                        }
                    } else {
                        console.log(`❌ No transaction response returned`);
                        reject(new Error('No transaction response from Authorize.Net'));
                    }
                } else {
                    // API error
                    const errors = response.getMessages().getMessage();
                    const errorCode = errors[0].getCode();
                    const errorText = errors[0].getText();
                    
                    console.log(`❌ API Error: ${errorCode} - ${errorText}`);
                    console.log(`💳 ============================================\n`);
                    
                    // Check for specific errors
                    if (errorCode === 'E00007') {
                        reject(new Error(`Invalid Authorize.Net credentials. Please check your AUTHNET_LOGIN_ID and AUTHNET_TRANSACTION_KEY.`));
                    } else {
                        reject(new Error(`Authorize.Net API Error: ${errorCode} - ${errorText}`));
                    }
                }
            } else {
                console.log(`❌ Null response from Authorize.Net`);
                reject(new Error('Null response from Authorize.Net. Please check your network connection and credentials.'));
            }
        });
    });
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
            currency: "USD", // Change to "USD" if needed
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
                status: "Processing",
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

            // Send order confirmation emails (customer + admin)
            try {
                console.log(`\n📧 ===== EMAIL SENDING PROCESS START =====`);
                console.log(`📧 Preparing to send order confirmation emails for Order #${order.orderNumber}...`);
                
                // Get cart for email
                const cart = await Cart.findById(order.cartId);
                const customerEmailHTML = await generateOrderEmailHTML(updatedOrder, cart?.items || order.items);
                const adminEmailHTML = await generateAdminOrderEmailHTML(updatedOrder, cart?.items || order.items);
                
                const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
                
                // Send email to customer
                const customerEmailResult = await sendEmail({
                    from: emailFrom,
                    to: order.email,
                    subject: `Order Confirmation - ${order.orderNumber} (Payment Successful)`,
                    html: customerEmailHTML
                });

                if (customerEmailResult.success) {
                    console.log(`✅ Order confirmation email sent successfully to customer: ${order.email}`);
                } else {
                    console.warn(`⚠️ Failed to send email to customer:`, customerEmailResult.error);
                }

                // Send email to admin
                if (process.env.ADMIN_EMAIL) {
                    const adminEmailResult = await sendEmail({
                        from: emailFrom,
                        to: process.env.ADMIN_EMAIL,
                        subject: `New Order #${order.orderNumber} - ${order.firstName} ${order.lastName} - $${order.amount.toLocaleString()}`,
                        html: adminEmailHTML
                    });

                    if (adminEmailResult.success) {
                        console.log(`✅ Order notification email sent successfully to admin: ${process.env.ADMIN_EMAIL}`);
                    } else {
                        console.warn(`⚠️ Failed to send email to admin:`, adminEmailResult.error);
                    }
                } else {
                    console.warn(`⚠️ ADMIN_EMAIL not configured. Admin notification email skipped.`);
                }
            } catch (emailError) {
                console.error('❌ Failed to send order confirmation emails:', emailError.message);
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
                status: "Order Placed",
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

        // Process payment using Official Authorize.Net SDK
        const paymentData = {
            cardNumber: cardNumber,
            expirationDate: `20${expYear}-${expMonth}`, // Format: YYYY-MM
            cardCVV: cardCVV,
            amount: finalAmount.toFixed(2),
            firstName,
            lastName,
            email,
            street,
            city,
            state,
            zipCode,
            country,
            phone,
            orderNumber
        };

        const response = await processAuthorizeNetPayment(paymentData);
        
        // Check if transaction was successful
        if(response?.success && response?.transactionResponse?.responseCode === "1") {
            // Success - Payment approved
            const transactionId = response.transactionResponse.transId;
            const responseCode = response.transactionResponse.responseCode;
            const responseMessage = response.transactionResponse.responseReason || "Payment approved";
            
            await orderModel.findByIdAndUpdate(newOrder._id, {
                payment: true,
                transactionId: transactionId,
                status: "Processing",
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

            // Send order confirmation emails (customer + admin)
            try {
                console.log(`\n📧 ===== EMAIL SENDING PROCESS START =====`);
                console.log(`📧 Preparing to send order confirmation emails for Order #${orderNumber}...`);
                console.log(`📧 Customer Email: ${email}`);
                console.log(`📧 Checking email configuration...`);
                
                const customerEmailHTML = await generateOrderEmailHTML(updatedOrder, cart.items);
                const adminEmailHTML = await generateAdminOrderEmailHTML(updatedOrder, cart.items);
                console.log(`📧 Email HTML generated`);
                
                const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
                console.log(`📧 Email From: ${emailFrom}`);
                
                // Send email to customer
                const customerEmailResult = await sendEmail({
                    from: emailFrom,
                    to: email,
                    subject: `Order Confirmation - ${orderNumber} (Payment Successful)`,
                    html: customerEmailHTML
                });
                
                console.log(`📧 Customer email send result:`, JSON.stringify(customerEmailResult, null, 2));
                
                if (customerEmailResult.success) {
                    console.log(`\n✅ ===== CUSTOMER EMAIL SENT SUCCESSFULLY =====`);
                    console.log(`✅ Order confirmation email sent successfully to customer!`);
                    console.log(`   📬 To: ${email}`);
                    console.log(`   📋 Order Number: ${orderNumber}`);
                    console.log(`   💳 Transaction ID: ${transactionId}`);
                    console.log(`   💰 Amount: $${finalAmount.toLocaleString()}`);
                    console.log(`   ✅ Payment Status: Paid`);
                    console.log(`✅ ===========================================\n`);
                } else {
                    console.log(`\n⚠️  ===== CUSTOMER EMAIL SENDING FAILED =====`);
                    console.warn(`⚠️  Email service not configured or failed`);
                    console.warn(`   Error:`, customerEmailResult.error);
                    console.warn(`⚠️  =========================================\n`);
                }

                // Send email to admin
                if (process.env.ADMIN_EMAIL) {
                    const adminEmailResult = await sendEmail({
                        from: emailFrom,
                        to: process.env.ADMIN_EMAIL,
                        subject: `New Order #${orderNumber} - ${firstName} ${lastName} - $${finalAmount.toLocaleString()}`,
                        html: adminEmailHTML
                    });

                    if (adminEmailResult.success) {
                        console.log(`\n✅ ===== ADMIN EMAIL SENT SUCCESSFULLY =====`);
                        console.log(`✅ Order notification email sent successfully to admin!`);
                        console.log(`   📬 To: ${process.env.ADMIN_EMAIL}`);
                        console.log(`   📋 Order Number: ${orderNumber}`);
                        console.log(`   👤 Customer: ${firstName} ${lastName}`);
                        console.log(`   💰 Amount: $${finalAmount.toLocaleString()}`);
                        console.log(`✅ =========================================\n`);
                    } else {
                        console.log(`\n⚠️  ===== ADMIN EMAIL SENDING FAILED =====`);
                        console.warn(`⚠️  Failed to send email to admin:`, adminEmailResult.error);
                        console.warn(`⚠️  ======================================\n`);
                    }
                } else {
                    console.warn(`\n⚠️  ADMIN_EMAIL not configured. Admin notification email skipped.`);
                    console.warn(`   Add ADMIN_EMAIL to your .env file to receive admin notifications.`);
                }
            } catch (emailError) {
                console.error(`\n❌ ===== EMAIL SENDING ERROR =====`);
                console.error('❌ Failed to send order confirmation emails:', emailError.message);
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
                status: "Order Placed",
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

// Placing orders using Stripe
const placeOrderStripe = async (req, res) => {
    try {
        // Check if Stripe is configured
        if (!stripeInstance) {
            return res.status(500).json({
                success: false,
                message: "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
            })
        }

        const { cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone, addressFromWallet } = req.body;

        // Validate required fields (for Stripe: only cartId and email required; address optional when using Apple Pay/Google Pay)
        const missingFields = [];
        if (!cartId) missingFields.push('cartId');
        if (!email) missingFields.push('email');

        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}. Amount is optional and will be calculated from cart.`
            })
        }

        // Use provided values or placeholders when address will come from wallet (Apple Pay / Google Pay)
        const orderFirstName = (firstName && firstName.trim()) ? firstName.trim() : 'Customer';
        const orderLastName = (lastName && lastName.trim()) ? lastName.trim() : '';
        const orderStreet = (street && street.trim()) ? street.trim() : '';
        const orderCity = (city && city.trim()) ? city.trim() : '';
        const orderState = (state && state.trim()) ? state.trim() : '';
        const orderZipCode = (zipCode && zipCode.toString().trim()) ? zipCode.toString().trim() : '';
        const orderCountry = (country && country.trim()) ? country.trim() : 'US';
        const orderPhone = (phone && phone.trim()) ? phone.trim() : '';

        // Validate cartId is a valid MongoDB ObjectId
        const mongoose = (await import('mongoose')).default;
        if (!mongoose.Types.ObjectId.isValid(cartId)) {
            return res.status(400).json({
                success: false,
                message: `Invalid cartId format. Expected a 24-character MongoDB ObjectId.`
            })
        }

        // Get cart and validate
        const cart = await Cart.findById(cartId);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' })
        if (!cart.items || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' })
        }

        // Calculate amount if not provided
        let finalAmount = amount ? Number(amount) : 0;
        if (!amount) {
            for (const it of cart.items) {
                try {
                    const prod = await productModel.findById(it.productId);
                    const price = prod && prod.price ? Number(prod.price) : 0;
                    finalAmount += price * (Number(it.quantity) || 1);
                } catch (e) {
                    // ignore missing product price
                }
            }
            finalAmount += deliveryCharge;
        }

        // Convert to cents for Stripe (Stripe uses smallest currency unit)
        const amountInCents = Math.round(finalAmount * 100);

        // Generate unique order number
        const orderNumber = generateOrderNumber();

        // Convert country name to ISO code
        const countryCode = getCountryCode(orderCountry);

        // Determine currency based on country (USD for US, GBP for UK, USD as default)
        const currency = countryCode === 'GB' ? 'gbp' : (countryCode === 'US' ? 'usd' : 'usd');

        // Create order FIRST (pending state) - address may be updated from wallet in confirmStripePayment
        const orderData = {
            cartId,
            items: cart.items,
            amount: finalAmount,
            firstName: orderFirstName,
            lastName: orderLastName,
            email,
            street: orderStreet,
            city: orderCity,
            state: orderState,
            zipCode: orderZipCode,
            country: orderCountry,
            phone: orderPhone,
            paymentMethod: "Stripe",
            payment: false,
            transactionId: null,
            orderNumber: orderNumber,
            paymentStatus: 'pending'
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Build Payment Intent params - only include shipping when we have address (otherwise Apple Pay/Google Pay will provide it)
        const piParams = {
            amount: amountInCents,
            currency: currency,
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'always'
            },
            description: `Order ${orderNumber} - ${orderFirstName} ${orderLastName}`,
            receipt_email: email,
            metadata: {
                orderNumber: orderNumber,
                orderId: newOrder._id.toString(),
                cartId: cartId
            }
        };
        // Include shipping only when address was provided (so Stripe can collect from wallet if not)
        if (orderStreet && orderCity && orderZipCode && orderCountry) {
            piParams.shipping = {
                name: `${orderFirstName} ${orderLastName}`.trim(),
                phone: orderPhone || undefined,
                address: {
                    line1: orderStreet,
                    city: orderCity,
                    state: orderState,
                    postal_code: orderZipCode,
                    country: countryCode
                }
            };
        }

        const paymentIntent = await stripeInstance.paymentIntents.create(piParams);

        // Update order with Payment Intent ID
        await orderModel.findByIdAndUpdate(newOrder._id, {
            paymentDetails: {
                gateway: 'STRIPE',
                paymentIntentId: paymentIntent.id,
                status: paymentIntent.status,
                createdAt: new Date()
            }
        });

        console.log(`\n💳 ===== STRIPE PAYMENT INTENT CREATED =====`);
        console.log(`💳 Order Number: ${orderNumber}`);
        console.log(`💳 Payment Intent ID: ${paymentIntent.id}`);
        console.log(`💳 Amount: $${finalAmount} (${amountInCents} cents)`);
        console.log(`💳 Customer: ${orderFirstName} ${orderLastName} (${email})`);
        console.log(`💳 ===========================================\n`);

        return res.json({
            success: true,
            message: "Payment Intent created successfully",
            order: newOrder,
            orderNumber: orderNumber,
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
        })

    } catch (error) {
        console.error('❌ Stripe Payment Intent creation error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to create Stripe Payment Intent"
        })
    }
}

// Confirm Stripe payment after frontend confirmation
const confirmStripePayment = async (req, res) => {
    try {
        // Check if Stripe is configured
        if (!stripeInstance) {
            return res.status(500).json({
                success: false,
                message: "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
            })
        }

        const { paymentIntentId, orderId, shippingFromWallet } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: "paymentIntentId is required"
            })
        }

        // Retrieve Payment Intent from Stripe
        const paymentIntent = await stripeInstance.paymentIntents.retrieve(paymentIntentId);

        console.log(`\n🔍 ===== FINDING ORDER FOR PAYMENT INTENT =====`);
        console.log(`🔍 Payment Intent ID: ${paymentIntentId}`);
        console.log(`🔍 Order ID from request: ${orderId || 'not provided'}`);
        console.log(`🔍 Payment Intent metadata:`, paymentIntent.metadata);

        // Find order by multiple methods (in order of preference)
        let order = null;

        // Method 1: Use orderId from request if provided
        if (orderId) {
            console.log(`🔍 Method 1: Looking up by orderId: ${orderId}`);
            order = await orderModel.findById(orderId);
            if (order) {
                console.log(`✅ Order found by orderId: ${order.orderNumber}`);
            }
        }

        // Method 2: Use orderId from Payment Intent metadata
        if (!order && paymentIntent.metadata && paymentIntent.metadata.orderId) {
            const metadataOrderId = paymentIntent.metadata.orderId;
            console.log(`🔍 Method 2: Looking up by orderId from metadata: ${metadataOrderId}`);
            order = await orderModel.findById(metadataOrderId);
            if (order) {
                console.log(`✅ Order found by metadata orderId: ${order.orderNumber}`);
            }
        }

        // Method 3: Use orderNumber from Payment Intent metadata
        if (!order && paymentIntent.metadata && paymentIntent.metadata.orderNumber) {
            const orderNumber = paymentIntent.metadata.orderNumber;
            console.log(`🔍 Method 3: Looking up by orderNumber from metadata: ${orderNumber}`);
            order = await orderModel.findOne({ orderNumber: orderNumber });
            if (order) {
                console.log(`✅ Order found by metadata orderNumber: ${order.orderNumber}`);
            }
        }

        // Method 4: Search by paymentDetails.paymentIntentId (nested field)
        if (!order) {
            console.log(`🔍 Method 4: Looking up by paymentDetails.paymentIntentId`);
            order = await orderModel.findOne({
                'paymentDetails.paymentIntentId': paymentIntentId
            });
            if (order) {
                console.log(`✅ Order found by paymentDetails.paymentIntentId: ${order.orderNumber}`);
            }
        }

        // Method 5: Search by paymentIntentId anywhere in paymentDetails (flexible)
        if (!order) {
            console.log(`🔍 Method 5: Searching all orders with paymentMethod='Stripe' and matching metadata`);
            // Get all recent Stripe orders and check their paymentDetails
            const stripeOrders = await orderModel.find({
                paymentMethod: 'Stripe',
                paymentStatus: 'pending'
            }).sort({ date: -1 }).limit(10);
            
            for (const o of stripeOrders) {
                if (o.paymentDetails && o.paymentDetails.paymentIntentId === paymentIntentId) {
                    order = o;
                    console.log(`✅ Order found by scanning recent orders: ${order.orderNumber}`);
                    break;
                }
            }
        }

        if (!order) {
            console.error(`❌ Order not found after trying all methods`);
            console.error(`❌ Payment Intent ID: ${paymentIntentId}`);
            console.error(`❌ Payment Intent metadata:`, JSON.stringify(paymentIntent.metadata, null, 2));
            return res.status(404).json({
                success: false,
                message: "Order not found. Please contact support with Payment Intent ID: " + paymentIntentId
            })
        }

        console.log(`✅ ===== ORDER FOUND =====`);
        console.log(`✅ Order ID: ${order._id}`);
        console.log(`✅ Order Number: ${order.orderNumber}`);
        console.log(`✅ ======================\n`);

        // Check payment intent status
        if (paymentIntent.status === 'succeeded') {
            // Payment successful
            const transactionId = paymentIntent.id;

            // Build address from wallet (Apple Pay / Google Pay) if provided
            let updatePayload = {
                payment: true,
                transactionId: transactionId,
                status: "Processing",
                paymentStatus: 'completed',
                paymentDate: new Date(),
                paymentDetails: {
                    gateway: 'STRIPE',
                    paymentIntentId: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount / 100, // Convert from cents
                    currency: paymentIntent.currency,
                    processedAt: new Date()
                }
            };

            // Use address from request (frontend sends from Payment Intent after Apple Pay/Google Pay)
            if (shippingFromWallet && typeof shippingFromWallet === 'object') {
                const addr = shippingFromWallet.address || shippingFromWallet;
                const name = shippingFromWallet.name || (order.firstName + ' ' + order.lastName) || 'Customer';
                const parts = (name || '').trim().split(/\s+/);
                const firstName = parts[0] || 'Customer';
                const lastName = parts.slice(1).join(' ') || '';
                updatePayload = {
                    ...updatePayload,
                    firstName,
                    lastName,
                    street: addr.line1 || addr.line_1 || '',
                    city: addr.city || '',
                    state: addr.state || '',
                    zipCode: (addr.postal_code || '').toString(),
                    country: addr.country || order.country || 'US',
                    phone: shippingFromWallet.phone || order.phone || ''
                };
                console.log('✅ Order address updated from wallet (Apple Pay/Google Pay)');
            } else if (paymentIntent.shipping && paymentIntent.shipping.address) {
                // Fallback: use address from Payment Intent (Stripe may have collected from Apple Pay)
                const addr = paymentIntent.shipping.address;
                const name = paymentIntent.shipping.name || 'Customer';
                const parts = (name || '').trim().split(/\s+/);
                const firstName = parts[0] || 'Customer';
                const lastName = parts.slice(1).join(' ') || '';
                updatePayload = {
                    ...updatePayload,
                    firstName,
                    lastName,
                    street: addr.line1 || '',
                    city: addr.city || '',
                    state: addr.state || '',
                    zipCode: (addr.postal_code || '').toString(),
                    country: addr.country || 'US',
                    phone: paymentIntent.shipping.phone || order.phone || ''
                };
                console.log('✅ Order address updated from Payment Intent (wallet)');
            }

            await orderModel.findByIdAndUpdate(order._id, updatePayload);

            // Update cart status
            await Cart.findByIdAndUpdate(order.cartId, { status: 'completed' });

            // Fetch updated order
            const updatedOrder = await orderModel.findById(order._id);

            // Get cart for email
            const cart = await Cart.findById(order.cartId);

            // Send order confirmation emails
            try {
                const customerEmailHTML = await generateOrderEmailHTML(updatedOrder, cart?.items || []);
                const adminEmailHTML = await generateAdminOrderEmailHTML(updatedOrder, cart?.items || []);
                const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';

                // Send email to customer
                const customerEmailResult = await sendEmail({
                    from: emailFrom,
                    to: order.email,
                    subject: `Order Confirmation - ${order.orderNumber} (Payment Successful)`,
                    html: customerEmailHTML
                });

                if (customerEmailResult.success) {
                    console.log(`✅ Order confirmation email sent to customer: ${order.email}`);
                }

                // Send email to admin
                if (process.env.ADMIN_EMAIL) {
                    const adminEmailResult = await sendEmail({
                        from: emailFrom,
                        to: process.env.ADMIN_EMAIL,
                        subject: `New Order #${order.orderNumber} - ${order.firstName} ${order.lastName} - $${order.amount.toLocaleString()}`,
                        html: adminEmailHTML
                    });

                    if (adminEmailResult.success) {
                        console.log(`✅ Order notification email sent to admin: ${process.env.ADMIN_EMAIL}`);
                    }
                }
            } catch (emailError) {
                console.error('❌ Failed to send order confirmation emails:', emailError.message);
                // Don't fail the order if email fails
            }

            console.log(`\n✅ ===== STRIPE PAYMENT CONFIRMED =====`);
            console.log(`✅ Order Number: ${order.orderNumber}`);
            console.log(`✅ Payment Intent ID: ${paymentIntentId}`);
            console.log(`✅ Amount: $${(paymentIntent.amount / 100).toLocaleString()}`);
            console.log(`✅ Customer: ${order.firstName} ${order.lastName}`);
            console.log(`✅ =====================================\n`);

            return res.json({
                success: true,
                message: "Payment confirmed successfully",
                order: updatedOrder,
                orderNumber: order.orderNumber,
                transactionId: transactionId
            })

        } else if (paymentIntent.status === 'requires_payment_method') {
            // Payment failed or requires payment method
            await orderModel.findByIdAndUpdate(order._id, {
                paymentStatus: 'failed',
                paymentDetails: {
                    gateway: 'STRIPE',
                    paymentIntentId: paymentIntent.id,
                    status: paymentIntent.status,
                    error: paymentIntent.last_payment_error?.message || 'Payment failed'
                }
            });

            return res.status(400).json({
                success: false,
                message: paymentIntent.last_payment_error?.message || "Payment failed. Please try again.",
                order: order
            })

        } else {
            // Payment is still processing or in another state
            return res.json({
                success: false,
                message: `Payment status: ${paymentIntent.status}`,
                order: order,
                paymentStatus: paymentIntent.status
            })
        }

    } catch (error) {
        console.error('❌ Stripe payment confirmation error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to confirm Stripe payment"
        })
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
// Helper function to generate status update email HTML
const generateStatusUpdateEmailHTML = async (order, newStatus, oldStatus) => {
    // Get product details for items
    const itemDetails = await Promise.all(
        order.items.map(async (item) => {
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

    // Status-specific messages
    const statusMessages = {
        'Order Placed': 'Your order has been placed and is being prepared.',
        'Processing': 'Your order is now being processed. We\'re preparing your items for shipment.',
        'Shipped': 'Great news! Your order has been shipped and is on its way to you.',
        'Delivered': 'Your order has been delivered! We hope you love your purchase.'
    };

    const statusEmoji = {
        'Order Placed': '📦',
        'Processing': '⚙️',
        'Shipped': '🚚',
        'Delivered': '✅'
    };

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #d4af37 0%, #b8941f 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .status-box { background: white; padding: 25px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #d4af37; text-align: center; }
            .status-box h2 { margin: 0 0 10px 0; font-size: 24px; }
            .status-message { color: #666; font-size: 16px; margin-top: 10px; }
            .order-info { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #d4af37; }
            .item { display: flex; padding: 15px 0; border-bottom: 1px solid #eee; }
            .item:last-child { border-bottom: none; }
            .item-image { width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-right: 15px; }
            .item-details { flex: 1; }
            .item-name { font-weight: bold; margin-bottom: 5px; }
            .item-price { color: #d4af37; font-weight: bold; }
            .summary { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; }
            .summary-row { display: flex; justify-content: space-between; padding: 10px 0; }
            .summary-total { border-top: 2px solid #d4af37; padding-top: 15px; font-size: 1.2em; font-weight: bold; }
            .footer { text-align: center; color: #666; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${statusEmoji[newStatus] || '📦'} Order Status Update</h1>
                <p>Order #${order.orderNumber}</p>
            </div>
            <div class="content">
                <div class="status-box">
                    <h2>${newStatus}</h2>
                    <p class="status-message">${statusMessages[newStatus] || 'Your order status has been updated.'}</p>
                </div>

                <div class="order-info">
                    <h3>Order Details</h3>
                    <p><strong>Order Number:</strong> ${order.orderNumber}</p>
                    <p><strong>Status:</strong> <strong style="color: #d4af37;">${newStatus}</strong></p>
                    ${oldStatus ? `<p><strong>Previous Status:</strong> ${oldStatus}</p>` : ''}
                    <p><strong>Order Date:</strong> ${new Date(order.date).toLocaleString()}</p>
                    <p><strong>Total Amount:</strong> <strong style="color: #d4af37; font-size: 1.2em;">$${total.toLocaleString()}</strong></p>
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
                    <p>If you have any questions about your order, please contact our support team.</p>
                    <p>Thank you for shopping with us!</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

const updateStatus = async(req,res) => {
    try {
        const{orderId,status} = req.body;
        
        if(!orderId || !status) {
            return res.status(400).json({success: false, message: 'Order ID and status are required'});
        }

        // Validate status enum
        const validStatuses = ['Order Placed', 'Processing', 'Shipped', 'Delivered'];
        if(!validStatuses.includes(status)) {
            return res.status(400).json({success: false, message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`});
        }

        // Fetch order to get old status and customer details
        const order = await orderModel.findById(orderId);
        if(!order) {
            return res.status(404).json({success: false, message: 'Order not found'});
        }

        const oldStatus = order.status;

        // Update order status
        await orderModel.findByIdAndUpdate(orderId, {status});

        // Send email to customer
        try {
            console.log(`\n📧 ===== ORDER STATUS UPDATE EMAIL =====`);
            console.log(`📧 Order: ${order.orderNumber}`);
            console.log(`📧 Status changed from "${oldStatus}" to "${status}"`);
            console.log(`📧 Sending email to: ${order.email}`);

            const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
            const emailHTML = await generateStatusUpdateEmailHTML(order, status, oldStatus);

            const emailResult = await sendEmail({
                from: emailFrom,
                to: order.email,
                subject: `Order Status Update - ${order.orderNumber} - ${status}`,
                html: emailHTML
            });

            if (emailResult.success) {
                console.log(`✅ Status update email sent successfully!`);
                console.log(`   📬 To: ${order.email}`);
                console.log(`   📋 Order Number: ${order.orderNumber}`);
                console.log(`   📊 Status: ${status}`);
                console.log(`📧 ======================================\n`);
            } else {
                console.log(`\n⚠️  ===== EMAIL SENDING FAILED =====`);
                console.warn(`⚠️  Email service not configured or failed`);
                console.warn(`   Error:`, emailResult.error);
                console.warn(`⚠️  ====================================\n`);
            }
        } catch (emailError) {
            console.error(`\n❌ ===== EMAIL SENDING ERROR =====`);
            console.error('❌ Failed to send status update email:', emailError.message);
            console.error(`❌ ===================================\n`);
            // Don't fail the request if email fails
        }

        return res.json({
            success: true,
            message: 'Status Updated',
            order: {
                _id: order._id,
                orderNumber: order.orderNumber,
                status: status,
                oldStatus: oldStatus
            }
        });
    } 
    catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: error.message});
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

// Test payment flow - simulates successful payment and sends both emails
const testPayment = async (req, res) => {
    try {
        const { 
            customerEmail, 
            firstName = 'John', 
            lastName = 'Doe',
            amount = 299.99
        } = req.body;
        
        if (!customerEmail) {
            return res.status(400).json({
                success: false,
                message: "customerEmail is required"
            });
        }

        console.log(`\n🧪 ===== TEST PAYMENT FLOW =====`);
        console.log(`🧪 Customer Email: ${customerEmail}`);
        console.log(`🧪 Amount: $${amount}`);
        console.log(`🧪 This is a TEST payment - no real payment will be processed`);

        // Generate test order number
        const orderNumber = generateOrderNumber();
        const transactionId = 'TEST-TXN-' + Date.now();

        // Create mock order data (simulating successful payment)
        const mockOrder = {
            _id: 'test_order_' + Date.now(),
            orderNumber: orderNumber,
            transactionId: transactionId,
            paymentMethod: 'Test Payment',
            paymentStatus: 'completed',
            status: 'Paid',
            date: new Date(),
            paymentDate: new Date(),
            amount: Number(amount),
            firstName: firstName,
            lastName: lastName,
            email: customerEmail,
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'United States',
            phone: '+1-555-0123',
            paymentDetails: {
                gateway: 'TEST',
                transactionId: transactionId,
                responseCode: '1',
                responseMessage: 'Test payment successful',
                processedAt: new Date()
            }
        };

        // Create mock cart items for email
        const mockItems = [
            {
                productId: 'test_product_1',
                quantity: 2
            },
            {
                productId: 'test_product_2',
                quantity: 1
            }
        ];

        // Save test order to database (optional - you can skip this if you don't want test orders in DB)
        // const newOrder = new orderModel(mockOrder);
        // await newOrder.save();

        const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
        const adminEmail = process.env.ADMIN_EMAIL;
        const results = {
            customer: null,
            admin: null,
            order: mockOrder
        };

        // Send customer confirmation email
        console.log(`\n📧 [1/2] Sending Customer Email...`);
        try {
            const customerEmailHTML = await generateOrderEmailHTML(mockOrder, mockItems);
            const customerResult = await sendEmail({
                from: emailFrom,
                to: customerEmail,
                subject: `[TEST] Order Confirmation - ${orderNumber} (Payment Successful)`,
                html: customerEmailHTML
            });

            results.customer = {
                success: customerResult.success,
                email: customerEmail,
                error: customerResult.error || null,
                message: customerResult.success 
                    ? '✅ Customer email sent successfully!' 
                    : `❌ Failed: ${customerResult.error}`
            };

            if (customerResult.success) {
                console.log(`✅ Customer email sent to: ${customerEmail}`);
            } else {
                console.log(`❌ Customer email failed: ${customerResult.error}`);
            }
        } catch (error) {
            results.customer = {
                success: false,
                email: customerEmail,
                error: error.message,
                message: `❌ Error: ${error.message}`
            };
            console.error(`❌ Customer email error:`, error.message);
        }

        // Send admin notification email
        if (adminEmail) {
            console.log(`\n📧 [2/2] Sending Admin Email...`);
            try {
                const adminEmailHTML = await generateAdminOrderEmailHTML(mockOrder, mockItems);
                const adminResult = await sendEmail({
                    from: emailFrom,
                    to: adminEmail,
                    subject: `[TEST] New Order #${orderNumber} - ${firstName} ${lastName} - $${Number(amount).toLocaleString()}`,
                    html: adminEmailHTML
                });

                results.admin = {
                    success: adminResult.success,
                    email: adminEmail,
                    error: adminResult.error || null,
                    message: adminResult.success 
                        ? '✅ Admin email sent successfully!' 
                        : `❌ Failed: ${adminResult.error}`
                };

                if (adminResult.success) {
                    console.log(`✅ Admin email sent to: ${adminEmail}`);
                } else {
                    console.log(`❌ Admin email failed: ${adminResult.error}`);
                }
            } catch (error) {
                results.admin = {
                    success: false,
                    email: adminEmail,
                    error: error.message,
                    message: `❌ Error: ${error.message}`
                };
                console.error(`❌ Admin email error:`, error.message);
            }
        } else {
            results.admin = {
                success: false,
                email: null,
                error: 'ADMIN_EMAIL not configured',
                message: '⚠️ ADMIN_EMAIL not set in .env file. Admin email skipped.'
            };
            console.warn(`⚠️ ADMIN_EMAIL not configured. Skipping admin email.`);
        }

        console.log(`\n🧪 ===== TEST PAYMENT RESULTS =====`);
        console.log(`🧪 Order Number: ${orderNumber}`);
        console.log(`🧪 Transaction ID: ${transactionId}`);
        console.log(`🧪 Customer Email: ${results.customer.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`🧪 Admin Email: ${results.admin.email ? (results.admin.success ? '✅ SUCCESS' : '❌ FAILED') : '⚠️ NOT CONFIGURED'}`);
        console.log(`🧪 ====================================\n`);

        const overallSuccess = results.customer.success && (results.admin.email ? results.admin.success : true);

        return res.json({
            success: overallSuccess,
            message: overallSuccess 
                ? '✅ Test payment completed! Both emails sent successfully.' 
                : '⚠️ Test payment completed but some emails failed. Check details below.',
            testPayment: true,
            order: {
                orderNumber: orderNumber,
                transactionId: transactionId,
                amount: Number(amount),
                paymentStatus: 'completed',
                paymentMethod: 'Test Payment'
            },
            emailResults: {
                customer: results.customer,
                admin: results.admin
            },
            configuration: {
                resendApiKey: !!process.env.RESEND_API_KEY,
                emailFrom: emailFrom,
                adminEmail: adminEmail || 'NOT CONFIGURED'
            }
        });

    } catch (error) {
        console.error('❌ Test payment error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

// Test both customer and admin emails with actual order templates
const testOrderEmails = async (req, res) => {
    try {
        const { customerEmail } = req.body;
        
        // Use provided email or default test email
        const testCustomerEmail = customerEmail || 'test@example.com';
        const adminEmail = process.env.ADMIN_EMAIL;

        console.log(`\n🧪 ===== TESTING ORDER EMAILS (CUSTOMER + ADMIN) =====`);
        console.log(`🧪 Customer Email: ${testCustomerEmail}`);
        console.log(`🧪 Admin Email: ${adminEmail || 'NOT CONFIGURED ❌'}`);
        console.log(`🧪 RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'CONFIGURED ✅' : 'NOT CONFIGURED ❌'}`);
        console.log(`🧪 EMAIL_FROM: ${process.env.EMAIL_FROM || 'noreply@ccjewllery.com (default)'}`);

        // Create mock order data for testing
        const mockOrder = {
            _id: 'test_order_id_123',
            orderNumber: 'TEST-ORD-' + Date.now().toString(36).toUpperCase(),
            transactionId: 'TEST-TXN-' + Date.now(),
            paymentMethod: 'Test Payment',
            paymentStatus: 'completed',
            status: 'Paid',
            date: new Date(),
            amount: 299.99,
            firstName: 'John',
            lastName: 'Doe',
            email: testCustomerEmail,
            street: '123 Test Street',
            city: 'Test City',
            state: 'TS',
            zipCode: '12345',
            country: 'United States',
            phone: '+1-555-0123'
        };

        // Create mock items for email
        const mockItems = [
            {
                productId: 'test_product_1',
                quantity: 2
            },
            {
                productId: 'test_product_2',
                quantity: 1
            }
        ];

        const emailFrom = process.env.EMAIL_FROM || 'noreply@ccjewllery.com';
        const results = {
            customer: null,
            admin: null
        };

        // Test 1: Send customer email
        console.log(`\n📧 [1/2] Testing Customer Email...`);
        try {
            const customerEmailHTML = await generateOrderEmailHTML(mockOrder, mockItems);
            const customerResult = await sendEmail({
                from: emailFrom,
                to: testCustomerEmail,
                subject: `[TEST] Order Confirmation - ${mockOrder.orderNumber} (Payment Successful)`,
                html: customerEmailHTML
            });

            results.customer = {
                success: customerResult.success,
                email: testCustomerEmail,
                error: customerResult.error || null,
                message: customerResult.success 
                    ? '✅ Customer email sent successfully!' 
                    : `❌ Failed: ${customerResult.error}`
            };

            if (customerResult.success) {
                console.log(`✅ Customer email sent successfully to: ${testCustomerEmail}`);
            } else {
                console.log(`❌ Customer email failed: ${customerResult.error}`);
            }
        } catch (error) {
            results.customer = {
                success: false,
                email: testCustomerEmail,
                error: error.message,
                message: `❌ Error: ${error.message}`
            };
            console.error(`❌ Customer email error:`, error.message);
        }

        // Test 2: Send admin email (if configured)
        if (adminEmail) {
            console.log(`\n📧 [2/2] Testing Admin Email...`);
            try {
                const adminEmailHTML = await generateAdminOrderEmailHTML(mockOrder, mockItems);
                const adminResult = await sendEmail({
                    from: emailFrom,
                    to: adminEmail,
                    subject: `[TEST] New Order #${mockOrder.orderNumber} - ${mockOrder.firstName} ${mockOrder.lastName} - $${mockOrder.amount.toLocaleString()}`,
                    html: adminEmailHTML
                });

                results.admin = {
                    success: adminResult.success,
                    email: adminEmail,
                    error: adminResult.error || null,
                    message: adminResult.success 
                        ? '✅ Admin email sent successfully!' 
                        : `❌ Failed: ${adminResult.error}`
                };

                if (adminResult.success) {
                    console.log(`✅ Admin email sent successfully to: ${adminEmail}`);
                } else {
                    console.log(`❌ Admin email failed: ${adminResult.error}`);
                }
            } catch (error) {
                results.admin = {
                    success: false,
                    email: adminEmail,
                    error: error.message,
                    message: `❌ Error: ${error.message}`
                };
                console.error(`❌ Admin email error:`, error.message);
            }
        } else {
            results.admin = {
                success: false,
                email: null,
                error: 'ADMIN_EMAIL not configured',
                message: '⚠️ ADMIN_EMAIL not set in .env file. Admin email test skipped.'
            };
            console.warn(`⚠️ ADMIN_EMAIL not configured. Skipping admin email test.`);
        }

        console.log(`\n🧪 ===== TEST RESULTS SUMMARY =====`);
        console.log(`🧪 Customer Email: ${results.customer.success ? '✅ SUCCESS' : '❌ FAILED'}`);
        console.log(`🧪 Admin Email: ${results.admin.email ? (results.admin.success ? '✅ SUCCESS' : '❌ FAILED') : '⚠️ NOT CONFIGURED'}`);
        console.log(`🧪 ====================================\n`);

        // Determine overall success
        const overallSuccess = results.customer.success && (results.admin.email ? results.admin.success : true);

        return res.json({
            success: overallSuccess,
            message: overallSuccess 
                ? 'All configured emails sent successfully! Check your inboxes.' 
                : 'Some emails failed. Check details below.',
            results: {
                customer: results.customer,
                admin: results.admin,
                configuration: {
                    resendApiKey: !!process.env.RESEND_API_KEY,
                    emailFrom: emailFrom,
                    adminEmail: adminEmail || 'NOT CONFIGURED'
                }
            },
            testOrder: {
                orderNumber: mockOrder.orderNumber,
                amount: mockOrder.amount,
                customerName: `${mockOrder.firstName} ${mockOrder.lastName}`
            }
        });

    } catch (error) {
        console.error('❌ Test order emails error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
}

export {placeOrder, placeOrderRazorpay, verifyRazorpay, placeOrderAuthNet, placeOrderStripe, confirmStripePayment, allOrders, getOrderByCart, getOrderByTransactionId, getOrderByOrderNumber, updateStatus, testEmail, testOrderEmails, testPayment}