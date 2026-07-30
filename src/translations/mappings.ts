/**
 * Enum/status VALUE -> localized LABEL lookups.
 *
 * These are separate from src/locales/{en,hi}.json (which hold free-standing
 * UI copy). The English `value` on every dropdown/status field in the app
 * NEVER changes with language - only the label shown to the user does. That
 * is what guarantees the database only ever stores/receives English values:
 * there is nothing here that transforms data, only what renders on screen.
 *
 * Usage: translateEnum(girviStatusMap, girvi.status, language)
 * If a value has no entry, the raw English value is returned unchanged -
 * safe fallback, and a fast way to spot missing translations.
 */

export type Language = "en" | "hi";

export type EnumMap = Record<string, { en: string; hi: string }>;

export function translateEnum(map: EnumMap, value: string | undefined | null, lang: Language): string {
  if (!value) return "";
  return map[value]?.[lang] ?? value;
}

// Loan Status (Girvi) - storage.ts Girvi["status"]
export const girviStatusMap: EnumMap = {
  Active: { en: "Active", hi: "सक्रिय" },
  Closed: { en: "Closed", hi: "बंद" },
  Auctioned: { en: "Auctioned", hi: "नीलामी" },
};

// Advance status - storage.ts Advance["status"] (separate entity from Girvi)
export const advanceStatusMap: EnumMap = {
  Active: { en: "Active", hi: "सक्रिय" },
  Redeemed: { en: "Redeemed", hi: "भुनाया गया" },
  Cancelled: { en: "Cancelled", hi: "रद्द" },
};

// Metal Type - union across Girvi/Order/Purchase/Advance entities in storage.ts
export const metalTypeMap: EnumMap = {
  Gold: { en: "Gold", hi: "सोना" },
  Silver: { en: "Silver", hi: "चांदी" },
  Mixed: { en: "Mixed", hi: "मिश्रित" },
  Diamond: { en: "Diamond", hi: "हीरा" },
  Platinum: { en: "Platinum", hi: "प्लैटिनम" },
  Other: { en: "Other", hi: "अन्य" },
};

// Ornament / item category (Girvi's `categories` list, inventory categories)
export const ornamentTypeMap: EnumMap = {
  "Gold Jewellery": { en: "Gold Jewellery", hi: "सोने के आभूषण" },
  "Silver Jewellery": { en: "Silver Jewellery", hi: "चांदी के आभूषण" },
  Pendants: { en: "Pendants", hi: "पेंडेंट" },
  Rings: { en: "Rings", hi: "अंगूठियां" },
};

// Payment Method - union across Invoice/Expense/Purchase in storage.ts
export const paymentMethodMap: EnumMap = {
  Cash: { en: "Cash", hi: "नकद" },
  UPI: { en: "UPI", hi: "यूपीआई" },
  Card: { en: "Card", hi: "कार्ड" },
  Bank: { en: "Bank", hi: "बैंक" },
  EMI: { en: "EMI", hi: "ईएमआई" },
  Credit: { en: "Credit", hi: "उधार" },
  Advance: { en: "Advance", hi: "अग्रिम" },
  "Order Advance": { en: "Order Advance", hi: "ऑर्डर अग्रिम" },
};

// Invoice Type
export const invoiceTypeMap: EnumMap = {
  GST: { en: "GST", hi: "जीएसटी" },
  "NON-GST": { en: "Estimate Order", hi: "अनुमानित ऑर्डर (Estimate Order)" },
};

// Invoice Status (derived: paid vs balance due wording, used in print/labels)
export const invoiceStatusMap: EnumMap = {
  Paid: { en: "Paid", hi: "भुगतान हो गया" },
  "Balance Due": { en: "Balance Due", hi: "शेष देय राशि" },
  "Total Payable": { en: "Total Payable", hi: "कुल देय राशि" },
};

// Repair Status - storage.ts Repair["status"]
export const repairStatusMap: EnumMap = {
  Received: { en: "Received", hi: "प्राप्त" },
  "In Progress": { en: "In Progress", hi: "प्रगति पर" },
  Ready: { en: "Ready", hi: "तैयार" },
  Delivered: { en: "Delivered", hi: "डिलीवर हो गया" },
};

// Order Status - storage.ts Order["status"]
export const orderStatusMap: EnumMap = {
  Pending: { en: "Pending", hi: "लंबित" },
  "In Progress": { en: "In Progress", hi: "प्रगति पर" },
  Ready: { en: "Ready", hi: "तैयार" },
  Delivered: { en: "Delivered", hi: "डिलीवर हो गया" },
  Cancelled: { en: "Cancelled", hi: "रद्द" },
};


// Transaction Type - suppliers.tsx ledger entries
export const transactionTypeMap: EnumMap = {
  Credit: { en: "Credit", hi: "जमा" },
  Debit: { en: "Debit", hi: "नामे" },
};

// Interest Type / Period - the field Girvi actually persists (interestPeriod)
export const interestPeriodMap: EnumMap = {
  Daily: { en: "Daily", hi: "दैनिक" },
  Monthly: { en: "Monthly", hi: "मासिक" },
  Yearly: { en: "Yearly", hi: "वार्षिक" },
};

// Purity - free-text field everywhere (no enforced dropdown), this only
// translates the label when a shop happens to use one of these common
// presets; any custom text a shop owner types is returned unchanged.
export const purityMap: EnumMap = {
  "24K": { en: "24K", hi: "24 कैरेट" },
  "22K": { en: "22K", hi: "22 कैरेट" },
  "18K": { en: "18K", hi: "18 कैरेट" },
  "925": { en: "925", hi: "925" },
};

// Gender - not modeled anywhere in the app yet. Stub map, ready to populate
// if/when a gender field is added to any entity.
export const genderMap: EnumMap = {
  // Male: { en: "Male", hi: "पुरुष" },
  // Female: { en: "Female", hi: "महिला" },
  // Other: { en: "Other", hi: "अन्य" },
};

// Customer Type - not modeled anywhere in the app yet. Stub map, ready to
// populate if/when a customer-type field is added.
export const customerTypeMap: EnumMap = {
  // Retail: { en: "Retail", hi: "खुदरा" },
  // Wholesale: { en: "Wholesale", hi: "थोक" },
};
