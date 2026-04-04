import jwt from "jsonwebtoken";

const SECRET = process.env.JSON_WEB_TOKEN_SECRET ?? "fallback-token-secret-text";

export function createToken(username:string){
    return jwt.sign(
        { username },
        SECRET,
        {
            expiresIn:"30d"
        }
    );
}

export function verifyToken(token:string){
    try{
        return jwt.verify(token,SECRET) as {username:string};
    }
    catch{
        return undefined;
    }
}