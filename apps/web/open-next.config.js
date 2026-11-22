// OpenNext configuration for Cloudflare Workers
// Allows deploying Next.js full-stack (SSR & App Router) to Cloudflare Workers

/** @type {import('@opennextjs/cloudflare').OpenNextConfig} */
const config = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy'
    }
  }
};

export default config;
