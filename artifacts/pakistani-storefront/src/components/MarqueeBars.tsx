import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAdminStore, type MarqueeBarPosition } from '../context/AdminContext';
import type { CSSProperties } from 'react';

export default function MarqueeBars({placement,sectionId}:{placement:MarqueeBarPosition;sectionId?:string}){
  const {data}=useAdminStore();
  const {pathname}=useLocation();
  const rows=data.content.marqueeBars.filter(bar=>{
    if(!bar.visible||bar.position!==placement)return false;
    if(bar.pageMode==='home'&&pathname!=='/')return false;
    if(bar.pageMode==='specific'&&!bar.pagePaths.includes(pathname))return false;
    return placement!=='custom'||bar.customSectionId===sectionId;
  });
  if(!rows.length)return null;
  const group=<div className={`nura-marquee-group ${placement==='floating'?'nura-marquee-position-floating':''}`} aria-label="Store announcements">
    {rows.map(bar=><div key={bar.id} className={`nura-marquee nura-marquee-${bar.style}`} style={{'--marquee-speed':`${bar.speedSeconds}s`,'--marquee-bg':bar.backgroundColor,'--marquee-fg':bar.textColor} as CSSProperties} data-testid={`marquee-${bar.id}`}>
      <div className="nura-marquee-track" aria-label={bar.text}><span>{bar.icon&&<span aria-hidden="true" className="mr-2">{bar.icon}</span>}{bar.text}</span><span aria-hidden="true">{bar.icon&&<span className="mr-2">{bar.icon}</span>}{bar.text}</span></div>
      {bar.style==='wavy'&&bar.centerBadge&&<span className="nura-marquee-center-badge">{bar.centerBadge}</span>}
    </div>)}
  </div>;
  return placement==='floating'&&typeof document!=='undefined'?createPortal(group,document.body):group;
}
