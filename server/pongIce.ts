// TURN tokens stay on the server. Only expiring session credentials reach browsers.
const fallback:RTCIceServer[]=[{urls:"stun:stun.cloudflare.com:3478"},{urls:"stun:stun.l.google.com:19302"}];
let cached:{expires:number;servers:RTCIceServer[]}|undefined;
let pending:Promise<RTCIceServer[]>|undefined;
export async function pongIceServers():Promise<RTCIceServer[]>{
 const key=process.env.CLOUDFLARE_TURN_KEY_ID,token=process.env.CLOUDFLARE_TURN_API_TOKEN;
 if(!key||!token)return fallback;
 if(cached&&cached.expires>Date.now())return cached.servers;
 if(pending)return pending;
 pending=(async()=>{
  try{
   const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key!)}/credentials/generate-ice-servers`,{
    method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
    body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(5000)
   });
   if(!response.ok)return fallback;
   const data=await response.json() as {iceServers?:RTCIceServer[]};
   if(!Array.isArray(data.iceServers)||!data.iceServers.length)return fallback;
   cached={expires:Date.now()+10*60_000,servers:data.iceServers};
   return data.iceServers;
  }catch{return fallback;}
  finally{pending=undefined;}
 })();
 return pending;
}
