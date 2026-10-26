import {defineConfig} from "vite";
import base from "../../vite.config";
export default defineConfig({...base,preview:{host:"127.0.0.1",port:5176,strictPort:true,
 proxy:{"/socket.io":{target:"http://127.0.0.1:3011",ws:true},"/api":"http://127.0.0.1:3011"}}});
