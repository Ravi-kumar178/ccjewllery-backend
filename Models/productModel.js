import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    name:{type:String, required:true},
    description:{type:String, required:true},
    price:{type:Number, required:true},
    image:{type:Array, required:false},
    category:{type:String, required:true},
    subCategory:{type:String, required:false},
    sizes:{type:Array, required:false},
    bestseller:{type:Boolean},
    date:{type:Number, required:false}
});

const productModel = mongoose.models.product || mongoose.model("product",productSchema);

export default productModel;