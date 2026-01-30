import mongoose from 'mongoose'

const orderSchema = new mongoose.Schema({
    cartId : { type: mongoose.Schema.Types.ObjectId, ref: 'cart', required: true },
    items : { type: Array, required: true },
    amount: { type: Number, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: false, default: '' }, // Optional when address comes from Apple Pay/Google Pay
    email: { type: String, required: true },
    street: { type: String, required: false, default: '' }, // Optional for Stripe wallet flow
    city: { type: String, required: false, default: '' },
    state: { type: String, required: false, default: '' },
    zipCode: { type: String, required: false, default: '' },
    country: { type: String, required: false, default: 'US' },
    phone: { type: String, required: false, default: '' }, // Optional for Stripe wallet flow
    status : { 
        type: String, 
        required: true, 
        enum: ['Order Placed', 'Processing', 'Shipped', 'Delivered'],
        default: 'Order Placed' 
    },
    paymentMethod: { type: String, required: true },
    payment: { type: Boolean, required: true, default: false },
    // Payment tracking fields
    transactionId: { type: String, required: false }, // Authorize.Net transaction ID or COD order reference
    orderNumber: { type: String, required: false }, // Unique order number for tracking
    paymentDate: { type: Date, required: false }, // When payment was processed
    paymentStatus: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
    paymentDetails: { 
        type: {
            gateway: String, // 'AUTHORIZE_NET', 'COD', 'RAZORPAY', etc.
            transactionId: String,
            responseCode: String,
            responseMessage: String,
            processedAt: Date,
            // Razorpay specific fields
            razorpayOrderId: String,
            razorpaySignature: String
        },
        required: false
    },
    date: { type: Date, default: Date.now }
})

const orderModel = mongoose.models.order || mongoose.model('order',orderSchema);
export default orderModel;