import * as express from "express";
import * as bodyParser from "body-parser";
import * as passport from "passport";
import * as cookieParser from "cookie-parser";

import * as localStrategy from "passport-local";
import * as session from "express-session";
import * as connectRedis from "connect-redis";
import * as redis from "redis";
import * as http from "http";
import * as cors from "cors";

async function Main() {
  passport.use(
    "local",
    new localStrategy.Strategy((username, password, done) => {
      console.log("local strategy begin", username, password);
      done(null, {
        "X-Hasura-User-Id": "1",
        "X-Hasura-Role": "user",
      });
    }),
  );

  passport.serializeUser((user, done) => {
    console.log("serializing user", user);
    done(null, JSON.stringify(user));
  });

  passport.deserializeUser((ds: any, done) => {
    console.log("deserializing", ds);
    done(null, JSON.parse(ds));
  });

  const redisStore = connectRedis(session);
  const redisClient = redis.createClient();

  const app = express();
  app.use(cookieParser("test"));
  app.use(bodyParser.json());

  app.use(
    cors({
      origin: "http://localhost:8080",
      credentials: true,
    }),
  );

  app.use((req, res, next) => {
    console.log("Log", req.url, req.body, req.headers, req.cookies);
    next();
  });
  app.use(
    session({
      store: new redisStore({
        client: redisClient,
      }),
      secret: "test",
      resave: false,
      saveUninitialized: false,
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.post(
    "/login",
    (req, res, next) => {
      if (req.headers["x-auth-strategy"]) {
        passport.authenticate(req.headers["x-auth-strategy"])(req, res, next);
      } else {
        passport.authenticate("local")(req, res, next);
      }
    },
    async (req, res) => {
      console.log("/login reached", req.user);
      res.json({});
    },
  );

  app.all("/auth", async (req, res) => {
    console.log("/auth reached", req.user, req.body, req.headers);
    if (req.user) {
      res.json(req.user);
    } else {
      res.json({ "X-Hasura-Role": "guest" });
    }
  });

  app.post("/logout", function (req, res) {
    req.logout();
    res.json({});
  });

  http.createServer(app).listen(5000, "0.0.0.0");
}

Main().catch(console.log);
