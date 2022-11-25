// import modules
require('dotenv').config()
const express = require('express')
const cors = require('cors')

// declaring variables
const app = express()
const port = process.env.PORT || 5000

// using middlewares
app.use(cors())
app.use(express.json())

app.get('/', (req, res) => {
    res.send({ success: true, message: 'Server is running!' })
})

// app listening
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})