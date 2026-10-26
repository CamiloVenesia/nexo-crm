import React from 'react';
import { ArrowDownRight, ArrowUpRight, Building2, CircleCheck, CircleDot, Clock3, Mail, Phone, Plus, Sparkles } from 'lucide-react';
import { useCRM } from '../lib/store';
import { Company, Deal, Stage, STAGES } from '../types';
import { fmtDate, initials, money, overdue, stageById } from '../lib/utils';

export function Brand({small=false}:{small?:boolean}) {return <div className={`brand ${small?'brand-compact':''}`}><span className="brand-mark"><span/></span>{!small&&<span>NEXO<span className="brand-dot">.</span></span>}</div>;}
export function Eyebrow({children}:{children:React.ReactNode}) {return <div className="eyebrow"><span className="eyebrow-line"/>{children}</div>;}
export function Avatar({name,size=34}:{name:string,size?:number}) {const n=name.charCodeAt(0)||0;return <span className="avatar" title={name} style={{width:size,height:size,fontSize:size<30?9:11,background:`hsl(${(n*29)%360}deg 45% 28%)`,borderColor:`hsl(${(n*29)%360}deg 53% 50% / .4)`}}>{initials(name)}</span>;}
export function CompanyIcon({company,size=36}:{company?:Company,size?:number}) { const n=(company?.name.charCodeAt(0)??7)%7;const colors=['#4d96ff','#806dff','#d679e7','#40c9ae','#caa770','#6db5ec','#eb8e8e'];return <span className="company-avatar" style={{width:size,height:size,color:colors[n],background:`${colors[n]}16`,borderColor:`${colors[n]}34`}}>{company?initials(company.name):<Building2 size={16}/>}</span>}
export function StatTile({label,value,meta,positive=true,icon}:{label:string,value:string,meta:string,positive?:boolean,icon?:React.ReactNode}) {return <div className="stat-tile"><div className="stat-top"><span>{label}</span>{icon&&<span className="stat-icon">{icon}</span>}</div><div className="stat-number">{value}</div><div className={`stat-trend ${positive?'':'negative'}`}>{positive?<ArrowUpRight size={13}/>:<ArrowDownRight size={13}/>} {meta}</div></div>}
export function Tag({children,tone='blue'}:{children:React.ReactNode,tone?:'blue'|'purple'|'green'|'red'|'gold'|'neutral'}) {return <span className={`tag tag-${tone}`}>{children}</span>}
export function StageBadge({stage}:{stage:Stage}) {const s=stageById(stage);return <span className="stage-badge" style={{color:s.color,background:`${s.color}15`,borderColor:`${s.color}38`}}><span style={{background:s.color}}/>{s.label}</span>}
export function Empty({title,detail,onAction,action='Agregar registro'}:{title:string,detail:string,onAction?:()=>void,action?:string}) {return <div className="empty"><div className="empty-icon"><CircleDot size={25}/></div><strong>{title}</strong><p>{detail}</p>{onAction&&<button className="btn btn-primary" onClick={onAction}><Plus size={15}/>{action}</button>}</div>}
export function DealCard({deal,onClick,onMove,draggable=true}:{deal:Deal,onClick:()=>void,onMove?:(stage:Stage)=>void,draggable?:boolean}) {
  const {data}=useCRM();const company=data.companies.find(c=>c.id===deal.companyId);
  const st=stageById(deal.stage);
  return <article className="deal-card" draggable={draggable} onDragStart={e=>{e.dataTransfer.setData('text/plain',deal.id);e.dataTransfer.effectAllowed='move';}}><button type="button" className="deal-open" onClick={onClick} aria-label={`Abrir oportunidad ${deal.title}`}>
    <span className="deal-accent" style={{background:st.color}}/>
    <span className="deal-name">{deal.title}</span>
    <span className="deal-company">{company?.name||'Sin empresa asignada'}</span>
    <span className="deal-amount">{money(deal.amount,data.settings.currency)}</span>
    <span className="deal-prob"><span>Probabilidad</span><b>{deal.probability}%</b></span>
    <span className="progress-track"><span style={{width:`${deal.probability}%`,background:`linear-gradient(90deg, #4c93ff, ${st.color})`}}/></span>
    <span className="deal-bottom"><span className="company-inline"><CompanyIcon company={company} size={25}/><span>{company?.name||'Sin empresa'}</span></span><span className={overdue(deal.dueDate)&&!['ganado','perdido'].includes(deal.stage)?'danger-text':''}><Clock3 size={12}/>{fmtDate(deal.dueDate)}</span></span>
    </button>{onMove&&<div className="deal-moving"><select aria-label={`Mover ${deal.title} de etapa`} value={deal.stage} onChange={e=>onMove(e.target.value as Stage)}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>}
  </article>;
}
export function PageHeading({eyebrow,title,subtitle,action,secondary}:{eyebrow:string,title:string,subtitle:string,action?:React.ReactNode,secondary?:React.ReactNode}){return <div className="page-heading"><div><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1><p>{subtitle}</p></div><div className="heading-actions">{secondary}{action}</div></div>}
export function ContactLine({name,email,phone}:{name:string,email:string,phone?:string}) {return <span className="contact-stack"><strong>{name}</strong><small><Mail size={12}/>{email}</small>{phone&&<small><Phone size={12}/>{phone}</small>}</span>}
export function SectionTitle({icon,title,description,action}:{icon?:React.ReactNode,title:string,description?:string,action?:React.ReactNode}){return <div className="section-title"><div className="section-title-icon">{icon??<Sparkles size={17}/>}</div><div className="section-title-text"><strong>{title}</strong>{description&&<small>{description}</small>}</div>{action&&<span className="section-action">{action}</span>}</div>}
export function TasksPulse({total,done}:{total:number,done:number}){return <span className="small-metric"><CircleCheck size={14}/>{done} / {total} completadas</span>}
