import express from 'express'
import { createCart, addToCart, updateCart, getCart, saveDetails, getAllCarts } from '../Controllers/cartController.js'

const cartRouter = express.Router();

// Public cart endpoints (no authentication) - create a cart, add/update/get items, save buyer details
cartRouter.post('/create', createCart);
cartRouter.post('/add', addToCart);
cartRouter.post('/update', updateCart);
cartRouter.post('/get', getCart);
cartRouter.post('/details', saveDetails);
cartRouter.get('/all', getAllCarts);

export default cartRouter