const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URI
});

redisClient.on("connect", () => console.log("[redis] connected"));
redisClient.on("error", (err) => console.error("[redis] error:", err));

redisClient.connect();

module.exports = redisClient;
