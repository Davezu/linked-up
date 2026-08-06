import 'dotenv/config';
import { handler } from './handler';

/**
 * Builds a fake API Gateway (HTTP API v2 style) event, just enough
 * shape for handler.ts's getMethod/getPath/getSourceIp to work.
 */
function makeEvent(opts: {
    method: string;
    path: string;
    body?: unknown;
    token?: string;
    query?: Record<string, string>;
}) {
    return {
        httpMethod: opts.method,
        rawPath: opts.path,
        path: opts.path,
        headers: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
        queryStringParameters: opts.query ?? null,
        body: opts.body ? JSON.stringify(opts.body) : null,
        requestContext: {
            http: { method: opts.method, path: opts.path, sourceIp: '127.0.0.1' },
        },
    } as any;
}

async function call(label: string, opts: Parameters<typeof makeEvent>[0]) {
    const result = await handler(makeEvent(opts));
    const body = result.body ? JSON.parse(result.body) : null;
    console.log(`\n--- ${label} ---`);
    console.log('status:', result.statusCode);
    console.log('body:', body);
    return { status: result.statusCode, body };
}

async function main() {
    // 1. Register
    const register = await call('POST /auth/register', {
        method: 'POST',
        path: '/auth/register',
    });
    const { combinedCredential } = register.body;

    // 2. Login
    const login = await call('POST /auth/login', {
        method: 'POST',
        path: '/auth/login',
        body: { loginCode: combinedCredential },
    });
    const { token } = login.body;

    // 3. Create a link
    const created = await call('POST /links (create)', {
        method: 'POST',
        path: '/links',
        token,
        body: { url: 'https://example.com', title: 'Example' },
    });
    const linkId = created.body.record.id;

    // 4. List links — should show exactly the one we just created
    await call('GET /links (list)', {
        method: 'GET',
        path: '/links',
        token,
    });

    // 5. Update status
    await call('PUT /links (update status)', {
        method: 'PUT',
        path: '/links',
        token,
        body: { id: linkId, status: 'Finished' },
    });

    // 6. Delete
    await call('DELETE /links (delete)', {
        method: 'DELETE',
        path: '/links',
        token,
        body: { id: linkId },
    });

    // 7. Access without a token — should be 401
    await call('GET /links (no token, should 401)', {
        method: 'GET',
        path: '/links',
    });

    // 8. Hammer login with a wrong code to trigger rate limiting
    console.log('\n--- Hammering /auth/login to test rate limit ---');
    for (let i = 1; i <= 7; i++) {
        const res = await call(`login attempt #${i} (wrong code)`, {
            method: 'POST',
            path: '/auth/login',
            body: { loginCode: 'LO-acc-deadbeefdeadbeef-XXX-XXX-XXX' },
        });
        if (res.status === 429) {
            console.log(`✅ Rate limit kicked in on attempt #${i}`);
            break;
        }
    }

    console.log('\nAll local invoke tests completed.');
}

main().catch((e) => {
    console.error('Unexpected error:', e);
    process.exit(1);
});