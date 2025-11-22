export default {
	async fetch(request, env) {
		const url = new URL(request.url);
		const path = url.pathname;

		// CORS Headers
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, X-Gifuto-Sketch-Key, X-Gifuto-Params, X-Gifuto-Config',
		};

		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		// DEBUG: Log all env keys to find the correct binding name
		console.log('Worker Request:', request.method, path);
		console.log('Env Keys JSON:', JSON.stringify(Object.keys(env)));

		if (!env.GIFUTO_ITEMS) console.error('GIFUTO_ITEMS is undefined!');

		// --- /api/sketches ---

		// POST /api/sketches - Save a new sketch
		if (path === '/api/sketches' && request.method === 'POST') {
			try {
				const data = await request.json();
				const { title, code, paramsSchema, ownerId } = data;

				if (!code) return new Response('Code is required', { status: 400, headers: corsHeaders });

				const id = crypto.randomUUID();
				const now = new Date().toISOString();

				const sketch = {
					id,
					title: title || 'Untitled Sketch',
					code,
					paramsSchema: paramsSchema || {},
					ownerId: ownerId || null,
					createdAt: now,
					updatedAt: now,
				};

				// Save to KV
				await env.GIFUTO_ITEMS.put(`sketch:${id}`, JSON.stringify(sketch));

				// Add to latest list (separate list for sketches)
				const listKey = 'latest_sketches';
				let list = (await env.GIFUTO_ITEMS.get(listKey, { type: 'json' })) || [];
				list.unshift({ id, title: sketch.title, createdAt: now });
				if (list.length > 50) list = list.slice(0, 50);
				await env.GIFUTO_ITEMS.put(listKey, JSON.stringify(list));

				return new Response(JSON.stringify(sketch), {
					headers: { ...corsHeaders, 'Content-Type': 'application/json' },
				});
			} catch (e) {
				return new Response('Error saving sketch: ' + e.message, { status: 500, headers: corsHeaders });
			}
		}

		// GET /api/sketches/latest
		if (path === '/api/sketches/latest' && request.method === 'GET') {
			const list = (await env.GIFUTO_ITEMS.get('latest_sketches', { type: 'json' })) || [];
			return new Response(JSON.stringify(list), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// GET /api/sketches/:id
		if (path.startsWith('/api/sketches/') && request.method === 'GET') {
			const id = path.split('/').pop();
			const sketch = await env.GIFUTO_ITEMS.get(`sketch:${id}`, { type: 'json' });

			if (!sketch) {
				return new Response('Sketch not found', { status: 404, headers: corsHeaders });
			}

			return new Response(JSON.stringify(sketch), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// --- /api/renders (formerly /api/upload) ---

		if (path === '/api/renders' && request.method === 'POST') {
			try {
				// ヘッダーからメタ情報
				const sketchKey = request.headers.get('X-Gifuto-Sketch-Key') || 'unknown';
				const paramsJson = request.headers.get('X-Gifuto-Params') || '{}';
				const configJson = request.headers.get('X-Gifuto-Config') || '{}';

				// durationSec 抜き出し（なければ0）
				let durationSec = 0;
				try {
					const config = JSON.parse(configJson);
					if (config.durationSec) durationSec = config.durationSec;
					else if (config.duration) durationSec = config.duration / 1000;
				} catch (e) {
					// 無視でOK
				}

				// バケット取得（今のenvを見る限り、gifuto_media が正）
				const bucket = env.gifuto_media; // ここ、さっきの Env keys に合わせてる
				if (!bucket) {
					return new Response('R2 bucket gifuto_media not configured. Env keys: ' + JSON.stringify(Object.keys(env)), {
						status: 500,
						headers: corsHeaders,
					});
				}

				// 本体：WebMバイナリ
				const webmBuffer = await request.arrayBuffer();

				// キー生成（適当に）
				const id = crypto.randomUUID();
				const key = `renders/${sketchKey}/${id}.webm`;

				await bucket.put(key, webmBuffer, {
					httpMetadata: { contentType: 'video/webm' },
				});

				// メタ情報を KV に保存（GIFUTO_ITEMS がそれっぽい）
				const now = new Date().toISOString();
				if (env.GIFUTO_ITEMS) {
					const meta = {
						id,
						key,
						sketchKey,
						createdAt: now,
						durationSec,
						params: JSON.parse(paramsJson || '{}'),
					};
					await env.GIFUTO_ITEMS.put(`render:${id}`, JSON.stringify(meta));
				}

				const responseBody = {
					id,
					key,
					url: `/media/${key}`,
					sketchKey,
					durationSec,
					createdAt: now,
				};

				return new Response(JSON.stringify(responseBody), {
					status: 200,
					headers: {
						...corsHeaders,
						'Content-Type': 'application/json',
					},
				});
			} catch (e) {
				return new Response(String(e && e.message ? e.message : e), {
					status: 500,
					headers: corsHeaders,
				});
			}
		}

		// GET /api/renders/latest (and legacy /api/items/latest)
		if ((path === '/api/renders/latest' || path === '/api/items/latest') && request.method === 'GET') {
			const list =
				(await env.GIFUTO_ITEMS.get('latest_renders', { type: 'json' })) ||
				(await env.GIFUTO_ITEMS.get('latest_items', { type: 'json' })) ||
				[];
			return new Response(JSON.stringify(list), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// GET /api/renders/:id
		if (path.startsWith('/api/renders/') && request.method === 'GET') {
			const id = path.split('/').pop();
			const metadata = await env.GIFUTO_ITEMS.get(`render:${id}`, { type: 'json' });

			if (!metadata) {
				return new Response('Render not found', { status: 404, headers: corsHeaders });
			}

			return new Response(JSON.stringify(metadata), {
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			});
		}

		// Media serving (if needed via worker, though R2 public URL is preferred)
		// if (path.startsWith('/media/')) {
		// 	const key = path.replace('/media/', '');
		// 	const bucket = env.gifuto - media;
		// 	if (!bucket) return new Response('Bucket not configured', { status: 500, headers: corsHeaders });

		// 	const object = await bucket.get(key);
		// 	if (!object) return new Response('Not found', { status: 404, headers: corsHeaders });
		// 	return new Response(object.body, {
		// 		headers: { ...corsHeaders, 'Content-Type': object.httpMetadata.contentType },
		// 	});
		// }
		const bucket = env.gifuto_media; // これ一択にする
		if (!bucket) {
			return new Response('R2 bucket gifuto_media not configured. Env keys: ' + JSON.stringify(Object.keys(env)), {
				status: 500,
				headers: corsHeaders,
			});
		}

		return new Response('Not Found', { status: 404, headers: corsHeaders });
	},
};
