import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();
// CONFIG DE CONEXÃO
const server = express();
server.use(cors());
server.use(express.json());

const cliente = new MongoClient(process.env.URI_MONGO);
let db;

cliente.connect().then(() => {
    db = cliente.db('batepapo');
});

//ESQUEMAS DE VALIDAÇÃO
const userSchema = joi.object({
    name: joi.string().required()
})

server.get("/participants", async (req, res) => {
    try {
        const usuarios = await db.collection('users').find().toArray();
        res.send(usuarios);
    } catch (error) {
        res.sendStatus(422);
    }
});

server.post("/participants", async (req, res) => {
    const user = req.body;

    const validation = userSchema.validate(req.body, { abortEarly: true });
    if(validation.error){
        console.log(validation.error);
        return sendStatus(422);
    }

    const  verificaUser = await db.collection('users').findOne(user);
    console.log(verificaUser)
    //CONDIÇÃO PARA NÃO 
    if (verificaUser) {
        res.sendStatus(409);
        return;
    }

    try {
        await db.collection('users').insertOne({ ...user, lastStatus: Date.now() });
        res.send("Cadastrado");
        await db.collection("messages").insertOne({
            from: user.name, 
            to: 'Todos', 
            text: 'entra na sala...', 
            type: 'status', 
            time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);
    } catch (error) {
        return res.status(401);
    }
});

server.get("/participants", async (req, res) => {
    try {
        const usersList = await db.collection("users").find().toArray();
        res.send(usersList);
    } catch (error) {
        return res.status(401).send("Não foi possível encontrar os participantes");
    }
})


server.listen(5000);
