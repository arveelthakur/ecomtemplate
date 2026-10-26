const failureDetails=error=>{
  if(!error||typeof error!=='object')return {code:'',status:undefined,message:String(error??'')};
  const item=error;
  const cause=item.cause&&typeof item.cause==='object'?item.cause:{};
  const custom=item.customData&&typeof item.customData==='object'?item.customData:{};
  const rawStatus=item.status??item.statusCode??cause.status??custom.status;
  const number=Number(rawStatus);
  return {code:String(item.code??cause.code??''),status:Number.isFinite(number)?number:undefined,message:[item.message,cause.message,custom.serverResponse].filter(value=>typeof value==='string').join(' ')};
};

export function classifyAdminSyncFailure(error){
  const {code,status,message}=failureDetails(error);
  const normalizedCode=code.toUpperCase();
  if(/supabase.*not configured|missing.*VITE_SUPABASE_(?:URL|ANON_KEY)/i.test(message))return 'configuration';
  if(status===401||['PGRST301','28P01','AUTH_SESSION_MISSING'].includes(normalizedCode)||/jwt (?:is )?expired|expired access token|invalid jwt|session (?:has )?expired|sign in again/i.test(message))return 'session';
  if(status===403||normalizedCode==='42501'||/row.level security|permission denied|not authorized|insufficient privilege/i.test(message))return 'permissions';
  if(status===429||normalizedCode==='8'||/rate limit|too many requests|resource[-_ ]exhausted|quota/i.test(message))return 'backend-throttled';
  if(status===408||status===425||(status!==undefined&&status>=500)||error instanceof TypeError||/network error|fetch failed|connection (?:reset|closed|lost)|timed? ?out|temporarily unavailable/i.test(message))return 'network';
  return 'unknown';
}

export function adminSyncFailureMessage(reason){
  switch(reason){
    case 'configuration':return 'Supabase is not configured for this deployment. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
    case 'session':return 'Supabase rejected or expired the current sign-in session. Sign out and back in, then retry.';
    case 'permissions':return 'Supabase rejected the admin write. Verify the latest database migration is applied and the signed-in account user UUID is present in public.admin_allowlist.';
    case 'backend-throttled':return 'Supabase is temporarily rate-limiting writes. Wait briefly and retry.';
    case 'network':return 'Supabase is temporarily unreachable or returned a server error. Check the connection and retry.';
    default:return 'Supabase could not confirm this save. Retry; if it repeats, check the browser console diagnostic.';
  }
}
