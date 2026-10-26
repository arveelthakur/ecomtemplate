import { useEffect, useState } from 'react';
import { Check, Save } from 'lucide-react';
import { useAdminStore, type AdminSaveScope } from '../context/AdminContext';

type Props={label?:string;testId?:string;className?:string;scope?:AdminSaveScope|AdminSaveScope[];onSaved?:()=>void|Promise<void>};

export default function AdminSaveButton({label='Save Changes',testId='button-save-changes',className='',scope,onSaved}:Props){
  const {flush,dirty,saving}=useAdminStore();
  const [feedback,setFeedback]=useState('');
  const [savedLocally,setSavedLocally]=useState(false);
  useEffect(()=>{if(dirty)setFeedback('');},[dirty]);
  const save=async()=>{
    try{
      const result=await flush(scope);
      if(result==='remote'&&onSaved){
        try{await onSaved();}catch(error){console.warn('[admin-save] Post-save cleanup failed.',error);}
      }
      const message=result==='local'?'Saved on this device; cloud sync is pending.':'Changes saved successfully';
      setSavedLocally(result==='local');
      setFeedback(message);
      window.setTimeout(()=>{setFeedback(current=>current===message?'':current);setSavedLocally(false);},2600);
    }catch(error){
      setSavedLocally(false);
      setFeedback(error instanceof Error?error.message:'Could not save changes. Please retry.');
    }
  };
  const justSaved=feedback==='Changes saved successfully'||savedLocally;
  return <div className={`ad-save-action ${className}`}>
    <button type="button" className={`ad-btn primary ${justSaved?'ad-btn-saved':''}`} onClick={()=>void save()} disabled={saving||!dirty} data-testid={testId}>
      {saving?<Save size={14}/>:justSaved?<Check size={14}/>:<Save size={14}/>}
      {saving?'Saving…':feedback==='Changes saved successfully'?'Saved':savedLocally?'Saved on this device':label}
    </button>
    {feedback&&<span role={feedback==='Changes saved successfully'||savedLocally?'status':'alert'} className={feedback==='Changes saved successfully'||savedLocally?'ad-save-success':'ad-error'}>{feedback}</span>}
  </div>;
}
