import { UserMeta } from "../../types/core_types";

export function migrateUser(data:UserMeta): UserMeta{
    let v = data.v;

    if(v == 0){
        data.displayName = data.displayName ?? data.username;
        data.v = 1;
    }

    data.externalWorkspaces ??= []; // ehh
    
    return data;
}