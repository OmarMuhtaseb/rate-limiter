import Fastify from 'fastify';
import fastifyExpress from '@fastify/express';

const fastify = Fastify({
    logger: true
});

// Rate limiter configuration
const RATE_LIMIT = 10;  // Maximum requests per window
const WINDOW_SIZE_MS = 1 * 60 * 1000;  // 1 minute
const STORE = {};  // Stores the state of each API's tokens

// Middleware for custom rate limiting
function rateLimiter(req, res, next) {
    const apiKey = req.query['apiKey'];

    // Initialize the bucket if it doesn't exist
    if (!STORE[apiKey]) {
        STORE[apiKey] = {
            tokens: RATE_LIMIT,
            lastRefill: Date.now(),
        };
    }

    const currentTime = Date.now();
    const elapsedTime = currentTime - STORE[apiKey].lastRefill;

    // Refill tokens based on the time elapsed
    if (elapsedTime > WINDOW_SIZE_MS) {
        STORE[apiKey].tokens = RATE_LIMIT;
        STORE[apiKey].lastRefill = currentTime;
    }

    // Check if the user has tokens left
    if (STORE[apiKey].tokens > 0) {
        STORE[apiKey].tokens -= 1;  // Consume a token
        next();  // Proceed to the next middleware/route handler
    } else {
        res.status(429).send('Too many requests, please try again later.');
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