import userModel from '../Models/userModel.js'
import validator from 'validator';
// import bcrypt from 'bcrypt'  // authentication removed per request
// import jwt from 'jsonwebtoken' // authentication removed per request



// original token generation (commented out):
// const generateToken = (id) => {
//     return jwt.sign({id},process.env.JWT_SECRET);
// }
// token generation removed — authentication disabled
const generateToken = (id) => {
  return null;
}

//Routes for user login
const loginUser = async(req,res) => {
 try {
    const {email,password} = req.body;

    const user = await userModel.findOne({email});
    if(!user){
      return res.json({success: false, message:'User doesnot exist'});
    }
    // original authentication (commented out):
    // //check pass match
    // const isMatch = await bcrypt.compare(password,user.password);
    // if(isMatch){
    //     const token = generateToken(user._id);
    //     return res.json({success:true, token});
    // }
    // else{
    //     return res.json({success:false, message:"Please enter valid credentials"})
    // }
    // authentication disabled: accept existing user without password check
    return res.json({success:true});


 } 
 catch (error) {
    console.log(error);
    return res.json({success: false, message:error.message});
 }
}


//Routes for user register
const registerUser = async(req,res) => {

  try {
    
    const {name, email , password} = req.body;

    const alreadyExist = await userModel.findOne({email});
    if(alreadyExist){
        return res.json({success: false, message:'User already exist'})
    }

    if(!validator.isEmail(email)){
        return res.json({success:false,message:'please enter a valid email'})
    }

    if(password.length<8){
        return res.json({success:false, message:'please enter a strong password'})
    }

    // original password hashing (commented out):
    // const salt = await bcrypt.genSalt(10);
    // const hashedPassword = await bcrypt.hash(password,salt);
    // password hashing removed — storing password as plain text (per request)
    const hashedPassword = password;

    const profieUrl = `https://avatar.iran.liara.run/public/boy?username=${name}`

    const newUser = new userModel({name,email,password:hashedPassword,profileImage:profieUrl});

    const user = await newUser.save();
    // original token generation and response (commented out):
    // const token = generateToken(user._id);
    // return res.json({success:true , token});
    // authentication disabled: return success without token
    return res.json({success:true});

    
  } catch (error) {
    console.log(error);
    return res.json({success: false, message:error.message});
  }
}


//Routes for admin login
const adminLogin = async(req,res) => {
  try {

    const{email, password} = req.body
    if(email === process.env.ADMIN_LOGIN && password === process.env.ADMIN_PASSWORD){
      // original token creation (commented out):
      // const token = jwt.sign(email+password,process.env.JWT_SECRET)
      // return res.json({success:true, token});
      // authentication disabled: return success without token
      return res.json({success:true});
    }
    else{
        return res.json({success:false, message:"Invalid Credentials"})
    }   
  } 
  catch (error) {
    console.log(error);
    return res.json({success:false, message:error.message})
  }
}

const getUserDetails = async(req,res) => {
  try {
    const userId = req.body.userId;
    const user = await userModel.findById(userId).select('-password');
    if(!user){
      return res.json({success:false,message:'User not found'});
    }
    return res.json({success:true,user})
  } 
  catch (error) {
    console.log(error);
    return res.json({success:false, message:error.message})
  }
}

const updateUserProfile = async(req,res)=>{
  try {
    const userId = req.body.userId;
    const{name,email,currentPassword,newPassword} = req.body;
    
    const user = await userModel.findById(userId);
    if(!user){
      return res.json({success:false, message:"User not found"})
    }

    if(email) user.email = email;
    if(name){
      user.name = name;
      let profieUrl = `https://avatar.iran.liara.run/public/boy?username=${name}`
      user.profileImage = profieUrl;
    }

    if(currentPassword && newPassword){
      // original password check and hashing (commented out):
      // const isMatch = await bcrypt.compare(currentPassword,user.password);
      // if(!isMatch){
      //   return res.json({success:false,message:"Incorrect Current Password"})
      // }
      // const salt = await bcrypt.genSalt(10);
      // const hashedPassword = await bcrypt.hash(newPassword,salt);
      // user.password = hashedPassword;

      // authentication disabled: compare plain text passwords
      if(currentPassword !== user.password){
        return res.json({success:false,message:"Incorrect Current Password"})
      }

      user.password = newPassword;
    }

    await user.save();

    return res.json({success:true, message: 'Profile updated successfully',
      user: {
        name: user.name,
        email: user.email,
        profileImage: user.profileImage
      }
    })

  } 
  catch (error) {
    console.log(error);
    return res.json({success:false, message:error.message})
  }
}

export {registerUser, loginUser , adminLogin, getUserDetails, updateUserProfile}