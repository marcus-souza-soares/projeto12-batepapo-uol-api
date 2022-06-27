import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from 'joi';
import dayjs from 'dayjs';

dotenv.config();

const cliente = new MongoClient(process.env.URI_MONGO);
let db;

cliente.connect().then(() => {
    db = cliente.db('batepapo');
});
// CONFIG DE CONEXÃO
const server = express();
server.use(cors());
server.use(express.json());


//ESQUEMAS DE VALIDAÇÃO
const userSchema = joi.object({
    name: joi.string().required()
})

const messageSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
})

//REQUISIÇÕES

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
    const validation = userSchema.validate(user, { abortEarly: true });
    if (validation.error) {
        console.log(validation.error);
        return res.sendStatus(422);
    }
    user.name = user.name.trim();

    const verificaUser = await db.collection('users').findOne({ ...user });
    //CONDIÇÃO PARA NÃO LOGAR COM UM USER DE MESMO NOME
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
});

server.post("/messages", async (req, res) => {
    const message = req.body;
    const from = req.headers.user;
    const validation = messageSchema.validate(message, { abortEarly: true });
    if (validation.error) {
        return res.status(422).send("Verifique os campos", validation.error);
    }
    try {
        //VERIFICAR SE O PARTICIPANTE EXISTE ANTES DO ENVIO DA MENSSAGEM
        const verificaUser = await db.collection('users').findOne({ name: from });
        console.log(verificaUser)
        if (!verificaUser) {
            return res.status(422).send("Você não está na sala! Verifique a conexão");
        }
        const messageToServer = {
            ...message,
            from,
            time: dayjs().format('HH:mm:ss')
        }
        await db.collection("messages").insertOne({ ...messageToServer });
        res.sendStatus(201);
    } catch (error) {
        return res.status(422).send("Verifique a conexão");
    }
});

server.get("/messages", async (req, res) => {
    const limit = parseInt(req.query.limit);
    const user = req.headers.user;

    try {
        const messagesDB = await db.collection("messages").find().toArray();
        const messagesDBtoUser = messagesDB.filter(message => {
            const { to, from, type } = message;
            if (to === "Todos" || to === user || from === user || type === "message") {
                return true;
            } else {
                return false;
            }
        });
        if (!limit || isNaN(limit)) {
            res.send(messagesDBtoUser);
        } else {
            res.send(messagesDBtoUser.slice(-limit))
        }
    } catch (error) {
        res.sendStatus(404);
    }
});
server.post("/status", async (req, res) => {
    const { user } = req.headers;
    try {
        const verificaUser = await db.collection('users').findOne({ name: user });
        if (!verificaUser) {
            return res.status(404).send("Você não está na sala! Verifique a conexão");
        }
        const now = Date.now();
        await db.collection("users").updateOne({ name: user }, { $set: { lastStatus: now } });
        res.sendStatus(200);
    } catch (error) {
        res.sendStatus(404);
    }
});

server.delete("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const { user } = req.headers;
    const { ID_DA_MENSAGEM } = req.params;
    console.log(ID_DA_MENSAGEM)
    try {
        const verify = await db.collection("messages").findOne({ _id: new ObjectId(`${ID_DA_MENSAGEM}`) })
        if (!verify) {
            return res.status(404).send("Não econtrado");
        }
        //CASO O HEADER NÃO SEJA O DONO DA MENSAGEM
        if (verify.from !== user) {
            return res.sendStatus(401);
        }
        await db.collection("messages").deleteOne({ _id: new ObjectId(`${ID_DA_MENSAGEM}`) });
        res.status(201).send("Deletado");
    } catch (error) {
        res.status(404).send("Deu erro");
    }
});

server.put("/messages/:ID_DA_MENSAGEM", async (req, res) => {
    const { user } = req.headers;
    console.log(user)
    const { ID_DA_MENSAGEM } = req.params;
    const message = req.body;
    const validation = messageSchema.validate(message, { abortEarly: true });
    if (validation.error) {
        return res.status(422).send("Verifique os campos", validation.error);
    }
    try {
        //VERIFICAR SE O PARTICIPANTE EXISTE ANTES DO ENVIO DA MENSSAGEM
        const verificaUser = await db.collection('users').findOne({ name: user });
        console.log(verificaUser)
        if (!verificaUser) {
            return res.status(422).send("Você não está na sala! Verifique a conexão");
        }
        const { to, text, type } = message;
        // const messageModified = {
        //     ...message,
        //     from,
        //     time: dayjs().format('HH:mm:ss')
        // }
        const verify = await db.collection("messages").findOne({ _id: new ObjectId(`${ID_DA_MENSAGEM}`) })
        console.log(verify)
        console.log(user)
        if (!verify) {
            return res.status(404).send("Não econtrado");
        }
        //CASO O HEADER NÃO SEJA O DONO DA MENSAGEM
        if (verify.from !== user) {
            return res.sendStatus(401);
        }
        await db.collection("messages").updateOne(
            {
                _id: verify.id
            },
            {
                $set: {
                    to: to,
                    text: text,
                    type: type,
                    time: dayjs().format('HH:mm:ss')
                }
            })
    } catch (error) {
        return res.status(404).send("Não foi possivel enviar");
    }
});



setInterval(async () => {
    const now = Date.now();
    try {
        const disabledUsers = await db.collection("users").find({ lastStatus: { $lt: (now - (10 * 1000)) } }).toArray();
        if (disabledUsers.length > 0) {
            console.log(disabledUsers)
        }
        await db.collection("users").deleteMany({ lastStatus: { $lt: (now - (10 * 1000)) } });
        console.log("deletou!")
        if (disabledUsers.length > 0) {
            const exitMessages = disabledUsers.map(user => {
                return {
                    from: user.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjs().format("HH:mm:ss")
                }
            });
            await db.collection("messages").insertMany(exitMessages);
        }
    } catch (error) {
        console.log("Não foi possível remover usuários inativos!")
    }
}, 15000);
server.listen(5000);
