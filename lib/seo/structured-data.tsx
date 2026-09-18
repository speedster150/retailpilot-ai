import React from 'react'
import { getSiteUrl, SITE_CONFIG } from './config'

export interface FaqItem {
  question: string
  answer: string
}

export function generateStructuredData(faqs: FaqItem[]) {
  const siteUrl = getSiteUrl()

  const organizationSchema = {
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: SITE_CONFIG.name,
    legalName: SITE_CONFIG.legalName,
    url: siteUrl,
    logo: `${siteUrl}/favicon.ico`,
    description: SITE_CONFIG.fullDescription,
    email: SITE_CONFIG.supportEmail,
    sameAs: ['https://github.com/speedster150/retailpilot-ai'],
  }

  const websiteSchema = {
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: siteUrl,
    name: SITE_CONFIG.name,
    description: SITE_CONFIG.shortDescription,
    publisher: {
      '@id': `${siteUrl}/#organization`,
    },
    inLanguage: 'en-US',
  }

  const softwareApplicationSchema = {
    '@type': 'SoftwareApplication',
    '@id': `${siteUrl}/#softwareapplication`,
    name: SITE_CONFIG.name,
    applicationCategory: SITE_CONFIG.category,
    applicationSubCategory: SITE_CONFIG.applicationSubCategory,
    operatingSystem: SITE_CONFIG.operatingSystem,
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock',
    },
    description: SITE_CONFIG.fullDescription,
    featureList: [
      'Immutable FIFO-compliant inventory ledger',
      'Real-time Point of Sale (POS) and receipt printing',
      'Autonomous AI assistant powered by Model Context Protocol (MCP)',
      'Automated stockout alerts and dead stock audits via Make.com webhooks',
      'Multi-tenant data isolation with PostgreSQL Row Level Security (RLS)',
      'Role-based access control for Owner, Manager, Cashier, and Customer',
      'End-of-day sales dossiers and automated financial reporting',
    ],
    publisher: {
      '@id': `${siteUrl}/#organization`,
    },
  }

  const webPageSchema = {
    '@type': 'WebPage',
    '@id': `${siteUrl}/#webpage`,
    url: siteUrl,
    name: `${SITE_CONFIG.name} — AI-Powered Retail & Inventory Management SaaS`,
    isPartOf: {
      '@id': `${siteUrl}/#website`,
    },
    about: {
      '@id': `${siteUrl}/#softwareapplication`,
    },
    description: SITE_CONFIG.shortDescription,
    inLanguage: 'en-US',
  }

  const faqSchema = {
    '@type': 'FAQPage',
    '@id': `${siteUrl}/#faqpage`,
    mainEntity: faqs.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      organizationSchema,
      websiteSchema,
      softwareApplicationSchema,
      webPageSchema,
      ...(faqs.length > 0 ? [faqSchema] : []),
    ],
  }
}

export function StructuredDataScript({ faqs = [] }: { faqs?: FaqItem[] }) {
  const structuredData = generateStructuredData(faqs)

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData),
      }}
    />
  )
}
