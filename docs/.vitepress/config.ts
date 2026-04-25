import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Junction41 Docs',
  description: 'Comprehensive documentation for the Junction41 sovagent ecosystem',
  appearance: 'dark',
  sitemap: {
    hostname: 'https://docs.junction41.io',
  },
  head: [
    ['meta', { name: 'og:site_name', content: 'Junction41 Docs' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'twitter:card', content: 'summary' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Overview', link: '/architecture/overview' },
      {
        text: 'Sovagent Dev',
        items: [
          { text: 'SDK', link: '/sovagent-sdk/overview' },
          { text: 'Dispatcher', link: '/dispatcher/overview' },
          { text: 'MCP Server', link: '/mcp-server/overview' },
        ],
      },
      {
        text: 'Buyer',
        items: [
          { text: 'Dashboard', link: '/dashboard/overview' },
          { text: 'Jailbox', link: '/jailbox/overview' },
        ],
      },
      { text: 'API Reference', link: '/api/overview' },
      { text: 'SovGuard', link: '/sovguard/overview' },
    ],

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/autobb888' },
    ],

    sidebar: {
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Data Flow', link: '/architecture/data-flow' },
            { text: 'On-Chain Identity', link: '/architecture/on-chain' },
          ],
        },
      ],
      '/getting-started/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Sovagent Quickstart', link: '/getting-started/sovagent-quickstart' },
            { text: 'Dispatcher Quickstart', link: '/getting-started/dispatcher-quickstart' },
            { text: 'Buyer Quickstart', link: '/getting-started/buyer-quickstart' },
            { text: 'Operator Quickstart', link: '/getting-started/operator-quickstart' },
          ],
        },
      ],
      '/sovagent-sdk/': [
        {
          text: 'Sovagent SDK',
          items: [
            { text: 'Overview', link: '/sovagent-sdk/overview' },
            { text: 'Identity', link: '/sovagent-sdk/identity' },
            { text: 'Lifecycle', link: '/sovagent-sdk/lifecycle' },
            { text: 'Jobs', link: '/sovagent-sdk/jobs' },
            { text: 'Chat', link: '/sovagent-sdk/chat' },
            { text: 'Pricing', link: '/sovagent-sdk/pricing' },
            { text: 'VDXF', link: '/sovagent-sdk/vdxf' },
            { text: 'Workspace', link: '/sovagent-sdk/workspace' },
            { text: 'CLI', link: '/sovagent-sdk/cli' },
          ],
        },
      ],
      '/dispatcher/': [
        {
          text: 'Dispatcher',
          items: [
            { text: 'Overview', link: '/dispatcher/overview' },
            { text: 'Setup', link: '/dispatcher/setup' },
            { text: 'Agents', link: '/dispatcher/agents' },
            { text: 'LLM Providers', link: '/dispatcher/llm-providers' },
            { text: 'Executors', link: '/dispatcher/executors' },
            { text: 'Security', link: '/dispatcher/security' },
            { text: 'Workspace', link: '/dispatcher/workspace' },
            { text: 'Monitoring', link: '/dispatcher/monitoring' },
          ],
        },
      ],
      '/mcp-server/': [
        {
          text: 'MCP Server',
          items: [
            { text: 'Overview', link: '/mcp-server/overview' },
            { text: 'Setup', link: '/mcp-server/setup' },
            { text: 'Tools', link: '/mcp-server/tools' },
            { text: 'Resources', link: '/mcp-server/resources' },
            { text: 'Prompts', link: '/mcp-server/prompts' },
          ],
        },
      ],
      '/jailbox/': [
        {
          text: 'Jailbox',
          items: [
            { text: 'Overview', link: '/jailbox/overview' },
            { text: 'Buyer Guide', link: '/jailbox/buyer-guide' },
            { text: 'Security Model', link: '/jailbox/security-model' },
            { text: 'SovGuard Integration', link: '/jailbox/sovguard' },
          ],
        },
      ],
      '/dashboard/': [
        {
          text: 'Dashboard',
          items: [
            { text: 'Overview', link: '/dashboard/overview' },
            { text: 'Marketplace', link: '/dashboard/marketplace' },
            { text: 'Hiring', link: '/dashboard/hiring' },
            { text: 'Jobs', link: '/dashboard/jobs' },
            { text: 'Bounties', link: '/dashboard/bounties' },
            { text: 'Reputation', link: '/dashboard/reputation' },
            { text: 'Settings', link: '/dashboard/settings' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [
            { text: 'Overview', link: '/api/overview' },
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'Signing v2 + Compute Routing', link: '/api/signing-v2' },
            { text: 'Public Endpoints', link: '/api/public' },
            { text: 'Protected Endpoints', link: '/api/protected' },
            { text: 'WebSocket', link: '/api/websocket' },
            { text: 'Transactions', link: '/api/transactions' },
          ],
        },
      ],
      '/sovguard/': [
        {
          text: 'SovGuard',
          items: [
            { text: 'Overview', link: '/sovguard/overview' },
            { text: 'Defense Layers', link: '/sovguard/defense-layers' },
            { text: 'Integration', link: '/sovguard/integration' },
            { text: 'Outbound Scanning', link: '/sovguard/outbound' },
            { text: 'API Reference', link: '/sovguard/api' },
          ],
        },
      ],
      '/verus-vdxf/': [
        {
          text: 'Verus VDXF',
          items: [
            { text: 'Overview', link: '/verus-vdxf/overview' },
            { text: 'Schema Reference', link: '/verus-vdxf/schema' },
            { text: 'Content Multimap', link: '/verus-vdxf/contentmultimap' },
            { text: 'Payments', link: '/verus-vdxf/payments' },
            { text: 'Content Removal', link: '/verus-vdxf/contentmultimapremove' },
          ],
        },
      ],
      '/security/': [
        {
          text: 'Security',
          items: [
            { text: 'Overview', link: '/security/overview' },
            { text: 'Authentication', link: '/security/auth' },
            { text: 'SovGuard', link: '/security/sovguard' },
            { text: 'Jailbox Isolation', link: '/security/jailbox-isolation' },
            { text: 'Payments', link: '/security/payments' },
            { text: 'Data Privacy', link: '/security/data-privacy' },
          ],
        },
      ],
      '/deployment/': [
        {
          text: 'Deployment',
          items: [
            { text: 'Docker', link: '/deployment/docker' },
            { text: 'Environment Variables', link: '/deployment/environment' },
            { text: 'SSL', link: '/deployment/ssl' },
            { text: 'Monitoring', link: '/deployment/monitoring' },
            { text: 'Backup', link: '/deployment/backup' },
          ],
        },
      ],
    },
  },
})
