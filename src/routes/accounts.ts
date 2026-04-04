import { Request, Router } from "express";
import { createToken } from "../core/tokens";
import { auth } from "../server/middleware/auth";
import { createUser, loginUser } from "../core/users";
import { getUser } from "../storage/json";
import { checkPath } from "../storage/paths";

const router = Router();

function valStr(s:string|string[]|undefined):s is string{
    if(s == undefined) return false;
    if(typeof s !== "string") return false;
    return true;
}

router.post("/signup",async (req,res)=>{
    const {
        username,
        displayName,
        password
    } = req.body;

    if(!valStr(username) || !valStr(password)) return res.status(400).send("Missing fields");

    try{
        const user = await createUser(username,displayName || username,password);
        const token = createToken(username);

        res.status(201).json({
            token,
            user
        });
    }
    catch(err:any){
        res.status(400).send(err.message);
    }
});

router.post("/login",async (req,res)=>{
    const {username,password} = req.body;

    try{
        const user = await loginUser(username,password);
        const token = createToken(username);

        res.status(201).json({
            token,
            user
        });
    }
    catch(err:any){
        res.status(400).send(err.message);
    }
});

router.get("/me",auth,async (req:Request,res)=>{
    // const {username} = req.body;
    // if(!checkPath(username)) return res.status(400).send("Invalid username");

    if(!req.session) return res.status(400).send("No session");
    
    try{
        const user = await getUser(req.session.username);
        if(!user) return res.status(404).send("User data not found");
        
        res.status(200).json({user});
        // res.json({session:req.session});
    }
    catch(err:any){
        res.status(500).send(err);
    }
});

export default router;