import { Link } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { formatPKR } from '../utils/store';
import { categoryRoute } from '../utils/categoryRoutes';
import CountdownTimer from './CountdownTimer';

const defaultText='Complimentary delivery on orders over Rs 3,000 — across Pakistan';
const legacyDefaultText='Free delivery on orders over Rs 3,000 — all over Pakistan';

export default function AnnouncementBar() {
  const {data}=useAdminStore();
  const announcement=data.content.announcement;
  if(!announcement.visible)return <CountdownTimer placement="announcement"/>;

  const text=announcement.text===defaultText||announcement.text===legacyDefaultText
    ?`Complimentary delivery on orders over ${formatPKR(announcement.freeDeliveryThreshold)} — across Pakistan`
    :announcement.text;
  const isUrdu=/[\u0600-\u06ff\u0750-\u077f]/u.test(text);
  const category=data.categories.find(item=>item.id===announcement.linkCategoryId);
  const categoryHref=category?categoryRoute(category,data.categories):null;
  const rawUrl=announcement.linkUrl.trim();
  const safeUrl=/^https?:\/\//i.test(rawUrl)||(rawUrl.startsWith('/')&&!rawUrl.startsWith('//'))?rawUrl:null;
  const external=announcement.linkType==='url'&&!!safeUrl&&/^https?:\/\//i.test(safeUrl);
  const link=announcement.linkType==='shop'
    ?{to:'/shop' as const}
    :announcement.linkType==='category'&&categoryHref
      ?{to:categoryHref}
      :announcement.linkType==='url'&&safeUrl
        ?{to:safeUrl,external}
        :null;

  const content=<span dir={isUrdu?'rtl':undefined} lang={isUrdu?'ur':undefined} className={`max-w-full break-words text-[10px] leading-4 sm:text-[11px] ${isUrdu?'nura-urdu-text':'tracking-[.04em]'}`} data-testid="text-announcement">{text}</span>;
  return <div className="nura-announcement box-border flex min-h-[34px] w-full max-w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 px-3 py-1 text-center" style={{backgroundColor:'var(--nura-primary,#4A2837)',color:'var(--nura-primary-contrast,#FDFBF7)'}} data-testid="announcement-bar">
    {announcement.visible&&(!link?content:external
      ?<a href={link.to} target="_blank" rel="noreferrer" className="text-inherit no-underline">{content}</a>
      :<Link to={link.to} className="text-inherit no-underline">{content}</Link>)}
    <CountdownTimer placement="announcement"/>
  </div>;
}
