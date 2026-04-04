import { UserData } from "../types/core_types";

export interface Session{
    sid:string;
    username:string;
    createdAt:number;
}

const sessions = new Map<string,Session>();

export function createSession(sid:string,username:string){
    const session:Session = {
        sid,
        username,
        createdAt:Date.now()
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