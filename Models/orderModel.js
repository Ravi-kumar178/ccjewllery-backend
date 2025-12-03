import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
    cartId : { type: mongoose.Schema.Types.ObjectId, ref: 'cart', required: true },
    items : { type: Array, required: true },
    amount: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zipCode: { type: String, required: true },
    country: { type: String, required: true },
    phone: { type: String, required: true },
    status : { type: String, required: true, default: 'Order Placed' },
    paymentMethod: { type: String, required: true },
    payment: { type: Boolean, required: true, default: false },
    date: { type: Date, default: Date.now }
})

const orderModel = mongoose.models.order || mongoose.model('order',orderSchema);
export default orderModel;