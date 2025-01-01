import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs'
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
// console.log("Configuring Cloudinary...");
// console.log("CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME);
// console.log("CLOUDINARY_API_KEY:", process.env.CLOUDINARY_API_KEY);
// console.log("CLOUDINARY_API_SECRET:", process.env.CLOUDINARY_API_SECRET);
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadImageOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null
        // upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        // console.log(`File uploaded successfully to cloudinary, ${response.url}`);
        // console.log("this is response", response);
        fs.unlinkSync(localFilePath)
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temporary file as the file upload failed
        console.error('Error uploading file to cloudinary:', error);
        return null
    }
}

export { uploadImageOnCloudinary }


