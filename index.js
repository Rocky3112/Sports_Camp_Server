const express = require("express");
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const nodemailer = require("nodemailer");
const mg = require("nodemailer-mailgun-transport");

const stripe = require("stripe")(process.env.Payment_Secret_Key);
//middleware
app.use(cors());
app.use(express.json());
//for payment

//send mail for confirm to successful payment
// let transporter = nodemailer.createTransport({
//   host: "smtp.sendgrid.net",
//   port: 587,
//   auth: {
//     user: "apikey",
//     pass: process.env.SENDGRID_API_KEY,
//   },
// });
const auth = {
  auth: {
    api_key: process.env.EMAIL_PRIVATE_KEY,
    domain: process.env.EMAIL_DOMAIN,
  },
};

const transporter = nodemailer.createTransport(mg(auth));

const sendPaymentconfirmationEmail = (payment) => {
  transporter.sendMail(
    {
      from: "alomgirhossainrocky@gmail.com", // verified sender email
      to: "alomgirhossainrocky@gmail.com", // recipient email
      subject: "Your order is confirmed.Enjoy the food", // Subject line
      text: "Hello world!", // plain text body
      html: `
        <div>
          <h2>Payment confrimed!!!</h2>
        </div>
        `, // html body
    },
    function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    }
  );
};

//verify jwt
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "access denied for unauthorized" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "access denied for unauthorized" });
    }

    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xn4aldo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("sportsCamp").collection("classes");
    const instractorsCollection = client
      .db("sportsCamp")
      .collection("instractors");
    const userCollection = client.db("sportsCamp").collection("users");
    const selectCollection = client.db("sportsCamp").collection("selects");
    const paymentCollection = client.db("sportsCamp").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2h",
      });

      res.send({ token });
    });
    app.get("/classes", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });
    app.get("/instractors", async (req, res) => {
      const result = await instractorsCollection.find().toArray();
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user already exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //delete
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    app.patch("/users/admin/:id", async (req, res) => {
      const userId = req.params.id;
      const filter = { _id: new ObjectId(userId) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //for select classes
    app.post("/selects", async (req, res) => {
      const cls = req.body;
      const result = await selectCollection.insertOne(cls);
      res.send(result);
    });

    //get selected class
    app.get("/selects", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await selectCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/selects/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectCollection.deleteOne(query);
      res.send(result);
    });

    //create payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });
    //for payment info

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertTesult = await paymentCollection.insertOne(payment);
      const query = {
        _id: { $in: payment.cartItems.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);
      //send an email
      sendPaymentconfirmationEmail(payment);
      res.send({ insertTesult, deleteResult });
    });

    //find for admin home page

    app.get("/admin-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const products = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();

      // best way to get sum of the price field is to use group and sum operator
      /*
          await paymentCollection.aggregate([
            {
              $group: {
                _id: null,
                total: { $sum: '$price' }
              }
            }
          ]).toArray()
        */

      const payments = await paymentCollection.find().toArray();
      const revenue = payments.reduce((sum, payment) => sum + payment.price, 0);

      res.send({
        revenue,
        users,
        products,
        orders,
      });
    });

    //find every item data
    app.get("/order-stats", verifyJWT, verifyAdmin, async (req, res) => {
      const pipeline = [
        {
          $lookup: {
            from: "menu",
            localField: "menuItems",
            foreignField: "_id",
            as: "menuItemsData",
          },
        },
        {
          $unwind: "$menuItemsData",
        },
        {
          $group: {
            _id: "$menuItemsData.category",
            count: { $sum: 1 },
            total: { $sum: "$menuItemsData.price" },
          },
        },
        {
          $project: {
            category: "$_id",
            count: 1,
            total: { $round: ["$total", 2] },
            _id: 0,
          },
        },
      ];

      const result = await paymentCollection.aggregate(pipeline).toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Simple crud is running");
});

app.listen(port, () => {
  console.log(`Simple crud is running on port ${port}`);
});
