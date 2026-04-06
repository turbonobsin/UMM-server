import { UserMeta } from "../types/core_types";

export interface OpenFile{
    saved:boolean;
    lastSaved:number;
}

export interface Session{
    sid:string;
    username:string;
    createdAt:number;

    openFiles:Record<string,OpenFile>;
    readyForRestart?:boolean;
}

const sessions = new Map<string,Session>();

export function _getSessions(){
    return sessions;
}

export function createSession(sid:string,username:string){
    const session:Session = {
        sid,
        username,
        createdAt:Date.now(),
        openFiles:{}
    };

    sessions.set(sid,session);
    return session;
}

export function getSession(sid:string){
    return sessions.get(sid);
}

export function deleteSession(sid:string){
    sessions.delete(sid);
}