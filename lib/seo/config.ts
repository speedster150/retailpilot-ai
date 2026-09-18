// ==============================================================================
// RetailPilot AI — Production SEO & Site Configuration
// ==============================================================================

/**
 * Resolves the fully-qualified canonical production site URL.
 * Strictly respects the production URL configured in environment variables
 * or Vercel deployment variables, with a fallback to the official production domain.
 */
export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return 'https://retailpilot.ai'
}

export const SITE_CONFIG = {
  name: 'RetailPilot AI',
  legalName: 'RetailPilot AI Inc.',
  productName: 'RetailPilot AI',
  shortDescription:
    'Cloud-based multi-tenant retail management platform with ledger-backed inventory, Point-of-Sale (POS), and AI operations via MCP.',
  fullDescription:
    'RetailPilot AI is an enterprise-grade, multi-tenant retail management and inventory SaaS. It features an immutable FIFO-compliant inventory ledger, high-speed Point-of-Sale (POS), automated stockout prevention, Make.com webhook workflows, and an autonomous AI assistant powered by the Model Context Protocol (MCP).',
  category: 'BusinessApplication',
  applicationSubCategory: 'Retail & Inventory Management Software',
  operatingSystem: 'All modern web browsers (Chrome, Safari, Edge, Firefox), cloud-native',
  authors: [{ name: 'RetailPilot AI Engineering Team' }],
  creator: 'RetailPilot AI',
  publisher: 'RetailPilot AI',
  keywords: [
    'RetailPilot AI',
    'retail management software',
    'inventory ledger',
    'cloud POS system',
    'Model Context Protocol retail',
    'MCP AI retail assistant',
    'multi-tenant retail SaaS',
    'supermarket management system',
    'FIFO inventory tracking',
    'dead stock prevention',
    'automated reorder alert',
    'retail analytics dashboard',
  ],
  supportEmail: 'support@retailpilot.ai',
}
