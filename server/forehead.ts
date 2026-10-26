import {randomInt} from "node:crypto";
import {selectedWordPool,validGameCategories,GAME_CATEGORIES,type GameCategory} from "./foreheadWordBank.js";
import {categoryOptions,MAX_HINT_LEVELS} from "./foreheadCategories.js";
export {FOREHEAD_CATEGORIES,MAX_HINT_LEVELS,categoryOptions} from "./foreheadCategories.js";
export type Side=0|1;
export type Difficulty="easy"|"medium"|"hard";
export type ForeheadOptions={difficulty:Difficulty;durationSeconds:number;categories:GameCategory[]};
export const DEFAULT_FOREHEAD_OPTIONS:ForeheadOptions={difficulty:"medium",durationSeconds:120,categories:[...GAME_CATEGORIES]};
export type ForeheadCategory=string;
// Each player owns an independent clock. Only the current guesser spends time.
export const FOREHEAD_ROUNDS=0;
export const MAX_GUESSES=5;
export type CategoryQuestion={id:number;category:ForeheadCategory};
export type CategoryAnswer={id:number;category:ForeheadCategory;yes:boolean};
export type ChatQuestion={id:string;text:string;answered:boolean;answer?:boolean;wordSerial:number};
export type ForeheadState={
 words:[string,string];used:Set<string>;turn:Side;completed:number;scores:[number,number];
 hints:string[];guesses:{text:string;correct:boolean}[];
 notice:string;lastGuess:number;
 pending:CategoryQuestion|null;asked:ForeheadCategory[];lastAnswer:CategoryAnswer|null;chatQuestion:ChatQuestion|null;sequence:number;
 options:ForeheadOptions;endsAt:number;timesLeft:[number,number];clockAt:number;wordSerial:number;finished:boolean;
 expression:{id:number;kind:"correct"|"wrong"|"pass"}|null;expressionSeq:number;
};
export type ForeheadView={
 otherWord:string;turn:Side;completed:number;maxRounds:number;scores:[number,number];
 hints:string[];guesses:{text:string;correct:boolean}[];notice:string;attemptsLeft:number;
 pending:CategoryQuestion|null;asked:ForeheadCategory[];lastAnswer:CategoryAnswer|null;chatQuestion:ChatQuestion|null;
 options:ForeheadOptions;endsAt:number;timesLeft:[number,number];serverNow:number;wordSerial:number;
 expression:{id:number;kind:"correct"|"wrong"|"pass"}|null;
};
const other=(s:Side):Side=>s===0?1:0;
const normalized=(s:string)=>s.trim().toLowerCase().replace(/[^a-z0-9]/g,"");
export function validForeheadOptions(raw:unknown):ForeheadOptions|null{
 if(!raw||typeof raw!=="object")return null;
 const o=raw as Partial<ForeheadOptions>;
 if(o.difficulty!=="easy"&&o.difficulty!=="medium"&&o.difficulty!=="hard")return null;
 if(!Number.isInteger(o.durationSeconds)||o.durationSeconds!<60||o.durationSeconds!>300)return null;
 const categories=validGameCategories(o.categories);
 if(!categories)return null;
 return {difficulty:o.difficulty,durationSeconds:o.durationSeconds!,categories};
}
export function newWord(state:ForeheadState):string{
 const bank=selectedWordPool(state.options.categories,state.options.difficulty);
 if(bank.length===0)throw new Error("No words for selected categories");
 if(bank.every(w=>state.used.has(w)))state.used.clear();
 const possible=bank.filter(w=>!state.used.has(w));
 const chosen=possible[randomInt(possible.length)];
 state.used.add(chosen);return chosen;
}
export function createForehead(options:ForeheadOptions=DEFAULT_FOREHEAD_OPTIONS,now=Date.now()):ForeheadState{
 const safe=validForeheadOptions(options);
 if(!safe)throw new Error("Invalid Pinoy Henyo setup");
 const state:ForeheadState={words:["",""],used:new Set(),turn:randomInt(2) as Side,
 completed:0,scores:[0,0],hints:[],guesses:[],notice:"Ask a category or guess the word!",
 lastGuess:0,pending:null,asked:[],lastAnswer:null,chatQuestion:null,sequence:0,
 options:safe,endsAt:now+safe.durationSeconds*1000,timesLeft:[safe.durationSeconds*1000,safe.durationSeconds*1000],clockAt:now,wordSerial:1,
 finished:false,expression:null,expressionSeq:0};
 state.words[state.turn]=newWord(state);
 return state;
}
export function foreheadView(state:ForeheadState,viewer:Side,now=Date.now()):ForeheadView{
 return {
  // Exactly one word is exposed: only the hint giver can read the current
  // guesser's card. The guesser receives NO secret word in any field.
  otherWord:viewer!==state.turn&&!state.finished?state.words[state.turn]:"",
  turn:state.turn,completed:state.completed,maxRounds:FOREHEAD_ROUNDS,
  scores:[...state.scores] as [number,number],hints:[...state.hints],
  guesses:state.guesses.map(g=>({...g})),notice:state.notice,
  attemptsLeft:MAX_GUESSES-state.guesses.length,
  pending:state.pending?{...state.pending}:null,asked:[...state.asked],
  lastAnswer:state.lastAnswer?{...state.lastAnswer}:null,
  chatQuestion:state.chatQuestion?{...state.chatQuestion}:null,
  options:{...state.options,categories:[...state.options.categories]},endsAt:now+Math.max(0,state.timesLeft[state.turn]-(now-state.clockAt)),
  timesLeft:state.timesLeft.map((ms,i)=>i===state.turn&&!state.finished?Math.max(0,ms-(now-state.clockAt)):ms) as [number,number],
  serverNow:now,wordSerial:state.wordSerial,
 expression:state.expression?{...state.expression}:null
 };
}
function resetWord(state:ForeheadState){
 state.words[state.turn]=newWord(state);
 state.hints=[];state.guesses=[];state.pending=null;state.asked=[];
 state.lastAnswer=null;state.chatQuestion=null;state.lastGuess=0;state.wordSerial++;
}
// Charge exactly the time spent as active guesser; the other clock is frozen.
// Only a role change or game completion requires a broadcast.
function chargeCurrent(s:ForeheadState,now:number):void{
 const delta=Math.max(0,now-s.clockAt);
 s.timesLeft[s.turn]=Math.max(0,s.timesLeft[s.turn]-delta);
 s.clockAt=now;
 s.endsAt=now+s.timesLeft[s.turn];
}
function endGame(s:ForeheadState){
 s.finished=true;s.words=["",""];s.pending=null;s.hints=[];s.guesses=[];s.asked=[];
 s.lastAnswer=null;s.chatQuestion=null;s.notice="Time's up! The most correct guesses wins.";
}
function changeGuesser(s:ForeheadState,kind:"correct"|"pass",now:number){
 const outgoing=s.turn,next=other(outgoing);
 s.words[outgoing]="";
 if(s.timesLeft[next]>0){
  s.turn=next;
  s.completed++;
  resetWord(s);
  s.clockAt=now;s.endsAt=now+s.timesLeft[next];
  s.notice=kind==="correct"?"Correct! +1 point. Your partner is guessing.":"Passed! Your partner is guessing.";
 }else if(s.timesLeft[outgoing]>0){
  // Never activate an already-expired clock. The remaining player can use
  // their own unused time without taking it from their opponent.
  resetWord(s);s.clockAt=now;s.endsAt=now+s.timesLeft[outgoing];
  s.notice="Your partner is out of time. Keep guessing!";
 }else endGame(s);
 s.expression={id:++s.expressionSeq,kind};
}
export function advanceTurn(s:ForeheadState,now=Date.now()):boolean{
 if(s.finished)return false;
 chargeCurrent(s,now);
 if(s.timesLeft[s.turn]>0)return false;
 const expired=s.turn,next=other(expired);
 s.words[expired]="";
 if(s.timesLeft[next]<=0){
  endGame(s);return true;
 }
 s.turn=next;s.completed++;
 resetWord(s);
 s.clockAt=now;s.endsAt=now+s.timesLeft[next];
 s.expression={id:++s.expressionSeq,kind:"pass"};
 s.notice="Time's up! Your partner's turn to guess.";
 return true;
}
function hasTime(s:ForeheadState,now:number){
 return !s.finished&&s.timesLeft[s.turn]>Math.max(0,now-s.clockAt);
}
export function isFinished(s:ForeheadState){return s.finished;}
export function result(s:ForeheadState):Side|"draw"{
 return s.scores[0]===s.scores[1]?"draw":s.scores[0]>s.scores[1]?0:1;
}
export function askCategory(s:ForeheadState,side:Side,raw:unknown,now=Date.now()):boolean{
 if(isFinished(s)||!hasTime(s,now)||side!==s.turn||s.pending||typeof raw!=="string")return false;
 // The server, never the UI, decides which tier and choices are legal.
 if(s.hints.length>=MAX_HINT_LEVELS||!categoryOptions(s.hints).includes(raw))return false;
 const cat=raw as ForeheadCategory;
 if(s.asked.includes(cat))return false;
 s.asked.push(cat);s.pending={id:++s.sequence,category:cat};
 s.notice="Waiting for Yes or No.";return true;
}
export function answerCategory(s:ForeheadState,side:Side,raw:unknown,now=Date.now()):boolean{
 if(isFinished(s)||!hasTime(s,now)||side===s.turn||!s.pending||!raw||typeof raw!=="object")return false;
 const a=raw as {id?:unknown;yes?:unknown};
 if(a.id!==s.pending.id||typeof a.yes!=="boolean")return false;
 const answer={...s.pending,yes:a.yes};
 s.pending=null;s.lastAnswer=answer;
 if(answer.yes){
  s.hints.push(answer.category);
  s.asked=[];
  s.notice=s.hints.length===MAX_HINT_LEVELS
   ?"Three hints confirmed. Now guess the word!"
   :"Yes! Choose a more specific category.";
 }
 else s.notice="No. Try another category.";
 return true;
}
export function submitGuess(s:ForeheadState,side:Side,raw:unknown,now=Date.now()):"invalid"|"wrong"|"correct"|"out"{
 if(isFinished(s)||side!==s.turn||!hasTime(s,now)||typeof raw!=="string")return "invalid";
 const guess=raw.trim().replace(/\s+/g," ");
 if(!guess||guess.length>40||!normalized(guess)||now-s.lastGuess<550)return "invalid";
 s.lastGuess=now;
 if(normalized(guess)===normalized(s.words[side])){
  chargeCurrent(s,now);s.scores[side]++;
  changeGuesser(s,"correct",now);
  return "correct";
 }
 s.guesses.push({text:guess,correct:false});
 s.expression={id:++s.expressionSeq,kind:"wrong"};
 if(s.guesses.length>=MAX_GUESSES){resetWord(s);s.notice="Five tries used. New word, same guesser.";return "out";}
 s.notice="Not quite. Keep trying!";
 return "wrong";
}
// Voice guesses are decided by the hint giver, not by speech recognition.
 // Only the OTHER player (who sees the secret word) can mark the guess
 // correct, and only once per word serial. Both players see the SVG success.
export function markSpokenCorrect(s:ForeheadState,side:Side,now=Date.now()):boolean{
 if(isFinished(s)||side===s.turn||!hasTime(s,now))return false;
 chargeCurrent(s,now);
 s.scores[s.turn]++;
 changeGuesser(s,"correct",now);
 return true;
}
export function skipForehead(s:ForeheadState,side:Side,now=Date.now()):boolean{
 if(side!==s.turn||isFinished(s)||!hasTime(s,now))return false;
 chargeCurrent(s,now);
 changeGuesser(s,"pass",now);
 return true;
}

// A text question belongs to the CURRENT guesser and CURRENT secret word.
// Its source is an accepted room chat message, never an unverified client ID.
export function noteChatQuestion(s:ForeheadState,side:Side,id:string,text:string,now=Date.now()):boolean{
 if(side!==s.turn||!hasTime(s,now)||!id||!text.trim())return false;
 s.chatQuestion={id,text:text.trim().slice(0,220),answered:false,wordSerial:s.wordSerial};
 return true;
}
export function answerChatQuestion(s:ForeheadState,side:Side,questionId:unknown,yes:unknown,now=Date.now()):boolean{
 const q=s.chatQuestion;
 if(side===s.turn||!hasTime(s,now)||!q||q.answered||q.wordSerial!==s.wordSerial
   ||q.id!==questionId||typeof yes!=="boolean"||s.pending)return false;
 q.answered=true;q.answer=yes;
 // Reuse the existing nod/shake animation events; do not consume a category
 // slot, modify scoring, or advance a hint level.
 s.lastAnswer={id:++s.sequence,category:"CHAT",yes};
 return true;
}

// Free-form yes/no gestures for VOICE mode. Only the hint giver can nod or
// shake. No category prompts, spoken hints, scoring or timer changes.
export function gestureAnswer(s:ForeheadState,side:Side,yes:unknown,now=Date.now()):boolean{
 if(side===s.turn||!hasTime(s,now)||typeof yes!=="boolean")return false;
 s.lastAnswer={id:++s.sequence,category:"CHAT",yes};
 return true;
}
