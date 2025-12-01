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
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, amount:{type:'number'}, firstName:{type:'string'}, lastName:{type:'string'}, email:{type:'string'}, street:{type:'string'}, city:{type:'string'}, state:{type:'string'}, zipCode:{type:'string'}, country:{type:'string'}, phone:{type:'string'} }, required:['cartId','firstName','lastName','email','street','city','state','zipCode','country','phone'] } } } },
                responses: { '200': { description: 'Order placed successfully' } }
            }
        },
        '/api/order/authnet': {
            post: {
                tags: ['Order'],
                summary: 'Place order with Authorize.Net payment (TEST MODE - use test card numbers)',
                description: 'Test Cards: 4111111111111111 (Approved), 4222222222222220 (Declined). CVV: 123. Expiry: Any future date (MM/YY)',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, amount:{type:'number'}, firstName:{type:'string'}, lastName:{type:'string'}, email:{type:'string'}, street:{type:'string'}, city:{type:'string'}, state:{type:'string'}, zipCode:{type:'string'}, country:{type:'string'}, phone:{type:'string'}, cardNumber:{type:'string', example:'4111111111111111'}, cardExpiry:{type:'string', example:'12/25'}, cardCVV:{type:'string', example:'123'} }, required:['cartId','firstName','lastName','email','street','city','state','zipCode','country','phone','cardNumber','cardExpiry','cardCVV'] } } } },
                responses: { '200': { description: 'Payment processed successfully' } }
            }
        },
        '/api/order/getorder': {
            post: {
                tags: ['Order'],
                summary: 'Get order by cartId',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'} }, required:['cartId'] } } } },
                responses: { '200': { description: 'Order details' } }
            }
        },
        '/api/order/list': {
            post: {
                tags: ['Order'],
                summary: 'List all orders (admin only)',
                requestBody: { required: false },
                responses: { '200': { description: 'Array of all orders' } }
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
app.use(cors());


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


//start server
app.listen(port,()=>{
    console.log("App is running at: "+port);
})