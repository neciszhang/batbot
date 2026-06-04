#!/usr/bin/env node

import { existsSync, mkdirSync } from "node:fs";
import chalk from "chalk";
import { confirm } from "@clack/prompts";
import { resolve } from "node:path";
import { BatBotCommand } from "./command";
import { syncWorkspaceTemplates } from "./utils";
import { VERSION, LOGO } from "./index";
import {
  getConfigPath,
  getWorkspacePath,
  saveConfig,
  loadConfig,
  ConfigSchema,
  setConfigPath,
  ConfigManger,
} from "./config";
import { CustomProvider, getProviderLabel, PROVIDER_SPECS } from "./providers";
import { logger } from "./log";
import { MessageBus } from "./bus";
import { SessionManager } from "./session/manager";

const _loadRuntimeConfig = (configPath: string, workspace: string) => {
  let config;
  if (configPath) {
    const fullPath = resolve(configPath);
    if (!existsSync(fullPath)) {
      logger.error(`Error: Config file not found:  ${fullPath}`);
      process.exit(1);
    }
    setConfigPath(fullPath);
    config = loadConfig(fullPath);
    logger.info(`Using config file: ${fullPath}`);
  } else {
    config = loadConfig();
  }
  if (workspace) {
    config.agents.defaults.workspace = workspace;
  }
  return config;
};

const _makeProvider = (config: ConfigManger) => {
  const model = config.agents.defaults.model;
  const providerName = config.getProviderName(model);
  const p = config.getProvider(model);
  if (providerName === "custom") {
    if (p) {
      const provider = new CustomProvider(
        p.apiKey,
        p.apiBase ?? "http://localhost:8000/v1",
        model,
      );
      return provider;
    }
  }
  // const providerName =
  // return config.providers[config.agents.defaults.provider];
};

const program = new BatBotCommand();

program
  .name("batbot")
  .description(`${LOGO} batbot - Personal AI Assistant`)
  .version(VERSION, "-v, --version", "output the version number");

program
  .command("onboard")
  .description("Initialize batbot configuration and workspace.")
  .action(async () => {
    const configPath = getConfigPath();
    const workspace = getWorkspacePath();

    const config = ConfigSchema.parse(undefined);

    if (existsSync(configPath)) {
      logger.warn(`Config already exists at ${configPath}`);
      logger.info(
        "Yes = overwrite with defaults (existing values will be lost)",
      );
      logger.info(
        "No = refresh config, keeping existing values and adding new fields",
      );
      const isOverwrite = await confirm({
        message: "Overwrite?",
      });

      if (isOverwrite) {
        saveConfig(config);
        logger.success(`Config reset to defaults at ${configPath}`);
      } else {
        const existingConfig = loadConfig();
        saveConfig(existingConfig);
        logger.success(
          `Config refreshed at ${configPath} (existing values preserved)`,
        );
      }
    } else {
      saveConfig(config);
      logger.success(`Created config at ${configPath}`);
    }

    if (!existsSync(workspace)) {
      mkdirSync(workspace, { recursive: true });
      logger.success(`Creating workspace directory: ${workspace}`);
    }

    syncWorkspaceTemplates(workspace);

    logger.info(`\n${LOGO} batbot is ready!`);
    logger.info(`\nNext steps:`);
    logger.info(`  1. Add your API key to ${chalk.cyan(configPath)}`);
    logger.info(`     Get one at: https://openrouter.ai/keys`);
    logger.info(`  2. Chat: ${chalk.cyan('batbot agent -m "Hello!"')}`);
    logger.info(
      `\n${chalk.dim("Want Telegram/WhatsApp? See: https://github.com/neciszhang/batbot#-chat-apps")}`,
    );
  });

program
  .command("gateway")
  .description("Start the batbot gateway.")
  .action(() => {
    console.log("Starting batbot gateway...");
  });

program
  .command("agent")
  .description("Interact with the agent directly.")
  .option("-m, --message <message>", "Message to send to the agent")
  .option("-s, --session <id>", "Session ID", "cli:direct")
  .option("-w, --workspace <path>", "Workspace path")
  .option("-c, --config <path>", "Path to config file")
  .action((options) => {
    const config = _loadRuntimeConfig(options.config, options.workspace);
    syncWorkspaceTemplates(config.workspacePath);
    const bus = new MessageBus();
    const provider = _makeProvider(config);
    const sessionManager = new SessionManager(config.workspacePath);

    // console.log(JSON.stringify(config));
  });

program
  .command("status")
  .description("Show batbot status.")
  .action(() => {
    const configPath = getConfigPath();
    const config = loadConfig();
    const workspace = config.workspacePath;
    logger.info(`\n${LOGO} batbot is ready!`);
    logger.info(
      `Config file: ${logger.chalk.magenta(configPath)} ${existsSync(configPath) ? logger.chalk.green("✓") : logger.chalk.red("✗")}`,
    );
    logger.info(
      `Workspace: ${logger.chalk.magenta(workspace)} ${existsSync(workspace) ? logger.chalk.green("✓") : logger.chalk.red("✗")}`,
    );

    if (existsSync(configPath)) {
      logger.info(`Model: ${config.agents.defaults.model}`);
    }

    for (const spec of PROVIDER_SPECS) {
      const p = config.providers[spec.name as keyof typeof config.providers];
      if (!p) continue;

      const label = getProviderLabel(spec);

      if (spec.is_local) {
        if (Boolean(p.apiBase)) {
          logger.info(`${label}: ${logger.chalk.green("✓")}`);
        } else {
          logger.info(`${label}: ${logger.chalk.gray("not set")}`);
        }
      }
      if (Boolean(p.apiKey)) {
        logger.info(`${label}: ${logger.chalk.green("✓")}`);
      } else {
        logger.info(`${label}: ${logger.chalk.gray("not set")}`);
      }
    }
  });

program
  .command("channels")
  .description("Manage channels.")
  .action(() => {
    console.log("Managing channels...");
  });

program
  .command("provider")
  .description("Manage providers.")
  .action(() => {
    console.log("Managing providers...");
  });

program.parse();
