import { dirname, join, normalize, resolve } from "path";
import { workspaceDir } from "../storage/paths";
import { getWorkspacePermissions } from "./workspaces";
import fs from "fs/promises";
import p from "path";

export function validatePath(path:string){
    if(path == undefined) throw new Error("Missing path");
    if(path.includes("..")) throw new Error("Invalid path");
    if(path.startsWith("/")) throw new Error("Invalid path");
    if(path.startsWith("__umm__")) throw new Error("Reserved path");
}

/**
 * @throws
 */
export function resolveWorkspacePath(username:string,wid:string,path:string){
    validatePath(path); // throws errors if invalid

    const base = workspaceDir(username,wid);
    const full = normalize(join(base,path));

    if(!full.startsWith(base)) throw new Error("Path escapes workspace");

    return full;
}

async function validateReadWriteFile(op:"read"|"write",username:string,wid:string,openerUsername:string,path:string){
    const full = resolveWorkspacePath(username,wid,path);
    const perm = await getWorkspacePermissions(username,wid,openerUsername);

    if(op == "read" && !perm.view) throw new Error("No permission to read");
    if(op == "write" && !perm.edit) throw new Error("No permission to write");

    return full;
}
export async function readJSON(username:string,wid:string,openerUsername:string,path:string){
    const full = await validateReadWriteFile("read",username,wid,openerUsername,path);
    const raw = await fs.readFile(full,"utf8");
    return JSON.parse(raw);
}

export async function readBinary(username:string,wid:string,openerUsername:string,path:string){
    const full = await validateReadWriteFile("read",username,wid,openerUsername,path);
    return await fs.readFile(full);
}
export async function writeBinary(username:string,wid:string,openerUsername:string,path:string,data:Uint8Array){
    const full = await validateReadWriteFile("write",username,wid,openerUsername,path);
    await fs.mkdir(dirname(full),{recursive:true});
    await fs.writeFile(full,data);
}
export async function writeFolder(username:string,wid:string,openerUsername:string,path:string){
    const full = await validateReadWriteFile("write",username,wid,openerUsername,path);
    await fs.mkdir(full,{recursive:true});
}
export async function deleteFile(username:string,wid:string,openerUsername:string,path:string){
    const full = await validateReadWriteFile("write",username,wid,openerUsername,path);
    const par = p.parse(full);
    // await fs.unlink(full);
    console.log("DEBUG",path,par);
    await fs.mkdir(join(par.dir,"__umm__deleted"),{recursive:true});
    await fs.rename(p.resolve(full),join(par.dir,"__umm__deleted",par.base));
    console.log("success?",p.resolve(full),join(par.dir,"__umm__deleted",par.base));
}
// export async function deleteFolder(username:string,wid:string,openerUsername:string,path:string){
//     const full = await validateReadWriteFile("write",username,wid,openerUsername,path);
//     const par = p.parse(full);
//     // await fs.rmdir(full); // <-- careful!
//     await fs.mkdir(join(par.dir,"__umm__deleted"));
//     await fs.rename(full,join(par.dir,"__umm__deleted",par.base));
// }
export async function fileExists(username:string,wid:string,openerUsername:string,path:string){
    const full = await validateReadWriteFile("write",username,wid,openerUsername,path);
    await fs.stat(full);
}
