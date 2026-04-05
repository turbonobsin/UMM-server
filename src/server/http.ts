import express, { type Request } from "express";
import cors from "cors";
import { join } from "path";
import { checkPath, workspaceDir } from "../storage/paths";

import accountRouter from "../routes/accounts";
import workspaceRouter from "../routes/workspaces";

export function createHTTPServer(){
    const app = express();

    app.use(express.json());
    app.use(cors());
    app.use(accountRouter);
    app.use(workspaceRouter);

    return app;
}