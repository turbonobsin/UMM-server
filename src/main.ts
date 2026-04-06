import { startServer } from "./server/index";

startServer(+(process.env.port ?? 3000));