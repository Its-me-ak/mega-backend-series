import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadImageOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandler(async (req, res) => {
    // STEP FOR REGISTERING USER
    // get user details from frontend
    // add validation - no empty field
    // check if user is already exists - username, email
    // check for images, check for avatar
    // upload image and avatar to cloudinary, avatar uploaded check
    // create user object - create enrty in DB
    // remove password and refersh token field from response
    // check for user creation
    // return response
    const { fullname, email, username, password } = req.body
    console.log(fullname);
    console.log(req.body);

    // Check for empty fields
    if ([fullname, email, username, password].some((field) => field?.trim() === '')) {
        throw new ApiError(400, "All fields are required");
    }

    // Validate that email contains '@'
    if (!email.includes("@")) {
        throw new ApiError(400, "Invalid email: '@' symbol missing in email address");
    }

    // Check is user already exist or not
    const existingUser = await User.findOne({
        $or: [{ username }, { email }]
    });
    console.log(existingUser);


    if (existingUser) {
        throw new ApiError(409, "Username or Email already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    console.log(avatarLocalPath);

    const coverImageLocalPath = req.files?.coverImage[0]?.path
    console.log(coverImageLocalPath);

    // check if avatarLocalPath is not exist
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // now uploading to cloudinary
    const avatar = await uploadImageOnCloudinary(avatarLocalPath)
    const coverImage = await uploadImageOnCloudinary(coverImageLocalPath)

    // check if avatar is not available
    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user = await User.create({
        fullname,
        email,
        username,
        password,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
    })

   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )

   if(!createdUser){
    throw new ApiError(500, "something went while registering the user")
   }

   return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
   )

})

export { registerUser }