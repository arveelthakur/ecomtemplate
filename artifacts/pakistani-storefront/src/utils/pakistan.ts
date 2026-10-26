export const pakistanCities: Record<string, string[]> = {
  Punjab: ['Lahore', 'Rawalpindi', 'Faisalabad', 'Multan', 'Gujranwala', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Gujrat', 'Rahim Yar Khan'],
  Sindh: ['Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah', 'Mirpur Khas', 'Jacobabad'],
  'Khyber Pakhtunkhwa': ['Peshawar', 'Mardan', 'Abbottabad', 'Kohat', 'Mingora', 'Dera Ismail Khan', 'Mansehra'],
  Balochistan: ['Quetta', 'Gwadar', 'Turbat', 'Khuzdar', 'Sibi', 'Chaman'],
  'Islamabad Capital Territory': ['Islamabad'],
  'Gilgit-Baltistan': ['Gilgit', 'Skardu', 'Hunza', 'Chilas'],
  'Azad Jammu & Kashmir': ['Muzaffarabad', 'Mirpur', 'Kotli', 'Rawalakot', 'Bagh'],
};

export function normalizePakistanMobile(value: string): string | null {
  const digits = value.replace(/\D/g, '').replace(/^0092/, '92');
  const national = digits.startsWith('92') ? digits.slice(2) : digits.replace(/^0/, '');
  return /^3\d{9}$/.test(national) ? `+92${national}` : null;
}

export function checkoutDeliveryError(form: {
  fullName: string; phone: string; address: string; city: string; postalCode?: string;
}): string | null {
  if (!form.fullName.trim()) return 'Enter the recipient’s full name.';
  if (!normalizePakistanMobile(form.phone)) return 'Enter a valid Pakistan mobile number, for example 0300 1234567.';
  if (!form.address.trim()) return 'Enter your house number and street address.';
  if (!Object.values(pakistanCities).some(cities => cities.includes(form.city))) return 'Choose a supported delivery city.';
  if (form.postalCode?.trim() && !/^\d{5}$/.test(form.postalCode.trim())) return 'Enter a 5-digit postal code, or leave it empty.';
  return null;
}
