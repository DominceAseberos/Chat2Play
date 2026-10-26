import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import "./match-morph.css";

type Props = { reduceMotion: boolean; matched?: boolean };

// The same two organic shapes appear during search and on confirmation.
// In confirmation mode they converge into one glass badge; a check is drawn over it.
export default function MatchMorph({ reduceMotion: reduced, matched = false }: Props) {
  const reduceMotion = Boolean(useReducedMotion() || reduced);
  const unique = useId().replace(/:/g, "");
  const goo = `c2p-match-goo-${unique}`;
  const violet = `c2p-match-violet-${unique}`;
  const rose = `c2p-match-rose-${unique}`;
  const ease = [0.45, 0, 0.55, 1] as const;
  const loop = { duration: 4.6, times: [0, .26, .43, .60, .80, 1], ease, repeat: Infinity };
  const converge = { duration: .70, times: [0, .7, 1], ease };
  const left = {cx:[60,83,104,107,78,60],cy:[112,99,105,107,117,112],r:[31,33,37,35,32,31]};
  const right = {cx:[160,137,116,113,142,160],cy:[105,117,110,111,96,105],r:[32,33,37,35,32,32]};

  return <div className={"match-morph"+(matched?" is-matched":"")} role="img"
    aria-label={matched?"Match found — two circles combine into a check":"Two glowing circles joining while we search"}>
    <div className="match-morph-aura" aria-hidden="true"/>
    <svg className="match-morph-svg" viewBox="0 0 220 220" aria-hidden="true">
      <defs>
        <radialGradient id={violet} cx="35%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#f8f3ff"/>
          <stop offset="35%" stopColor="#e2d6fa"/>
          <stop offset="75%" stopColor="#9a88c7"/>
          <stop offset="100%" stopColor="#736596"/>
        </radialGradient>
        <radialGradient id={rose} cx="34%" cy="25%" r="85%">
          <stop offset="0%" stopColor="#fff6fa"/>
          <stop offset="38%" stopColor="#f1c5d9"/>
          <stop offset="77%" stopColor="#c88cae"/>
          <stop offset="100%" stopColor="#995e85"/>
        </radialGradient>
        <filter id={goo} x="-60%" y="-60%" width="220%" height="220%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur"/>
          <feColorMatrix in="blur" mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 21 -9" result="goo"/>
          <feMerge><feMergeNode in="goo"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <circle cx="110" cy="110" r="89" fill="none" stroke="var(--morph-ring)" strokeWidth=".7" strokeDasharray="3 8"/>
      <circle cx="110" cy="110" r="70" fill="none" stroke="var(--morph-ring)" strokeWidth=".65" opacity=".65"/>
      <g filter={`url(#${goo})`}>
        <motion.circle cx={60} cy={112} r={31} fill={`url(#${violet})`}
          animate={matched?(reduceMotion?{cx:110,cy:110,r:45}:{cx:[60,104,110],cy:[112,110,110],r:[31,37,45]}):reduceMotion?undefined:left}
          transition={matched?converge:loop}/>
        <motion.circle cx={160} cy={105} r={32} fill={`url(#${rose})`}
          animate={matched?(reduceMotion?{cx:110,cy:110,r:45}:{cx:[160,116,110],cy:[105,110,110],r:[32,37,45]}):reduceMotion?undefined:right}
          transition={matched?converge:loop}/>
      </g>
      {!matched && <>
        <motion.circle cx={48} cy={98} r="9" fill="#fff" opacity=".3"
          animate={reduceMotion?undefined:{cx:[48,71,92,95,65,48],cy:[98,84,91,93,102,98],opacity:[.27,.36,.51,.36,.24,.27]}} transition={loop}/>
        <motion.circle cx={148} cy={93} r="8" fill="#fff" opacity=".25"
          animate={reduceMotion?undefined:{cx:[148,125,104,101,130,148],cy:[93,105,99,99,82,93],opacity:[.28,.4,.55,.36,.24,.28]}} transition={loop}/>
        <motion.g fill="none" stroke="var(--morph-glint)" strokeLinecap="round" strokeWidth="2"
          animate={reduceMotion?undefined:{opacity:[0,0,.9,.65,0,0],scale:[.6,.7,1.16,.9,.6,.6],rotate:[-30,-15,12,35,55,55]}}
          style={{transformOrigin:"110px 110px"}} transition={loop}>
          <path d="M110 50v11 M104.5 55.5h11"/>
          <path d="M154 157v7 M150.5 160.5h7" strokeWidth="1.6"/>
        </motion.g>
      </>}
      {matched && <motion.path d="M87 110 L104 127 L136 93"
        fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round"
        initial={reduceMotion?{pathLength:1,opacity:1}:{pathLength:0,opacity:0}}
        animate={{pathLength:1,opacity:1}}
        transition={{duration:reduceMotion?0:.32,delay:reduceMotion?0:.63,ease:"easeOut"}}/>}
    </svg>
    <div className="match-morph-caption" aria-hidden="true">
      <span className="match-morph-mini-dot"/><span className="match-morph-caption-line"/><span className="match-morph-mini-dot other"/>
    </div>
  </div>;
}
