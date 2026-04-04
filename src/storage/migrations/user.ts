import { UserData } from "../../types/core_types";

export function migrateUser(data:UserData): UserData{
    let v = data.v;

    if(v == 0){
        data.displayName = data.displayName ?? data.username;
        data.v = 1;
    }
    
    return data;
}