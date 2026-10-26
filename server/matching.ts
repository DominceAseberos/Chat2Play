export type Gender = "woman" | "man" | "nonbinary" | "unspecified";
export type LookingFor = "any" | Exclude<Gender, "unspecified">;
export type Kind = "ttt" | "rps" | "memory" | "pong" | "forehead";
export type FallbackPreference = "automatic" | "strict";

export type MatchProfile = {
  gender: Gender;
  lookingFor: LookingFor;
  interests: Kind[];
  fallback: FallbackPreference;
};
export type WaitingPlayer = { id: string; profile: MatchProfile; joinedAt: number };
export type MatchKind = "preferred" | "fallback";
export type RankedPair = {
  first: WaitingPlayer; second: WaitingPlayer;
  kind: MatchKind; commonGames: Kind[]; score: number;
};
export const FALLBACK_WAIT_MS = 8000;

export function reciprocalPreferences(a: MatchProfile, b: MatchProfile): boolean {
  const wants = (p: MatchProfile, other: MatchProfile) =>
    p.lookingFor === "any" || p.lookingFor === other.gender;
  return wants(a,b) && wants(b,a);
}
export function commonGames(a: MatchProfile,b: MatchProfile): Kind[] {
  return [...new Set(a.interests.filter(k=>b.interests.includes(k)))];
}
/** Consider every available pair. Reciprocal choices are always ranked above any
 * fallback pairing. After the wait threshold, fallback requires BOTH opt-ins. */
export function bestMatchPair(
  candidates: WaitingPlayer[],
  now: number,
  fallbackWaitMs = FALLBACK_WAIT_MS,
  isBlocked: (a:string,b:string)=>boolean=()=>false
): RankedPair | null {
  let best: RankedPair | null = null;
  for (let i=0;i<candidates.length;i++) {
    const a=candidates[i];
    for (let j=i+1;j<candidates.length;j++) {
      const b=candidates[j];
      if (a.id===b.id || isBlocked(a.id,b.id)) continue;
      const preferred=reciprocalPreferences(a.profile,b.profile);
      if (!preferred) {
        if (a.profile.fallback!=="automatic" || b.profile.fallback!=="automatic") continue;
        // One participant has tried their preferred search for long enough,
        // and the newly arrived participant has consented to automatic fallback.
        if (Math.max(now-a.joinedAt,now-b.joinedAt)<fallbackWaitMs) continue;
      }
      const common=commonGames(a.profile,b.profile);
      // Preference tier outweighs even four shared games.
      // Within a tier, favor shared games, then waiting time.
      const waitBonus=Math.min(15,Math.max(0,(now-Math.min(a.joinedAt,b.joinedAt))/1000));
      const score=(preferred?1000:0)+common.length*35+waitBonus;
      if (!best || score>best.score || (score===best.score &&
        Math.min(a.joinedAt,b.joinedAt)<Math.min(best.first.joinedAt,best.second.joinedAt))) {
        best={first:a,second:b,kind:preferred?"preferred":"fallback",commonGames:common,score};
      }
    }
  }
  return best;
}
