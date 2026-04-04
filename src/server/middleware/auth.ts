import { NextFunction, Request, Response } from "express";
import { getSession } from "../../core/sessions";

export function auth(req:Request,res:Response,next:NextFunction){
    const sid = req.headers["x-session-id"];
    if(!sid || typeof sid != "string") return res.status(401).send("Missing session ID");

    const session = getSession(sid);
    if(!session) return res.status(401).send("Invalid or expired session");
    
    req.session = session;
    next();
}