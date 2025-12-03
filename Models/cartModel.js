import mongoose from 'mongoose'

const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'product', required: true },
    size: { type: String },
    quantity: { type: Number, default: 1 }
}, { _id: false });

const cartSchema = new mongoose.Schema({
    items: { type: [cartItemSchema], default: [] },
    details: {
        name: { type: String },
        address: { type: String },
        mobile: { type: String }
    },
    status: { type: String, enum: ['open','checkedout','completed'], default: 'open' },
    date: { type: Date, default: Date.now }
});

const Cart = mongoose.model('cart', cartSchema);

export default Cart;
