import { defineConfig, loadEnv } from 'vite'
import { handleCafe } from './server/cafe'

export default defineConfig(({ mode }) => {
	const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
	return {
		plugins: [
			{
				name: 'coffee-counter-api',
				configureServer(server) {
					server.middlewares.use('/api/cafe', async (req, res) => {
						try {
							const chunks = []
							let size = 0
							for await (const chunk of req) {
								size += chunk.length
								if (size > 1024) {
									res.statusCode = 413
									res.end()
									return
								}
								chunks.push(chunk)
							}
							const response = await handleCafe(
								new Request(`http://${req.headers.host}/api/cafe`, {
									method: req.method,
									headers: new Headers(
										Object.entries(req.headers).flatMap(([key, value]) =>
											value
												? [
														[
															key,
															Array.isArray(value) ? value.join(', ') : value,
														],
													]
												: [],
										),
									),
									...(req.method === 'POST'
										? { body: Buffer.concat(chunks).toString() }
										: {}),
								}),
								env,
							)
							res.statusCode = response.status
							response.headers.forEach((value, key) =>
								res.setHeader(key, value),
							)
							res.end(await response.text())
						} catch {
							res.statusCode = 503
							res.end(
								JSON.stringify({ error: 'The coffee counter is unavailable.' }),
							)
						}
					})
				},
			},
		],
		server: { port: 5173, host: true },
		build: { outDir: 'dist', sourcemap: true },
	}
})
