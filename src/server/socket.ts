import { Server } from "socket.io";
import { verifyToken } from "../core/tokens";
import { createSession, deleteSession } from "../core/sessions";

export function attachSocketIO(httpServer:Express.Application){
    const io = new Server(httpServer,{
        cors:{
            origin:"*",
            methods:["GET","POST","PUT","DELETE","OPTIONS","PATCH"]
        },
        maxHttpBufferSize:1e7
    });

    io.use((socket,next)=>{
        const token = socket.handshake.auth?.token;
        if(!token) return next(new Error("Missing token"));

        const data = verifyToken(token);
        if(!data) return next(new Error("Invalid token"));

        const session = createSession(socket.id,data.username);
        if(!session) return next(new Error("Failed to create session"));
        socket.session = session;
        
        next();
    });

    io.on("connection",socket=>{
        console.log("connection",socket.session.username);

        socket.on("disconnect",()=>{
            deleteSession(socket.id);
        });

        socket.on("test",()=>{
            console.log("hi",socket.session);
        });
    });

    return io;
}