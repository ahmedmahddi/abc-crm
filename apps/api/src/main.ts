import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import express, { type Express, type Request, type Response } from "express";
import { AppModule } from "./app.module";

let server: Express | undefined;

async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 4000;
  await app.listen(port);
}

async function createServer() {
  const expressInstance = express();
  const app = await createApp(expressInstance);
  await app.init();
  return expressInstance;
}

async function createApp(expressInstance?: Express) {
  const app = expressInstance
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressInstance))
    : await NestFactory.create(AppModule);
  configureApp(app);
  return app;
}

function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const webOrigins = parseAllowedOrigins(config.get<string>("APP_URL") ?? "http://localhost:3000");

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: webOrigins,
    credentials: true,
  });

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("ABC CRM API")
    .setDescription("Backend API for ABC CRM")
    .setVersion("0.1.0")
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("docs", app, document);
}

if (!process.env.VERCEL) {
  void bootstrap();
}

export default async function handler(request: Request, response: Response) {
  server ??= await createServer();
  return server(request, response);
}

function parseAllowedOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}
