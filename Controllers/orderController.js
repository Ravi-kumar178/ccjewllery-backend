import orderModel from '../Models/orderModel.js'
import userModel from '../Models/userModel.js'
import razorpay from 'razorpay'

//global variable
const currency = 'inr'
const deliveryCharge = 10

//razorpay instance
const razorpayInstance = new razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
});

//placing orders using cod method
const placeOrder = async(req,res) => {

    try {
        const{userId, items, amount, address} = req.body;
        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod:"COD",
            payment:false,
            date: Date.now()
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save();

        await userModel.findByIdAndUpdate(userId,{cartData:{}});

        return res.json({success:true, message:"Order Placed"})
        
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
    
}
//placing orders using cod method
const placeOrderStripe = async(req,res) => {

}
//placing orders using cod method
const placeOrderRazorpay = async(req,res) => {

    try {
        const {userId, items, amount, address} = req.body;

        const orderData = {
            userId,
            items,
            address,
            amount,
            paymentMethod:"Razorpay",
            payment: false,
            date: Date.now()
        }

        const newOrder = new orderModel(orderData);
        await newOrder.save()

        const options = {
            amount: amount*100,
            currency: currency.toUpperCase(),
            receipt: newOrder._id.toString()
        }

        await razorpayInstance.orders.create(options,(error,order)=>{
            if(error){
                console.log(error);
                return res.json({success:false, message:error})
            }
            else{
                res.json({success:true, order})
            }
        })

    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message}) 
    }

}


//verify razorpay
const verifyRazorpay = async(req,res)=>{
    try {
        
        const{userId, razorpay_order_id} = req.body;

        const orderInfo = await razorpayInstance.orders.fetch(razorpay_order_id);
        if(orderInfo.status === 'paid'){
            await orderModel.findByIdAndUpdate(orderInfo.receipt,{payment:true});
            await userModel.findByIdAndUpdate(userId,{cartData:{}});
            return res.json({success:true, message:'Payment successful'})
        }
        else{
            return res.json({success:false, message:'Payment failed'})
        }


    }
     catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message}) 
    }
}


//placing orders using cod method
const allOrders = async(req,res) => {
    try {
        const orders = await orderModel.find({});
        return res.json({success:true,orders})
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}
//placing orders using cod method
const userOrders = async(req,res) => {
    try {
        const {userId} = req.body;
        const orders = await orderModel.find({userId});
        return res.json({success:true,orders})
    }
     catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}
//placing orders using cod method
const updateStatus = async(req,res) => {
    try {
        const{orderId,status} = req.body;
        await orderModel.findByIdAndUpdate(orderId,{status});
        return res.json({success:true,message:'Status Updated'})
    } 
    catch (error) {
        console.log(error);
        return res.json({success: false, message:error.message})
    }
}

export {placeOrder, placeOrderStripe, placeOrderRazorpay,verifyRazorpay, allOrders, userOrders, updateStatus}