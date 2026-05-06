import { Server, Socket } from "socket.io";
import { verifyToken } from "../core/tokens";
import { _getSessions, createSession, deleteSession } from "../core/sessions";
import { deleteFile, fileExists, readBinary, writeBinary, writeFolder } from "../core/files";
import { BlockStateType, CB, CommonSerializedData, ServerCursorLoc, HistChange, Ret_M_AddChange, Ret_M_CheckUpdate, Ret_M_CheckUpdateType, Ret_M_SetBlockState } from "../types/core_types";
import { _getFileMap, registerCloseFile, registerOpenFile, removeSessionFromAllFiles, wsKey } from "../core/fileRegistry";
import { prepareRestart } from "./restart";
import { getUser, saveJSON } from "../storage/json";
import { loadUser, updateUser } from "../core/users";
import { getTmpFile, getWorkspaceNames, getWorkspacePermissions, listWorkspaces, loadWorkspace, removeTmpFilesForWS } from "../core/workspaces";
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
            let username = socket.session.username;

            let keys = Object.keys(socket.session.openFiles);
            for(const id of keys){
                // const f = socket.session.openFiles[id];
                
                const [owner,wid,path] = id.split(":");
                // const f = getTmpFile(owner,wid,path);
                // if(f){
                    // f.viewers.delete(username); // <-- remove you from the list of viewers of all your opened files when you disconnect
                    // ^^^ - or should we just use registerCloseFile here? maybe oh... -- we want it to emit out
                // }
                registerCloseFile(socket.session,owner,wid,path,socket);
            }
            
            removeSessionFromAllFiles(socket.session,socket);
            deleteSession(socket.id);
            
            // vvv - TODO: need to keep track of everyone that is in here and then decache when no one is online anymore
            // getWorkspaceNames(username).then(v=>{
            //     for(const c of v){
            //         removeTmpFilesForWS(username,c);
            //     }
            // });
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
        workspaceOp(socket,"m_addChange",async (data:WorkspaceOpData & {t?:number,change?:HistChange,way?:"undo"|"redo",preStates?:[number,CommonSerializedData][],id?:string,lastId?:string,parBid?:number,ind?:number,loc?:ServerCursorLoc})=>{
            console.log("-- m_addChange",data.t,data.change,data.id);
            
            if(data.t == undefined) return;
            if(!data.change) return;
            if(data.way == undefined) data.way = "redo"; // redo is normal way
            if(!data.preStates) data.preStates = [];
            if(!valStr(data.id)) throw new Error("Id's not valid or missing");
            if(!data.loc) throw new Error("Cursor loc missing");
            if(data.loc.partBid == undefined || data.loc.partSi == undefined) throw new Error("Cursor loc invalid");

            if(data.parBid == undefined) throw new Error("missing parBid");
            if(data.ind == undefined) throw new Error("missing ind");

            const perm = await getWorkspacePermissions(data.owner,data.wid,socket.session.username);
            if(!perm?.edit) throw new Error("No permission to edit");
            const w = await loadWorkspace(data.owner,data.wid,socket.session.username);
            if(!w) throw new Error("Can't find workspace");

            // DEBUG: super slowdown for requests
            if(false) await new Promise<void>(resolve=>{
                setTimeout(()=>{
                    resolve();
                },Math.ceil(Math.random()*1000));
            });
            // await new Promise<void>(resolve=>{
            //     setTimeout(()=>{
            //         resolve();
            //     },Math.ceil(Math.random()*40));
            // });

            // STORE in the TMP file cache for now
            let isRemove = (data.change.mode == "remove" && data.way == "redo") || (data.change.mode == "create" && data.way == "undo");
            let tmpFile = getTmpFile(data.owner,data.wid,data.path);
            let existingTmp = tmpFile.doc.blocks.get(data.change.bid);
            if(existingTmp ? (data.change.state.tm > existingTmp.state.tm) : true){ // the timestamp of this event has to be greater? (data.t) or what about the state data? (change.state.tm)
                if(isRemove){
                    tmpFile.doc.blocks.delete(data.change.bid);
                }
                else{
                    tmpFile.doc.blocks.set(data.change.bid,{
                        bid:data.change.bid,
                        state:data.change.state,
                        parBid:data.parBid,
                        ind:data.ind
                    });
                }
            }
            // 

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
                lastId:data.lastId,

                loc:data.loc,
            } satisfies Ret_M_AddChange);
        });
        workspaceOp<Ret_M_CheckUpdate>(socket,"m_checkUpdate",async (data:WorkspaceOpData & {
            t?:number;
            bid?:number;
            parBid?:number;
            ind?:number;
            prevBid?:number;
            nextBid?:number;
        })=>{
            // 
            if(data.t == undefined) return;
            if(data.bid == undefined) throw new Error("bid is missing");
            // if(data.parBid == undefined) throw new Error("parBid is missing");
            if(data.ind == undefined) throw new Error("ind is missing");
            // if(data.prevBid == undefined) throw new Error("prevBid is missing");
            // if(data.nextBid == undefined) throw new Error("nextBid is missing");
            
            // perm
            const perm = await getWorkspacePermissions(data.owner,data.wid,socket.session.username);
            if(!perm?.edit) throw new Error("No permission to edit");
            const w = await loadWorkspace(data.owner,data.wid,socket.session.username);
            if(!w) throw new Error("Can't find workspace");

            // 

            let tmpFile = getTmpFile(data.owner,data.wid,data.path);
            let existingTmp = tmpFile.doc.blocks.get(data.bid);
            if(!existingTmp){
                return {
                    list:[
                        {
                            bid:data.bid,
                            type:"remove"
                        }
                    ]
                };
            }
            else{
                let list:Ret_M_CheckUpdateType[] = [];
                if(data.parBid == undefined){
                    // let's go try to find it...
                    let bid = data.bid;
                    let par = [...tmpFile.doc.blocks.entries()].find(([k,v])=>{
                        if(!("c" in v.state)) return false;
                        if(!v.state.c) return false;

                        return v.state.c.includes(bid);
                    });

                    if(par){
                        data.parBid = par[0];
                        let d = par[1];
                        list.push({
                            bid:par[0],
                            type:"data",
                            ind:d.ind,
                            parBid:d.parBid,
                            state:d.state
                        });
                    }
                }
                
                if(data.t < existingTmp.state.tm){
                    list.push({
                        bid:data.bid,
                        type:"data",
    
                        ind:existingTmp.ind,
                        parBid:existingTmp.parBid,

                        state:existingTmp.state
                    });
                }

                return {
                    list
                };
            }
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
            let id = wsKey(data.owner,data.wid,data.path);
            socket.session.openFiles[id] = {
                lastSaved:-1,
                saved:data.saved ?? true
            };
            registerOpenFile(socket.session,data.owner,data.wid,data.path,socket);

            let room = "file:"+id;
            socket.join(room);
        });
        workspaceOp(socket,"file:close",async (data)=>{
            let id = wsKey(data.owner,data.wid,data.path);
            delete socket.session.openFiles[id];
            registerCloseFile(socket.session,data.owner,data.wid,data.path,socket);

            let room = "file:"+id;
            socket.leave(room);
        });
        workspaceOp(socket,"file:saveChange",async (data:WorkspaceOpData & {saved?:boolean,t?:number})=>{
            if(data.saved == undefined) throw new Error("missing saved");
            if(data.t == undefined) throw new Error("missing timestamp");
            
            let id = wsKey(data.owner,data.wid,data.path);
            const v = socket.session.openFiles[id];
            if(!v) throw new Error("file didn't exist");
            v.saved = data.saved ?? false;

            let room = "file:"+id;
            socket.to(room).emit("saveChange",{
                owner:data.owner,
                wid:data.wid,
                path:data.path,
                byUid:socket.session.username,
                saved:v.saved,
                t:data.t ?? 0
            });
        });
        workspaceOp(socket,"file:view",async (data:WorkspaceOpData & {saved?:boolean})=>{
            
        });

        // 
    });

    return io;
}