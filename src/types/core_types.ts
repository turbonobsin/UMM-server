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

export type BlockStateType = {
    parBid:number; // <-- for future use to create the temp parent block if the children were sent to get created before the parent, then when the parent is added check for temp blocks created and move them from there to here, and delete the temp!!
    parI:number;
    
    bid:number;
    block:any; // <-- the serialize base data
    t:number;
};
export type Ret_M_SetBlockState = {
    t:number;
    owner:string;
    wid:string;
    by:string;
    path:string; // <-- which file is it in
    states:BlockStateType[];
    // for history system to just run
    states2:HistChange[];
};
export type Ret_M_AddChange = {
    owner:string;
    wid:string;
    by:string;
    path:string; // <-- which file is it in

    t:number;
    change:HistChange;
    way:"undo"|"redo";
    preStates?:[number,CommonSerializedData][];

    id:string;
    lastId?:string;
};

// Serialization

export type BlockCommonSerializedData = {
    _: string; // id/type
    d: any; // data for this type
    c?: number[]; // list of children IN ORDER

    ind?: number; // indent, nil for 0
    indType?: number;
    indI?: number;
    indC?: boolean;

    tc:number; // time created
    tm:number; // time modified

    // c?:Record<number,BlockCommonSerializedData|PartCommonSerializedData>; // list of children
    // c?:(BlockCommonSerializedData|PartCommonSerializedData)[]; // list of children
};
export type PartCommonSerializedData = {
    _p: string;
    d: any;
};
export type CommonSerializedData = BlockCommonSerializedData | PartCommonSerializedData;

// History

type CommonHistChange = {
    // mode:Omit<HistChangeMode,"create">;
    bid:number;
    state:CommonSerializedData; // object representing the serialized state of a block after the change has been made
};
// export type HistChange = CommonHistChange | (CommonHistChange & {
//     mode:"create";
//     parBid:number;
//     ind:number; // index in the list of parent's children that it was inserted
// });

export type ModifyHistChange = CommonHistChange & {
    mode:"modify";
};
export type CreateHistChange = CommonHistChange & {
    mode:"create";
    parBid:number;
    ind:number; // index in the list of parent's children that it was inserted
};
export type RemoveHistChange = CommonHistChange & {
    mode:"remove";
    parBid:number;
    ind:number; // <-- remove needs to know this information too bc when undoing a remove it's actually a create
};
export type MoveHistChange = CommonHistChange & {
    mode:"move";
    oldParBid:number;
    oldInd:number;
    parBid:number;
    ind:number;
};
export type CustomHistChange<T> = CommonHistChange & {
    mode:"custom";
    preState:T; // just stray data to store in order to UNDO
    // state:T; // stray data to REDO
    undo:()=>void;
    redo:()=>void;
};

export type HistChange = ModifyHistChange | CreateHistChange | RemoveHistChange | MoveHistChange | CustomHistChange<any>;

// 

// export type Arg_WorkspaceMetaUpdate = {
    
// };