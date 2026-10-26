import { ArrowRight, MapPin, MessageCircle, Phone, Share2 } from 'lucide-react';
import { SiFacebook, SiInstagram, SiTiktok } from 'react-icons/si';
import { Link } from 'react-router-dom';
import { useAdminStore, type FooterBlockSetting, type FooterLinkItem, type FooterSocialProfile } from '../context/AdminContext';
import { canonicalStorefrontLink } from '../utils/storefrontLinks';
import StoreImage from './StoreImage';
import { configuredStoreName } from '../utils/branding';

function FooterLink({link}:{link:FooterLinkItem}){
  const href=canonicalStorefrontLink(link.href);
  const testId=({terms:'link-terms',privacy:'link-privacy',shipping:'link-shipping',returns:'link-returns','continue-shopping':'link-continue-shopping'} as Record<string,string>)[link.id]||`link-footer-${link.id}`;
  if(/^https?:\/\//i.test(href)||/^mailto:/i.test(href)||/^tel:/i.test(href)){
    const external=/^https?:\/\//i.test(href);
    return <a href={href} target={external?'_blank':undefined} rel={external?'noreferrer':undefined} className="nura-footer-link" data-testid={testId}>{link.label}</a>;
  }
  if((href.startsWith('/')&&!href.startsWith('//'))||href.startsWith('#'))return <Link to={href} className="nura-footer-link" data-testid={testId}>{link.label}</Link>;
  return <span data-testid={testId}>{link.label}</span>;
}

function FooterSectionHeading({block}:{block:FooterBlockSetting}){
  return block.heading?<h3 className="nura-footer-heading text-[10px] tracking-[.17em] font-bold" data-footer-zone="heading" data-testid={`footer-heading-${block.id}`}>{block.heading}</h3>:null;
}

export default function StoreFooter(){
  const {data}=useAdminStore();
  const footer=data.content.footer;
  const contact=data.content.contact;
  const storeName=configuredStoreName(data.settings.general.storeName);
  const logoUrl=data.settings.general.storeLogoUrl.trim();
  const digits=contact.phone.replace(/\D/g,'');
  const visibleBlocks=footer.blocks.filter(block=>block.visible);
  const knownSocialIcons:Record<Exclude<FooterSocialProfile['icon'],'share'>,typeof SiFacebook>={facebook:SiFacebook,instagram:SiInstagram,tiktok:SiTiktok};
  const socialLinks=footer.socialProfiles
    .filter(profile=>profile.visible&&profile.href.trim())
    .map(profile=>({...profile,Icon:profile.icon==='share'?Share2:knownSocialIcons[profile.icon]}));
  if(!visibleBlocks.length)return null;

  const renderBlock=(block:FooterBlockSetting)=>{
    const common={className:`nura-footer-block${block.id==='subfooter'?' nura-footer-subfooter':''}`, 'data-testid':`footer-block-${block.id}`,...(block.id==='subfooter'?{'data-footer-zone':'subfooter'}:{})};
    if(block.id==='brand')return <section key={block.id} {...common}>
      {block.heading&&<FooterSectionHeading block={block}/>}
      {(logoUrl||storeName)&&<Link to="/" aria-label={storeName||'Home'} className="inline-flex max-w-full items-center" data-testid="link-footer-home">
        <span className="nura-wordmark-row inline-flex min-w-0 max-w-full items-baseline gap-[1px]">
          {logoUrl?<StoreImage src={logoUrl} alt={storeName?`${storeName} logo`:'Store logo'} className="block h-12 max-w-[220px] object-contain sm:h-14" placeholderTitle="Store logo" placeholderHint="Upload a logo in store settings." placeholderDimensions="Recommended: 1200 × 400 px"/>:<span className="serif max-w-full truncate font-extrabold text-[44px] leading-none tracking-[-.08em] sm:text-[52px]">{storeName}</span>}
          <span className="nura-logo-dot inline-block text-[44px] leading-none sm:text-[52px]" aria-hidden="true"/>
        </span>
      </Link>}
      <p className="nura-footer-copy mt-4 max-w-[250px] text-[12px] leading-6" data-footer-zone="body" data-theme-role="description">{footer.description.trim()||'A thoughtfully curated selection for everyday life. Add your store introduction in the admin panel.'}</p>
      {!!socialLinks.length&&<div className="flex gap-3 mt-5">{socialLinks.map(({id,href,label,Icon})=><a key={id} href={href} target="_blank" rel="noreferrer" aria-label={label} className="w-9 h-9 rounded-full border border-white/20 grid place-items-center hover:bg-white/10"><Icon size={16}/></a>)}</div>}
    </section>;
    if(block.id==='explore'||block.id==='help'){
      const links=block.id==='explore'?footer.exploreLinks:footer.helpLinks;
      return <section key={block.id} {...common}>
        <FooterSectionHeading block={block}/>
        <div className="nura-footer-links nura-footer-copy mt-4 flex flex-col gap-0 divide-y divide-white/10 text-[12px] leading-5 md:gap-3 md:divide-y-0" data-footer-zone="body">{links.map(link=><FooterLink key={link.id} link={link}/>)}</div>
      </section>;
    }
    if(block.id==='contact')return <section key={block.id} {...common}>
      <FooterSectionHeading block={block}/>
      <p className="nura-footer-copy mt-4 text-[12px] leading-6" data-footer-zone="body">{footer.helpText}</p>
      <div className="nura-footer-links nura-footer-copy mt-4 flex flex-col gap-0 divide-y divide-white/10 text-[12px] leading-5 md:gap-3 md:divide-y-0" data-footer-zone="body">
        {contact.phone&&<a href={`tel:${contact.phone.replace(/[^\d+]/g,'')}`} className="inline-flex items-center gap-2"><Phone size={14}/> {contact.phone}</a>}
        {contact.email&&<a href={`mailto:${contact.email}`} className="inline-flex items-center gap-2"><ArrowRight size={14}/> {contact.email}</a>}
        {contact.address&&<span className="inline-flex items-start gap-2"><MapPin size={14} className="mt-0.5 shrink-0"/> {contact.address}</span>}
      </div>
      {digits&&<a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="nura-footer-copy mt-4 inline-flex items-center gap-2 border-b border-white/35 pb-1 text-[12px]" data-footer-zone="body"><MessageCircle size={14}/> WhatsApp us</a>}
    </section>;
    if(block.id==='hours')return <section key={block.id} {...common}>
      <FooterSectionHeading block={block}/>
      <p className="nura-footer-copy mt-4 text-[12px] leading-6" data-footer-zone="body">{footer.hours.trim()||'Example hours: add your store’s opening days and local time before publishing.'}</p>
    </section>;
    const priceText=footer.subFooter.priceText.replaceAll('{currency}',data.settings.general.currency);
    return <div key={block.id} {...common}>
      <span data-testid="footer-copyright-note">© {new Date().getFullYear()}{storeName?` ${storeName}.`:''} {footer.subFooter.copyrightText}</span>
      <span data-testid="footer-price-note">{priceText}</span>
      <span data-testid="footer-payment-note">{footer.subFooter.paymentNotes}</span>
    </div>;
  };

  const contentBlocks=visibleBlocks.filter(block=>block.id!=='subfooter');
  const subfooterBlock=visibleBlocks.find(block=>block.id==='subfooter');
  return <footer className="nura-store-footer pt-12 pb-6 sm:pt-16" data-testid="storefront-footer">
    <div className="page-wrap">
      <div className="nura-footer-grid">{contentBlocks.map(renderBlock)}</div>
      {subfooterBlock&&<div className="nura-footer-meta" data-testid="footer-meta-stable">{renderBlock(subfooterBlock)}</div>}
    </div>
  </footer>;
}
