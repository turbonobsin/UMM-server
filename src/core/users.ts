import fs from "fs/promises";
import { userDir, userFile } from "../storage/paths";
import { loadJSON, saveJSON } from "../storage/json";
import { hashPassword, verifyPassword } from "./auth";
import { migrateUser } from "../storage/migrations/user";
import { UserMeta } from "../types/core_types";

export async function userExists(username:string){
    try{
        await fs.access(userDir(username));
        return true;
    }
    catch{
        return false;
    }
}

/**
 * @throws
 */
export async function createUser(username:string,displayName:string,password:string){
    if(await userExists(username)){
        throw new Error("User already exists");
    }

    await fs.mkdir(userDir(username),{recursive:true});

    const data:UserMeta = {
        v:1,
        username,
        displayName,
        passwordHash:await hashPassword(password),
        createdAt:Date.now(),
        lastLogin:Date.now(),
        friends:[],
        icon:{},
        tokens:[],
        externalWorkspaces:[]
    };

    await saveJSON(userFile(username),data);
    return data;
}

export async function loadUser(username:string):Promise<UserMeta>{
    const data = await loadJSON<UserMeta>(userFile(username));
    return migrateUser(data);
}

export async function loginUser(username:string,password:string){
    if(!await userExists(username)){
        throw new Error("User not found");
    }

    const user = await loadUser(username);
    if(!user){
        throw new Error("Failed to load user");
    }

    const ok = await verifyPassword(user.passwordHash,password);
    if(!ok) throw new Error("Invalid password");

    user.lastLogin = Date.now();
    await saveJSON(userFile(username),user);

    return user;
}

export async function updateUser(username:string,updates:Partial<UserMeta>){
    const path = userFile(username);
    const user = await loadJSON<UserMeta>(path);

    const updated = {
        ...user,
        ...updates
    };
    
    await saveJSON(path,updated);

    return updated;
}