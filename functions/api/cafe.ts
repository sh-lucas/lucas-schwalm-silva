import { type CafeEnv, handleCafe } from '../../server/cafe'

export const onRequest = ({
	request,
	env,
}: { request: Request; env: CafeEnv }) => handleCafe(request, env)
