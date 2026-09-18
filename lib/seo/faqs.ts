import type { FaqItem } from './structured-data'

export const RETAILPILOT_FAQS: FaqItem[] = [
  {
    question: 'What is RetailPilot AI?',
    answer:
      'RetailPilot AI is an enterprise-grade, cloud-native retail management SaaS designed for supermarkets, grocery stores, and specialty retailers. It unifies Point of Sale (POS), double-entry ledger-backed inventory tracking, supplier procurement, customer loyalty, and an autonomous AI assistant powered by the Model Context Protocol (MCP).',
  },
  {
    question: 'What makes RetailPilot AI different from conventional POS systems?',
    answer:
      'Unlike traditional retail systems that mutate stock counters and suffer from phantom inventory, RetailPilot AI enforces an immutable double-entry inventory ledger. Every sale, purchase receipt, and return is permanently recorded, providing audit-proof stock balances and FIFO accounting compliance.',
  },
  {
    question: 'How does RetailPilot AI use the Model Context Protocol (MCP)?',
    answer:
      'RetailPilot AI connects its integrated AI Assistant to a dedicated Model Context Protocol (MCP) server. This provides the AI with secure, deterministic, read-only tools to check real-time stock balances, analyze sales trends, identify dead stock, and generate operational recommendations within tenant boundaries.',
  },
  {
    question: 'How is store data kept secure between different tenant organizations?',
    answer:
      'RetailPilot AI enforces strict multi-tenant isolation at the database layer using Supabase PostgreSQL Row Level Security (RLS). Every query, transaction, and ledger entry is verified against the authenticated user’s active organization membership and role.',
  },
  {
    question: 'What automated workflows does RetailPilot AI support?',
    answer:
      'The platform integrates with Make.com webhook automation to trigger instant low-stock reorder notices, bi-weekly dead stock audit reports, overdue supplier payment escalations, and end-of-day sales dossier dispatches.',
  },
  {
    question: 'Can RetailPilot AI operate on mobile tablets and barcode scanners?',
    answer:
      'Yes. The interface is engineered with responsive, touch-friendly layouts optimized for mobile devices, counter tablets, and desktop workstations supporting standard USB and Bluetooth barcode scanning hardware.',
  },
  {
    question: 'What user roles are available in RetailPilot AI?',
    answer:
      'RetailPilot AI includes five tailored roles: Admin / Owner (full administrative access), Store Manager (inventory, sales, and analytics control), Sales Staff (POS and checkout access), Inventory Staff (goods receipts and stock management), and Customer (access to the self-service Customer Portal).',
  },
]
