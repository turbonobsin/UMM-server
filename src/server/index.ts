import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import fs, { mkdir } from "fs/promises";
import { USERS } from "../storage/paths";
import { createHTTPServer } from "./http";
import { attachSocketIO } from "./socket";

async function initFolders(){
    await fs.mkdir(USERS,{recursive:true});
}

export async function startServer(port:number){
    await initFolders();

    const app = createHTTPServer();
    const httpServer = createServer(app);

    attachSocketIO(httpServer);

    httpServer.listen(port,()=>{
        console.log("Listening on port:",port);
    });
}