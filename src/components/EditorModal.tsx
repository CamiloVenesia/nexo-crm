import { useEffect, useState } from 'react';
import { X, Trash2, Check, Info } from 'lucide-react';
import { useCRM } from '../lib/store';
import { blankDeal, blankContact, blankCompany, blankTask, createId } from '../lib/seed';
import { Company, Contact, Deal, STAGES, Task, Stage } from '../types';

export type Editing = {kind:'deal';value?:Deal}|{kind:'contact';value?:Contact}|{kind:'company';value?:Company}|{kind:'task';value?:Task};
const labels={deal:'oportunidad',contact:'contacto',company:'empresa',task:'tarea'};
export function EditorModal({editing,onClose}:{editing:Editing,onClose:()=>void}) {
  const crm=useCRM();const {data}=crm;
  const [form,setForm]=useState<Deal|Contact|Company|Task>(()=>{
    const now=new Date().toISOString();const id=createId();
    if(editing.value)return {...editing.value};
    if(editing.kind==='deal')return {...blankDeal(),id,createdAt:now,updatedAt:now};
    if(editing.kind==='contact')return {...blankContact(),id,createdAt:now};
    if(editing.kind==='company')return {...blankCompany(),id,createdAt:now};
    return {...blankTask(),id,createdAt:now};
  });
  const [error,setError]=useState('');
  useEffect(()=>{const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',esc);return()=>window.removeEventListener('keydown',esc)},[onClose]);
  const setField=(key:string,value:unknown)=>setForm(current=>({...current,[key]:value}));
  const save=(event:React.FormEvent)=>{
    event.preventDefault();setError('');
    if(editing.kind==='deal') {
      const item=form as Deal;
      if(!item.title.trim())return setError('Ingresá el nombre de la oportunidad.');
      if(!Number.isFinite(item.amount)||item.amount<0)return setError('El importe debe ser un número válido, mayor o igual que cero.');
      if(item.probability<0||item.probability>100)return setError('La probabilidad debe estar entre 0 y 100.');
      crm.upsertDeal({...item,title:item.title.trim(),updatedAt:new Date().toISOString()});
    } else if(editing.kind==='contact') {
      const item=form as Contact;
      if(!item.name.trim())return setError('Ingresá el nombre del contacto.');
      if(item.email&& !/^\S+@\S+\.\S+$/.test(item.email))return setError('Ingresá un correo válido.');
      if(item.email&&data.contacts.some(c=>c.id!==item.id&&c.email.toLowerCase()===item.email.toLowerCase()))return setError('Ya existe un contacto con ese correo.');
      crm.upsertContact({...item,name:item.name.trim()});
    } else if(editing.kind==='company'){
      const item=form as Company;
      if(!item.name.trim())return setError('Ingresá el nombre de la empresa.');
      if(data.companies.some(c=>c.id!==item.id&&c.name.toLowerCase()===item.name.trim().toLowerCase()))return setError('Ya existe una empresa con ese nombre.');
      crm.upsertCompany({...item,name:item.name.trim()});
    }else{
      const item=form as Task;
      if(!item.title.trim())return setError('Ingresá el título de la tarea.');
      if(!item.dueDate)return setError('Elegí una fecha de vencimiento.');
      crm.upsertTask({...item,title:item.title.trim()});
    }
    onClose();
  };
  const remove=()=>{
    if(!editing.value)return;
    if(!window.confirm(`¿Eliminar esta ${labels[editing.kind]}? Esta acción no se puede deshacer.`))return;
    if(editing.kind==='deal')crm.removeDeal(editing.value.id);
    if(editing.kind==='contact'){
      if(data.deals.some(d=>d.contactId===editing.value?.id))return setError('Este contacto está vinculado a oportunidades. Desvinculalo antes de eliminarlo.');
      crm.removeContact(editing.value.id);
    }
    if(editing.kind==='company'){
      if(data.contacts.some(c=>c.companyId===editing.value?.id)||data.deals.some(d=>d.companyId===editing.value?.id))return setError('Esta empresa tiene contactos u oportunidades vinculados. Desvinculalos primero.');
      crm.removeCompany(editing.value.id);
    }
    if(editing.kind==='task')crm.removeTask(editing.value.id);
    onClose();
  };
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <section className="editor-modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading">
      <header className="modal-head"><div><span className="modal-eyebrow">CENTRO DE TRABAJO</span><h2 id="modal-heading">{editing.value?'Editar':'Nueva'} {labels[editing.kind]}</h2><p>Los cambios se guardan en esta demo automáticamente.</p></div><button className="icon-btn" title="Cerrar" onClick={onClose}><X size={19}/></button></header>
      <form onSubmit={save} className="modal-form">
        {editing.kind==='deal'&&<>
          <div className="form-field full"><label htmlFor="dtitle">Nombre de la oportunidad *</label><input id="dtitle" autoFocus required maxLength={110} value={(form as Deal).title} onChange={e=>setField('title',e.target.value)} placeholder="Ej. Implementación de CRM"/></div>
          <div className="form-field"><label>Empresa</label><select value={(form as Deal).companyId} onChange={e=>{setField('companyId',e.target.value);setField('contactId','')}}><option value="">Sin empresa</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="form-field"><label>Contacto</label><select value={(form as Deal).contactId} onChange={e=>setField('contactId',e.target.value)}><option value="">Sin contacto</option>{data.contacts.filter(c=>!((form as Deal).companyId)||c.companyId===(form as Deal).companyId).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="form-field"><label>Importe ({data.settings.currency}) *</label><input type="number" min={0} step="1" required value={(form as Deal).amount} onChange={e=>setField('amount',Number(e.target.value))}/></div>
          <div className="form-field"><label>Etapa</label><select value={(form as Deal).stage} onChange={e=>{const stage=e.target.value as Stage;setForm(current=>({...current,stage,probability:STAGES.find(s=>s.id===stage)?.probability??15}));}}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></div>
          <div className="form-field"><label>Probabilidad (%)</label><input type="number" min={0} max={100} required value={(form as Deal).probability} onChange={e=>setField('probability',Number(e.target.value))}/></div>
          <div className="form-field"><label>Fecha estimada de cierre</label><input type="date" value={(form as Deal).dueDate} onChange={e=>setField('dueDate',e.target.value)}/></div>
          <div className="form-field full"><label>Responsable</label><input value={(form as Deal).owner} maxLength={90} onChange={e=>setField('owner',e.target.value)}/></div>
          <div className="form-field full"><label>Notas y próximos pasos</label><textarea rows={4} value={(form as Deal).notes} maxLength={2500} onChange={e=>setField('notes',e.target.value)} placeholder="Contexto, objeciones, próximos pasos…"/></div>
        </>}
        {editing.kind==='contact'&&<>
          <div className="form-field full"><label>Nombre y apellido *</label><input autoFocus required maxLength={100} value={(form as Contact).name} onChange={e=>setField('name',e.target.value)} placeholder="Ej. Ana López"/></div>
          <div className="form-field"><label>Correo electrónico</label><input type="email" value={(form as Contact).email} onChange={e=>setField('email',e.target.value)} placeholder="ana@empresa.com"/></div>
          <div className="form-field"><label>Teléfono</label><input type="tel" value={(form as Contact).phone} onChange={e=>setField('phone',e.target.value)} placeholder="+54 341 ..."/></div>
          <div className="form-field"><label>Empresa</label><select value={(form as Contact).companyId} onChange={e=>setField('companyId',e.target.value)}><option value="">Sin empresa</option>{data.companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div className="form-field"><label>Cargo</label><input value={(form as Contact).role} onChange={e=>setField('role',e.target.value)} placeholder="Ej. Gerente de ventas"/></div>
          <div className="form-field"><label>Estado</label><select value={(form as Contact).status} onChange={e=>setField('status',e.target.value)}><option value="nuevo">Nuevo</option><option value="contactado">Contactado</option><option value="calificado">Calificado</option></select></div>
          <div className="form-field"><label>Origen</label><select value={(form as Contact).source} onChange={e=>setField('source',e.target.value)}>{['Manual','Sitio web','Referido','LinkedIn','WhatsApp','Evento','Otro'].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="form-field full"><label>Notas</label><textarea rows={4} value={(form as Contact).notes} onChange={e=>setField('notes',e.target.value)}/></div>
        </>}
        {editing.kind==='company'&&<>
          <div className="form-field full"><label>Razón social / nombre *</label><input autoFocus required maxLength={110} value={(form as Company).name} onChange={e=>setField('name',e.target.value)} placeholder="Ej. Estudio Norte"/></div>
          <div className="form-field"><label>Industria</label><input value={(form as Company).industry} onChange={e=>setField('industry',e.target.value)} placeholder="Tecnología, comercio…"/></div>
          <div className="form-field"><label>Tamaño del equipo</label><select value={(form as Company).employees} onChange={e=>setField('employees',e.target.value)}>{['1-10','11-50','51-200','201-500','500+'].map(x=><option key={x}>{x}</option>)}</select></div>
          <div className="form-field"><label>Ubicación</label><input value={(form as Company).location} onChange={e=>setField('location',e.target.value)} placeholder="Rosario, Argentina"/></div>
          <div className="form-field"><label>Sitio web</label><input value={(form as Company).website} onChange={e=>setField('website',e.target.value)} placeholder="ejemplo.com"/></div>
        </>}
        {editing.kind==='task'&&<>
          <div className="form-field full"><label>Título de la tarea *</label><input autoFocus required maxLength={150} value={(form as Task).title} onChange={e=>setField('title',e.target.value)} placeholder="Ej. Llamar al cliente"/></div>
          <div className="form-field"><label>Fecha de vencimiento *</label><input type="date" required value={(form as Task).dueDate} onChange={e=>setField('dueDate',e.target.value)}/></div>
          <div className="form-field"><label>Prioridad</label><select value={(form as Task).priority} onChange={e=>setField('priority',e.target.value)}><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select></div>
          <div className="form-field full"><label>Oportunidad vinculada</label><select value={(form as Task).dealId} onChange={e=>setField('dealId',e.target.value)}><option value="">Sin vincular</option>{data.deals.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select></div>
          <div className="form-field full"><label>Descripción</label><textarea rows={4} value={(form as Task).description} onChange={e=>setField('description',e.target.value)}/></div>
          <div className="form-field full"><label className="check-label"><input type="checkbox" checked={(form as Task).done} onChange={e=>setField('done',e.target.checked)}/> Marcar como completada</label></div>
        </>}
        {error&&<div className="form-error" role="alert"><Info size={15}/>{error}</div>}
        <footer className="modal-footer">{editing.value&&<button type="button" className="btn btn-danger-subtle" onClick={remove}><Trash2 size={15}/>Eliminar</button>}<span className="modal-spacer"/><button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary"><Check size={16}/>Guardar {labels[editing.kind]}</button></footer>
      </form>
    </section>
  </div>;
}
