import sodium from 'tweetsodium';

/**
 * Configure GitHub Repository Secrets via GitHub REST API.
 * Reads credentials from environment variables:
 * - GITHUB_TOKEN (Personal Access Token with repo scope)
 * - GITHUB_REPO (owner/repo, e.g. jeevansurya560-arch/Clover)
 */
const token = process.env.GITHUB_TOKEN;
const repo = process.env.GITHUB_REPO || 'jeevansurya560-arch/Clover';

if (!token) {
  console.error('Error: GITHUB_TOKEN environment variable is required.');
  process.exit(1);
}

const secrets = {
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  DATABASE_URL: process.env.DATABASE_URL || '',
  SUPABASE_URL: process.env.SUPABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || '',
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || '',
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL || '',
};

async function setSecret(name, value, key_id, key) {
  if (!value) return;
  const keyBytes = Buffer.from(key, 'base64');
  const messageBytes = Buffer.from(value);
  const encrypted = sodium.seal(messageBytes, keyBytes);
  const encrypted_value = Buffer.from(encrypted).toString('base64');

  const res = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'node',
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json',
    },
    body: JSON.stringify({ encrypted_value, key_id }),
  });

  if (res.status === 201 || res.status === 204) {
    console.log(`Secret ${name} configured (${res.status})`);
  } else {
    console.error(`Failed to set ${name}:`, res.status, await res.text());
  }
}

async function main() {
  const pkRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
    headers: {
      Authorization: `token ${token}`,
      'User-Agent': 'node',
      Accept: 'application/vnd.github+json',
    },
  });
  const { key_id, key } = await pkRes.json();
  console.log(`Repository public key id: ${key_id}`);

  for (const [name, val] of Object.entries(secrets)) {
    await setSecret(name, val, key_id, key);
  }
}

main().catch(console.error);
