import { ArrowDown, ArrowUp, ChevronDown, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useAdminStore, type FooterBlockId, type FooterBlockSetting, type FooterLinkItem } from '../context/AdminContext';
import AdminSaveButton from './AdminSaveButton';

type LinkGroup='exploreLinks'|'helpLinks';

function Field({label,children,help}:{label:string;children:ReactNode;help?:string}){
  return <label className="ad-field"><span className="ad-label">{label}</span>{children}{help&&<span className="ad-help">{help}</span>}</label>;
}

export default function FooterInfoManager(){
  const {data,setData}=useAdminStore();
  const footer=data.content.footer;
  const [expandedBlocks,setExpandedBlocks]=useState<Record<string,boolean>>({});

  const updateFooter=<K extends keyof typeof footer>(key:K,value:(typeof footer)[K])=>{
    setData(previous=>({...previous,content:{...previous.content,footer:{...previous.content.footer,[key]:value}}}));
  };
  const updateBlock=(id:FooterBlockId,patch:Partial<FooterBlockSetting>)=>{
    setData(previous=>({...previous,content:{...previous.content,footer:{
      ...previous.content.footer,
      blocks:previous.content.footer.blocks.map(block=>block.id===id?{...block,...patch}:block),
    }}}));
  };
  const moveBlock=(id:FooterBlockId,direction:-1|1)=>{
    setData(previous=>{
      const blocks=[...previous.content.footer.blocks];
      const index=blocks.findIndex(block=>block.id===id);
      const destination=index+direction;
      if(index<0||destination<0||destination>=blocks.length)return previous;
      [blocks[index],blocks[destination]]=[blocks[destination],blocks[index]];
      return {...previous,content:{...previous.content,footer:{...previous.content.footer,blocks}}};
    });
  };
  const updateContact=<K extends keyof typeof data.content.contact>(key:K,value:(typeof data.content.contact)[K])=>{
    setData(previous=>({...previous,content:{...previous.content,contact:{...previous.content.contact,[key]:value}}}));
  };
  const updateLinks=(group:LinkGroup,next:FooterLinkItem[])=>updateFooter(group,next);
  const editLink=(group:LinkGroup,index:number,patch:Partial<FooterLinkItem>)=>{
    updateLinks(group,footer[group].map((link,i)=>i===index?{...link,...patch}:link));
  };
  const moveLink=(group:LinkGroup,index:number,direction:-1|1)=>{
    const links=[...footer[group]];
    const destination=index+direction;
    if(destination<0||destination>=links.length)return;
    [links[index],links[destination]]=[links[destination],links[index]];
    updateLinks(group,links);
  };
  const addLink=(group:LinkGroup)=>{
    const label=group==='exploreLinks'?'New link':'New policy link';
    updateLinks(group,[...footer[group],{id:`footer-${crypto.randomUUID()}`,label,href:'/'}]);
  };
  const removeLink=(group:LinkGroup,index:number)=>updateLinks(group,footer[group].filter((_,i)=>i!==index));

  const sectionTitle=(id:FooterBlockId)=>({
    brand:'Brand description & social links',
    explore:'Explore navigation block',
    help:'Here to help / policy links block',
    contact:'Stay in touch / contact details block',
    hours:'Business hours',
    subfooter:'Bottom sub-footer bar',
  })[id];

  const renderLinks=(group:LinkGroup)=>{
    const links=footer[group];
  return <div className="ad-form-stack">
      <div className="ad-toolbar">
        <span className="ad-help">{group==='exploreLinks'?'Links shown in Explore':'Policy and order-help links'}</span>
        <button type="button" className="ad-btn small" onClick={()=>addLink(group)} data-testid={`button-add-footer-link-${group}`}><Plus/> Add link</button>
      </div>
      {!links.length?<div className="ad-empty">No links. Add one to display links in this footer block.</div>:links.map((link,index)=><div className="ad-card" key={link.id} data-testid={`footer-link-row-${group}-${index}`}>
        <div className="ad-card-body ad-form-stack">
          <div className="ad-form-row">
            <Field label="Link text"><input className="ad-input" value={link.label} maxLength={80} onChange={event=>editLink(group,index,{label:event.target.value})} data-testid={`input-footer-link-label-${group}-${index}`}/></Field>
            <Field label="Destination" help="Use a storefront path such as /policies/shipping or a https:// link.">
              <input className="ad-input" value={link.href} maxLength={1000} onChange={event=>editLink(group,index,{href:event.target.value})} data-testid={`input-footer-link-href-${group}-${index}`}/>
            </Field>
          </div>
          <div className="ad-toolbar">
            <div className="ad-toolbar">
              <button type="button" className="ad-btn small" aria-label={`Move ${link.label} up`} disabled={index===0} onClick={()=>moveLink(group,index,-1)} data-testid={`button-footer-link-up-${group}-${index}`}><ArrowUp/></button>
              <button type="button" className="ad-btn small" aria-label={`Move ${link.label} down`} disabled={index===links.length-1} onClick={()=>moveLink(group,index,1)} data-testid={`button-footer-link-down-${group}-${index}`}><ArrowDown/></button>
            </div>
            <button type="button" className="ad-btn small danger" onClick={()=>removeLink(group,index)} aria-label={`Remove ${link.label}`} data-testid={`button-remove-footer-link-${group}-${index}`}><Trash2/> Remove</button>
          </div>
        </div>
      </div>)}
    </div>;
  };

  return <div className="ad-form-stack" data-testid="footer-info-manager">
    <div className="ad-toolbar" style={{justifyContent:'space-between'}}><p className="ad-help">Edit one footer block at a time. Changes remain drafts until saved.</p><AdminSaveButton scope={['content.footer','content.contact']} testId="button-save-footer-info"/></div>
    <div className="ad-notice">Reorder blocks with the arrows. Hidden blocks remain editable here. Social profile URLs are managed under Settings → Social links.</div>
    {footer.blocks.map((block,index)=><section className="ad-card" key={block.id} data-testid={`footer-section-config-${block.id}`}>
      <header className="ad-card-head">
        <div><h2 className="ad-card-title">{sectionTitle(block.id)}</h2><span className="ad-help">Position {index+1} of {footer.blocks.length}</span></div>
        <div className="ad-toolbar">
          <button type="button" className="ad-btn small" aria-label={`Move ${sectionTitle(block.id)} up`} disabled={index===0} onClick={()=>moveBlock(block.id,-1)} data-testid={`button-footer-move-up-${block.id}`}><ArrowUp/></button>
          <button type="button" className="ad-btn small" aria-label={`Move ${sectionTitle(block.id)} down`} disabled={index===footer.blocks.length-1} onClick={()=>moveBlock(block.id,1)} data-testid={`button-footer-move-down-${block.id}`}><ArrowDown/></button>
          <span className="ad-help">{block.visible?'Visible':'Hidden'}</span>
          <button type="button" role="switch" aria-checked={block.visible} aria-label={`${block.visible?'Hide':'Show'} ${sectionTitle(block.id)}`} className={`ad-browse-switch${block.visible?' on':''}`} onClick={()=>updateBlock(block.id,{visible:!block.visible})} data-testid={`toggle-footer-block-${block.id}`}><span/></button>
          <button type="button" className="ad-btn small" aria-expanded={!!expandedBlocks[block.id]} aria-controls={`footer-block-editor-${block.id}`} onClick={()=>setExpandedBlocks(previous=>({...previous,[block.id]:!previous[block.id]}))} data-testid={`button-edit-footer-block-${block.id}`}>{expandedBlocks[block.id]?'Hide editor':'Edit'}<ChevronDown size={14} style={{transform:expandedBlocks[block.id]?'rotate(180deg)':undefined}}/></button>
        </div>
      </header>
      {expandedBlocks[block.id]&&<div className="ad-card-body ad-form-stack" id={`footer-block-editor-${block.id}`}>
        {block.id!=='brand'&&block.id!=='subfooter'&&<Field label="Block heading">
          <input className="ad-input" value={block.heading} maxLength={80} onChange={event=>updateBlock(block.id,{heading:event.target.value})} data-testid={`input-footer-heading-${block.id}`}/>
        </Field>}
        {block.id==='brand'&&<>
          <Field label="Brand description"><textarea className="ad-input" rows={4} maxLength={2000} value={footer.description} onChange={event=>updateFooter('description',event.target.value)} data-testid="input-footer-description"/></Field>
        </>}
        {block.id==='explore'&&renderLinks('exploreLinks')}
        {block.id==='help'&&renderLinks('helpLinks')}
        {block.id==='contact'&&<>
          <Field label="Supporting text"><textarea className="ad-input" rows={2} maxLength={1000} value={footer.helpText} onChange={event=>updateFooter('helpText',event.target.value)} data-testid="input-footer-help-text"/></Field>
          <div className="ad-form-row">
            <Field label="Phone"><input className="ad-input" value={data.content.contact.phone} maxLength={40} onChange={event=>updateContact('phone',event.target.value)} data-testid="input-footer-contact-phone"/></Field>
            <Field label="Email"><input className="ad-input" type="email" value={data.content.contact.email} maxLength={254} onChange={event=>updateContact('email',event.target.value)} data-testid="input-footer-contact-email"/></Field>
          </div>
          <Field label="Address"><textarea className="ad-input" rows={2} maxLength={500} value={data.content.contact.address} onChange={event=>updateContact('address',event.target.value)} data-testid="input-footer-contact-address"/></Field>
        </>}
        {block.id==='hours'&&<Field label="Business hours"><textarea className="ad-input" rows={2} maxLength={500} value={footer.hours} onChange={event=>updateFooter('hours',event.target.value)} data-testid="input-footer-hours"/></Field>}
        {block.id==='subfooter'&&<>
          <Field label="Copyright note"><input className="ad-input" maxLength={240} value={footer.subFooter.copyrightText} onChange={event=>updateFooter('subFooter',{...footer.subFooter,copyrightText:event.target.value})} data-testid="input-footer-copyright"/></Field>
          <Field label="Price note" help="Use {currency} to insert the store currency automatically."><input className="ad-input" maxLength={240} value={footer.subFooter.priceText} onChange={event=>updateFooter('subFooter',{...footer.subFooter,priceText:event.target.value})} data-testid="input-footer-price-note"/></Field>
          <Field label="Payment notes"><input className="ad-input" maxLength={300} value={footer.subFooter.paymentNotes} onChange={event=>updateFooter('subFooter',{...footer.subFooter,paymentNotes:event.target.value})} data-testid="input-footer-payment-notes"/></Field>
        </>}
      </div>}
    </section>)}
  </div>;
}
