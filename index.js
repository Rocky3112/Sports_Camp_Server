const express =require('express')
const app = express()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000
const cors = require('cors');
require('dotenv').config()
//middleware
app.use(cors())
app.use(express.json())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.xn4aldo.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("sportsCamp").collection("classes");
    const instractorsCollection = client.db("sportsCamp").collection("instractors");
    const userCollection = client.db("sportsCamp").collection("users");

    app.get('/classes', async (req, res) => {
        const result = await classCollection.find().toArray();
        res.send(result);
      });
    app.get('/instractors', async (req, res) => {
        const result = await instractorsCollection.find().toArray();
        res.send(result);
      });

      app.get('/users', async (req, res) => {
        const result = await userCollection.find().toArray();
        res.send(result);
      });

      app.post('/users', async (req, res) => {
        const user = req.body;
        const query = { email: user.email }
        const previousUser = await userCollection.findOne(query);
  
        if (previousUser) {
          return res.send({ message: 'user already exists' })
        }
  
        const result = await userCollection.insertOne(user);
        res.send(result);
      });
      
      app.patch('/users/admin/:id', async (req, res) => {
        const userId = req.params.id;
        const filter = { _id: new ObjectId(userId) };
        const updateDoc = {
          $set: {
            role: 'admin'
          },
        };
  
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
  
      })
  
  

    
  
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Simple crud is running')
})

app.listen(port, () => {
  console.log(`Simple crud is running on port ${port}`)
})

