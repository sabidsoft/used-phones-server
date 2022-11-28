// import modules
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY)

// declaring variables
const app = express()
const port = process.env.PORT || 5000
const client = new MongoClient(process.env.DATABASE, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 })

// using middlewares
app.use(cors())
app.use(express.json())

// veryfyJWT middleware
const veryfyJWT = (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).send({ success: false, message: 'Unaothorized access!' })
    }

    const token = authHeader.split(' ')[1]
    jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
        if (err) {
            return res.status(403).send({ success: false, message: 'Forbidden access!' })
        }
        req.decoded = decoded
        next()
    })
}

const run = async () => {
    try {
        const brandsCollection = client.db('usedPhones').collection('brands')
        const phonesCollection = client.db('usedPhones').collection('phones')
        const usersCollection = client.db('usedPhones').collection('users')
        const bookingsCollection = client.db('usedPhones').collection('bookings')
        const paymentsCollection = client.db('usedPhones').collection('payments')
        const advertisedItemsCollection = client.db('usedPhones').collection('advertisedItems')

        // generate jwt
        app.get('/jwt', async (req, res) => {
            const email = req.query.email
            const query = { email: email }
            const user = await usersCollection.findOne(query)

            if (user) {
                const token = jwt.sign({ email }, process.env.SECRET_KEY, { expiresIn: '365d' })
                return res.send({ token })
            }

            res.status(403).send({ token: '' })
        })

        // veryfyAdmin middleware
        const veryfyAdmin = async (req, res, next) => {
            const decodedEmail = req.decoded.email
            const query = { email: decodedEmail }
            const user = await usersCollection.findOne(query)
            if (user?.role !== 'admin') {
                return res.status(403).send({ success: false, message: 'Forbidden access!' })
            }
            next()
        }

        // Payment Intension
        app.post('/create-payment-intent', async (req, res) => {
            const booking = req.body
            const resalePrice = booking.resalePrice
            const amount = resalePrice * 100 // Doller to Cent

            const paymentIntent = await stripe.paymentIntents.create({
                currency: 'usd',
                amount: amount,
                'payment_method_types': ['card']
            })
            res.send({ clientSecret: paymentIntent.client_secret })
        })

        // store payment data
        app.post('/payments', async (req, res) => {
            const payment = req.body
            const id = payment.bookingId
            const transactionId = payment.transactionId
            const query = { _id: ObjectId(id) }
            const updateDoc = {
                $set: {
                    paid: true,
                    transactionId: transactionId
                }
            }

            await bookingsCollection.updateOne(query, updateDoc)
            await paymentsCollection.insertOne(payment)
            res.send({ soldPhoneId: id })
        })

        app.get('/brands', async (req, res) => {
            const query = {}
            const brands = await brandsCollection.find(query).toArray()
            res.send(brands)
        })

        app.get('/brands/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const brand = await brandsCollection.findOne(query)
            res.send(brand)
        })

        app.post('/phones', veryfyJWT, async (req, res) => {
            const phone = req.body
            const result = await phonesCollection.insertOne(phone)
            res.send(result)
        })

        app.get('/phones', async (req, res) => {
            const brand = req.query.brand
            const query = { brand: brand }
            const phones = await phonesCollection.find(query).toArray()
            const availablePhones = phones.filter(phone => phone.sales_status !== 'Sold')
            res.send(availablePhones)
        })

        app.patch('/phones', async (req, res) => {
            const phoneId = req.query.phoneId
            const query = { _id: ObjectId(phoneId) }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    sales_status: 'Sold'
                },
            }
            const result = await phonesCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

        app.get('/my-products', async (req, res) => {
            const email = req.query.email
            const query = { seller_email: email }
            const products = await phonesCollection.find(query).toArray()
            res.send(products)
        })

        app.delete('/my-products/:id', veryfyJWT, async (req, res) => {
            const id = req.params.id

            const query = { _id: ObjectId(id) }
            await phonesCollection.deleteOne(query)

            const anotherQuery = { phoneId: id }
            await advertisedItemsCollection.deleteOne(anotherQuery)

            res.send({ success: true, message: 'Deleted successfully!' })
        })

        app.post('/users', async (req, res) => {
            const users = req.body

            const query = { email: users.email }
            const user = await usersCollection.findOne(query)
            if (user) {
                return res.send({ success: true, message: 'Old user!' })
            }

            const result = await usersCollection.insertOne(users)
            res.send(result)
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body
            const result = await bookingsCollection.insertOne(booking)
            res.send(result)
        })

        app.get('/bookings', veryfyJWT, async (req, res) => {
            const email = req.query.email
            const decodedEmail = req.decoded.email

            if (email !== decodedEmail) {
                return res.status(403).send({ success: false, message: 'Forbidden access!' })
            }

            const query = { userEmail: email }
            const bookings = await bookingsCollection.find(query).toArray()
            res.send(bookings)
        })

        app.get('/bookings/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: ObjectId(id) }
            const booking = await bookingsCollection.findOne(query)
            res.send(booking)
        })

        app.post('/advertised-items', async (req, res) => {
            const product = req.body
            const result = await advertisedItemsCollection.insertOne(product)
            res.send(result)
        })

        app.get('/advertised-items', async (req, res) => {
            const query = {}
            const products = await advertisedItemsCollection.find(query).toArray()
            const availableProducts = products.filter(phone => phone.sales_status !== 'Sold')
            res.send(availableProducts)
        })

        app.patch('/advertised-items', async (req, res) => {
            const phoneId = req.query.phoneId
            const query = { phoneId: phoneId }
            const options = { upsert: true }
            const updateDoc = {
                $set: {
                    sales_status: 'Sold'
                },
            }
            const result = await advertisedItemsCollection.updateOne(query, updateDoc, options)
            res.send(result)
        })

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