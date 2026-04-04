export interface UserData{
    v:number;
    username:string;
    displayName:string;
    passwordHash:string;
    createdAt:number;
    lastLogin:number;
    tokens:string[];

    icon:{
        url?:string;
        bg?:string;
    };

    friends:{
        displayName:string;
        username:string;
    }[];

    // lastWSId?:string; // <-- probably will be stored by the client
};