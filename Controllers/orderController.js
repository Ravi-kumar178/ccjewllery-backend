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
    ? new Stripe(STRIPE_SECRET_KEY)
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


//placing orders using Stripe method
const placeOrderStripe = async(req,res) => {
    try {
        // Check if Stripe is configured
        if (!stripeInstance) {
            return res.status(500).json({
                success: false, 
                message: "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
            })
        }

        const { cartId, amount, firstName, lastName, email, street, city, state, zipCode, country, phone } = req.body;

        // Validate required fields
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
                message: `Invalid cartId format. Got "${cartId}" but expected a 24-character MongoDB ObjectId.`
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
            paymentMethod: "Stripe",
            payment: false,
            transactionId: null,
            orderNumber: orderNumber,
            paymentStatus: 'pending',
            paymentDetails: {
                gateway: 'STRIPE',
                transactionId: null,
                responseCode: null,
                responseMessage: 'Payment initiated',
                processedAt: new Date()
            }
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        // Create Stripe Payment Intent
        // Stripe amounts are in cents (smallest currency unit)
        // For USD: multiply by 100 to convert to cents
        const stripeAmount = Math.round(finalAmount * 100);

        try {
            // Determine currency based on country (INR for India, USD for others)
            const countryCode = getCountryCode(country);
            const currency = countryCode === 'IN' ? 'inr' : 'usd';
            
            // Payment method types for US-based products
            // Payment Element will automatically show:
            // - Card payments (Visa, Mastercard, Amex, etc.)
            // - Google Pay (if enabled in Stripe Dashboard and customer's browser supports it)
            // - Apple Pay (if on iOS/Safari and enabled)
            // - Link (Stripe's one-click checkout)
            const paymentMethodTypes = ['card']; // Card is required, Google Pay/Apple Pay are automatically available via Payment Element
            
            console.log(`💳 Payment method types: ${paymentMethodTypes.join(', ')}`);
            console.log(`💳 Country: ${country} (Code: ${countryCode})`);
            console.log(`💳 Currency: ${currency.toUpperCase()}`);
            console.log(`💳 Note: Google Pay and Apple Pay will appear automatically in Payment Element if enabled in Stripe Dashboard`);
            
            // Amount is already in smallest currency unit (cents for USD, paise for INR)
            // Both USD and INR use 100 as the multiplier, so stripeAmount is correct
            
            const paymentIntent = await stripeInstance.paymentIntents.create({
                amount: stripeAmount,
                currency: currency,
                payment_method_types: paymentMethodTypes,
                metadata: {
                    orderId: newOrder._id.toString(),
                    orderNumber: orderNumber,
                    customerEmail: email,
                    customerName: `${firstName} ${lastName}`
                },
                description: `Order ${orderNumber} - ${firstName} ${lastName}`,
                receipt_email: email,
                shipping: {
                    name: `${firstName} ${lastName}`,
                    phone: phone,
                    address: {
                        line1: street,
                        city: city,
                        state: state,
                        postal_code: zipCode,
                        country: countryCode
                    }
                }
            });

            // Update order with Stripe payment intent ID
            await orderModel.findByIdAndUpdate(newOrder._id, {
                'paymentDetails.stripePaymentIntentId': paymentIntent.id
            });

            console.log(`\n💳 ===== STRIPE PAYMENT INTENT CREATED =====`);
            console.log(`💳 Order Number: ${orderNumber}`);
            console.log(`💳 Payment Intent ID: ${paymentIntent.id}`);
            console.log(`💳 Amount: ${currency === 'inr' ? '₹' : '$'}${finalAmount} (${stripeAmount} ${currency === 'inr' ? 'paise' : 'cents'})`);
            console.log(`💳 Currency: ${currency.toUpperCase()}`);
            console.log(`💳 Payment Methods: ${paymentMethodTypes.join(', ')}`);
            console.log(`💳 Customer: ${firstName} ${lastName} (${email})`);
            if (countryCode === 'IN' && paymentMethodTypes.length === 1) {
                console.log(`💳 Note: UPI/PhonePe not enabled. Only card payments available.`);
                console.log(`💳 Enable UPI at: https://dashboard.stripe.com/account/payments/settings`);
            }
            console.log(`💳 ===========================================\n`);

            // Return payment intent details to frontend
            return res.json({
                success: true,
                message: "Stripe payment intent created. Complete payment on frontend.",
                order: newOrder,
                orderNumber: orderNumber,
                paymentIntent: {
                    id: paymentIntent.id,
                    client_secret: paymentIntent.client_secret,
                    amount: paymentIntent.amount,
                    currency: paymentIntent.currency,
                    status: paymentIntent.status
                }
            })
        } catch (stripeError) {
            console.error('Stripe payment intent creation error:', stripeError);
            
            // Update order with error
            await orderModel.findByIdAndUpdate(newOrder._id, {
                paymentStatus: 'failed',
                'paymentDetails.responseMessage': stripeError.message || 'Payment intent creation failed',
                'paymentDetails.responseCode': 'error'
            });

            return res.status(500).json({
                success: false,
                message: `Failed to create payment intent: ${stripeError.message}`,
                order: newOrder
            })
        }

    } catch (error) {
        console.error('Stripe order creation error:', error);
        return res.status(500).json({success: false, message: error.message})
    }
}

// Confirm Stripe payment after user completes checkout
const confirmStripePayment = async (req, res) => {
    try {
        const { payment_intent_id, payment_intent_client_secret } = req.body;

        // Validate required fields
        if (!payment_intent_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required field: payment_intent_id"
            })
        }

        if (!stripeInstance) {
            return res.status(500).json({
                success: false,
                message: "Stripe is not configured. Please set STRIPE_SECRET_KEY in environment variables."
            })
        }

        // Retrieve payment intent from Stripe
        let paymentIntent;
        try {
            paymentIntent = await stripeInstance.paymentIntents.retrieve(payment_intent_id);
        } catch (stripeError) {
            return res.status(400).json({
                success: false,
                message: `Invalid payment intent: ${stripeError.message}`
            })
        }

        // Find order by payment intent ID or order ID from metadata
        const order = await orderModel.findOne({
            $or: [
                { 'paymentDetails.stripePaymentIntentId': payment_intent_id },
                { _id: paymentIntent.metadata?.orderId }
            ]
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found with this payment intent ID"
            })
        }

        console.log(`\n💳 ===== STRIPE PAYMENT VERIFICATION =====`);
        console.log(`💳 Payment Intent ID: ${payment_intent_id}`);
        console.log(`💳 Order Number: ${order.orderNumber}`);
        console.log(`💳 Payment Status: ${paymentIntent.status}`);
        console.log(`💳 Amount: $${(paymentIntent.amount / 100).toFixed(2)}`);
        console.log(`💳 =========================================\n`);

        // Check payment intent status
        if (paymentIntent.status === 'succeeded') {
            // Payment successful - Update order
            const chargeId = paymentIntent.latest_charge || paymentIntent.charges?.data?.[0]?.id || null;
            
            await orderModel.findByIdAndUpdate(order._id, {
                payment: true,
                transactionId: chargeId || payment_intent_id,
                status: "Processing",
                paymentStatus: 'completed',
                paymentDate: new Date(),
                paymentDetails: {
                    gateway: 'STRIPE',
                    stripePaymentIntentId: payment_intent_id,
                    transactionId: chargeId || payment_intent_id,
                    responseCode: 'succeeded',
                    responseMessage: 'Payment successful',
                    processedAt: new Date()
                }
            });

            // Mark cart as completed
            if (order.cartId) {
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

            console.log(`\n✅ ===== STRIPE PAYMENT SUCCESSFUL =====`);
            console.log(`✅ Order Number: ${order.orderNumber}`);
            console.log(`✅ Transaction ID: ${chargeId || payment_intent_id}`);
            console.log(`✅ Amount: $${order.amount}`);
            console.log(`✅ Customer: ${order.firstName} ${order.lastName}`);
            console.log(`✅ ======================================\n`);

            return res.json({
                success: true,
                message: "Payment confirmed successfully",
                order: updatedOrder,
                orderNumber: order.orderNumber,
                transactionId: chargeId || payment_intent_id,
                paymentIntent: {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount
                }
            })

        } else if (paymentIntent.status === 'requires_payment_method' || 
                   paymentIntent.status === 'canceled' || 
                   paymentIntent.status === 'payment_failed') {
            // Payment failed or was canceled
            await orderModel.findByIdAndUpdate(order._id, {
                status: "Order Placed",
                paymentStatus: 'failed',
                paymentDetails: {
                    gateway: 'STRIPE',
                    stripePaymentIntentId: payment_intent_id,
                    transactionId: null,
                    responseCode: paymentIntent.status,
                    responseMessage: `Payment ${paymentIntent.status}`,
                    processedAt: new Date()
                }
            });

            console.error(`\n❌ ===== STRIPE PAYMENT FAILED =====`);
            console.error(`❌ Order: ${order.orderNumber}`);
            console.error(`❌ Status: ${paymentIntent.status}`);
            console.error(`❌ ====================================\n`);

            return res.status(400).json({
                success: false,
                message: `Payment failed. Status: ${paymentIntent.status}`,
                orderNumber: order.orderNumber,
                paymentIntent: {
                    id: paymentIntent.id,
                    status: paymentIntent.status
                }
            })
        } else {
            // Payment is still processing (requires_action, processing, etc.)
            return res.json({
                success: false,
                message: `Payment is still processing. Status: ${paymentIntent.status}`,
                orderNumber: order.orderNumber,
                paymentIntent: {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    client_secret: paymentIntent.client_secret
                }
            })
        }

    } catch (error) {
        console.error('Stripe payment confirmation error:', error);
        return res.status(500).json({ success: false, message: error.message })
    }
}

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