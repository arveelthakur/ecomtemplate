import { useEffect, useState, type CSSProperties } from 'react';
import { useAdminStore, type CountdownTimerPlacement } from '../context/AdminContext';

function getRemaining(target:string,now:number){
  const targetMs=new Date(target).getTime();
  if(!Number.isFinite(targetMs))return null;
  const total=Math.max(0,targetMs-now);
  const seconds=Math.floor(total/1000);
  return {expired:total===0,days:Math.floor(seconds/86400),hours:Math.floor(seconds%86400/3600),minutes:Math.floor(seconds%3600/60),seconds:seconds%60};
}
export default function CountdownTimer({placement}:{placement:CountdownTimerPlacement}){
  const {data}=useAdminStore();
  const timer=data.content.countdownTimer;
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{
    if(!timer.enabled||!timer.targetDate)return;
    const id=window.setInterval(()=>setNow(Date.now()),1000);
    return()=>window.clearInterval(id);
  },[timer.enabled,timer.targetDate]);
  if(!timer.enabled||timer.placement!==placement||!timer.targetDate)return null;
  const remaining=getRemaining(timer.targetDate,now);
  if(!remaining)return null;
  const countdownStyle={
    '--countdown-bg':timer.backgroundColor,
    '--countdown-text':timer.textColor,
    '--countdown-border':timer.borderColor,
    '--countdown-border-width':`${timer.borderWidthPx}px`,
    '--countdown-radius':`${timer.borderRadiusPx}px`,
  } as CSSProperties;
  if(remaining.expired){
    if(timer.expiredBehavior==='hide'||!timer.expiredMessage.trim())return null;
    return <div className={`nura-countdown nura-countdown-${timer.style}`} data-placement={placement} role="status" data-testid={`countdown-${placement}-expired`} style={countdownStyle}>{timer.expiredMessage}</div>;
  }
  const units=[...(remaining.days>0?[['Days',remaining.days] as const]:[]),['Hours',remaining.hours] as const,['Minutes',remaining.minutes] as const,['Seconds',remaining.seconds] as const];
  return <div className={`nura-countdown nura-countdown-${timer.style}`} data-placement={placement} role="timer" aria-label={`${timer.title}, ${units.map(([name,value])=>`${value} ${name}`).join(', ')}`} data-testid={`countdown-${placement}`} style={countdownStyle}>
    <span className="nura-countdown-title">{timer.title}</span>
    <span className="nura-countdown-units">{units.map(([name,value])=><span className="nura-countdown-unit" key={name}><strong>{String(value).padStart(2,'0')}</strong><small>{name}</small></span>)}</span>
  </div>;
}
