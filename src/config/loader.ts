import path from "node:path";
import fs from "node:fs";
import { getConfigPath } from "./paths";
import { Config, ConfigSchema } from "./schema";
import { logger } from "../log";

export const loadConfig = (configPath?: string) => {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return ConfigSchema.parse(data);
  } catch (e) {
    logger.warn(`Failed to load config from ${filePath}: ${e}`);
    logger.info(`Using default configuration.`);
  }

  return ConfigSchema.parse({});
};

export const saveConfig = (config: Config, configPath?: string) => {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
};
