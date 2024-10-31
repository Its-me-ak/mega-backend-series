// eslint-disable-next-line no-unused-vars
import express from "express"
import cors from 'cors'
import cookieParser from "cookie-parser"

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({
    limit: '64kb'
}))
app.use(express.urlencoded({
    extended: true,
    limit: '64kb'
}))
app.use(express.static("public"))

app.use(cookieParser())

// importing routes
import userRouter from './routes/user.route.js'

// Route Declaration
app.use("/api/v1/users", userRouter)
// url generated for this route http://localhost:8000/api/v1/users/register


export { app }