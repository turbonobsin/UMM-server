import { Server, Socket } from "socket.io";
import { verifyToken } from "../core/tokens";
import { _getSessions, createSession, deleteSession } from "../core/sessions";
import { deleteFile, fileExists, readBinary, writeBinary, writeFolder } from "../core/files";
import { CB } from "../types/core_types";
import { _getFileMap, registerCloseFile, registerOpenFile, removeSessionFromAllFiles } from "../core/fileRegistry";
import { prepareRestart } from "./restart";

type WorkspaceOpData = {
    owner:string;
    wid:string;
    path:string;
    data?:Uint8Array;
    type?:"file"|"folder";
};
function workspaceOp<T>(socket:Socket,id:string,cb2:(data:WorkspaceOpData)=>Promise<T|undefined|void>){
    socket.on(id,async (body:WorkspaceOpData,cb:CB)=>{
        try{
            let res = await cb2(body);
            cb([undefined,res]);
        }
        catch(e:any){
            cb([{
                code:400,
                msg:e.message
            },undefined]);
        }
    });
}

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
            removeSessionFromAllFiles(socket.session);
            deleteSession(socket.id);
        });

        socket.on("restart",()=>{
            if(socket.session.username == "claeb_") prepareRestart(io); // <-- for now lol
        });
        socket.on("status",()=>{
            const fileMap = _getFileMap();
            console.log("getting status...",fileMap.size);
            console.log("\n------ FILES");
            for(const entry of fileMap.values()){
                console.log(entry.path);
                console.log([...entry.sessions].map(v=>{
                    return " - "+v.username;
                    return {
                        // openFiles:Object.keys(v.openFiles),
                        // username:v.username,
                        // created:new Date(v.createdAt).toLocaleString([],{dateStyle:"short",timeStyle:"short"})
                    };
                }));
                console.log("");
            }

            console.log("\n\n------ SESSIONS");
            const sessions = _getSessions();
            for(const v of sessions.values()){
                console.log({
                    openFiles:Object.keys(v.openFiles).map(w=>{return{name:w,...v.openFiles[w]}}),
                    username:v.username,
                    created:new Date(v.createdAt).toLocaleString([],{dateStyle:"short",timeStyle:"short"})
                });
            }
        });

        // FILES
        
        workspaceOp<Uint8Array>(socket,"getFile",async (data)=>{
            const username = socket.session.username;
            return await readBinary(data.owner,data.wid,username,data.path);
        });
        workspaceOp<boolean>(socket,"writeFile",async (data)=>{
            if(!data.data) return;
            const username = socket.session.username;
            await writeBinary(data.owner,data.wid,username,data.path,data.data);
            return true;
        });
        workspaceOp<boolean>(socket,"deleteFile",async (data)=>{
            const username = socket.session.username;
            // v-- TODO: hmm maybe we should make this move to a trash instead?
            await deleteFile(data.owner,data.wid,username,data.path); 
            // if(data.type == "folder") await deleteFolder(data.owner,data.wid,username,data.path); 
            // else await deleteFile(data.owner,data.wid,username,data.path); 
            return true;
        });

        workspaceOp<boolean>(socket,"writeFolder",async (data)=>{
            const username = socket.session.username;
            await writeFolder(data.owner,data.wid,username,data.path); // <-- TODO: hmm maybe we should make this move to a trash instead?
            return true;
        });
        workspaceOp<boolean>(socket,"pathExists",async (data)=>{
            const username = socket.session.username;
            await fileExists(data.owner,data.wid,username,data.path);
            return true;
        });
        
        socket.on("saveFile",async ()=>{

        });
        socket.on("openFile",async ()=>{

        });
        socket.on("closeFile",async ()=>{

        });

        // 

        workspaceOp(socket,"file:open",async (data:WorkspaceOpData & {saved?:boolean})=>{
            socket.session.openFiles[data.path] = {
                lastSaved:-1,
                saved:data.saved ?? true
            };
            registerOpenFile(socket.session,data.owner,data.wid,data.path);
        });
        workspaceOp(socket,"file:close",async (data)=>{
            delete socket.session.openFiles[data.path];
            registerCloseFile(socket.session,data.owner,data.wid,data.path);
        });
        workspaceOp(socket,"file:saveChange",async (data:WorkspaceOpData & {saved?:boolean})=>{
            const v = socket.session.openFiles[data.path];
            v.saved = data.saved ?? false;
        });
        workspaceOp(socket,"file:view",async (data:WorkspaceOpData & {saved?:boolean})=>{
            
        });

        // 
    });

    return io;
}