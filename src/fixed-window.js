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
const RATE_LIMIT = 10;  // Maximum requests per window
const WINDOW_SIZE_MS = 1 * 60 * 1000;  // 1 minute in milliseconds

// Middleware for Redis-based rate limiting
async function rateLimiter(req, res, next) {
    const apiKey = req.query['apiKey'];
    const currentTime = Math.floor(Date.now() / 1000);  // Current time in seconds

    try {
        // Use Redis transaction (multi) to safely manage the tokens
        const response = await redis.multi()
            .set([`${apiKey}:start_time`, currentTime, 'NX', 'EX', WINDOW_SIZE_MS / 1000])  // Set start time with expiry
            .incr(`${apiKey}:count`)  // Increment request count
            .expire(`${apiKey}:count`, WINDOW_SIZE_MS / 1000)  // Set expiry for the count
            .exec();

        if (response[1][1] < RATE_LIMIT) {
            next();  // Proceed to the next middleware/route handler
        } else {
            res.status(429).send('Too many requests, please try again later.');
        }
    } catch (error) {
        console.error('Redis error:', error);
        res.status(500).send('Internal server error');
    }
}


await fastify.register(fastifyExpress);

// Apply the custom rate limiter to all routes
fastify.use(rateLimiter);

fastify.get('/', (request, reply) => {
    reply.send({hello: 'world'});
});

fastify.get('/api', (request, reply) => {
    reply.send({hello: 'world world 2'});
});

fastify.listen({port: 3000}, function (err, address) {
    if (err) {
        fastify.log.error(err);
        process.exit(1);
    }
});