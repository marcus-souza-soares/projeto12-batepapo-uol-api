import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const server = express();
server.use(cors());
server.use(express.json());

const cliente = new MongoClient(process.env.URI_MONGO);
let db;

cliente.connect().then(() => {
    db = cliente.db('batepapo');
})

server.post("/participants", async (req, res) => {
    const user = req.body;
    const _users = await db.collection('users').find().toArray();
    console.log(_users)
    //CONDIÇÃO PARA NÃO 
    _users.find(item => {
        if(item.name === user.name){
            res.sendStatus(422);
            return;
        }
    });
    try {
        await db.collection('users').insertOne(user);
        res.status(201).send("Cadastrado");
    } catch (error) {
        res.sendStatus(422);
    }
})

server.listen(5000);
