import { useEffect } from 'react';

type Props={label?:string;testId?:string;className?:string;scope?:unknown;onSaved?:()=>void|Promise<void>};

const postSaveCallbacks=new Set<NonNullable<Props['onSaved']>>();

export async function runAdminSaveCallbacks(){
  for(const callback of [...postSaveCallbacks]){
    try{await callback();}catch(error){console.warn('[admin-save] Post-save cleanup failed.',error);}
  }
}

/** Legacy scoped save controls register optional cleanup; one toolbar action now commits all pending edits. */
export default function AdminSaveButton({onSaved}:Props){
  useEffect(()=>{
    if(!onSaved)return;
    postSaveCallbacks.add(onSaved);
    return()=>{postSaveCallbacks.delete(onSaved);};
  },[onSaved]);
  return null;
}
