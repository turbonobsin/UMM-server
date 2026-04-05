import { Request, Router } from "express";
import { auth } from "../server/middleware/auth";
import { createWorkspace, getWorkspacePermissions, listWorkspaces, loadWorkspace, updateWorkspaceMeta } from "../core/workspaces";
import { isStr, queryOrDefault, valStr } from "../storage/paths";
import { WorkspacePermissions } from "../types/core_types";

const router = Router();

router.post("/workspace/create",auth,async (req:Request,res)=>{
    if(!req.session) return; // <-- this won't ever happen so it's ok not to send back here -- this is just for typescript inference

    const {name,icon} = req.body;
    const username = req.session.username;

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

    const username = req.params.uid; // <-- bc you should be able to open someone else's workspace if you have permission
    const wid = req.params.wid;

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

    const username = req.params.uid;
    const wid = req.params.wid;

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

export default router;