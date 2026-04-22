import { Server, Socket } from "socket.io";
import { verifyToken } from "../core/tokens";
import { _getSessions, createSession, deleteSession } from "../core/sessions";
import { deleteFile, fileExists, readBinary, writeBinary, writeFolder } from "../core/files";
import { BlockStateType, CB, CommonSerializedData, HistChange, Ret_M_AddChange, Ret_M_SetBlockState } from "../types/core_types";
import { _getFileMap, registerCloseFile, registerOpenFile, removeSessionFromAllFiles, wsKey } from "../core/fileRegistry";
import { prepareRestart } from "./restart";
import { getUser, saveJSON } from "../storage/json";
import { loadUser, updateUser } from "../core/users";
import { getWorkspacePermissions, loadWorkspace } from "../core/workspaces";
import { valStr } from "../storage/paths";

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

        // Multiplayer

        // workspaceOp(socket,"m_setBlockState",async (data:WorkspaceOpData & {timestamp?:number,states?:BlockStateType[]})=>{
        workspaceOp(socket,"m_setBlockState",async (data:WorkspaceOpData & {t?:number,states2?:HistChange[]})=>{
            console.log("-- m_setBlockState",data.t,data.states2);
            
            if(data.t == undefined) return;
            if(!data.states2) return;
            if(data.states2.length == 0) return;

            const perm = await getWorkspacePermissions(data.owner,data.wid,socket.session.username);
            if(!perm?.edit) throw new Error("No permission to edit");
            const w = await loadWorkspace(data.owner,data.wid,socket.session.username);
            if(!w) throw new Error("Can't find workspace");

            // for now...
            const room = "file:"+wsKey(data.owner,data.wid,data.path);
            socket.to(room).emit("m_setBlockState",{
                t:data.t,
                owner:data.owner,
                wid:data.wid,
                by:socket.session.username,
                // states:data.states,
                states:[],
                path:data.path,
                states2:data.states2
            } satisfies Ret_M_SetBlockState);
        }); 
        workspaceOp(socket,"m_addChange",async (data:WorkspaceOpData & {t?:number,change?:HistChange,way?:"undo"|"redo",preStates?:[number,CommonSerializedData][],id?:string,lastId?:string})=>{
            console.log("-- m_addChange",data.t,data.change,data.id);
            
            if(data.t == undefined) return;
            if(!data.change) return;
            if(data.way == undefined) data.way = "redo"; // redo is normal way
            if(!data.preStates) data.preStates = [];
            if(!valStr(data.id)) throw new Error("Id's not valid or missing");

            const perm = await getWorkspacePermissions(data.owner,data.wid,socket.session.username);
            if(!perm?.edit) throw new Error("No permission to edit");
            const w = await loadWorkspace(data.owner,data.wid,socket.session.username);
            if(!w) throw new Error("Can't find workspace");

            await new Promise<void>(resolve=>{
                setTimeout(()=>{
                    resolve();
                },Math.ceil(Math.random()*1000));
            });

            // for now...
            const room = "file:"+wsKey(data.owner,data.wid,data.path);
            socket.to(room).emit("m_addChange",{
                owner:data.owner,
                wid:data.wid,
                by:socket.session.username,
                path:data.path,

                t:data.t,
                change:data.change,
                way:data.way,
                preStates:data.preStates,
                id:data.id,
                lastId:data.lastId
            } satisfies Ret_M_AddChange);
        });

        // 

        workspaceOp(socket,"openWorkspace",async (data:WorkspaceOpData)=>{
            if(data.owner == socket.session.username) return; // <-- already yours
            const user = await loadUser(socket.session.username);
            if(user){
                if(user.externalWorkspaces.some(v=>v.owner == data.owner && v.wid == data.wid)) return; // <-- prevent duplicates
                user.externalWorkspaces.push({
                    owner:data.owner,
                    wid:data.wid
                });
                await updateUser(socket.session.username,{});
            }
        });

        workspaceOp(socket,"file:open",async (data:WorkspaceOpData & {saved?:boolean})=>{
            socket.session.openFiles[data.path] = {
                lastSaved:-1,
                saved:data.saved ?? true
            };
            registerOpenFile(socket.session,data.owner,data.wid,data.path);

            socket.join("file:"+wsKey(data.owner,data.wid,data.path));
        });
        workspaceOp(socket,"file:close",async (data)=>{
            delete socket.session.openFiles[data.path];
            registerCloseFile(socket.session,data.owner,data.wid,data.path);

            socket.leave("file:"+wsKey(data.owner,data.wid,data.path));
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