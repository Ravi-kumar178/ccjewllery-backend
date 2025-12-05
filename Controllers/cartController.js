import Cart from '../Models/cartModel.js'

// Create a new cart (returns cartId)
const createCart = async (req, res) => {
    try {
        const newCart = new Cart();
        await newCart.save();
        return res.status(200).json({ success: true, cartId: newCart._id, cart: newCart });
    } catch (error) {
        console.error('Error creating cart:', error);
        return res.status(500).json({ success: false, message: error.message || 'Failed to create cart' });
    }
}

// Add product to cart (public). If cartId not provided, create a new cart.
const addToCart = async (req, res) => {
    try {
        const { cartId, productId, size, quantity } = req.body;

        if (!productId) return res.status(400).json({ success: false, message: 'productId is required' });

        // Validate productId is a valid MongoDB ObjectId
        const mongoose = (await import('mongoose')).default;
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ 
                success: false, 
                message: `Invalid product ID format. Product ID "${productId}" is not a valid MongoDB ObjectId. Please ensure products are fetched from the backend API.` 
            });
        }

        const qty = quantity ? Number(quantity) : 1;

        let cart;
        if (cartId) {
            cart = await Cart.findById(cartId);
            if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });
        } else {
            cart = new Cart();
        }

        // find existing item (size may be undefined)
        const existing = cart.items.find(i => i.productId.toString() === productId && ((i.size || '') === (size || '')));
        if (existing) {
            existing.quantity = Number(existing.quantity) + qty;
        } else {
            const item = { productId, quantity: qty };
            if (typeof size !== 'undefined') item.size = size;
            cart.items.push(item);
        }

        await cart.save();
        return res.json({ success: true, cartId: cart._id, cart });
    } catch (error) {
        console.log(error);
        // Check if it's a validation error about ObjectId
        if (error.message && error.message.includes('Cast to ObjectId')) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid product ID. Products must be fetched from the backend API to get valid ObjectIds.' 
            });
        }
        return res.status(500).json({ success: false, message: error.message || 'Failed to add item to cart' });
    }
}

// Update cart item quantity or remove
const updateCart = async (req, res) => {
    try {
        const { cartId, productId, size, quantity } = req.body;
        if (!cartId || !productId || typeof quantity === 'undefined') return res.status(400).json({ success: false, message: 'cartId, productId and quantity are required' });

        const cart = await Cart.findById(cartId);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const idx = cart.items.findIndex(i => i.productId.toString() === productId && ((i.size || '') === (size || '')));
        if (idx === -1) return res.status(404).json({ success: false, message: 'Item not found in cart' });

        if (Number(quantity) <= 0) {
            cart.items.splice(idx, 1);
        } else {
            cart.items[idx].quantity = Number(quantity);
        }

        await cart.save();
        return res.json({ success: true, cart });
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: error.message });
    }
}

// Get cart by id
const getCart = async (req, res) => {
    try {
        const { cartId } = req.body;
        if (!cartId) return res.status(400).json({ success: false, message: 'cartId is required' });

        const cart = await Cart.findById(cartId);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        return res.json({ success: true, cart });
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: error.message });
    }
}

// Save buyer details (name, address, mobile)
const saveDetails = async (req, res) => {
    try {
        const { cartId, name, address, mobile } = req.body;
        if (!cartId) return res.status(400).json({ success: false, message: 'cartId is required' });

        const cart = await Cart.findById(cartId);
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        cart.details = { name, address, mobile };
        await cart.save();
        return res.json({ success: true, cart });
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: error.message });
    }
}

// Get all carts
const getAllCarts = async (req, res) => {
    try {
        const carts = await Cart.find({});
        return res.json({ success: true, carts });
    } catch (error) {
        console.log(error);
        return res.json({ success: false, message: error.message });
    }
}

export { createCart, addToCart, updateCart, getCart, saveDetails, getAllCarts }

