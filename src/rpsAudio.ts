let context:AudioContext|null=null;

export function unlockRpsAudio(){
 try{
  context??=new AudioContext();
  if(context.state==="suspended")void context.resume().catch(()=>{});
 }catch{/* Sound is optional when Web Audio is unavailable. */}
}

export function playRpsBeat(beat:0|1|2,enabled:boolean){
 const audio=context;
 if(!enabled||!audio||audio.state!=="running")return;
 const at=audio.currentTime,accent=beat===2;
 const drum=audio.createOscillator(),body=audio.createGain();
 drum.type="sine";
 drum.frequency.setValueAtTime(accent?170:125,at);
 drum.frequency.exponentialRampToValueAtTime(accent?52:48,at+.19);
 body.gain.setValueAtTime(.0001,at);
 body.gain.exponentialRampToValueAtTime(accent?.20:.13,at+.012);
 body.gain.exponentialRampToValueAtTime(.0001,at+.25);
 drum.connect(body);body.connect(audio.destination);drum.start(at);drum.stop(at+.26);
 const click=audio.createOscillator(),tap=audio.createGain();
 click.type="triangle";click.frequency.setValueAtTime(accent?850:540,at);
 click.frequency.exponentialRampToValueAtTime(accent?320:240,at+.055);
 tap.gain.setValueAtTime(.0001,at);
 tap.gain.exponentialRampToValueAtTime(accent?.055:.035,at+.004);
 tap.gain.exponentialRampToValueAtTime(.0001,at+.075);
 click.connect(tap);tap.connect(audio.destination);click.start(at);click.stop(at+.08);
}
