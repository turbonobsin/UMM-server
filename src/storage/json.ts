import fs from "fs/promises";
import { userFile } from "./paths";
import { loadUser } from "../core/users";

export type CacheItem = any;

const cache = new Map<string,CacheItem>();

/**
 * @throws
 */
export async function loadJSON<T>(path:string,onNew?:(data:T,path:string)=>Promise<void>): Promise<T>{
    if(cache.has(path)) return cache.get(path);

    const raw = await fs.readFile(path,"utf8");
    const data = JSON.parse(raw);
    if(onNew) await onNew(data,path);
    cache.set(path,data);
    return data;
}

export async function saveJSON(path:string,data:CacheItem){
    cache.set(path,data);
    await fs.writeFile(path,JSON.stringify(data,null,2));
}

export async function getUser(username:string){
    const p = userFile(username);
    if(cache.has(p)) return cache.get(p);

    return await loadUser(username);
}