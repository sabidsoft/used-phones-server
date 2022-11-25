// import modules
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb')

// declaring variables
const app = express()
const port = process.env.PORT || 5000
const client = new MongoClient(process.env.DATABASE, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })

// using middlewares
app.use(cors())
app.use(express.json())

const run = async () => {
    try {
        
    }
    finally { }
}

run().catch(err => console.log(err))

app.get('/', (req, res) => {
    res.send({ success: true, message: 'Server is running!' })
})

// app listening
app.listen(port, () => {
    console.log(`Server is listening on port ${port}`)
})