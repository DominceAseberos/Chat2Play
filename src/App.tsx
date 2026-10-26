import {GAME_CATEGORIES,GAME_CATEGORY_LABELS,type GameCategory} from "../server/foreheadWordBank";
import { useEffect, useMemo, useRef, useState, type FormEvent, type UIEvent } from "react";
import { io } from "socket.io-client";
import HenyoVoice from "./HenyoVoice";
import { ArcadeView } from "./ArcadeView";
import {loadMatchingProfile,saveMatchingProfile,clearMatchingProfile} from "./savedProfile";
import {lazy,Suspense} from "react";
const ForeheadView=lazy(()=>import("./ForeheadView"));
const RpsFullView=lazy(()=>import("./RpsFullView"));
import MatchMorph from "./MatchMorph";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, BadgeCheck, Check, CheckCheck, ChevronRight, CircleHelp, Clock3, Gamepad2, Heart, Image, LockKeyhole, Menu, MessageCircle, Mic, Moon, MoreHorizontal, RotateCcw, Send, Settings2, ShieldCheck, Shuffle, Smile, Sparkles, Sun, UserRound, Users, WifiOff, X } from "lucide-react";
import { ChatSkeleton, FancySelect, GamePanel, GameSymbol, GAMES, GENDERS, genderText, Logo, Modal, PREFS, ReactionPicker, Spinner, StickerArt, TypingIndicator, type ChatMessage, type Game, type Gender, type Kind, type Preference, type Side, type Sticker, type Theme } from "./Pieces";

type Mode = "home" | "searching" | "matched" | "chat" | "ended";
type Like = { yours: boolean; theirs: boolean; mutual: boolean };
type Received = ChatMessage;
const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;
const formattedTime = (value: number) => new Date(value).toLocaleTimeString(undefined, {hour:"numeric",minute:"2-digit"});
const initialLike = { yours:false, theirs:false, mutual:false };
function useStoredTheme() {
 const [theme,setTheme] = useState<Theme>(()=>localStorage.getItem("c2p:theme-noir")==="light"?"light":"dark");
 useEffect(()=>{document.documentElement.dataset.theme=theme;localStorage.setItem("c2p:theme-noir",theme);document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="dark"?"#090b10":"#eeeef2");},[theme]);
 return [theme,setTheme] as const;
}
function App(){
 const socket=useMemo(()=>io(SOCKET_URL,{transports:["websocket","polling"],tryAllTransports:true,autoConnect:false,reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:700,reconnectionDelayMax:7000,randomizationFactor:.45,timeout:10000}),[]);
 const [theme,setTheme]=useStoredTheme();
 const [savedProfile]=useState(loadMatchingProfile);
 const [setupCompleted,setSetupCompleted]=useState(Boolean(savedProfile));
 const [reduceMotion,setReduceMotion]=useState(()=>localStorage.getItem("c2p:reduceMotion")==="true");
 const [connected,setConnected]=useState(false);
 const [online,setOnline]=useState(0);
 const [searching,setSearching]=useState(0);
 const [mode,setMode]=useState<Mode>("home");
 const [homeStep,setHomeStep]=useState(()=>savedProfile?3:0);
 const [mobileLayout,setMobileLayout]=useState(()=>window.matchMedia("(max-width:700px)").matches);
 const [expandedMessage,setExpandedMessage]=useState<ChatMessage|null>(null);
 const [detailPage,setDetailPage]=useState(0);
 const [gender,setGender]=useState<Gender>(()=>savedProfile?.gender??"unspecified");
 const [lookingFor,setLookingFor]=useState<Preference>(()=>savedProfile?.lookingFor??"any");
 const [fallback,setFallback]=useState<"automatic"|"strict">(()=>savedProfile?.fallback??"automatic");
 const [interests,setInterests]=useState<Kind[]>(()=>savedProfile?.interests??["memory","pong"]);
 const [adult,setAdult]=useState(Boolean(savedProfile));
 const [side,setSide]=useState<Side>(0);
 const [partnerGender,setPartnerGender]=useState<Gender>("unspecified");
 const [commonGames,setCommonGames]=useState<Kind[]>([]);
 const [matchType,setMatchType]=useState<"preferred"|"fallback">("preferred");
 const [messages,setMessages]=useState<ChatMessage[]>([]);
 const [game,setGame]=useState<Game|null>(null);
 const [likes,setLikes]=useState<Like>(initialLike);
 const [draft,setDraft]=useState("");
 const [partnerTyping,setPartnerTyping]=useState(false);
 const [notice,setNotice]=useState("");
 const [pickerOpen,setPickerOpen]=useState(false);
 const [gamesOpen,setGamesOpen]=useState(false);
 const [henyoSetupOpen,setHenyoSetupOpen]=useState(false);
 const [henyoDifficulty,setHenyoDifficulty]=useState<"easy"|"medium"|"hard">("medium");
 const [henyoMinutes,setHenyoMinutes]=useState(2);
 const [henyoCategories,setHenyoCategories]=useState<GameCategory[]>(["Animal","Food","Place"]);
 const [henyoCategoryStep,setHenyoCategoryStep]=useState(0);
 const [henyoCategoryConsent,setHenyoCategoryConsent]=useState(false);
 const [arcadeOpen,setArcadeOpen]=useState(false);
 const [settingsOpen,setSettingsOpen]=useState(false);
 const [settingsPage,setSettingsPage]=useState(0);
 const [detailsOpen,setDetailsOpen]=useState(false);
 const [reportOpen,setReportOpen]=useState(false);
 const [nextConfirm,setNextConfirm]=useState(false);
 const [quitGameId,setQuitGameId]=useState<string|null>(null);
 const [pendingJoin,setPendingJoin]=useState(false);
 const [autoConfirmNext,setAutoConfirmNext]=useState(()=>localStorage.getItem("c2p:autoNext")==="true");
 const [typingSounds,setTypingSounds]=useState(()=>localStorage.getItem("c2p:typingSounds")!=="false");
 const [connectionIssue,setConnectionIssue]=useState(false);
 const [partnerConnected,setPartnerConnected]=useState(true);
 const [partnerAway,setPartnerAway]=useState(false);
 const [endedReason,setEndedReason]=useState("");
 const [temporaryHint,setTemporaryHint]=useState(true);
 const bottom=useRef<HTMLDivElement|null>(null);
 const followLatestMessage=useRef(true);
 const stopTyping=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const typingClear=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const matchTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const activeMatch=useRef(false);
 const reducedRef=useRef(reduceMotion);
 const draftRef=useRef<HTMLTextAreaElement|null>(null);
 const reconnectingRef=useRef(false);
 const typingRef=useRef(false);
 const soundsRef=useRef(typingSounds);
 const lastTypingTone=useRef(0);
 const soundCtx=useRef<AudioContext|null>(null);
 const modeRef=useRef<Mode>("home");

 useEffect(()=>{reducedRef.current=reduceMotion;document.documentElement.dataset.reducedMotion=String(reduceMotion);localStorage.setItem("c2p:reduceMotion",String(reduceMotion));},[reduceMotion]);
 useEffect(()=>{modeRef.current=mode;},[mode]);
 useEffect(()=>{localStorage.setItem("c2p:autoNext",String(autoConfirmNext));},[autoConfirmNext]);
 useEffect(()=>{soundsRef.current=typingSounds;localStorage.setItem("c2p:typingSounds",String(typingSounds));},[typingSounds]);
 useEffect(()=>{if(mode!=="chat"||messages.length){setTemporaryHint(false);return;}setTemporaryHint(true);const t=window.setTimeout(()=>setTemporaryHint(false),6000);return()=>window.clearTimeout(t);},[mode,messages.length===0]);
 useEffect(()=>{const emit=()=>{if(socket.connected)socket.emit("presence:activity",document.hidden);};document.addEventListener("visibilitychange",emit);const onOnline=()=>{if(!socket.connected)socket.connect();};window.addEventListener("online",onOnline);return()=>{document.removeEventListener("visibilitychange",emit);window.removeEventListener("online",onOnline);};},[socket]);
 function unlockTypingAudio(){if(!typingSounds)return;try{const ctx=soundCtx.current||new AudioContext();soundCtx.current=ctx;if(ctx.state==="suspended")void ctx.resume().catch(()=>{});}catch{/* Device does not support audio; typing dots still work. */}}
 function playTypingTone(){
   if(!soundsRef.current||document.hidden||Date.now()-lastTypingTone.current<3500)return;
   lastTypingTone.current=Date.now();
   try{const ctx=soundCtx.current;if(!ctx||ctx.state!=="running")return;const start=ctx.currentTime;
    for(let i=0;i<2;i++){const osc=ctx.createOscillator(),gain=ctx.createGain(),at=start+i*.085;osc.type="sine";osc.frequency.value=i?660:540;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.022,at+.01);gain.gain.exponentialRampToValueAtTime(.0001,at+.10);osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.11);}}
   catch{/* Audio permission is optional; typing dots remain visible. */}
 }
 useEffect(()=>{window.scrollTo({top:0,behavior:"instant"});},[mode]);
 useEffect(()=>{const media=window.matchMedia("(max-width:700px)");const update=()=>setMobileLayout(media.matches);media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 useEffect(()=>{if(mode==="home")setHomeStep(setupCompleted?3:0);},[mode,setupCompleted]);
 useEffect(()=>{
  if(!setupCompleted||!adult)return;
  saveMatchingProfile({completed:true,gender,lookingFor,interests,fallback});
 },[setupCompleted,adult,gender,lookingFor,interests,fallback]);
 useEffect(()=>{
  // Invitation must be accepted before either setup page is visible.
  if(game?.kind!=="forehead"||game.by!==side){
   setHenyoSetupOpen(false);
   return;
  }
  if(game.phase==="categories"){
   setHenyoCategoryStep(0);
   setHenyoSetupOpen(!game.categoryAgreement?.[side]);
   return;
  }
  if(game.phase==="settings"){
   setHenyoCategoryStep(1);
   setHenyoSetupOpen(true);
   return;
  }
  setHenyoSetupOpen(false);
 },[game?.id,game?.kind,game?.phase,game?.by,game?.categoryAgreement?.[side],side]);
 useEffect(()=>{
  if(!game){setArcadeOpen(false);return;}
  if(game.phase==="invite"){setGamesOpen(false);setArcadeOpen(false);return;}
  if(game.kind==="rps"&&game.phase==="loading"){setGamesOpen(false);setArcadeOpen(true);return;}
  if((game.phase==="playing"||(game.phase==="loading"&&(game.kind==="forehead"||game.kind==="pong")))
    &&(game.kind==="memory"||game.kind==="pong"||game.kind==="forehead")){setGamesOpen(false);setArcadeOpen(true);}
 },[game?.id,game?.phase,game?.kind]);
 useEffect(()=>{
  const onConnect=()=>{
    setConnected(true);setConnectionIssue(false);setNotice("");
    if(reconnectingRef.current){reconnectingRef.current=false;
      if(!socket.recovered){setEndedReason("Your connection returned, but your previous chat could not be restored.");setMode(current=>current==="chat"||current==="matched"?"ended":current==="searching"?"home":current);setNotice("Connection restored. Start a new search when you're ready.");}
      else setNotice("");
    }
  };
  const cancelFound=()=>{activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);matchTimer.current=undefined;};
  const onDisconnect=()=>{cancelFound();reconnectingRef.current=true;setConnected(false);setConnectionIssue(true);setPendingJoin(false);setPartnerTyping(false);};
  const onPresence=(p:{online:number;searching:number})=>{setOnline(p.online);setSearching(p.searching);};
  const onWaiting=()=>{setPendingJoin(false);setMode("searching");};
  const onMatch=(m:{side:Side;partnerGender:Gender;commonGames:Kind[];matchType?:"preferred"|"fallback"})=>{
   followLatestMessage.current=true;
   setSide(m.side);setPartnerGender(m.partnerGender);setCommonGames(m.commonGames);setMatchType(m.matchType==="fallback"?"fallback":"preferred");setMessages([]);
   cancelFound();activeMatch.current=true;
   setGame(null);setLikes(initialLike);setPartnerTyping(false);setPartnerConnected(true);setPartnerAway(false);setEndedReason("");setMode("matched");
   setPendingJoin(false);setPickerOpen(false);setGamesOpen(false);setNotice("");
   matchTimer.current=setTimeout(()=>{
     matchTimer.current=undefined;
     if(activeMatch.current&&socket.connected){activeMatch.current=false;setMode("chat");}
   },reducedRef.current?550:1300);
  };
  const onEnd=(m:{reason:string})=>{
   cancelFound();
   setGame(null);setPartnerTyping(false);setLikes(initialLike);setPickerOpen(false);
   setGamesOpen(false);setArcadeOpen(false);setPartnerConnected(false);
   setEndedReason(m.reason);
   setMode(prev=>prev==="searching"||prev==="home"?prev:"ended");
   setNotice("");
  };
  const onChat=(m:Received)=>{
   setMessages(prev=>{
    const found=prev.some(x=>x.id===m.id);
    return found?prev.map(x=>x.id===m.id?{...m,pending:false}:x):[...prev,{...m,pending:false}].slice(-250);
   });
   if(m.from!==0&&m.from!==1)return;
   setPartnerTyping(false);typingRef.current=false;
  };
  const onGame=(g:Game|null)=>{setGame(g);if(!g)setQuitGameId(null);};
  const onGameClosed=(closed:{id:string;kind:Kind;bySelf:boolean})=>{
   const name=GAMES.find(g=>g.id===closed.kind)?.title??"the game";
   setQuitGameId(null);
   setArcadeOpen(false);
   setGamesOpen(false);
   setNotice(closed.bySelf
    ? "You left "+name+". Your chat is still open."
    : "Your partner left "+name+". You can keep chatting.");
  };
  const onRpsRematchEnded=()=>{
   setArcadeOpen(false);setGamesOpen(false);
   setNotice("Rematch request expired. You are back in chat.");
  };
  const onLike=(l:Like)=>setLikes(l);
  const onTyping=(p:{active:boolean})=>{
   if(p.active&&!typingRef.current)playTypingTone();
   typingRef.current=p.active;setPartnerTyping(p.active);
   if(typingClear.current)clearTimeout(typingClear.current);
   if(p.active)typingClear.current=setTimeout(()=>{setPartnerTyping(false);typingRef.current=false;},3500);
  };
  const onPartnerConnection=(data:{connected:boolean})=>{setPartnerConnected(data.connected);if(!data.connected){setPartnerAway(false);setPartnerTyping(false);setArcadeOpen(false);}};
  const onPartnerActivity=(data:{away:boolean})=>{setPartnerAway(data.away);if(data.away)setPartnerTyping(false);};
  const onSessionLost=()=>{setEndedReason("Your previous chat expired while you were offline.");setMode(current=>current==="chat"||current==="matched"?"ended":"home");};
  const onSessionState=(data:{phase:string;side:Side;partnerGender:Gender;commonGames:Kind[];matchType:"preferred"|"fallback"})=>{
    if(data.phase!=="chat")return;
    setSide(data.side);setPartnerGender(data.partnerGender);setCommonGames(data.commonGames);setMatchType(data.matchType);
    setPartnerConnected(true);setConnectionIssue(false);setEndedReason("");setMode("chat");
  };
  const onError=(reason:string)=>{setNotice(reason);setPendingJoin(false);if(modeRef.current==="searching"){setHomeStep(3);setMode("home");}};
  const onConnectError=()=>{setConnectionIssue(true);setNotice("Unable to connect. Check your internet and tap Retry.");};
  socket.on("connect",onConnect);socket.on("disconnect",onDisconnect);socket.on("connect_error",onConnectError);
  socket.on("presence:update",onPresence);socket.on("queue:waiting",onWaiting);
  socket.on("match:found",onMatch);socket.on("match:ended",onEnd);
  socket.on("chat:message",onChat);socket.on("chat:typing",onTyping);
  socket.on("partner:connection",onPartnerConnection);socket.on("partner:activity",onPartnerActivity);socket.on("session:state",onSessionState);socket.on("session:lost",onSessionLost);
  socket.on("game:state",onGame);socket.on("game:closed",onGameClosed);socket.on("rps:rematch-ended",onRpsRematchEnded);socket.on("like:state",onLike);
  socket.on("system:error",onError);socket.on("system:notice",onError);
  socket.connect();
  return ()=>{
   socket.off("connect",onConnect);socket.off("disconnect",onDisconnect);socket.off("connect_error",onConnectError);socket.off("presence:update",onPresence);
   socket.off("queue:waiting",onWaiting);socket.off("match:found",onMatch);socket.off("match:ended",onEnd);
   socket.off("chat:message",onChat);socket.off("chat:typing",onTyping);
   socket.off("partner:connection",onPartnerConnection);socket.off("partner:activity",onPartnerActivity);socket.off("session:state",onSessionState);socket.off("session:lost",onSessionLost);
   socket.off("game:state",onGame);socket.off("game:closed",onGameClosed);socket.off("rps:rematch-ended",onRpsRematchEnded);socket.off("like:state",onLike);
   socket.off("system:error",onError);socket.off("system:notice",onError);
   cancelFound();
   socket.disconnect();if(stopTyping.current)clearTimeout(stopTyping.current);if(typingClear.current)clearTimeout(typingClear.current);
  };
 },[socket]);
 // Keep the active match history visible like a normal messenger. Follow new
 // messages at the bottom unless the user has scrolled up to read older ones.
 useEffect(()=>{
  const pane=bottom.current?.closest(".conversation-scroll");
  if(pane&&followLatestMessage.current)pane.scrollTop=pane.scrollHeight;
 },[messages.length,mode]);
 function onConversationScroll(e:UIEvent<HTMLDivElement>){
  const pane=e.currentTarget;
  followLatestMessage.current=pane.scrollHeight-pane.scrollTop-pane.clientHeight<75;
 }
 function join(){
  if(!connected||!adult)return;
  const profile={gender,lookingFor,interests,fallback,isAdult:true};
  saveMatchingProfile({completed:true,gender,lookingFor,interests,fallback});
  setSetupCompleted(true);
  setNotice("");setPendingJoin(true);setMode("searching");
  socket.emit("queue:join",profile);
 }
 function leave(){
  activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);
  if(socket.connected)socket.emit(mode==="searching"?"queue:cancel":"match:leave");
  setMode("home");setHomeStep(setupCompleted?3:0);setMessages([]);setGame(null);setPickerOpen(false);
  setGamesOpen(false);setPartnerTyping(false);setNextConfirm(false);setNotice("");
 }
 function next(){
  if(!socket.connected)return;
  if(mode==="ended"){setNextConfirm(false);join();return;}
  activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);
  setNextConfirm(false);setPickerOpen(false);setGamesOpen(false);
  setMode("searching");setMessages([]);setGame(null);setPartnerTyping(false);
  socket.emit("match:next",{gender,lookingFor,interests,fallback,isAdult:adult});
 }
 function requestNext(){if(autoConfirmNext)next();else setNextConfirm(true);}
 function inviteToGame(kind:Kind){
  if(!canChat||(game&&(game.phase!=="finished"||game.rps?.rematch)))return;
  // Close the game picker as soon as a game is chosen.
  // The synchronized invitation remains visible in the chat.
  setGamesOpen(false);
  setPickerOpen(false);
  if(kind==="forehead")setHenyoCategoryConsent(false);
  socket.emit("game:propose",kind);
 }
 // Broadcast category toggles while the inviter is editing, without implying
 // agreement. Only changes in active category/selection re-emit previews.
 useEffect(()=>{
  if(!henyoSetupOpen||!connected||!partnerConnected||game?.kind!=="forehead"||game.phase!=="categories"
    ||game.by!==side||game.categoryAgreement?.[side]||game.foreheadCategories)return;
  socket.emit("forehead:categories:preview",{id:game.id,categories:henyoCategories});
 },[henyoCategories,henyoSetupOpen,connected,partnerConnected,game?.id,game?.phase,game?.by,game?.categoryAgreement?.[side],game?.foreheadCategories,side,socket]);
 function sendHenyoCategories(){
  if(!canChat||game?.kind!=="forehead"||game.phase!=="categories"||game.by!==side
   ||game.categoryAgreement?.[side]||!henyoCategoryConsent||henyoCategories.length===0)return;
  socket.emit("forehead:categories:select",{id:game.id,categories:henyoCategories,confirmed:true});
  setHenyoSetupOpen(false);
 }
 function sendHenyoSettings(){
  if(!canChat||game?.kind!=="forehead"||game.phase!=="settings"||game.by!==side
   ||!game.categoryAgreement?.every(Boolean))return;
  socket.emit("forehead:configure",{id:game.id,difficulty:henyoDifficulty,durationSeconds:henyoMinutes*60});
  setHenyoSetupOpen(false);
 }
 function requestQuitGame(){
  if(!game)return;
  setQuitGameId(game.id);
 }
 function backFromRps(){
  if(game?.kind==="rps")socket.emit("rps:view",{id:game.id,viewing:false});
  setArcadeOpen(false);setGamesOpen(false);
 }
 function confirmQuitGame(){
  if(!game||!quitGameId||game.id!==quitGameId||!socket.connected){
   setQuitGameId(null);
   return;
  }
  // Only the active game ID is accepted, protecting a replacement game.
  socket.emit("game:close",{id:quitGameId});
  setQuitGameId(null);
 }
 function resetRememberedSetup(){
  if(mode!=="home"&&mode!=="ended")return;
  clearMatchingProfile();
  setSetupCompleted(false);
  setAdult(false);
  setGender("unspecified");
  setLookingFor("any");
  setInterests(["memory","pong"]);
  setFallback("automatic");
  setHomeStep(0);
  if(mode==="ended")setMode("home");
  setSettingsOpen(false);
  setSettingsPage(0);
 }
 function retryMessage(message:ChatMessage){
  if(!socket.connected||mode!=="chat"||!partnerConnected)return;
  const {id,kind,text,url,sticker}=message;
  setMessages(prev=>prev.map(m=>m.id===id?{...m,failed:false,pending:true}:m));
  socket.timeout(5000).emit("chat:send",{id,kind,text,url,sticker},(err:Error|null,result?:{ok:boolean;error?:string})=>{
   setMessages(prev=>prev.map(m=>m.id===id?{...m,pending:false,failed:!!err||!result?.ok}:m));
   if(result?.error)setNotice(result.error);
  });
 }
 function sendPayload(payload:Omit<ChatMessage,"id"|"from"|"at"|"pending">){
  if(mode!=="chat"||!socket.connected||!partnerConnected)return;
  const id=crypto.randomUUID();
  followLatestMessage.current=true;
  setMessages(prev=>[...prev,{...payload,id,from:side,at:Date.now(),pending:true}].slice(-250));
  socket.timeout(5000).emit("chat:send",{...payload,id},(err:Error|null,result?:{ok:boolean;error?:string})=>{
   setMessages(prev=>prev.map(m=>m.id===id?{...m,pending:false,failed:!!err||!result?.ok}:m));
   if(result?.error)setNotice(result.error);
  });
  setPickerOpen(false);
 }
 function send(e:FormEvent){e.preventDefault();if(!draft.trim()||!socket.connected||!partnerConnected)return;sendPayload({kind:"text",text:draft.trim().slice(0,500)});setDraft("");if(socket.connected)socket.emit("chat:typing",false);}
 function onDraft(value:string){
  setDraft(value);if(mode!=="chat"||!socket.connected)return;socket.emit("chat:typing",value.trim().length>0);
  if(stopTyping.current)clearTimeout(stopTyping.current);
  stopTyping.current=setTimeout(()=>{if(socket.connected)socket.emit("chat:typing",false);},1100);
 }
 function sendEmoji(emoji:string){setDraft(s=>s+emoji);draftRef.current?.focus();}
 function onReport(reason:string){if(!socket.connected){setNotice("Reconnect before submitting a report.");setReportOpen(false);return;}socket.emit("report:send",{reason});setReportOpen(false);setMode("home");setNotice("Report submitted to this demo. Human moderation is not enabled.");}
 const canFind=adult&&connected&&!pendingJoin;
 const allGamesSelected=interests.length===GAMES.length;
 const canChat=connected&&partnerConnected;

 return <div className="c2p-app" onPointerDown={unlockTypingAudio}>
  <header className="topbar">
   <button className="brand-button" type="button" onClick={()=>mode==="home"?setHomeStep(setupCompleted?3:0):setNextConfirm(true)} aria-label="Chat2Play home"><Logo/></button>
   <div className="topbar-right"><span className="online-status"><span className={"live-indicator"+(connected?"":" disconnected")}/>{connected?<><strong>{online}</strong> online</>:"Connecting"}</span>
    <span className="topbar-divider"/>
    <button type="button" className="icon-button settings-trigger" aria-label="Open settings" title="Settings" onClick={()=>setSettingsOpen(true)}><Settings2 size={19}/></button>
   </div>
  </header>
  <AnimatePresence mode="wait">
   {mode==="home"&&<motion.main className={"home-container mobile-home-step-"+homeStep+(setupCompleted?" profile-returning":"")} key="home" initial={reduceMotion?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.25}}>
    <div className="home-layout">
     <section className="hero">
       <span className="overline"><span className="overline-dot"/>{connected?"ANONYMOUS · LIVE · TOGETHER":"CONNECTING TO CHAT2PLAY"}</span>
       <h1>Good chemistry<br/>starts with<br/><em>a little play.</em></h1>
       <p>Someone new is one tap away. Meet anonymously, have a real conversation, and find your connection through play.</p>
       <div className="hero-tags"><span><Shuffle size={17}/> Real-time matching</span><span><LockKeyhole size={17}/> Chat disappears</span></div>
       <div className="illustration" aria-hidden="true"><div className="illustration-gradient"/>
         <motion.div className="illustration-message floating-left" animate={reduceMotion?{}:{y:[0,-9,0]}} transition={{duration:4,repeat:Infinity,ease:"easeInOut"}}><span className="bubble-avatar"><UserRound size={19}/></span>Hey, wanna play?</motion.div>
         <motion.div className="illustration-board" animate={reduceMotion?{}:{rotate:[-5,-2,-5]}} transition={{duration:5,repeat:Infinity}}><span><X size={30}/></span><span><Check size={26}/></span><span><X size={30}/></span><span><Check size={26}/></span><span><X size={30}/></span><span><Check size={26}/></span></motion.div>
         <motion.div className="illustration-message floating-right" animate={reduceMotion?{}:{y:[0,8,0]}} transition={{duration:4.5,repeat:Infinity}}><span className="bubble-game"><Gamepad2 size={20}/></span>You're on!</motion.div>
         <span className="illustration-decor decor-one"><Sparkles size={33}/></span><span className="illustration-decor decor-two"><Heart size={27}/></span>
       </div>
     </section>
     <section className="form-card">
      <div className="form-card-title"><div className="form-card-icon"><Users size={22}/></div><div><div className="form-kicker">YOUR NEXT CONNECTION</div><h2>{setupCompleted?"Welcome back.":"Meet someone new."}</h2><p>{setupCompleted?"Your setup is saved. Find your next match or edit it in Settings.":"Just your vibe. No account required."}</p></div></div>
      <div className="form-line"/>
      <div className="setup-step setup-step-preferences"><div className="mobile-step-heading"><span>01 / 03 | YOUR VIBE</span><h3>Let's start with you.</h3><p>Choose who you'd like to meet.</p></div>
      <div className="form-field"><div className="form-label"><label>How do you identify?</label><span>Optional</span></div><FancySelect value={gender} onChange={setGender} items={GENDERS} label="My gender"/></div>
      <div className="form-field"><div className="form-label"><label>Who would you like to meet?</label></div><FancySelect value={lookingFor} onChange={setLookingFor} items={PREFS} label="Match preference"/><p className="field-note">Matches happen only when your preferences align.</p></div></div>
      <div className="setup-step setup-step-games"><div className="mobile-step-heading"><span>02 / 03 | PLAY TOGETHER</span><h3>Pick your games.</h3><p>Choose a few, or leave them all unselected.</p></div>
      <div className="form-field"><div className="form-label"><label>Pick your favorite games</label><button type="button" className="select-all-games" aria-pressed={allGamesSelected} onClick={()=>setInterests(allGamesSelected?[]:GAMES.map(g=>g.id))}>{allGamesSelected?"Clear all":"Select all"} <CheckCheck size={15}/></button></div><div className="game-choices">{GAMES.map(g=><button type="button" key={g.id} className={"game-choice"+(interests.includes(g.id)?" chosen":"")} aria-pressed={interests.includes(g.id)} onClick={()=>setInterests(prev=>prev.includes(g.id)?prev.filter(x=>x!==g.id):[...prev,g.id])}><span className={"game-choice-symbol "+g.id}><GameSymbol id={g.id}/></span><span>{g.title}</span><span className="choice-checkbox">{interests.includes(g.id)&&<Check size={12}/>}</span></button>)}</div></div>
      <label className="fallback-choice"><input type="checkbox" checked={fallback==="automatic"} onChange={e=>setFallback(e.target.checked?"automatic":"strict")}/><span><strong>Flexible matching</strong><small>{fallback==="automatic"?"After 8 seconds, match with any available stranger if you both allow it.":"Only match people who fit both preferences, even if it takes longer."}</small></span></label></div>
      <div className="setup-step setup-step-ready"><div className="mobile-step-heading"><span>03 / 03 | READY TO CONNECT</span><h3>{setupCompleted?"Welcome back!":"You're all set."}</h3><p>{setupCompleted?"Your matching choices are remembered on this device. Edit them in Settings.":"Confirm you're 18 or older to start matching with a real person."}</p></div>
      <div className="ready-summary"><span><UserRound size={17}/> {genderText(gender)} - Looking for {lookingFor==="any"?"anyone":lookingFor}</span><span><Gamepad2 size={17}/> {interests.length?interests.length+" selected games":"Any games"} - {fallback==="automatic"?"Flexible matching":"Strict matching"}</span></div>
      {setupCompleted?<div className="returning-confirm"><Check size={16}/> 18+ confirmation saved on this device</div>
       :<label className="consent"><input type="checkbox" checked={adult} onChange={e=>setAdult(e.target.checked)}/><span>I'm <b>18 or older</b> and agree to keep this space respectful.</span></label>}
      <button className="primary-button match-button" disabled={!canFind} onClick={join} type="button">{pendingJoin||!connected?<Spinner label="Connecting"/>:<><Sparkles size={18}/><span>Find a stranger</span><ArrowRight size={19}/></>}</button>
      <div className="under-button"><LockKeyhole size={14}/> {setupCompleted?"Only setup preferences are saved, never your chat history.":"Conversations disappear when your chat ends."}</div>
      {setupCompleted&&<button className="edit-saved-setup" type="button" onClick={()=>{setSettingsPage(2);setSettingsOpen(true);}}><Settings2 size={15}/> Edit matching preferences</button>}
      {notice&&<div className="notice-banner" role="status">{notice}</div>}
      </div>
     </section>
    </div>
    {!setupCompleted&&<nav className="home-pager" aria-label="Setup steps">
      <button type="button" className="home-pager-back" onClick={()=>setHomeStep(step=>Math.max(0,step-1))} disabled={homeStep===0} aria-label="Previous step"><ArrowLeft size={18}/> Back</button>
      <span className="home-pager-progress" aria-label={"Step "+(homeStep+1)+" of 4"}>{[0,1,2,3].map(step=><i key={step} className={step===homeStep?"active":""}/>)}</span>
      {homeStep<3?<button type="button" className="home-pager-next" onClick={()=>setHomeStep(step=>Math.min(3,step+1))}>{homeStep===0?"Get started":"Continue"} <ArrowRight size={18}/></button>:<span className="home-pager-finish">Ready to match</span>}
    </nav>}
    <section className="quick-steps" aria-label="How it works">
      <div className="quick-step"><span className="step-symbol"><Shuffle size={20}/></span><div><strong>01. Match</strong><span>Find someone new</span></div></div>
      <div className="quick-step"><span className="step-symbol"><MessageCircle size={20}/></span><div><strong>02. Chat</strong><span>Get the conversation going</span></div></div>
      <div className="quick-step"><span className="step-symbol"><Gamepad2 size={20}/></span><div><strong>03. Play</strong><span>Break the ice together</span></div></div>
    </section>
   </motion.main>}
   {mode==="searching"&&<motion.main className="search-container" key="search" initial={reduceMotion?false:{opacity:0,y:14}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
     <div className="search-inner"><div className="radar-art"><MatchMorph reduceMotion={reduceMotion}/></div>
     <span className="overline"><span className="overline-dot"/> FINDING YOUR MATCH</span>
     <h2>Looking for your<br/><em>next game buddy.</em></h2><p>{fallback==="automatic"?"Looking for your best match. After a short wait, we may connect you with someone else who opted into flexible matching.":"Searching for a mutual preference match. Keep this page open."}</p>
     <div className="waiting-pill"><Spinner label={searching>0?"Checking live matches…":"Connecting you…"}/></div>
     <div className="search-chat-skeleton"><ChatSkeleton/><ChatSkeleton/><div className="skeleton-composer shimmer"/></div>
     <button className="outline-button cancel-search" type="button" onClick={leave}><X size={17}/> Cancel search</button></div>
   </motion.main>}
   {mode==="matched"&&<motion.main className="search-container matched-screen" key="matched"
     initial={reduceMotion?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
     transition={{duration:reduceMotion?0:.14}}>
     <div className="search-inner matched-inner" role="status" aria-live="polite">
       <div className="radar-art"><MatchMorph reduceMotion={reduceMotion} matched/></div>
       <span className="overline"><span className="overline-dot"/> MATCH FOUND</span>
       <h2>Match<br/><em>found.</em></h2>
       <p>Opening your conversationâ€¦</p>
       <div className="waiting-pill matched-pill"><Check size={17}/> Connected successfully</div>
     </div>
   </motion.main>}
   {mode==="ended"&&<motion.main className="search-container ended-screen" key="ended" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}>
    <div className="search-inner ended-inner" role="status"><span className="ended-icon"><WifiOff size={29}/></span><span className="overline">CONVERSATION ENDED</span><h2>Your stranger<br/><em>has left.</em></h2><p>{endedReason||"The conversation has ended. You can look for another real person."}</p><p className="ended-subtext">Your temporary messages are not saved after this session.</p><button className="primary-button find-again-button" type="button" disabled={!connected} onClick={requestNext}><Shuffle size={18}/> Find another stranger <ArrowRight size={18}/></button><button className="outline-button" type="button" onClick={leave}><ArrowLeft size={16}/> Back to home</button></div>
   </motion.main>}
   {mode==="chat"&&<motion.main className="chat-layout" key="chat" initial={reduceMotion?false:{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} transition={{duration:.2}}>
    <section className="chat-card">
     <div className="chat-header">
      <div className="partner-title">
       <button className="partner-avatar" aria-label="View partner details" title="View partner details" onClick={()=>setDetailsOpen(true)}><UserRound size={22}/><span className="avatar-dot"/></button>
       <button type="button" className="partner-name-button" onClick={()=>setDetailsOpen(true)}><strong>New stranger <ChevronRight size={16}/></strong><small><span className={"tiny-dot"+(!partnerConnected?" disconnected":"")}/>{!partnerConnected?"Reconnecting...":partnerAway?"Away in another tab":partnerTyping?"Typing…":"Online now · Anonymous"}</small></button>
      </div>
      <div className="chat-header-actions">
       <button type="button" aria-label={likes.yours?"Unlike partner":"Like partner"} title="Like partner" className={"icon-button heart-button"+(likes.yours?" liked":"")} onClick={()=>socket.emit("like:toggle")}><Heart size={21} fill={likes.yours?"currentColor":"none"}/></button>
       <button type="button" aria-label="Partner information" title="Partner information" className="icon-button" onClick={()=>setDetailsOpen(true)}><UserRound size={20}/></button>
       <button type="button" aria-label="Report this stranger" title="Report" className="icon-button" onClick={()=>setReportOpen(true)}><MoreHorizontal size={23}/></button>
       <button className="next-button" type="button" onClick={requestNext} disabled={!connected}><Shuffle size={17}/><span>Next</span></button>
      </div>
     </div>
     {game?.kind==="rps"&&!arcadeOpen&&(game.phase==="loading"||game.phase==="playing"||game.phase==="finished")&&
      <button type="button" className="rps-return-to-game" onClick={()=>setArcadeOpen(true)}>
       <Gamepad2 size={17}/><span>{game.rps?.rematch?game.rps.rematch.accepted[side]?"Waiting for your partner to accept the rematch":"Your partner requested a rematch":game.phase==="finished"?"Rock Paper Scissors is complete":game.rps?.pausedBy?.[side]?"Game paused while you're in chat":game.rps?.pausedBy?.some(Boolean)?"Game paused · Partner is outside":"Rock Paper Scissors is in progress"}</span><strong>Return to game</strong><ArrowRight size={16}/>
      </button>}
     {temporaryHint&&<div className="temporary-top-hint" role="status"><LockKeyhole size={13}/> Messages disappear when this chat ends</div>}
     {!partnerConnected&&connected&&<div className="partner-connection-banner" role="status"><Spinner/> Stranger disconnected. Waiting briefly for reconnection...</div>}
     <div className="chat-body">
       <div className="conversation">
        <div className="conversation-scroll" role="log" aria-label="Temporary chat messages" aria-live="polite" onScroll={onConversationScroll}>
          {(!mobileLayout||(messages.length===0&&!game))&&<div className="conversation-start"><div className="conversation-start-icon"><Sparkles size={24}/></div><span className="conversation-overline">A NEW CONNECTION</span><h3>It's just you two.</h3><p>{matchType==="fallback"?"You both allowed flexible matching. Your preferred filters didn't fully align, but you can still say hello and play.":"Don't overthink the first message. Say hello, or break the ice with a game."}</p><button type="button" className="play-icebreaker" disabled={!canChat} onClick={()=>{setGamesOpen(true);setPickerOpen(false);}}><Gamepad2 size={19}/> Play a game together <ArrowRight size={17}/></button></div>}
          {partnerTyping&&<div className="typing-over-chat" role="status"><TypingIndicator/></div>}
          {likes.mutual&&<div className="like-notice"><Heart size={16} fill="currentColor"/> You both liked each other</div>}
          {messages.map(m=><div className={"message-line"+(m.from===side?" mine":" theirs")} key={m.id}>
           {m.from!==side&&<span className="message-avatar"><UserRound size={15}/></span>}
           <div className="bubble-wrap">
            <motion.div initial={reduceMotion?false:{opacity:0,scale:.94,y:5}} animate={{opacity:1,scale:1,y:0}} transition={{duration:.18}} className={"message-bubble"+(m.kind!=="text"?" rich-bubble":"")}>
              {m.kind==="text"?<span>{m.text}</span>:m.kind==="sticker"&&m.sticker?<StickerArt id={m.sticker} size={88}/>:m.url?<img className="gif-message" src={m.url} alt="Animated GIF" loading="lazy" referrerPolicy="no-referrer"/>:null}
            </motion.div>
            {mobileLayout&&m.kind==="text"&&m.text&&m.text.length>180&&<button type="button" className="read-full-message" onClick={()=>{setExpandedMessage(m);setDetailPage(0);}}>Read full message <ChevronRight size={14}/></button>}
            <span className="message-meta">{formattedTime(m.at)}{m.from===side&&(m.pending?<Spinner/>:m.failed?<button type="button" className="retry-message" disabled={!canChat} onClick={()=>retryMessage(m)} title="Retry sending this message">Retry <RotateCcw size={12}/></button>:<CheckCheck size={13} aria-label="Sent"/>)}</span>
           </div>
          </div>)}
          {game&&<div className="inline-game"><GamePanel game={game} side={side} onRespond={yes=>{if(canChat)socket.emit("game:respond",yes);}}
            onCategoriesAgree={categories=>{if(canChat)socket.emit("forehead:categories:agree",{id:game.id,confirmed:true,categories});}}
            onCategoriesChange={()=>{if(canChat)socket.emit("forehead:categories:request-change",{id:game.id});}}
            onSetup={()=>{setHenyoCategoryStep(game.phase==="settings"?1:0);setHenyoSetupOpen(true);}} onMove={move=>{if(canChat)socket.emit("game:move",move);}} onClose={requestQuitGame} onExpand={()=>setArcadeOpen(true)}
             onRpsConfigure={targetWins=>{if(canChat)socket.emit("rps:configure",{id:game.id,targetWins});}}/></div>}
          <div ref={bottom}/>
        </div>
        <div className="composer-area">
          <AnimatePresence>{pickerOpen&&<motion.div className="picker-holder" initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}} transition={{duration:.16}}><div className="picker-heading"><strong>Express yourself</strong><button type="button" className="icon-button" aria-label="Close reactions" onClick={()=>setPickerOpen(false)}><X size={18}/></button></div>
            <ReactionPicker theme={theme} onEmoji={sendEmoji} onSticker={sticker=>sendPayload({kind:"sticker",sticker})} onGif={url=>sendPayload({kind:"gif",url})}/></motion.div>}</AnimatePresence>
          <form className="composer" onSubmit={send}>
            <button className={"composer-action"+(pickerOpen?" active":"")} type="button" aria-label="Choose emoji, GIF or sticker" title="Reactions" onClick={()=>setPickerOpen(v=>!v)}><span className="composer-plus">+</span></button>
            <textarea disabled={!canChat} ref={draftRef} aria-label="Message" placeholder="Type a message…" rows={1} value={draft} maxLength={500}
              onChange={e=>onDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(e as unknown as FormEvent);}}}/>
            <button className="send-button" type="submit" disabled={!draft.trim()||!canChat} aria-label="Send message"><Send size={19}/></button>
          </form>
          <div className="composer-footer"><button className="open-games-button" type="button" onClick={()=>{setGamesOpen(v=>!v);setPickerOpen(false);}}><Gamepad2 size={17}/><span>{gamesOpen?"Hide games":"Play a game"}</span><ChevronRight size={15}/></button><span><LockKeyhole size={13}/> Disappears when you leave</span></div><nav className="chat-dock" aria-label="Chat quick actions"><button type="button" className="dock-selected" onClick={()=>draftRef.current?.focus()} aria-label="Focus chat"><MessageCircle size={20}/><span>Chat</span></button><button type="button" onClick={()=>{setGamesOpen(true);setPickerOpen(false);}} aria-label="Open mini games"><Gamepad2 size={20}/><span>Games</span></button><button type="button" onClick={()=>setDetailsOpen(true)} aria-label="View current stranger"><UserRound size={20}/><span>Stranger</span></button><button type="button" onClick={()=>setSettingsOpen(true)} aria-label="Open appearance settings"><Settings2 size={20}/><span>Settings</span></button></nav>
        </div>
       </div>
       <aside className={"game-sidebar"+(gamesOpen?" game-sidebar-open":"")}>
         <div className="sidebar-top"><span className="sidebar-kicker">PLAY & CONNECT</span><button type="button" className="sidebar-close icon-button" aria-label="Close games" onClick={()=>setGamesOpen(false)}><X size={19}/></button><h3>Break the ice <Gamepad2 size={20}/></h3><p>{game?.phase==="invite"?"Waiting for your partner to answer the invitation.":game?.phase==="categories"?"Both players must agree on the word categories.":game?.phase==="settings"?"Choosing difficulty and the timer.":game?.phase==="playing"?"Your game is currently in progress.":"Pick a game. Your partner chooses if they want to play."}</p></div>
         {(!game||(game.phase==="finished"&&!game.rps?.rematch))&&<div className="game-list">{GAMES.map(g=><button type="button" key={g.id} disabled={!canChat} className="sidebar-game" onClick={()=>inviteToGame(g.id)}><span className={"sidebar-game-icon "+g.id}><GameSymbol id={g.id} size={22}/></span><span><strong>{g.title}</strong><small>{g.desc}</small></span><ArrowRight size={16}/></button>)}</div>}
         {game&&<div className="sidebar-playing"><GamePanel game={game} side={side} onRespond={yes=>{if(canChat)socket.emit("game:respond",yes);}}
            onCategoriesAgree={categories=>{if(canChat)socket.emit("forehead:categories:agree",{id:game.id,confirmed:true,categories});}}
            onCategoriesChange={()=>{if(canChat)socket.emit("forehead:categories:request-change",{id:game.id});}}
            onSetup={()=>{setHenyoCategoryStep(game.phase==="settings"?1:0);setHenyoSetupOpen(true);}} onMove={move=>{if(canChat)socket.emit("game:move",move);}} onClose={requestQuitGame} onExpand={()=>setArcadeOpen(true)}
             onRpsConfigure={targetWins=>{if(canChat)socket.emit("rps:configure",{id:game.id,targetWins});}}/></div>}
         <div className="sidebar-info"><CircleHelp size={18}/><span>Games start only when both players agree.</span></div>
         <div className="sidebar-love"><div className="love-icon"><Heart size={19}/></div><div><strong>{likes.mutual?"It's mutual!":likes.theirs?"They liked you":"Enjoying this chat?"}</strong><p>{likes.mutual?"Your likes will vanish when this chat ends.":"Send a like to show some appreciation."}</p></div><button type="button" aria-label={likes.yours?"Remove like":"Send like"} onClick={()=>socket.emit("like:toggle")}>{likes.yours?<Check size={17}/>:<Heart size={17}/>}</button></div>
         {commonGames.length>0&&<p className="shared-games"><BadgeCheck size={16}/> You both enjoy {commonGames.map(k=>GAMES.find(g=>g.id===k)?.title).join(" and ")}.</p>}
       </aside>
     </div>
    </section>
   </motion.main>}
  </AnimatePresence>
  <AnimatePresence>
   {mode==="chat"&&arcadeOpen&&game?.kind==="rps"&&(game.phase==="loading"||game.phase==="playing"||game.phase==="finished")&&
    <Suspense fallback={<div role="status" style={{position:"fixed",inset:0,zIndex:70,display:"grid",placeItems:"center",background:"#211b3b",color:"#fff",fontWeight:800}}>Loading Rock Paper Scissors…</div>}>
     <RpsFullView key={game.id} game={game} side={side}
      onMove={choice=>{if(canChat)socket.emit("game:move",choice);}}
      onReady={()=>{if(canChat)socket.emit("rps:scene-ready",{id:game.id});socket.emit("rps:view",{id:game.id,viewing:true});}}
      onBack={backFromRps}
      onClose={requestQuitGame} onReplay={()=>socket.emit("rps:rematch",{id:game.id})}/>
    </Suspense>}
   {mode==="chat"&&game?.kind==="forehead"&&(game.phase==="mic"||game.phase==="loading"||game.phase==="playing")&&
    <HenyoVoice key={"voice-"+game.id} game={game} side={side} socket={socket} onLeave={requestQuitGame}/>}
   {mode==="chat"&&arcadeOpen&&game&&game.kind==="forehead"&&(game.phase==="loading"||game.phase==="playing"||game.phase==="finished")&&<Suspense fallback={<div className="forehead-overlay" role="status" style={{color:"white",display:"grid",placeItems:"center"}}>Loading 3D game...</div>}>
    <ForeheadView key={game.id} game={game} socket={socket} side={side} messages={messages} chatEnabled={canChat} onChatSend={text=>sendPayload({kind:"text",text})}
      onAsk={category=>{if(canChat)socket.emit("forehead:ask",{category,round:game.forehead?.completed,serial:game.forehead?.wordSerial});}}
      onAnswer={(id,yes)=>{if(canChat)socket.emit("forehead:answer",{id,yes});}}
      onChatAnswer={(questionId,yes)=>{if(canChat)socket.emit("forehead:chat-answer",{
       id:game.id,questionId,yes,round:game.forehead?.completed,serial:game.forehead?.wordSerial
      });}}
      onGuess={word=>{if(canChat)socket.emit("forehead:guess",{word,round:game.forehead?.completed,serial:game.forehead?.wordSerial});}}
      onHeardCorrect={()=>{if(canChat)socket.emit("forehead:heard-correct",{
       id:game.id,round:game.forehead?.completed,serial:game.forehead?.wordSerial
      });}}
      onGesture={yes=>{if(canChat)socket.emit("forehead:gesture",{
       id:game.id,yes,round:game.forehead?.completed,serial:game.forehead?.wordSerial
      });}}

      onSkip={()=>{if(canChat)socket.emit("forehead:skip",{round:game.forehead?.completed,serial:game.forehead?.wordSerial});}}
      onMinimize={()=>setArcadeOpen(false)}
      onClose={requestQuitGame}
      onReplay={inviteToGame}/>
   </Suspense>}
   {mode==="chat"&&arcadeOpen&&game&&(game.kind==="memory"||game.kind==="pong")&&game.phase!=="invite"&&
    <ArcadeView key={game.id} game={game} side={side}
      onFlip={index=>{if(canChat)socket.emit("memory:flip",index);}}
      onPaddle={y=>{if(canChat)socket.emit("pong:paddle",y);}}
      onCharge={holding=>{if(canChat)socket.emit("pong:charge",{id:game.id,holding});}}
      onSceneReady={()=>{if(canChat)socket.emit("pong:scene-ready",{id:game.id});}}
      onMinimize={()=>setArcadeOpen(false)}
      onClose={requestQuitGame}
      onReplay={inviteToGame}
    />}
  </AnimatePresence>
  {connectionIssue&&<div className="network-recovery" role="status"><WifiOff size={20}/><div><strong>Connection interrupted</strong><span>{connected?"Restoring chat...":"Trying to reconnect. Your chat is held briefly."}</span></div><button type="button" onClick={()=>socket.connect()} disabled={socket.connected}><RotateCcw size={16}/> Retry</button></div>}
  <footer className="footer"><span>chat2play · Conversations are temporary</span><span><ShieldCheck size={15}/> Be kind, stay safe, have fun.</span></footer>
  {notice&&mode==="chat"&&<div className="toast" role="status">{notice}<button type="button" aria-label="Dismiss" onClick={()=>setNotice("")}><X size={17}/></button></div>}
  <Modal open={!!expandedMessage} onOpenChange={open=>{if(!open)setExpandedMessage(null);}} title="Full message" description="Read this message in parts, without scrolling.">
    <p className="message-detail-text">{expandedMessage?.text?.slice(detailPage*220,(detailPage+1)*220)}</p>
    <nav className="message-detail-pager" aria-label="Message text pages"><button className="outline-button" type="button" onClick={()=>setDetailPage(v=>Math.max(0,v-1))} disabled={detailPage===0}><ArrowLeft size={16}/> Previous</button><span>{detailPage+1} / {Math.max(1,Math.ceil((expandedMessage?.text?.length||0)/220))}</span><button className="primary-button" type="button" onClick={()=>setDetailPage(v=>v+1)} disabled={(detailPage+1)*220>=(expandedMessage?.text?.length||0)}>Next <ArrowRight size={16}/></button></nav>
  </Modal>
  <Modal open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings" description="Make Chat2Play feel like yours.">
    <div className={settingsPage===0?"settings-page":"settings-page settings-page-hidden"}>
    <div className="setting-row"><span className="setting-icon"><Sun size={19}/></span><div><strong>Appearance</strong><p>Switch how the app looks.</p></div></div>
    <div className="theme-toggle"><button type="button" className={theme==="light"?"selected":""} onClick={()=>setTheme("light")}><Sun size={18}/> Light {theme==="light"&&<Check size={15}/>}</button><button type="button" className={theme==="dark"?"selected":""} onClick={()=>setTheme("dark")}><Moon size={18}/> Dark {theme==="dark"&&<Check size={15}/>}</button></div>
    <div className="setting-row"><span className="setting-icon"><Sparkles size={19}/></span><div><strong>Reduce motion</strong><p>Minimize movement and transitions.</p></div><button type="button" role="switch" aria-label="Reduce motion" aria-checked={reduceMotion} className={"toggle-switch"+(reduceMotion?" on":"")} onClick={()=>setReduceMotion(v=>!v)}><i/></button></div>
    </div>
    <div className={settingsPage===1?"settings-page":"settings-page settings-page-hidden"}>
    <div className="setting-row"><span className="setting-icon"><MessageCircle size={19}/></span><div><strong>Typing notification sound</strong><p>A quiet tone when your partner starts typing.</p></div><button type="button" role="switch" aria-label="Typing notification sound" aria-checked={typingSounds} className={"toggle-switch"+(typingSounds?" on":"")} onClick={()=>{setTypingSounds(v=>!v);unlockTypingAudio();}}><i/></button></div>
    <div className="setting-row"><span className="setting-icon"><Shuffle size={19}/></span><div><strong>Skip Next confirmation</strong><p>Find the next stranger without an extra dialog.</p></div><button type="button" role="switch" aria-label="Skip Next confirmation" aria-checked={autoConfirmNext} className={"toggle-switch"+(autoConfirmNext?" on":"")} onClick={()=>setAutoConfirmNext(v=>!v)}><i/></button></div>
    </div>
    <div className={settingsPage===2?"settings-page settings-matching":"settings-page settings-page-hidden"}>
     <div className="setting-row settings-matching-heading"><span className="setting-icon"><UserRound size={19}/></span><div><strong>Your matching profile</strong><p>Change who you would like to meet.</p></div></div>
     <div className="settings-matching-field"><label>My gender</label><FancySelect value={gender} onChange={setGender} items={GENDERS} label="My gender"/></div>
     <div className="settings-matching-field"><label>Who I want to meet</label><FancySelect value={lookingFor} onChange={setLookingFor} items={PREFS} label="Match preference"/></div>
     <label className="settings-fallback"><input type="checkbox" checked={fallback==="automatic"} onChange={e=>setFallback(e.target.checked?"automatic":"strict")}/><span><strong>Flexible matching</strong><small>{fallback==="automatic"?"After a short wait, both players may accept a flexible match.":"Match only when both preferences align."}</small></span></label>
     <p className="settings-match-note">Saved on this device after setup. Changes apply to your next search or Next match, not the current stranger.</p>
    </div>
    <div className={settingsPage===3?"settings-page settings-games":"settings-page settings-page-hidden"}>
     <div className="setting-row settings-matching-heading"><span className="setting-icon"><Gamepad2 size={19}/></span><div><strong>Favorite games</strong><p>Help us find shared games for your next match.</p></div></div>
     <div className="settings-games-head"><span>{interests.length} of {GAMES.length} selected</span><button type="button" onClick={()=>setInterests(allGamesSelected?[]:GAMES.map(g=>g.id))}>{allGamesSelected?"Clear all":"Select all"}</button></div>
     <div className="settings-game-grid">{GAMES.map(g=><button type="button" key={g.id} className={interests.includes(g.id)?"chosen":""} aria-pressed={interests.includes(g.id)} onClick={()=>setInterests(prev=>prev.includes(g.id)?prev.filter(k=>k!==g.id):[...prev,g.id])}><GameSymbol id={g.id} size={16}/><span>{g.title}</span>{interests.includes(g.id)&&<Check size={13}/>}</button>)}</div>
     <p className="settings-match-note">Your choices are saved for future matches. Chat conversations are never stored with your setup.</p>
     {(mode==="home"||mode==="ended")&&setupCompleted&&<button className="settings-reset-setup" type="button" onClick={resetRememberedSetup}>Forget saved setup on this device</button>}
    </div>
    <nav className="settings-pager" aria-label="Settings pages"><button type="button" className="outline-button" onClick={()=>setSettingsPage(page=>Math.max(0,page-1))} disabled={settingsPage===0}>Previous</button><span>{settingsPage+1} / 4</span><button type="button" className="primary-button" onClick={()=>setSettingsPage(page=>Math.min(3,page+1))} disabled={settingsPage===3}>Next</button></nav>
    <div className="settings-privacy"><LockKeyhole size={18}/><p>Only your settings and matching choices are saved in this browser. Anonymous chats, messages, and partners are not saved.</p></div>
  </Modal>
  <Modal open={detailsOpen} onOpenChange={setDetailsOpen} title="About your partner" description="Only details they chose to share.">
    <div className="profile-top"><div className="profile-big-avatar"><UserRound size={35}/></div><strong>Anonymous stranger</strong><span><span className="tiny-dot"/> Online with you now</span></div>
    <div className="profile-row"><span><UserRound size={19}/> Gender</span><strong>{genderText(partnerGender)}</strong></div>
    <div className="profile-row"><span><Gamepad2 size={19}/> Shared game interests</span><strong>{commonGames.length?commonGames.map(k=>GAMES.find(g=>g.id===k)?.title).join(", "):"Not specified"}</strong></div>
    <div className="profile-disclaimer"><ShieldCheck size={17}/> No username, photos, personal contact details, or location are shared. Gender is self-reported.</div>
    <button className="primary-button modal-cta" type="button" onClick={()=>setDetailsOpen(false)}>Back to chat</button>
  </Modal>
  <Modal open={reportOpen} onOpenChange={setReportOpen} title="Report & leave" description="Help keep conversations respectful.">
    <p className="modal-paragraph">Select the reason that fits best. This prototype stores only a temporary report and does not yet have human moderators.</p>
    <div className="report-options">{([["harassment","Harassment or bullying"],["sexual","Inappropriate sexual content"],["spam","Spam or scams"],["other","Something else"]] as const).map(([reason,label])=><button type="button" key={reason} onClick={()=>onReport(reason)}>{label}<ChevronRight size={17}/></button>)}</div>
  </Modal>
  <Modal open={henyoSetupOpen} topLayer onOpenChange={setHenyoSetupOpen}
    title="Pinoy Henyo setup"
    description={henyoCategoryStep===0?"Invitation accepted! Choose categories for both players to approve.":"Both players agreed on categories. Now choose difficulty and time."}>
    <div className="henyo-setup">
     {henyoCategoryStep===0?<>
      <div className="henyo-setup-label">WORD CATEGORIES</div>
      <div className="henyo-setup-category-grid" role="group" aria-label="Allowed word categories">
       {GAME_CATEGORIES.map(cat=><button type="button" key={cat} className={henyoCategories.includes(cat)?"selected":""}
        aria-pressed={henyoCategories.includes(cat)}
        onClick={()=>{
         setHenyoCategories(previous=>previous.includes(cat)?previous.filter(x=>x!==cat):[...previous,cat]);
         setHenyoCategoryConsent(false);
        }}>
        <span>{GAME_CATEGORY_LABELS[cat]}</span>
        {henyoCategories.includes(cat)&&<Check size={16}/>}
       </button>)}
      </div>
      <div className="henyo-setup-category-tools">
       <button type="button" onClick={()=>{setHenyoCategories([...GAME_CATEGORIES]);setHenyoCategoryConsent(false);}}>Select all</button>
       <span>{henyoCategories.length} selected ? Choose one or more</span>
      </div>
      <label className="henyo-setup-category-consent">
       <input type="checkbox" checked={henyoCategoryConsent} disabled={henyoCategories.length===0}
        onChange={e=>setHenyoCategoryConsent(e.target.checked)}/>
       <span>I confirm these categories. My partner must agree before we choose the time.</span>
      </label>
      <div className="confirm-actions">
       <button className="outline-button" type="button" onClick={()=>setHenyoSetupOpen(false)}>Cancel</button>
       <button type="button" className="primary-button" disabled={!henyoCategoryConsent||henyoCategories.length===0}
        onClick={sendHenyoCategories}>Share categories <ArrowRight size={16}/></button>
      </div>
     </>:<>
      <div className="henyo-setup-category-summary">
       <span>Agreed categories</span>
       <div>{game?.foreheadCategories?.map(cat=><b key={cat}>{GAME_CATEGORY_LABELS[cat]}</b>)}</div>
      </div>
      <div className="henyo-setup-label">WORD DIFFICULTY <span>Choose the challenge</span></div>
      <div className="henyo-setup-choices" role="group" aria-label="Word difficulty">
       {(["easy","medium","hard"] as const).map(d=><button key={d} type="button" aria-pressed={henyoDifficulty===d}
        className={henyoDifficulty===d?"selected":""} onClick={()=>setHenyoDifficulty(d)}>{d==="medium"?"Medium":d==="easy"?"Easy":"Hard"}</button>)}
      </div>
      <div className="henyo-setup-label">TIME FOR EACH PLAYER <span>Each player has their own clock</span></div>
      <div className="henyo-setup-time" role="group" aria-label="Timer length">
       {[1,2,3,4,5].map(mins=><button key={mins} type="button" aria-pressed={henyoMinutes===mins}
        className={henyoMinutes===mins?"selected":""} onClick={()=>setHenyoMinutes(mins)}>{mins}m</button>)}
      </div>
      <p className="henyo-setup-note"><Mic size={17}/> Only the guesser can speak. The hint giver stays muted and answers by moving their head. Marking a correct guess earns +1 and switches turns.</p>
      <div className="confirm-actions">
       <button className="outline-button" type="button" onClick={()=>setHenyoSetupOpen(false)}>Close</button>
       <button type="button" className="primary-button" disabled={game?.phase!=="settings"||!game.categoryAgreement?.every(Boolean)}
        onClick={sendHenyoSettings}>Start game <ArrowRight size={16}/></button>
      </div>
     </>}
    </div>
  </Modal>
  <Modal open={!!quitGameId&&!!game&&game.id===quitGameId} topLayer
    onOpenChange={open=>{if(!open)setQuitGameId(null);}}
    title={game?.phase==="invite"?"Cancel game invitation?":"Quit this game?"}
    description="Your partner will be notified and the game will end for both players.">
    <div className="game-quit-confirm">
      <div className="game-quit-info"><Gamepad2 size={22}/><div>
        <strong>{GAMES.find(g=>g.id===game?.kind)?.title??"Current game"}</strong>
        <span>Only the game will end. Your conversation, messages and match will remain open.</span>
      </div></div>
      <div className="confirm-actions">
        <button type="button" className="outline-button" onClick={()=>setQuitGameId(null)}>Keep playing</button>
        <button type="button" className="primary-button game-quit-danger" disabled={!connected} onClick={confirmQuitGame}>Quit game <ArrowRight size={16}/></button>
      </div>
    </div>
  </Modal>
  <Modal open={nextConfirm} onOpenChange={setNextConfirm} title={mode==="ended"?"Find another stranger?":"Find the next stranger?"} description="Leaving a conversation cannot be undone.">
    <div className="exit-notice"><LockKeyhole size={20}/><span>Temporary messages, likes, and game progress won't transfer to your next match.</span></div>
    <label className="next-preference"><input type="checkbox" checked={autoConfirmNext} onChange={e=>setAutoConfirmNext(e.target.checked)}/><span>Don't ask me again when I tap Next or Find Again. You can change this in Settings.</span></label>
    <div className="confirm-actions"><button type="button" className="outline-button" onClick={()=>setNextConfirm(false)}>Keep chatting</button><button type="button" className="primary-button" onClick={next}>Find someone new <ArrowRight size={17}/></button></div>
  </Modal>
 </div>;
}
export default App;
