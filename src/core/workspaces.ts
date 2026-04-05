import { genId } from "../storage/ids";
import { userDir, workspaceDir, workspaceMeta } from "../storage/paths";
import { IconData, WorkspaceMeta as WorkspaceMeta, WorkspacePermissions } from "../types/core_types";
import fs from "fs/promises";
import { userExists } from "./users";
import { loadJSON, saveJSON } from "../storage/json";
import { join } from "path";

export async function workspaceExists(username:string,wid:string){
    try{
        await fs.access(workspaceDir(username,wid));
        return true;
    }
    catch{
        return false;
    }
}

/**
 * @throws
 */
export async function createWorkspace(data:Partial<WorkspaceMeta> & {username:string}){
    const username = data.username;
    if(!await userExists(username)) throw new Error("User doesn't exist");
    
    if(data.name) data.name = data.name.trim();

    if(data.name){
        if(data.name == "") throw new Error("Empty name");
    }

    data.name ??= "New Workspace "+new Date().toLocaleDateString([],{dateStyle:"short"});
    data.icon ??= {};
    
    let wid = "ws_" + genId(8);
    
    // while there's already a workspace with this id... keep generating new ones...
    while(await workspaceExists(username,wid)){
        wid = "ws_" + genId(8);
    }

    const dir = workspaceDir(username,wid);
    await fs.mkdir(dir,{recursive:true});

    const meta:WorkspaceMeta = {
        v:1,
        wid,
        name:data.name,
        icon:data.icon,
        owner:username,
        createdAt:Date.now(),
        lastOpened:Date.now()
    };

    await saveJSON(workspaceMeta(username,wid),meta);
    return meta;
}

export async function listWorkspaces(username:string):Promise<WorkspaceMeta[]>{
    const userWorkspaces = join(userDir(username),"workspaces");

    let dirs:string[];
    try{
        dirs = await fs.readdir(userWorkspaces);
    }
    catch{
        return [];
    }

    const metas:WorkspaceMeta[] = [];

    for(const wid of dirs){
        try{
            const meta = await loadJSON<WorkspaceMeta>(workspaceMeta(username,wid));
            metas.push(meta);
        }
        catch{
            // ignore invalid workspaces
        }
    }

    return metas;
}

export async function loadWorkspace(username:string,wid:string,fromUsername:string|undefined){
    if(fromUsername != undefined){
        let perm = await getWorkspacePermissions(username,wid,fromUsername);
        if(!perm.view) throw new Error("You don't have the *view* permission for this workspace");
    }

    return loadJSON<WorkspaceMeta>(workspaceMeta(username,wid));
}

export async function updateWorkspaceMeta(username:string,wid:string,fromUsername:string|undefined,updates:Partial<WorkspaceMeta>){
    if(fromUsername != undefined){
        let perm = await getWorkspacePermissions(username,wid,fromUsername);
        if(!perm.edit) throw new Error("You don't have the *edit* permission for this workspace");
    }
    
    const metaPath = workspaceMeta(username,wid);
    const meta = await loadJSON<WorkspaceMeta>(metaPath);

    // these properties are not changeable
    delete updates.v;
    delete updates.owner;
    delete updates.createdAt;
    delete updates.lastOpened;
    delete updates.wid;

    const updated = {
        ...meta,
        ...updates
    };

    await saveJSON(metaPath,updated);

    return updated;
}

/**
 * @throws
 */
export async function getWorkspacePermissions(ownerUsername:string,wid:string,openerUsername:string){
    const ws = await loadWorkspace(ownerUsername,wid,undefined); // <-- we want to get it temp to check (server authority)
    if(!ws) throw new Error("Workspace didn't exist");

    let perm:WorkspacePermissions = {
        edit:false,
        view:false
    };

    // for now...

    if(ws.owner == openerUsername){
        perm.view = true;
        perm.edit = true;
    }

    // 

    return perm;
}

/**
 * @throws
 */
export async function canOpenWorkspace(ownerUsername:string,wid:string,openerUsername:string){
    return (await getWorkspacePermissions(ownerUsername,wid,openerUsername)).view;
}