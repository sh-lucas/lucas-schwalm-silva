import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto'
import { loadEnv } from 'vite'
import { ACTIONS, PUBLIC_DOMAINS, ROOT } from '../src/cafe-model'

// Signs the public browser token. It can only run the game templates on the game domains.
const env = { ...loadEnv('development', process.cwd(), ''), ...process.env }
const API = 'https://plinth.sh-lucas.dev/v1'
const days = Number(process.argv[2] ?? 365)

async function main() {
	const login = await fetch(`${API}/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			email: env.PLINTH_EMAIL,
			password: env.PLINTH_PASSWORD,
		}),
	})
	if (!login.ok) throw new Error(`Admin login failed: ${login.status}`)
	const { token, tenant } = (await login.json()) as {
		token: string
		tenant: string
	}
	let kid = env.PLINTH_SIGNING_KID
	let privateKey = env.PLINTH_SIGNING_KEY
	if (!kid || !privateKey) {
		const pair = generateKeyPairSync('ed25519')
		kid = `cafe-${new Date().toISOString().slice(0, 10)}`
		privateKey = pair.privateKey
			.export({ type: 'pkcs8', format: 'der' })
			.toString('base64')
		// The last 32 bytes of the SPKI DER are the raw Ed25519 public key.
		const publicKey = pair.publicKey
			.export({ type: 'spki', format: 'der' })
			.subarray(-32)
			.toString('base64')
		const put = await fetch(`${API}/auth/signing-key`, {
			method: 'PUT',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ kid, public_key: publicKey }),
		})
		if (!put.ok) throw new Error(`Key registration failed: ${await put.text()}`)
		console.log(
			`# Add to .env.local (private):\nPLINTH_SIGNING_KID=${kid}\nPLINTH_SIGNING_KEY=${privateKey}`,
		)
	}
	const b64 = (value: unknown) =>
		Buffer.from(JSON.stringify(value)).toString('base64url')
	const iat = Math.floor(Date.now() / 1000)
	const unsigned = `${b64({ alg: 'EdDSA', typ: 'JWT', kid })}.${b64({
		iss: 'portfolio-cafe',
		sub: 'browser',
		iat,
		exp: iat + days * 86400,
		plinth: {
			tenant,
			access: {
				admin: false,
				templates: ACTIONS.filter((action) => action !== 'race').map(
					(action) => `${ROOT}-${action}`,
				),
				domains: PUBLIC_DOMAINS,
				backdating: false,
				unscoped_bucket_inputs: false,
				propose: false,
			},
		},
	})}`
	const key = createPrivateKey({
		key: Buffer.from(privateKey, 'base64'),
		format: 'der',
		type: 'pkcs8',
	})
	const jwt = `${unsigned}.${sign(null, Buffer.from(unsigned), key).toString('base64url')}`
	const check = await fetch(`${API}/templates`, {
		headers: { Authorization: `Bearer ${jwt}` },
	})
	if (!check.ok)
		throw new Error(
			`Plinth refused the token (${check.status}). PLINTH_TOKEN_MAX_TTL may be below ${days} days.`,
		)
	console.log(`# Public browser token:\nVITE_PLINTH_TOKEN=${jwt}`)
}
main().catch((error) => {
	console.error(error.message)
	process.exitCode = 1
})
