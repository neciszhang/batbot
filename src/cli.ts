import { existsSync, mkdirSync } from "node:fs";
import chalk from "chalk";
import { confirm } from "@clack/prompts";
import { BatBotCommand } from "./command";
import { syncWorkspaceTemplates } from "./utils";
import { VERSION, LOGO } from "./index";
import {
  getConfigPath,
  getWorkspacePath,
  saveConfig,
  loadConfig,
  ConfigSchema,
} from "./config";
import { logger } from "./log";

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
  .action(() => {
    console.log("Interacting with agent...");
  });

program
  .command("status")
  .description("Show batbot status.")
  .action(() => {
    console.log("Showing batbot status...");
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
