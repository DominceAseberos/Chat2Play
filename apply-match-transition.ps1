$ErrorActionPreference='Stop'
$p='C:\Users\user\Documents\Chat2Play\src\App.tsx'
$s=[IO.File]::ReadAllText($p)
function C([string]$a,[string]$b){if(-not $script:s.Contains($a)){throw "Not found: $($a.Substring(0,[Math]::Min(90,$a.Length)))"};$script:s=$script:s.Replace($a,$b)}
C 'type Mode = "home" | "searching" | "chat";' 'type Mode = "home" | "searching" | "matched" | "chat";'
C ' const typingClear=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);' ' const typingClear=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const matchTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
 const activeMatch=useRef(false);
 const reducedRef=useRef(reduceMotion);'
C ' useEffect(()=>{document.documentElement.dataset.reducedMotion=String(reduceMotion);localStorage.setItem("c2p:reduceMotion",String(reduceMotion));},[reduceMotion]);' ' useEffect(()=>{reducedRef.current=reduceMotion;document.documentElement.dataset.reducedMotion=String(reduceMotion);localStorage.setItem("c2p:reduceMotion",String(reduceMotion));},[reduceMotion]);'
C '  const onDisconnect=()=>{setConnected(false);setMode("home");setMessages([]);setNotice("Connection lost. You can find a new match after reconnecting.");};' '  const cancelFound=()=>{activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);matchTimer.current=undefined;};
  const onDisconnect=()=>{cancelFound();setConnected(false);setMode("home");setMessages([]);setNotice("Connection lost. You can find a new match after reconnecting.");};'
C '   setGame(null);setLikes(initialLike);setPartnerTyping(false);setMode("chat");
   setPendingJoin(false);setPickerOpen(false);setGamesOpen(false);setNotice("");' '   cancelFound();activeMatch.current=true;
   setGame(null);setLikes(initialLike);setPartnerTyping(false);setMode("matched");
   setPendingJoin(false);setPickerOpen(false);setGamesOpen(false);setNotice("");
   matchTimer.current=setTimeout(()=>{
     matchTimer.current=undefined;
     if(activeMatch.current&&socket.connected){activeMatch.current=false;setMode("chat");}
   },reducedRef.current?550:1300);'
C '  const onEnd=(m:{reason:string})=>{
   setMessages([]);' '  const onEnd=(m:{reason:string})=>{
   cancelFound();
   setMessages([]);'
C '   socket.disconnect();if(stopTyping.current)clearTimeout(stopTyping.current);if(typingClear.current)clearTimeout(typingClear.current);' '   cancelFound();
   socket.disconnect();if(stopTyping.current)clearTimeout(stopTyping.current);if(typingClear.current)clearTimeout(typingClear.current);'
C ' function leave(){
  socket.emit(mode==="searching"?"queue:cancel":"match:leave");' ' function leave(){
  activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);
  socket.emit(mode==="searching"?"queue:cancel":"match:leave");'
C ' function next(){
  setNextConfirm(false);' ' function next(){
  activeMatch.current=false;if(matchTimer.current)clearTimeout(matchTimer.current);
  setNextConfirm(false);'
C '   {mode==="chat"&&<motion.main className="chat-layout"' '   {mode==="matched"&&<motion.main className="search-container matched-screen" key="matched"
     initial={reduceMotion?false:{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
     transition={{duration:reduceMotion?0:.14}}>
     <div className="search-inner matched-inner" role="status" aria-live="polite">
       <div className="radar-art"><MatchMorph reduceMotion={reduceMotion} matched/></div>
       <span className="overline"><span className="overline-dot"/> MATCH FOUND</span>
       <h2>Match<br/><em>found.</em></h2>
       <p>Opening your conversation…</p>
       <div className="waiting-pill matched-pill"><Check size={17}/> Connected successfully</div>
     </div>
   </motion.main>}
   {mode==="chat"&&<motion.main className="chat-layout"'
[IO.File]::WriteAllText($p,$s,[Text.UTF8Encoding]::new($false))
Write-Output 'MATCH_TRANSITION_PATCH_OK'
