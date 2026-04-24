import { type Socket } from "socket.io";
import { Session } from "./sessions";
import { getTmpFile } from "./workspaces";

interface FileEntry{
    owner:string;
    wid:string;
    path:string;

    /**
     * These are the current user sessions viewing this workspace file
     */
    sessions:Set<Session>;
}

const fileMap = new Map<string,FileEntry>();

export function _getFileMap(){
    return fileMap;
}

export function wsKey(owner:string,wid:string,path:string){
    return `${owner}:${wid}:${path}`;
}

export function registerOpenFile(session:Session,owner:string,wid:string,path:string,socket:Socket){
    const k = wsKey(owner,wid,path);

    let entry = fileMap.get(k);
    if(!entry){
        entry = {
            owner,wid,path,
            sessions:new Set()
        };
        fileMap.set(k,entry);
    }

    // add your current session to this files list of sessions
    entry.sessions.add(session);
    
    // 
    let file = getTmpFile(owner,wid,path);
    if(file){
        file.viewers.add(session.username);
        socket.to("file:"+k).emit("userOpenedFile",{
            owner:owner,
            wid:wid,
            path:path,
            uid:session.username
        });
    }
}

export function registerCloseFile(session:Session,owner:string,wid:string,path:string,socket:Socket){
    const k = wsKey(owner,wid,path);
    const entry = fileMap.get(k);
    if(!entry) return;

    entry.sessions.delete(session);
    if(entry.sessions.size == 0){
        fileMap.delete(k);
    }

    // 
    let file = getTmpFile(owner,wid,path);
    if(file){
        file.viewers.delete(session.username);
        socket.to("file:"+k).emit("userClosedFile",{
            owner:owner,
            wid:wid,
            path:path,
            uid:session.username
        });
    }
}

export function getSessionsForFile(owner:string,wid:string,path:string){
    const k = wsKey(owner,wid,path);
    const entry = fileMap.get(k);
    return entry ? [...entry.sessions] : [];
}

export function removeSessionFromAllFiles(session:Session,socket:Socket){
    for(const entry of fileMap.values()){
        registerCloseFile(session,entry.owner,entry.wid,entry.path,socket); // <-- probably ok to reuse for now
    }
}