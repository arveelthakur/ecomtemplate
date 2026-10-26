const sectionRoutes:Record<string,string>={
  top:'/',
  shop:'/shop',
  collections:'/collections',
  story:'/about',
  about:'/about',
  reviews:'/reviews',
  shipping:'/policies/shipping',
  return:'/policies/returns',
  returns:'/policies/returns',
};

function canonicalPath(pathname:string){
  const category=pathname.match(/^\/category\/([^/]+)(.*)$/);
  if(category)return `/collections/${category[1]}${category[2]}`;

  const policy=pathname.match(/^\/policy\/(shipping|return|returns|terms|privacy)(.*)$/);
  if(policy){
    const type=policy[1]==='return'?'returns':policy[1];
    return `/policies/${type}${policy[2]}`;
  }
  return pathname;
}

export function canonicalStorefrontLink(rawHref:string){
  const href=rawHref.trim();
  if(!href)return '';
  if(/^(https?:\/\/|mailto:|tel:)/i.test(href))return href;
  if(href.startsWith('//'))return '';

  const hashIndex=href.indexOf('#');
  if(hashIndex>=0){
    const base=href.slice(0,hashIndex);
    const hash=href.slice(hashIndex+1).split(/[/?#]/)[0].toLowerCase();
    const mapped=sectionRoutes[hash];
    if(mapped)return mapped;
    if(!base||base==='/')return '';
    return canonicalPath(base);
  }

  if(!href.startsWith('/'))return '';
  const queryIndex=href.indexOf('?');
  const pathname=queryIndex<0?href:href.slice(0,queryIndex);
  const query=queryIndex<0?'':href.slice(queryIndex);
  return `${canonicalPath(pathname)}${query}`;
}
