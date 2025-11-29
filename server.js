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
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type:'object', properties: { title:{type:'string'}, price:{type:'number'}, description:{type:'string'} } } } } },
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
        '/api/cart/add': {
            post: {
                tags: ['Cart'],
                summary: 'Add item to cart',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { productId:{type:'string'}, quantity:{type:'number'} }, required:['productId'] } } } },
                responses: { '200': { description: 'Cart updated' } }
            }
        },
        '/api/cart/update': {
            post: {
                tags: ['Cart'],
                summary: 'Update cart item quantity',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { productId:{type:'string'}, quantity:{type:'number'} }, required:['productId','quantity'] } } } },
                responses: { '200': { description: 'Cart updated' } }
            }
        },
        '/api/cart/get': {
            post: {
                tags: ['Cart'],
                summary: 'Get user cart',
                requestBody: { required: false },
                responses: { '200': { description: 'Cart object' } }
            }
        },
        '/api/order/place': {
            post: {
                tags: ['Order'],
                summary: 'Place an order',
                requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { cartId:{type:'string'}, paymentMethod:{type:'string'} }, required:['cartId'] } } } },
                responses: { '200': { description: 'Order placed' } }
            }
        },
        '/api/order/userorders': {
            post: {
                tags: ['Order'],
                summary: 'Get user orders',
                requestBody: { required: false },
                responses: { '200': { description: 'Array of orders' } }
            }
        },
        '/api/order/list': {
            post: {
                tags: ['Order'],
                summary: 'List all orders (admin)',
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