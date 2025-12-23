import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import connectDB from './Config/mongodb.js';
import connectCloudinary from './Config/cloudinary.js';
import userRouter from './Routes/userRoutes.js';
import productRoute from './Routes/productRoutes.js';
import cartRouter from './Routes/cartRoute.js';
import orderRouter from './Routes/orderRoute.js';
import swaggerUi from 'swagger-ui-express';
import contactRoutes from './Routes/contactRoutes.js';
import adminDashboardRoutes from './Routes/adminDashboardRoutes.js';

// Minimal OpenAPI spec for testing the APIs via Swagger UI
const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Forever ECommerce API',
        version: '1.0.0',
        description: 'Basic API documentation for local testing'
    },
    servers: [{ url: 'http://localhost:' + (process.env.PORT || 4000) }],
    paths: {
        '/api/user/register': {
            post: {
                tags: ['User'],
                summary: 'Register a new user',
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { name: {type:'string'}, email:{type:'string'}, password:{type:'string'} }, required:['name','email','password'] } } }
                },
                responses: { '200': { description: 'User registered' } }
            }
        },
        '/api/user/login': {
            post: {
                tags: ['User'],
                summary: 'Login user',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { email:{type:'string'}, password:{type:'string'} }, required:['email','password'] } } } },
                responses: { '200': { description: 'Login response' } }
            }
        }
        ,
        '/api/product/list': {
            get: {
                tags: ['Product'],
                summary: 'List products',
                responses: { '200': { description: 'Array of products' } }
            }
        },
        '/api/product/single': {
            post: {
                tags: ['Product'],
                summary: 'Get single product by id',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { productId:{type:'string'} }, required:['productId'] } } } },
                responses: { '200': { description: 'Product object' } }
            }
        },
        '/api/product/add': {
            post: {
                tags: ['Product'],
                summary: 'Add a new product (admin)',
                requestBody: { 
                    required: true, 
                    content: { 
                        'multipart/form-data': { 
                            schema: { 
                                type:'object', 
                                properties: { 
                                    name: {type:'string'},
                                    description: {type:'string'},
                                    price: {type:'number'},
                                    category: {type:'string'},
                                    subCategory: {type:'string'},
                                    sizes: {type:'string'},
                                    bestseller: {type:'string'},
                                    image1: {type:'string', format:'binary'}
                                },
                                required: ['name','description','price','category','subCategory','sizes','bestseller','image1']
                            } 
                        } 
                    } 
                },
                responses: { '200': { description: 'Product added' } }
            }
        },
        '/api/product/remove': {
            post: {
                tags: ['Product'],
                summary: 'Remove a product (admin)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { productId:{type:'string'} }, required:['productId'] } } } },
                responses: { '200': { description: 'Product removed' } }
            }
        },
        '/api/cart/create': {
            post: {
                tags: ['Cart'],
                summary: 'Create a new cart',
                requestBody: { required: false },
                responses: { '200': { description: 'Cart created with cartId' } }
            }
        },
        '/api/cart/add': {
            post: {
                tags: ['Cart'],
                summary: 'Add item to cart (auto-creates cart if cartId not provided)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, productId:{type:'string'}, size:{type:'string'}, quantity:{type:'number'} }, required:['productId'] } } } },
                responses: { '200': { description: 'Item added to cart, returns cartId and cart object' } }
            }
        },
        '/api/cart/update': {
            post: {
                tags: ['Cart'],
                summary: 'Update cart item quantity or remove (quantity <= 0 removes item)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, productId:{type:'string'}, size:{type:'string'}, quantity:{type:'number'} }, required:['cartId','productId','quantity'] } } } },
                responses: { '200': { description: 'Cart item updated' } }
            }
        },
        '/api/cart/get': {
            post: {
                tags: ['Cart'],
                summary: 'Get cart by cartId',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'} }, required:['cartId'] } } } },
                responses: { '200': { description: 'Cart object with items and details' } }
            }
        },
        '/api/cart/details': {
            post: {
                tags: ['Cart'],
                summary: 'Save buyer details (name, address, mobile) to cart',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, name:{type:'string'}, address:{type:'string'}, mobile:{type:'string'} }, required:['cartId'] } } } },
                responses: { '200': { description: 'Buyer details saved to cart' } }
            }
        },
        '/api/cart/all': {
            get: {
                tags: ['Cart'],
                summary: 'Get all carts',
                responses: { '200': { description: 'Array of all carts' } }
            }
        },
        '/api/order/place': {
            post: {
                tags: ['Order'],
                summary: 'Place an order (COD - no authentication required). Items are taken from the cart by cartId.',
                description: 'Returns order with unique orderNumber and transactionId (COD reference). Every order has a transaction ID for tracking.',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, amount:{type:'number'}, firstName:{type:'string'}, lastName:{type:'string'}, email:{type:'string'}, street:{type:'string'}, city:{type:'string'}, state:{type:'string'}, zipCode:{type:'string'}, country:{type:'string'}, phone:{type:'string'} }, required:['cartId','firstName','lastName','email','street','city','state','zipCode','country','phone'] } } } },
                responses: { 
                    '200': { 
                        description: 'Order placed successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string', example: 'ORD-LX9K2M-AB3C' },
                                        transactionId: { type: 'string', example: 'COD-1703123456789-XYZ123' }
                                    }
                                }
                            }
                        }
                    } 
                }
            }
        },
        '/api/order/authnet': {
            post: {
                tags: ['Order'],
                summary: 'Place order with Authorize.Net payment',
                description: 'Test Cards (Sandbox): 4111111111111111 (Approved), 4222222222222220 (Declined). CVV: 123. Expiry: Any future date (MM/YY). Returns order with unique orderNumber and real Authorize.Net transactionId.',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, amount:{type:'number'}, firstName:{type:'string'}, lastName:{type:'string'}, email:{type:'string'}, street:{type:'string'}, city:{type:'string'}, state:{type:'string'}, zipCode:{type:'string'}, country:{type:'string'}, phone:{type:'string'}, cardNumber:{type:'string', example:'4111111111111111'}, cardExpiry:{type:'string', example:'12/25'}, cardCVV:{type:'string', example:'123'} }, required:['cartId','firstName','lastName','email','street','city','state','zipCode','country','phone','cardNumber','cardExpiry','cardCVV'] } } } },
                responses: { 
                    '200': { 
                        description: 'Payment processed successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string', example: 'ORD-LX9K2M-AB3C' },
                                        transactionId: { type: 'string', example: '60012345678' }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Payment failed',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        message: { type: 'string' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/order/razorpay': {
            post: {
                tags: ['Order'],
                summary: 'Create Razorpay order (Step 1)',
                description: 'Creates an order and returns Razorpay order ID. Amount is AUTO-CALCULATED from cart items (price × quantity) + ₹10 delivery. Supports GPay, PhonePe, UPI, Cards, Net Banking, Wallets.',
                requestBody: { 
                    required: true, 
                    content: { 
                        'application/json': { 
                            schema: { 
                                type: 'object', 
                                properties: { 
                                    cartId: { type: 'string', example: '507f1f77bcf86cd799439011' },
                                    firstName: { type: 'string', example: 'Rahul' },
                                    lastName: { type: 'string', example: 'Sharma' },
                                    email: { type: 'string', example: 'rahul@example.com' },
                                    street: { type: 'string', example: '123 MG Road' },
                                    city: { type: 'string', example: 'Mumbai' },
                                    state: { type: 'string', example: 'Maharashtra' },
                                    zipCode: { type: 'string', example: '400001' },
                                    country: { type: 'string', example: 'India' },
                                    phone: { type: 'string', example: '9876543210' }
                                }, 
                                required: ['cartId', 'firstName', 'lastName', 'email', 'street', 'city', 'state', 'zipCode', 'country', 'phone'] 
                            } 
                        } 
                    } 
                },
                responses: { 
                    '200': { 
                        description: 'Razorpay order created successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Razorpay order created. Complete payment on frontend.' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string', example: 'ORD-LX9K2M-AB3C' },
                                        razorpayOrder: { 
                                            type: 'object',
                                            properties: {
                                                id: { type: 'string', example: 'order_ABC123xyz' },
                                                amount: { type: 'number', example: 150000, description: 'Amount in paise (multiply by 100)' },
                                                currency: { type: 'string', example: 'INR' }
                                            }
                                        },
                                        key_id: { type: 'string', example: 'rzp_test_xxxxx', description: 'Use this to initialize Razorpay checkout on frontend' }
                                    }
                                }
                            }
                        }
                    },
                    '400': { description: 'Missing required fields' },
                    '404': { description: 'Cart not found' },
                    '500': { description: 'Razorpay not configured or server error' }
                }
            }
        },
        '/api/order/verifyrazorpay': {
            post: {
                tags: ['Order'],
                summary: 'Verify Razorpay payment (Step 2)',
                description: 'After user completes payment on Razorpay checkout, call this endpoint with the payment details to verify signature and complete the order. Sends confirmation email on success.',
                requestBody: { 
                    required: true, 
                    content: { 
                        'application/json': { 
                            schema: { 
                                type: 'object', 
                                properties: { 
                                    razorpay_order_id: { type: 'string', example: 'order_ABC123xyz', description: 'From Razorpay checkout response' },
                                    razorpay_payment_id: { type: 'string', example: 'pay_XYZ789abc', description: 'From Razorpay checkout response' },
                                    razorpay_signature: { type: 'string', example: 'a1b2c3d4e5f6...', description: 'From Razorpay checkout response (HMAC SHA256)' },
                                    cartId: { type: 'string', example: '507f1f77bcf86cd799439011', description: 'Optional - to mark cart as completed' }
                                }, 
                                required: ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature'] 
                            } 
                        } 
                    } 
                },
                responses: { 
                    '200': { 
                        description: 'Payment verified successfully',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: true },
                                        message: { type: 'string', example: 'Payment verified successfully' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string', example: 'ORD-LX9K2M-AB3C' },
                                        transactionId: { type: 'string', example: 'pay_XYZ789abc' }
                                    }
                                }
                            }
                        }
                    },
                    '400': { 
                        description: 'Signature verification failed (possible tampering)',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean', example: false },
                                        message: { type: 'string', example: 'Payment verification failed. Invalid signature.' },
                                        orderNumber: { type: 'string' }
                                    }
                                }
                            }
                        }
                    },
                    '404': { description: 'Order not found with this Razorpay order ID' }
                }
            }
        },
        '/api/order/getorder': {
            post: {
                tags: ['Order'],
                summary: 'Get order by cartId',
                description: 'Returns order with payment tracking information (orderNumber, transactionId, paymentStatus)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'} }, required:['cartId'] } } } },
                responses: { 
                    '200': { 
                        description: 'Order details with payment tracking',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string' },
                                        transactionId: { type: 'string' },
                                        paymentStatus: { type: 'string', enum: ['pending', 'completed', 'failed', 'refunded'] }
                                    }
                                }
                            }
                        }
                    } 
                }
            }
        },
        '/api/order/getbytransaction': {
            post: {
                tags: ['Order'],
                summary: 'Get order by transaction ID',
                description: 'Search for an order using its transaction ID (Authorize.Net transaction ID or COD reference)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { transactionId:{type:'string', example:'60012345678'} }, required:['transactionId'] } } } },
                responses: { 
                    '200': { 
                        description: 'Order found with payment details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string' },
                                        transactionId: { type: 'string' },
                                        paymentStatus: { type: 'string' },
                                        paymentDetails: { 
                                            type: 'object',
                                            properties: {
                                                gateway: { type: 'string' },
                                                transactionId: { type: 'string' },
                                                responseCode: { type: 'string' },
                                                responseMessage: { type: 'string' },
                                                processedAt: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '404': { description: 'Order not found with this transaction ID' }
                }
            }
        },
        '/api/order/getbyordernumber': {
            post: {
                tags: ['Order'],
                summary: 'Get order by order number',
                description: 'Search for an order using its unique order number (e.g., ORD-LX9K2M-AB3C)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { orderNumber:{type:'string', example:'ORD-LX9K2M-AB3C'} }, required:['orderNumber'] } } } },
                responses: { 
                    '200': { 
                        description: 'Order found with payment details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        order: { type: 'object' },
                                        orderNumber: { type: 'string' },
                                        transactionId: { type: 'string' },
                                        paymentStatus: { type: 'string' },
                                        paymentDetails: { 
                                            type: 'object',
                                            properties: {
                                                gateway: { type: 'string' },
                                                transactionId: { type: 'string' },
                                                responseCode: { type: 'string' },
                                                responseMessage: { type: 'string' },
                                                processedAt: { type: 'string', format: 'date-time' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    '404': { description: 'Order not found with this order number' }
                }
            }
        },
        '/api/order/list': {
            post: {
                tags: ['Order'],
                summary: 'List all orders (admin only)',
                description: 'Returns all orders with payment tracking information (orderNumber, transactionId, paymentStatus, paymentDetails)',
                requestBody: { required: false },
                responses: { 
                    '200': { 
                        description: 'Array of all orders with payment tracking',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        orders: { 
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    orderNumber: { type: 'string' },
                                                    transactionId: { type: 'string' },
                                                    paymentStatus: { type: 'string' },
                                                    paymentDetails: { type: 'object' },
                                                    paymentDate: { type: 'string', format: 'date-time' },
                                                    amount: { type: 'number' },
                                                    paymentMethod: { type: 'string' }
                                                }
                                            }
                                        },
                                        total: { type: 'number' }
                                    }
                                }
                            }
                        }
                    } 
                }
            }
        }
        ,
        "/api/contact": {
            post: {
                summary: "Create a new contact message",
                description: "This endpoint is used to submit a contact message.",
                tags: ["Contact"],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    firstName: { type: "string", example: "Roshan" },
                                    lastName: { type: "string", example: "Kumar" },
                                    email: { type: "string", example: "roshan@gmail.com" },
                                    phone: { type: "string", example: "9876543210" },
                                    message: { type: "string", example: "I need help with my order." }
                                },
                                required: ["firstName", "lastName", "email", "phone", "message"]
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Message submitted successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    example: {
                                        success: true,
                                        message: "Contact form submitted successfully"
                                    }
                                }
                            }
                        }
                    },
                    "500": {
                        description: "Server error"
                    }
                }
            }
        },
        "/api/admin/stats": {
            get: {
                tags: ["Admin Dashboard"],
                summary: "Get dashboard statistics (admin only)",
                description: "Returns statistics for the admin dashboard including total orders, revenue, products, and recent activity. Requires admin authentication.",
                security: [{ bearerAuth: [] }],
                responses: {
                    "200": {
                        description: "Dashboard statistics retrieved successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean" },
                                        stats: {
                                            type: "object",
                                            properties: {
                                                totalOrders: { type: "number", example: 150 },
                                                totalRevenue: { type: "number", example: 45000.50 },
                                                totalProducts: { type: "number", example: 45 },
                                                totalUsers: { type: "number", example: 320 },
                                                pendingOrders: { type: "number", example: 12 },
                                                completedOrders: { type: "number", example: 138 },
                                                recentOrders: {
                                                    type: "array",
                                                    items: { type: "object" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "401": {
                        description: "Unauthorized - Admin authentication required"
                    },
                    "500": {
                        description: "Server error"
                    }
                }
            }
        }
        
    }

};


//App config
const app = express();
const port = process.env.PORT || 4000
connectDB();
connectCloudinary()

//Middleware
app.use(express.json());

// CORS configuration - allow all origins for development
app.use(cors({
    origin: '*', // Allow all origins (change to specific domain in production)
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

// Handle preflight requests
app.options('*', cors());


//api endpoints
app.get('/',(req,res)=>{
    res.send("API working");
})
// Swagger UI for API testing
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use('/api/user',userRouter);
app.use('/api/product',productRoute);
app.use('/api/cart', cartRouter);
app.use('/api/order',orderRouter)
app.use("/api/contact", contactRoutes);
app.use("/api/admin", adminDashboardRoutes );




//start server
app.listen(port,()=>{
    console.log("App is running at: "+port);
})