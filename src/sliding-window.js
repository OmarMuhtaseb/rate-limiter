import Fastify from 'fastify';
import fastifyExpress from '@fastify/express';
import Redis from 'ioredis';

const fastify = Fastify({
    logger: true
});

const redis = new Redis({
    host: 'localhost',  // Redis server host
    port: 6379,         // Redis server port
});

// Rate limiter configuration
const RATE_LIMIT = 10;  // Maximum requests per sliding window
const WINDOW_SIZE_MS = 1 * 60 * 1000;  // 1 minute in milliseconds

// Middleware for Redis-based Sliding Window rate limiting
async function slidingWindowRateLimiter(req, res, next) {
    console.log('Request received');
    const apiKey = req.query['apiKey'];
    const currentTime = Date.now();  // Current time in milliseconds
    const windowStartTime = currentTime - WINDOW_SIZE_MS;  // Start time for the sliding window

    try {
        // Remove any requests outside the sliding window
        await redis.zremrangebyscore(apiKey, 0, windowStartTime);

        // Get the number of requests in the current sliding window
        const requestCount = await redis.zcard(apiKey);

        if (requestCount < RATE_LIMIT) {
            // Add the current request timestamp to the sorted set only if within limit
            await redis.zadd(apiKey, currentTime, `${apiKey}-${currentTime}`);
            next();  // Allow the request to proceed
        } else {
            res.status(429).send('Too many requests, please try again later.');
        }
    } catch (error) {
        console.error('Redis error:', error);
        res.status(500).send('Internal server error');
    }
}

await fastify.register(fastifyExpress);

// Apply the sliding window rate limiter to all routes
fastify.use(slidingWindowRateLimiter);

fastify.get('/', (request, reply) => {
    reply.send({hello: 'world'});
});

fastify.get('/api', (request, reply) => {
    reply.send({hello: 'world world 2'});
});

fastify.listen({port: 3000}, function (err, address) {
    console.log(`Server listening on ${address}`);
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});