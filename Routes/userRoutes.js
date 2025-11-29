import express from 'express'
import { adminLogin, loginUser, registerUser, getUserDetails , updateUserProfile} from '../Controllers/userController.js'
import authUser from '../Middleware/auth.js';

const userRouter = express.Router();

userRouter.post('/register', registerUser);
userRouter.post('/login', loginUser);
userRouter.post('/admin', adminLogin);

//get user profile
userRouter.get('/profile',authUser,getUserDetails);
userRouter.put('/profile/update',authUser,updateUserProfile);

export default userRouter