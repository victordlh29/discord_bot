import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { errorHandler } from "./core/middleware/errorHandler";
import apiRoutes from "./api/routes";

(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return this.toString();
};

const app = express();
app.set("trust proxy", 1);

const swaggerDefinition = {
  openapi: "3.0.0",
  info: {
    title: "STAN PLAYA SEGUNDO API",
    version: "1.0.0",
    description: "API del sistema de gamificación para Discord",
  },
  servers: [
    { url: "http://localhost:4000", description: "Development" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerSpec = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: ["./src/api/routes/*.ts"],
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // Swagger UI requiere scripts y estilos desde CDN
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",
        "cdn.jsdelivr.net",
        "unpkg.com",
        "cdnjs.cloudflare.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "cdn.jsdelivr.net",
        "unpkg.com",
        "fonts.googleapis.com",
        "cdnjs.cloudflare.com",
      ],
      fontSrc: ["'self'", "fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "validator.swagger.io", "cdn.jsdelivr.net"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // Solo en producción: forzar tráfico HTTPS
      ...(process.env.NODE_ENV === "production"
        ? { upgradeInsecureRequests: [] }
        : {}),
    },
  },
}));
app.use(compression());
app.use(cors({
  origin: process.env.DASHBOARD_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests, please try again later" },
});

const adminLoginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Demasiados intentos de login. Intenta de nuevo en 1 minuto" },
});

const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Intentar obtener userId del JWT (access token en cookie)
    // Usamos ignoreExpiration porque el refresh se llama justo cuando el token expiró
    const tokenCookie = req.cookies?.token;
    if (tokenCookie) {
      try {
        const secret = process.env.JWT_SECRET;
        if (secret && secret !== "stanplaya-jwt-secret-dev") {
          const decoded = jwt.verify(tokenCookie, secret, { ignoreExpiration: true }) as { userId?: string };
          if (decoded?.userId) return `user:${decoded.userId}`;
        }
      } catch {
        // Token inválido — usar IP como fallback
      }
    }
    return req.ip || "unknown";
  },
  message: { status: "error", message: "Demasiadas solicitudes de renovación. Intenta de nuevo en 1 minuto" },
});

const logoutLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Demasiadas solicitudes de cierre de sesión. Intenta de nuevo en 1 minuto" },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.originalUrl.startsWith("/api/auth") || req.originalUrl.startsWith("/api/sse"),
  message: { status: "error", message: "Too many requests, please try again later" },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/auth/verify", authLimiter);
app.use("/api/auth/refresh", refreshLimiter);
app.use("/api/auth/logout", logoutLimiter);
app.use("/api/auth/logout-all", logoutLimiter);
app.use("/api/auth/admin-login", adminLoginLimiter);
app.use("/api/", apiLimiter);

if (process.env.SWAGGER_ENABLED === "true") {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
app.use("/api", apiRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "success", message: "Server is running", timestamp: new Date().toISOString() });
});

app.use(errorHandler);

export default app;
