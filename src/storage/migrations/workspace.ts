import { WorkspaceMeta } from "../../types/core_types";

export function migrateWorkspace(data:WorkspaceMeta): WorkspaceMeta{
    let v = data.v;

    data.perm ??= {groups:{},users:{}};
    data.perm.groups ??= {};
    data.perm.users ??= {};
    
    return data;
}