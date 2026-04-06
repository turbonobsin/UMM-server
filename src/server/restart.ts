import { Server, Socket } from "socket.io";

export async function prepareRestart(io:Server){
    const socks = [...io.sockets.sockets.values()];

    console.log(`:: started preparing restart (${socks.length})`);

    let proms:Promise<void>[] = [];
    for(const s of socks){
        proms.push(new Promise<void>(resolve=>{
            s.timeout(5000).emit("server:prepare-restart",async (err:any)=>{
                if(err) console.warn("Didn't get response in time for: ",s.session?.username);
                console.log("> done: "+s.session?.username);
                resolve();
            });
        }));
    }
    await Promise.all(proms);

    process.exit(0);
    
    // 
    
    // const sessions = [...io.sockets.sockets.values()].map(v=>v.session);

    // for(const s of sessions){
        // s.readyForRestart = false;

        
    // }

    // io.emit("server:prepare-restart");

    // wait for all sessions to comfirm
    // await new Promise<void>(resolve=>{
    //     const interval = setInterval
    // });
}