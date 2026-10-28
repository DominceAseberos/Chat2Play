import { randomInt } from "node:crypto";

export type Side = 0 | 1;
export type SymbolId = "sun" | "moon" | "heart" | "star" | "gem" | "zap";
const SYMBOLS: SymbolId[] = ["sun","moon","heart","star","gem","zap"];

export type MemoryState = {
  deck: SymbolId[]; revealed: number[]; matched: boolean[];
  scores: [number,number]; turn: Side; resolving: boolean;
};
export type MemoryView = {
  cards: (SymbolId | null)[]; matched: boolean[]; revealed: number[];
  scores: [number,number]; turn: Side; resolving: boolean;
};
export function createMemory(): MemoryState {
  const deck = [...SYMBOLS,...SYMBOLS];
  for(let i=deck.length-1;i>0;i--){
    const j=randomInt(i+1);
    [deck[i],deck[j]]=[deck[j],deck[i]];
  }
  return {
    deck, revealed:[], matched:Array(12).fill(false),
    scores:[0,0], turn: randomInt(2) as Side, resolving:false
  };
}
export function memoryView(mem: MemoryState): MemoryView {
  return {
    cards:mem.deck.map((id,i)=> mem.matched[i]||mem.revealed.includes(i)?id:null),
    matched:[...mem.matched], revealed:[...mem.revealed],
    scores:[...mem.scores] as [number,number],turn:mem.turn,resolving:mem.resolving
  };
}
export function flipMemory(mem:MemoryState,index:number,side:Side): "ignored"|"first"|"match"|"miss"|"finished" {
  if(mem.resolving || mem.turn!==side || !Number.isInteger(index)||index<0||index>=12 ||
    mem.matched[index]||mem.revealed.includes(index)||mem.revealed.length>=2) return "ignored";
  mem.revealed.push(index);
  if(mem.revealed.length===1)return "first";
  const [a,b]=mem.revealed;
  if(mem.deck[a]===mem.deck[b]){
    mem.matched[a]=true;mem.matched[b]=true;
    mem.scores[side]++;
    mem.revealed=[];
    return mem.matched.every(Boolean)?"finished":"match";
  }
  mem.resolving=true;
  return "miss";
}
export function resolveMemoryMismatch(mem:MemoryState) {
  if(!mem.resolving)return;
  mem.revealed=[];
  mem.resolving=false;
  mem.turn=mem.turn===0?1:0;
}
export function memoryWinner(mem:MemoryState): Side|"draw" {
  if(mem.scores[0]===mem.scores[1])return "draw";
  return mem.scores[0]>mem.scores[1]?0:1;
}

export * from "../src/pongPhysics.js";
