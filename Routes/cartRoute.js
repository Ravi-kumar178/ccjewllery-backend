import express from 'express'
import {addToCart,updateCart,getUserCart} from '../Controllers/cartController.js'
import authUser from '../Middleware/auth.js';

const cartRouter = express.Router();

cartRouter.post('/add',authUser,addToCart);
cartRouter.post('/update',authUser,updateCart)
cartRouter.post('/get',authUser,getUserCart)

export default cartRouter