import { useState } from 'react';
import { useCRM } from '../lib/store';
import { money, openDeals } from '../lib/utils';
import { STAGES } from '../types';

function useDataChart(){
  const {data}=useCRM();const now=new Date();
  return Array.from({length:8},(_,i)=>{
    const m=new Date(now.getFullYear(),now.getMonth()+i-5,1),year=m.getFullYear(),month=m.getMonth();
    const inMonth=(date:string)=>{if(!date)return false;const d=new Date(`${date.slice(0,10)}T12:00:00`);return d.getFullYear()===year&&d.getMonth()===month};
    return {label:m.toLocaleDateString('es-AR',{month:'short'}),forecast:data.deals.filter(d=>d.stage!=='perdido'&&inMonth(d.dueDate)).reduce((sum,d)=>sum+d.amount*d.probability/100,0),actual:data.deals.filter(d=>d.stage==='ganado'&&inMonth(d.dueDate)).reduce((sum,d)=>sum+d.amount,0)};
  });
}
function smoothPath(points:[number,number][]) {
  if(!points.length)return '';
  return points.reduce((path,p,i)=>{
    if(i===0)return `M ${p[0]} ${p[1]}`;
    const prev=points[i-1],midX=(prev[0]+p[0])/2;
    return `${path} C ${midX} ${prev[1]}, ${midX} ${p[1]}, ${p[0]} ${p[1]}`;
  },'');
}
export function ForecastChart({height=220}:{height?:number}) {
  const values=useDataChart(),{data}=useCRM(),[hovered,setHovered]=useState<number|null>(null);
  const W=760,H=215,LEFT=66,RIGHT=18,TOP=18,BOTTOM=33;
  const maxVal=Math.max(1,...values.flatMap(v=>[v.actual,v.forecast]));const scaleMax=Math.ceil(maxVal/1000000)*1000000 || 1000000;
  const x=(i:number)=>LEFT+i*(W-LEFT-RIGHT)/(values.length-1);
  const y=(n:number)=>TOP+(H-TOP-BOTTOM)*(1-n/scaleMax);
  const forecast=values.map((v,i)=>[x(i),y(v.forecast)] as [number,number]);
  const actual=values.map((v,i)=>[x(i),y(v.actual)] as [number,number]);
  const fill=(p:[number,number][])=>`${smoothPath(p)} L ${x(values.length-1)} ${H-BOTTOM} L ${LEFT} ${H-BOTTOM} Z`;
  return <div className="custom-chart" style={{height}}><svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" role="img" aria-label="Gráfico de ingresos esperados y ganados por mes" preserveAspectRatio="none"><defs><linearGradient id="blue-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#478bff" stopOpacity=".37"/><stop offset="100%" stopColor="#478bff" stopOpacity="0"/></linearGradient><linearGradient id="violet-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a179ff" stopOpacity=".24"/><stop offset="100%" stopColor="#a179ff" stopOpacity="0"/></linearGradient><filter id="line-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>{Array.from({length:5},(_,i)=>{const val=scaleMax*(4-i)/4,py=y(val);return <g key={i}><line x1={LEFT} x2={W-RIGHT} y1={py} y2={py} stroke="#28395b" strokeDasharray="4 5" strokeWidth="1"/><text x={LEFT-10} y={py+4} textAnchor="end" fill="#8192b3" fontSize="11">{money(val,data.settings.currency,true)}</text></g>})}{values.map((v,i)=><text key={i} x={x(i)} y={H-10} textAnchor="middle" fill="#8192b3" fontSize="11" style={{textTransform:'capitalize'}}>{v.label}</text>)}<path d={fill(forecast)} fill="url(#blue-area)"/><path d={fill(actual)} fill="url(#violet-area)"/><path d={smoothPath(forecast)} stroke="#579bff" strokeWidth="2.4" fill="none" filter="url(#line-glow)"/><path d={smoothPath(actual)} stroke="#a27bff" strokeWidth="2.2" fill="none"/>{hovered!==null&&<><line x1={x(hovered)} x2={x(hovered)} y1={TOP} y2={H-BOTTOM} stroke="#b6d3ff" opacity=".43" strokeDasharray="3 5"/><circle cx={x(hovered)} cy={y(values[hovered].forecast)} r="5" fill="#589aff" stroke="#dfeaff" strokeWidth="2"/><circle cx={x(hovered)} cy={y(values[hovered].actual)} r="5" fill="#a27bff" stroke="#dfeaff" strokeWidth="2"/></>}{values.map((v,i)=><rect key={`hit${v.label}${i}`} x={x(i)-(W-LEFT-RIGHT)/values.length/2} y={TOP} width={(W-LEFT-RIGHT)/values.length} height={H-TOP-BOTTOM} fill="transparent" onMouseEnter={()=>setHovered(i)} onMouseLeave={()=>setHovered(null)}><title>{`${v.label} · Esperado: ${money(v.forecast,data.settings.currency)} · Ganado: ${money(v.actual,data.settings.currency)}`}</title></rect>)}</svg>{hovered!==null&&<div className="chart-hover" aria-live="polite"><strong>{values[hovered].label}</strong><span><i className="blue-dot"/>Esperado {money(values[hovered].forecast,data.settings.currency)}</span><span><i className="violet-dot"/>Ganado {money(values[hovered].actual,data.settings.currency)}</span></div>}</div>;
}
export function StageBarChart(){const {data}=useCRM();const bars=STAGES.slice(0,5).map(s=>({name:s.label,value:data.deals.filter(d=>d.stage===s.id).reduce((n,d)=>n+d.amount,0),color:s.color})),max=Math.max(1,...bars.map(x=>x.value));return <div className="stage-chart" role="img" aria-label="Importes acumulados por etapa comercial">{bars.map(b=><div key={b.name} className="stage-chart-row"><span>{b.name}</span><div><div style={{width:`${Math.max(0,b.value/max*100)}%`,background:`linear-gradient(90deg, ${b.color}80, ${b.color})`}}/></div><strong>{money(b.value,data.settings.currency,true)}</strong></div>)}</div>}
export function RevenueLegend(){return <div className="chart-legend"><span><i className="blue-dot"/>Ingreso esperado</span><span><i className="violet-dot"/>Ventas ganadas</span></div>}
export function PerformanceRing({size=178}:{size?:number}){
  const {data}=useCRM();const won=data.deals.filter(d=>d.stage==='ganado').length,closed=data.deals.filter(d=>['ganado','perdido'].includes(d.stage)).length;
  const rate=closed?Math.round(won/closed*100):0;
  const incomplete=data.tasks.filter(t=>!t.done).length;
  const active=openDeals(data.deals).length;
  const score=Math.min(99,Math.max(0,Math.round(rate*.48+Math.min(active,12)*1.8+Math.max(0,10-incomplete)*2.5+18)));
  return <div className="ring-outer" style={{width:size,height:size}}><div className="ring-circle" style={{background:`conic-gradient(#5c91ff 0%, #9a62fb ${score}%,#28365e ${score}%, #28365e 100%)`}}><div className="ring-inner"><strong>{score}<small>/100</small></strong><span><i/>Pulso comercial</span></div></div></div>;
}
