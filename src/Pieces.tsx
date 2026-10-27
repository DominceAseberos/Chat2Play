
import {GAME_CATEGORIES,GAME_CATEGORY_LABELS,type GameCategory} from "../server/foreheadWordBank";
import * as Select from "@radix-ui/react-select";
import * as Dialog from "@radix-ui/react-dialog";
import { motion } from "motion/react";
import { lazy, Suspense } from "react";
const LocalEmojiPicker = lazy(() => import("./LocalEmojiPicker"));
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronUp, X, LoaderCircle, Search, CircleHelp, Heart, Flower2, Smile, Sparkles, MessageCircle, ShieldCheck, Moon, Sun, UserRound, Gamepad2, Circle, Grid3X3, Layers3, Orbit, Trophy, CircleX, ArrowRight } from "lucide-react";
import {unlockRpsAudio} from "./rpsAudio";
export type Gender = "unspecified" | "woman" | "man" | "nonbinary";
export type Preference = "any" | "woman" | "man" | "nonbinary";
export type Kind = "ttt" | "rps" | "memory" | "pong" | "forehead";
export type Side = 0 | 1;
export type Choice = "rock" | "paper" | "scissors";
export type Theme = "light" | "dark";
export type Sticker = "heart" | "spark" | "smile" | "flower";
export type ChatMessage = {
  id: string; kind: "text" | "gif" | "sticker" | "winner-question" | "winner-answer" | "winner-skip"; text?: string;
  url?: string; sticker?: Sticker; from: Side; at: number; pending?: boolean; failed?: boolean;
};
export type WinnerQuestionState={skipsLeft:[number,number];question:{
  id:string;gameId:string;asker:Side;phase:"asking"|"answering";text?:string;round:number
}|null};
export type Game = {
  id:string; kind:Kind; phase:"invite"|"categories"|"settings"|"mic"|"loading"|"playing"|"finished"; by:Side;
  pongTargetPoints?:5|10;
  foreheadOptions?:{difficulty:"easy"|"medium"|"hard";durationSeconds:number;categories:GameCategory[]};foreheadCategories?:GameCategory[];foreheadCategoryDraft?:GameCategory[];categoryAgreement?:[boolean,boolean];micReady?:[boolean,boolean];
  board?:(Side|null)[]; turn?:Side; winner?:Side|"draw"; ready:boolean[];
  reveal?:{choices:[Choice|null,Choice|null];winner:Side|"draw"};
  memory?:{cards:("sun"|"moon"|"heart"|"star"|"gem"|"zap"|null)[];matched:boolean[];revealed:number[];scores:[number,number];turn:Side;resolving:boolean};
  pong?:{ball:{x:number;y:number;h:number;vx:number;vy:number;vh:number;sideSpin?:number};
   paddles:[number,number];depths:[number,number];scores:[number,number];serving:boolean;
   dragging:[boolean,boolean];swipe:[number,number];lastHit:[number,number];
   hitPower:[number,number];netHits:number;targetPoints:5|10;server:Side;serveCountdown:number};
  rps?:{targetWins:number;scores:[number,number];round:number;stage:"choosing"|"chant"|"reveal";
    roundEndsAt:number;chantEndsAt:number;revealEndsAt:number;roundWinner?:Side|"draw";
    pausedBy:[boolean,boolean];pauseAt:number;
    rematch?:{accepted:[boolean,boolean];expiresAt:number}};
  sceneReady?:[boolean,boolean];
  forehead?:{otherWord:string;turn:Side;completed:number;maxRounds:number;scores:[number,number];hints:string[];guesses:{text:string;correct:boolean}[];notice:string;attemptsLeft:number;pending:{id:number;category:string}|null;asked:string[];lastAnswer:{id:number;category:string;yes:boolean}|null;chatQuestion:{id:string;text:string;answered:boolean;answer?:boolean;wordSerial:number}|null;options:{difficulty:"easy"|"medium"|"hard";durationSeconds:number};endsAt:number;timesLeft:[number,number];serverNow:number;wordSerial:number;expression:{id:number;kind:"correct"|"wrong"|"pass"}|null};
};
export const GAMES: { id: Kind; title: string; desc: string }[] = [
 { id: "memory", title: "Memory Duel", desc: "Flip, match, and win" },
 { id: "pong", title: "Ping Pong", desc: "Live arcade battle" },
 { id: "forehead", title: "Pinoy Henyo", desc: "Give clues & guess your own word" },
 { id: "ttt", title: "Tic-Tac-Toe", desc: "Get three in a row" },
 { id: "rps", title: "Rock Paper Scissors", desc: "One, two, shoot!" }
];
export const GENDERS: {value:Gender;label:string}[] = [
 {value:"unspecified",label:"Prefer not to say"}, {value:"woman",label:"Woman"},
 {value:"man",label:"Man"}, {value:"nonbinary",label:"Nonbinary"}
];
export const PREFS: {value:Preference;label:string}[] = [
 {value:"any",label:"Anyone"}, {value:"woman",label:"Women"},
 {value:"man",label:"Men"}, {value:"nonbinary",label:"Nonbinary"}
];
export const genderText = (g: Gender) => GENDERS.find(x=>x.value===g)?.label || "Private";
export function Logo(){return <span className="logo-wrap"><span className="logo-mark logo-mark-image"><img className="logo-image" src="/chat2play-logo.webp?v=3" alt="" width="44" height="44" decoding="async"/></span><span className="logo-text">chat<span>2</span>play</span></span>;}
export function GameSymbol({id,size=22}:{id:Kind;size?:number}) {
  if(id==="memory")return <Layers3 size={size} strokeWidth={2.1}/>;
  if(id==="pong")return <Orbit size={size} strokeWidth={2.1}/>;
  if(id==="forehead")return <CircleHelp size={size} strokeWidth={2.35}/>;
  return id==="ttt"?<Grid3X3 size={size} strokeWidth={2.1}/>:<Circle size={size} strokeWidth={2.7}/>;
}
export function FancySelect<T extends string>({value,onChange,items,label}:{value:T;onChange:(v:T)=>void;items:{value:T;label:string}[];label:string}){
 return <Select.Root value={value} onValueChange={onChange}>
  <Select.Trigger className="fancy-trigger" aria-label={label}>
    <span className="fancy-trigger-icon">{label==="My gender"?<UserRound size={17}/>:<Heart size={17}/>}</span>
    <Select.Value/><Select.Icon><ChevronDown size={16}/></Select.Icon>
  </Select.Trigger>
  <Select.Portal><Select.Content className="select-content" position="popper" sideOffset={6} collisionPadding={12}>
    <Select.ScrollUpButton className="select-scroll"><ChevronUp size={15}/></Select.ScrollUpButton>
    <Select.Viewport className="select-view">
      {items.map(x=><Select.Item className="select-option" key={x.value} value={x.value}>
        <Select.ItemText>{x.label}</Select.ItemText><Select.ItemIndicator><Check size={16}/></Select.ItemIndicator>
      </Select.Item>)}
    </Select.Viewport><Select.ScrollDownButton className="select-scroll"><ChevronDown size={15}/></Select.ScrollDownButton>
  </Select.Content></Select.Portal>
 </Select.Root>;
}
export function Modal({open,onOpenChange,title,description,children,topLayer=false}:{open:boolean;onOpenChange:(v:boolean)=>void;title:string;description?:string;children:React.ReactNode;topLayer?:boolean}){
 return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal>
  <Dialog.Overlay className={"modal-overlay"+(topLayer?" modal-overlay-game-quit":"")}/>
  <Dialog.Content className={"modal-body"+(topLayer?" modal-body-game-quit":"")} aria-describedby={description?"modal-desc":undefined}>
    <div className="modal-header"><div><Dialog.Title className="modal-title">{title}</Dialog.Title>{description&&<Dialog.Description id="modal-desc" className="modal-desc">{description}</Dialog.Description>}</div>
      <Dialog.Close className="svg-button" aria-label="Close"><X size={19}/></Dialog.Close></div>
    <div className="modal-content">{children}</div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function StickerArt({id,size=56}:{id:Sticker;size?:number}){
 const Icon = {heart:Heart,spark:Sparkles,smile:Smile,flower:Flower2}[id];
 return <span className={"sticker-art sticker-"+id} style={{width:size,height:size}}><Icon size={size*.65} strokeWidth={2.1} fill={id==="heart"?"currentColor":"none"}/></span>;
}
export function ChatSkeleton(){return <div className="chat-skeleton" aria-hidden="true">
  <div className="skeleton-avatar shimmer"/><div className="skeleton-lines"><i className="shimmer"/><i className="shimmer"/></div>
</div>;}
export function TypingIndicator(){return <div className="typing-row"><span className="typing-mini-avatar"><UserRound size={15}/></span><div className="typing-pill" role="status" aria-label="Stranger is typing"><i/><i/><i/></div><span className="typing-caption">typing</span></div>;}
export function Spinner({label}:{label?:string}){return <span className="spinner-wrap"><LoaderCircle className="spinner" size={18}/>{label && <span>{label}</span>}</span>;}
const LOCAL_GIFS = [
  ["hello","Hello!"],["love","Love"],["laugh","Laugh"],["yay","Yay!"],["gg","Good game!"],
  ["wow","Wow"],["nice","Nice!"],["coffee","Coffee?"],["vibes","Good vibes"],["thanks","Thank you"]
] as const;
export function ReactionPicker({theme,onEmoji,onSticker,onGif}:{theme:Theme;onEmoji:(emoji:string)=>void;onSticker:(id:Sticker)=>void;onGif:(url:string)=>void}){
 const [tab,setTab]=useState<"emoji"|"stickers"|"gif">("emoji");
 const [query,setQuery]=useState("");
 const [gifUrl,setGifUrl]=useState("");
 const [gifSource,setGifSource]=useState<"local"|"giphy">("local");
 const [gifPage,setGifPage]=useState(0);
 const [loading,setLoading]=useState(false);
 const [gifs,setGifs]=useState<{id:string;url:string;preview:string;title:string}[]>([]);
 const key=import.meta.env.VITE_GIPHY_API_KEY as string|undefined;
 useEffect(()=>{
  if(tab!=="gif"||!key){setGifs([]);return;}
  const abort = new AbortController();
  const timer=setTimeout(async()=>{
    setLoading(true);
    try{
      const params=new URLSearchParams({api_key:key,limit:"12",rating:"g", ...(query.trim()?{q:query.trim().slice(0,50)}:{})});
      const endpoint=query.trim()?"search":"trending";
      const response=await fetch("https://api.giphy.com/v1/gifs/"+endpoint+"?"+params.toString(),{signal:abort.signal});
      if(!response.ok)throw new Error("GIF search unavailable");
      const json=await response.json();
      setGifs((json.data||[]).map((item:any)=>({id:item.id,title:item.title||"GIF",url:item.images?.fixed_height?.webp||item.images?.fixed_height?.url,preview:item.images?.fixed_width_small?.webp||item.images?.fixed_width_small?.url})).filter((g:any)=>g.url&&g.preview));
    }catch(e){if(!abort.signal.aborted)setGifs([]);}
    finally{if(!abort.signal.aborted)setLoading(false);}
  },550);
  return ()=>{clearTimeout(timer);abort.abort();};
 },[tab,query,key]);
 function sendGifUrl(){
  try{
   let value=gifUrl.trim();
   const url=new URL(value);
   if(url.hostname==="giphy.com"||url.hostname==="www.giphy.com"){
     const id=url.pathname.split("-").pop();
     if(!id||!/^[a-zA-Z0-9]+$/.test(id))throw new Error();
     value="https://media.giphy.com/media/"+id+"/giphy.gif";
   }else if(url.protocol!=="https:" || !/(^|\.)giphy\.com$/.test(url.hostname))throw new Error();
   onGif(value);setGifUrl("");
  }catch{window.alert("Use a valid HTTPS GIPHY GIF or GIPHY share link.");}
 }
 const gifPageCount=Math.max(1,Math.ceil((gifSource==="local"?LOCAL_GIFS.length:gifs.length)/6));
 const currentGifPage=Math.min(gifPage,gifPageCount-1);
 return <div className="reaction-panel">
   <div className="reaction-tabs" role="tablist" aria-label="Message attachments">
    {(["emoji","stickers","gif"] as const).map(t=><button type="button" role="tab" aria-selected={t===tab} key={t} onClick={()=>setTab(t)} className={t===tab?"active":""}>{t==="gif"?"GIF":t==="emoji"?"Emoji":"Stickers"}</button>)}
   </div>
   {tab==="emoji"&&<div className="emoji-panel"><Suspense fallback={<div className="emoji-loading"><Spinner label="Loading emojis…"/></div>}><LocalEmojiPicker onSelect={onEmoji}/></Suspense></div>}
   {tab==="stickers"&&<div className="sticker-grid">{(["heart","spark","smile","flower"] as Sticker[]).map(id=><button key={id} type="button" onClick={()=>onSticker(id)} aria-label={"Send "+id+" sticker"}><StickerArt id={id}/><span>{id}</span></button>)}</div>}
   {tab==="gif"&&<div className="gif-tab" data-source={gifSource} data-page={currentGifPage}>
    <div className="mobile-gif-switch" role="group" aria-label="GIF sources"><button type="button" className={gifSource==="local"?"active":""} aria-pressed={gifSource==="local"} onClick={()=>{setGifSource("local");setGifPage(0);}}>Local reactions</button>{key&&<button type="button" className={gifSource==="giphy"?"active":""} aria-pressed={gifSource==="giphy"} onClick={()=>{setGifSource("giphy");setGifPage(0);}}>Search GIPHY</button>}</div>
    <div className="local-gif-section">
    <div className="gif-group-label"><strong>Chat2Play reactions</strong><small>Local · Always available</small></div>
    <div className="gif-grid gif-local-grid">{LOCAL_GIFS.map(([id,title])=><button type="button" key={id} aria-label={"Send "+title+" GIF"} onClick={()=>onGif("/gifs/"+id+".gif")}><img src={"/gifs/"+id+".gif"} alt="" loading="eager" decoding="async"/><span className="gif-local-name">{title}</span></button>)}</div>
    </div>
    <div className="online-gif-section">
    {key&&<div className="gif-group-label"><strong>Search GIPHY</strong><small>Online · Powered by GIPHY</small></div>}
    {key&&<label className="gif-search"><Search size={17}/><input placeholder="Search reaction GIFs" value={query} onChange={e=>{setQuery(e.target.value);setGifPage(0);}} maxLength={80}/></label>}
    {loading?<div className="gif-skeleton"><ChatSkeleton/><ChatSkeleton/></div>:key&&gifs.length>0?<div className="gif-grid gif-online-grid">
      {gifs.map(g=><button type="button" key={g.id} aria-label={"Send "+g.title} onClick={()=>onGif(g.url)}><img src={g.preview} alt={g.title} loading="lazy"/></button>)}
    </div>:<p className="gif-help">{key?"No GIFs found. Try another search.":"Online GIF search needs a GIPHY API key. You can send the local reactions above."}</p>}
    <div className="gif-paste"><input aria-label="GIPHY GIF link" value={gifUrl} onChange={e=>setGifUrl(e.target.value)} placeholder="Paste a GIPHY link…" type="url"/><button type="button" onClick={sendGifUrl} disabled={!gifUrl.trim()} aria-label="Send GIF"><ArrowRight size={18}/></button></div>
    {key&&<p className="gif-attribution">Powered by GIPHY</p>}
    </div>
    <nav className="gif-pages" aria-label="GIF result pages"><button type="button" disabled={currentGifPage===0} onClick={()=>setGifPage(p=>Math.max(0,p-1))}>Previous</button><span>{currentGifPage+1} / {gifPageCount}</span><button type="button" disabled={currentGifPage===gifPageCount-1} onClick={()=>setGifPage(p=>Math.min(gifPageCount-1,p+1))}>Next</button></nav>
   </div>}
 </div>;
}
export function GamePanel({game,side,onRespond,onCategoriesAgree,onCategoriesChange,onSetup,onMove,onClose,onExpand,onRpsConfigure}:{
 game:Game;side:Side;onRespond:(yes:boolean)=>void;
 onCategoriesAgree:(categories:GameCategory[])=>void;
 onCategoriesChange:()=>void;onSetup:()=>void;
 onMove:(move:number|Choice)=>void;onClose:()=>void;onExpand?:()=>void;
 onRpsConfigure?:(target:number)=>void
}){
 const [agreed,setAgreed]=useState(false);
 const [targetWins,setTargetWins]=useState(3);
 const [customTarget,setCustomTarget]=useState("7");
 useEffect(()=>setAgreed(false),[game.id,game.phase,game.foreheadCategories?.join(",")]);
 const mine=game.by===side;
 const gameDone=game.phase==="finished";
 const result=game.winner==="draw"?"It's a tie":game.winner===side?"You won!":"Your partner won!";
 return <div className="play-card">
  <div className="play-card-header"><div className="game-symbol"><GameSymbol id={game.kind} size={19}/></div><div><strong>{GAMES.find(x=>x.id===game.kind)?.title}</strong><small>Playing together</small></div><button className="svg-button" type="button" aria-label="Close game" onClick={onClose}><X size={18}/></button></div>
  {game.phase==="invite"?
    <div className="invite-area">
     <div className="invite-visual"><GameSymbol id={game.kind} size={40}/></div>
     <h4>{mine?"Invitation sent":"Game invitation"}</h4>
     <p>{mine?"Waiting for your partner to accept.":"Your partner wants to challenge you. Ready to play?"}</p>
     {game.kind==="pong"&&<p>First to {game.pongTargetPoints??5} · win by 2</p>}
     {game.kind==="forehead"&&<p className="henyo-stage-note">Game setup opens after the invitation is accepted.</p>}
     {mine?<Spinner label="Waiting for response"/>:<div className="game-actions">
       <button className="secondary-button" onClick={()=>onRespond(false)}>Decline</button>
       <button className="primary-button" onClick={()=>{if(game.kind==="rps")unlockRpsAudio();onRespond(true);}}>Accept invitation <ArrowRight size={17}/></button>
      </div>}
    </div>
   :game.kind==="rps"&&game.phase==="settings"?
    <div className="rps-preselect">
     <h4>Choose how many wins</h4>
     <p>First to reach the chosen number of wins takes the match. Each round has a 5-second countdown.</p>
     {mine?<><div className="rps-wins-options" role="group" aria-label="Target wins">
      {[3,5,10,0].map(n=><button key={n} type="button" aria-pressed={targetWins===n}
       className={targetWins===n?"selected":""} onClick={()=>setTargetWins(n)}>{n===0?"Custom":n+" wins"}</button>)}
     </div>
     {targetWins===0&&<label className="rps-custom-target">Custom wins
      <input aria-label="Custom target wins" type="number" min={1} max={20} value={customTarget}
       onChange={e=>setCustomTarget(e.target.value)}/><small>1 to 20 wins</small>
     </label>}
     <button type="button" className="primary-button rps-begin" disabled={targetWins===0&&(!Number.isInteger(Number(customTarget))||Number(customTarget)<1||Number(customTarget)>20)}
      onClick={()=>{unlockRpsAudio();onRpsConfigure?.(targetWins||Number(customTarget));}}>Load 3D game <ArrowRight size={16}/></button>
     </>:<div className="rps-wait-settings"><Spinner label="Waiting for your partner to choose the match length"/></div>}
    </div>
   :game.kind==="forehead"&&game.phase==="categories"?
    <div className="invite-area henyo-agreement-stage">
     <h4>Choose shared categories</h4>
     {!game.foreheadCategories?
      mine?<><p>The invitation was accepted. Select the word categories you both want to play with.</p>
        <button type="button" className="primary-button" onClick={onSetup}>Choose categories <ArrowRight size={17}/></button></>
      :<><p>Your partner is choosing the categories. Watch their selection update live.</p>
        <div className="henyo-live-categories" aria-label="Partner's live category selection" role="status" aria-live="polite">
         <div className="henyo-live-heading"><span className="henyo-live-pulse"/><strong>Live selection</strong><small>{game.foreheadCategoryDraft?.length??0} selected</small></div>
         <div className="henyo-live-category-grid">
          {GAME_CATEGORIES.map(cat=>{
           const chosen=game.foreheadCategoryDraft?.includes(cat)??false;
           return <span key={cat} className={chosen?"chosen":""}><span>{GAME_CATEGORY_LABELS[cat]}</span>{chosen&&<Check size={14} strokeWidth={2.7}/>}</span>;
          })}
         </div>
        </div>
        <p className="henyo-live-caption">{game.foreheadCategoryDraft?.length?"Waiting for your partner to confirm these categories.":"No categories selected yet."}</p>
        </>
      :<>
       <p>{mine?"You confirmed these categories. Your partner must agree too.":"Your partner proposed these categories. Do you agree?"}</p>
       <div className="henyo-invite-categories">{game.foreheadCategories.map(cat=><span key={cat}>{GAME_CATEGORY_LABELS[cat]}</span>)}</div>
       {mine?<p className="henyo-confirmed"><Check size={14}/> Your categories are confirmed.</p>
       :<>
        <label className="henyo-agree-partner"><input type="checkbox" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>
         <span>I agree to play using these exact categories.</span></label>
        <div className="game-actions">
         <button type="button" className="secondary-button" onClick={onCategoriesChange}>Request changes</button>
         <button type="button" className="primary-button" disabled={!agreed}
          onClick={()=>onCategoriesAgree(game.foreheadCategories!)}>Confirm categories <ArrowRight size={17}/></button>
        </div>
       </>}
      </>}
    </div>
   :game.kind==="forehead"&&game.phase==="settings"?
    <div className="invite-area henyo-agreement-stage">
     <h4>Categories agreed!</h4>
     <div className="henyo-invite-categories">{game.foreheadCategories?.map(cat=><span key={cat}>{GAME_CATEGORY_LABELS[cat]}</span>)}</div>
     {mine?<><p>Both players agreed. Choose the difficulty and timer to start Pinoy Henyo.</p>
       <button type="button" className="primary-button" onClick={onSetup}>Set difficulty & timer <ArrowRight size={17}/></button></>
      :<><p>Both players agreed. Your partner is choosing the timer and difficulty.</p>
        <Spinner label="Waiting for game settings"/></>}
    </div>
   :game.kind==="forehead"&&game.phase==="mic"?
    <div className="invite-area henyo-agreement-stage">
     <h4>Enable microphones</h4><p>Both players must allow their microphones before the studio starts.</p>
     <div className="henyo-invite-categories">
      <span>{game.micReady?.[side]?"You: mic ready":"You: waiting for permission"}</span>
      <span>{game.micReady?.[side===0?1:0]?"Partner: mic ready":"Partner: waiting for permission"}</span>
     </div>
     <Spinner label="Waiting for both players"/>
    </div>
   :game.kind==="forehead"&&game.phase==="loading"?
    <div className="invite-area henyo-agreement-stage">
     <h4>Preparing the 3D studio</h4>
     <p>Loading characters, lighting and stage before the timer starts.</p>
     <div className="henyo-invite-categories">
      <span>{game.sceneReady?.[0]?"Player 1 ready":"Player 1 loading"}</span>
      <span>{game.sceneReady?.[1]?"Player 2 ready":"Player 2 loading"}</span>
     </div>
     <Spinner label="Waiting for both players"/>
    </div>
   :game.kind==="rps"?<div className="arcade-mini rps-mini"><p>{game.phase==="loading"?"Preparing the full-screen 3D match…":game.phase==="finished"?result:`Round ${game.rps?.round??1} · You ${game.rps?.scores[side]??0}–${game.rps?.scores[side===0?1:0]??0} partner`}</p><button className="primary-button" onClick={onExpand}><Gamepad2 size={16}/> {game.phase==="finished"?"View results":"Open game"} <ArrowRight size={16}/></button></div>
   :(game.kind==="memory"||game.kind==="pong"||game.kind==="forehead")?<div className="arcade-mini"><p>{game.phase==="finished"?"Round finished — see the results.":"Your arcade match is live!"}</p><button className="primary-button" onClick={onExpand}><Gamepad2 size={16}/> {game.phase==="finished"?"View results":"Open game"} <ArrowRight size={16}/></button></div>
   :<div className="playing-area">
    <div className={"game-state-text "+(gameDone?" ended":"")}>{gameDone?<><Trophy size={17}/>{result}</>:
      (game.turn===side?"Your turn":"Their turn")}</div>
    <div className="grid-game">{(game.board||Array(9).fill(null)).map((cell,i)=><button key={i} type="button" className={"grid-cell "+(cell!==null?(cell===side?"is-me":"is-them"):"")} onClick={()=>onMove(i)} disabled={cell!==null||gameDone||game.turn!==side} aria-label={"Square "+(i+1)}>{cell!==null&&(cell===0?<X size={27} strokeWidth={3}/>:<CircleX size={28} strokeWidth={2.5}/>)}</button>)}</div>
    <small className="play-note">{gameDone?"You can request a rematch.":"Connect three to win."}</small>
   </div>}
 </div>;
}
