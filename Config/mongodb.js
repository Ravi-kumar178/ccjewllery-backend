import mongoose from "mongoose";


const connectDB = async() => {

    mongoose.connection.on('connected',()=>{
        console.log("Database connected successfully")
    })

    try {
        // Expect full MongoDB URL in env (including database name), e.g. mongodb://localhost:27017/forever
        await mongoose.connect(process.env.MONGODB_URL);
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        process.exit(1);
    }
}

export default connectDB