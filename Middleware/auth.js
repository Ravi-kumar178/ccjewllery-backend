// original auth middleware (commented out):
// import jwt from 'jsonwebtoken'
//
// const authUser = async(req,res,next) => {
//     const {token} = req.headers;
//     
//     if(!token){
//         return res.json({success:false, message:"Not authorized, Login again"})
//     }
//
//     try {
//         const token_decode = jwt.verify(token,process.env.JWT_SECRET)
//         req.body.userId = token_decode.id 
//         next();
//     } 
//     catch (error) {
//         console.log(error)
//         return res.json({success:false, message:error.message})
//     }
// }
//
// export default authUser

// authentication middleware disabled — bypassing token checks per request
const authUser = async (req, res, next) => {
  // when authentication is disabled, allow all requests and
  // do not set `req.body.userId`.
  return next();
}

export default authUser