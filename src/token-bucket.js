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

// Token bucket configuration
const BUCKET_CAPACITY = 10;  // Maximum number of tokens
const REFILL_RATE_MS = 6000;  // Rate at which tokens are added 1 token per 6 seconds

// Middleware for Redis-based Token Bucket rate limiting
async function tokenBucketRateLimiter(req, res, next) {
    const apiKey = req.query['apiKey'];
    const currentTime = Date.now();  // Current time in milliseconds
    const refillInterval = REFILL_RATE_MS;  // Interval for refilling tokens
    const bucketKey = `${apiKey}:bucket`;
    const lastRefillKey = `${apiKey}:lastRefill`;

    try {
        // Get the current state of the token bucket and last refill time
        const [bucketData, lastRefillData] = await redis.mget(bucketKey, lastRefillKey);

        const bucket = bucketData ? parseInt(bucketData) : BUCKET_CAPACITY;
        const lastRefill = lastRefillData ? parseInt(lastRefillData) : currentTime;

        // Calculate the number of tokens to refill
        const elapsedTime = currentTime - lastRefill;
        const refillTokens = Math.floor(elapsedTime / refillInterval);
        const newBucket = Math.min(BUCKET_CAPACITY, bucket + refillTokens);

        // Update the bucket and last refill time in Redis
        await redis.multi()
            .set(bucketKey, newBucket)
            .set(lastRefillKey, currentTime)
            .exec();

        if (newBucket > 0) {
            // Token available, allow the request
            await redis.decr(bucketKey);  // Decrement token count
            next();
        } else {
            // No tokens available, reject the request
            res.status(429).send('Too many requests, please try again later.');
        }
    } catch (error) {
        console.error('Redis error:', error);
        res.status(500).send('Internal server error');
    }
}

await fastify.register(fastifyExpress);

// Apply the token bucket rate limiter to all routes
fastify.use(tokenBucketRateLimiter);

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