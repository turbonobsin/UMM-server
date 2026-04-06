export type IconData = {
    url?:string;
    bg?:string;
};

export interface UserMeta{
    v:number;

    username:string;
    displayName:string;
    passwordHash:string;
    createdAt:number;
    lastLogin:number;
    tokens:string[];

    icon:IconData;

    friends:{
        displayName:string;
        username:string;
    }[];

    externalWorkspaces:{
        owner:string; // username
        wid:string;
        // should we also store icon data just for quick show?
    }[];

    // lastWSId?:string; // <-- probably will be stored by the client
}


export type WorkspacePermissionConfig = {
    public?:WorkspacePermissions;
    groups:Record<string,{
        perm:WorkspacePermissions;
    }>;
    users:Record<string,{
        groups:string[];
    }>;
};


/**
 * The format of `_umm__ws.json` files
 */
export interface WorkspaceMeta{
    v:number;
    wid:string;
    /**
     * This is the owner's username
     */
    owner:string;
    
    name:string;
    icon:IconData;

    createdAt:number;
    lastOpened:number;

    perm:WorkspacePermissionConfig;
}

export interface WorkspacePermissions{
    view:boolean;
    edit:boolean;
}

// 

export type Result<T> = [{
    code:number;
    msg:string;
},undefined] | [undefined,T];
export type CB = (res:Result<any>)=>void;