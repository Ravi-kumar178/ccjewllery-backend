import mongoose from "mongoose";


const connectDB = async() => {

    mongoose.connection.on('connected',()=>{
        console.log("Database connected successfully")
    })

    mongoose.connection.on('error',(err)=>{
        console.error('MongoDB connection error:', err.message);
    })

    if (!process.env.MONGODB_URL) {
        console.error('MongoDB connection error: MONGODB_URL is not defined in .env file');
        console.error('Please create a .env file with MONGODB_URL variable');
        console.error('Example: MONGODB_URL=mongodb://host:port/database_name');
        process.exit(1);
    }

    try {
        // Expect full MongoDB URL in env (including database name), e.g. mongodb://localhost:27017/forever
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URL);
    } catch (error) {
        console.error('MongoDB connection error:', error.message);
        console.error('Please check your MONGODB_URL in .env file');
        process.exit(1);
    }
}

export default connectDB