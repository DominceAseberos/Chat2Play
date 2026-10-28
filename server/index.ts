import express from "express";
import path from "node:path";
import {fileURLToPath} from "node:url";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { z } from "zod";
import { bestMatchPair, FALLBACK_WAIT_MS, type MatchProfile } from "./matching.js";
import { createMemory, createPong, memoryView, flipMemory, resolveMemoryMismatch, memoryWinner, pongView, movePaddle, setPongDragging, tickPong, type MemoryState, type PongState } from "./arcade.js";
import {createForehead,foreheadView,askCategory,answerCategory,submitGuess,skipForehead,advanceTurn,validForeheadOptions,isFinished,result,noteChatQuestion,answerChatQuestion,markSpokenCorrect,gestureAnswer,type ForeheadState,type ForeheadOptions} from "./forehead.js";
import {validGameCategories,type GameCategory} from "./foreheadWordBank.js";
import {RPS_CHOICE_MS,RPS_CHANT_TOTAL_MS,RPS_REVEAL_MS} from "../src/rpsTiming.js";

type Gender = "woman" | "man" | "nonbinary" | "unspecified";
type LookingFor = "any" | Exclude<Gender, "unspecified">;
type Kind = "ttt" | "rps" | "memory" | "pong" | "forehead";
type Side = 0 | 1;
type Choice = "rock" | "paper" | "scissors";
type Profile = MatchProfile;
type Game = {
  kind: Kind; phase:  "invite" | "categories" | "settings" | "mic" | "loading" | "playing" | "finished"; by: Side;
  board?: (Side | null)[]; turn?: Side; winner?: Side | "draw";
  choices?: [Choice | null, Choice | null];
  rps?:{targetWins:number;scores:[number,number];round:number;stage:"choosing"|"chant"|"reveal";
    roundEndsAt:number;chantEndsAt:number;revealEndsAt:number;roundWinner?:Side|"draw";
    pausedBy:[boolean,boolean];pauseAt:number;
    rematch?:{accepted:[boolean,boolean];expiresAt:number};
    roundChoices?:[Choice|null,Choice|null]};
  pongReady?:[boolean,boolean];
  pongTargetPoints?:5|10;
  id: string; memory?: MemoryState; pong?: PongState; forehead?: ForeheadState; foreheadOptions?:ForeheadOptions; foreheadCategories?:GameCategory[]; foreheadCategoryDraft?:GameCategory[]; categoryAgreement?:[boolean,boolean];sceneReady?:[boolean,boolean];micReady?:[boolean,boolean];
};
type WinnerQuestion = {id:string;gameId:string;asker:Side;phase:"asking"|"answering";text?:string;round:number};
type Room = { id: string; players: [string, string]; likes: [boolean, boolean]; game: Game | null; matchType: "preferred" | "fallback"; commonGames: Kind[];
  question:WinnerQuestion|null;questionGameId:string|null;questionSkips:[number,number] };

const profileSchema = z.object({
  gender: z.enum(["woman", "man", "nonbinary", "unspecified"]),
  lookingFor: z.enum(["any", "woman", "man", "nonbinary"]),
  interests: z.array(z.enum(["ttt", "rps", "memory", "pong", "forehead"])).max(5),
  fallback: z.enum(["automatic","strict"]).default("automatic"),
  isAdult: z.literal(true)
});
const messageSchema = z.union([
  z.object({ id: z.string().uuid(), kind: z.literal("text"), text: z.string().trim().min(1).max(500) }),
  z.object({ id: z.string().uuid(), kind: z.literal("sticker"), sticker: z.enum(["heart", "spark", "smile", "flower"]) }),
  z.object({ id: z.string().uuid(), kind: z.literal("gif"), url: z.string().max(500).refine(value => {
    // Chat2Play-created assets are same-origin and cannot escape /gifs/.
    if (/^\/gifs\/[a-z0-9_-]{1,48}\.gif$/.test(value)) return true;
    try { const url = new URL(value); return url.protocol === "https:" && /(^|\.)giphy\.com$/.test(url.hostname); } catch { return false; }
  }) }),
  z.object({ text: z.string().trim().min(1).max(500) })
]);
const reportSchema = z.object({ reason: z.enum(["harassment", "sexual", "spam", "other"]) });
const winnerQuestionSchema=z.object({id:z.string().uuid(),text:z.string().trim().min(3).max(160)});
const winnerAnswerSchema=z.object({id:z.string().uuid(),text:z.string().trim().min(1).max(500)});
const winnerSkipSchema=z.object({id:z.string().uuid()});
const PORT = Number(process.env.PORT || 3001);
// Mobile browsers may freeze background tabs and pause their network stack.
// Keep the in-memory room long enough for the same Socket.IO session to resume.
const RECONNECT_GRACE_MS=Math.max(1_000,Math.min(30*60_000,Number(process.env.RECONNECT_GRACE_MS)||15*60_000));
const allowedOrigin = process.env.CLIENT_ORIGIN;
const app = express();
app.disable("x-powered-by");
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Chat2Play", mode: "ephemeral" }));
// Serve only the compiled frontend in production, never the Vite dev server.
// This keeps the browser and Socket.IO on one secure origin for live testing.
if(process.env.NODE_ENV==="production"){
  const distDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../dist");
  app.use(express.static(distDir,{index:"index.html",maxAge:"1h",etag:true,setHeaders:(res,filePath)=>{
    const file=path.basename(filePath);
    if(file==="sw.js"||file==="registerSW.js"||file==="site.webmanifest")
      res.setHeader("Cache-Control","no-cache");
  }}));
  app.use((req,res)=>{
    if(req.method!=="GET"||req.path.startsWith("/api/")||req.path.startsWith("/socket.io/")){
      res.status(404).json({error:"Not found"});
      return;
    }
    res.setHeader("Cache-Control","no-cache");
    res.sendFile(path.join(distDir,"index.html"));
  });
}
const http = createServer(app);
const io = new Server(http, {
  cors: { origin: allowedOrigin ? allowedOrigin.split(",") : true, methods: ["GET", "POST"] },
  transports: ["websocket","polling"],
  maxHttpBufferSize: 16_384,
  serveClient: false,
  pingTimeout: 20_000,
  pingInterval: 10_000,
  connectionStateRecovery: { maxDisconnectionDuration: RECONNECT_GRACE_MS, skipMiddlewares: false }
});
const profiles = new Map<string, Profile>();
const waiting = new Map<string,number>();
const rooms = new Map<string, Room>();
const membership = new Map<string, string>();
const blocked = new Map<string, Set<string>>();
const lastChat = new Map<string, number>();
const reports: { at: number; reason: string; subject: string }[] = [];
const disconnectGrace = new Map<string, ReturnType<typeof setTimeout>>();
const lastTyping = new Map<string, number>();
const lastForeheadLook = new Map<string,number>();
const recentMessageIds = new Map<string, Map<string, number>>();
const GRACE_MS=RECONNECT_GRACE_MS;
function clearGrace(id: string) { const timer = disconnectGrace.get(id); if(timer) clearTimeout(timer); disconnectGrace.delete(id); }
function cleanupSocket(id: string) { clearGrace(id); lastChat.delete(id); lastTyping.delete(id); lastForeheadLook.delete(id);lastForeheadLook.delete(id+":gesture"); recentMessageIds.delete(id); blocked.delete(id); profiles.delete(id); waiting.delete(id); }


const otherSide = (n: Side): Side => n === 0 ? 1 : 0;
function getRoom(socket: Socket): { room: Room; side: Side } | null {
  const room = rooms.get(membership.get(socket.id) || "");
  if (!room) return null;
  const side = room.players.indexOf(socket.id);
  return side === -1 ? null : { room, side: side as Side };
}
function emitQuestion(room:Room){
 io.to(room.id).emit("winner-question:state",{
  skipsLeft:[...room.questionSkips],question:room.question?{...room.question}:null
 });
}
function awardQuestion(room:Room){
 const game=room.game;
 if(!game||game.phase!=="finished"||typeof game.winner!=="number"||room.questionGameId===game.id)return;
 room.questionGameId=game.id;
 room.question={id:randomUUID(),gameId:game.id,asker:game.winner,phase:"asking",round:1};
 emitQuestion(room);
}
function questionMessage(room:Room,from:Side,text:string,kind:"winner-question"|"winner-answer"|"winner-skip"){
 io.to(room.id).emit("chat:message",{id:randomUUID(),kind,text,from,at:Date.now()});
}
function emitGame(room: Room) {
  const game=room.game;
  awardQuestion(room);
  // Secrets are projected per recipient; never broadcast both words to a room.
  if(game?.kind==="forehead"){
    for(const side of [0,1] as const){
      const payload={id:game.id,kind:game.kind,phase:game.phase,by:game.by,
        winner:game.winner,ready:[false,false],foreheadOptions:game.foreheadOptions,foreheadCategories:game.foreheadCategories,foreheadCategoryDraft:game.foreheadCategoryDraft,categoryAgreement:game.categoryAgreement,sceneReady:game.sceneReady,micReady:game.micReady,
        forehead:game.forehead?foreheadView(game.forehead,side):undefined};
      io.to(room.players[side]).emit("game:state",payload);
    }
    return;
  }
  const payload=!game ? null : {
    id:game.id,kind:game.kind,phase:game.phase,by:game.by,
    board:game.board,turn:game.turn,winner:game.winner,
    ready:game.choices?.map(Boolean)??[false,false],
    reveal:game.kind==="rps"&&(game.rps?.stage==="reveal"||game.phase==="finished")&&game.rps?.roundChoices?
      {choices:game.rps.roundChoices,winner:game.rps.roundWinner??"draw"}:undefined,
    rps:game.rps?{...game.rps,scores:[...game.rps.scores],pausedBy:[...game.rps.pausedBy],
      roundWinner:game.rps.stage==="chant"?undefined:game.rps.roundWinner,roundChoices:undefined}:undefined,
    sceneReady:game.kind==="rps"?game.sceneReady:game.kind==="pong"?game.pongReady:undefined,
    memory:game.memory?memoryView(game.memory):undefined,
    pongTargetPoints:game.pongTargetPoints,
    pong:game.pong?pongView(game.pong):undefined
  };
  io.to(room.id).emit("game:state",payload);
}
setInterval(()=>{
  const now=Date.now();
  for(const room of rooms.values()){
    const game=room.game;
    if(game?.kind!=="pong"||game.phase!=="playing"||!game.pong)continue;
    // Pausing avoids giving the connected player an unfair win while their partner reconnects.
    if(room.players.some(id=>disconnectGrace.has(id))){game.pong.lastTick=now;game.pong.serveAt=Math.max(game.pong.serveAt,now+500);continue;}
    const winner=tickPong(game.pong,now);
    if(winner!==null){game.winner=winner;game.phase="finished";}
    emitGame(room);
  }
},33);
// RPS: one shared clock governs choices, two "Bato" beats, the final reveal,
// and pauses while either player is outside the game view.
setInterval(()=>{
 const now=Date.now();
 for(const room of rooms.values()){
  const game=room.game,r=game?.rps;
  if(game?.kind==="rps"&&game.phase==="finished"&&r?.rematch&&now>=r.rematch.expiresAt){
   io.to(room.id).emit("rps:rematch-ended",{reason:"expired"});
   room.game=null;emitGame(room);continue;
  }
  if(game?.kind!=="rps"||game.phase!=="playing"||!r)continue;
  if(room.players.some(id=>disconnectGrace.has(id)))continue;
  if(r.pausedBy.some(Boolean))continue;
  if(r.stage==="choosing"&&now>=r.roundEndsAt){
   const a=game.choices?.[0]??null,b=game.choices?.[1]??null;
   r.roundChoices=[a,b];
   r.roundWinner=!a&&!b?"draw":!a?1:!b?0:compareRps(a,b);
   r.stage="chant";r.chantEndsAt=now+RPS_CHANT_TOTAL_MS;
   // Keep both choices hidden during the two fist pumps.
   emitGame(room);
  }else if(r.stage==="chant"&&now>=r.chantEndsAt){
   if(r.roundWinner!==undefined&&r.roundWinner!=="draw")r.scores[r.roundWinner]++;
   r.stage="reveal";r.revealEndsAt=now+RPS_REVEAL_MS;
   // The third beat lands on the selected sign. A missing choice forfeits.
   emitGame(room);
  }else if(r.stage==="reveal"&&now>=r.revealEndsAt){
   const winner=r.scores.findIndex(v=>v>=r.targetWins);
   if(winner>=0){game.phase="finished";game.winner=winner as Side;}
   else{
    r.round++;r.stage="choosing";r.roundEndsAt=now+RPS_CHOICE_MS;
    r.roundChoices=undefined;r.roundWinner=undefined;game.choices=[null,null];
   }
   emitGame(room);
  }
 }
},110).unref();
// Server authoritative clock: clients interpolate progress locally without sending ticks.
setInterval(()=>{
 const now=Date.now();
 for(const room of rooms.values()){
  const game=room.game;
  if(game?.kind!=="forehead"||game.phase!=="playing"||!game.forehead)continue;
  if(advanceTurn(game.forehead,now)){
   if(isFinished(game.forehead)){game.phase="finished";game.winner=result(game.forehead);}
   emitGame(room);
  }
 }
},180).unref();
function endRoom(room: Room, reason: string, code = "partner_left") {
  if (!rooms.has(room.id)) return;
  rooms.delete(room.id);
  room.players.forEach(id => {
    membership.delete(id);
    clearGrace(id);
    io.sockets.sockets.get(id)?.leave(room.id);
    io.to(id).emit("match:ended", { reason, code });
  });
  room.game = null;
}
// The queue contains only users actively searching, never simply connected clients.
const fallbackWaitMs=Math.max(1000,Math.min(30000,Number(process.env.MATCH_FALLBACK_MS)||FALLBACK_WAIT_MS));
let presenceTimer: ReturnType<typeof setTimeout> | undefined;
const emitPresence=()=>{
  if(presenceTimer)return;
  presenceTimer=setTimeout(()=>{presenceTimer=undefined;io.emit("presence:update",{online:io.sockets.sockets.size,searching:waiting.size});},200);
  presenceTimer.unref();
};
let matchingScheduled=false;
let queueScanRotation=0;
function scheduleMatching(){if(matchingScheduled)return;matchingScheduled=true;setTimeout(()=>{matchingScheduled=false;drainMatches();},30).unref();}
// Bound expensive pair scoring. The oldest 96 stay eligible; a rotating sample
// of later arrivals avoids starvation when the front of the queue is incompatible.
function candidateWindow(entries: {id:string;profile:Profile;joinedAt:number}[]){
 if(entries.length<=128)return entries;
 const head=entries.slice(0,96);
 const remaining=entries.length-96;
 const start=queueScanRotation%remaining;
 queueScanRotation=(queueScanRotation+32)%remaining;
 for(let i=0;i<32;i++)head.push(entries[96+(start+i)%remaining]);
 return head;
}
function drainMatches(){
  let changed=false;
  let matched=0;
  while(waiting.size>=2 && matched<32){
    const players=[];
    for(const [id,joinedAt] of waiting){
      const connected=io.sockets.sockets.get(id);
      const profile=profiles.get(id);
      if(!connected||!profile||membership.has(id)){waiting.delete(id);changed=true;continue;}
      players.push({id,profile,joinedAt});
    }
    if(players.length<2)break;
    const best=bestMatchPair(candidateWindow(players),Date.now(),fallbackWaitMs,
      (a,b)=>Boolean(blocked.get(a)?.has(b)||blocked.get(b)?.has(a)));
    if(!best)break;
    const {first,second,kind,commonGames}=best;
    const a=io.sockets.sockets.get(first.id),b=io.sockets.sockets.get(second.id);
    if(!a||!b){if(!a)waiting.delete(first.id);if(!b)waiting.delete(second.id);continue;}
    waiting.delete(first.id);waiting.delete(second.id);changed=true;matched++;
    const room:Room={id:randomUUID(),players:[first.id,second.id],likes:[false,false],game:null,matchType:kind,commonGames,
      question:null,questionGameId:null,questionSkips:[3,3]};
    rooms.set(room.id,room);
    membership.set(first.id,room.id);membership.set(second.id,room.id);
    a.join(room.id);b.join(room.id);
    a.emit("match:found",{side:0,partnerGender:second.profile.gender,commonGames,matchType:kind});
    b.emit("match:found",{side:1,partnerGender:first.profile.gender,commonGames,matchType:kind});
    emitQuestion(room);
  }
  if(changed)emitPresence();
  if(matched===32 && waiting.size>=2)scheduleMatching();
}
function tryMatch(socket:Socket){
  if(!profiles.has(socket.id)||membership.has(socket.id))return;
  if(!waiting.has(socket.id))waiting.set(socket.id,Date.now());
  socket.emit("queue:waiting");
  scheduleMatching();
}
// Periodic matching matters: two already-waiting users can become eligible for
// fallback without anyone new joining the queue.
setInterval(()=>{if(waiting.size>=2)drainMatches();},400).unref();
const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winnerOf(board: (Side | null)[]): Side | "draw" | undefined {
  for (const [a,b,c] of lines) {
    if (board[a] !== null && board[a] === board[b] && board[a] === board[c]) return board[a]!;
  }
  return board.every(x => x !== null) ? "draw" : undefined;
}
function compareRps(a: Choice, b: Choice): Side | "draw" {
  if (a === b) return "draw";
  return (a === "rock" && b === "scissors") ||
    (a === "scissors" && b === "paper") ||
    (a === "paper" && b === "rock") ? 0 : 1;
}
io.on("connection", socket => {
  emitPresence();
  if(socket.recovered){
    clearGrace(socket.id);
    const state=getRoom(socket);
    if(state){
      const {room,side}=state;
      const peerId=room.players[otherSide(side)];
      socket.emit("session:state",{phase:"chat",side,partnerGender:profiles.get(peerId)?.gender||"unspecified",commonGames:room.commonGames,matchType:room.matchType});
      socket.emit("like:state",{yours:room.likes[side],theirs:room.likes[otherSide(side)],mutual:room.likes.every(Boolean)});
      emitGame(room);
      emitQuestion(room);
      io.to(peerId).emit("partner:connection",{connected:true});
    } else socket.emit("session:lost",{reason:"Your previous connection could not be restored."});
  }
  socket.on("presence:activity",(raw:unknown)=>{
    if(typeof raw!=="boolean")return;
    const state=getRoom(socket);if(!state)return;
    io.to(state.room.players[otherSide(state.side)]).emit("partner:activity",{away:raw});
  });
  socket.on("queue:join", (raw: unknown) => {
    if (membership.has(socket.id)) return;
    const data = profileSchema.safeParse(raw);
    if (!data.success) { socket.emit("system:error", "Please confirm you are 18+ and check your preferences."); return; }
    const { gender, lookingFor, interests, fallback } = data.data;
    profiles.set(socket.id, { gender, lookingFor, interests, fallback });
    waiting.delete(socket.id);
    tryMatch(socket);
    emitPresence();
  });
  socket.on("queue:cancel", () => { waiting.delete(socket.id); profiles.delete(socket.id); emitPresence(); });
  socket.on("chat:send", (raw: unknown, ack?: (result: {ok:boolean;error?:string})=>void) => {
    const reply=(result: {ok:boolean;error?:string})=>{if(typeof ack==="function")ack(result);};
    const state = getRoom(socket);
    const parsed = messageSchema.safeParse(raw);
    if (!state || !parsed.success){reply({ok:false,error:"Your message could not be sent. Check your connection or start a new chat."});return;}
    if(state.room.question){reply({ok:false,error:"Finish the winner's question first."});return;}
    const now = Date.now();
    const submittedId="id" in parsed.data?parsed.data.id:undefined;
    if(submittedId&&recentMessageIds.get(socket.id)?.has(submittedId)){reply({ok:true});return;}
    if (now - (lastChat.get(socket.id) || 0) < 700) {
      reply({ok:false,error:"Please wait a moment before sending another message."}); return;
    }
    lastChat.set(socket.id, now);
    const body = parsed.data;
    const id = "id" in body ? body.id : randomUUID();
    const seen=recentMessageIds.get(socket.id)||new Map<string,number>();
    seen.set(id,now);
    if(seen.size>100){const oldest=seen.keys().next().value;if(oldest)seen.delete(oldest);}
    recentMessageIds.set(socket.id,seen);
    const outgoing = "kind" in body && body.kind === "sticker" ? { kind: "sticker", sticker: body.sticker }
      : "kind" in body && body.kind === "gif" ? { kind: "gif", url: body.url }
      : { kind: "text", text: "text" in body ? body.text : "" };
    io.to(state.room.id).emit("chat:message", { ...outgoing, id, from: state.side, at: now });
    const activeGame=state.room.game;
    if(activeGame?.kind==="forehead"&&activeGame.phase==="playing"&&activeGame.forehead
      &&outgoing.kind==="text"&&typeof outgoing.text==="string"&&noteChatQuestion(activeGame.forehead,state.side,id,outgoing.text,now)){
      emitGame(state.room);
    }
    reply({ok:true});
    // No message bodies or URLs are persisted.
  });
  socket.on("chat:typing", (active: unknown) => {
    if (typeof active !== "boolean") return;
    const state = getRoom(socket);
    if (!state) return;
    const now=Date.now();
    if(active && now-(lastTyping.get(socket.id)||0)<450)return;
    if(active)lastTyping.set(socket.id,now);
    const peerId = state.room.players[otherSide(state.side)];
    io.to(peerId).emit("chat:typing", { active });
  });
  socket.on("winner-question:ask",(raw:unknown,ack?: (result:{ok:boolean;error?:string})=>void)=>{
    const parsed=winnerQuestionSchema.safeParse(raw),state=getRoom(socket);
    const question=state?.room.question;
    if(!parsed.success||!state||!question||question.id!==parsed.data.id||
      question.asker!==state.side||question.phase!=="asking"){
      if(typeof ack==="function")ack({ok:false,error:"This question is no longer available."});return;
    }
    question.text=parsed.data.text;question.phase="answering";
    questionMessage(state.room,state.side,question.text,"winner-question");
    emitQuestion(state.room);
    if(typeof ack==="function")ack({ok:true});
  });
  socket.on("winner-question:answer",(raw:unknown,ack?: (result:{ok:boolean;error?:string})=>void)=>{
    const parsed=winnerAnswerSchema.safeParse(raw),state=getRoom(socket);
    const question=state?.room.question;
    if(!parsed.success||!state||!question||question.id!==parsed.data.id||
      question.asker===state.side||question.phase!=="answering"){
      if(typeof ack==="function")ack({ok:false,error:"This question is no longer available."});return;
    }
    questionMessage(state.room,state.side,parsed.data.text,"winner-answer");
    state.room.question=null;emitQuestion(state.room);
    if(typeof ack==="function")ack({ok:true});
  });
  socket.on("winner-question:skip",(raw:unknown,ack?: (result:{ok:boolean;error?:string})=>void)=>{
    const parsed=winnerSkipSchema.safeParse(raw),state=getRoom(socket);
    const question=state?.room.question;
    if(!parsed.success||!state||!question||question.id!==parsed.data.id||
      question.asker===state.side||question.phase!=="answering"||state.room.questionSkips[state.side]<=0){
      if(typeof ack==="function")ack({ok:false,error:"This question cannot be skipped."});return;
    }
    state.room.questionSkips[state.side]--;
    questionMessage(state.room,state.side,`Skipped the question · ${state.room.questionSkips[state.side]} skips left`,"winner-skip");
    question.phase="asking";question.text=undefined;question.round++;
    emitQuestion(state.room);
    if(typeof ack==="function")ack({ok:true});
  });
  socket.on("game:propose", (raw: unknown) => {
    const state=getRoom(socket);
    const kind=typeof raw==="string"?raw:(raw&&typeof raw==="object"?(raw as {kind?:unknown}).kind:null);
    if(!state||(kind!=="ttt"&&kind!=="rps"&&kind!=="memory"&&kind!=="pong"&&kind!=="forehead"))return;
    const selectedPoints=kind==="pong"&&raw&&typeof raw==="object"?
      (raw as {options?:{targetPoints?:unknown}}).options?.targetPoints:5;
    if(kind==="pong"&&selectedPoints!==5&&selectedPoints!==10)return;
    if(state.room.question){socket.emit("system:notice","Finish the winner's question before starting another game.");return;}
    if(state.room.game&&(state.room.game.phase!=="finished"||state.room.game.rps?.rematch)){
      socket.emit("system:notice","Finish or close your current game before inviting another one.");
      return;
    }
    // Pinoy Henyo has NO options at invitation time. Invitation -> category
    // approval by both -> difficulty/timer -> live match.
    state.room.game={id:randomUUID(),kind,phase:"invite",by:state.side,
      pongTargetPoints:kind==="pong"?selectedPoints as 5|10:undefined};
    emitGame(state.room);
  });
  socket.on("game:respond",(accept:unknown)=>{
    const state=getRoom(socket);
    if(!state||typeof accept!=="boolean")return;
    const {room,side}=state,game=room.game;
    if(!game||game.phase!=="invite"||game.by===side)return;
    if(!accept){room.game=null;emitGame(room);return;}
    if(game.kind==="forehead"){
      game.phase="categories";
      game.categoryAgreement=[false,false];
      emitGame(room);
      return;
    }
    if(game.kind==="rps"){game.phase="settings";emitGame(room);return;}
    if(game.kind==="pong"){
      game.phase="loading";game.pong=createPong(game.pongTargetPoints??5);game.pongReady=[false,false];
      emitGame(room);return;
    }
    game.phase="playing";
    if(game.kind==="ttt"){game.board=Array(9).fill(null);game.turn=Math.random()<.5?0:1;}
    else if(game.kind==="memory")game.memory=createMemory();
    emitGame(room);
  });
  socket.on("rps:configure",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game;
    if(!st||game?.kind!=="rps"||game.phase!=="settings"||st.side!==game.by||!raw||typeof raw!=="object")return;
    const d=raw as {id?:unknown;targetWins?:unknown};
    if(d.id!==game.id||!Number.isInteger(d.targetWins)||typeof d.targetWins!=="number"
      ||d.targetWins<1||d.targetWins>20)return;
    game.rps={targetWins:d.targetWins,scores:[0,0],round:1,stage:"choosing",roundEndsAt:0,chantEndsAt:0,revealEndsAt:0,
      pausedBy:[false,false],pauseAt:0};
    game.sceneReady=[false,false];game.phase="loading";emitGame(st.room);
  });
  socket.on("rps:rematch",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game,r=game?.rps;
    if(!st||st.room.question||game?.kind!=="rps"||game.phase!=="finished"||!r||!raw||typeof raw!=="object"
      ||(raw as {id?:unknown}).id!==game.id)return;
    const now=Date.now();
    if(r.rematch&&now>=r.rematch.expiresAt)return;
    if(!r.rematch)r.rematch={accepted:[false,false],expiresAt:now+10_000};
    r.rematch.accepted[st.side]=true;
    if(r.rematch.accepted.every(Boolean)){
      st.room.game={id:randomUUID(),kind:"rps",phase:"loading",by:game.by,
        sceneReady:[false,false],choices:[null,null],rps:{targetWins:r.targetWins,scores:[0,0],round:1,
        stage:"choosing",roundEndsAt:0,chantEndsAt:0,revealEndsAt:0,pausedBy:[false,false],pauseAt:0}};
    }
    emitGame(st.room);
  });
  socket.on("rps:view",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game,r=game?.rps;
    if(!st||game?.kind!=="rps"||(game.phase!=="loading"&&game.phase!=="playing")||!r
      ||!raw||typeof raw!=="object")return;
    const d=raw as {id?:unknown;viewing?:unknown};
    if(d.id!==game.id||typeof d.viewing!=="boolean"||r.pausedBy[st.side]===!d.viewing)return;
    const now=Date.now();
    if(!d.viewing){
      if(!r.pausedBy.some(Boolean))r.pauseAt=now;
      r.pausedBy[st.side]=true;
    }else{
      r.pausedBy[st.side]=false;
      if(!r.pausedBy.some(Boolean)){
        if(game.phase==="playing"&&r.pauseAt){
          const held=now-r.pauseAt;
          if(r.stage==="choosing")r.roundEndsAt+=held;
          else if(r.stage==="chant")r.chantEndsAt+=held;
          else r.revealEndsAt+=held;
        }
        r.pauseAt=0;
      }
    }
    emitGame(st.room);
  });
  socket.on("rps:scene-ready",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game;
    if(!st||game?.kind!=="rps"||game.phase!=="loading"||!game.sceneReady||!game.rps
      ||!raw||typeof raw!=="object"||(raw as {id?:unknown}).id!==game.id)return;
    game.sceneReady[st.side]=true;
    if(game.sceneReady.every(Boolean)){
      game.phase="playing";game.choices=[null,null];
      const now=Date.now();game.rps.roundEndsAt=now+RPS_CHOICE_MS;
      game.rps.pauseAt=game.rps.pausedBy.some(Boolean)?now:0;
    }
    emitGame(st.room);
  });
  socket.on("pong:scene-ready",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game;
    if(!st||game?.kind!=="pong"||game.phase!=="loading"||!game.pongReady||!game.pong
      ||!raw||typeof raw!=="object"||(raw as {id?:unknown}).id!==game.id)return;
    game.pongReady[st.side]=true;
    if(game.pongReady.every(Boolean)){game.phase="playing";game.pong.lastTick=Date.now();game.pong.serveAt=Date.now()+3000;}
    emitGame(st.room);
  });
  socket.on("pong:drag",(raw:unknown)=>{
    const st=getRoom(socket),game=st?.room.game;
    if(!st||game?.kind!=="pong"||game.phase!=="playing"||!game.pong
      ||!raw||typeof raw!=="object")return;
    const val=raw as {id?:unknown;active?:unknown};
    if(val.id!==game.id||typeof val.active!=="boolean")return;
    setPongDragging(game.pong,st.side,val.active);
    emitGame(st.room);
  });
  // Ephemeral, validated preview: let both players see each category toggle
  // before confirmation. A draft never counts as either player's agreement.
  socket.on("forehead:categories:preview",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="categories"||game.by!==state.side
      ||game.categoryAgreement?.[state.side]||game.foreheadCategories||!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;categories?:unknown};
    if(input.id!==game.id||!Array.isArray(input.categories))return;
    const categories=input.categories.length===0?[]:validGameCategories(input.categories);
    if(!categories)return;
    if(JSON.stringify(categories)===JSON.stringify(game.foreheadCategoryDraft??[]))return;
    game.foreheadCategoryDraft=[...categories];
    emitGame(state.room);
  });
  socket.on("forehead:categories:select",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="categories"||game.by!==state.side)return;
    if(!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;categories?:unknown;confirmed?:unknown};
    const categories=validGameCategories(input.categories);
    if(input.id!==game.id||input.confirmed!==true||!categories){
      socket.emit("system:error","Choose one or more valid categories and confirm your selection.");
      return;
    }
    game.foreheadCategories=[...categories];
    game.foreheadCategoryDraft=[...categories];
    game.categoryAgreement=state.side===0?[true,false]:[false,true];
    emitGame(state.room);
  });
  socket.on("forehead:categories:agree",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="categories"||game.by===state.side||!game.foreheadCategories)return;
    if(!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;confirmed?:unknown;categories?:unknown};
    const categories=validGameCategories(input.categories);
    if(input.id!==game.id||input.confirmed!==true||!categories
      ||JSON.stringify(categories)!==JSON.stringify(game.foreheadCategories)){
      socket.emit("system:error","Confirm the exact shared categories to continue.");
      return;
    }
    if(!game.categoryAgreement?.[game.by])return;
    game.categoryAgreement[state.side]=true;
    game.phase="settings";
    emitGame(state.room);
  });
  socket.on("forehead:categories:request-change",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="categories"||game.by===state.side||!game.foreheadCategories
      ||!raw||typeof raw!=="object"||(raw as {id?:unknown}).id!==game.id)return;
    game.foreheadCategories=undefined;
    game.foreheadCategoryDraft=[];
    game.categoryAgreement=[false,false];
    emitGame(state.room);
    io.to(state.room.players[game.by]).emit("system:notice","Your partner requested different word categories.");
  });
  socket.on("forehead:configure",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="settings"||game.by!==state.side
      ||!game.foreheadCategories||!game.categoryAgreement?.every(Boolean))return;
    if(!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;difficulty?:unknown;durationSeconds?:unknown};
    if(input.id!==game.id)return;
    // Authoritative, already-agreed categories cannot be changed by the last step.
    const options=validForeheadOptions({difficulty:input.difficulty,
      durationSeconds:input.durationSeconds,categories:game.foreheadCategories});
    if(!options){socket.emit("system:error","Choose a difficulty and a timer between 1 and 5 minutes.");return;}
    game.foreheadOptions=options;
    game.forehead=createForehead(options);
    game.sceneReady=[false,false];
    game.micReady=[false,false];
    game.phase="mic";
    emitGame(state.room);
  });
  // Explicit permission on EACH player's own device is mandatory. The client
  // obtains a real microphone track first and only then sends this flag.
  socket.on("forehead:mic-ready",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="mic"||!game.micReady
      ||!raw||typeof raw!=="object"||(raw as {id?:unknown}).id!==game.id)return;
    if(game.micReady[state.side])return;
    game.micReady[state.side]=true;
    if(game.micReady.every(Boolean))game.phase="loading";
    emitGame(state.room);
  });
  // Strictly room-local WebRTC signaling. No audio passes through the server.
  socket.on("forehead:voice:signal",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||!["loading","playing"].includes(game.phase)
      ||!game.micReady?.every(Boolean)||!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;type?:unknown;sdp?:unknown;candidate?:unknown};
    if(input.id!==game.id||!["offer","answer","candidate"].includes(String(input.type)))return;
    if(input.type==="candidate"){
      const json=JSON.stringify(input.candidate??"");
      if(!input.candidate||json.length>2800)return;
    }else if(typeof input.sdp!=="string"||input.sdp.length>25000)return;
    const peer=state.room.players[state.side===0?1:0];
    io.to(peer).emit("forehead:voice:signal",input.type==="candidate"
       ?{id:game.id,type:"candidate",candidate:input.candidate}
       :{id:game.id,type:input.type,sdp:input.sdp});
  });
  // Clients signal readiness only AFTER their first successful 3D frame.
  // Start the timers simultaneously after both players have loaded the stage.
  socket.on("forehead:scene-ready",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="loading"||!game.forehead
       ||!raw||typeof raw!=="object"||(raw as {id?:unknown}).id!==game.id||!game.sceneReady)return;
    if(game.sceneReady[state.side])return;
    game.sceneReady[state.side]=true;
    if(game.sceneReady.every(Boolean)){
      const now=Date.now();
      game.forehead.clockAt=now;
      game.forehead.endsAt=now+game.forehead.timesLeft[game.forehead.turn];
      game.phase="playing";
    }
    emitGame(state.room);
  });
  socket.on("game:move", (raw: unknown) => {
    const state = getRoom(socket);
    if (!state) return;
    const { room, side } = state;
    const game = room.game;
    if (!game || game.phase !== "playing") return;
    if (game.kind === "ttt") {
      if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0 || raw > 8) return;
      if (game.turn !== side || !game.board || game.board[raw] !== null) return;
      game.board[raw] = side;
      const result = winnerOf(game.board);
      if (result !== undefined) { game.winner = result; game.phase = "finished"; }
      else game.turn = otherSide(side);
    } else if(game.kind==="rps"){
      if(raw!=="rock"&&raw!=="paper"&&raw!=="scissors")return;
      if(!game.rps||game.rps.stage!=="choosing"||game.rps.pausedBy.some(Boolean)||Date.now()>game.rps.roundEndsAt
        ||!game.choices||game.choices[side])return;
      game.choices[side]=raw;
    }
    if(game.kind==="ttt"||game.kind==="rps")emitGame(room);
  });
  socket.on("memory:flip",(index:unknown)=>{
    const state=getRoom(socket);
    if(!state||state.room.game?.kind!=="memory"||state.room.game.phase!=="playing"||!state.room.game.memory)return;
    if(typeof index!=="number"||!Number.isInteger(index))return;
    const {room,side}=state;
    const game=room.game!;
    const result=flipMemory(game.memory!,index,side);
    if(result==="ignored")return;
    if(result==="finished"){game.winner=memoryWinner(game.memory!);game.phase="finished";}
    emitGame(room);
    if(result==="miss"){
      const id=game.id;
      setTimeout(()=>{
        if(room.game?.id!==id||!room.game.memory||room.game.phase!=="playing")return;
        resolveMemoryMismatch(room.game.memory);
        emitGame(room);
      },1050);
    }
  });
  // Tiny, validated ephemeral head-pose packets. Forward to the other client
  // without game:state broadcasts or storing motion in a database.
  socket.on("forehead:look",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="playing"||!game.forehead)return;
    const f=game.forehead;
    // Both seated players can look around; each sees the other's head pose.
    if(!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;round?:unknown;serial?:unknown;yaw?:unknown;pitch?:unknown};
    if(input.id!==game.id||input.round!==f.completed||input.serial!==f.wordSerial)return;
    if(typeof input.yaw!=="number"||typeof input.pitch!=="number"||
       !Number.isFinite(input.yaw)||!Number.isFinite(input.pitch)||
       Math.abs(input.yaw)>1.1||Math.abs(input.pitch)>1.0)return;
    const now=Date.now();
    if(now-(lastForeheadLook.get(socket.id)??0)<70)return;
    lastForeheadLook.set(socket.id,now);
    io.to(state.room.players[otherSide(state.side)]).emit("forehead:look",{
      id:game.id,round:f.completed,serial:f.wordSerial,
      yaw:input.yaw,pitch:input.pitch
    });
  });
  socket.on("forehead:ask",(raw:unknown)=>{
    const s=getRoom(socket);const g=s?.room.game;
    if(!s||g?.kind!=="forehead"||g.phase!=="playing"||!g.forehead)return;
    if(!raw||typeof raw!=="object")return;
    const data=raw as {category?:unknown;round?:unknown;serial?:unknown};
    if(data.round!==g.forehead.completed||data.serial!==g.forehead.wordSerial)return;
    if(askCategory(g.forehead,s.side,data.category))emitGame(s.room);
  });
  socket.on("forehead:gesture",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="playing"||!game.forehead
       ||!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;round?:unknown;serial?:unknown;yes?:unknown};
    if(input.id!==game.id||input.round!==game.forehead.completed||input.serial!==game.forehead.wordSerial)return;
    const key=socket.id+":gesture";
    const now=Date.now();
    if(now-(lastForeheadLook.get(key)||0)<420)return;
    if(!gestureAnswer(game.forehead,state.side,input.yes,now))return;
    lastForeheadLook.set(key,now);
    emitGame(state.room);
  });
  socket.on("forehead:heard-correct",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="playing"||!game.forehead
       ||!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;round?:unknown;serial?:unknown};
    if(input.id!==game.id||input.round!==game.forehead.completed||input.serial!==game.forehead.wordSerial)return;
    if(!markSpokenCorrect(game.forehead,state.side))return;
    emitGame(state.room);
  });
  socket.on("forehead:chat-answer",(raw:unknown)=>{
    const state=getRoom(socket),game=state?.room.game;
    if(!state||game?.kind!=="forehead"||game.phase!=="playing"||!game.forehead
      ||!raw||typeof raw!=="object")return;
    const input=raw as {id?:unknown;round?:unknown;serial?:unknown;questionId?:unknown;yes?:unknown};
    if(input.id!==game.id||input.round!==game.forehead.completed||input.serial!==game.forehead.wordSerial)return;
    if(!answerChatQuestion(game.forehead,state.side,input.questionId,input.yes))return;
    const response=input.yes?"YES":"NO";
    io.to(state.room.id).emit("chat:message",{
      id:randomUUID(),kind:"text",text:response,from:state.side,at:Date.now(),replyTo:input.questionId
    });
    emitGame(state.room);
  });
  socket.on("forehead:answer",(answer:unknown)=>{
    const s=getRoom(socket);const g=s?.room.game;
    if(!s||g?.kind!=="forehead"||g.phase!=="playing"||!g.forehead)return;
    if(answerCategory(g.forehead,s.side,answer))emitGame(s.room);
  });
  socket.on("forehead:guess",(raw:unknown)=>{
    const s=getRoom(socket);const g=s?.room.game;
    if(!s||g?.kind!=="forehead"||g.phase!=="playing"||!g.forehead)return;
    if(!raw||typeof raw!=="object")return;
    const data=raw as {word?:unknown;round?:unknown;serial?:unknown};
    if(data.round!==g.forehead.completed||data.serial!==g.forehead.wordSerial)return;
    const answer=submitGuess(g.forehead,s.side,data.word);
    if(answer==="invalid")return;
    if(isFinished(g.forehead)){g.phase="finished";g.winner=result(g.forehead);}
    emitGame(s.room);
  });
  socket.on("forehead:skip",(raw:unknown)=>{
    const s=getRoom(socket);const g=s?.room.game;
    if(!s||g?.kind!=="forehead"||g.phase!=="playing"||!g.forehead)return;
    if(!raw||typeof raw!=="object"||(raw as {round?:unknown}).round!==g.forehead.completed||(raw as {serial?:unknown}).serial!==g.forehead.wordSerial)return;
    if(!skipForehead(g.forehead,s.side))return;
    if(isFinished(g.forehead)){g.phase="finished";g.winner=result(g.forehead);}
    emitGame(s.room);
  });
  socket.on("pong:paddle",(value:unknown)=>{
    const state=getRoom(socket);
    if(!state||state.room.game?.kind!=="pong"||state.room.game.phase!=="playing"||!state.room.game.pong)return;
    if(typeof value==="number")movePaddle(state.room.game.pong,state.side,value);
    else if(value&&typeof value==="object"){
      const paddle=value as {y?:unknown;depth?:unknown;forwardStroke?:unknown};
      if(typeof paddle.y==="number"&&typeof paddle.depth==="number")
        movePaddle(state.room.game.pong,state.side,{y:paddle.y,depth:paddle.depth,
          forwardStroke:typeof paddle.forwardStroke==="number"?paddle.forwardStroke:undefined});
    }
  });
  socket.on("game:close", (raw:unknown) => {
    const state = getRoom(socket);
    if (!state || !raw || typeof raw!=="object") return;
    const game=state.room.game;
    // A delayed close for an older game must never end a newer game.
    if(!game || (raw as {id?:unknown}).id!==game.id)return;
    const {room,side}=state;
    room.game = null;
    io.to(room.players[side]).emit("game:closed",{id:game.id,kind:game.kind,bySelf:true});
    io.to(room.players[otherSide(side)]).emit("game:closed",{id:game.id,kind:game.kind,bySelf:false});
    emitGame(room);
  });
  socket.on("like:toggle", () => {
    const state = getRoom(socket);
    if (!state) return;
    const { room, side } = state;
    room.likes[side] = !room.likes[side];
    room.players.forEach((id, n) => io.to(id).emit("like:state", {
      yours: room.likes[n], theirs: room.likes[1 - n],
      mutual: room.likes.every(Boolean)
    }));
  });
  socket.on("match:next", (raw:unknown) => {
    const state = getRoom(socket);
    if (!state) return;
    // Revalidate updated matching choices before leaving the current room;
    // never destroy an existing chat on an invalid Next request.
    if(raw!==undefined){
      const next=profileSchema.safeParse(raw);
      if(!next.success){socket.emit("system:error","Check your profile and 18+ confirmation before finding another person.");return;}
      const {gender,lookingFor,interests,fallback}=next.data;
      profiles.set(socket.id,{gender,lookingFor,interests,fallback});
    }
    endRoom(state.room, "Your chat partner moved on.", "partner_next");
    tryMatch(socket);
  });
  socket.on("match:leave", () => {
    const state = getRoom(socket);
    if (state) endRoom(state.room, "Your chat partner left.", "partner_left");
    waiting.delete(socket.id);
  });
  socket.on("report:send", (raw: unknown) => {
    const state = getRoom(socket);
    const parsed = reportSchema.safeParse(raw);
    if (!state || !parsed.success) return;
    const peer = state.room.players[otherSide(state.side)];
    const b = blocked.get(socket.id) || new Set<string>();
    b.add(peer);
    blocked.set(socket.id, b);
    reports.push({ at: Date.now(), reason: parsed.data.reason, subject: peer });
    if (reports.length > 500) reports.shift();
    socket.emit("system:notice", "Report received in this demo. No permanent moderation service is connected.");
    endRoom(state.room, "The chat was ended after a report.", "reported");
  });
  socket.on("disconnect", () => {
    waiting.delete(socket.id);
    emitPresence();
    const state=getRoom(socket);
    if(!state){cleanupSocket(socket.id);return;}
    const {room,side}=state;
    io.to(room.players[otherSide(side)]).emit("partner:connection",{connected:false,graceMs:GRACE_MS});
    clearGrace(socket.id);
    const timer=setTimeout(()=>{
      disconnectGrace.delete(socket.id);
      if(rooms.has(room.id))endRoom(room,"Your chat partner disconnected. You can find someone new.", "partner_disconnected");
      cleanupSocket(socket.id);
    },GRACE_MS);
    timer.unref();disconnectGrace.set(socket.id,timer);
  });
});
http.listen(PORT, "0.0.0.0", () => console.log("Chat2Play API listening on port " + PORT));
