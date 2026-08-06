export async function retry<T>(
    fn: () => Promise<T>,
    retries = 3,
    baseDelayMs = 500
): Promise<T> {

    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            const status = (error as any)?.status;
            const isClientError = typeof status === "number" && status >= 400 && status < 500;

            if (isClientError || attempt === retries - 1) {
                break;
            }

            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}