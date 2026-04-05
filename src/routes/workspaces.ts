import { Request, Router } from "express";
import { auth } from "../server/middleware/auth";
import { createWorkspace, getWorkspacePermissions, listWorkspaces, loadWorkspace, updateWorkspaceMeta } from "../core/workspaces";
import { checkPath, isStr, queryOrDefault, valStr, workspaceDir } from "../storage/paths";
import { WorkspacePermissions } from "../types/core_types";
import fs from "fs/promises";
import { resolveWorkspacePath, validatePath } from "../core/files";
import express from "express";
import { join } from "path";
import { getSession } from "../core/sessions";

const router = Router();

router.post("/workspace/create",auth,async (req:Request,res)=>{
    if(!req.session) return; // <-- this won't ever happen so it's ok not to send back here -- this is just for typescript inference

    let {name,icon} = req.body;
    const username = req.session.username;

    name = queryOrDefault(name,"");
    name = name.trim();

    if(!name) return res.status(400).send("Empty Workspace name");

    try{
        const ws = await createWorkspace({
            username,
            name,icon
        });
        res.status(201).json({
            workspace:ws
        });
    }
    catch(err:any){
        res.status(400).send(err.message);
    }
});

router.get("/workspace/list",auth,async (req:Request,res)=>{
    if(!req.session) return;

    // let username = queryOrDefault(req.query.uid,req.session.username);
    let username = req.session.username;

    const list = await listWorkspaces(username);
    res.status(200).json({
        workspaces:list
    });
});

router.get("/workspace/:uid/:wid",auth,async (req:Request,res)=>{
    if(!req.session) return;

    const username = queryOrDefault(req.params.uid,""); // <-- bc you should be able to open someone else's workspace if you have permission
    const wid = queryOrDefault(req.params.wid,"");

    if(!username || !wid) return res.status(400).send("Invalid data");

    // validate permission...
    let perm:WorkspacePermissions;
    try{
        perm = await getWorkspacePermissions(username,wid,req.session.username);
        if(!perm.view) return res.status(403).send("You don't have the *view* permission for this workspace") // TODO: is this 401 or 403?
    }
    catch{
        return res.status(400).send("Failed to get workspace permissions");
    }
    // 

    try{
        const ws = await loadWorkspace(username,wid,req.session.username);
        res.status(200).send({
            workspace:ws,
            perm
        });
    }
    catch{
        res.status(404).send("Workspace not found");
    }
});

router.patch("/workspace/update/:uid/:wid",auth,async (req:Request,res)=>{
    if(!req.session) return;

    const username = queryOrDefault(req.params.uid,"");
    const wid = queryOrDefault(req.params.wid,"");

    if(!username || !wid) return res.status(400).send("Invalid data");

    try{
        const updated = await updateWorkspaceMeta(username,wid,req.session.username,req.body); // <-- this does allow for putting other junk in there, hmm
        res.status(200).send({
            workspace:updated
        });
    }
    catch{
        res.status(400).send("Failed to update workspace");
    }
});

router.post("/workspace/disconnect",auth,async (req:Request,res)=>{
    // can't do this yet until I have a way to check how many people are currently viewing or have this workspace open
});

// 

router.get("/workspace/:uid/:wid/readdir",auth,async (req:Request,res)=>{
    if(!req.session) return;

    const username = queryOrDefault(req.params.uid,"");
    const wid = queryOrDefault(req.params.wid,"");
    const path = queryOrDefault(req.query.path,"");

    if(!username || !wid){
        console.log("failed to readdir workspace",`[${username}]`,`[${wid}]`,`[${path}]`,!username,!wid,!path);
        return res.status(400).send("Invalid data");
    }
    
    try{
        const perm = await getWorkspacePermissions(username,wid,req.session.username);
        if(!perm.view) return res.status(403).send("No permission to read");

        const full = resolveWorkspacePath(username,wid,path);
        const items = await fs.readdir(full,{withFileTypes:true});

        let list:{
            name:string;
            type:"folder"|"file"|"link"
        }[] = [];

        for(const item of items){
            if(item.name.startsWith("__umm__")) continue; // reserved

            list.push({
                name:item.name,
                type:item.isSymbolicLink() ? "link" : item.isDirectory() ? "folder" : "file"
            });
        }

        res.status(200).send({
            items:list
        });
    }
    catch(e:any){
        res.status(400).send(e.message);
    }
});

router.get("/file/:uid/:wid",async (req:Request,res)=>{
    const sid = queryOrDefault(req.query.sid,"");
    if(!sid) return res.status(401).send("Missing auth");
    
    const s = getSession(sid);
    if(!s) return res.status(400).send("No session");
    
    const uid = queryOrDefault(req.params.uid,"");
    const wid = queryOrDefault(req.params.wid,"");
    const path = queryOrDefault(req.query.path,"");

    if(!uid || !wid || !path || !checkPath(uid) || !checkPath(wid) || !checkPath(path)) return res.status(400).send("Invalid data");

    const perm = await getWorkspacePermissions(uid,wid,s.username);
    if(!perm.view) return res.status(403).send("No permission to view");
    
    res.sendFile(join(workspaceDir(uid,wid),path));
});

export default router;