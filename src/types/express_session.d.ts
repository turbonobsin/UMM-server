import "express";
import { Session } from "../core/sessions";

declare module "express"{
    interface Request{
        session?:Session;
    }
}
declare module "express-serve-static-core"{
    interface Request{
        session?:Session;
    }
}

import "socket.io";
declare module "socket.io"{
    interface Socket{
        session:Session;
    }
}