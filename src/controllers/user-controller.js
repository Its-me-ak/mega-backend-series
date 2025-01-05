import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js"
import { uploadImageOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from 'jsonwebtoken'
import { v2 as cloudinary } from 'cloudinary';
import mongoose from "mongoose";

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

// change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body
    const user = await User.findById(req.user?._id)
    console.log(user);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect")
    }
    user.password = newPassword
    await user.save({
        validateBeforeSave: false
    })
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"))
})

// get current user
const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, req.user, "Current user found successfully"))
})

// update account details
const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullname, email } = req.body
    if (!fullname && !email) { // TODO check with || if not working
        throw new ApiError(400, "All fields are required")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        {
            new: true,
        }
    ).select("-password")
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        )
})

// update user avatar
const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }
    const avatar = await uploadImageOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Avatar uploading failed")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {
            new: true,
        }
    ).select("-password")
    // Delete old avatar image after uploading new avatar
    const oldAvatarUrl = user?.avatar
    console.log(oldAvatarUrl);
    if (oldAvatarUrl) {
        const oldAvatarPublicId = oldAvatarUrl.split('/').pop().split('.')[0];
        try {
            await cloudinary.uploader.destroy(oldAvatarPublicId);
        } catch (error) {
            console.error("Error deleting old avatar:", error);
        }
    }
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Avatar updated successfully")
        )

})

// update user coverImage
const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is required")
    }
    const coverImage = await uploadImageOnCloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "coverImage uploading failed")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {
            new: true,
        }
    ).select("-password")
    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Cover image upload successfully")
        )
})

// get the subscriber
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params
    if (!username?.trim()) {
        throw new ApiError(400, "Username is required")
    }
    const channel = User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                totalSubscriber: { $size: "$subscribers" },
                totalChannelsSubscribedTo: { $size: "$subscribedTo" },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                totalSubscriber: 1,
                totalChannelsSubscribedTo: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
            }
        }
    ])
    console.log(channel);
    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist")
    }
    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "User channel found successfully"))
})

// get user watch history
const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup:{
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields : {
                            // owner: { $arrayElemAt: ["$owner", 0] }
                            owner: {
                                $first: "$owner"
                             }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "User watch history successfully fetched"))
})

export { registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword, getCurrentUser, updateAccountDetails, updateUserAvatar, updateUserCoverImage, getWatchHistory }