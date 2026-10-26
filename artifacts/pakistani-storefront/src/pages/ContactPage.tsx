import { Link } from 'react-router-dom';
import { useAdminStore } from '../context/AdminContext';
import { CommerceLayout } from '../components/CommerceLayout';
import { ContactForm } from '../components/Storefront';
import { configuredStoreName } from '../utils/branding';

export default function ContactPage(){
  const {data}=useAdminStore();
  const contactSection=data.content.homeSections.find(section=>section.id==='contact');
  const storeName=configuredStoreName(data.settings.general.storeName);
  return <CommerceLayout>
    <ContactForm heading={contactSection?.headingOverride||(storeName?`Contact ${storeName}`:'Get in touch')} subheading={contactSection?.subheadingOverride||'Questions about a product, delivery, or an existing order? Send our team a note and we’ll help you find an answer.'}/>
    <div className="page-wrap py-8 text-xs leading-6 text-[#766d64]">
      <p>{data.content.contact.phone}</p><p>{data.content.contact.email}</p><p>{data.content.contact.address}</p>
      <Link to="/account" className="mt-3 inline-block underline">View your orders</Link>
    </div>
  </CommerceLayout>;
}
