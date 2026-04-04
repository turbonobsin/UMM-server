import express, { type Request } from "express";
import cors from "cors";
import { join } from "path";
import { checkPath, workspaceDir } from "../storage/paths";

import accountRouter from "../routes/accounts";

export function createHTTPServer(){
    const app = express();

    app.use(express.json());
    app.use(cors());
    app.use(accountRouter);

    app.get("/test",(req,res)=>{
        res.sendStatus(200);
    });

    app.get("/file/:uid/:wid/:path",(req:Request,res)=>{
        console.log("get");
        let uid = checkPath(req.params.uid);
        let wid = checkPath(req.params.wid);
        let path = checkPath(req.params.path);
        if(!path) return res.status(400).send("Invalid path");
        if(!wid || !uid) return res.status(400).send("Missing data");

        res.sendFile(join(workspaceDir(uid,wid),path));
    });

    return app;
}