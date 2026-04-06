import { Session } from "./sessions";

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

function key(owner:string,wid:string,path:string){
    return `${owner}:${wid}:${path}`;
}

export function registerOpenFile(session:Session,owner:string,wid:string,path:string){
    const k = key(owner,wid,path);

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
}

export function registerCloseFile(session:Session,owner:string,wid:string,path:string){
    const k = key(owner,wid,path);
    const entry = fileMap.get(k);
    if(!entry) return;

    entry.sessions.delete(session);
    if(entry.sessions.size == 0){
        fileMap.delete(k);
    }
}

export function getSessionsForFile(owner:string,wid:string,path:string){
    const k = key(owner,wid,path);
    const entry = fileMap.get(k);
    return entry ? [...entry.sessions] : [];
}

export function removeSessionFromAllFiles(session:Session){
    for(const entry of fileMap.values()){
        registerCloseFile(session,entry.owner,entry.wid,entry.path); // <-- probably ok to reuse for now
    }
}