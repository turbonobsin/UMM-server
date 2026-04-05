const alpha = `abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789`;

export function genId(len=8){
    let s = "";
    for(let i = 0; i < len; i++){
        s += alpha[Math.floor(Math.random()*alpha.length)];
    }
    return s;
}