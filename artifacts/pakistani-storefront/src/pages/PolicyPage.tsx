import { Link, useParams } from 'react-router-dom';
import { CommerceLayout } from '../components/CommerceLayout';
import { defaultAdminData, useAdminStore } from '../context/AdminContext';
import { formatPKR } from '../utils/store';
import { findPolicyBySlug } from '../utils/seo';

export default function PolicyPage() {
  const { type = '' } = useParams();
  const {data}=useAdminStore();
  const entry=findPolicyBySlug(data.policies,type);
  const policyKey=(entry?.[0]||(type==='returns'?'return':type)) as keyof typeof data.policies;
  const policy=entry?.[1]||data.policies[policyKey];
  if (!policy) return <CommerceLayout eyebrow="Store information" title="This policy page isn’t here." intro="Choose one of our help topics instead."><div className="mt-5 flex flex-wrap gap-4 text-xs font-semibold text-[#6B2447]"><Link to="/policies/terms" data-testid="link-policy-terms">Terms</Link><Link to="/policies/privacy" data-testid="link-policy-privacy">Privacy</Link><Link to="/policies/shipping" data-testid="link-policy-shipping">Shipping</Link><Link to="/policies/returns" data-testid="link-policy-return">Returns</Link></div></CommerceLayout>;
  const sample=defaultAdminData.policies[policyKey];
  const intro=policy.intro?.trim()&&!/^(add |example )/i.test(policy.intro.trim())?policy.intro:sample.intro;
  const clauses=policy.clauses?.length?policy.clauses:sample.clauses;
  const isExample=!policy.clauses?.length||!policy.intro?.trim()||/^(add |example )/i.test(policy.intro.trim())||clauses.some(clause=>/example:|\[[^\]]+\]/i.test(clause.body));
  return <CommerceLayout eyebrow="The helpful details" title={policy.title||sample.title} intro={intro}>
      <div className="max-w-3xl">{clauses.map((clause, index)=>{const oldShippingText='The sample checkout charges Rs 250 when pre-discount subtotal is Rs 3,000 or less, and offers complimentary delivery above Rs 3,000.';const body=policyKey==='shipping'&&clause.id==='shipping-charges'&&clause.body===oldShippingText?`The checkout charges ${formatPKR(data.settings.general.deliveryFee)} when delivery-eligible items do not exceed ${formatPKR(data.content.announcement.freeDeliveryThreshold)}. Complimentary delivery applies above that threshold.`:clause.body;return <article key={clause.id} className="grid gap-3 border-t border-[#e9e2d8] py-6 sm:grid-cols-[62px_1fr]" data-testid={`policy-clause-${index + 1}`}><span className="text-[11px] font-semibold tracking-[.14em] text-[#829078]">{String(index + 1).padStart(2,'0')}</span><div><h2 className="text-sm font-semibold">{clause.heading}</h2><p className="mt-2 text-xs leading-6 text-[#766d64]" data-testid={`text-policy-clause-${index + 1}`}>{body}</p></div></article>})}</div>
    {isExample&&<div className="mt-5 border border-[#dfe5da] bg-[#f3f6f0] p-5 text-xs leading-6 text-[#6a7463]" data-testid="notice-policy-demo">Example policy copy: review and replace bracketed details with your store’s real terms before publishing. This template is for drafting only, not legal advice.</div>}
  </CommerceLayout>;
}