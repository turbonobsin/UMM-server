import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const ROOT = dirname(fileURLToPath(import.meta.url));
export const DATA = join(ROOT,"..","..","data");

export const USERS = join(DATA,"users");

export function userDir(uid:string){
    return join(USERS,uid);
}

export function userFile(uid:string){
    return join(userDir(uid),"user.json");
}

export function workspaceDir(uid:string,wid:string){
    return join(userDir(uid),"workspaces",wid);
}

export function workspaceMeta(uid:string,wid:string){
    return join(workspaceDir(uid,wid),"__umm__ws.json");
}

export function checkPath(p:string|undefined,noSlashes=false){
    if(!p || p.includes("..")) return;
    if(noSlashes) if(p.includes("/")) return;
    return p;
}