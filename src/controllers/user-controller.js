import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadImageOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({
            validateBeforeSave: false
        })
        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access or refresh token")
    }
}

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
    // console.log(fullname);
    // console.log("this is req body",req.body);

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
    // console.log(existingUser);


    if (existingUser) {
        throw new ApiError(409, "Username or Email already exists");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    // console.log("reg Files", req.files);
    // console.log(avatarLocalPath);
    // check if avatarLocalPath is not exist
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    // console.log(coverImageLocalPath);
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    // now uploading to cloudinary
    const avatar = await uploadImageOnCloudinary(avatarLocalPath)
    const coverImage = await uploadImageOnCloudinary(coverImageLocalPath)
    // console.log("avatar uploaded on cloudinary", avatar);


    // check if avatar is not available
    if (!avatar) {
        throw new ApiError(400, "Avatar upload failed");
    }

    const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "something went while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )

})

// Login User
const loginUser = asyncHandler(async (req, res) => {
    // console.log(req.body);

    // Steps for login user
    // req body - data
    // login user base on email or username
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const { email, username, password } = req.body

    // check either username or email
    if (!email && !username) {
        throw new ApiError(400, "Either email or username is required");
    }

    const user = await User.findOne({
        $or: [{ email }, { username }],
    })

    if (!user) {
        throw new ApiError(401, "user does not exist")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(401, "Invalid password");
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id)
        .select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser, accessToken, refreshToken
            }, "User logged in successfully")
        )

})

// logout user
const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully"))
})

// Refrseh Access Token
const refreshAccessToken = asyncHandler(async (req, res) => {
    const newCreatedRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    console.log(newCreatedRefreshToken);

    if (!newCreatedRefreshToken) {
        throw new ApiError(401, "Refresh token is missing")
    }
    
    try {
        const decodedToken = jwt.verify(newCreatedRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        console.log(decodedToken);
    
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "User not found")
        }
    
        if (!newCreatedRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is invalid or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
        const { accessToken, newRefreshToken } = await generateAccessTokenAndRefreshToken(user._id)
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(new ApiResponse(200, { accessToken, refreshToken: newRefreshToken }, "Access token refreshed successfully"))
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})


export { registerUser, loginUser, logoutUser, refreshAccessToken }